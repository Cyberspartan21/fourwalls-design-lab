#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Organisationen: vier Ende-zu-Ende-Reisen (P5.7 §65–§68)

   REISE A (Agentur): registrieren → Organisation anlegen → Profil ändern →
     einladen → annehmen → Inserat unter der Organisation → vollständig
     bearbeiten (inkl. Bild) → zuweisen → einreichen → Moderation →
     öffentliche Suche/Objektseite/Anbieterseite → Kunde merkt/vergleicht →
     anonyme Anfrage → Posteingang der Organisation.
   REISE B (Cross-Org): eine fremde Besitzerin sieht/bearbeitet/zuweist/
     reicht ein/liest Anfragen für die Agentur nicht — knapp, die Details
     deckt scripts/org-sicherheit-test.mjs ab.
   REISE C (Austritt): ein Teammitglied mit zwei Zuweisungen verlässt das
     Team — Konto bleibt, Organisationsliste wird leer, beide Inserate
     bleiben öffentlich und verlieren nur die Zuweisung.
   REISE D (Bauträger): eine dritte Organisationsart, drei Neubau-Inserate,
     ein Suchabo VOR der Veröffentlichung, ein Alarm NACH ihr.

   Aufruf:
     set -a; . ./.env.local; set +a
     FW_TEST_MOD_EMAIL=... FW_TEST_MOD_PASSWORT=... node scripts/org-reisen-test.mjs [Basis-URL]

   Mailquelle (siehe scripts/lib/mailquelle.mjs): FW_TEST_MAIL_QUELLE=dev|mailpit|imap.
   Reise D wartet auf die Alarm-Mail — ALERT_INTERVAL_MS auf dem Server
   bestimmt den Takt (Standard 30 s, in CI 5 s); das Skript pollt bis 60 s.

   Ausgabe: nummerierte Tabelle, Exit 1 bei irgendeinem FEHLER, sonst 0.
   Räumt seine Testorganisationen und -inserate am Ende immer auf — Konten
   mit Prüfspur bleiben bestehen, wie scripts/staging-reset.mjs es vorsieht.
   ============================================================ */
import postgres from "postgres";
import { readFileSync } from "node:fs";
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

const MOD_EMAIL_STANDARD = process.env.FW_TEST_MOD_EMAIL;
const MOD_PASSWORT_STANDARD = process.env.FW_TEST_MOD_PASSWORT;
if (!MOD_EMAIL_STANDARD || !MOD_PASSWORT_STANDARD) {
  console.error("FW_TEST_MOD_EMAIL und FW_TEST_MOD_PASSWORT fehlen — Zugangsdaten des Moderationskontos kommen aus der Umgebung, nie aus dem Skript.");
  process.exit(2);
}

const PASSWORT = "Reise-" + randomBytes(12).toString("base64url");
const BILD_PFAD = join(APP_ROOT, "public", "media", "zurich-altbau-1-960.jpg");
const ORT_ID = "ort-bern";
const PFAD = { de: { immobilien: "immobilien", kaufen: "kaufen", mieten: "mieten", anbieter: "anbieter" } };

/* ---------- Reise A: Agentur ---------- */
const EMAIL_RA = testadresse("ora", TS);   // Owner der Agentur
const EMAIL_RB = testadresse("orb", TS);   // Agent im Team, per Einladung
const EMAIL_RD = testadresse("ord", TS);   // Kunde, merkt/vergleicht/fragt an/abonniert
const AGENTUR_NAME = `Reise Agentur AG (Demo ${TS})`;

/* ---------- Reise B: Cross-Org ---------- */
const EMAIL_RC = testadresse("orc", TS);   // Besitzerin einer fremden Organisation
const FREMD_NAME = `Reise Fremd AG (Demo ${TS})`;

/* ---------- Reise D: Bauträger ---------- */
const EMAIL_RE = testadresse("ore", TS);   // Owner des Bauträgers
const BAUTRAEGER_NAME = `Reise Bauträger AG (Demo ${TS})`;

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

async function holenHtml(pfad) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASIS + pfad, { redirect: "manual", signal: ctrl.signal });
    const text = await res.text().catch(() => "");
    return { status: res.status, text };
  } finally { clearTimeout(timer); }
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
async function neuesteMail(email, seitMs) { return MAILQUELLE.warte(email, seitMs); }
function tokenAusMail(mail) {
  const treffer = mail.text.match(/\/einladung\/([A-Za-z0-9_-]+)/);
  if (!treffer) throw new Error(`Kein Einladungstoken in der Mail gefunden: ${mail.text.slice(0, 200)}`);
  return treffer[1];
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

async function moderatorAnmelden(tagPrefix) {
  let r = await anmelden(MOD_EMAIL_STANDARD, MOD_PASSWORT_STANDARD, `${tagPrefix}-auth`);
  let modEmail = MOD_EMAIL_STANDARD;
  if (r.status !== 200 || !r.cookie) {
    modEmail = `${tagPrefix}mod+${TS}@fourwalls.example`;
    const su = await registrieren(modEmail, MOD_PASSWORT_STANDARD, "Moderator Org-Reisen", `${tagPrefix}-signup`);
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

/* Fakten und Text — ohne Bild, damit auch eine andere Person als Bearbeiter
   (z. B. die Besitzerin, die später zuweist) den Entwurf vorbereiten kann.
   Ein Bild MUSS von derselben Person stammen, die später einreicht
   (server/entwuerfe.ts:materialisieren prüft media_asset.uploaded_by =
   person.id) — siehe bildErgaenzenUndEinreichen(). */
async function faktenUndText(cookie, ref, version, titel, zusatz = {}) {
  const p1 = await patch(`/api/entwuerfe/${ref}`, {
    origin: BASIS, cookie,
    body: { version, daten: { trans: "sale", typ: "wohnung", ortId: ORT_ID, genauigkeit: "ungefaehr", zimmer: 3.5, flaeche: 85, preis: 640000, ...zusatz } }
  });
  assertGleich(p1.status, 200, "faktenUndText: fakten");
  const p2 = await patch(`/api/entwuerfe/${ref}`, {
    origin: BASIS, cookie,
    body: { version: p1.json.version, daten: { titel, beschreibung: "Automatisierte Reisenprüfung — bitte ignorieren.", name: "Prüfperson", email: `pruef+${TS}@example.com` } }
  });
  assertGleich(p2.status, 200, "faktenUndText: text");
  return p2.json.version;
}

/* Ein Inserat vollständig ausfüllen (Fakten, Text, Bild) — wie
   scripts/lieferkette-test.mjs. Gibt die zuletzt gültige Version zurück.
   Nur für den Fall geeignet, dass dieselbe Person auch einreicht. */
async function vervollstaendigen(cookie, ref, version, titel, zusatz = {}) {
  const nachText = await faktenUndText(cookie, ref, version, titel, zusatz);
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

/* Objektpfad aus einem Suchtreffer bauen. */
function objektPfadAus(treffer) {
  const art = treffer.transactionType === "rent" ? "mieten" : "kaufen";
  return `/de/${PFAD.de.immobilien}/${PFAD.de[art]}/${treffer.slug}`;
}

/* ---------- Aufräumen — läuft immer, auch nach einem Fehler ---------- */
const orgIds = [];
async function aufraeumen() {
  try {
    const ids = orgIds.filter(Boolean);
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
console.log(`Basis: ${BASIS}  —  Organisations-Reisen starten (TS=${TS})`);

let RA, RB, RD, RC, RE, MOD;
let agenturSlug, agenturId;
let refX, xArt;

try {
  /* ============================================================
     REISE A — Agentur
     ============================================================ */
  await schritt("A1", "RA registrieren/bestätigen/anmelden, Agentur anlegen", async () => {
    RA = await konto(EMAIL_RA, "Owner Agentur (Reise A)", "ra");
    const r = await post("/api/org", { origin: BASIS, cookie: RA.cookie, body: { displayName: AGENTUR_NAME, kind: "agency", locale: "de", city: "Bern" } });
    assertGleich(r.status, 201, "status");
    agenturSlug = r.json.slug; agenturId = r.json.id; orgIds.push(agenturId);
    return `slug=${agenturSlug}`;
  });

  await schritt("A2", "Profil ändern: Beschreibung und Website", async () => {
    const r = await patch(`/api/org/${agenturSlug}`, {
      origin: BASIS, cookie: RA.cookie,
      body: { description: "Reise-Agentur — automatisierte Prüfung, bitte ignorieren.", website: "https://reise-agentur-demo.example" }
    });
    assertGleich(r.status, 200, "status");
    assertGleich(r.json.description, "Reise-Agentur — automatisierte Prüfung, bitte ignorieren.", "description");
    assertGleich(r.json.website, "https://reise-agentur-demo.example", "website");
    return "Profil aktualisiert";
  });

  await schritt("A3", "RA lädt RB ein, RB registriert sich und nimmt an (agent)", async () => {
    const seit = Date.now();
    const rEinladen = await post(`/api/org/${agenturSlug}/mitglieder`, { origin: BASIS, cookie: RA.cookie, body: { email: EMAIL_RB, rolle: "agent" } });
    assertGleich(rEinladen.status, 201, "einladen");
    const mail = await neuesteMail(EMAIL_RB, seit);
    assertTrue(!!mail, "keine Einladungsmail für RB gefunden");
    const token = tokenAusMail(mail);
    RB = await konto(EMAIL_RB, "Agent (Reise A)", "rb");
    const r = await post(`/api/einladungen/${token}`, { origin: BASIS, cookie: RB.cookie });
    assertGleich(r.status, 200, "annehmen");
    return `RB=${RB.id} ist agent`;
  });

  await schritt("A4", "Inserat unter der Organisation anlegen, vollständig bearbeiten (inkl. Bild)", async () => {
    const r = await post(`/api/org/${agenturSlug}/inserate`, { origin: BASIS, cookie: RA.cookie, body: {} });
    assertGleich(r.status, 201, "anlegen");
    refX = r.json.publicRef;
    const [row] = await sql`SELECT publisher_kind, published_by_org_id FROM listing WHERE public_ref = ${refX}`;
    assertGleich(row.publisher_kind, "agency", "publisher_kind");
    assertGleich(String(row.published_by_org_id), String(agenturId), "published_by_org_id");
    await faktenUndText(RA.cookie, refX, r.json.version, `Reise-Agentur-Wohnung ${TS}`);
    return `refX=${refX}`;
  });

  await schritt("A5", "RA weist RB zu, RB ergänzt das Bild und reicht ein", async () => {
    const rZu = await post(`/api/org/${agenturSlug}/inserate/${refX}/zuweisen`, { origin: BASIS, cookie: RA.cookie, body: { userId: RB.id } });
    assertGleich(rZu.status, 200, "zuweisen");
    /* Der Zuweisungs-Trigger erhöht `version` zusätzlich — die nächste
       Änderung muss von rZu.json.version ausgehen (siehe
       scripts/org-inserate-test.mjs, Schritt 5). Das Bild muss von RB
       stammen — RB reicht ein, und materialisieren() akzeptiert nur Bilder
       der einreichenden Person. */
    const rEin = await bildErgaenzenUndEinreichen(RB.cookie, refX, rZu.json.version);
    assertGleich(rEin.status, 200, "einreichen");
    const [row] = await sql`SELECT status, assigned_user_id FROM listing WHERE public_ref = ${refX}`;
    assertGleich(row.status, "submitted", "status");
    assertGleich(String(row.assigned_user_id), String(RB.id), "assigned_user_id");
    return "zugewiesen an RB, status=submitted";
  });

  await schritt("A6", "Moderator: freigeben-und-veroeffentlichen → Suche zeigt listingSource=agentur", async () => {
    MOD = await moderatorAnmelden("orav6");
    const r = await post(`/api/moderation/${refX}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "freigeben-und-veroeffentlichen" } });
    assertGleich(r.status, 200, "status");
    const rSuche = await get(`/api/search?ref=${refX}`, {});
    const treffer = (rSuche.json?.treffer ?? [])[0];
    assertTrue(!!treffer, "kein Suchtreffer für refX");
    assertGleich(treffer.listingSource, "agentur", "listingSource");
    xArt = treffer.transactionType === "rent" ? "mieten" : "kaufen";
    return `listingSource=${treffer.listingSource}, slug=${treffer.slug}`;
  });

  await schritt("A7", "Objektseite zeigt den Organisationsnamen; Anbieterseite zeigt das Inserat", async () => {
    const [row] = await sql`SELECT slug FROM listing WHERE public_ref = ${refX}`;
    const seite = await holenHtml(`/de/${PFAD.de.immobilien}/${PFAD.de[xArt]}/${row.slug}-${refX.toLowerCase()}`);
    assertGleich(seite.status, 200, "Objektseite status");
    assertTrue(seite.text.includes(AGENTUR_NAME), "Organisationsname nicht auf der Objektseite gefunden");
    const anbieter = await holenHtml(`/de/${PFAD.de.anbieter}/${agenturSlug}`);
    assertGleich(anbieter.status, 200, "Anbieterseite status");
    assertTrue(anbieter.text.includes(row.slug) || anbieter.text.includes(refX.toLowerCase()), "Inserat nicht auf der Anbieterseite gefunden");
    return "Objektseite zeigt Organisationsnamen, Anbieterseite zeigt das Inserat";
  });

  await schritt("A8", "Kunde RD: merken, vergleichen, in der Merkliste sehen", async () => {
    RD = await konto(EMAIL_RD, "Kunde (Reise A/D)", "rd");
    const rMerken = await post("/api/favoriten", { origin: BASIS, cookie: RD.cookie, body: { publicRef: refX } });
    assertGleich(rMerken.status, 200, "merken status");
    const rVergleich = await get(`/api/vergleich?refs=${refX}`, {});
    assertTrue((rVergleich.json?.treffer ?? []).some(t => t.id === refX), "refX nicht im Vergleich gefunden");
    const rFav = await get("/api/favoriten", { cookie: RD.cookie });
    assertTrue((rFav.json?.refs ?? []).includes(refX), "refX nicht in der Merkliste gefunden");
    return "gemerkt, im Vergleich, in der Merkliste";
  });

  await schritt("A9", "Anonyme Anfrage routet an Agent+Organisation; Posteingang der Organisation zeigt sie", async () => {
    const r = await post("/api/inquiries", {
      origin: BASIS, xffTag: "ra-inquiry",
      body: { publicRef: refX, art: "viewing_request", name: "Prüfperson Reise A", email: `raq+${TS}@example.com`, nachricht: "Automatisierte Reisenprüfung — bitte ignorieren.", firma: "" }
    });
    assertGleich(r.status, 201, "status");
    const ref = r.json.publicRef;
    const [row] = await sql`SELECT recipient_org_id, recipient_user_id FROM inquiry WHERE public_ref = ${ref}`;
    assertGleich(String(row.recipient_org_id), String(agenturId), "recipient_org_id");
    assertGleich(String(row.recipient_user_id), String(RB.id), "recipient_user_id");
    const rPosteingang = await get(`/api/org/${agenturSlug}/anfragen`, { cookie: RA.cookie });
    assertGleich(rPosteingang.status, 200, "GET anfragen status");
    assertTrue((rPosteingang.json?.zeilen ?? []).some(z => z.publicRef === ref), "Anfrage nicht im Posteingang gefunden");
    return "recipient_org_id=Agentur, recipient_user_id=RB, im Posteingang gefunden";
  });

  /* ============================================================
     REISE B — Cross-Org (knapp; die Details deckt org-sicherheit-test.mjs ab)
     ============================================================ */
  await schritt("B1", "RC registriert sich, legt eine fremde Organisation an", async () => {
    RC = await konto(EMAIL_RC, "Owner Fremd (Reise B)", "rc");
    const r = await post("/api/org", { origin: BASIS, cookie: RC.cookie, body: { displayName: FREMD_NAME, kind: "agency", locale: "de", city: "Bern" } });
    assertGleich(r.status, 201, "status");
    orgIds.push(r.json.id);
    return `slug=${r.json.slug}`;
  });

  await schritt("B2", "RC: lesen/bearbeiten/zuweisen/einreichen/Anfragen für die Agentur — alles 404", async () => {
    const rGet = await get(`/api/entwuerfe/${refX}`, { cookie: RC.cookie });
    assertGleich(rGet.status, 404, "GET Entwurf");
    const rPatch = await patch(`/api/entwuerfe/${refX}`, { origin: BASIS, cookie: RC.cookie, body: { version: 1, daten: {} } });
    assertGleich(rPatch.status, 404, "PATCH Entwurf");
    const rZu = await post(`/api/org/${agenturSlug}/inserate/${refX}/zuweisen`, { origin: BASIS, cookie: RC.cookie, body: { userId: RC.id } });
    assertGleich(rZu.status, 404, "POST zuweisen");
    const rEin = await post(`/api/entwuerfe/${refX}/aktion`, { origin: BASIS, cookie: RC.cookie, body: { absicht: "einreichen" } });
    assertGleich(rEin.status, 404, "POST einreichen");
    const rAnfragen = await get(`/api/org/${agenturSlug}/anfragen`, { cookie: RC.cookie });
    assertGleich(rAnfragen.status, 404, "GET anfragen");
    return "GET/PATCH/zuweisen/einreichen/anfragen — alle 404";
  });

  /* ============================================================
     REISE C — Austritt
     ============================================================ */
  let refY;
  await schritt("C1", "Zweites Inserat unter der Agentur, ebenfalls RB zugewiesen und veröffentlicht (RB hat 2 Zuweisungen)", async () => {
    const rNeu = await post(`/api/org/${agenturSlug}/inserate`, { origin: BASIS, cookie: RA.cookie, body: {} });
    assertGleich(rNeu.status, 201, "anlegen");
    refY = rNeu.json.publicRef;
    await faktenUndText(RA.cookie, refY, rNeu.json.version, `Reise-Agentur-Zweitwohnung ${TS}`);
    const rZu = await post(`/api/org/${agenturSlug}/inserate/${refY}/zuweisen`, { origin: BASIS, cookie: RA.cookie, body: { userId: RB.id } });
    assertGleich(rZu.status, 200, "zuweisen");
    const rEin = await bildErgaenzenUndEinreichen(RB.cookie, refY, rZu.json.version);
    assertGleich(rEin.status, 200, "einreichen");
    const rVer = await post(`/api/moderation/${refY}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "freigeben-und-veroeffentlichen" } });
    assertGleich(rVer.status, 200, "veröffentlichen");
    const zuweisungen = await sql`SELECT count(*)::int AS n FROM listing WHERE published_by_org_id = ${agenturId} AND assigned_user_id = ${RB.id}`;
    assertGleich(zuweisungen[0].n, 2, "Anzahl Zuweisungen an RB");
    return `refY=${refY}, RB hat 2 Zuweisungen`;
  });

  await schritt("C2", "RA entfernt RB: Konto bleibt (Anmeldung 200), /api/org leer, beide Inserate verlieren nur die Zuweisung", async () => {
    const rAnfragenVorher = await sql`SELECT count(*)::int AS n FROM inquiry WHERE recipient_org_id = ${agenturId}`;
    const seit = Date.now();
    const r = await del(`/api/org/${agenturSlug}/mitglieder/${RB.id}`, { origin: BASIS, cookie: RA.cookie });
    assertGleich(r.status, 200, "entfernen status");

    const anmeldung = await anmelden(RB.email, PASSWORT, "rb-nach-austritt");
    assertGleich(anmeldung.status, 200, "RB kann sich weiterhin anmelden");
    const rbNeuesCookie = anmeldung.cookie;

    const rListe = await get("/api/org", { cookie: rbNeuesCookie });
    assertGleich(rListe.status, 200, "GET /api/org status");
    assertGleich(rListe.json.organisationen.length, 0, "Anzahl Organisationen für RB");

    const zeilen = await sql`SELECT public_ref, status, assigned_user_id FROM listing WHERE public_ref = ANY(${[refX, refY]})`;
    for (const z of zeilen) {
      assertGleich(z.status, "published", `Status von ${z.public_ref} unverändert`);
      assertGleich(z.assigned_user_id, null, `assigned_user_id von ${z.public_ref} entfernt`);
    }

    const seiteX = await holenHtml(objektPfadAus((await get(`/api/search?ref=${refX}`, {})).json.treffer[0]));
    assertGleich(seiteX.status, 200, "Objektseite refX weiterhin erreichbar");
    const seiteY = await holenHtml(objektPfadAus((await get(`/api/search?ref=${refY}`, {})).json.treffer[0]));
    assertGleich(seiteY.status, 200, "Objektseite refY weiterhin erreichbar");

    const rAnfragenNachher = await sql`SELECT count(*)::int AS n FROM inquiry WHERE recipient_org_id = ${agenturId}`;
    assertGleich(rAnfragenNachher[0].n, rAnfragenVorher[0].n, "Anzahl Anfragen der Organisation unverändert");

    const rAltesCookie = await get(`/api/org/${agenturSlug}/inserate`, { cookie: RB.cookie });
    assertGleich(rAltesCookie.status, 404, "altes Cookie auf Org-Route");

    const mail = await neuesteMail(RB.email, seit);
    assertTrue(!!mail, "keine 'org_member_removed'-Mail an RB gefunden");

    return "Konto besteht, /api/org leer, beide Inserate published ohne Zuweisung, Anfragen unverändert, altes Cookie=404, Mail gefunden";
  });

  /* ============================================================
     REISE D — Bauträger
     ============================================================ */
  let bautraegerSlug, bautraegerId;
  let refNeubau1, refNeubau2, refNeubau3;

  await schritt("D1", "RE registriert sich, legt einen Bauträger an (kind=developer)", async () => {
    RE = await konto(EMAIL_RE, "Owner Bauträger (Reise D)", "re");
    const r = await post("/api/org", { origin: BASIS, cookie: RE.cookie, body: { displayName: BAUTRAEGER_NAME, kind: "developer", locale: "de", city: "Bern" } });
    assertGleich(r.status, 201, "status");
    assertGleich(r.json.kind, "developer", "kind");
    bautraegerSlug = r.json.slug; bautraegerId = r.json.id; orgIds.push(bautraegerId);
    return `slug=${bautraegerSlug}`;
  });

  await schritt("D2", "Drei Neubau-Inserate anlegen (Kauf, Wohnung)", async () => {
    const anlegenUndFuellen = async (titel) => {
      const r = await post(`/api/org/${bautraegerSlug}/inserate`, { origin: BASIS, cookie: RE.cookie, body: {} });
      assertGleich(r.status, 201, `anlegen ${titel}`);
      await vervollstaendigen(RE.cookie, r.json.publicRef, r.json.version, titel);
      return r.json.publicRef;
    };
    refNeubau1 = await anlegenUndFuellen(`Neubau: 3.5-Zimmer-Wohnung ${TS}`);
    refNeubau2 = await anlegenUndFuellen(`Neubau: 4.5-Zimmer-Attikawohnung ${TS}`);
    refNeubau3 = await anlegenUndFuellen(`Neubau: 2.5-Zimmer-Erstbezug ${TS}`);
    const zeilen = await sql`SELECT public_ref, publisher_kind, published_by_org_id FROM listing WHERE public_ref = ANY(${[refNeubau1, refNeubau2, refNeubau3]})`;
    assertGleich(zeilen.length, 3, "Anzahl Inserate in der DB");
    for (const z of zeilen) {
      assertGleich(z.publisher_kind, "developer", `publisher_kind von ${z.public_ref}`);
      assertGleich(String(z.published_by_org_id), String(bautraegerId), `published_by_org_id von ${z.public_ref}`);
    }
    return `refNeubau1=${refNeubau1}, refNeubau2=${refNeubau2}, refNeubau3=${refNeubau3}`;
  });

  let savedSearchId, alertId;
  await schritt("D3", "Kunde RD abonniert (query.ref=refNeubau1, immediately) — VOR der Veröffentlichung", async () => {
    const r = await post("/api/suchabo", {
      origin: BASIS, cookie: RD.cookie,
      body: { query: { ref: refNeubau1 }, label: `Reise D Alarm ${TS}`, frequency: "immediately" }
    });
    assertGleich(r.status, 201, "status");
    assertGleich(r.json.erfordertBestaetigung, false, "erfordertBestaetigung (angemeldetes Konto)");
    const [row] = await sql`
      SELECT ss.id AS saved_search_id, sa.id AS alert_id, sa.confirmed_at
        FROM saved_search ss JOIN search_alert sa ON sa.saved_search_id = ss.id
       WHERE ss.user_id = ${RD.id} AND ss.label = ${`Reise D Alarm ${TS}`} ORDER BY ss.created_at DESC LIMIT 1`;
    assertTrue(!!row, "keine saved_search/search_alert-Zeile gefunden");
    assertTrue(row.confirmed_at != null, "confirmed_at ist NULL (sollte bei Konto sofort gesetzt sein)");
    savedSearchId = row.saved_search_id; alertId = row.alert_id;
    const rSuche = await get(`/api/search?ref=${refNeubau1}`, {});
    assertGleich((rSuche.json?.treffer ?? []).length, 0, "refNeubau1 ist vor der Veröffentlichung schon in der Suche sichtbar");
    return `savedSearchId=${savedSearchId}, vor Veröffentlichung: 0 Treffer`;
  });

  await schritt("D4", "Moderator veröffentlicht refNeubau1 → listingSource=entwickler", async () => {
    const rEin = await post(`/api/entwuerfe/${refNeubau1}/aktion`, { origin: BASIS, cookie: RE.cookie, body: { absicht: "einreichen" } });
    assertGleich(rEin.status, 200, "einreichen");
    const rVer = await post(`/api/moderation/${refNeubau1}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "freigeben-und-veroeffentlichen" } });
    assertGleich(rVer.status, 200, "veröffentlichen");
    const rSuche = await get(`/api/search?ref=${refNeubau1}`, {});
    const treffer = (rSuche.json?.treffer ?? [])[0];
    assertTrue(!!treffer, "refNeubau1 nicht in der Suche gefunden");
    assertGleich(treffer.listingSource, "entwickler", "listingSource");
    return `listingSource=${treffer.listingSource}`;
  });

  await schritt("D5", "Alarm-Mail nach der Veröffentlichung (bis 60 s pollen), kein zweiter Alarmpfad", async () => {
    const seit = Date.now();
    const mail = await MAILQUELLE.warte(RD.email, seit, 60_000, 2000);
    assertTrue(!!mail, `keine Alarm-Mail an ${RD.email} innert 60 s gefunden (ALERT_INTERVAL_MS des Servers massgeblich)`);
    const [row] = await sql`SELECT public_ref FROM listing WHERE public_ref = ${refNeubau1}`;
    assertTrue(!!row, "refNeubau1 in der DB nicht gefunden");
    const gesendet = await sql`SELECT listing_id FROM search_alert_sent sas JOIN listing l ON l.id = sas.listing_id WHERE sas.alert_id = ${alertId} AND l.public_ref = ${refNeubau1}`;
    assertGleich(gesendet.length, 1, "genau eine search_alert_sent-Zeile für refNeubau1");
    return "Alarm-Mail gefunden, genau eine search_alert_sent-Zeile (kein zweiter Alarmpfad)";
  });

  await schritt("D6", "Anfrage routet an die Organisation (recipient_org_id=Bauträger)", async () => {
    const r = await post("/api/inquiries", {
      origin: BASIS, xffTag: "rd-inquiry",
      body: { publicRef: refNeubau1, art: "listing_question", name: "Prüfperson Reise D", email: `rdq+${TS}@example.com`, nachricht: "Automatisierte Reisenprüfung — bitte ignorieren.", firma: "" }
    });
    assertGleich(r.status, 201, "status");
    const [row] = await sql`SELECT recipient_org_id FROM inquiry WHERE public_ref = ${r.json.publicRef}`;
    assertGleich(String(row.recipient_org_id), String(bautraegerId), "recipient_org_id");
    return `recipient_org_id=${row.recipient_org_id}`;
  });

  await schritt("D7", "Anbieterseite zeigt die Art «Bauträger»", async () => {
    const seite = await holenHtml(`/de/${PFAD.de.anbieter}/${bautraegerSlug}`);
    assertGleich(seite.status, 200, "status");
    assertTrue(seite.text.includes("Bauträger"), "Label «Bauträger» nicht auf der Anbieterseite gefunden");
    return "Label «Bauträger» gefunden";
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
