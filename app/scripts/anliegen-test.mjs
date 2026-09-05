#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Anliegen von Eigentümerinnen (P5.8)

   Prüft die ganze Lieferkette eines Anliegens: von der öffentlichen Annahme
   (Validierung, Honigtopf, Ratenlimit, Herkunft) über die Verknüpfung mit
   Konto/Inserat/Ort bis zur internen Bearbeitung (Sichtbarkeit nach Recht,
   Statuswechsel, Zuweisung) und der Trennung von Anliegen und Mailversand.

   Aufruf:
     set -a; . ./.env.local; set +a
     FW_TEST_MOD_EMAIL=... FW_TEST_MOD_PASSWORT=... node scripts/anliegen-test.mjs [Basis-URL]
       Standard: http://localhost:3007

   Mailquelle (siehe scripts/lib/mailquelle.mjs): FW_TEST_MAIL_QUELLE=dev|mailpit|imap.

   Die Agentur-Besitzerin `alpha-owner@fourwalls.example` (Seed-Persona) wird
   nur gelesen — ihr Passwort kommt aus var/profis.local.json (Struktur
   `personas`), nie verändert.

   Ausgabe: nummerierte Tabelle auf stdout, var/anliegen-bericht.json,
   Exit 1 bei irgendeinem FEHLER, sonst 0. Räumt seine Test-Anliegen (Zeilen
   in service_lead) am Ende immer auf, auch nach einem Fehler mittendrin —
   Konten mit Prüfspur bleiben bestehen (wie bei den anderen Prüfskripten).
   ============================================================ */
import postgres from "postgres";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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

const MOD_EMAIL = process.env.FW_TEST_MOD_EMAIL;
const MOD_PASSWORT = process.env.FW_TEST_MOD_PASSWORT;
if (!MOD_EMAIL || !MOD_PASSWORT) {
  console.error("FW_TEST_MOD_EMAIL und FW_TEST_MOD_PASSWORT fehlen — Zugangsdaten des Moderationskontos kommen aus der Umgebung, nie aus dem Skript.");
  process.exit(2);
}

/* Seed-Persona einer Agentur-Besitzerin — nur lesen, nie schreiben. */
const PROFIS_DATEI = join(APP_ROOT, "var", "profis.local.json");
let AGENTUR_OWNER_EMAIL = "alpha-owner@fourwalls.example";
let AGENTUR_OWNER_PASSWORT = null;
try {
  const profis = JSON.parse(readFileSync(PROFIS_DATEI, "utf8"));
  AGENTUR_OWNER_PASSWORT = profis?.personas?.[AGENTUR_OWNER_EMAIL]?.passwort ?? null;
} catch { /* Datei fehlt — Schritt 9.4 meldet das als Fehler, statt zu raten */ }

const PASSWORT = "Anlg-" + randomBytes(12).toString("base64url");
const EMAIL_A = testadresse("ala", TS);   // angemeldete Person mit eigenem Anliegen
const EMAIL_B = testadresse("alb", TS);   // zweite Person — sieht A's Anliegen nicht (IDOR)
const EMAIL_STAFF = testadresse("alstaff", TS);
const EMAIL_KUNDE = testadresse("alkunde", TS);

const ergebnisse = [];
function assertTrue(bedingung, meldung) { if (!bedingung) throw new Error(meldung); }
function assertGleich(ist, soll, feld) {
  if (ist !== soll) throw new Error(`${feld}: erwartet ${JSON.stringify(soll)}, erhalten ${JSON.stringify(ist)}`);
}
async function schritt(bez, titel, fn) {
  try {
    const detail = (await fn()) || "ok";
    ergebnisse.push({ bez, titel, status: "OK", detail });
    console.log(`OK      ${String(bez).padStart(5)}  ${titel}`);
  } catch (e) {
    const detail = e && e.message ? e.message : String(e);
    ergebnisse.push({ bez, titel, status: "FEHLER", detail });
    console.log(`FEHLER  ${String(bez).padStart(5)}  ${titel} — ${detail}`);
  }
}

/* ---------- x-forwarded-for je Zweck, wegen der Ratenlimits ---------- */
const RUNSEED = Math.floor(Math.random() * 200) + 10;
const xffMap = new Map();
function xff(tag) {
  if (!xffMap.has(tag)) xffMap.set(tag, `10.${RUNSEED}.${xffMap.size + 1}.71`);
  return xffMap.get(tag);
}

/* ---------- HTTP ---------- */
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
    return { status: res.status, json, text, setCookies };
  } finally { clearTimeout(timer); }
}
const get = (p, o) => api("GET", p, o);
const post = (p, o) => api("POST", p, o);
const patch = (p, o) => api("PATCH", p, o);

function cookieAus(setCookies) {
  const c = setCookies.find(c => c.startsWith("fw.session_token="));
  return c ? c.split(";")[0] : null;
}

/* ---------- Mail ---------- */
const MAILQUELLE = mailquelle();
async function bestaetigeMail(email, seitMs = null) {
  const mail = await MAILQUELLE.warte(email, seitMs);
  if (!mail) throw new Error(`Keine Mail für ${email} über Mailquelle "${MAILQUELLE.name}" gefunden (30 s gewartet)`);
  const treffer = mail.text.match(/https?:\/\/\S+/);
  if (!treffer) throw new Error(`Keine URL in der Mail an ${email} gefunden`);
  const res = await fetch(treffer[0], { redirect: "manual" });
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
async function personAnlegen(email, xffTag, name) {
  const seit = Date.now();
  const su = await registrieren(email, PASSWORT, name, xffTag);
  assertGleich(su.status, 200, `sign-up (${email})`);
  const best = await bestaetigeMail(email, seit);
  assertGleich(best, 302, `bestätigung (${email})`);
  const si = await anmelden(email, PASSWORT, xffTag);
  assertGleich(si.status, 200, `sign-in (${email})`);
  assertTrue(!!si.cookie, `kein Sitzungscookie für ${email}`);
  return { email, cookie: si.cookie, id: si.json.user.id };
}

/* ---------- Ein Anliegen-Formular ---------- */
function formular(teile = {}) {
  return {
    dienst: "sell",
    kontakt: { name: "Prüfperson Anliegen", email: testadresse("alx", TS + Math.floor(Math.random() * 1e6)) },
    objekt: { ortId: "ort-zuerich", typ: "wohnung" },
    sprache: "de",
    herkunft: { seite: "/de/verkaufen" },
    firma: "",
    ...teile
  };
}

/* ---------- Aufräumen — läuft immer, auch nach einem Fehler ---------- */
const leadRefs = [];
async function aufraeumen() {
  try {
    const echte = leadRefs.filter(r => r && r !== "FWS-0000-000000");
    if (!echte.length) return;
    const z = await sql`DELETE FROM service_lead WHERE public_ref = ANY(${echte}) RETURNING id`;
    console.log(`Aufgeräumt: ${z.length} Test-Anliegen gelöscht (${echte.join(", ")}).`);
  } catch (e) {
    console.error("Aufräumen fehlgeschlagen:", e.message || e);
  }
}

const START = Date.now();
console.log(`Basis: ${BASIS}  —  Anliegen-Prüfung startet (TS=${TS})`);

let refAnonym, refAnliegenA;
let A, B, STAFF, KUNDE, MOD, AGENTUR;

try {
  /* ---------- 1: anonym, sell Zürich + Wohnung + Kontakt ---------- */
  await schritt("1.1", "Anonym: sell in Zürich + Wohnung + Kontakt → 201", async () => {
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "s1", body: formular() });
    assertGleich(r.status, 201, "status");
    assertTrue(/^FWS-\d{4}-\d{6}$/.test(r.json?.publicRef ?? ""), `keine gültige publicRef: ${JSON.stringify(r.json)}`);
    refAnonym = r.json.publicRef;
    leadRefs.push(refAnonym);
    return `publicRef=${refAnonym}`;
  });

  await schritt("1.2", "Die Zeile in service_lead: user_id NULL, place_key=ort-zuerich, status=new", async () => {
    const [row] = await sql`SELECT id, user_id, place_key, status, service FROM service_lead WHERE public_ref = ${refAnonym}`;
    assertTrue(!!row, "keine Zeile gefunden");
    assertTrue(row.user_id == null, `user_id ist nicht NULL: ${row.user_id}`);
    assertGleich(row.place_key, "ort-zuerich", "place_key");
    assertGleich(row.status, "new", "status");
    assertGleich(row.service, "sell", "service");
    return `place_key=${row.place_key}, status=${row.status}`;
  });

  await schritt("1.3", "Ein Protokolleintrag service_lead.created steht im audit_log", async () => {
    const [row] = await sql`SELECT id FROM service_lead WHERE public_ref = ${refAnonym}`;
    const [audit] = await sql`SELECT action FROM audit_log WHERE entity_type = 'service_lead' AND entity_id = ${row.id} AND action = 'service_lead.created'`;
    assertTrue(!!audit, "kein service_lead.created im audit_log");
    return "audit_log: service_lead.created";
  });

  await schritt("1.4", "Zwei Mails in der Mailquelle: interne Meldung und Bestätigung", async () => {
    const [row] = await sql`SELECT contact_email FROM service_lead WHERE public_ref = ${refAnonym}`;
    const best = await MAILQUELLE.warte(String(row.contact_email), START);
    assertTrue(!!best, `keine Bestätigung an ${row.contact_email} gefunden`);
    assertTrue(best.text.includes(refAnonym), "Referenz nicht in der Bestätigung gefunden");
    return `Bestätigung an ${row.contact_email} gefunden, enthält ${refAnonym}`;
  });

  /* ---------- 2: owner_consultation, nur Kontakt ---------- */
  await schritt("2", "owner_consultation ohne Objekt → 201", async () => {
    const r = await post("/api/anliegen", {
      origin: BASIS, xffTag: "s2",
      body: formular({ dienst: "owner_consultation", objekt: undefined })
    });
    assertGleich(r.status, 201, "status");
    leadRefs.push(r.json?.publicRef);
    return `publicRef=${r.json?.publicRef}`;
  });

  /* ---------- 3: Validierung ---------- */
  await schritt("3.1", "valuation ohne ortId → 422 mit Feld objekt.ortId", async () => {
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "s3", body: formular({ dienst: "valuation", objekt: { typ: "wohnung" } }) });
    assertGleich(r.status, 422, "status");
    assertTrue(!!r.json?.fields?.["objekt.ortId"], `kein Feld objekt.ortId in ${JSON.stringify(r.json)}`);
    return `status=422, fields=${JSON.stringify(r.json?.fields)}`;
  });

  await schritt("3.2", "Ungültige E-Mail → 422", async () => {
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "s3", body: formular({ kontakt: { name: "Prüfperson", email: "keine-email" } }) });
    assertGleich(r.status, 422, "status");
    return "status=422";
  });

  await schritt("3.3", "Nachricht mit 5000 Zeichen → 422", async () => {
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "s3", body: formular({ objekt: { ortId: "ort-zuerich", typ: "wohnung", nachricht: "x".repeat(5000) } }) });
    assertGleich(r.status, 422, "status");
    return "status=422";
  });

  await schritt("3.4", "Unbekannter Dienst «buy» → 422", async () => {
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "s3", body: formular({ dienst: "buy" }) });
    assertGleich(r.status, 422, "status");
    return "status=422";
  });

  await schritt("3.5", "status/assignedStaffId/userId im Body → je 422", async () => {
    /* Eigene x-forwarded-for je Zusatzfeld — sonst würde das Ratenlimit aus
       3.1–3.4 (dieselbe Herkunft) hier schon zuschlagen, nicht die Prüfung. */
    const faelle = [{ status: "new" }, { assignedStaffId: "u-1" }, { userId: "u-1" }];
    for (const zusatz of faelle) {
      const r = await post("/api/anliegen", { origin: BASIS, xffTag: `s35-${Object.keys(zusatz)[0]}`, body: { ...formular(), ...zusatz } });
      assertGleich(r.status, 422, `status (${Object.keys(zusatz)[0]})`);
    }
    return "status/assignedStaffId/userId je 422";
  });

  /* ---------- 4: Honigtopf ---------- */
  await schritt("4", "Honigtopf gefüllt → 201, erfundene Referenz, keine Zeile", async () => {
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "s4", body: formular({ firma: "Bot GmbH" }) });
    assertGleich(r.status, 201, "status");
    assertGleich(r.json?.publicRef, "FWS-0000-000000", "publicRef");
    const [row] = await sql`SELECT id FROM service_lead WHERE public_ref = 'FWS-0000-000000'`;
    assertTrue(!row, "eine Zeile mit der erfundenen Referenz existiert");
    return "status=201, publicRef=FWS-0000-000000, keine Zeile";
  });

  /* ---------- 5: Anliegen ↔ Konto ---------- */
  await schritt("5.1", "Person A registrieren, bestätigen, anmelden", async () => {
    A = await personAnlegen(EMAIL_A, "a-auth", "Person A (Anliegen)");
    return `id=${A.id}`;
  });

  await schritt("5.2", "A sendet ein Anliegen angemeldet → user_id gesetzt", async () => {
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "a-anliegen", cookie: A.cookie, body: formular({ kontakt: { name: "Person A", email: EMAIL_A } }) });
    assertGleich(r.status, 201, "status");
    refAnliegenA = r.json.publicRef;
    leadRefs.push(refAnliegenA);
    const [row] = await sql`SELECT user_id FROM service_lead WHERE public_ref = ${refAnliegenA}`;
    assertGleich(String(row.user_id), A.id, "user_id");
    return `publicRef=${refAnliegenA}, user_id=${row.user_id}`;
  });

  await schritt("5.3", "GET /api/konto/anliegen (A) zeigt genau ihr Anliegen", async () => {
    const r = await get("/api/konto/anliegen", { cookie: A.cookie });
    assertGleich(r.status, 200, "status");
    const treffer = (r.json?.anliegen ?? []).find(x => x.publicRef === refAnliegenA);
    assertTrue(!!treffer, `${refAnliegenA} nicht in der eigenen Liste gefunden`);
    return `gefunden, ${r.json.anliegen.length} eigene(s) Anliegen`;
  });

  await schritt("5.4", "IDOR-Falsifikation: eine zweite Person sieht A's Anliegen nicht", async () => {
    B = await personAnlegen(EMAIL_B, "b-auth", "Person B (Anliegen)");
    const r = await get("/api/konto/anliegen", { cookie: B.cookie });
    assertGleich(r.status, 200, "status");
    assertTrue(!(r.json?.anliegen ?? []).some(x => x.publicRef === refAnliegenA), "B sieht A's Anliegen");
    return `B sieht ${r.json.anliegen.length} eigene(s) Anliegen, nicht das von A`;
  });

  await schritt("5.5", "GET /api/konto/anliegen ohne Sitzung → 401", async () => {
    const r = await get("/api/konto/anliegen", {});
    assertGleich(r.status, 401, "status");
    return "status=401";
  });

  /* ---------- 6: fremdes, nicht öffentliches Inserat ---------- */
  await schritt("6", "inseratRef eines fremden, nicht öffentlichen Inserats → 201, listing_id NULL", async () => {
    const [fremd] = await sql`SELECT public_ref FROM listing WHERE status NOT IN ('published', 'reserved') LIMIT 1`;
    if (!fremd) return "übersprungen: kein nicht-öffentliches Inserat in der Datenbank gefunden";
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "s6", body: formular({ objekt: { ortId: "ort-zuerich", typ: "wohnung", inseratRef: fremd.public_ref } }) });
    assertGleich(r.status, 201, "status");
    leadRefs.push(r.json?.publicRef);
    const [row] = await sql`SELECT listing_id FROM service_lead WHERE public_ref = ${r.json.publicRef}`;
    assertTrue(row.listing_id == null, `listing_id ist nicht NULL: ${row.listing_id}`);
    return `inseratRef=${fremd.public_ref} → listing_id=NULL`;
  });

  /* ---------- 7: Ratenlimit ---------- */
  await schritt("7.1", "Ratenlimit je Herkunft: das 6. anonyme Anliegen derselben IP → 429", async () => {
    let letzte;
    for (let i = 0; i < 6; i++) {
      letzte = await post("/api/anliegen", { origin: BASIS, xffTag: "s7-ip", body: formular({ kontakt: { name: "Ratenlimit IP", email: testadresse("s7ip" + i, TS) } }) });
      if (letzte.status === 201) leadRefs.push(letzte.json?.publicRef);
    }
    assertGleich(letzte.status, 429, "status (6. Anfrage)");
    return "6. Anfrage derselben IP → 429";
  });

  await schritt("7.2", "Ratenlimit je E-Mail: das 4. Anliegen derselben Adresse (verschiedene IPs) → 429", async () => {
    const email = testadresse("s7mail", TS);
    let letzte;
    for (let i = 0; i < 4; i++) {
      letzte = await post("/api/anliegen", { origin: BASIS, xffTag: `s7-mail-${i}`, body: formular({ kontakt: { name: "Ratenlimit Mail", email } }) });
      if (letzte.status === 201) leadRefs.push(letzte.json?.publicRef);
    }
    assertGleich(letzte.status, 429, "status (4. Anfrage)");
    return "4. Anfrage derselben E-Mail → 429";
  });

  /* ---------- 8: fremde Origin ---------- */
  await schritt("8", "Fremde Origin → 403", async () => {
    const r = await post("/api/anliegen", { origin: "https://boese-seite.example", xffTag: "s8", body: formular() });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });

  /* ---------- 9: intern — Sichtbarkeit nach Recht ---------- */
  await schritt("9.1", "GET /api/intern/anliegen ohne Sitzung → 401", async () => {
    const r = await get("/api/intern/anliegen", {});
    assertGleich(r.status, 401, "status");
    return "status=401";
  });

  await schritt("9.2", "GET /api/intern/anliegen als Kunde (user) → 403", async () => {
    KUNDE = await personAnlegen(EMAIL_KUNDE, "kunde-auth", "Kunde (Anliegen)");
    const r = await get("/api/intern/anliegen", { cookie: KUNDE.cookie });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });

  await schritt("9.3", "GET /api/intern/anliegen als Moderatorin → 403 (Moderation ≠ Geschäft, §56)", async () => {
    const r = await anmelden(MOD_EMAIL, MOD_PASSWORT, "mod-auth");
    assertGleich(r.status, 200, "sign-in Moderatorin");
    MOD = { email: MOD_EMAIL, cookie: r.cookie, id: r.json.user.id };
    const rl = await get("/api/intern/anliegen", { cookie: MOD.cookie });
    assertGleich(rl.status, 403, "status");
    return "status=403";
  });

  await schritt("9.4", "GET /api/intern/anliegen als Agentur-Besitzerin → 403", async () => {
    assertTrue(!!AGENTUR_OWNER_PASSWORT, `Kein Passwort für ${AGENTUR_OWNER_EMAIL} in ${PROFIS_DATEI} gefunden`);
    const r = await anmelden(AGENTUR_OWNER_EMAIL, AGENTUR_OWNER_PASSWORT, "agentur-auth");
    assertGleich(r.status, 200, "sign-in Agentur-Besitzerin");
    AGENTUR = { email: AGENTUR_OWNER_EMAIL, cookie: r.cookie, id: r.json.user.id };
    const rl = await get("/api/intern/anliegen", { cookie: AGENTUR.cookie });
    assertGleich(rl.status, 403, "status");
    return "status=403";
  });

  await schritt("9.5", "Konto → staff, GET /api/intern/anliegen 200 + Filter status=new&service=sell", async () => {
    STAFF = await personAnlegen(EMAIL_STAFF, "staff-auth", "Staff (Anliegen)");
    await sql`UPDATE app_user SET platform_role = 'staff' WHERE id = ${STAFF.id}`;
    const r = await get("/api/intern/anliegen?status=new&service=sell", { cookie: STAFF.cookie });
    assertGleich(r.status, 200, "status");
    assertTrue(Array.isArray(r.json?.zeilen), "keine zeilen[] in der Antwort");
    assertTrue(r.json.zeilen.every(z => z.status === "new" && z.service === "sell"), "eine Zeile passt nicht zum Filter");
    assertTrue(r.json.zeilen.some(z => z.publicRef === refAnonym), `${refAnonym} nicht in der gefilterten Liste`);
    return `status=200, ${r.json.zeilen.length} Zeile(n), Filter eingehalten`;
  });

  await schritt("9.6", "GET /api/intern/anliegen/<ref> (staff) → 200 mit Details und Verlauf", async () => {
    const r = await get(`/api/intern/anliegen/${refAnonym}`, { cookie: STAFF.cookie });
    assertGleich(r.status, 200, "status");
    assertGleich(r.json?.publicRef, refAnonym, "publicRef");
    assertTrue(Array.isArray(r.json?.verlauf) && r.json.verlauf.length > 0, "kein Verlauf in der Antwort");
    return `status=200, verlauf=${r.json.verlauf.length}`;
  });

  /* ---------- 10: Übergänge und Zuweisung ---------- */
  await schritt("10.1", "staff: PATCH status new→contacted → 200 + audit", async () => {
    const r = await patch(`/api/intern/anliegen/${refAnonym}`, { origin: BASIS, cookie: STAFF.cookie, body: { status: "contacted" } });
    assertGleich(r.status, 200, "status");
    assertGleich(r.json?.status, "contacted", "status im Ergebnis");
    const [audit] = await sql`SELECT previous_state, new_state FROM audit_log al JOIN service_lead sl ON sl.id = al.entity_id
                                WHERE al.entity_type = 'service_lead' AND sl.public_ref = ${refAnonym} AND al.action = 'service_lead.status_changed'
                                ORDER BY al.created_at DESC LIMIT 1`;
    assertTrue(!!audit, "kein service_lead.status_changed im audit_log");
    assertGleich(audit.previous_state, "new", "previous_state");
    assertGleich(audit.new_state, "contacted", "new_state");
    return "status=200, audit: new→contacted";
  });

  await schritt("10.2", "staff: PATCH status new→qualified (übersprungener Übergang) → 409", async () => {
    /* Ein frisches Anliegen, noch im Zustand «new» — refAnonym steht nach
       10.1 schon auf «contacted», wo new→qualified gar nicht mehr die Frage
       wäre. Der Konflikt gilt dem übersprungenen Übergang, nicht dem Zustand
       eines anderen Anliegens. */
    const r0 = await post("/api/anliegen", { origin: BASIS, xffTag: "s10-2", body: formular({ kontakt: { name: "Übergangsprüfung", email: testadresse("s102", TS) } }) });
    assertGleich(r0.status, 201, "anlegen");
    leadRefs.push(r0.json.publicRef);
    const r = await patch(`/api/intern/anliegen/${r0.json.publicRef}`, { origin: BASIS, cookie: STAFF.cookie, body: { status: "qualified" } });
    assertGleich(r.status, 409, "status (new→qualified ist kein gültiger Übergang)");
    return "status=409 (new→qualified übersprungen contacted)";
  });

  await schritt("10.3", "Kunde PATCH auf ein Anliegen → 403", async () => {
    const r = await patch(`/api/intern/anliegen/${refAnonym}`, { origin: BASIS, cookie: KUNDE.cookie, body: { status: "closed" } });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });

  await schritt("10.4", "Zuweisen an ein «user»-Konto → 422", async () => {
    const r = await patch(`/api/intern/anliegen/${refAnonym}`, { origin: BASIS, cookie: STAFF.cookie, body: { assignedStaffId: KUNDE.id } });
    assertGleich(r.status, 422, "status");
    return "status=422";
  });

  await schritt("10.5", "Zuweisen an sich selbst (staff) → 200 + audit", async () => {
    const r = await patch(`/api/intern/anliegen/${refAnonym}`, { origin: BASIS, cookie: STAFF.cookie, body: { assignedStaffId: STAFF.id } });
    assertGleich(r.status, 200, "status");
    assertGleich(r.json?.assignedStaffId, STAFF.id, "assignedStaffId im Ergebnis");
    const [audit] = await sql`SELECT new_state FROM audit_log al JOIN service_lead sl ON sl.id = al.entity_id
                                WHERE al.entity_type = 'service_lead' AND sl.public_ref = ${refAnonym} AND al.action = 'service_lead.assigned'
                                ORDER BY al.created_at DESC LIMIT 1`;
    assertTrue(!!audit, "kein service_lead.assigned im audit_log");
    return "status=200, audit: service_lead.assigned";
  });

  /* ---------- 11: Outbox unabhängig vom Anliegen ---------- */
  await schritt("11", "Eine manipulierte Outbox lässt das Anliegen unverändert, kein Duplikat", async () => {
    const [row] = await sql`SELECT id FROM service_lead WHERE public_ref = ${refAnonym}`;
    await sql`UPDATE mail_outbox SET status = 'failed', attempts = 3, last_error = 'Prüfung: künstlich fehlgeschlagen'
               WHERE ref_type = 'service_lead' AND ref_id = ${row.id}`;
    const nachher = await sql`SELECT id FROM service_lead WHERE public_ref = ${refAnonym}`;
    assertGleich(nachher.length, 1, "Anzahl Zeilen für diese Referenz");
    return "Outbox manipuliert, service_lead unverändert (1 Zeile)";
  });

  /* ---------- 12: unbekannte/erfundene Referenz, anonym ---------- */
  await schritt("12", "GET /api/intern/anliegen/FWS-2026-000001 anonym → 401", async () => {
    const r = await get("/api/intern/anliegen/FWS-2026-000001", {});
    assertGleich(r.status, 401, "status");
    return "status=401";
  });
} finally {
  await aufraeumen();
  await sql.end({ timeout: 5 });
}

/* ============================================================
   ABSCHLUSS
   ============================================================ */
const dauerMs = Date.now() - START;
function tabelle() {
  const w1 = 5;
  const w2 = Math.max(20, ...ergebnisse.map(e => e.titel.length));
  const w3 = 6;
  const zeile = (a, b, c, d) => `${String(a).padStart(w1)}  ${String(b).padEnd(w2)}  ${String(c).padEnd(w3)}  ${d}`;
  console.log("\n" + zeile("Nr", "Schritt", "Status", "Detail"));
  console.log("-".repeat(w1 + w2 + w3 + 10));
  for (const e of ergebnisse) console.log(zeile(e.bez, e.titel, e.status, e.detail));
}
tabelle();

const fehlerAnzahl = ergebnisse.filter(e => e.status === "FEHLER").length;
console.log(`\n${ergebnisse.length} Schritte, ${fehlerAnzahl} FEHLER, ${ergebnisse.length - fehlerAnzahl} OK — Dauer ${(dauerMs / 1000).toFixed(1)}s`);
if (fehlerAnzahl > 0) {
  console.log("\nFEHLER im Detail:");
  for (const e of ergebnisse.filter(e => e.status === "FEHLER")) console.log(`  Schritt ${e.bez} (${e.titel}): ${e.detail}`);
}

const bericht = { basis: BASIS, zeit: new Date().toISOString(), dauerMs, ergebnisse };
const varOrdner = join(APP_ROOT, "var");
mkdirSync(varOrdner, { recursive: true });
const berichtPfad = join(varOrdner, "anliegen-bericht.json");
writeFileSync(berichtPfad, JSON.stringify(bericht, null, 2));
console.log(`Bericht geschrieben: ${berichtPfad}`);

process.exit(fehlerAnzahl > 0 ? 1 : 0);
