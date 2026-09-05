#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Anliegen: Sicherheitsmatrix (P5.8 §55/§57/§47/§54)

   Greift die Autorisierung rund um Anliegen von Eigentümerinnen an: wer darf
   ein fremdes Anliegen lesen oder ändern, welche Rollen bleiben aussen vor
   (Kunde, Moderatorin, Agentur-Besitzerin, Agentur-Agent), welche Felder
   beim Anlegen niemals eine Wirkung haben dürfen (status, assignedStaffId,
   userId, notes, score, platform_role), und wohin die interne Benachrichtigung
   tatsächlich geht (nie an eine Organisation, §57).

   Fokussiert, ohne die Validierungsfälle aus scripts/anliegen-test.mjs zu
   wiederholen (Honigtopf, Ratenlimit, Pflichtfelder — siehe dort).

   Aufruf:
     set -a; . ./.env.local; set +a
     FW_TEST_MOD_EMAIL=... FW_TEST_MOD_PASSWORT=... node scripts/anliegen-sicherheit-test.mjs [Basis-URL]

   Mailquelle (siehe scripts/lib/mailquelle.mjs): FW_TEST_MAIL_QUELLE=dev|mailpit|imap.

   Die Agentur-Besitzerin `alpha-owner@fourwalls.example` und der Agentur-
   Agent `alpha-agent@fourwalls.example` (Seed-Personas) werden nur gelesen —
   Passwörter aus var/profis.local.json (Struktur `personas`), nie verändert.

   Ausgabe: nummerierte Tabelle, Exit 1 bei irgendeinem FEHLER, sonst 0.
   Räumt seine Test-Anliegen am Ende immer auf (auch nach einem Fehler
   mittendrin) — Konten mit Prüfspur bleiben bestehen.
   ============================================================ */
import postgres from "postgres";
import { readFileSync } from "node:fs";
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

/* Seed-Personas einer Agentur — nur lesen, nie schreiben. */
const PROFIS_DATEI = join(APP_ROOT, "var", "profis.local.json");
const AGENTUR_OWNER_EMAIL = "alpha-owner@fourwalls.example";
const AGENTUR_AGENT_EMAIL = "alpha-agent@fourwalls.example";
let AGENTUR_OWNER_PASSWORT = null, AGENTUR_AGENT_PASSWORT = null;
try {
  const profis = JSON.parse(readFileSync(PROFIS_DATEI, "utf8"));
  AGENTUR_OWNER_PASSWORT = profis?.personas?.[AGENTUR_OWNER_EMAIL]?.passwort ?? null;
  AGENTUR_AGENT_PASSWORT = profis?.personas?.[AGENTUR_AGENT_EMAIL]?.passwort ?? null;
} catch { /* Datei fehlt — die betroffenen Schritte melden das als Fehler */ }

const PASSWORT = "Sich-" + randomBytes(12).toString("base64url");
const EMAIL_A = testadresse("asa", TS);
const EMAIL_B = testadresse("asb", TS);
const EMAIL_STAFF = testadresse("asstaff", TS);
const EMAIL_KUNDE = testadresse("askunde", TS);

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

/* ---------- x-forwarded-for je Zweck ---------- */
const RUNSEED = Math.floor(Math.random() * 200) + 10;
const xffMap = new Map();
function xff(tag) {
  if (!xffMap.has(tag)) xffMap.set(tag, `10.${RUNSEED}.${xffMap.size + 1}.83`);
  return xffMap.get(tag);
}

/* ---------- HTTP ---------- */
async function api(method, pfad, { cookie, origin, body, xffTag } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const h = {};
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

/* ---------- Mail (Bestätigungslink) ---------- */
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

async function bestaetigeMail(email, seitMs = null) {
  const mail = await MAILQUELLE.warte(email, seitMs);
  if (!mail) throw new Error(`Keine Mail für ${email} über Mailquelle "${MAILQUELLE.name}" gefunden`);
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

function formular(teile = {}) {
  return {
    dienst: "sell",
    kontakt: { name: "Prüfperson Sicherheit", email: testadresse("asx", TS + Math.floor(Math.random() * 1e6)) },
    objekt: { ortId: "ort-zuerich", typ: "wohnung" },
    sprache: "de",
    herkunft: { seite: "/de/verkaufen" },
    firma: "",
    ...teile
  };
}

/* ---------- Aufräumen ---------- */
const leadRefs = [];
async function aufraeumen() {
  try {
    const echte = leadRefs.filter(Boolean);
    if (!echte.length) return;
    const z = await sql`DELETE FROM service_lead WHERE public_ref = ANY(${echte}) RETURNING id`;
    console.log(`Aufgeräumt: ${z.length} Test-Anliegen gelöscht (${echte.join(", ")}).`);
  } catch (e) {
    console.error("Aufräumen fehlgeschlagen:", e.message || e);
  }
}

const START = Date.now();
console.log(`Basis: ${BASIS}  —  Anliegen-Sicherheitsmatrix startet (TS=${TS})`);

let A, B, STAFF, KUNDE, MOD, AGENTUR_OWNER, AGENTUR_AGENT;
let refA, refB, refFuerAngriffe;

try {
  /* ---------- Konten ---------- */
  await schritt("1.1", "Person A registrieren, bestätigen, anmelden", async () => {
    A = await personAnlegen(EMAIL_A, "a-auth", "Person A (Sicherheit)");
    return `id=${A.id}`;
  });
  await schritt("1.2", "Person B registrieren, bestätigen, anmelden", async () => {
    B = await personAnlegen(EMAIL_B, "b-auth", "Person B (Sicherheit)");
    return `id=${B.id}`;
  });
  await schritt("1.3", "Kunde (ohne Sonderrechte) registrieren", async () => {
    KUNDE = await personAnlegen(EMAIL_KUNDE, "kunde-auth", "Kunde (Sicherheit)");
    return `id=${KUNDE.id}`;
  });
  await schritt("1.4", "staff-Konto: registrieren + auf 'staff' hochstufen", async () => {
    STAFF = await personAnlegen(EMAIL_STAFF, "staff-auth", "Staff (Sicherheit)");
    await sql`UPDATE app_user SET platform_role = 'staff' WHERE id = ${STAFF.id}`;
    return `id=${STAFF.id}`;
  });
  await schritt("1.5", "Moderationskonto anmelden", async () => {
    const r = await anmelden(MOD_EMAIL, MOD_PASSWORT, "mod-auth");
    assertGleich(r.status, 200, "sign-in Moderatorin");
    MOD = { email: MOD_EMAIL, cookie: r.cookie, id: r.json.user.id };
    return `id=${MOD.id}`;
  });
  await schritt("1.6", "Agentur-Besitzerin (Seed-Persona) anmelden", async () => {
    assertTrue(!!AGENTUR_OWNER_PASSWORT, `Kein Passwort für ${AGENTUR_OWNER_EMAIL} in ${PROFIS_DATEI} gefunden`);
    const r = await anmelden(AGENTUR_OWNER_EMAIL, AGENTUR_OWNER_PASSWORT, "agentur-owner-auth");
    assertGleich(r.status, 200, "sign-in Agentur-Besitzerin");
    AGENTUR_OWNER = { email: AGENTUR_OWNER_EMAIL, cookie: r.cookie, id: r.json.user.id };
    return `id=${AGENTUR_OWNER.id}`;
  });
  await schritt("1.7", "Agentur-Agent (Seed-Persona) anmelden", async () => {
    assertTrue(!!AGENTUR_AGENT_PASSWORT, `Kein Passwort für ${AGENTUR_AGENT_EMAIL} in ${PROFIS_DATEI} gefunden`);
    const r = await anmelden(AGENTUR_AGENT_EMAIL, AGENTUR_AGENT_PASSWORT, "agentur-agent-auth");
    assertGleich(r.status, 200, "sign-in Agentur-Agent");
    AGENTUR_AGENT = { email: AGENTUR_AGENT_EMAIL, cookie: r.cookie, id: r.json.user.id };
    return `id=${AGENTUR_AGENT.id}`;
  });

  /* ---------- Zwei Anliegen als Grundlage ---------- */
  await schritt("2.1", "A sendet ein Anliegen angemeldet", async () => {
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "a-anliegen", body: formular({ kontakt: { name: "Person A", email: EMAIL_A } }) });
    assertGleich(r.status, 201, "status");
    refA = r.json.publicRef; leadRefs.push(refA);
    return `publicRef=${refA}`;
  });
  await schritt("2.2", "B sendet ein Anliegen angemeldet", async () => {
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "b-anliegen", body: formular({ kontakt: { name: "Person B", email: EMAIL_B } }) });
    assertGleich(r.status, 201, "status");
    refB = r.json.publicRef; leadRefs.push(refB);
    return `publicRef=${refB}`;
  });
  await schritt("2.3", "Ein weiteres, anonymes Anliegen für die Angriffsprüfungen", async () => {
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "angriff-basis", body: formular() });
    assertGleich(r.status, 201, "status");
    refFuerAngriffe = r.json.publicRef; leadRefs.push(refFuerAngriffe);
    return `publicRef=${refFuerAngriffe}`;
  });

  /* ---------- 3: anonym liest ein Anliegen ---------- */
  await schritt("3", "GET /api/intern/anliegen/<ref> anonym → 401", async () => {
    const r = await get(`/api/intern/anliegen/${refA}`, {});
    assertGleich(r.status, 401, "status");
    return "status=401";
  });

  /* ---------- 4: A liest B's Anliegen — zwei Wege ---------- */
  await schritt("4.1", "GET /api/konto/anliegen (A) enthält B's Anliegen NICHT", async () => {
    const r = await get("/api/konto/anliegen", { cookie: A.cookie });
    assertGleich(r.status, 200, "status");
    assertTrue(!(r.json?.anliegen ?? []).some(x => x.publicRef === refB), "A sieht B's Anliegen in der eigenen Liste");
    return `A: ${r.json.anliegen.length} eigene(s) Anliegen, refB nicht enthalten`;
  });
  await schritt("4.2", "GET /api/intern/anliegen/<refB> als Kunde A → 403 (kein VIEW_SERVICE_LEADS)", async () => {
    const r = await get(`/api/intern/anliegen/${refB}`, { cookie: A.cookie });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });

  /* ---------- 5: fremde Rollen ohne Geschäftsrecht ---------- */
  await schritt("5.1", "Agentur-Besitzerin: GET Liste → 403", async () => {
    const r = await get("/api/intern/anliegen", { cookie: AGENTUR_OWNER.cookie });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });
  await schritt("5.2", "Agentur-Besitzerin: GET Detail → 403", async () => {
    const r = await get(`/api/intern/anliegen/${refA}`, { cookie: AGENTUR_OWNER.cookie });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });
  await schritt("5.3", "Agentur-Besitzerin: PATCH → 403", async () => {
    const r = await patch(`/api/intern/anliegen/${refA}`, { origin: BASIS, cookie: AGENTUR_OWNER.cookie, body: { status: "contacted" } });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });
  await schritt("5.4", "Agentur-Agent: GET Liste → 403", async () => {
    const r = await get("/api/intern/anliegen", { cookie: AGENTUR_AGENT.cookie });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });
  await schritt("5.5", "Agentur-Agent: GET Detail → 403", async () => {
    const r = await get(`/api/intern/anliegen/${refA}`, { cookie: AGENTUR_AGENT.cookie });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });
  await schritt("5.6", "Agentur-Agent: PATCH → 403", async () => {
    const r = await patch(`/api/intern/anliegen/${refA}`, { origin: BASIS, cookie: AGENTUR_AGENT.cookie, body: { status: "contacted" } });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });
  await schritt("5.7", "Moderatorin: GET Liste → 403 (Moderation ≠ Geschäft, §56)", async () => {
    const r = await get("/api/intern/anliegen", { cookie: MOD.cookie });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });
  await schritt("5.8", "Moderatorin: GET Detail → 403", async () => {
    const r = await get(`/api/intern/anliegen/${refA}`, { cookie: MOD.cookie });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });
  await schritt("5.9", "Moderatorin: PATCH → 403", async () => {
    const r = await patch(`/api/intern/anliegen/${refA}`, { origin: BASIS, cookie: MOD.cookie, body: { status: "contacted" } });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });
  await schritt("5.10", "Kunde: PATCH auf den eigenen Status → 403", async () => {
    const r = await patch(`/api/intern/anliegen/${refA}`, { origin: BASIS, cookie: KUNDE.cookie, body: { status: "closed" } });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });

  /* ---------- 6: staff liest/ändert ---------- */
  await schritt("6.1", "staff: GET Liste → 200", async () => {
    const r = await get("/api/intern/anliegen", { cookie: STAFF.cookie });
    assertGleich(r.status, 200, "status");
    return `status=200, ${r.json.zeilen.length} Zeile(n)`;
  });
  await schritt("6.2", "staff: GET Detail → 200", async () => {
    const r = await get(`/api/intern/anliegen/${refA}`, { cookie: STAFF.cookie });
    assertGleich(r.status, 200, "status");
    return "status=200";
  });
  await schritt("6.3", "staff: PATCH Status → 200", async () => {
    const r = await patch(`/api/intern/anliegen/${refA}`, { origin: BASIS, cookie: STAFF.cookie, body: { status: "contacted" } });
    assertGleich(r.status, 200, "status");
    return "status=200";
  });

  /* ---------- 7: Body-Angriffe beim Anlegen ---------- */
  await schritt("7", "Verbotene Felder beim Anlegen: status/assignedStaffId/userId/notes/score/platform_role → je 422, keine Zeile", async () => {
    const felder = [
      { status: "closed" }, { assignedStaffId: STAFF.id }, { userId: A.id },
      { notes: "geheime Notiz" }, { score: 99 }, { platform_role: "admin" }
    ];
    for (const zusatz of felder) {
      const schluessel = Object.keys(zusatz)[0];
      const email = testadresse("as7-" + schluessel, TS);
      const r = await post("/api/anliegen", { origin: BASIS, xffTag: `as7-${schluessel}`, body: { ...formular({ kontakt: { name: "Angriff", email } }), ...zusatz } });
      assertGleich(r.status, 422, `status (${schluessel})`);
      const [row] = await sql`SELECT id FROM service_lead WHERE contact_email = ${email}`;
      assertTrue(!row, `trotz 422 eine Zeile für ${schluessel} angelegt`);
    }
    return "status/assignedStaffId/userId/notes/score/platform_role je 422, keine Zeile";
  });

  /* ---------- 8: PATCH-Angriffe ---------- */
  await schritt("8.1", "PATCH assignedStaffId eines Agentur-Kontos (kein staff) → 422", async () => {
    const r = await patch(`/api/intern/anliegen/${refFuerAngriffe}`, { origin: BASIS, cookie: STAFF.cookie, body: { assignedStaffId: AGENTUR_OWNER.id } });
    assertGleich(r.status, 422, "status");
    return "status=422";
  });
  await schritt("8.2", "PATCH status:'won' (kein bekannter Status) → 422", async () => {
    const r = await patch(`/api/intern/anliegen/${refFuerAngriffe}`, { origin: BASIS, cookie: STAFF.cookie, body: { status: "won" } });
    assertGleich(r.status, 422, "status");
    return "status=422";
  });

  /* ---------- 9: §57 — die interne Meldung geht nie an eine Organisation ---------- */
  await schritt("9", "Outbox-Empfänger der internen Meldung ist SERVICE_LEAD_INBOX/MAIL_DEV_SINK, keine Organisationsadresse", async () => {
    /* bezug.kennung ist die öffentliche Referenz (Text), nicht die UUID-Zeile
       — siehe server/anliegen.ts (einreihen mit { art: "service_lead", kennung: ref }). */
    const [mailZeile] = await sql`
      SELECT recipient FROM mail_outbox WHERE ref_type = 'service_lead' AND ref_id = ${refFuerAngriffe} AND kind = 'service_lead_intern' LIMIT 1`;
    assertTrue(!!mailZeile, "keine service_lead_intern-Zeile in der Outbox gefunden");
    const empfaenger = String(mailZeile.recipient).toLowerCase();
    const orgAdressen = await sql`SELECT lower(email) AS a FROM organization WHERE email IS NOT NULL`;
    const orgSet = new Set(orgAdressen.map(r => r.a));
    assertTrue(!orgSet.has(empfaenger), `Empfänger ${empfaenger} ist eine Organisationsadresse`);
    return `Empfänger=${empfaenger}, keine Übereinstimmung mit ${orgSet.size} Organisationsadresse(n)`;
  });

  /* ---------- 10: Aufzählung — nie 404, das würde Existenz verraten ---------- */
  await schritt("10.1", "GET /api/intern/anliegen/FWS-2026-000001..3 anonym → je 401", async () => {
    for (const n of ["000001", "000002", "000003"]) {
      const r = await get(`/api/intern/anliegen/FWS-2026-${n}`, {});
      assertGleich(r.status, 401, `status (FWS-2026-${n})`);
    }
    return "je 401, nie 404";
  });
  await schritt("10.2", "GET /api/intern/anliegen/FWS-2026-000001..3 als Kunde → je 403 (nie 404)", async () => {
    for (const n of ["000001", "000002", "000003"]) {
      const r = await get(`/api/intern/anliegen/FWS-2026-${n}`, { cookie: KUNDE.cookie });
      assertGleich(r.status, 403, `status (FWS-2026-${n})`);
      assertTrue(r.status !== 404, `404 hätte Existenz verraten (FWS-2026-${n})`);
    }
    return "je 403, nie 404";
  });

  /* ---------- 11: die interne Liste verrät keine Hash-Felder ---------- */
  await schritt("11", "GET /api/intern/anliegen (staff) enthält nie ip_hash/user_agent_hash", async () => {
    const r = await get("/api/intern/anliegen", { cookie: STAFF.cookie });
    assertGleich(r.status, 200, "status");
    const roh = JSON.stringify(r.json);
    assertTrue(!roh.includes("ip_hash") && !roh.includes("ipHash"), "ip_hash/ipHash in der Antwort gefunden");
    assertTrue(!roh.includes("user_agent_hash") && !roh.includes("uaHash"), "user_agent_hash/uaHash in der Antwort gefunden");
    return "keine Hash-Felder in der internen Liste";
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

process.exit(fehlerAnzahl > 0 ? 1 : 0);
