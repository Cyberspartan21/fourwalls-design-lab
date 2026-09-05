#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Organisationen: Sicherheitsmatrix (P5.7 §58–§62)

   Greift die Autorisierung zwischen Organisationen, Teammitgliedern,
   Moderation und Fremden aggressiv an — 20 nummerierte Prüfungen. Jede
   Prüfung erwartet ein konkretes, dokumentiertes Ergebnis: eine fremde oder
   unbekannte Organisation antwortet NOT_FOUND, nie FORBIDDEN (§15); wer im
   eigenen Team kein Recht hat, bekommt FORBIDDEN; verbotene Felder (Status,
   Herausgeberschaft, Prüfstand) führen zu VALIDATION, nie zu einer stillen
   Wirkung; eine widerrufene Zugehörigkeit gilt sofort.

   Konten je Lauf frisch (Zeitstempel-Adressen): A = Alpha owner, B = Alpha
   agent (per Einladung aufgenommen), C = Beta owner, D = Kunde ohne
   Organisation, MOD = Moderationskonto aus der Umgebung. Alpha/Beta legt
   dieses Skript über die öffentliche API an (POST /api/org) — keine SQL-
   Organisation wie in scripts/org-inserate-test.mjs, weil genau diese Route
   Teil der Prüfung ist.

   Aufruf:
     set -a; . ./.env.local; set +a
     FW_TEST_MOD_EMAIL=... FW_TEST_MOD_PASSWORT=... node scripts/org-sicherheit-test.mjs [Basis-URL]

   Mailquelle (siehe scripts/lib/mailquelle.mjs): FW_TEST_MAIL_QUELLE=dev|mailpit|imap.

   Ausgabe: nummerierte Tabelle, Exit 1 bei irgendeinem FEHLER, sonst 0.
   Räumt seine Testorganisationen und -inserate am Ende immer auf (auch nach
   einem Fehler mittendrin) — Konten mit Prüfspur bleiben bestehen, wie
   scripts/staging-reset.mjs es für alle Prüfskripte vorsieht.
   ============================================================ */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mailquelle, testadresse } from "./lib/mailquelle.mjs";

const HIER = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HIER, "..");
const BASIS = (process.argv[2] || "http://localhost:3007").replace(/\/$/, "");
const TIMEOUT_MS = 60_000;
const TS = Date.now();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a)"); process.exit(2); }
const sql = postgres(DATABASE_URL, { max: 4, onnotice: () => {} });

const MOD_EMAIL_STANDARD = process.env.FW_TEST_MOD_EMAIL;
const MOD_PASSWORT_STANDARD = process.env.FW_TEST_MOD_PASSWORT;
if (!MOD_EMAIL_STANDARD || !MOD_PASSWORT_STANDARD) {
  console.error("FW_TEST_MOD_EMAIL und FW_TEST_MOD_PASSWORT fehlen — Zugangsdaten des Moderationskontos kommen aus der Umgebung, nie aus dem Skript.");
  process.exit(2);
}

const PASSWORT = "Sich-" + randomBytes(12).toString("base64url");
const EMAIL_A = testadresse("osa", TS);
const EMAIL_B = testadresse("osb", TS);
const EMAIL_C = testadresse("osc", TS);
const EMAIL_D = testadresse("osd", TS);
const EMAIL_X = testadresse("osx", TS);       // nie registriert — für Einladung an falsche Adresse
const EMAIL_LESEN = testadresse("osrl", TS);  // nie registriert — nur für die Maskierungsprüfung
const ALPHA_NAME = `Alpha Sicherheit AG (Demo ${TS})`;
const BETA_NAME = `Beta Sicherheit AG (Demo ${TS})`;
const BILD_PFAD = join(APP_ROOT, "public", "media", "zurich-altbau-1-960.jpg");
const ORT_ID = "ort-bern";

const ergebnisse = [];
function assertTrue(bedingung, meldung) { if (!bedingung) throw new Error(meldung); }
function assertGleich(ist, soll, feld) {
  if (ist !== soll) throw new Error(`${feld}: erwartet ${JSON.stringify(soll)}, erhalten ${JSON.stringify(ist)}`);
}
async function schritt(bez, titel, fn) {
  try {
    const detail = (await fn()) || "ok";
    ergebnisse.push({ bez, titel, status: "OK", detail });
    console.log(`OK      ${String(bez).padStart(3)}  ${titel}`);
  } catch (e) {
    const detail = e && e.message ? e.message : String(e);
    ergebnisse.push({ bez, titel, status: "FEHLER", detail });
    console.log(`FEHLER  ${String(bez).padStart(3)}  ${titel} — ${detail}`);
  }
}

/* ---------- x-forwarded-for je Konto, wegen des Anmelde-Ratenlimits ---------- */
const RUNSEED = Math.floor(Math.random() * 200) + 10;
const xffMap = new Map();
function xff(tag) {
  if (!xffMap.has(tag)) xffMap.set(tag, `10.${RUNSEED}.${xffMap.size + 1}.51`);
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
const del = (p, o) => api("DELETE", p, o);

function cookieAus(setCookies) {
  const c = setCookies.find(c => c.startsWith("fw.session_token="));
  return c ? c.split(";")[0] : null;
}

async function uploadDatei(cookie, pfad, dateiname, mime) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const fd = new FormData();
    fd.append("datei", new Blob([readFileSync(pfad)], { type: mime }), dateiname);
    const res = await fetch(BASIS + "/api/medien", { method: "POST", headers: { origin: BASIS, cookie }, body: fd, redirect: "manual", signal: ctrl.signal });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* kein JSON */ }
    return { status: res.status, json };
  } finally { clearTimeout(timer); }
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
async function neuesteMail(email, seitMs) { return MAILQUELLE.warte(email, seitMs); }
function tokenAusMail(mail) {
  const treffer = mail.text.match(/\/einladung\/([A-Za-z0-9_-]+)/);
  if (!treffer) throw new Error(`Kein Einladungstoken in der Mail gefunden: ${mail.text.slice(0, 200)}`);
  return treffer[1];
}
const sha256Hex = s => createHash("sha256").update(s).digest("hex");

/* ---------- Registrieren / Anmelden ---------- */
async function registrieren(email, passwort, name, xffTag) {
  return post("/api/auth/sign-up/email", { origin: BASIS, xffTag, body: { email, password: passwort, name } });
}
async function anmelden(email, passwort, xffTag) {
  const r = await post("/api/auth/sign-in/email", { origin: BASIS, xffTag, body: { email, password: passwort } });
  return { ...r, cookie: cookieAus(r.setCookies) };
}
async function konto(email, name, xffTag) {
  const seit = Date.now();
  const su = await registrieren(email, PASSWORT, name, xffTag);
  assertGleich(su.status, 200, `sign-up ${name}`);
  const best = await bestaetigeMail(email, seit);
  assertGleich(best, 302, `bestätigung ${name}`);
  const si = await anmelden(email, PASSWORT, xffTag);
  assertGleich(si.status, 200, `sign-in ${name}`);
  assertTrue(!!si.cookie, `kein Sitzungscookie für ${name}`);
  return { email, cookie: si.cookie, id: si.json.user.id };
}

/* ---------- Vollständige Assistentendaten (wie org-inserate-test.mjs) ---------- */
/* Fakten und Text — ohne Bild, damit auch eine andere Person als Bearbeiter
   (z. B. wer später zuweist) den Entwurf vorbereiten kann. Ein Bild MUSS von
   derselben Person stammen, die später einreicht (server/entwuerfe.ts:
   materialisieren prüft media_asset.uploaded_by = person.id) — siehe
   bildErgaenzenUndEinreichen(). */
async function faktenUndText(cookie, ref, version, titel) {
  const p1 = await patch(`/api/entwuerfe/${ref}`, {
    origin: BASIS, cookie,
    body: { version, daten: { trans: "sale", typ: "wohnung", ortId: ORT_ID, genauigkeit: "ungefaehr", zimmer: 3.5, flaeche: 85, preis: 640000 } }
  });
  assertGleich(p1.status, 200, "faktenUndText: fakten");
  const p2 = await patch(`/api/entwuerfe/${ref}`, {
    origin: BASIS, cookie,
    body: { version: p1.json.version, daten: { titel, beschreibung: "Automatisierte Sicherheitsprüfung — bitte ignorieren.", name: "Prüfperson", email: `pruef+${TS}@example.com` } }
  });
  assertGleich(p2.status, 200, "faktenUndText: text");
  return p2.json.version;
}

/* Fakten, Text und Bild aus EINER Hand, dann sofort einreichen — für den
   einfachen Fall, dass dieselbe Person bearbeitet und einreicht. */
async function vervollstaendigen(cookie, ref, version, titel) {
  const nachText = await faktenUndText(cookie, ref, version, titel);
  const hoch = await uploadDatei(cookie, BILD_PFAD, "foto.jpg", "image/jpeg");
  assertGleich(hoch.status, 201, "vervollstaendigen: bild hochladen");
  const p3 = await patch(`/api/entwuerfe/${ref}`, { origin: BASIS, cookie, body: { version: nachText, daten: { bilder: [hoch.json.id] } } });
  assertGleich(p3.status, 200, "vervollstaendigen: bilder");
  return p3.json.version;
}

/* Bild ergänzen (durch die einreichende Person selbst) und einreichen —
   für den Team-Fall, in dem eine andere Person zugewiesen wurde. */
async function bildErgaenzenUndEinreichen(cookie, ref, version) {
  const hoch = await uploadDatei(cookie, BILD_PFAD, "foto.jpg", "image/jpeg");
  assertGleich(hoch.status, 201, "bildErgaenzenUndEinreichen: bild hochladen");
  const p = await patch(`/api/entwuerfe/${ref}`, { origin: BASIS, cookie, body: { version, daten: { bilder: [hoch.json.id] } } });
  assertGleich(p.status, 200, "bildErgaenzenUndEinreichen: bilder");
  const r = await post(`/api/entwuerfe/${ref}/aktion`, { origin: BASIS, cookie, body: { absicht: "einreichen" } });
  return r;
}

async function moderatorAnmelden(tagPrefix) {
  let r = await anmelden(MOD_EMAIL_STANDARD, MOD_PASSWORT_STANDARD, `${tagPrefix}-auth`);
  let modEmail = MOD_EMAIL_STANDARD;
  if (r.status !== 200 || !r.cookie) {
    modEmail = `${tagPrefix}mod+${TS}@fourwalls.example`;
    const su = await registrieren(modEmail, MOD_PASSWORT_STANDARD, "Moderator Org-Sicherheit", `${tagPrefix}-signup`);
    assertGleich(su.status, 200, "sign-up Moderator (Fallback)");
    await bestaetigeMail(modEmail);
    r = await anmelden(modEmail, MOD_PASSWORT_STANDARD, `${tagPrefix}-auth`);
    assertGleich(r.status, 200, "sign-in Moderator (Fallback)");
    execFileSync(process.execPath, [join(APP_ROOT, "scripts", "rolle.mjs"), modEmail, "moderator"], { stdio: "inherit", env: process.env });
    r = await anmelden(modEmail, MOD_PASSWORT_STANDARD, `${tagPrefix}-auth`);
  }
  const [modRow] = await sql`SELECT email_verified FROM app_user WHERE email = ${modEmail}`;
  if (modRow && !modRow.email_verified) {
    await post("/api/auth/send-verification-email", { origin: BASIS, body: { email: modEmail, callbackURL: "/" } });
    await bestaetigeMail(modEmail);
    r = await anmelden(modEmail, MOD_PASSWORT_STANDARD, `${tagPrefix}-auth`);
  }
  return { email: modEmail, cookie: r.cookie, id: r.json.user.id };
}

/* ---------- Aufräumen — läuft immer, auch nach einem Fehler ---------- */
let alphaId = null, betaId = null;
async function aufraeumen() {
  try {
    const ids = [alphaId, betaId].filter(Boolean);
    if (!ids.length) return;
    const props = await sql`SELECT property_id FROM listing WHERE published_by_org_id = ANY(${ids})`;
    await sql`DELETE FROM inquiry WHERE recipient_org_id = ANY(${ids})`;
    await sql`DELETE FROM listing WHERE published_by_org_id = ANY(${ids})`;
    const propIds = props.map(p => p.property_id).filter(Boolean);
    if (propIds.length) await sql`DELETE FROM property WHERE id = ANY(${propIds})`;
    await sql`DELETE FROM organization WHERE id = ANY(${ids})`;
    console.log(`Aufgeräumt: Organisationen ${ids.join(", ")} und ihre Testinserate gelöscht.`);
  } catch (e) {
    console.error("Aufräumen fehlgeschlagen:", e.message || e);
  }
}

const START = Date.now();
console.log(`Basis: ${BASIS}  —  Organisationen-Sicherheitsmatrix startet (TS=${TS})`);

let A, B, C, D, MOD;
let alphaSlug, betaSlug;
let alphaRef; // Alpha-Inserat: angelegt von A, B zugewiesen, eingereicht, veröffentlicht

try {
  /* ---------- Vorbereitung ---------- */
  await schritt("V1", "Vier Konten anlegen (A, B, C, D)", async () => {
    A = await konto(EMAIL_A, "Owner Alpha (Sicherheit)", "os-a");
    C = await konto(EMAIL_C, "Owner Beta (Sicherheit)", "os-c");
    D = await konto(EMAIL_D, "Kunde ohne Team (Sicherheit)", "os-d");
    return `A=${A.id} C=${C.id} D=${D.id}`;
  });

  await schritt("V2", "A legt Alpha an, C legt Beta an (POST /api/org)", async () => {
    const rA = await post("/api/org", { origin: BASIS, cookie: A.cookie, body: { displayName: ALPHA_NAME, kind: "agency", locale: "de", city: "Bern" } });
    assertGleich(rA.status, 201, "Alpha anlegen");
    alphaSlug = rA.json.slug; alphaId = rA.json.id;
    const rC = await post("/api/org", { origin: BASIS, cookie: C.cookie, body: { displayName: BETA_NAME, kind: "agency", locale: "de", city: "Bern" } });
    assertGleich(rC.status, 201, "Beta anlegen");
    betaSlug = rC.json.slug; betaId = rC.json.id;
    return `alpha=${alphaSlug}, beta=${betaSlug}`;
  });

  await schritt("V3", "A lädt B ein, B nimmt an (agent)", async () => {
    const seit = Date.now();
    const rEinladen = await post(`/api/org/${alphaSlug}/mitglieder`, { origin: BASIS, cookie: A.cookie, body: { email: EMAIL_B, rolle: "agent" } });
    assertGleich(rEinladen.status, 201, "einladen");
    const mail = await neuesteMail(EMAIL_B, seit);
    assertTrue(!!mail, "keine Einladungsmail für B gefunden");
    const token = tokenAusMail(mail);
    B = await konto(EMAIL_B, "Agent Alpha (Sicherheit)", "os-b");
    const rAnnehmen = await post(`/api/einladungen/${token}`, { origin: BASIS, cookie: B.cookie });
    assertGleich(rAnnehmen.status, 200, "annehmen");
    return `B=${B.id} ist agent bei Alpha`;
  });

  await schritt("V4", "Alpha-Inserat: A legt an, B wird zugewiesen, B reicht ein, Moderator veröffentlicht", async () => {
    const rNeu = await post(`/api/org/${alphaSlug}/inserate`, { origin: BASIS, cookie: A.cookie, body: {} });
    assertGleich(rNeu.status, 201, "anlegen");
    alphaRef = rNeu.json.publicRef;
    await faktenUndText(A.cookie, alphaRef, rNeu.json.version, `Alpha-Sicherheitsinserat ${TS}`);
    const rZu = await post(`/api/org/${alphaSlug}/inserate/${alphaRef}/zuweisen`, { origin: BASIS, cookie: A.cookie, body: { userId: B.id } });
    assertGleich(rZu.status, 200, "zuweisen");
    /* Der Zuweisungs-Trigger erhöht `version` zusätzlich — die nächste
       Änderung muss von rZu.json.version ausgehen, nicht vom Stand davor
       (siehe scripts/org-inserate-test.mjs, Schritt 5). Das Bild muss von B
       stammen — B reicht ein, und materialisieren() akzeptiert nur Bilder
       der einreichenden Person. */
    const rEin = await bildErgaenzenUndEinreichen(B.cookie, alphaRef, rZu.json.version);
    assertGleich(rEin.status, 200, "einreichen (B)");
    MOD = await moderatorAnmelden("osv4");
    const rVer = await post(`/api/moderation/${alphaRef}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "freigeben-und-veroeffentlichen" } });
    assertGleich(rVer.status, 200, "freigeben-und-veroeffentlichen");
    const [row] = await sql`SELECT status FROM listing WHERE public_ref = ${alphaRef}`;
    assertGleich(row.status, "published", "status in der DB");
    return `alphaRef=${alphaRef}, zugewiesen=B, status=published`;
  });

  /* ---------- Die Sicherheitsmatrix ---------- */
  await schritt(1, "C GET /api/org/<alpha>/inserate → 404", async () => {
    const r = await get(`/api/org/${alphaSlug}/inserate`, { cookie: C.cookie });
    assertGleich(r.status, 404, "status");
    return `status=${r.status}`;
  });

  await schritt(2, "C PATCH /api/entwuerfe/<alphaRef> → 404", async () => {
    const r = await patch(`/api/entwuerfe/${alphaRef}`, { origin: BASIS, cookie: C.cookie, body: { version: 1, daten: {} } });
    assertGleich(r.status, 404, "status");
    return `status=${r.status}`;
  });

  await schritt(3, "C POST zuweisen auf Alpha-Inserat → 404", async () => {
    const r = await post(`/api/org/${alphaSlug}/inserate/${alphaRef}/zuweisen`, { origin: BASIS, cookie: C.cookie, body: { userId: C.id } });
    assertGleich(r.status, 404, "status");
    return `status=${r.status}`;
  });

  await schritt(4, "C GET /api/org/<alpha>/anfragen → 404", async () => {
    const r = await get(`/api/org/${alphaSlug}/anfragen`, { cookie: C.cookie });
    assertGleich(r.status, 404, "status");
    return `status=${r.status}`;
  });

  await schritt(5, "C GET /api/org/<alpha>/mitglieder → 404", async () => {
    const r = await get(`/api/org/${alphaSlug}/mitglieder`, { cookie: C.cookie });
    assertGleich(r.status, 404, "status");
    return `status=${r.status}`;
  });

  await schritt(6, "B (agent, ohne MANAGE_MEMBERS) versucht die eigene Rolle auf owner/admin zu setzen → je 403", async () => {
    const r1 = await patch(`/api/org/${alphaSlug}/mitglieder/${B.id}`, { origin: BASIS, cookie: B.cookie, body: { rolle: "owner" } });
    assertGleich(r1.status, 403, "status (owner)");
    const r2 = await patch(`/api/org/${alphaSlug}/mitglieder/${B.id}`, { origin: BASIS, cookie: B.cookie, body: { rolle: "admin" } });
    assertGleich(r2.status, 403, "status (admin)");
    return "beide 403";
  });

  await schritt(7, "B (agent) versucht A aus dem Team zu entfernen → 403", async () => {
    const r = await del(`/api/org/${alphaSlug}/mitglieder/${A.id}`, { origin: BASIS, cookie: B.cookie });
    assertGleich(r.status, 403, "status");
    return `status=${r.status}`;
  });

  await schritt(8, "D (ohne Organisation): GET Alpha → 404, GET /api/org → leer", async () => {
    const rAlpha = await get(`/api/org/${alphaSlug}`, { cookie: D.cookie });
    assertGleich(rAlpha.status, 404, "GET Alpha");
    const rListe = await get("/api/org", { cookie: D.cookie });
    assertGleich(rListe.status, 200, "GET /api/org status");
    assertGleich(rListe.json.organisationen.length, 0, "Anzahl Organisationen für D");
    return "GET Alpha=404, /api/org leer";
  });

  await schritt(9, "D POST /api/org/<alpha>/inserate → 404", async () => {
    const r = await post(`/api/org/${alphaSlug}/inserate`, { origin: BASIS, cookie: D.cookie, body: {} });
    assertGleich(r.status, 404, "status");
    return `status=${r.status}`;
  });

  await schritt(10, "A (Alpha) POST /api/org/<beta>/inserate → 404", async () => {
    const r = await post(`/api/org/${betaSlug}/inserate`, { origin: BASIS, cookie: A.cookie, body: {} });
    assertGleich(r.status, 404, "status");
    return `status=${r.status}`;
  });

  let refAngriff;
  await schritt(11, "publisher_kind=fourwalls beim Anlegen wird ignoriert/abgelehnt; represented_by_org_id per PATCH → 422", async () => {
    const r = await post(`/api/org/${alphaSlug}/inserate`, {
      origin: BASIS, cookie: A.cookie,
      body: { daten: { titel: `Angriffsentwurf ${TS}` }, publisher_kind: "fourwalls" }
    });
    assertTrue([201, 422].includes(r.status), `unerwarteter Status ${r.status} (erwartet 201 oder 422)`);
    let befund;
    if (r.status === 201) {
      refAngriff = r.json.publicRef;
      const [row] = await sql`SELECT publisher_kind, represented_by_org_id FROM listing WHERE public_ref = ${refAngriff}`;
      assertGleich(row.publisher_kind, "agency", "publisher_kind in der DB");
      assertGleich(row.represented_by_org_id, null, "represented_by_org_id in der DB");
      befund = `angelegt (publisher_kind top-level ignoriert), DB: publisher_kind=agency, represented_by_org_id=NULL`;
    } else {
      befund = "422 — Feld wurde als Ganzes abgelehnt";
    }
    if (refAngriff) {
      const [aktuell] = await sql`SELECT version FROM listing WHERE public_ref = ${refAngriff}`;
      const rPatch = await patch(`/api/entwuerfe/${refAngriff}`, {
        origin: BASIS, cookie: A.cookie, body: { version: aktuell.version, daten: { represented_by_org_id: betaId } }
      });
      assertGleich(rPatch.status, 422, "PATCH represented_by_org_id");
      befund += `; PATCH represented_by_org_id=422`;
    }
    return befund;
  });

  await schritt(12, "PATCH Profil: verification_state/verified_at im Body → je 422, DB bleibt unverified", async () => {
    const r1 = await patch(`/api/org/${alphaSlug}`, { origin: BASIS, cookie: A.cookie, body: { verification_state: "verified" } });
    assertGleich(r1.status, 422, "status verification_state");
    const r2 = await patch(`/api/org/${alphaSlug}`, { origin: BASIS, cookie: A.cookie, body: { verified_at: new Date().toISOString() } });
    assertGleich(r2.status, 422, "status verified_at");
    const [row] = await sql`SELECT verification_state FROM organization WHERE id = ${alphaId}`;
    assertGleich(row.verification_state, "unverified", "verification_state in der DB");
    return "beide 422, DB weiterhin unverified";
  });

  await schritt(13, "PATCH Entwurf {status:'published'} → 422; POST /api/moderation/<alphaRef> als A (Besitzerin, kein Moderator) → 403", async () => {
    assertTrue(!!refAngriff, "kein refAngriff aus Schritt 11 verfügbar (Voraussetzung: Status 201 dort)");
    const [vor] = await sql`SELECT status, version FROM listing WHERE public_ref = ${refAngriff}`;
    const r1 = await patch(`/api/entwuerfe/${refAngriff}`, { origin: BASIS, cookie: A.cookie, body: { version: vor.version, daten: { status: "published" } } });
    assertGleich(r1.status, 422, "status PATCH status=published");
    const [nach] = await sql`SELECT status FROM listing WHERE public_ref = ${refAngriff}`;
    assertGleich(nach.status, vor.status, "status unverändert");
    const r2 = await post(`/api/moderation/${alphaRef}`, { origin: BASIS, cookie: A.cookie, body: { absicht: "freigeben" } });
    assertGleich(r2.status, 403, "status POST moderation (A)");
    return `PATCH status=422 (unverändert=${nach.status}), moderation(A)=403`;
  });

  await schritt(14, "Widerruf: A entfernt B; B's altes Cookie sieht Alpha nicht mehr; Inserat bleibt published, assigned_user_id NULL", async () => {
    const seit = Date.now();
    const r = await del(`/api/org/${alphaSlug}/mitglieder/${B.id}`, { origin: BASIS, cookie: A.cookie });
    assertGleich(r.status, 200, "entfernen");
    const rListe = await get(`/api/org/${alphaSlug}/inserate`, { cookie: B.cookie });
    assertGleich(rListe.status, 404, "GET org/inserate mit altem Cookie");
    const rPatch = await patch(`/api/entwuerfe/${alphaRef}`, { origin: BASIS, cookie: B.cookie, body: { version: 1, daten: {} } });
    assertGleich(rPatch.status, 404, "PATCH Entwurf mit altem Cookie");
    const [row] = await sql`SELECT status, assigned_user_id FROM listing WHERE public_ref = ${alphaRef}`;
    assertGleich(row.status, "published", "Inserat bleibt published");
    assertGleich(row.assigned_user_id, null, "assigned_user_id entfernt");
    const rSuche = await get(`/api/search?ref=${alphaRef}`, {});
    assertTrue((rSuche.json?.treffer ?? []).some(t => t.id === alphaRef), "alphaRef nicht mehr in /api/search gefunden");
    const mail = await neuesteMail(EMAIL_B, seit);
    assertTrue(!!mail, "keine Mail an B nach Entfernen gefunden");
    return "B=404 auf Org-Routen, Inserat weiterhin published+durchsuchbar, assigned_user_id=NULL";
  });

  await schritt(15, "Abgelaufene Einladung (SQL expires_at=now()-1h) annehmen → 409", async () => {
    const seit = Date.now();
    const rEinladen = await post(`/api/org/${alphaSlug}/mitglieder`, { origin: BASIS, cookie: A.cookie, body: { email: EMAIL_D, rolle: "viewer" } });
    assertGleich(rEinladen.status, 201, "einladen");
    const mail = await neuesteMail(EMAIL_D, seit);
    const token = tokenAusMail(mail);
    await sql`UPDATE org_invitation SET expires_at = now() - interval '1 hour' WHERE token_hash = ${sha256Hex(token)}`;
    const r = await post(`/api/einladungen/${token}`, { origin: BASIS, cookie: D.cookie });
    assertGleich(r.status, 409, "status");
    return `status=${r.status}`;
  });

  await schritt(16, "Einladung zweimal annehmen → zweites Mal 409", async () => {
    const seit = Date.now();
    const rEinladen = await post(`/api/org/${alphaSlug}/mitglieder`, { origin: BASIS, cookie: A.cookie, body: { email: EMAIL_D, rolle: "viewer" } });
    assertGleich(rEinladen.status, 201, "einladen");
    const mail = await neuesteMail(EMAIL_D, seit);
    const token = tokenAusMail(mail);
    const r1 = await post(`/api/einladungen/${token}`, { origin: BASIS, cookie: D.cookie });
    assertGleich(r1.status, 200, "erstes Annehmen");
    const r2 = await post(`/api/einladungen/${token}`, { origin: BASIS, cookie: D.cookie });
    assertGleich(r2.status, 409, "zweites Annehmen");
    return `erstes=200, zweites=${r2.status}`;
  });

  await schritt(17, "Einladung an EMAIL_X, Konto D (andere Adresse) nimmt an → 403", async () => {
    const seit = Date.now();
    const rEinladen = await post(`/api/org/${alphaSlug}/mitglieder`, { origin: BASIS, cookie: A.cookie, body: { email: EMAIL_X, rolle: "viewer" } });
    assertGleich(rEinladen.status, 201, "einladen");
    const mail = await neuesteMail(EMAIL_X, seit);
    const token = tokenAusMail(mail);
    const r = await post(`/api/einladungen/${token}`, { origin: BASIS, cookie: D.cookie });
    assertGleich(r.status, 403, "status");
    return `status=${r.status}`;
  });

  let refModTest;
  await schritt(18, "Moderator, der Mitglied von Alpha ist, darf ein Alpha-Inserat nicht freigeben (eigenes Büro) — nach Austritt schon", async () => {
    const rNeu = await post(`/api/org/${alphaSlug}/inserate`, { origin: BASIS, cookie: A.cookie, body: {} });
    assertGleich(rNeu.status, 201, "anlegen");
    refModTest = rNeu.json.publicRef;
    await vervollstaendigen(A.cookie, refModTest, rNeu.json.version, `Alpha-Moderationsinserat ${TS}`);
    const rEin = await post(`/api/entwuerfe/${refModTest}/aktion`, { origin: BASIS, cookie: A.cookie, body: { absicht: "einreichen" } });
    assertGleich(rEin.status, 200, "einreichen");

    await sql`INSERT INTO org_membership (organization_id, user_id, role, is_active) VALUES (${alphaId}, ${MOD.id}, 'viewer', true)
              ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'viewer', is_active = true`;
    const r1 = await post(`/api/moderation/${refModTest}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "freigeben" } });
    assertGleich(r1.status, 403, "freigeben mit Mitgliedschaft");

    await sql`DELETE FROM org_membership WHERE organization_id = ${alphaId} AND user_id = ${MOD.id}`;
    const r2 = await post(`/api/moderation/${refModTest}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "freigeben" } });
    assertGleich(r2.status, 200, "freigeben nach Austritt");
    return `mit Mitgliedschaft=403, nach Austritt=${r2.status}`;
  });

  await schritt(19, "C liest /api/einladungen/<token> — nur maskierte Adresse, keine Mitgliederliste", async () => {
    const seit = Date.now();
    const rEinladen = await post(`/api/org/${alphaSlug}/mitglieder`, { origin: BASIS, cookie: A.cookie, body: { email: EMAIL_LESEN, rolle: "viewer" } });
    assertGleich(rEinladen.status, 201, "einladen");
    const mail = await neuesteMail(EMAIL_LESEN, seit);
    const token = tokenAusMail(mail);
    const r = await get(`/api/einladungen/${token}`, { cookie: C.cookie });
    assertGleich(r.status, 200, "status");
    assertTrue(/^.\*\*\*@/.test(r.json.emailMaskiert), `E-Mail nicht maskiert: ${r.json.emailMaskiert}`);
    assertTrue(!r.json.emailMaskiert.includes(EMAIL_LESEN), "unmaskierte Adresse in der Antwort");
    assertTrue(!("mitglieder" in r.json), "Mitgliederliste in der öffentlichen Antwort gefunden");
    assertGleich(r.json.zustand, "offen", "zustand");
    return `emailMaskiert=${r.json.emailMaskiert}, keine Mitgliederliste`;
  });

  await schritt(20, "POST /api/inquiries: Antwort enthält keine Mitarbeiter-E-Mail", async () => {
    const r = await post("/api/inquiries", {
      origin: BASIS, xffTag: "os-inquiry",
      body: { publicRef: alphaRef, art: "viewing_request", name: "Prüfperson Sicherheit", email: `osq+${TS}@example.com`, nachricht: "Automatisierte Sicherheitsprüfung — bitte ignorieren.", firma: "" }
    });
    assertGleich(r.status, 201, "status");
    const schluessel = Object.keys(r.json ?? {}).sort();
    assertGleich(JSON.stringify(schluessel), JSON.stringify(["angenommen", "publicRef"]), "Antwortfelder");
    assertTrue(!r.text.includes(A.email) && !r.text.includes(EMAIL_B), "eine Mitarbeiter-/Besitzerinnen-Adresse steht in der Antwort");
    return `Antwortfelder=${schluessel.join(",")}, keine Adresse enthalten`;
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
  const w1 = 4;
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
