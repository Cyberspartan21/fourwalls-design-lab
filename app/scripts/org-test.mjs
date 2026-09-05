#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Organisationen & Team: Prüfreise (P5.7 §3–§17)

   Prüft: Organisation anlegen (mit Erlaubnisliste/Missbrauchsbremse),
   Profil ändern (mit gesperrten Feldern), Einladen → lesen (maskiert) →
   annehmen (falsches Konto, doppelt, widerrufen, abgelaufen), Rolle ändern
   (letzte Besitzerin, eigene Rolle), Mitglied entfernen (Fremdzugriff = 404),
   und dass eine fremde Organisation überall NOT_FOUND liefert, nie FORBIDDEN.

   Aufruf:
     set -a; . ./.env.local; set +a
     node scripts/org-test.mjs [Basis-URL]      Standard: http://localhost:3007

   Mailquelle (siehe scripts/lib/mailquelle.mjs): FW_TEST_MAIL_QUELLE=dev|mailpit|imap.

   Ausgabe: nummerierte Tabelle, Exit 1 bei irgendeinem FEHLER, sonst 0.
   Die Datei ändert an der Anwendung nichts — sie meldet nur Befunde.
   ============================================================ */
import postgres from "postgres";
import { createHash, randomBytes } from "node:crypto";
import { mailquelle, testadresse } from "./lib/mailquelle.mjs";

const BASIS = (process.argv[2] || "http://localhost:3007").replace(/\/$/, "");
const TIMEOUT_MS = 60_000;
const TS = Date.now();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a)"); process.exit(2); }
const sql = postgres(DATABASE_URL, { max: 4, onnotice: () => {} });

const PASSWORT = "Team-" + randomBytes(12).toString("base64url");
const EMAIL_A = testadresse("orga", TS);
const EMAIL_B = testadresse("orgb", TS);
const EMAIL_C = testadresse("orgc", TS);
const EMAIL_D = testadresse("orgd", TS);
const ALPHA_NAME = `Alpha Immobilien AG (Demo ${TS})`;
const BETA_NAME = `Beta Immobilien AG (Demo ${TS})`;

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

/* ---------- x-forwarded-for je Konto, wegen des Anmelde-Ratenlimits ---------- */
const RUNSEED = Math.floor(Math.random() * 200) + 10;
const xffMap = new Map();
function xff(tag) {
  if (!xffMap.has(tag)) xffMap.set(tag, `10.${RUNSEED}.${xffMap.size + 1}.21`);
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

/* ---------- Mail ---------- */
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
  if (!mail) throw new Error(`Keine Mail für ${email} über Mailquelle "${MAILQUELLE.name}" gefunden (30 s gewartet)`);
  const treffer = mail.text.match(/https?:\/\/\S+/);
  if (!treffer) throw new Error(`Keine URL in der Mail an ${email} gefunden`);
  const res = await fetch(treffer[0], { redirect: "manual", headers: { "x-forwarded-for": bestaetigungsAdresse(email) } });
  return res.status;
}
/* Die neueste Mail einer Art an eine Adresse — für Einladung/Entfernt-Mails,
   die keinen Bestätigungslink zum Aufrufen haben. */
async function neuesteMail(email, seitMs) {
  return MAILQUELLE.warte(email, seitMs);
}

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

/* Token aus der Einladungsmail lesen: der Link endet auf /einladung/<token>. */
function tokenAusMail(mail) {
  const treffer = mail.text.match(/\/einladung\/([A-Za-z0-9_-]+)/);
  if (!treffer) throw new Error(`Kein Einladungstoken in der Mail gefunden: ${mail.text.slice(0, 200)}`);
  return treffer[1];
}
const sha256Hex = s => createHash("sha256").update(s).digest("hex");

const START = Date.now();
console.log(`Basis: ${BASIS}  —  Organisationen-Prüfreise startet (TS=${TS})`);

let A, B, C, D;
let alphaSlug, alphaId, betaSlug;

await schritt(1, "A registrieren/bestätigen/anmelden und Alpha anlegen → 201, Slug, owner, audit", async () => {
  A = await konto(EMAIL_A, "Person A (Org-Test)", "a-auth");
  const r = await post("/api/org", {
    origin: BASIS, cookie: A.cookie,
    body: { displayName: ALPHA_NAME, kind: "agency", locale: "de", city: "Zürich" }
  });
  assertGleich(r.status, 201, "status");
  assertTrue(!!r.json?.slug, "keine slug in der Antwort");
  alphaSlug = r.json.slug; alphaId = r.json.id;

  const [mitglied] = await sql`SELECT role FROM org_membership WHERE organization_id = ${alphaId} AND user_id = ${A.id}`;
  assertTrue(!!mitglied, "keine org_membership-Zeile gefunden");
  assertGleich(mitglied.role, "owner", "rolle in der DB");

  const [audit] = await sql`SELECT action FROM audit_log WHERE entity_type = 'organization' AND entity_id = ${alphaId} AND action = 'org.created'`;
  assertTrue(!!audit, "kein audit_log-Eintrag 'org.created' gefunden");
  return `slug=${alphaSlug}, rolle=owner, audit=org.created`;
});

await schritt(2, "Verbotene Felder beim Anlegen: kind=fourwalls und verification_state → je 422, DB unverändert", async () => {
  const [vorher] = await sql`SELECT count(*)::int AS n FROM organization`;
  const r1 = await post("/api/org", { origin: BASIS, cookie: A.cookie, body: { displayName: `X ${TS}`, kind: "fourwalls", locale: "de" } });
  assertGleich(r1.status, 422, "status kind=fourwalls");
  const r2 = await post("/api/org", { origin: BASIS, cookie: A.cookie, body: { displayName: `Y ${TS}`, kind: "agency", locale: "de", verification_state: "verified" } });
  assertGleich(r2.status, 422, "status verification_state im Body");
  const [nachher] = await sql`SELECT count(*)::int AS n FROM organization`;
  assertGleich(nachher.n, vorher.n, "Anzahl Organisationen in der DB");
  return `beide 422, DB unverändert (${vorher.n} Organisationen)`;
});

await schritt(3, "PATCH Profil mit verified_at/is_active im Body → 422", async () => {
  const r = await patch(`/api/org/${alphaSlug}`, { origin: BASIS, cookie: A.cookie, body: { verified_at: new Date().toISOString(), is_active: false } });
  assertGleich(r.status, 422, "status");
  return `status=${r.status}`;
});

let tokenB;
await schritt(4, "A lädt B ein → Mail mit Token, gespeichert wird nur der Hash", async () => {
  const seit = Date.now();
  const r = await post(`/api/org/${alphaSlug}/mitglieder`, { origin: BASIS, cookie: A.cookie, body: { email: EMAIL_B, rolle: "agent" } });
  assertGleich(r.status, 201, "status");
  const mail = await neuesteMail(EMAIL_B, seit);
  assertTrue(!!mail, "keine Einladungsmail für B gefunden");
  tokenB = tokenAusMail(mail);
  const [row] = await sql`SELECT token_hash FROM org_invitation WHERE organization_id = ${alphaId} AND email = ${EMAIL_B} ORDER BY created_at DESC LIMIT 1`;
  assertTrue(!!row, "keine org_invitation-Zeile gefunden");
  assertTrue(row.token_hash !== tokenB, "token_hash entspricht dem Klartext-Token");
  assertGleich(row.token_hash, sha256Hex(tokenB), "token_hash (sha256 des Tokens)");
  return `Token erhalten, token_hash = sha256(token), nicht der Klartext`;
});

await schritt(5, "GET /api/einladungen/<token> anonym → maskierte Adresse, keine Mitgliederliste", async () => {
  const r = await get(`/api/einladungen/${tokenB}`, {});
  assertGleich(r.status, 200, "status");
  assertGleich(r.json.rolle, "agent", "rolle");
  assertTrue(/^.\*\*\*@/.test(r.json.emailMaskiert), `E-Mail nicht maskiert: ${r.json.emailMaskiert}`);
  assertTrue(!r.json.emailMaskiert.includes(EMAIL_B), "unmaskierte Adresse in der Antwort");
  assertTrue(!("mitglieder" in r.json), "Mitgliederliste in einer öffentlichen Antwort gefunden");
  assertGleich(r.json.zustand, "offen", "zustand");
  return `emailMaskiert=${r.json.emailMaskiert}, zustand=${r.json.zustand}`;
});

await schritt(6, "C (andere Adresse) nimmt B's Einladung an → 403", async () => {
  C = await konto(EMAIL_C, "Person C (Org-Test)", "c-auth");
  const r = await post(`/api/einladungen/${tokenB}`, { origin: BASIS, cookie: C.cookie });
  assertGleich(r.status, 403, "status");
  return `status=${r.status}`;
});

await schritt(7, "B (richtige Adresse) nimmt an → 200, Mitgliedschaft agent, audit", async () => {
  B = await konto(EMAIL_B, "Person B (Org-Test)", "b-auth");
  const r = await post(`/api/einladungen/${tokenB}`, { origin: BASIS, cookie: B.cookie });
  assertGleich(r.status, 200, "status");
  const [mitglied] = await sql`SELECT role, is_active FROM org_membership WHERE organization_id = ${alphaId} AND user_id = ${B.id}`;
  assertTrue(!!mitglied, "keine org_membership-Zeile für B gefunden");
  assertGleich(mitglied.role, "agent", "rolle");
  assertGleich(mitglied.is_active, true, "is_active");
  const [audit] = await sql`SELECT action FROM audit_log WHERE entity_type = 'organization' AND entity_id = ${alphaId} AND action = 'org.invitation_accepted'`;
  assertTrue(!!audit, "kein audit_log-Eintrag 'org.invitation_accepted' gefunden");
  return `rolle=agent, audit=org.invitation_accepted`;
});

await schritt(8, "B nimmt denselben Token erneut an → 409", async () => {
  const r = await post(`/api/einladungen/${tokenB}`, { origin: BASIS, cookie: B.cookie });
  assertGleich(r.status, 409, "status");
  return `status=${r.status}`;
});

await schritt(9, "B versucht eigene Rolle auf owner zu setzen → 403; B versucht A zu entfernen → 403", async () => {
  const r1 = await patch(`/api/org/${alphaSlug}/mitglieder/${B.id}`, { origin: BASIS, cookie: B.cookie, body: { rolle: "owner" } });
  assertGleich(r1.status, 403, "status (eigene Rolle)");
  const r2 = await del(`/api/org/${alphaSlug}/mitglieder/${A.id}`, { origin: BASIS, cookie: B.cookie });
  assertGleich(r2.status, 403, "status (A entfernen)");
  return `beide 403`;
});

await schritt(10, "C legt Beta an; C sieht Alphas Team nicht (404), kann B dort nicht entfernen (404)", async () => {
  const r = await post("/api/org", { origin: BASIS, cookie: C.cookie, body: { displayName: BETA_NAME, kind: "agency", locale: "de" } });
  assertGleich(r.status, 201, "status Beta anlegen");
  betaSlug = r.json.slug;
  const rGet = await get(`/api/org/${alphaSlug}/mitglieder`, { cookie: C.cookie });
  assertGleich(rGet.status, 404, "status GET Team (Fremde)");
  const rDel = await del(`/api/org/${alphaSlug}/mitglieder/${B.id}`, { origin: BASIS, cookie: C.cookie });
  assertGleich(rDel.status, 404, "status DELETE Mitglied (Fremde)");
  return `Beta=${betaSlug}, beide Zugriffe auf Alpha 404`;
});

await schritt(11, "A ändert B auf admin → 200; A (letzte Besitzerin) versucht sich selbst auf agent → 409", async () => {
  const r1 = await patch(`/api/org/${alphaSlug}/mitglieder/${B.id}`, { origin: BASIS, cookie: A.cookie, body: { rolle: "admin" } });
  assertGleich(r1.status, 200, "status B → admin");
  const [mitglied] = await sql`SELECT role FROM org_membership WHERE organization_id = ${alphaId} AND user_id = ${B.id}`;
  assertGleich(mitglied.role, "admin", "rolle in der DB");
  const r2 = await patch(`/api/org/${alphaSlug}/mitglieder/${A.id}`, { origin: BASIS, cookie: A.cookie, body: { rolle: "agent" } });
  assertGleich(r2.status, 409, "status A → agent (letzte Besitzerin)");
  return `B=admin, A-Selbstherabstufung=409`;
});

await schritt(12, "A lädt D ein, widerruft die Einladung; D's Annahmeversuch → 409", async () => {
  D = await konto(EMAIL_D, "Person D (Org-Test)", "d-auth");
  const seit = Date.now();
  const rEinladen = await post(`/api/org/${alphaSlug}/mitglieder`, { origin: BASIS, cookie: A.cookie, body: { email: EMAIL_D, rolle: "viewer" } });
  assertGleich(rEinladen.status, 201, "status einladen");
  const mail = await neuesteMail(EMAIL_D, seit);
  const tokenD1 = tokenAusMail(mail);
  const [row] = await sql`SELECT id FROM org_invitation WHERE organization_id = ${alphaId} AND email = ${EMAIL_D} AND revoked_at IS NULL AND accepted_at IS NULL ORDER BY created_at DESC LIMIT 1`;
  assertTrue(!!row, "keine offene Einladung für D gefunden");
  const rWiderruf = await del(`/api/org/${alphaSlug}/einladungen/${row.id}`, { origin: BASIS, cookie: A.cookie });
  assertGleich(rWiderruf.status, 200, "status widerrufen");
  const rAnnehmen = await post(`/api/einladungen/${tokenD1}`, { origin: BASIS, cookie: D.cookie });
  assertTrue([409, 410].includes(rAnnehmen.status), `unerwarteter Status ${rAnnehmen.status} (erwartet 409 oder 410)`);
  return `widerrufen=200, annehmen(widerrufen)=${rAnnehmen.status}`;
});

await schritt(13, "Abgelaufene Einladung: D's Annahmeversuch → 409/410", async () => {
  const seit = Date.now();
  const rEinladen = await post(`/api/org/${alphaSlug}/mitglieder`, { origin: BASIS, cookie: A.cookie, body: { email: EMAIL_D, rolle: "viewer" } });
  assertGleich(rEinladen.status, 201, "status erneut einladen");
  const mail = await neuesteMail(EMAIL_D, seit);
  const tokenD2 = tokenAusMail(mail);
  await sql`UPDATE org_invitation SET expires_at = now() - interval '1 hour' WHERE token_hash = ${sha256Hex(tokenD2)}`;
  const rAnnehmen = await post(`/api/einladungen/${tokenD2}`, { origin: BASIS, cookie: D.cookie });
  assertTrue([409, 410].includes(rAnnehmen.status), `unerwarteter Status ${rAnnehmen.status} (erwartet 409 oder 410)`);
  const [mitglied] = await sql`SELECT 1 FROM org_membership WHERE organization_id = ${alphaId} AND user_id = ${D.id} AND is_active`;
  assertTrue(!mitglied, "D wurde trotz abgelaufener Einladung Mitglied");
  return `annehmen(abgelaufen)=${rAnnehmen.status}, D ist kein Mitglied`;
});

await schritt(14, "A entfernt B → 200; B's Zugehörigkeit gilt sofort als widerrufen; Mail an B", async () => {
  const seit = Date.now();
  const r = await del(`/api/org/${alphaSlug}/mitglieder/${B.id}`, { origin: BASIS, cookie: A.cookie });
  assertGleich(r.status, 200, "status entfernen");
  const [mitglied] = await sql`SELECT is_active FROM org_membership WHERE organization_id = ${alphaId} AND user_id = ${B.id}`;
  assertGleich(mitglied.is_active, false, "is_active in der DB");
  const rGet = await get(`/api/org/${alphaSlug}/mitglieder`, { cookie: B.cookie });
  assertGleich(rGet.status, 404, "status Team mit altem Cookie");
  const mail = await neuesteMail(EMAIL_B, seit);
  assertTrue(!!mail, "keine 'org_member_removed'-Mail an B gefunden");
  return `is_active=false, altes Cookie=404, Mail an B gefunden`;
});

await schritt(15, "D (ohne Mitgliedschaft) sieht leere Organisationsliste; GET Alpha → 404", async () => {
  const rListe = await get("/api/org", { cookie: D.cookie });
  assertGleich(rListe.status, 200, "status Liste");
  assertGleich(rListe.json.organisationen.length, 0, "Anzahl Organisationen für D");
  const rAlpha = await get(`/api/org/${alphaSlug}`, { cookie: D.cookie });
  assertGleich(rAlpha.status, 404, "status GET Alpha");
  return `Liste leer, GET Alpha=404`;
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
