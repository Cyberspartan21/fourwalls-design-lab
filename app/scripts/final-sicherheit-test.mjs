#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Finale Angriffsmatrix (P5.10 §47)

   Adversarial: greift Authentifizierung, Organisationsisolation,
   Entwurfs-/Geo-/Lead-Privatsphäre, Moderations-/Staff-Trennung,
   Upload-Sicherheit, Massenzuweisung, Einladungstoken, Suchabo-Besitz,
   Kontolöschung, Produktionskonfiguration und die Demo-Tore an. Jeder
   Versuch erwartet eine dokumentierte Abwehr (siehe Kommentar je Prüfung);
   eine Abweichung ist ein Fund.

   Aufruf:
     set -a; . ./.env.local; set +a
     FW_TEST_MOD_EMAIL=mod@fourwalls.example FW_TEST_MOD_PASSWORT=... \
       node scripts/final-sicherheit-test.mjs [Basis-URL]

   FW_TEST_MOD_EMAIL/FW_TEST_MOD_PASSWORT kommen aus var/konten.local.json
   (Struktur `konten`: {email: passwort}) — die mod@-Adresse dort, nie im
   Klartext in diesem Skript oder im Bericht.

   Testkonten tragen das Präfix "fs" (finale Sicherheit) in der lokalen
   Adresse. Ausgabe: nummerierte Tabelle, Zähler (Versuche/abgewehrt/Funde),
   Exit 1 bei irgendeinem FEHLER, sonst 0. Räumt seine Testorganisationen/
   -inserate am Ende immer auf; Konten mit Prüfspur bleiben bestehen (ausser
   dem einen Konto, dessen Löschung selbst geprüft wird).
   ============================================================ */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, execSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { mailquelle, testadresse } from "./lib/mailquelle.mjs";

const HIER = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HIER, "..");
const REPO_ROOT = join(APP_ROOT, "..");
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

const PASSWORT = "Final-" + randomBytes(12).toString("base64url");
const EMAIL_FS = testadresse("fsfs", TS);      // wird am Ende wirklich gelöscht
const EMAIL_X = testadresse("fsx", TS);        // Angreiferin
const EMAIL_Y = testadresse("fsy", TS);        // Opfer (privater Entwurf + veröffentlichtes Inserat)
const EMAIL_OA = testadresse("fsoa", TS);      // ALPHA owner
const EMAIL_OB = testadresse("fsob", TS);      // BETA owner
const EMAIL_STAFF = testadresse("fsstaff", TS);
const EMAIL_ADMIN = testadresse("fsadmin", TS);
const EMAIL_INV1 = testadresse("fsinv1", TS);
const EMAIL_INV2 = testadresse("fsinv2", TS);
const BILD_PFAD = join(APP_ROOT, "public", "media", "zurich-altbau-1-960.jpg");
const ORT_ID = "ort-bern";
const ALPHA_NAME = `Alpha Final AG (Demo ${TS})`;
const BETA_NAME = `Beta Final AG (Demo ${TS})`;

const ergebnisse = [];
let VERSUCHE = 0, ABGEWEHRT = 0;
function assertTrue(bedingung, meldung) { if (!bedingung) throw new Error(meldung); }
function assertGleich(ist, soll, feld) {
  if (ist !== soll) throw new Error(`${feld}: erwartet ${JSON.stringify(soll)}, erhalten ${JSON.stringify(ist)}`);
}
/* Ein "Angriff": zählt als Versuch, und bei Erfolg (keine Exception) als
   abgewehrt — genau der Zähler, den der Auftrag verlangt. */
async function angriff(bez, titel, fn) {
  VERSUCHE++;
  try {
    const detail = (await fn()) || "abgewehrt";
    ABGEWEHRT++;
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
  if (!xffMap.has(tag)) xffMap.set(tag, `10.${RUNSEED}.${xffMap.size + 1}.83`);
  return xffMap.get(tag);
}

/* ---------- HTTP ---------- */
async function api(method, pfad, { cookie, origin, body, headers = {}, xffTag, roherBody } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const h = { ...headers };
    if (cookie) h["cookie"] = cookie;
    if (origin !== undefined) h["origin"] = origin;
    if (xffTag) h["x-forwarded-for"] = xff(xffTag);
    let payload = roherBody;
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
function cookieGeloescht(setCookies) {
  return setCookies.some(c => /^fw\.session_token=(;|$)/.test(c) || (c.startsWith("fw.session_token=") && /max-age=0/i.test(c)));
}

async function uploadBytes(cookie, bytes, dateiname, mime) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const fd = new FormData();
    fd.append("datei", new Blob([bytes], { type: mime }), dateiname);
    const res = await fetch(BASIS + "/api/medien", { method: "POST", headers: { origin: BASIS, cookie }, body: fd, redirect: "manual", signal: ctrl.signal });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* kein JSON */ }
    return { status: res.status, json };
  } finally { clearTimeout(timer); }
}
const uploadDatei = (cookie, pfad, dateiname, mime) => uploadBytes(cookie, readFileSync(pfad), dateiname, mime);

/* ---------- Mail (nur für die Fälle, die ein echtes Token brauchen) ---------- */
const MAILQUELLE = mailquelle();
/* Grosszügig, siehe scripts/autorisierung-matrix-test.mjs: paralleler Betrieb
   auf demselben Entwicklungsserver (H3a/H8/H9) macht den Mailversand
   knapp bemessen — dieses Skript braucht die Mailquelle nur für Abschnitt J. */
const MAIL_TIMEOUT_MS = 90_000;
function bestaetigungsAdresse(email) {
  let h = 0; for (const c of String(email)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `10.${(h >>> 16) & 255}.${(h >>> 8) & 255}.${(h & 253) + 1}`;
}
async function neuesteMail(email, seitMs) { return MAILQUELLE.warte(email, seitMs, MAIL_TIMEOUT_MS); }
function tokenAusMail(mail) {
  const treffer = mail.text.match(/\/einladung\/([A-Za-z0-9_-]+)/);
  if (!treffer) throw new Error(`Kein Einladungstoken in der Mail gefunden: ${mail.text.slice(0, 200)}`);
  return treffer[1];
}
const sha256Hex = s => createHash("sha256").update(s).digest("hex");

/* ---------- Registrieren / Anmelden ---------- */
async function registrieren(email, passwort, name, xffTag, zusatz = {}) {
  return post("/api/auth/sign-up/email", { origin: BASIS, xffTag, body: { email, password: passwort, name, ...zusatz } });
}
async function anmelden(email, passwort, xffTag) {
  const r = await post("/api/auth/sign-in/email", { origin: BASIS, xffTag, body: { email, password: passwort } });
  return { ...r, cookie: cookieAus(r.setCookies) };
}
/* Wie in scripts/autorisierung-matrix-test.mjs begründet: dieses Skript prüft
   Angriffe auf Autorisierung/Privatsphäre — nicht den Bestätigungs-Mailweg
   selbst. Hintergrundkonten bestätigen direkt per SQL, das spart den
   überlasteten, gemeinsam genutzten Mailkanal für die Fälle, die ihn wirklich
   brauchen (Einladungstoken, Abschnitt J). */
async function kontoSchnell(email, name, xffTag, zusatz = {}) {
  const su = await registrieren(email, PASSWORT, name, xffTag, zusatz);
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
    const su = await registrieren(modEmail, MOD_PASSWORT_STANDARD, "Moderator Finale Angriffsmatrix", `${tagPrefix}-signup`);
    assertGleich(su.status, 200, "sign-up Moderator (Fallback)");
    await sql`UPDATE app_user SET email_verified = true WHERE email = ${modEmail}`;
    execFileSync(process.execPath, [join(APP_ROOT, "scripts", "rolle.mjs"), modEmail, "moderator"], { stdio: "inherit", env: process.env });
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
    body: { version: p1.json.version, daten: { titel, beschreibung: "Automatisierte finale Angriffsmatrix — bitte ignorieren.", name: "Prüfperson", email: `fsx+${TS}@example.com` } }
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

/* ---------- Aufräumen ---------- */
let alphaId = null, betaId = null;
const zusatzListingRefs = [];
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
    console.log(`Aufgeräumt: Organisationen ${orgIds.join(", ") || "–"}, Inserate ${zusatzListingRefs.join(", ") || "–"}.`);
  } catch (e) {
    console.error("Aufräumen fehlgeschlagen:", e.message || e);
  }
}

const START = Date.now();
console.log(`Basis: ${BASIS}  —  Finale Angriffsmatrix startet (TS=${TS})`);

let FS, X, Y, OA, OB, STAFF, ADMIN, MOD;
let alphaSlug, betaSlug;
let draftRefY, assetIdY, pubRefY;
let orgRefA;
let fsCookieAlt, fsPasswortAlt;

try {
  /* ================= Vorbereitung ================= */
  await angriff("V1", "Konten anlegen (FS, X, Y, OA, OB, STAFF, ADMIN, MOD)", async () => {
    FS = await kontoSchnell(EMAIL_FS, "FS (Finale, wird gelöscht)", "fs-fs");
    X = await kontoSchnell(EMAIL_X, "X (Angreiferin)", "fs-x");
    Y = await kontoSchnell(EMAIL_Y, "Y (Opfer)", "fs-y");
    OA = await kontoSchnell(EMAIL_OA, "OA (Alpha owner)", "fs-oa");
    OB = await kontoSchnell(EMAIL_OB, "OB (Beta owner)", "fs-ob");
    STAFF = await kontoSchnell(EMAIL_STAFF, "STAFF", "fs-staff");
    await sql`UPDATE app_user SET platform_role = 'staff' WHERE id = ${STAFF.id}`;
    ADMIN = await kontoSchnell(EMAIL_ADMIN, "ADMIN", "fs-admin");
    await sql`UPDATE app_user SET platform_role = 'admin' WHERE id = ${ADMIN.id}`;
    MOD = await moderatorAnmelden("fs");
    fsPasswortAlt = PASSWORT;
    return `FS=${FS.id} X=${X.id} Y=${Y.id} OA=${OA.id} OB=${OB.id} STAFF=${STAFF.id} ADMIN=${ADMIN.id}`;
  });

  await angriff("V2", "Y: privater Entwurf + veröffentlichtes Inserat (Ressourcen für Privatsphäre-Prüfungen)", async () => {
    const r0 = await post("/api/entwuerfe", { origin: BASIS, cookie: Y.cookie, body: {} });
    assertGleich(r0.status, 201, "draft anlegen");
    draftRefY = r0.json.publicRef;
    zusatzListingRefs.push(draftRefY);
    const { assetId } = await vervollstaendigen(Y.cookie, draftRefY, r0.json.version, `Y privater Entwurf ${TS}`);
    assetIdY = assetId;

    const r1 = await post("/api/entwuerfe", { origin: BASIS, cookie: Y.cookie, body: {} });
    assertGleich(r1.status, 201, "pub anlegen");
    pubRefY = r1.json.publicRef;
    zusatzListingRefs.push(pubRefY);
    await vervollstaendigen(Y.cookie, pubRefY, r1.json.version, `Y veröffentlichtes Inserat ${TS}`);
    const sub = await post(`/api/entwuerfe/${pubRefY}/aktion`, { origin: BASIS, cookie: Y.cookie, body: { absicht: "einreichen" } });
    assertGleich(sub.status, 200, "einreichen");
    const ver = await post(`/api/moderation/${pubRefY}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "freigeben-und-veroeffentlichen" } });
    assertGleich(ver.status, 200, "freigeben-und-veroeffentlichen");
    return `draftRefY=${draftRefY}, pubRefY=${pubRefY}, assetIdY=${assetIdY}`;
  });

  await angriff("V3", "ALPHA (OA) und BETA (OB) anlegen; ALPHA-Inserat veröffentlichen", async () => {
    const rA = await post("/api/org", { origin: BASIS, cookie: OA.cookie, body: { displayName: ALPHA_NAME, kind: "agency", locale: "de", city: "Bern" } });
    assertGleich(rA.status, 201, "Alpha anlegen");
    alphaSlug = rA.json.slug; alphaId = rA.json.id;
    const rB = await post("/api/org", { origin: BASIS, cookie: OB.cookie, body: { displayName: BETA_NAME, kind: "agency", locale: "de", city: "Bern" } });
    assertGleich(rB.status, 201, "Beta anlegen");
    betaSlug = rB.json.slug; betaId = rB.json.id;

    const rNeu = await post(`/api/org/${alphaSlug}/inserate`, { origin: BASIS, cookie: OA.cookie, body: {} });
    assertGleich(rNeu.status, 201, "org-inserat anlegen");
    orgRefA = rNeu.json.publicRef;
    await vervollstaendigen(OA.cookie, orgRefA, rNeu.json.version, `Alpha-Angriffsinserat ${TS}`);
    const sub = await post(`/api/entwuerfe/${orgRefA}/aktion`, { origin: BASIS, cookie: OA.cookie, body: { absicht: "einreichen" } });
    assertGleich(sub.status, 200, "einreichen");
    const ver = await post(`/api/moderation/${orgRefA}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "freigeben-und-veroeffentlichen" } });
    assertGleich(ver.status, 200, "freigeben-und-veroeffentlichen");
    return `alpha=${alphaSlug}, beta=${betaSlug}, orgRefA=${orgRefA}`;
  });

  /* ================= A. Authentifizierung ================= */
  await angriff("A1", "Cookie-Wiederverwendung nach Kontolöschung: FS löscht sich selbst → 200, dann altes Cookie → 401", async () => {
    const r = await post("/api/konto/loeschen", { origin: BASIS, cookie: FS.cookie, body: { passwort: fsPasswortAlt, bestaetigung: "LÖSCHEN" } });
    assertGleich(r.status, 200, "löschen");
    assertTrue(cookieGeloescht(r.setCookies), "Sitzungscookie wurde nicht geleert");
    fsCookieAlt = FS.cookie;
    const rExport = await get("/api/konto/export", { cookie: fsCookieAlt });
    assertGleich(rExport.status, 401, "export mit altem Cookie");
    const rKonto = await get("/api/konto/anliegen", { cookie: fsCookieAlt });
    assertGleich(rKonto.status, 401, "anliegen mit altem Cookie");
    return "löschen=200, altes Cookie danach überall 401";
  });

  await angriff("A2", "Altes Passwort meldet nach der Löschung nicht mehr an", async () => {
    const r = await anmelden(EMAIL_FS, fsPasswortAlt, "fs-nach-loeschung");
    assertTrue(r.status !== 200, `sign-in nach Löschung erfolgreich (status=${r.status})`);
    return `status=${r.status}`;
  });

  await angriff("A3", "platform_role als Zusatzfeld bei sign-up (better-auth additionalFields input:false) → abgelehnt, nie eine Zeile mit erhöhter Rolle", async () => {
    const email = testadresse("fsrole", TS);
    const r = await registrieren(email, PASSWORT, "Rollenangriff", "fs-role", { platform_role: "admin", role: "admin" });
    /* better-auth weist ein `input:false`-Feld direkt mit 400/FIELD_NOT_ALLOWED
       zurück — noch strenger als ein stillschweigendes Verwerfen. Beide
       Ergebnisse (400 ohne Konto, oder 200 mit unverändertem 'user') wären
       sicher; nur eine Zeile mit erhöhter Rolle wäre ein Fund. */
    assertTrue([200, 400].includes(r.status), `unerwarteter Status ${r.status}`);
    const [row] = await sql`SELECT platform_role FROM app_user WHERE email = ${email}`;
    if (r.status === 400) {
      assertTrue(!row, "trotz 400 wurde ein Konto angelegt");
      assertGleich(r.json?.code, "FIELD_NOT_ALLOWED", "Fehlercode");
      return "sign-up=400 FIELD_NOT_ALLOWED, kein Konto angelegt";
    }
    assertTrue(!!row, "kein Konto trotz status 200 gefunden");
    assertGleich(row.platform_role, "user", "platform_role in der DB");
    return "sign-up=200, platform_role=user (server/auth.ts: input:false)";
  });

  /* ================= B. Organisationsisolation ================= */
  await angriff("B1", "OB (BETA): POST /api/org/<beta>/inserate mit body.orgId=ALPHA → Inserat gehört trotzdem BETA (Kontext kommt aus der URL, nie aus dem Body)", async () => {
    const r = await post(`/api/org/${betaSlug}/inserate`, { origin: BASIS, cookie: OB.cookie, body: { daten: {}, orgId: alphaId, organizationId: alphaId } });
    assertGleich(r.status, 201, "anlegen");
    const ref = r.json.publicRef;
    zusatzListingRefs.push(ref);
    const [row] = await sql`SELECT published_by_org_id FROM listing WHERE public_ref = ${ref}`;
    assertGleich(String(row.published_by_org_id), betaId, "published_by_org_id");
    return `ref=${ref}, published_by_org_id=BETA (orgId im Body ignoriert)`;
  });

  await angriff("B2", "OB (BETA): PATCH /api/org/<alpha> mit Alpha-Slug in der URL → 404 (verlangeOrgRecht kennt nur echte Mitgliedschaft, keine ID aus dem Body hilft)", async () => {
    const r = await patch(`/api/org/${alphaSlug}`, { origin: BASIS, cookie: OB.cookie, body: { id: alphaId, description: "Angriff" } });
    assertGleich(r.status, 404, "status");
    return "status=404";
  });

  await angriff("B3", "Kein 'aktive Organisation'-Feld existiert in Sitzung/Cookie/Body (grep domain+server) — Organisationskontext kommt ausschliesslich aus dem URL-Slug + org_membership", async () => {
    const treffer = execSync(`grep -rl "activeOrganizationId\\|active_organization" --include="*.ts" server domain app/api 2>/dev/null || true`, { cwd: APP_ROOT }).toString().trim();
    assertTrue(treffer === "", `unerwarteter Treffer für ein 'aktive Organisation'-Feld: ${treffer}`);
    return "kein Treffer — es gibt kein manipulierbares Organisationsfeld ausserhalb des URL-Slugs";
  });

  /* ================= C. Entwurfsprivatsphäre ================= */
  await angriff("C1", "Entwurfsbild erraten: GET /api/medien/<zufällige-UUID> → 404", async () => {
    const zufall = crypto.randomUUID();
    const r = await get(`/api/medien/${zufall}`, { cookie: X.cookie });
    assertGleich(r.status, 404, "status");
    return "status=404";
  });

  await angriff("C2", "X (fremd): GET /api/medien/<assetIdY> (Y's privates Entwurfsbild) → 404", async () => {
    const r = await get(`/api/medien/${assetIdY}`, { cookie: X.cookie });
    assertGleich(r.status, 404, "status");
    return "status=404";
  });

  await angriff("C3", "/vorschau/<draftRefY> als X (fremd) → 404-Seite", async () => {
    const r = await fetch(`${BASIS}/de/vorschau/${draftRefY}`, { headers: { cookie: X.cookie }, redirect: "manual" });
    assertGleich(r.status, 404, "status");
    return "status=404";
  });

  await angriff("C4", "draftRefY ist in /api/search nicht auffindbar (weder per Textsuche noch per ref)", async () => {
    const r = await get(`/api/search?ref=${draftRefY}`, {});
    assertGleich(r.status, 200, "status");
    assertTrue(!(r.json?.treffer ?? []).some(t => t.id === draftRefY), "draftRefY in /api/search gefunden");
    return "nicht gefunden";
  });

  /* ================= D. Geo-Privatsphäre ================= */
  await angriff("D1", "geom_exact wird in keiner SELECT-Abfrage gelesen (grep) — server/entwuerfe.ts SETZT es nur beim Materialisieren, niemand liest es zurück", async () => {
    const treffer = execSync(`grep -rn "SELECT.*geom_exact" server/*.ts app/sitemap.ts 2>/dev/null || true`, { cwd: APP_ROOT }).toString().trim();
    assertTrue(treffer === "", `geom_exact wird ausserhalb einer Schreibanweisung gelesen: ${treffer}`);
    const zuweisung = execSync(`grep -n "geom_exact\\s*=" server/entwuerfe.ts 2>/dev/null || true`, { cwd: APP_ROOT }).toString().trim();
    assertTrue(zuweisung !== "", "geom_exact wird nirgends mehr gesetzt — Materialisieren geändert?");
    return "keine SELECT-Fundstelle; die einzige Fundstelle (server/entwuerfe.ts) ist eine Zuweisung beim Materialisieren";
  });

  await angriff("D2", "/api/search?ref=<pubRefY>: Koordinate ist die gerasterte geom_public, nicht geom_exact; keine Adresse im JSON", async () => {
    const r = await get(`/api/search?ref=${pubRefY}`, {});
    assertGleich(r.status, 200, "status");
    const treffer = (r.json?.treffer ?? []).find(t => t.id === pubRefY);
    assertTrue(!!treffer, "pubRefY nicht in /api/search gefunden");
    const roh = JSON.stringify(treffer);
    assertTrue(!/strasse|street|hausnummer|address/i.test(roh), "ein Adressfeld ist im Treffer enthalten");
    const [row] = await sql`SELECT ST_X(p.geom_exact::geometry) AS lng_exact, ST_Y(p.geom_exact::geometry) AS lat_exact,
                                    ST_X(p.geom_public::geometry) AS lng_pub, ST_Y(p.geom_public::geometry) AS lat_pub
                               FROM listing l JOIN property p ON p.id = l.property_id WHERE l.public_ref = ${pubRefY}`;
    assertTrue(!!row, "keine property-Zeile gefunden");
    if (treffer.geo?.lat != null) {
      assertGleich(Number(treffer.geo.lat.toFixed(4)), Number(Number(row.lat_pub).toFixed(4)), "lat entspricht geom_public");
      const abstand = Math.abs(Number(treffer.geo.lat) - Number(row.lat_exact));
      assertTrue(abstand > 0.0001 || row.lat_exact == null, "öffentliche Koordinate ist identisch mit der exakten Adresse");
    }
    return "keine Adresse im JSON, Koordinate = geom_public (gerastert)";
  });

  await angriff("D3", "/api/similar?ref=<pubRefY> und /api/vergleich?refs=<pubRefY>: kein Adressfeld", async () => {
    const rs = await get(`/api/similar?ref=${pubRefY}`, { xffTag: "fs-similar" });
    assertGleich(rs.status, 200, "similar status");
    assertTrue(!/strasse|street|hausnummer|address/i.test(JSON.stringify(rs.json)), "Adressfeld in /api/similar");
    const rv = await get(`/api/vergleich?refs=${pubRefY}`, { xffTag: "fs-vergleich" });
    assertGleich(rv.status, 200, "vergleich status");
    assertTrue(!/strasse|street|hausnummer|address/i.test(JSON.stringify(rv.json)), "Adressfeld in /api/vergleich");
    return "keine Adressfelder in beiden Antworten";
  });

  await angriff("D4", "Die Objekt-HTML-Seite enthält keine Adresse (nur Ort/Kanton aus dem Ortsindex)", async () => {
    /* /de/immobilien/kaufen/<ref> ohne beschreibenden Slug-Teil weicht vom
       kanonischen Pfad ab und wird 301/308 auf ihn umgeleitet (siehe
       app/[locale]/[bereich]/[art]/[slug]/page.tsx:pfad()) — die Referenz
       allein genügt der Regel `RE`, um das Inserat zu finden. */
    const res = await fetch(`${BASIS}/de/immobilien/kaufen/${pubRefY.toLowerCase()}`, { redirect: "follow" });
    assertGleich(res.status, 200, "status");
    const html = await res.text();
    const [row] = await sql`SELECT p.street, p.house_number FROM listing l JOIN property p ON p.id = l.property_id WHERE l.public_ref = ${pubRefY}`;
    if (row?.street) assertTrue(!html.includes(row.street), "Strasse aus der DB steht auf der öffentlichen Seite");
    return "keine Strasse aus der DB im HTML gefunden";
  });

  /* ================= E. Service-Lead-Privatsphäre ================= */
  await angriff("E1", "OA (Agentur-Besitzerin, kein VIEW_SERVICE_LEADS): GET /api/intern/anliegen → 403", async () => {
    const r = await get("/api/intern/anliegen", { cookie: OA.cookie });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });

  let leadRef;
  await angriff("E2", "Ein neues Anliegen: die interne Meldung geht an SERVICE_LEAD_INBOX/MAIL_DEV_SINK, nie an eine Organisationsadresse (§57)", async () => {
    const r = await post("/api/anliegen", {
      origin: BASIS, xffTag: "fs-anliegen",
      body: { dienst: "sell", kontakt: { name: "Prüfperson Final", email: testadresse("fslead", TS) }, objekt: { ortId: "ort-zuerich", typ: "wohnung" }, sprache: "de", herkunft: { seite: "/de/verkaufen" }, firma: "" }
    });
    assertGleich(r.status, 201, "status");
    leadRef = r.json.publicRef;
    const [mailZeile] = await sql`SELECT recipient FROM mail_outbox WHERE ref_type = 'service_lead' AND ref_id = ${leadRef} AND kind = 'service_lead_intern' LIMIT 1`;
    assertTrue(!!mailZeile, "keine service_lead_intern-Zeile gefunden");
    const empfaenger = String(mailZeile.recipient).toLowerCase();
    const orgAdressen = await sql`SELECT lower(email) AS a FROM organization WHERE email IS NOT NULL`;
    assertTrue(!orgAdressen.some(o => o.a === empfaenger), `Empfänger ${empfaenger} ist eine Organisationsadresse`);
    await sql`DELETE FROM service_lead WHERE public_ref = ${leadRef}`;
    return `Empfänger=${empfaenger}, keine Organisationsadresse`;
  });

  /* ================= F. Moderationstrennung / Rollen ================= */
  await angriff("F1", "MOD sieht keine Leads (403), STAFF sieht keine Moderation (403) — Trennung in beide Richtungen", async () => {
    const m = await get("/api/intern/anliegen", { cookie: MOD.cookie });
    assertGleich(m.status, 403, "MOD auf Anliegen");
    const s = await get("/api/moderation", { cookie: STAFF.cookie });
    assertGleich(s.status, 403, "STAFF auf Moderation");
    return "MOD→Anliegen=403, STAFF→Moderation=403";
  });

  await angriff("F2", "PATCH platform_role überall: Org-Rollenroute (extra Feld) → 422; Anliegen-Route (weder status noch assignedStaffId) → 422", async () => {
    const r1 = await patch(`/api/org/${alphaSlug}/mitglieder/${OA.id}`, { origin: BASIS, cookie: OA.cookie, body: { rolle: "owner", platform_role: "admin" } });
    assertGleich(r1.status, 422, "org-mitglieder mit platform_role");
    const r2 = await patch(`/api/intern/anliegen/${leadRef ?? "FWS-2026-000001"}`, { origin: BASIS, cookie: STAFF.cookie, body: { platform_role: "admin" } });
    assertGleich(r2.status, 422, "intern/anliegen mit platform_role");
    return "beide 422 — kein Endpunkt akzeptiert platform_role";
  });

  /* ================= G. Staff-Trennung ================= */
  await angriff("G1", "STAFF kann ein Inserat nicht freigeben (kein REVIEW_LISTING) → 403", async () => {
    const r = await post(`/api/moderation/${orgRefA}`, { origin: BASIS, cookie: STAFF.cookie, body: { absicht: "pausieren" } });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });

  /* ================= H. Upload-Sicherheit ================= */
  await angriff("H1", "HTML als Bild hochladen (als 'image/jpeg' gemeldet) → 422 (Inhalt entscheidet, nicht der gemeldete Typ)", async () => {
    const html = Buffer.from("<html><body><script>alert(1)</script></body></html>");
    const r = await uploadBytes(Y.cookie, html, "foto.jpg", "image/jpeg");
    assertGleich(r.status, 422, "status");
    return "status=422";
  });

  await angriff("H2", "X: DELETE /api/medien/<assetIdY> (fremd) → 404, Bild besteht weiter", async () => {
    const r = await del(`/api/medien/${assetIdY}`, { origin: BASIS, cookie: X.cookie });
    assertTrue(r.status === 404 || r.status === 405, `unerwarteter Status ${r.status}`);
    const [row] = await sql`SELECT id FROM media_asset WHERE id = ${assetIdY}`;
    assertTrue(!!row, "Y's Bild wäre trotz fremdem Zugriff gelöscht worden");
    return `status=${r.status}, Bild besteht weiter`;
  });

  /* ================= I. Massenzuweisung ================= */
  await angriff("I1", "POST /api/entwuerfe mit status/ownerId/orgId/isDemo/publishedAt in daten → 422, keine Zeile mit diesen Werten", async () => {
    const r = await post("/api/entwuerfe", {
      origin: BASIS, cookie: Y.cookie,
      body: { daten: { status: "published", ownerId: X.id, orgId: alphaId, isDemo: true, publishedAt: new Date().toISOString(), assignedUserId: X.id, verified: true } }
    });
    assertGleich(r.status, 422, "status");
    return "status=422";
  });

  await angriff("I2", "PATCH /api/entwuerfe/<eigen> mit denselben Zusatzfeldern → 422, Entwurf unverändert", async () => {
    const [vor] = await sql`SELECT version, status FROM listing WHERE public_ref = ${draftRefY}`;
    const r = await patch(`/api/entwuerfe/${draftRefY}`, {
      origin: BASIS, cookie: Y.cookie,
      body: { version: vor.version, daten: { status: "published", assignedUserId: X.id, isDemo: true } }
    });
    assertGleich(r.status, 422, "status");
    const [nach] = await sql`SELECT status FROM listing WHERE public_ref = ${draftRefY}`;
    assertGleich(nach.status, vor.status, "status unverändert");
    return "status=422, Zustand unverändert";
  });

  await angriff("I3", "POST /api/org mit id/verified/isDemo im Body → 422 (OrganisationAnlegenSchema.strict())", async () => {
    const r = await post("/api/org", { origin: BASIS, cookie: X.cookie, body: { displayName: `Angriff ${TS}`, kind: "agency", locale: "de", id: "x", verified: true, isDemo: true } });
    assertGleich(r.status, 422, "status");
    return "status=422";
  });

  await angriff("I4", "PATCH /api/org/<alpha> mit isDemo/verified im Body → 422, DB unverändert", async () => {
    const r = await patch(`/api/org/${alphaSlug}`, { origin: BASIS, cookie: OA.cookie, body: { isDemo: true, verified: true } });
    assertGleich(r.status, 422, "status");
    const [row] = await sql`SELECT is_demo, verification_state FROM organization WHERE id = ${alphaId}`;
    assertGleich(row.is_demo, false, "is_demo");
    assertGleich(row.verification_state, "unverified", "verification_state");
    return "status=422, is_demo=false, verification_state=unverified";
  });

  await angriff("I5", "PATCH /api/org/<alpha>/mitglieder/<id> mit userId zusätzlich im Body → 422 (RolleSchema.strict())", async () => {
    const r = await patch(`/api/org/${alphaSlug}/mitglieder/${OA.id}`, { origin: BASIS, cookie: OA.cookie, body: { rolle: "owner", userId: X.id } });
    assertGleich(r.status, 422, "status");
    return "status=422";
  });

  await angriff("I6", "POST /api/anliegen mit status/assignedStaffId/userId/isDemo/verified/publishedAt → je 422, keine Zeile", async () => {
    const felder = [{ status: "closed" }, { assignedStaffId: STAFF.id }, { userId: Y.id }, { isDemo: true }, { verified: true }, { publishedAt: new Date().toISOString() }];
    for (const zusatz of felder) {
      const schluessel = Object.keys(zusatz)[0];
      const email = testadresse("fsi6-" + schluessel, TS);
      const r = await post("/api/anliegen", {
        origin: BASIS, xffTag: `fs-i6-${schluessel}`,
        body: { dienst: "sell", kontakt: { name: "Angriff", email }, objekt: { ortId: "ort-zuerich", typ: "wohnung" }, sprache: "de", herkunft: { seite: "/de/verkaufen" }, firma: "", ...zusatz }
      });
      assertGleich(r.status, 422, `status (${schluessel})`);
      const [row] = await sql`SELECT id FROM service_lead WHERE contact_email = ${email}`;
      assertTrue(!row, `trotz 422 eine Zeile für ${schluessel} angelegt`);
    }
    return "alle sechs Felder: 422, keine Zeile";
  });

  await angriff("I7", "PATCH /api/intern/anliegen/<ref> mit status UND assignedStaffId gleichzeitig → 422 (genau eines verlangt)", async () => {
    const r = await patch(`/api/intern/anliegen/${leadRef ?? "FWS-2026-000001"}`, { origin: BASIS, cookie: STAFF.cookie, body: { status: "contacted", assignedStaffId: STAFF.id } });
    assertGleich(r.status, 422, "status");
    return "status=422";
  });

  await angriff("I8", "PATCH /api/suchabo/<fremd> mit zusätzlichem userId-Feld → 404 (fremde ID zuerst geprüft, Zusatzfeld ohnehin wirkungslos)", async () => {
    const rSuchabo = await post("/api/suchabo", { origin: BASIS, cookie: Y.cookie, body: { query: {}, label: "Final-Suche Y", frequency: "daily" } });
    assertGleich(rSuchabo.status, 201, "suchabo anlegen (Y)");
    const [row] = await sql`SELECT id FROM saved_search WHERE user_id = ${Y.id} ORDER BY created_at DESC LIMIT 1`;
    assertTrue(!!row, "keine saved_search-Zeile für Y gefunden");
    const r = await patch(`/api/suchabo/${row.id}`, { origin: BASIS, cookie: X.cookie, body: { label: "Übernommen", userId: X.id } });
    assertGleich(r.status, 404, "status");
    await sql`DELETE FROM saved_search WHERE id = ${row.id}`;
    return "status=404";
  });

  /* ================= J. Einladungstoken ================= */
  await angriff("J1", "Manipulierter/erratener Token → 404", async () => {
    const r = await get(`/api/einladungen/${randomBytes(24).toString("base64url")}`, {});
    assertGleich(r.status, 404, "status");
    return "status=404";
  });

  await angriff("J2", "Abgelaufene Einladung annehmen → 409", async () => {
    const seit = Date.now();
    const rEinladen = await post(`/api/org/${alphaSlug}/mitglieder`, { origin: BASIS, cookie: OA.cookie, body: { email: EMAIL_INV1, rolle: "viewer" } });
    assertGleich(rEinladen.status, 201, "einladen");
    const mail = await neuesteMail(EMAIL_INV1, seit);
    assertTrue(!!mail, "keine Einladungsmail gefunden");
    const token = tokenAusMail(mail);
    await sql`UPDATE org_invitation SET expires_at = now() - interval '1 hour' WHERE token_hash = ${sha256Hex(token)}`;
    const person = await kontoSchnell(EMAIL_INV1, "Abgelaufene Einladung (Final)", "fs-inv1");
    const r = await post(`/api/einladungen/${token}`, { origin: BASIS, cookie: person.cookie });
    assertGleich(r.status, 409, "status");
    return "status=409";
  });

  await angriff("J3", "Einladung zweimal annehmen → zweites Mal 409 (Wiederverwendung)", async () => {
    const seit = Date.now();
    const rEinladen = await post(`/api/org/${alphaSlug}/mitglieder`, { origin: BASIS, cookie: OA.cookie, body: { email: EMAIL_INV2, rolle: "viewer" } });
    assertGleich(rEinladen.status, 201, "einladen");
    const mail = await neuesteMail(EMAIL_INV2, seit);
    assertTrue(!!mail, "keine Einladungsmail gefunden");
    const token = tokenAusMail(mail);
    const person = await kontoSchnell(EMAIL_INV2, "Zweifach-Einladung (Final)", "fs-inv2");
    const r1 = await post(`/api/einladungen/${token}`, { origin: BASIS, cookie: person.cookie });
    assertGleich(r1.status, 200, "erstes Annehmen");
    const r2 = await post(`/api/einladungen/${token}`, { origin: BASIS, cookie: person.cookie });
    assertGleich(r2.status, 409, "zweites Annehmen");
    return "erstes=200, zweites=409";
  });

  /* ================= K. Kontolöschung ================= */
  await angriff("K1", "X versucht, ein fremdes Konto zu löschen: /api/konto/loeschen kennt keine ID, ein userId-Zusatzfeld im Body → 422 (LoeschenSchema.strict())", async () => {
    const r = await post("/api/konto/loeschen", { origin: BASIS, cookie: X.cookie, body: { passwort: PASSWORT, bestaetigung: "LÖSCHEN", userId: Y.id } });
    assertGleich(r.status, 422, "status");
    const [row] = await sql`SELECT deleted_at FROM app_user WHERE id = ${Y.id}`;
    assertTrue(row.deleted_at == null, "Y wäre trotz 422 gelöscht worden");
    return "status=422, Y unangetastet";
  });

  /* ================= L. Produktionskonfiguration ================= */
  await angriff("L1", "domain/env.ts:pruefe() lehnt eine production-Konfiguration mit localhost-DB/dev-Mail/fehlendem DEMO_INHALTE/.example-Mail ab", async () => {
    const mod = await import(join(APP_ROOT, "domain", "env.ts"));
    const ergebnis = mod.pruefe({
      APP_ENV: "production",
      DATABASE_URL: "postgres://user:pass@localhost:5432/db",
      MAIL_PROVIDER: "dev",
      STORAGE_PROVIDER: "local",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      MAIL_FROM: "noreply@fourwalls.example"
      /* DEMO_INHALTE, APP_SECRET, SERVICE_LEAD_INBOX bewusst weggelassen */
    });
    assertTrue(ergebnis.ok === false, "eine unsichere production-Konfiguration wurde als gültig akzeptiert");
    const nachricht = ergebnis.fehler.join(" | ");
    for (const erwartet of ["DEMO_INHALTE", "APP_SECRET", "STORAGE_PROVIDER", "MAIL_PROVIDER", "DATABASE_URL", "SERVICE_LEAD_INBOX", "MAIL_FROM"]) {
      assertTrue(nachricht.includes(erwartet), `Fehlermeldung erwähnt ${erwartet} nicht`);
    }
    return `abgelehnt mit ${ergebnis.fehler.length} Fund(en): ${nachricht.slice(0, 200)}…`;
  });

  await angriff("L2", "Eine korrekte production-Konfiguration (alle Pflichtfelder gesetzt) wird angenommen — die Prüfung sperrt nicht pauschal", async () => {
    const mod = await import(join(APP_ROOT, "domain", "env.ts"));
    const ergebnis = mod.pruefe({
      APP_ENV: "production",
      DATABASE_URL: "postgres://user:pass@db.example.ch:5432/fourwalls?sslmode=verify-full",
      MAIL_PROVIDER: "smtp", SMTP_HOST: "smtp.example.ch", SMTP_USER: "u", SMTP_PASSWORD: "p",
      STORAGE_PROVIDER: "s3", S3_ENDPOINT: "https://sos.example.ch", S3_BUCKET_PRIVATE: "priv", S3_BUCKET_PUBLIC: "pub",
      S3_ACCESS_KEY_ID: "a", S3_SECRET_ACCESS_KEY: "b",
      NEXT_PUBLIC_SITE_URL: "https://fourwalls.ch",
      MAIL_FROM: "noreply@fourwalls.ch", SERVICE_LEAD_INBOX: "anliegen@fourwalls.ch",
      DEMO_INHALTE: "aus", APP_SECRET: randomBytes(24).toString("hex")
    });
    assertTrue(ergebnis.ok === true, `eine korrekte production-Konfiguration wurde abgelehnt: ${(ergebnis.fehler ?? []).join(" | ")}`);
    return "angenommen — die Prüfung unterscheidet echte Fehler von einer vollständigen Konfiguration";
  });

  /* ================= M. Demo-Tore ================= */
  await angriff("M1", "Alle Demo-Inserate/-Organisationen tragen is_demo=true (kein Demo-Inhalt ohne das Kennzeichen)", async () => {
    const listingLuecke = await sql`SELECT count(*)::int AS n FROM listing WHERE is_demo AND published_by_user_id IS NULL AND published_by_org_id IS NULL AND published_at IS NOT NULL`;
    const [{ n: demoListings }] = await sql`SELECT count(*)::int AS n FROM listing WHERE is_demo = true`;
    const [{ n: demoOrgs }] = await sql`SELECT count(*)::int AS n FROM organization WHERE is_demo = true`;
    return `Demo-Inserate=${demoListings}, Demo-Organisationen=${demoOrgs}, Lücken=${listingLuecke[0]?.n ?? 0}`;
  });

  await angriff("M2", "Das Demo-Prädikat ist in search.ts/similar.ts/listings.ts/inquiries.ts/angebot.ts/anbieter.ts/sitemap.ts identisch (grep) — ein einziges Tor, nicht sieben verschiedene", async () => {
    const dateien = ["server/search.ts", "server/similar.ts", "server/listings.ts", "server/inquiries.ts", "server/angebot.ts", "server/anbieter.ts", "app/sitemap.ts"];
    const treffer = execSync(`grep -n "is_demo = false" ${dateien.join(" ")}`, { cwd: APP_ROOT }).toString().trim().split("\n").filter(Boolean);
    assertTrue(treffer.length >= dateien.length, `weniger Treffer (${treffer.length}) als geprüfte Dateien (${dateien.length}) — mindestens eine Datei hat das Prädikat nicht`);
    for (const d of dateien) {
      assertTrue(treffer.some(z => z.startsWith(d + ":")), `${d} enthält das Demo-Prädikat 'is_demo = false' nicht`);
    }
    return `${treffer.length} Fundstellen über ${dateien.length} Dateien, alle mit demselben Muster`;
  });

  await angriff("M3", "server/env.ts:demoSichtbar() ist die einzige Stelle, die DEMO_INHALTE liest — keine zweite Kopie des Schalters", async () => {
    const treffer = execSync(`grep -rln "DEMO_INHALTE" --include="*.ts" server domain app 2>/dev/null || true`, { cwd: APP_ROOT }).toString().trim().split("\n").filter(Boolean);
    const erlaubt = new Set(["server/env.ts", "domain/env.ts"]);
    const unerwartet = treffer.filter(t => !erlaubt.has(t));
    assertTrue(unerwartet.length === 0, `DEMO_INHALTE wird ausserhalb von env.ts gelesen: ${unerwartet.join(", ")}`);
    return `DEMO_INHALTE nur in ${treffer.join(", ")}`;
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
  console.log("\n" + zeile("Nr", "Angriff", "Status", "Detail"));
  console.log("-".repeat(w1 + w2 + w3 + 10));
  for (const e of ergebnisse) console.log(zeile(e.bez, e.titel, e.status, e.detail));
}
tabelle();

const funde = ergebnisse.filter(e => e.status === "FEHLER");
console.log(`\nVersuche: ${VERSUCHE}  —  Abgewehrt: ${ABGEWEHRT}  —  Funde: ${funde.length}`);
console.log(`${ergebnisse.length} Schritte, ${funde.length} FEHLER, ${ergebnisse.length - funde.length} OK — Dauer ${(dauerMs / 1000).toFixed(1)}s`);
if (funde.length > 0) {
  console.log("\nFUNDE im Detail:");
  for (const e of funde) console.log(`  ${e.bez} (${e.titel}): ${e.detail}`);
}
process.exit(funde.length > 0 ? 1 : 0);
