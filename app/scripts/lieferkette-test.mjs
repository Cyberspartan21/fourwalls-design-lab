#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Lieferketten-Reise (Ende-zu-Ende)

   Prüft die vollständige Lieferkette als EINE zusammenhängende Reise über
   HTTP: Registrierung → Bestätigung → Anmeldung → Entwurf → Assistent →
   Vorschau → Einreichen → Moderation (Änderung verlangt → erneut einreichen
   → freigeben-und-veröffentlichen) → öffentliche Suche/Karte/Objektseite in
   vier Sprachen → Anfrage → Geo-Privatsphäre. Reise A hat 24 Schritte.
   Reise B (negativ, ab Schritt 25) prüft, was NICHT gehen darf.

   Aufruf:
     set -a; . ./.env.local; set +a
     FW_TEST_MOD_EMAIL=... FW_TEST_MOD_PASSWORT=... node scripts/lieferkette-test.mjs [Basis-URL]      Standard: http://localhost:3007

   Mailquelle (P5.5 §53/§54/§63) — siehe scripts/lib/mailquelle.mjs:
     FW_TEST_MAIL_QUELLE   dev (Standard) | mailpit | imap
     FW_TEST_MAIL_DIR      dev: Ordner statt var/mail
     FW_TEST_MAILPIT_URL   mailpit: Basis-URL, Standard http://localhost:58026
     FW_TEST_IMAP_HOST/_PORT/_USER/_PASSWORD   imap: Zugang (Port Standard 993)
     FW_TEST_MAIL_BASIS    Persona-Adressen per Plus-Adressierung auf einem
                            echten Postfach, z. B. staging-persona@beispiel.ch

   Ausgabe:
     - nummerierte Tabelle auf stdout (Schritt → OK/FEHLER + Detail)
     - var/lieferkette-bericht.json
     - Exit 1 bei irgendeinem FEHLER, sonst 0

   Die Datei ändert an der Anwendung nichts — sie meldet nur Befunde.
   ============================================================ */
import postgres from "postgres";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mailquelle, testadresse } from "./lib/mailquelle.mjs";

const HIER = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HIER, "..");

const BASIS = (process.argv[2] || "http://localhost:3007").replace(/\/$/, "");
const TIMEOUT_MS = 60_000;
const TS = Date.now();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a)"); process.exit(2); }
const sql = postgres(DATABASE_URL, { max: 4, onnotice: () => {} });

/* ---------- Kennungen ---------- */
const EMAIL_A = testadresse("lka", TS);
const EMAIL_B = testadresse("lkb", TS);
const PASSWORT = "Lauf-" + randomBytes(12).toString("base64url");
const MOD_EMAIL_STANDARD = process.env.FW_TEST_MOD_EMAIL;
const MOD_PASSWORT_STANDARD = process.env.FW_TEST_MOD_PASSWORT;
if (!MOD_EMAIL_STANDARD || !MOD_PASSWORT_STANDARD) {
  console.error("FW_TEST_MOD_EMAIL und FW_TEST_MOD_PASSWORT fehlen — Zugangsdaten des Moderationskontos kommen aus der Umgebung, nie aus dem Skript.");
  process.exit(2);
}
const BILD_PFAD = join(APP_ROOT, "public", "media", "zurich-altbau-1-960.jpg");
const ORT_ID = "ort-bern";
const STRASSE = `Teststrasse-${TS}`;
const TITEL_A = "Schöne Altbauwohnung mit viel Charme in Bern";
const BESCHREIBUNG_A = "Eine wunderschöne, helle Altbauwohnung mit viel Charme, Parkett und Blick ins Grüne — ideal für Familien.";
const BESCHREIBUNG_A2 = "Überarbeitete Beschreibung: ein zweites, helles Foto vom Wohnzimmer wurde ergänzt, wie von der Moderation gewünscht.";
const RUECKMELDUNG_TEXT = `Bitte ergänzen Sie ein weiteres Foto — Lieferkettenprüfung ${TS}.`;

const LOCALES = ["de", "fr", "it", "en"];
const PFAD = {
  de: { immobilien: "immobilien", kaufen: "kaufen", mieten: "mieten" },
  fr: { immobilien: "immobilier", kaufen: "acheter", mieten: "louer" },
  it: { immobilien: "immobili", kaufen: "comprare", mieten: "affittare" },
  en: { immobilien: "properties", kaufen: "buy", mieten: "rent" }
};

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

/* ---------- Verschiedene x-forwarded-for-Adressen für IP-begrenzte Routen
   (Registrierung 5/h, Anmeldung 8/5min je Herkunft) ---------- */
const RUNSEED = Math.floor(Math.random() * 200) + 10;
const xffMap = new Map();
function xff(tag) {
  if (!xffMap.has(tag)) xffMap.set(tag, `10.${RUNSEED}.${xffMap.size + 1}.11`);
  return xffMap.get(tag);
}

/* ---------- HTTP-Hilfsfunktionen (JSON-API) ---------- */
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

function cookieAus(setCookies) {
  const c = setCookies.find(c => c.startsWith("fw.session_token="));
  return c ? c.split(";")[0] : null;
}

/* ---------- HTML-Seiten (Vorschau, Objektseite, RSC-Nutzlast) ---------- */
async function holenHtml(pfad, { cookie, headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const h = { ...headers };
    if (cookie) h["cookie"] = cookie;
    const res = await fetch(BASIS + pfad, { headers: h, redirect: "manual", signal: ctrl.signal });
    const text = await res.text().catch(() => "");
    return { status: res.status, text, location: res.headers.get("location") };
  } finally { clearTimeout(timer); }
}

/* ---------- Bild-Upload (multipart) ---------- */
async function uploadBytes(cookie, bytes, dateiname, mime) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const fd = new FormData();
    fd.append("datei", new Blob([bytes], { type: mime }), dateiname);
    const res = await fetch(BASIS + "/api/medien", {
      method: "POST", headers: { origin: BASIS, cookie }, body: fd, redirect: "manual", signal: ctrl.signal
    });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* kein JSON */ }
    return { status: res.status, json, text };
  } finally { clearTimeout(timer); }
}
const uploadDatei = (cookie, pfad, dateiname, mime) => uploadBytes(cookie, readFileSync(pfad), dateiname, mime);

/* ---------- Mail: die neueste Bestätigungsmail für eine Adresse finden und aufrufen ----------
   Quelle austauschbar über FW_TEST_MAIL_QUELLE (scripts/lib/mailquelle.mjs).
   Die Mail entsteht nicht mehr sofort: sie steht zunächst in der Outbox
   (mail_outbox) und wird erst vom Arbeiter aus instrumentation.ts abgeholt
   (erster Lauf nach 3 s, danach alle OUTBOX_INTERVAL_MS). Bis zu 30 s warten,
   bevor «keine Mail gefunden» gilt. */
const MAILQUELLE = mailquelle();
/* Bestätigungslink je Konto von einer eigenen (fiktiven) Adresse abrufen: die
   allgemeine Auth-Ratenbegrenzung (30/min je IP) zählt sonst alle Bestätigungen
   der gesamten CI-Kette auf 127.0.0.1 zusammen — Befund Lauf 33993756973
   (org-sicherheit V3: 429 statt 302). Verschiedene Personen kommen von
   verschiedenen Adressen; genau das bildet der Kopf ab. */
function bestaetigungsAdresse(email) {
  let h = 0; for (const c of String(email)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `10.${(h >>> 16) & 255}.${(h >>> 8) & 255}.${(h & 253) + 1}`;
}

async function bestaetigeMail(email) {
  const mail = await MAILQUELLE.warte(email, null);
  if (!mail) throw new Error(`Keine Mail für ${email} über Mailquelle "${MAILQUELLE.name}" gefunden (30 s gewartet)`);
  const treffer = mail.text.match(/https?:\/\/\S+/);
  if (!treffer) throw new Error(`Keine URL in der Mail an ${email} gefunden`);
  const res = await fetch(treffer[0], { redirect: "manual", headers: { "x-forwarded-for": bestaetigungsAdresse(email) } });
  return res.status;
}

/* ---------- Registrieren / Anmelden ---------- */
async function registrieren(email, passwort, name, xffTag) {
  return post("/api/auth/sign-up/email", { origin: BASIS, xffTag, body: { email, password: passwort, name } });
}
async function anmelden(email, passwort, xffTag) {
  const r = await post("/api/auth/sign-in/email", { origin: BASIS, xffTag, body: { email, password: passwort } });
  return { ...r, cookie: cookieAus(r.setCookies) };
}

/* ---------- Regex-Fluchtzeichen für Zahlen in HTML/JSON durchsuchen ---------- */
function regexFuerZahl(n) {
  const s = String(n).replace(".", "\\.");
  return new RegExp(`(?<![\\d.])${s}(?![\\d])`);
}

const START = Date.now();
console.log(`Basis: ${BASIS}  —  Lieferketten-Reise startet (TS=${TS})`);

/* ============================================================
   REISE A — Schritte 1–24
   ============================================================ */
let A, MOD, B;
let refA, versionA, bildIdA;
let trefferSuche;

await schritt(1, "USER A registrieren", async () => {
  const r = await registrieren(EMAIL_A, PASSWORT, "User A (Lieferkette)", "a-signup");
  assertGleich(r.status, 200, "status");
  return `status=${r.status}, email=${EMAIL_A}`;
});

await schritt(2, "Bestätigungsmail für A finden und aufrufen", async () => {
  const status = await bestaetigeMail(EMAIL_A);
  assertGleich(status, 302, "status des Bestätigungslinks");
  const [row] = await sql`SELECT email_verified, email_verified_at FROM app_user WHERE email = ${EMAIL_A}`;
  assertTrue(!!row, "kein app_user für A gefunden");
  assertGleich(row.email_verified, true, "email_verified");
  assertTrue(row.email_verified_at != null, "email_verified_at ist NULL");
  return `bestätigung=${status}, email_verified=true, email_verified_at gesetzt`;
});

await schritt(3, "Anmelden", async () => {
  const r = await anmelden(EMAIL_A, PASSWORT, "a-auth");
  assertGleich(r.status, 200, "status");
  assertTrue(!!r.cookie, "kein Sitzungscookie für A erhalten");
  A = { email: EMAIL_A, cookie: r.cookie, id: r.json.user.id };
  return `status=${r.status}, id=${A.id}`;
});

await schritt(4, "Entwurf anlegen", async () => {
  const r = await post("/api/entwuerfe", { origin: BASIS, cookie: A.cookie, body: {} });
  assertGleich(r.status, 201, "status");
  assertTrue(!!r.json?.publicRef, "keine publicRef in der Antwort");
  refA = r.json.publicRef; versionA = r.json.version;
  const [row] = await sql`SELECT status, published_by_user_id FROM listing WHERE public_ref = ${refA}`;
  assertTrue(!!row, "keine listing-Zeile in der DB gefunden");
  assertGleich(row.status, "draft", "status in der DB");
  assertGleich(String(row.published_by_user_id), String(A.id), "published_by_user_id in der DB");
  return `publicRef=${refA}, version=${versionA}, dbStatus=${row.status}`;
});

const versionVerlauf = [];
await schritt(5, "Assistentenschritte speichern (≥3 aufeinanderfolgende PATCH, zuletzt vollständig inkl. Bild)", async () => {
  versionVerlauf.push(versionA);

  const p1 = await patch(`/api/entwuerfe/${refA}`, {
    origin: BASIS, cookie: A.cookie,
    body: { version: versionA, daten: { trans: "sale", typ: "wohnung", ortId: ORT_ID, genauigkeit: "ungefaehr", strasse: STRASSE, hausnummer: "12" } }
  });
  assertGleich(p1.status, 200, "patch1 status");
  versionA = p1.json.version; versionVerlauf.push(versionA);

  const p2 = await patch(`/api/entwuerfe/${refA}`, {
    origin: BASIS, cookie: A.cookie,
    body: { version: versionA, daten: { zimmer: 3.5, flaeche: 90, preis: 750000 } }
  });
  assertGleich(p2.status, 200, "patch2 status");
  versionA = p2.json.version; versionVerlauf.push(versionA);

  const hoch = await uploadDatei(A.cookie, BILD_PFAD, "foto.jpg", "image/jpeg");
  assertGleich(hoch.status, 201, "bild hochladen");
  bildIdA = hoch.json.id;

  const p3 = await patch(`/api/entwuerfe/${refA}`, {
    origin: BASIS, cookie: A.cookie,
    body: { version: versionA, daten: { titel: TITEL_A, beschreibung: BESCHREIBUNG_A, name: "User A", email: EMAIL_A, bilder: [bildIdA] } }
  });
  assertGleich(p3.status, 200, "patch3 status");
  versionA = p3.json.version; versionVerlauf.push(versionA);

  return `3 PATCH-Aufrufe OK, Versionen ${versionVerlauf.join(" → ")}, bildId=${bildIdA}`;
});

await schritt(6, "Autosave-Bestätigung: jede Antwort trägt eine höhere Version als zuvor", async () => {
  assertTrue(versionVerlauf.length === 4, `unerwartete Anzahl aufgezeichneter Versionen: ${versionVerlauf.length}`);
  for (let i = 1; i < versionVerlauf.length; i++) {
    assertTrue(versionVerlauf[i] > versionVerlauf[i - 1], `Version bei PATCH ${i} nicht höher: ${versionVerlauf[i]} <= ${versionVerlauf[i - 1]}`);
  }
  return `Versionsverlauf: ${versionVerlauf.join(" → ")}`;
});

await schritt(7, "Neu laden: GET liefert exakt die gespeicherten Daten", async () => {
  const r = await get(`/api/entwuerfe/${refA}`, { cookie: A.cookie });
  assertGleich(r.status, 200, "status");
  const d = r.json.daten;
  assertGleich(d.titel, TITEL_A, "titel");
  assertGleich(d.preis, 750000, "preis");
  assertGleich(d.ortId, ORT_ID, "ortId");
  assertGleich(JSON.stringify(d.bilder), JSON.stringify([bildIdA]), "bilder");
  return `titel/preis/ortId/bilder stimmen überein (version=${r.json.version})`;
});

await schritt(8, "Entwurf bleibt bestehen: draft_data in der DB gesetzt und enthält den Titel", async () => {
  const [row] = await sql`SELECT draft_data FROM listing WHERE public_ref = ${refA}`;
  assertTrue(!!row?.draft_data, "draft_data ist leer/NULL");
  assertGleich(row.draft_data.titel, TITEL_A, "draft_data.titel");
  return "draft_data gesetzt, titel stimmt überein";
});

await schritt(9, "Vorschau als Eigentümerin (A)", async () => {
  const r = await holenHtml(`/de/vorschau/${refA}`, { cookie: A.cookie });
  assertGleich(r.status, 200, "status");
  assertTrue(r.text.includes(TITEL_A), "Titel nicht im Vorschau-HTML gefunden");
  return `status=${r.status}, Titel im HTML gefunden`;
});

await schritt(10, "Einreichen", async () => {
  const r = await post(`/api/entwuerfe/${refA}/aktion`, { origin: BASIS, cookie: A.cookie, body: { absicht: "einreichen" } });
  assertGleich(r.status, 200, "status");
  const [row] = await sql`SELECT status, submitted_at FROM listing WHERE public_ref = ${refA}`;
  assertGleich(row.status, "submitted", "status in der DB");
  assertTrue(row.submitted_at != null, "submitted_at ist NULL");
  return `status=${r.status}, dbStatus=${row.status}, submitted_at gesetzt`;
});

await schritt(11, "A kann nicht selbst veröffentlichen", async () => {
  const [vor] = await sql`SELECT status FROM listing WHERE public_ref = ${refA}`;
  const r = await post(`/api/moderation/${refA}`, { origin: BASIS, cookie: A.cookie, body: { absicht: "veroeffentlichen" } });
  assertGleich(r.status, 403, "status");
  const [nach] = await sql`SELECT status FROM listing WHERE public_ref = ${refA}`;
  assertGleich(nach.status, vor.status, "status in der DB unverändert");
  return `status=${r.status}, dbStatus unverändert=${nach.status}`;
});

await schritt(12, "Als Moderator anmelden", async () => {
  let r = await anmelden(MOD_EMAIL_STANDARD, MOD_PASSWORT_STANDARD, "mod-auth");
  let modEmail = MOD_EMAIL_STANDARD;
  if (r.status !== 200 || !r.cookie) {
    modEmail = `lkmod+${TS}@fourwalls.example`;
    const su = await registrieren(modEmail, MOD_PASSWORT_STANDARD, "Moderator Lieferkette", "mod-signup");
    assertGleich(su.status, 200, "sign-up Moderator (Fallback)");
    await bestaetigeMail(modEmail);
    r = await anmelden(modEmail, MOD_PASSWORT_STANDARD, "mod-auth");
    assertGleich(r.status, 200, "sign-in Moderator (Fallback)");
    execFileSync(process.execPath, [join(APP_ROOT, "scripts", "rolle.mjs"), modEmail, "moderator"], { stdio: "inherit", env: process.env });
  }
  const [modRow] = await sql`SELECT email_verified FROM app_user WHERE email = ${modEmail}`;
  if (modRow && !modRow.email_verified) {
    await post("/api/auth/send-verification-email", { origin: BASIS, body: { email: modEmail, callbackURL: "/" } });
    await bestaetigeMail(modEmail);
  }
  MOD = { email: modEmail, cookie: r.cookie, id: r.json.user.id };
  return `status=200, email=${modEmail}`;
});

await schritt(13, "Warteschlange enthält den Fall", async () => {
  const r = await get("/api/moderation", { cookie: MOD.cookie });
  assertGleich(r.status, 200, "status");
  const drin = (r.json?.warteschlange ?? []).some(e => e.publicRef === refA);
  assertTrue(drin, `${refA} nicht in der Warteschlange gefunden (${r.json?.warteschlange?.length ?? 0} Einträge)`);
  return `Warteschlange enthält ${refA} (${r.json.warteschlange.length} Einträge insgesamt)`;
});

await schritt(14, "Änderung verlangen mit Nachricht und Grund incomplete", async () => {
  const r = await post(`/api/moderation/${refA}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "aenderung", grund: "incomplete", nachricht: RUECKMELDUNG_TEXT } });
  assertGleich(r.status, 200, "status");
  const [row] = await sql`SELECT status FROM listing WHERE public_ref = ${refA}`;
  assertGleich(row.status, "changes_required", "status in der DB");
  return `status=${r.status}, dbStatus=${row.status}`;
});

await schritt(15, "A sieht die Rückmeldung", async () => {
  const r = await get(`/api/entwuerfe/${refA}`, { cookie: A.cookie });
  assertGleich(r.status, 200, "status");
  assertGleich(r.json?.rueckmeldung?.nachricht, RUECKMELDUNG_TEXT, "rueckmeldung.nachricht");
  versionA = r.json.version;
  return "rueckmeldung.nachricht stimmt überein";
});

await schritt(16, "A bearbeitet (PATCH mit neuer Beschreibung)", async () => {
  const r = await patch(`/api/entwuerfe/${refA}`, { origin: BASIS, cookie: A.cookie, body: { version: versionA, daten: { beschreibung: BESCHREIBUNG_A2 } } });
  assertGleich(r.status, 200, "status");
  versionA = r.json.version;
  return `status=${r.status}, version=${versionA}`;
});

await schritt(17, "A reicht erneut ein", async () => {
  const r = await post(`/api/entwuerfe/${refA}/aktion`, { origin: BASIS, cookie: A.cookie, body: { absicht: "einreichen" } });
  assertGleich(r.status, 200, "status");
  const [row] = await sql`SELECT status FROM listing WHERE public_ref = ${refA}`;
  assertGleich(row.status, "submitted", "status in der DB");
  return `status=${r.status}, dbStatus=${row.status}`;
});

await schritt(18, "Moderator: freigeben-und-veroeffentlichen", async () => {
  const r = await post(`/api/moderation/${refA}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "freigeben-und-veroeffentlichen" } });
  assertGleich(r.status, 200, "status");
  const [row] = await sql`SELECT status, slug, published_at, is_indexable FROM listing WHERE public_ref = ${refA}`;
  assertGleich(row.status, "published", "status in der DB");
  assertTrue(!!row.slug, "slug ist leer");
  assertTrue(row.published_at != null, "published_at ist NULL");
  assertGleich(row.is_indexable, true, "is_indexable");
  return `dbStatus=${row.status}, slug=${row.slug}, is_indexable=${row.is_indexable}`;
});

await schritt(19, "Das Inserat erscheint in der Suche", async () => {
  const r = await get(`/api/search?ort=${ORT_ID}&alle=1&proSeite=48&seite=50`, {});
  assertGleich(r.status, 200, "status");
  trefferSuche = (r.json?.treffer ?? []).find(t => t.id === refA);
  assertTrue(!!trefferSuche, `${refA} nicht in ${r.json?.treffer?.length ?? 0} Suchtreffern gefunden (total=${r.json?.total})`);
  return `gefunden: slug=${trefferSuche.slug}, transactionType=${trefferSuche.transactionType}`;
});

await schritt(20, "Das Inserat erscheint auf der Karte", async () => {
  const r = await get(`/api/search?ort=${ORT_ID}&alle=1&ansicht=karte`, {});
  assertGleich(r.status, 200, "status");
  const drin = (r.json?.punkte ?? []).some(p => p.id === refA);
  assertTrue(drin, `${refA} nicht in ${r.json?.punkte?.length ?? 0} Kartenpunkten gefunden`);
  return `punkte enthält ${refA} (${r.json.punkte.length} Punkte insgesamt)`;
});

await schritt(21, "Öffentliche Route in allen vier Sprachen", async () => {
  assertTrue(!!trefferSuche, "kein Suchtreffer aus Schritt 19 verfügbar");
  const art = trefferSuche.transactionType === "rent" ? "mieten" : "kaufen";
  const details = [];
  for (const l of LOCALES) {
    const pfad = `/${l}/${PFAD[l].immobilien}/${PFAD[l][art]}/${trefferSuche.slug}`;
    const r = await holenHtml(pfad);
    assertGleich(r.status, 200, `status (${l})`);
    assertTrue(r.text.includes(TITEL_A), `Titel nicht gefunden (${l}: ${pfad})`);
    details.push(`${l}=${r.status}`);
  }
  return details.join(", ");
});

await schritt(22, "Anonyme Anfrage (kein Cookie)", async () => {
  const r = await post("/api/inquiries", {
    origin: BASIS, xffTag: "inquiry",
    body: { publicRef: refA, art: "viewing_request", name: "Prüfperson Lieferkette", email: `pruef+${TS}@example.com`, nachricht: "Automatisierte Lieferketten-Prüfung — bitte ignorieren.", firma: "" }
  });
  assertGleich(r.status, 201, "status");
  return `status=${r.status}`;
});

await schritt(23, "Die Anfrage ist USER A zugeordnet", async () => {
  const [row] = await sql`
    SELECT i.recipient_user_id FROM inquiry i JOIN listing l ON l.id = i.listing_id
     WHERE l.public_ref = ${refA} ORDER BY i.created_at DESC LIMIT 1`;
  assertTrue(!!row, "keine inquiry-Zeile für refA gefunden");
  assertGleich(String(row.recipient_user_id), String(A.id), "recipient_user_id");
  return `recipient_user_id=${row.recipient_user_id}`;
});

await schritt(24, "Geo-Privatsphäre: Strasse und exakte Koordinate lecken nirgends", async () => {
  const [geoRow] = await sql`
    SELECT round(ST_X(p.geom_exact::geometry)::numeric, 4) AS lng, round(ST_Y(p.geom_exact::geometry)::numeric, 4) AS lat
      FROM listing l JOIN property p ON p.id = l.property_id WHERE l.public_ref = ${refA}`;
  assertTrue(geoRow && geoRow.lat != null && geoRow.lng != null, "keine exakte Koordinate in der DB gefunden");
  const reLat = regexFuerZahl(geoRow.lat), reLng = regexFuerZahl(geoRow.lng);
  const probleme = [];

  const [listeRes, karteRes] = await Promise.all([
    api("GET", `/api/search?ort=${ORT_ID}&alle=1&proSeite=48&seite=50`, {}),
    api("GET", `/api/search?ort=${ORT_ID}&alle=1&ansicht=karte`, {})
  ]);
  if (listeRes.text.includes(STRASSE)) probleme.push("Strasse in der Suchantwort (Liste)");
  if (karteRes.text.includes(STRASSE)) probleme.push("Strasse in der Kartenantwort");
  if (reLat.test(karteRes.text) && reLng.test(karteRes.text)) probleme.push("exakte Koordinate in der Kartenantwort");

  assertTrue(!!trefferSuche, "kein Suchtreffer aus Schritt 19 verfügbar");
  const art = trefferSuche.transactionType === "rent" ? "mieten" : "kaufen";
  for (const l of LOCALES) {
    const pfad = `/${l}/${PFAD[l].immobilien}/${PFAD[l][art]}/${trefferSuche.slug}`;
    const ssr = await holenHtml(pfad);
    if (ssr.text.includes(STRASSE)) probleme.push(`Strasse im Objektseiten-HTML (${l})`);
    if (l === "de") {
      if (reLat.test(ssr.text) && reLng.test(ssr.text)) probleme.push("exakte Koordinate im Objektseiten-HTML");
      const rsc = await holenHtml(pfad, { headers: { rsc: "1" } });
      if (rsc.text.includes(STRASSE)) probleme.push("Strasse in der RSC-Nutzlast der Objektseite");
    }
  }

  assertTrue(probleme.length === 0, probleme.join("; "));
  return `Strasse (${STRASSE}) in keiner Antwort gefunden; exakte Koordinate (${geoRow.lat},${geoRow.lng}) nicht in Objektseite/Karte gefunden`;
});

/* ============================================================
   REISE B — negativ, Schritte 25–33
   ============================================================ */

await schritt(25, "USER B registrieren, bestätigen, anmelden", async () => {
  const su = await registrieren(EMAIL_B, PASSWORT, "User B (Lieferkette)", "b-signup");
  assertGleich(su.status, 200, "sign-up status");
  const best = await bestaetigeMail(EMAIL_B);
  assertGleich(best, 302, "bestätigung status");
  const si = await anmelden(EMAIL_B, PASSWORT, "b-auth");
  assertGleich(si.status, 200, "sign-in status");
  assertTrue(!!si.cookie, "kein Sitzungscookie für B erhalten");
  B = { email: EMAIL_B, cookie: si.cookie, id: si.json.user.id };
  return `status=${si.status}, id=${B.id}`;
});

await schritt(26, "B liest A's Inserat als Entwurf", async () => {
  const r = await get(`/api/entwuerfe/${refA}`, { cookie: B.cookie });
  assertGleich(r.status, 404, "status");
  return `status=${r.status}`;
});

await schritt(27, "B bearbeitet A's Entwurf", async () => {
  const r = await patch(`/api/entwuerfe/${refA}`, { origin: BASIS, cookie: B.cookie, body: { version: 1, daten: {} } });
  assertGleich(r.status, 404, "status");
  return `status=${r.status}`;
});

await schritt(28, "B reicht A's Inserat ein", async () => {
  const r = await post(`/api/entwuerfe/${refA}/aktion`, { origin: BASIS, cookie: B.cookie, body: { absicht: "einreichen" } });
  assertGleich(r.status, 404, "status");
  return `status=${r.status}`;
});

await schritt(29, "B öffnet die Vorschau von A's Inserat", async () => {
  const r = await holenHtml(`/de/vorschau/${refA}`, { cookie: B.cookie });
  assertGleich(r.status, 404, "status (HTML)");
  return `status=${r.status}`;
});

await schritt(30, "B öffnet die Moderationswarteschlange", async () => {
  const r = await get("/api/moderation", { cookie: B.cookie });
  assertGleich(r.status, 403, "status");
  return `status=${r.status}`;
});

await schritt(31, "B genehmigt A's Inserat", async () => {
  const r = await post(`/api/moderation/${refA}`, { origin: BASIS, cookie: B.cookie, body: { absicht: "freigeben" } });
  assertGleich(r.status, 403, "status");
  return `status=${r.status}`;
});

await schritt(32, "Anonym öffnet die Vorschau von A's Inserat (dokumentiert)", async () => {
  const r = await holenHtml(`/de/vorschau/${refA.toLowerCase()}`, {});
  const erlaubteStatus = [307, 302, 404];
  assertTrue(erlaubteStatus.includes(r.status), `unerwarteter Status ${r.status} (erwartet einen von ${erlaubteStatus.join("/")})`);
  return `status=${r.status}${r.location ? `, location=${r.location}` : ""} — dokumentiert`;
});

await schritt(33, "Ein leerer Entwurf von B ist in der öffentlichen Suche nicht auffindbar", async () => {
  const angelegt = await post("/api/entwuerfe", { origin: BASIS, cookie: B.cookie, body: {} });
  assertGleich(angelegt.status, 201, "entwurf anlegen (unausgefüllt)");
  const refBLeer = angelegt.json.publicRef;
  const [buy, rent] = await Promise.all([
    api("GET", "/api/search?trans=buy&alle=1&proSeite=48&seite=50", {}),
    api("GET", "/api/search?trans=rent&alle=1&proSeite=48&seite=50", {})
  ]);
  const gefundenBuy = (buy.json?.treffer ?? []).some(t => t.id === refBLeer);
  const gefundenRent = (rent.json?.treffer ?? []).some(t => t.id === refBLeer);
  assertTrue(!gefundenBuy && !gefundenRent, `${refBLeer} in der Suche gefunden (buy=${gefundenBuy}, rent=${gefundenRent})`);
  return `ref=${refBLeer}, nicht gefunden (buy: ${buy.json?.treffer?.length ?? "?"} Treffer, rent: ${rent.json?.treffer?.length ?? "?"} Treffer)`;
});

/* ============================================================
   ABSCHLUSS: Tabelle, Bericht, Dauer
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

const bericht = {
  basis: BASIS, zeit: new Date().toISOString(), dauerMs,
  personen: { a: EMAIL_A, b: EMAIL_B, moderator: MOD?.email ?? null },
  refA: refA ?? null,
  ergebnisse
};
const varOrdner = join(APP_ROOT, "var");
mkdirSync(varOrdner, { recursive: true });
const berichtPfad = join(varOrdner, "lieferkette-bericht.json");
writeFileSync(berichtPfad, JSON.stringify(bericht, null, 2));
console.log(`Bericht geschrieben: ${berichtPfad}`);

await sql.end();
process.exit(fehlerAnzahl > 0 ? 1 : 0);
