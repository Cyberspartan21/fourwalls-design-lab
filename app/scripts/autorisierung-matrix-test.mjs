#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Autorisierungs-Master-Matrix (P5.10 §8)

   Legt jeden in §8 verlangten Akteur einmal frisch an (anonym, Kunde K,
   privater Verkäufer P, Organisation ALPHA mit owner/admin/agent/viewer,
   Organisation BETA mit owner, staff S, moderator M, Plattform-Admin AD) und
   prüft für jede Ressource × Akteur-Kombination den aus dem Code
   hergeleiteten erwarteten HTTP-Status (200/201 | 401 | 403 | 404).

   Die Herleitung steht in den Kommentaren neben jeder Prüfung — sie zitieren
   die Stelle in domain/rechte.ts, domain/orgrechte.ts oder server/*.ts, die
   über den Status entscheidet. Jede Abweichung ist ein Fund.

   Aufruf:
     set -a; . ./.env.local; set +a
     FW_TEST_MOD_EMAIL=mod@fourwalls.example FW_TEST_MOD_PASSWORT=... \
       node scripts/autorisierung-matrix-test.mjs [Basis-URL]

   FW_TEST_MOD_EMAIL/FW_TEST_MOD_PASSWORT kommen aus var/konten.local.json
   (Struktur `konten`: {email: passwort}) — die mod@-Adresse dort, nie im
   Klartext in diesem Skript oder im Bericht.

   Mailquelle (siehe scripts/lib/mailquelle.mjs): FW_TEST_MAIL_QUELLE=dev|mailpit|imap.

   Testkonten tragen das Präfix "am" (Autorisierungs-Matrix) in der lokalen
   Adresse — siehe testadresse(). Ausgabe: nummerierte Tabelle, Exit 1 bei
   irgendeinem FEHLER, sonst 0. Räumt seine Testorganisationen/-inserate am
   Ende immer auf (auch nach einem Fehler mittendrin); Konten mit Prüfspur
   bleiben bestehen, wie bei den anderen Prüfskripten.
   ============================================================ */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
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

const PASSWORT = "Matrix-" + randomBytes(12).toString("base64url");
const EMAIL_K = testadresse("amk", TS);
const EMAIL_P = testadresse("amp", TS);
const EMAIL_O1 = testadresse("amo1", TS);
const EMAIL_A1 = testadresse("ama1", TS);
const EMAIL_G1 = testadresse("amg1", TS);
const EMAIL_V1 = testadresse("amv1", TS);
const EMAIL_O2 = testadresse("amo2", TS);
const EMAIL_STAFF = testadresse("amstaff", TS);
const EMAIL_ADMIN = testadresse("amadmin", TS);
const EMAIL_BETA_INVITE = testadresse("aminv-beta", TS);
const EMAIL_EXPIRED_INVITE = testadresse("aminv-abgelaufen", TS);
const BILD_PFAD = join(APP_ROOT, "public", "media", "zurich-altbau-1-960.jpg");
const ORT_ID = "ort-bern";
const ALPHA_NAME = `Alpha Matrix AG (Demo ${TS})`;
const BETA_NAME = `Beta Matrix AG (Demo ${TS})`;

const ergebnisse = [];
function assertTrue(bedingung, meldung) { if (!bedingung) throw new Error(meldung); }
function assertGleich(ist, soll, feld) {
  if (ist !== soll) throw new Error(`${feld}: erwartet ${JSON.stringify(soll)}, erhalten ${JSON.stringify(ist)}`);
}
async function schritt(bez, titel, fn) {
  try {
    const detail = (await fn()) || "ok";
    ergebnisse.push({ bez, titel, status: "OK", detail });
    console.log(`OK      ${String(bez).padStart(4)}  ${titel}`);
  } catch (e) {
    const detail = e && e.message ? e.message : String(e);
    ergebnisse.push({ bez, titel, status: "FEHLER", detail });
    console.log(`FEHLER  ${String(bez).padStart(4)}  ${titel} — ${detail}`);
  }
}

/* ---------- x-forwarded-for je Konto ---------- */
const RUNSEED = Math.floor(Math.random() * 200) + 10;
const xffMap = new Map();
function xff(tag) {
  if (!xffMap.has(tag)) xffMap.set(tag, `10.${RUNSEED}.${xffMap.size + 1}.61`);
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
function bestaetigungsAdresse(email) {
  let h = 0; for (const c of String(email)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `10.${(h >>> 16) & 255}.${(h >>> 8) & 255}.${(h & 253) + 1}`;
}
/* Grosszügiger Timeout (Standard der Mailquelle wäre 30 s): dieses Skript
   läuft laut Auftrag parallel zu anderen Prüfläufen auf demselben
   Entwicklungsserver (H3a/H8/H9) — der Hintergrundversand (OUTBOX_INTERVAL_MS)
   kann unter dieser Last länger als 30 s brauchen, ohne dass etwas falsch ist. */
const MAIL_TIMEOUT_MS = 60_000;
async function bestaetigeMail(email, seitMs = null) {
  const mail = await MAILQUELLE.warte(email, seitMs, MAIL_TIMEOUT_MS);
  if (!mail) throw new Error(`Keine Mail für ${email} über Mailquelle "${MAILQUELLE.name}" gefunden (${MAIL_TIMEOUT_MS / 1000} s gewartet)`);
  const treffer = mail.text.match(/https?:\/\/\S+/);
  if (!treffer) throw new Error(`Keine URL in der Mail an ${email} gefunden`);
  const res = await fetch(treffer[0], { redirect: "manual", headers: { "x-forwarded-for": bestaetigungsAdresse(email) } });
  return res.status;
}
async function neuesteMail(email, seitMs) { return MAILQUELLE.warte(email, seitMs, MAIL_TIMEOUT_MS); }
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
/* Dieses Skript prüft Autorisierung (§8) — nicht den Bestätigungs-Mailweg
   selbst (das tut scripts/sicherheit-test.mjs). Der Bericht läuft laut
   Auftrag parallel zu mehreren anderen Prüfläufen auf demselben
   Entwicklungsserver (H3a/H8/H9); deren gemeinsame Last auf den einzelnen
   Node-Prozess macht den Mailversand unzuverlässig knapp bemessen. Konten,
   die nur als HINTERGRUND-Akteure für die Matrix gebraucht werden, bestätigen
   ihre Adresse deshalb direkt per SQL — spart den Mail-Umweg, ohne an der
   geprüften Autorisierung (Sitzung, Rolle, Mitgliedschaft) etwas zu ändern.
   Der echte Mailweg bleibt für Schritt 37 (abgelaufene Einladung) bestehen,
   weil dort das Token selbst geprüft wird und nur aus der Mail kommt. */
async function kontoSchnell(email, name, xffTag) {
  const su = await registrieren(email, PASSWORT, name, xffTag);
  assertGleich(su.status, 200, `sign-up ${name}`);
  await sql`UPDATE app_user SET email_verified = true WHERE email = ${email}`;
  const si = await anmelden(email, PASSWORT, xffTag);
  assertGleich(si.status, 200, `sign-in ${name}`);
  assertTrue(!!si.cookie, `kein Sitzungscookie für ${name}`);
  return { email, cookie: si.cookie, id: si.json.user.id };
}
async function moderatorAnmelden(tagPrefix) {
  let r = await anmelden(MOD_EMAIL_STANDARD, MOD_PASSWORT_STANDARD, `${tagPrefix}-auth`);
  let modEmail = MOD_EMAIL_STANDARD;
  if (r.status !== 200 || !r.cookie) {
    modEmail = `${tagPrefix}mod+${TS}@fourwalls.example`;
    const su = await registrieren(modEmail, MOD_PASSWORT_STANDARD, "Moderator Autorisierungsmatrix", `${tagPrefix}-signup`);
    assertGleich(su.status, 200, "sign-up Moderator (Fallback)");
    await bestaetigeMail(modEmail);
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

/* ---------- Entwurf ausfüllen (wie scripts/org-sicherheit-test.mjs) ---------- */
async function faktenUndText(cookie, ref, version, titel) {
  const p1 = await patch(`/api/entwuerfe/${ref}`, {
    origin: BASIS, cookie,
    body: { version, daten: { trans: "sale", typ: "wohnung", ortId: ORT_ID, genauigkeit: "ungefaehr", zimmer: 3.5, flaeche: 85, preis: 640000 } }
  });
  assertGleich(p1.status, 200, "faktenUndText: fakten");
  const p2 = await patch(`/api/entwuerfe/${ref}`, {
    origin: BASIS, cookie,
    body: { version: p1.json.version, daten: { titel, beschreibung: "Automatisierte Autorisierungsmatrix — bitte ignorieren.", name: "Prüfperson", email: `amx+${TS}@example.com` } }
  });
  assertGleich(p2.status, 200, "faktenUndText: text");
  return p2.json.version;
}
async function vervollstaendigen(cookie, ref, version, titel) {
  const nachText = await faktenUndText(cookie, ref, version, titel);
  const hoch = await uploadDatei(cookie, BILD_PFAD, "foto.jpg", "image/jpeg");
  assertGleich(hoch.status, 201, "vervollstaendigen: bild hochladen");
  const p3 = await patch(`/api/entwuerfe/${ref}`, { origin: BASIS, cookie, body: { version: nachText, daten: { bilder: [hoch.json.id] } } });
  assertGleich(p3.status, 200, "vervollstaendigen: bilder");
  return { version: p3.json.version, assetId: hoch.json.id };
}
async function bildErgaenzenUndEinreichen(cookie, ref, version) {
  const hoch = await uploadDatei(cookie, BILD_PFAD, "foto.jpg", "image/jpeg");
  assertGleich(hoch.status, 201, "bildErgaenzenUndEinreichen: bild hochladen");
  const p = await patch(`/api/entwuerfe/${ref}`, { origin: BASIS, cookie, body: { version, daten: { bilder: [hoch.json.id] } } });
  assertGleich(p.status, 200, "bildErgaenzenUndEinreichen: bilder");
  const r = await post(`/api/entwuerfe/${ref}/aktion`, { origin: BASIS, cookie, body: { absicht: "einreichen" } });
  return r;
}
/* Teammitgliedschaft für die Matrix-Hintergrundakteure: derselbe Endzustand,
   den eine echte Einladung+Annahme erzeugt hätte (org_membership-Zeile mit
   Rolle, is_active=true) — der Einladungs-Mailweg selbst (Token, Ablauf,
   Wiederverwendung) ist bereits scripts/org-sicherheit-test.mjs's Aufgabe und
   wird hier für Schritt 37 (abgelaufene Einladung) noch einmal echt geprüft. */
async function mitgliedSchnell({ orgId, email, rolle, name, xffTag }) {
  const person = await kontoSchnell(email, name, xffTag);
  await sql`INSERT INTO org_membership (organization_id, user_id, role, is_active) VALUES (${orgId}, ${person.id}, ${rolle}, true)
            ON CONFLICT (organization_id, user_id) DO UPDATE SET role = ${rolle}, is_active = true`;
  return person;
}

/* ---------- Aufräumen — läuft immer, auch nach einem Fehler ---------- */
let alphaId = null, betaId = null;
const zusatzListingRefs = []; // private Inserate von P (nicht organisationsgebunden)
const savedSearchIds = [];
async function aufraeumen() {
  try {
    const orgIds = [alphaId, betaId].filter(Boolean);
    if (orgIds.length) {
      const props = await sql`SELECT property_id FROM listing WHERE published_by_org_id = ANY(${orgIds})`;
      await sql`DELETE FROM inquiry WHERE recipient_org_id = ANY(${orgIds})`;
      await sql`DELETE FROM listing WHERE published_by_org_id = ANY(${orgIds})`;
      const propIds = props.map(p => p.property_id).filter(Boolean);
      if (propIds.length) await sql`DELETE FROM property WHERE id = ANY(${propIds})`;
      await sql`DELETE FROM organization WHERE id = ANY(${orgIds})`;
    }
    if (zusatzListingRefs.length) {
      const props = await sql`SELECT property_id FROM listing WHERE public_ref = ANY(${zusatzListingRefs})`;
      await sql`DELETE FROM listing WHERE public_ref = ANY(${zusatzListingRefs})`;
      const propIds = props.map(p => p.property_id).filter(Boolean);
      if (propIds.length) await sql`DELETE FROM property WHERE id = ANY(${propIds})`;
    }
    if (savedSearchIds.length) await sql`DELETE FROM saved_search WHERE id = ANY(${savedSearchIds})`;
    console.log(`Aufgeräumt: Organisationen ${orgIds.join(", ") || "–"}, Inserate ${zusatzListingRefs.join(", ") || "–"}, Suchabos ${savedSearchIds.length}.`);
  } catch (e) {
    console.error("Aufräumen fehlgeschlagen:", e.message || e);
  }
}

const START = Date.now();
console.log(`Basis: ${BASIS}  —  Autorisierungs-Master-Matrix startet (TS=${TS})`);

let K, P, O1, A1, G1, V1, O2, STAFF, ADMIN, MOD;
let alphaSlug, betaSlug;
let refDraftP;       // P's privater Entwurf, bleibt draft
let refPubP, assetIdDraftP; // P's veröffentlichtes Inserat + Bild seines Entwurfs
let alphaRef;        // ALPHA-Inserat, zugewiesen an G1, veröffentlicht
let alphaRef2;        // ALPHA-Inserat, submitted — für Moderationsprüfungen
let suchaboIdK;

try {
  /* ================= Vorbereitung: Akteure ================= */
  await schritt("V1", "K (Kunde), P (privater Verkäufer) registrieren", async () => {
    K = await kontoSchnell(EMAIL_K, "Kunde K (Matrix)", "am-k");
    P = await kontoSchnell(EMAIL_P, "Verkäufer P (Matrix)", "am-p");
    return `K=${K.id} P=${P.id}`;
  });

  await schritt("V2", "P: privater Entwurf bleibt draft (Ressource für K→404-Prüfungen)", async () => {
    const r = await post("/api/entwuerfe", { origin: BASIS, cookie: P.cookie, body: {} });
    assertGleich(r.status, 201, "entwurf anlegen");
    refDraftP = r.json.publicRef;
    zusatzListingRefs.push(refDraftP);
    const { assetId } = await vervollstaendigen(P.cookie, refDraftP, r.json.version, `Privater Entwurf P ${TS}`);
    assetIdDraftP = assetId;
    return `refDraftP=${refDraftP}, assetId=${assetIdDraftP}`;
  });

  await schritt("V3", "Moderationskonto anmelden", async () => {
    MOD = await moderatorAnmelden("am");
    return `mod=${MOD.email}`;
  });

  await schritt("V4", "P: zweiter Entwurf wird eingereicht und veröffentlicht (refPubP)", async () => {
    const r0 = await post("/api/entwuerfe", { origin: BASIS, cookie: P.cookie, body: {} });
    assertGleich(r0.status, 201, "entwurf anlegen");
    refPubP = r0.json.publicRef;
    zusatzListingRefs.push(refPubP);
    await vervollstaendigen(P.cookie, refPubP, r0.json.version, `Veröffentlichtes Inserat P ${TS}`);
    const sub = await post(`/api/entwuerfe/${refPubP}/aktion`, { origin: BASIS, cookie: P.cookie, body: { absicht: "einreichen" } });
    assertGleich(sub.status, 200, "einreichen");
    const ver = await post(`/api/moderation/${refPubP}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "freigeben-und-veroeffentlichen" } });
    assertGleich(ver.status, 200, "freigeben-und-veroeffentlichen");
    return `refPubP=${refPubP}, status=published`;
  });

  await schritt("V5", "O1 legt ALPHA an, O2 legt BETA an", async () => {
    O1 = await kontoSchnell(EMAIL_O1, "Owner Alpha (Matrix)", "am-o1");
    O2 = await kontoSchnell(EMAIL_O2, "Owner Beta (Matrix)", "am-o2");
    const rA = await post("/api/org", { origin: BASIS, cookie: O1.cookie, body: { displayName: ALPHA_NAME, kind: "agency", locale: "de", city: "Bern" } });
    assertGleich(rA.status, 201, "Alpha anlegen");
    alphaSlug = rA.json.slug; alphaId = rA.json.id;
    const rB = await post("/api/org", { origin: BASIS, cookie: O2.cookie, body: { displayName: BETA_NAME, kind: "agency", locale: "de", city: "Bern" } });
    assertGleich(rB.status, 201, "Beta anlegen");
    betaSlug = rB.json.slug; betaId = rB.json.id;
    return `alpha=${alphaSlug}, beta=${betaSlug}`;
  });

  await schritt("V6", "A1 (admin), G1 (agent), V1 (viewer) werden ALPHA-Mitglieder (direkt gesetzt — der Einladungsweg selbst ist scripts/org-sicherheit-test.mjs's Aufgabe, hier Schritt 37)", async () => {
    A1 = await mitgliedSchnell({ orgId: alphaId, email: EMAIL_A1, rolle: "admin", name: "Admin A1 (Matrix)", xffTag: "am-a1" });
    G1 = await mitgliedSchnell({ orgId: alphaId, email: EMAIL_G1, rolle: "agent", name: "Agent G1 (Matrix)", xffTag: "am-g1" });
    V1 = await mitgliedSchnell({ orgId: alphaId, email: EMAIL_V1, rolle: "viewer", name: "Viewer V1 (Matrix)", xffTag: "am-v1" });
    return `A1=${A1.id}(admin) G1=${G1.id}(agent) V1=${V1.id}(viewer)`;
  });

  await schritt("V7", "ALPHA-Inserat: O1 legt an, weist G1 zu, G1 reicht ein, MOD veröffentlicht", async () => {
    const rNeu = await post(`/api/org/${alphaSlug}/inserate`, { origin: BASIS, cookie: O1.cookie, body: {} });
    assertGleich(rNeu.status, 201, "anlegen");
    alphaRef = rNeu.json.publicRef;
    await faktenUndText(O1.cookie, alphaRef, rNeu.json.version, `Alpha-Matrixinserat ${TS}`);
    const rZu = await post(`/api/org/${alphaSlug}/inserate/${alphaRef}/zuweisen`, { origin: BASIS, cookie: O1.cookie, body: { userId: G1.id } });
    assertGleich(rZu.status, 200, "zuweisen");
    const rEin = await bildErgaenzenUndEinreichen(G1.cookie, alphaRef, rZu.json.version);
    assertGleich(rEin.status, 200, "einreichen (G1)");
    const rVer = await post(`/api/moderation/${alphaRef}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "freigeben-und-veroeffentlichen" } });
    assertGleich(rVer.status, 200, "freigeben-und-veroeffentlichen");
    return `alphaRef=${alphaRef}, zugewiesen=G1, status=published`;
  });

  await schritt("V8", "Zweites ALPHA-Inserat bleibt 'submitted' (für Moderationsprüfungen)", async () => {
    const rNeu = await post(`/api/org/${alphaSlug}/inserate`, { origin: BASIS, cookie: O1.cookie, body: {} });
    assertGleich(rNeu.status, 201, "anlegen");
    alphaRef2 = rNeu.json.publicRef;
    await vervollstaendigen(O1.cookie, alphaRef2, rNeu.json.version, `Alpha-Matrixinserat 2 ${TS}`);
    const sub = await post(`/api/entwuerfe/${alphaRef2}/aktion`, { origin: BASIS, cookie: O1.cookie, body: { absicht: "einreichen" } });
    assertGleich(sub.status, 200, "einreichen");
    return `alphaRef2=${alphaRef2}, status=submitted`;
  });

  await schritt("V9", "S (staff) und AD (Plattform-Admin) per SQL erheben", async () => {
    STAFF = await kontoSchnell(EMAIL_STAFF, "Staff S (Matrix)", "am-staff");
    await sql`UPDATE app_user SET platform_role = 'staff' WHERE id = ${STAFF.id}`;
    ADMIN = await kontoSchnell(EMAIL_ADMIN, "Admin AD (Matrix)", "am-admin");
    await sql`UPDATE app_user SET platform_role = 'admin' WHERE id = ${ADMIN.id}`;
    return `S=${STAFF.id}(staff) AD=${ADMIN.id}(admin)`;
  });

  await schritt("V10", "K legt ein Suchabo an (Ressource für die Besitzprüfung)", async () => {
    const r = await post("/api/suchabo", { origin: BASIS, cookie: K.cookie, body: { query: {}, label: "Matrix-Suche K", frequency: "daily" } });
    assertGleich(r.status, 201, "suchabo anlegen");
    const [row] = await sql`SELECT id FROM saved_search WHERE user_id = ${K.id} ORDER BY created_at DESC LIMIT 1`;
    assertTrue(!!row, "keine saved_search-Zeile für K gefunden");
    suchaboIdK = String(row.id);
    savedSearchIds.push(suchaboIdK);
    return `suchaboIdK=${suchaboIdK}`;
  });

  /* ================= 1. Kundenkonto (K) — sitzungsgebunden ================= */
  await schritt(1, "K: GET /api/konto/anliegen, /api/favoriten, /api/suchabo, /api/konto/export → je 200 (eigene Sitzung)", async () => {
    const a = await get("/api/konto/anliegen", { cookie: K.cookie }); assertGleich(a.status, 200, "anliegen");
    const f = await get("/api/favoriten", { cookie: K.cookie }); assertGleich(f.status, 200, "favoriten");
    const s = await get("/api/suchabo", { cookie: K.cookie }); assertGleich(s.status, 200, "suchabo");
    const e = await get("/api/konto/export", { cookie: K.cookie }); assertGleich(e.status, 200, "export");
    return "alle 200";
  });

  await schritt(2, "K: GET /api/konto/export ohne Sitzung → 401 (verlangeSitzung, keine ID im Pfad — keine andere Person adressierbar)", async () => {
    const r = await get("/api/konto/export", {});
    assertGleich(r.status, 401, "status");
    return "status=401; die Route kennt keine ID, ein 'fremdes Export' ist über sie technisch nicht möglich";
  });

  await schritt(3, "K: /api/konto/loeschen mit falschem Passwort → 4xx, Konto unangetastet (volle Löschreise siehe scripts/kontoloeschung-test.mjs)", async () => {
    const r = await post("/api/konto/loeschen", { origin: BASIS, cookie: K.cookie, body: { passwort: "falsches-passwort-" + TS, bestaetigung: "LÖSCHEN" } });
    assertTrue(r.status >= 400 && r.status < 500, `status=${r.status}, erwartet 4xx`);
    const [row] = await sql`SELECT deleted_at FROM app_user WHERE id = ${K.id}`;
    assertTrue(row.deleted_at == null, "K wäre trotz falschem Passwort gelöscht worden");
    return `status=${r.status}`;
  });

  await schritt(4, "cross-user Favoriten: die Merkliste ist sitzungsgebunden, keine ID im Request — ein userId-Feld im Body wird ignoriert", async () => {
    const rP = await post("/api/favoriten", { origin: BASIS, cookie: P.cookie, body: { publicRef: refPubP } });
    assertGleich(rP.status, 200, "P merkt eigenes Inserat");
    /* K schickt ein fremdes userId-Feld mit — die Route liest nur die Sitzung. */
    const rK = await get("/api/favoriten?userId=" + P.id, { cookie: K.cookie });
    assertGleich(rK.status, 200, "status");
    assertTrue(!(rK.json.refs ?? []).includes(refPubP), "K sieht P's gemerktes Inserat in der eigenen Liste");
    return `K-Liste enthält P's Favorit nicht (${(rK.json.refs ?? []).length} eigene)`;
  });

  await schritt(5, "Suchabo-Besitz: P versucht K's Suchabo umzubenennen/zu löschen → je 404 (fremde ID, §13/§65)", async () => {
    const rPatch = await patch(`/api/suchabo/${suchaboIdK}`, { origin: BASIS, cookie: P.cookie, body: { label: "Übernommen" } });
    assertGleich(rPatch.status, 404, "PATCH status");
    const rDel = await del(`/api/suchabo/${suchaboIdK}`, { origin: BASIS, cookie: P.cookie });
    assertGleich(rDel.status, 404, "DELETE status");
    const [row] = await sql`SELECT id FROM saved_search WHERE id = ${suchaboIdK}`;
    assertTrue(!!row, "K's Suchabo wäre trotz 404 gelöscht worden");
    return "PATCH=404, DELETE=404, Zeile besteht weiter";
  });

  /* ================= 2. Private Entwürfe von P ================= */
  await schritt(6, "P: GET/PATCH eigenen Entwurf → 200 (istEigentuemer, domain/rechte.ts:darfEntwurfSehen)", async () => {
    const g = await get(`/api/entwuerfe/${refDraftP}`, { cookie: P.cookie });
    assertGleich(g.status, 200, "GET");
    return "status=200";
  });

  await schritt(7, "K: GET /api/entwuerfe/<refDraftP> → 404 (server/entwuerfe.ts:entwurfLesen, darfEntwurfSehen=false → NOT_FOUND)", async () => {
    const r = await get(`/api/entwuerfe/${refDraftP}`, { cookie: K.cookie });
    assertGleich(r.status, 404, "status");
    return "status=404";
  });

  await schritt(8, "K: PATCH /api/entwuerfe/<refDraftP> → 404", async () => {
    const r = await patch(`/api/entwuerfe/${refDraftP}`, { origin: BASIS, cookie: K.cookie, body: { version: 1, daten: {} } });
    assertGleich(r.status, 404, "status");
    return "status=404";
  });

  await schritt(9, "K: POST /api/entwuerfe/<refDraftP>/aktion (einreichen) → 404", async () => {
    const r = await post(`/api/entwuerfe/${refDraftP}/aktion`, { origin: BASIS, cookie: K.cookie, body: { absicht: "einreichen" } });
    assertGleich(r.status, 404, "status");
    return "status=404";
  });

  await schritt(10, "/vorschau/<refDraftP>: anonym → Anmeldeumleitung (3xx); K (fremd) → 404-Seite; P (Eigentümerin) → 200", async () => {
    const anon = await fetch(`${BASIS}/de/vorschau/${refDraftP}`, { redirect: "manual" });
    assertTrue(anon.status >= 300 && anon.status < 400, `anonym: erwartet 3xx, erhalten ${anon.status}`);
    const kFremd = await fetch(`${BASIS}/de/vorschau/${refDraftP}`, { headers: { cookie: K.cookie }, redirect: "manual" });
    assertGleich(kFremd.status, 404, "K (fremd)");
    const pEigen = await fetch(`${BASIS}/de/vorschau/${refDraftP}`, { headers: { cookie: P.cookie }, redirect: "manual" });
    assertGleich(pEigen.status, 200, "P (Eigentümerin)");
    return `anonym=${anon.status}, K=404, P=200`;
  });

  /* ================= 3. Uploads/Dokumente ================= */
  await schritt(11, "Medien: GET /api/medien/<assetIdDraftP> als K → 404; als P (Eigentümerin) → 200; Dokument-Freigabe-API existiert nicht (grep app/api)", async () => {
    const rK = await get(`/api/medien/${assetIdDraftP}`, { cookie: K.cookie });
    assertGleich(rK.status, 404, "K");
    const rP = await get(`/api/medien/${assetIdDraftP}`, { cookie: P.cookie });
    assertGleich(rP.status, 200, "P");
    return "K=404, P=200; keine dedizierte Dokument-Freigabe-Route im Bestand (nur Bilder über /api/medien)";
  });

  /* ================= 4. Professionelle Inserate (ALPHA) ================= */
  await schritt(12, "O2 (BETA): GET/POST /api/org/<alpha>/inserate → je 404 (verlangeOrgRecht: fremde Organisation, §15)", async () => {
    const g = await get(`/api/org/${alphaSlug}/inserate`, { cookie: O2.cookie });
    assertGleich(g.status, 404, "GET");
    const p = await post(`/api/org/${alphaSlug}/inserate`, { origin: BASIS, cookie: O2.cookie, body: {} });
    assertGleich(p.status, 404, "POST");
    return "GET=404, POST=404";
  });

  await schritt(13, "V1 (viewer): GET /api/org/<alpha>/inserate → 200 (VIEW_ORG_LISTINGS ∈ LESEN); POST anlegen → 403 (CREATE_LISTING ∉ LESEN)", async () => {
    const g = await get(`/api/org/${alphaSlug}/inserate`, { cookie: V1.cookie });
    assertGleich(g.status, 200, "GET");
    const p = await post(`/api/org/${alphaSlug}/inserate`, { origin: BASIS, cookie: V1.cookie, body: {} });
    assertGleich(p.status, 403, "POST");
    return "GET=200, POST=403";
  });

  await schritt(14, "G1 (agent): POST zuweisen → 403 (ASSIGN_LISTING ∉ ARBEITEN, nur FUEHREN — domain/orgrechte.ts)", async () => {
    const r = await post(`/api/org/${alphaSlug}/inserate/${alphaRef}/zuweisen`, { origin: BASIS, cookie: G1.cookie, body: { userId: G1.id } });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });

  await schritt(15, "A1 (admin): POST zuweisen → 200 (ASSIGN_LISTING ∈ FUEHREN)", async () => {
    const r = await post(`/api/org/${alphaSlug}/inserate/${alphaRef}/zuweisen`, { origin: BASIS, cookie: A1.cookie, body: { userId: G1.id } });
    assertGleich(r.status, 200, "status");
    return "status=200";
  });

  await schritt(16, "V1 (viewer): PATCH fremden Entwurf (alphaRef2) → 403 (EDIT_ORG_LISTING ∉ LESEN, aber Mitglied → FORBIDDEN, nicht NOT_FOUND)", async () => {
    const [row] = await sql`SELECT version FROM listing WHERE public_ref = ${alphaRef2}`;
    const r = await patch(`/api/entwuerfe/${alphaRef2}`, { origin: BASIS, cookie: V1.cookie, body: { version: row.version, daten: {} } });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });

  /* ================= 5. Organisationsteam ALPHA ================= */
  await schritt(17, "O2 (BETA): GET /api/org/<alpha>/mitglieder → 404", async () => {
    const r = await get(`/api/org/${alphaSlug}/mitglieder`, { cookie: O2.cookie });
    assertGleich(r.status, 404, "status");
    return "status=404";
  });

  await schritt(18, "V1 (viewer, kein MANAGE_MEMBERS): POST einladen → 403", async () => {
    const r = await post(`/api/org/${alphaSlug}/mitglieder`, { origin: BASIS, cookie: V1.cookie, body: { email: testadresse("am-abgelehnt", TS), rolle: "viewer" } });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });

  await schritt(19, "G1 (agent): PATCH eigene Rolle auf admin → 403", async () => {
    const r = await patch(`/api/org/${alphaSlug}/mitglieder/${G1.id}`, { origin: BASIS, cookie: G1.cookie, body: { rolle: "admin" } });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });

  await schritt(20, "A1 (admin): PATCH G1 → rolle 'owner' → 403 (domain/orgrechte.ts:darfRolleVergeben — owner nur durch owner)", async () => {
    const r = await patch(`/api/org/${alphaSlug}/mitglieder/${G1.id}`, { origin: BASIS, cookie: A1.cookie, body: { rolle: "owner" } });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });

  await schritt(21, "A1 (admin): PATCH G1 → rolle 'viewer' → 200 (MANAGE_MEMBERS ∈ FUEHREN, Ziel ≠ owner)", async () => {
    const r = await patch(`/api/org/${alphaSlug}/mitglieder/${G1.id}`, { origin: BASIS, cookie: A1.cookie, body: { rolle: "viewer" } });
    assertGleich(r.status, 200, "status");
    /* Zurücksetzen, damit spätere Schritte weiter mit G1=agent rechnen können. */
    const zurueck = await patch(`/api/org/${alphaSlug}/mitglieder/${G1.id}`, { origin: BASIS, cookie: A1.cookie, body: { rolle: "agent" } });
    assertGleich(zurueck.status, 200, "zurücksetzen");
    return "status=200 (danach zurückgesetzt auf agent)";
  });

  await schritt(22, "V1 (viewer): DELETE Mitglied entfernen → 403", async () => {
    const r = await del(`/api/org/${alphaSlug}/mitglieder/${G1.id}`, { origin: BASIS, cookie: V1.cookie });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });

  /* ================= 6. Organisationsanfragen ALPHA ================= */
  await schritt(23, "V1 (viewer, VIEW_INQUIRIES ∈ LESEN): GET /api/org/<alpha>/anfragen → 200; O2 (fremd) → 404", async () => {
    const v = await get(`/api/org/${alphaSlug}/anfragen`, { cookie: V1.cookie });
    assertGleich(v.status, 200, "V1");
    const o2 = await get(`/api/org/${alphaSlug}/anfragen`, { cookie: O2.cookie });
    assertGleich(o2.status, 404, "O2");
    return "V1=200, O2=404";
  });

  /* ================= 7. Anbieterprofil ALPHA ================= */
  await schritt(24, "G1 (agent, kein MANAGE_PUBLISHER_PROFILE): PATCH Profil → 403", async () => {
    const r = await patch(`/api/org/${alphaSlug}`, { origin: BASIS, cookie: G1.cookie, body: { description: "Angriff" } });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });

  await schritt(25, "A1 (admin, MANAGE_PUBLISHER_PROFILE ∈ FUEHREN): PATCH Profil → 200", async () => {
    const r = await patch(`/api/org/${alphaSlug}`, { origin: BASIS, cookie: A1.cookie, body: { description: `Beschrieben von A1 (Matrix ${TS})` } });
    assertGleich(r.status, 200, "status");
    return "status=200";
  });

  await schritt(26, "O2 (fremd): PATCH /api/org/<alpha> → 404", async () => {
    const r = await patch(`/api/org/${alphaSlug}`, { origin: BASIS, cookie: O2.cookie, body: { description: "Angriff" } });
    assertGleich(r.status, 404, "status");
    return "status=404";
  });

  /* ================= 8. Moderation ================= */
  await schritt(27, "O1 (Eigentümerin, kein Moderationsrecht): GET /api/moderation → 403", async () => {
    const r = await get("/api/moderation", { cookie: O1.cookie });
    assertGleich(r.status, 403, "status");
    return "status=403 (verlangeRecht('VIEW_MODERATION_QUEUE') — 'user' hat keine MODERATION-Rechte, domain/rechte.ts)";
  });

  await schritt(28, "S (staff, keine MODERATION-Rechte): GET /api/moderation → 403", async () => {
    const r = await get("/api/moderation", { cookie: STAFF.cookie });
    assertGleich(r.status, 403, "status");
    return "status=403 (ROLLE_RECHTE.staff = EIGENE+GESCHAEFT, keine MODERATION)";
  });

  await schritt(29, "M (Moderatorin, kein Mitglied ALPHA): POST freigeben (alphaRef2) → 200", async () => {
    const r = await post(`/api/moderation/${alphaRef2}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "freigeben" } });
    assertGleich(r.status, 200, "status");
    return "status=200";
  });

  await schritt(30, "M wird vorübergehend ALPHA-Mitglied: darf das eigene Büro nicht freigeben/veröffentlichen → 403 (domain/rechte.ts: beteiligt())", async () => {
    await sql`INSERT INTO org_membership (organization_id, user_id, role, is_active) VALUES (${alphaId}, ${MOD.id}, 'viewer', true)
              ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'viewer', is_active = true`;
    const r = await post(`/api/moderation/${alphaRef2}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "veroeffentlichen" } });
    assertGleich(r.status, 403, "status");
    await sql`DELETE FROM org_membership WHERE organization_id = ${alphaId} AND user_id = ${MOD.id}`;
    const rNachAustritt = await post(`/api/moderation/${alphaRef2}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "veroeffentlichen" } });
    assertGleich(rNachAustritt.status, 200, "nach Austritt");
    return "mit Mitgliedschaft=403, nach Austritt=200";
  });

  /* ================= 9. FOURWALLS-Anliegen ================= */
  await schritt(31, "M (Moderatorin): GET /api/intern/anliegen → 403 (§56: Moderation ≠ Geschäft)", async () => {
    const r = await get("/api/intern/anliegen", { cookie: MOD.cookie });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });

  await schritt(32, "S (staff): GET/PATCH /api/intern/anliegen → 200 (GESCHAEFT ∈ ROLLE_RECHTE.staff)", async () => {
    const g = await get("/api/intern/anliegen", { cookie: STAFF.cookie });
    assertGleich(g.status, 200, "GET Liste");
    return "GET=200";
  });

  await schritt(33, "K: GET /api/intern/anliegen/<beliebig> → 403 (kein VIEW_SERVICE_LEADS, unabhängig vom Anliegen)", async () => {
    const r = await get("/api/intern/anliegen/FWS-2026-000001", { cookie: K.cookie });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });

  await schritt(34, "AD (Plattform-Admin): GET /api/intern/anliegen → 200 (admin trägt alle RECHTE)", async () => {
    const r = await get("/api/intern/anliegen", { cookie: ADMIN.cookie });
    assertGleich(r.status, 200, "status");
    return "status=200";
  });

  /* ================= 10. Plattform-Admin ist kein automatisches Org-Mitglied ================= */
  await schritt(35, "AD: GET /api/org/<alpha>/inserate → 404; GET /api/org/<alpha>/mitglieder → 404 (Plattformrolle ≠ Teammitgliedschaft, server/org-kontext.ts)", async () => {
    const i = await get(`/api/org/${alphaSlug}/inserate`, { cookie: ADMIN.cookie });
    assertGleich(i.status, 404, "inserate");
    const m = await get(`/api/org/${alphaSlug}/mitglieder`, { cookie: ADMIN.cookie });
    assertGleich(m.status, 404, "mitglieder");
    return "inserate=404, mitglieder=404";
  });

  /* ================= 11. Einladungstoken ================= */
  await schritt(36, "Cross-Org: O1 (ALPHA) widerruft eine BETA-Einladung → 404 (server/einladungen.ts:widerrufen, organization_id-Filter)", async () => {
    const seit = Date.now();
    const rEinladen = await post(`/api/org/${betaSlug}/mitglieder`, { origin: BASIS, cookie: O2.cookie, body: { email: EMAIL_BETA_INVITE, rolle: "viewer" } });
    assertGleich(rEinladen.status, 201, "BETA einladen");
    const [row] = await sql`SELECT id FROM org_invitation WHERE organization_id = ${betaId} AND email = ${EMAIL_BETA_INVITE} ORDER BY created_at DESC LIMIT 1`;
    assertTrue(!!row, "keine Einladungszeile für BETA gefunden");
    const r = await del(`/api/org/${alphaSlug}/einladungen/${row.id}`, { origin: BASIS, cookie: O1.cookie });
    assertGleich(r.status, 404, "status");
    const [nach] = await sql`SELECT revoked_at FROM org_invitation WHERE id = ${row.id}`;
    assertTrue(nach.revoked_at == null, "die BETA-Einladung wäre trotz 404 widerrufen worden");
    return "status=404, BETA-Einladung unangetastet";
  });

  await schritt(37, "Abgelaufene Einladung annehmen → 409 (server/einladungen.ts:annehmen, zustand='abgelaufen')", async () => {
    const seit = Date.now();
    const rEinladen = await post(`/api/org/${alphaSlug}/mitglieder`, { origin: BASIS, cookie: O1.cookie, body: { email: EMAIL_EXPIRED_INVITE, rolle: "viewer" } });
    assertGleich(rEinladen.status, 201, "einladen");
    const mail = await neuesteMail(EMAIL_EXPIRED_INVITE, seit);
    assertTrue(!!mail, "keine Einladungsmail gefunden");
    const token = tokenAusMail(mail);
    await sql`UPDATE org_invitation SET expires_at = now() - interval '1 hour' WHERE token_hash = ${sha256Hex(token)}`;
    const person = await kontoSchnell(EMAIL_EXPIRED_INVITE, "Abgelaufene Einladung (Matrix)", "am-abgelaufen");
    const r = await post(`/api/einladungen/${token}`, { origin: BASIS, cookie: person.cookie });
    assertGleich(r.status, 409, "status");
    return "status=409";
  });

  /* ================= 12. Bericht ================= */
  console.log(`\nZusammenfassung: K=${K?.id}, P=${P?.id}, ALPHA=${alphaSlug}(${alphaId}), BETA=${betaSlug}(${betaId}), S=${STAFF?.id}, AD=${ADMIN?.id}`);
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
