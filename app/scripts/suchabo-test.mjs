#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Suchabos (gespeicherte Suchen + Alarm): Prüfreise (P5.6)

   Prüft beide Wege eines Suchabos:
     · angemeldet — sofort aktiv, verwaltbar (Häufigkeit, Pause, Löschen),
       gegen IDOR abgesichert (fremde ID → NOT_FOUND).
     · anonym — Double-Opt-in per Bestätigungsmail, danach nur über den
       Abmeldelink verwaltbar.
   sowie die Alarmprüfung (server/suchabo-matching.ts): sie MUSS dieselbe
   server/search.ts:suche()-Funktion nutzen wie die interaktive Suche — das
   Skript verlässt sich dafür auf das reale Verhalten (ein Alarm mit
   query.ref=<bestehendes Inserat> muss genau dieses eine Inserat treffen,
   weil suche() bei gesetztem ref exakt diesen Kurzschluss nimmt).

   WICHTIGER HINWEIS (siehe P5.6-Bericht des Auftrags "server/gespeicherteSuchen.ts"):
   `mail_outbox.kind` (db/migrations/0013_outbox.sql) kennt die zwei neuen
   Mailarten "search_alert_confirm"/"search_alert_match" NOCH NICHT (CHECK-
   Bedingung). Bis eine Migration das nachträgt, schlagen alle Schritte fehl,
   die eine dieser beiden Mailarten einreihen — das sind hier die Schritte
   2 (anonyme Bestätigungsmail) und 12/13 (Alarm-Mail). Das ist eine
   Schema-Lücke, keine Anwendungslogik dieses Skripts.

   Aufruf:
     set -a; . ./.env.local; set +a
     node scripts/suchabo-test.mjs [Basis-URL]      Standard: http://localhost:3007

   Mailquelle (siehe scripts/lib/mailquelle.mjs): FW_TEST_MAIL_QUELLE=dev|mailpit|imap
   (Standard: dev — passend zum Standard-MAIL_PROVIDER der Entwicklung).

   Ausgabe: nummerierte Tabelle, Exit 1 bei irgendeinem FEHLER, sonst 0.
   Die Datei ändert an der Anwendung nichts — sie meldet nur Befunde.
   ============================================================ */
import postgres from "postgres";
import { randomBytes } from "node:crypto";
import { mailquelle, testadresse } from "./lib/mailquelle.mjs";

const BASIS = (process.argv[2] || "http://localhost:3007").replace(/\/$/, "");
const TIMEOUT_MS = 60_000;
const TS = Date.now();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a)"); process.exit(2); }
const sql = postgres(DATABASE_URL, { max: 4, onnotice: () => {} });

const PASSWORT = "Such-" + randomBytes(12).toString("base64url");
const EMAIL_ANON = testadresse("saa", TS);
const EMAIL_A = testadresse("sab", TS);
const EMAIL_B = testadresse("sac", TS);
const EMAIL_C = testadresse("sad", TS);

const ergebnisse = [];
function assertTrue(bedingung, meldung) { if (!bedingung) throw new Error(meldung); }
function assertGleich(ist, soll, feld) {
  if (ist !== soll) throw new Error(`${feld}: erwartet ${JSON.stringify(soll)}, erhalten ${JSON.stringify(ist)}`);
}
async function schritt(nr, titel, fn) {
  try {
    const detail = (await fn()) || "ok";
    ergebnisse.push({ nr, titel, status: "OK", detail });
    console.log(`OK      ${String(nr).padStart(2)}  ${titel}`);
  } catch (e) {
    const detail = e && e.message ? e.message : String(e);
    ergebnisse.push({ nr, titel, status: "FEHLER", detail });
    console.log(`FEHLER  ${String(nr).padStart(2)}  ${titel} — ${detail}`);
  }
}

/* ---------- Verschiedene x-forwarded-for-Adressen (Registrierung 5/h, Anmeldung 8/5min je Herkunft) ---------- */
const RUNSEED = Math.floor(Math.random() * 200) + 10;
const xffMap = new Map();
function xff(tag) {
  if (!xffMap.has(tag)) xffMap.set(tag, `10.${RUNSEED}.${xffMap.size + 1}.31`);
  return xffMap.get(tag);
}

/* ---------- HTTP-Hilfsfunktionen ---------- */
async function api(method, pfad, { cookie, origin, body, headers = {}, xffTag } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const h = { ...headers };
    if (cookie) h["cookie"] = cookie;
    if (origin !== undefined) h["origin"] = origin;
    if (xffTag) h["x-forwarded-for"] = xff(xffTag);
    let payload;
    if (body !== undefined) { h["content-type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await fetch(BASIS + pfad, { method, headers: h, body: payload, redirect: "manual", signal: ctrl.signal });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* kein JSON */ }
    const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    return { status: res.status, json, text, setCookies, location: res.headers.get("location") };
  } finally { clearTimeout(timer); }
}
const get = (p, o) => api("GET", p, o);
const post = (p, o) => api("POST", p, o);
const patch = (p, o) => api("PATCH", p, o);
const del = (p, o) => api("DELETE", p, o);
function cookieAus(setCookies) {
  const c = setCookies.find(c => c.startsWith("fw.session_token="));
  return c ? c.split(";")[0] : null;
}

const MAILQUELLE = mailquelle();
async function bestaetigeMail(email) {
  const mail = await MAILQUELLE.warte(email, null);
  if (!mail) throw new Error(`Keine Mail für ${email} über Mailquelle "${MAILQUELLE.name}" gefunden (30 s gewartet)`);
  const treffer = mail.text.match(/https?:\/\/\S+/);
  if (!treffer) throw new Error(`Keine URL in der Mail an ${email} gefunden`);
  const res = await fetch(treffer[0], { redirect: "manual" });
  return { status: res.status, location: res.headers.get("location"), text: mail.text };
}
async function registrieren(email, passwort, name, xffTag) {
  return post("/api/auth/sign-up/email", { origin: BASIS, xffTag, body: { email, password: passwort, name } });
}
async function anmelden(email, passwort, xffTag) {
  const r = await post("/api/auth/sign-in/email", { origin: BASIS, xffTag, body: { email, password: passwort } });
  return { ...r, cookie: cookieAus(r.setCookies) };
}
async function registrierenUndAnmelden(email, name, tagPrefix) {
  const su = await registrieren(email, PASSWORT, name, `${tagPrefix}-signup`);
  assertGleich(su.status, 200, "sign-up status");
  const best = await bestaetigeMail(email);
  assertGleich(best.status, 302, "bestätigung status");
  const si = await anmelden(email, PASSWORT, `${tagPrefix}-auth`);
  assertGleich(si.status, 200, "sign-in status");
  assertTrue(!!si.cookie, "kein Sitzungscookie erhalten");
  return { email, cookie: si.cookie, id: si.json.user.id };
}

const START = Date.now();
console.log(`Basis: ${BASIS}  —  Suchabo-Prüfreise startet (TS=${TS}, Mailquelle=${MAILQUELLE.name})`);

let refDemo, listingIdDemo, titelDemo;
let A, B;
let savedSearchIdA, alertIdAnon;

/* ============================================================
   1 — Ein bestehendes, veröffentlichtes Demo-Inserat besorgen
   ============================================================ */
await schritt(1, "Demo-Inserat aus der DB besorgen", async () => {
  const [row] = await sql`SELECT id, public_ref, title FROM listing WHERE is_demo AND status = 'published' LIMIT 1`;
  assertTrue(!!row, "kein veröffentlichtes Demo-Inserat gefunden");
  refDemo = row.public_ref; listingIdDemo = row.id; titelDemo = row.title;
  return `refDemo=${refDemo}, titel=${titelDemo}`;
});

/* ============================================================
   (a) Anonym: Suchabo anlegen → Bestätigungsmail
   ============================================================ */
let anonAngenommen = false;
await schritt(2, "Anonym: POST /api/suchabo mit E-Mail → ok:true, erfordertBestaetigung:true", async () => {
  const r = await post("/api/suchabo", {
    origin: BASIS,
    body: { query: { trans: "buy", nurFrei: true }, label: "Prüfreise anonym", email: EMAIL_ANON, frequency: "daily", locale: "de" }
  });
  if (r.status !== 201) {
    throw new Error(`status=${r.status} (erwartet 201) — body=${JSON.stringify(r.json ?? r.text).slice(0, 300)}. `
      + `Erwarteter Grund: mail_outbox.kind kennt "search_alert_confirm" noch nicht (CHECK-Bedingung, siehe Dateikopf/Bericht).`);
  }
  assertGleich(r.json?.ok, true, "ok");
  assertGleich(r.json?.erfordertBestaetigung, true, "erfordertBestaetigung");
  anonAngenommen = true;
  const [row] = await sql`SELECT sa.id AS alert_id FROM search_alert sa WHERE sa.email = ${EMAIL_ANON} LIMIT 1`;
  assertTrue(!!row, "keine search_alert-Zeile für die anonyme Adresse gefunden");
  alertIdAnon = row.alert_id;
  return `status=${r.status}, erfordertBestaetigung=${r.json.erfordertBestaetigung}`;
});

/* ============================================================
   (b) Bestätigungslink aufrufen
   ============================================================ */
await schritt(3, "Bestätigungsmail finden, Link aufrufen → confirmed_at gesetzt", async () => {
  assertTrue(anonAngenommen, "Schritt 2 ist fehlgeschlagen — keine Mail zu erwarten");
  const best = await bestaetigeMail(EMAIL_ANON);
  assertGleich(best.status, 302, "status des Bestätigungslinks");
  const [row] = await sql`SELECT confirmed_at, confirm_token FROM search_alert WHERE id = ${alertIdAnon}`;
  assertTrue(row?.confirmed_at != null, "confirmed_at ist NULL");
  assertGleich(row.confirm_token, null, "confirm_token nach Bestätigung");
  return `status=${best.status}, confirmed_at gesetzt, confirm_token=NULL`;
});

/* ============================================================
   (c) Angemeldetes Konto: sofort aktiv, keine Bestätigung nötig
   ============================================================ */
await schritt(4, "Konto A registrieren, bestätigen, anmelden", async () => {
  A = await registrierenUndAnmelden(EMAIL_A, "Such A", "saba");
  return `id=${A.id}`;
});

await schritt(5, "Konto A: POST /api/suchabo OHNE email → sofort erfordertBestaetigung:false", async () => {
  const r = await post("/api/suchabo", {
    origin: BASIS, cookie: A.cookie,
    body: { query: { trans: "rent", nurFrei: true }, label: "Prüfreise A", frequency: "weekly" }
  });
  assertGleich(r.status, 201, "status");
  assertGleich(r.json?.ok, true, "ok");
  assertGleich(r.json?.erfordertBestaetigung, false, "erfordertBestaetigung");
  const [row] = await sql`
    SELECT ss.id AS saved_search_id, sa.confirmed_at, sa.email
      FROM saved_search ss JOIN search_alert sa ON sa.saved_search_id = ss.id
     WHERE ss.user_id = ${A.id} ORDER BY ss.created_at DESC LIMIT 1`;
  assertTrue(!!row, "keine saved_search-Zeile für A gefunden");
  assertTrue(row.confirmed_at != null, "confirmed_at ist NULL (sollte bei Konto sofort gesetzt sein)");
  assertGleich(String(row.email), A.email, "search_alert.email");
  savedSearchIdA = row.saved_search_id;
  return `status=${r.status}, erfordertBestaetigung=${r.json.erfordertBestaetigung}, dbConfirmedAt gesetzt`;
});

/* ============================================================
   (d) Liste
   ============================================================ */
await schritt(6, "GET /api/suchabo zeigt die Suche von A", async () => {
  const r = await get("/api/suchabo", { cookie: A.cookie });
  assertGleich(r.status, 200, "status");
  const treffer = (r.json?.suchen ?? []).find(s => s.id === savedSearchIdA);
  assertTrue(!!treffer, `${savedSearchIdA} nicht in der Liste gefunden`);
  assertGleich(treffer.alert.frequency, "weekly", "frequency in der Liste");
  assertGleich(treffer.alert.isPaused, false, "isPaused in der Liste");
  return `gefunden: frequency=${treffer.alert.frequency}, isPaused=${treffer.alert.isPaused}`;
});

/* ============================================================
   (e) PATCH Häufigkeit, PATCH pausieren, DELETE — jeweils mit IDOR-Falsifikation
   ============================================================ */
await schritt(7, "PATCH Häufigkeit → immediately", async () => {
  const r = await patch(`/api/suchabo/${savedSearchIdA}`, { origin: BASIS, cookie: A.cookie, body: { frequency: "immediately" } });
  assertGleich(r.status, 200, "status");
  /* Die Datenbank kennt den ENUM-Wert 'instant' (alert_frequency), die API
     spricht "immediately" — Übersetzung in server/gespeicherteSuchen.ts. */
  const [row] = await sql`SELECT frequency FROM search_alert WHERE saved_search_id = ${savedSearchIdA}`;
  assertGleich(row.frequency, "instant", "frequency in der DB (ENUM-Wert)");
  const liste = await get("/api/suchabo", { cookie: A.cookie });
  const treffer = (liste.json?.suchen ?? []).find(s => s.id === savedSearchIdA);
  assertGleich(treffer?.alert?.frequency, "immediately", "frequency über die API");
  return `status=${r.status}, dbFrequency(ENUM)=${row.frequency}, apiFrequency=${treffer.alert.frequency}`;
});

await schritt(8, "PATCH pausieren → isPaused true, dann wieder aktivieren", async () => {
  const r1 = await patch(`/api/suchabo/${savedSearchIdA}`, { origin: BASIS, cookie: A.cookie, body: { isPaused: true } });
  assertGleich(r1.status, 200, "status (pausieren)");
  const [z1] = await sql`SELECT is_paused FROM search_alert WHERE saved_search_id = ${savedSearchIdA}`;
  assertGleich(z1.is_paused, true, "is_paused nach Pausieren");
  const r2 = await patch(`/api/suchabo/${savedSearchIdA}`, { origin: BASIS, cookie: A.cookie, body: { isPaused: false } });
  assertGleich(r2.status, 200, "status (aktivieren)");
  const [z2] = await sql`SELECT is_paused FROM search_alert WHERE saved_search_id = ${savedSearchIdA}`;
  assertGleich(z2.is_paused, false, "is_paused nach Aktivieren");
  return "pausiert → aktiviert, DB stimmt überein";
});

await schritt(9, "Konto B registrieren, bestätigen, anmelden", async () => {
  B = await registrierenUndAnmelden(EMAIL_B, "Such B", "sabb");
  return `id=${B.id}`;
});

await schritt(10, "IDOR: B versucht PATCH auf A's Suchabo → NOT_FOUND, DB unverändert", async () => {
  const r = await patch(`/api/suchabo/${savedSearchIdA}`, { origin: BASIS, cookie: B.cookie, body: { frequency: "daily" } });
  assertGleich(r.status, 404, "status");
  assertGleich(r.json?.error, "NOT_FOUND", "error-code");
  const [row] = await sql`SELECT frequency FROM search_alert WHERE saved_search_id = ${savedSearchIdA}`;
  assertGleich(row.frequency, "instant", "frequency unverändert (B durfte nichts ändern)");
  return `status=${r.status}, error=${r.json?.error}, frequency unverändert=${row.frequency}`;
});

await schritt(11, "IDOR: B versucht DELETE auf A's Suchabo → NOT_FOUND, Zeile bleibt bestehen", async () => {
  const r = await del(`/api/suchabo/${savedSearchIdA}`, { origin: BASIS, cookie: B.cookie });
  assertGleich(r.status, 404, "status");
  assertGleich(r.json?.error, "NOT_FOUND", "error-code");
  const [row] = await sql`SELECT id FROM saved_search WHERE id = ${savedSearchIdA}`;
  assertTrue(!!row, "A's saved_search wurde trotz NOT_FOUND-Antwort gelöscht");
  return `status=${r.status}, error=${r.json?.error}, Zeile besteht weiter`;
});

await schritt(12, "A löscht das eigene Suchabo → Zeile weg (CASCADE räumt search_alert mit)", async () => {
  const r = await del(`/api/suchabo/${savedSearchIdA}`, { origin: BASIS, cookie: A.cookie });
  assertGleich(r.status, 200, "status");
  assertGleich(r.json?.ok, true, "ok");
  const [ss] = await sql`SELECT id FROM saved_search WHERE id = ${savedSearchIdA}`;
  assertTrue(!ss, "saved_search besteht nach dem Löschen noch");
  const alerts = await sql`SELECT id FROM search_alert WHERE saved_search_id = ${savedSearchIdA}`;
  assertGleich(alerts.length, 0, "search_alert-Zeilen nach CASCADE");
  return `status=${r.status}, saved_search und search_alert entfernt`;
});

/* ============================================================
   (f)/(g) Alarmprüfung: exakt ein bestehendes Demo-Inserat treffen
   (query.ref=<publicRef> — derselbe Kurzschluss wie server/search.ts:suche()
   bei einer Kartenvorschau — beweist, dass die Alarmprüfung dieselbe
   suche()-Funktion nutzt wie die interaktive Suche: eine zweite,
   unabhängige Filterlogik würde ref hier nicht kennen). Läuft unter
   Konto A (neu angelegtes Suchabo, sofort bestätigt).
   ============================================================ */
let alertIdMatch, savedSearchIdMatch;
await schritt(13, "A legt ein Suchabo an, das exakt refDemo trifft (query.ref)", async () => {
  const r = await post("/api/suchabo", {
    origin: BASIS, cookie: A.cookie,
    body: { query: { ref: refDemo }, label: "Prüfreise Alarm", frequency: "immediately" }
  });
  assertGleich(r.status, 201, "status");
  assertGleich(r.json?.erfordertBestaetigung, false, "erfordertBestaetigung");
  const [row] = await sql`
    SELECT ss.id AS saved_search_id, sa.id AS alert_id
      FROM saved_search ss JOIN search_alert sa ON sa.saved_search_id = ss.id
     WHERE ss.user_id = ${A.id} AND ss.label = 'Prüfreise Alarm' ORDER BY ss.created_at DESC LIMIT 1`;
  assertTrue(!!row, "keine saved_search für den Alarmtest gefunden");
  savedSearchIdMatch = row.saved_search_id; alertIdMatch = row.alert_id;
  return `savedSearchId=${savedSearchIdMatch}`;
});

await schritt(14, "Alarmlauf: Mail mit dem Titel des Treffers kommt an (ALERT_INTERVAL_MS abwarten)", async () => {
  const seit = Date.now();
  const mail = await MAILQUELLE.warte(A.email, seit, 90_000, 2000);
  if (!mail) {
    const [row] = await sql`SELECT last_run_at, last_sent_at FROM search_alert WHERE id = ${alertIdMatch}`;
    throw new Error(`Keine Alarm-Mail an ${A.email} innert 90 s gefunden (last_run_at=${row?.last_run_at ?? "NULL"}, last_sent_at=${row?.last_sent_at ?? "NULL"}). `
      + `Erwarteter Grund: mail_outbox.kind kennt "search_alert_match" noch nicht (CHECK-Bedingung, siehe Dateikopf/Bericht).`);
  }
  assertTrue(mail.text.includes(titelDemo), `Titel "${titelDemo}" nicht in der Alarm-Mail gefunden`);
  const gesendet = await sql`SELECT listing_id FROM search_alert_sent WHERE alert_id = ${alertIdMatch}`;
  assertTrue(gesendet.some(g => String(g.listing_id) === String(listingIdDemo)), "search_alert_sent enthält den Treffer nicht");
  return `Mail gefunden, Titel enthalten, search_alert_sent-Zeile vorhanden`;
});

await schritt(15, "Dedup: ein weiterer Alarmlauf verschickt denselben Treffer nicht doppelt", async () => {
  const vorher = await sql`SELECT count(*)::int AS n FROM search_alert_sent WHERE alert_id = ${alertIdMatch}`;
  /* Ein ALERT_INTERVAL_MS-Tick abwarten (Standard 30 s, plus Marge) und erneut zählen. */
  await new Promise(r => setTimeout(r, 35_000));
  const nachher = await sql`SELECT count(*)::int AS n FROM search_alert_sent WHERE alert_id = ${alertIdMatch}`;
  assertGleich(Number(nachher[0].n), Number(vorher[0].n), "Anzahl search_alert_sent-Zeilen nach weiterem Tick");
  return `search_alert_sent-Zeilen unverändert: ${nachher[0].n}`;
});

/* ============================================================
   ABSCHLUSS
   ============================================================ */
const dauerMs = Date.now() - START;

function tabelle() {
  const w1 = 4;
  const w2 = Math.max(20, ...ergebnisse.map(e => e.titel.length));
  const w3 = 6;
  const zeile = (a, b, c, d) => `${String(a).padStart(w1)}  ${String(b).padEnd(w2)}  ${String(c).padEnd(w3)}  ${d}`;
  console.log("\n" + zeile("Nr", "Schritt", "Status", "Detail"));
  console.log("-".repeat(w1 + w2 + w3 + 10));
  for (const e of ergebnisse) console.log(zeile(e.nr, e.titel, e.status, e.detail));
}
tabelle();

const fehlerAnzahl = ergebnisse.filter(e => e.status === "FEHLER").length;
console.log(`\n${ergebnisse.length} Schritte, ${fehlerAnzahl} FEHLER, ${ergebnisse.length - fehlerAnzahl} OK — Dauer ${(dauerMs / 1000).toFixed(1)}s`);

if (fehlerAnzahl > 0) {
  console.log("\nFEHLER im Detail:");
  for (const e of ergebnisse.filter(e => e.status === "FEHLER")) {
    console.log(`  Schritt ${e.nr} (${e.titel}): ${e.detail}`);
  }
}

await sql.end();
process.exit(fehlerAnzahl > 0 ? 1 : 0);
