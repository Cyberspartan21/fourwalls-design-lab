#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Konto löschen: Prüfreise (P5.10 §9–§12)

   Prüft die ganze Lieferkette einer Kontolöschung über HTTP:

     Reise A (eigenes Konto, persönliche Daten): registrieren, Entwurf +
       Bild anlegen, merken, Suchabo speichern, Anfrage senden, Export prüfen,
       Löschen mit falschem Passwort (4xx), falschem Bestätigungswort (422),
       richtigem Passwort (200) — danach: altes Passwort meldet nicht mehr an,
       altes Cookie ungültig, Entwurf + Bild weg, Merkliste weg, Anfrage bleibt
       mit sender_user_id NULL, app_user anonymisiert (Tombstone).
     Reise B (IDOR): ohne Sitzung kein Export (401); B sieht in seinem
       eigenen Export nie A's Daten.
     Reise C/D (§10 Organisationsregel): C ist alleinige Besitzerin einer
       Organisation mit einem veröffentlichten, ihr zugewiesenen Inserat →
       Löschung 409/SOLE_OWNER. Nach Übergabe an D (Einladung + Ernennung zur
       Besitzerin, dieselbe Rollenvergabe wie P5.7) gelingt die Löschung; D
       bleibt Besitzerin, das Organisationsinserat bleibt veröffentlicht,
       assigned_user_id wird NULL.
     Reise E: ein Teammitglied (Rolle agent) löscht sein Konto — die
       Mitgliedschaft wird deaktiviert, sonst nichts blockiert.

   Aufruf:
     set -a; . ./.env.local; set +a
     FW_TEST_MOD_EMAIL=... FW_TEST_MOD_PASSWORT=... node scripts/kontoloeschung-test.mjs [Basis-URL]
       Standard: http://localhost:3007

   Mailquelle (siehe scripts/lib/mailquelle.mjs): FW_TEST_MAIL_QUELLE=dev|mailpit|imap.
   DATABASE_URL wird ausschliesslich für SELECT (Prüfen) und Aufräumen benutzt —
   jede Zustandsänderung läuft über die HTTP-API, wie in scripts/anliegen-test.mjs.

   Ausgabe: nummerierte Tabelle, var/kontoloeschung-bericht.json, Exit 1 bei
   irgendeinem FEHLER, sonst 0.
   ============================================================ */
import postgres from "postgres";
import { readFileSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawn } from "node:child_process";
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

const PASSWORT = "Kloe-" + randomBytes(12).toString("base64url");
const EMAIL_A = testadresse("kla", TS);
const EMAIL_B = testadresse("klb", TS);
const EMAIL_C = testadresse("klc", TS);
const EMAIL_D = testadresse("kld", TS);
const EMAIL_E = testadresse("kle", TS);
const BILD_PFAD = join(APP_ROOT, "public", "media", "zurich-altbau-1-960.jpg");
const ORT_ID = "ort-bern";
const ORG_NAME = `Kontolöschung Immobilien AG (Demo ${TS})`;

const ergebnisse = [];
function assertTrue(bedingung, meldung) { if (!bedingung) throw new Error(meldung); }
function assertGleich(ist, soll, feld) {
  if (ist !== soll) throw new Error(`${feld}: erwartet ${JSON.stringify(soll)}, erhalten ${JSON.stringify(ist)}`);
}
async function schritt(bez, titel, fn) {
  try {
    const detail = (await fn()) || "ok";
    ergebnisse.push({ bez, titel, status: "OK", detail });
    console.log(`OK      ${String(bez).padStart(6)}  ${titel}`);
  } catch (e) {
    const detail = e && e.message ? e.message : String(e);
    ergebnisse.push({ bez, titel, status: "FEHLER", detail });
    console.log(`FEHLER  ${String(bez).padStart(6)}  ${titel} — ${detail}`);
  }
}

/* ---------- x-forwarded-for je Zweck, wegen der Ratenlimits ---------- */
const RUNSEED = Math.floor(Math.random() * 200) + 10;
const xffMap = new Map();
function xff(tag) {
  if (!xffMap.has(tag)) xffMap.set(tag, `10.${RUNSEED}.${xffMap.size + 1}.91`);
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
/* Steht ein Cookie mit LEEREM Wert (oder Max-Age=0) unter demselben Namen in
   den Set-Cookie-Kopfzeilen? So löscht auth.api.signOut() das Cookie. */
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
    return { status: res.status, json, text };
  } finally { clearTimeout(timer); }
}
const uploadDatei = (cookie, pfad, dateiname, mime) => uploadBytes(cookie, readFileSync(pfad), dateiname, mime);

/* ---------- Mail ---------- */
const MAILQUELLE = mailquelle();
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
function tokenAusEinladungsMail(mail) {
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

/* Moderationskonto — mit Rückfall wie in scripts/anliegen-test.mjs. */
async function moderatorAnmelden(tagPrefix) {
  let r = await anmelden(MOD_EMAIL, MOD_PASSWORT, `${tagPrefix}-auth`);
  let modEmail = MOD_EMAIL;
  if (r.status !== 200 || !r.cookie) {
    modEmail = `${tagPrefix}mod+${TS}@fourwalls.example`;
    const su = await registrieren(modEmail, MOD_PASSWORT, "Moderatorin (Kontolöschung)", `${tagPrefix}-signup`);
    assertGleich(su.status, 200, "sign-up Moderatorin (Rückfall)");
    await bestaetigeMail(modEmail);
    execFileSync(process.execPath, [join(APP_ROOT, "scripts", "rolle.mjs"), modEmail, "moderator"], { stdio: "inherit", env: process.env });
    r = await anmelden(modEmail, MOD_PASSWORT, `${tagPrefix}-auth`);
    assertGleich(r.status, 200, "sign-in Moderatorin (Rückfall)");
  }
  return { email: modEmail, cookie: r.cookie, id: r.json.user.id };
}

/* Ein Inserat bis zur Veröffentlichung bringen — persönlich (org=null) oder
   unter einer Organisation. Dieselben drei PATCH-Schritte wie in
   scripts/lieferkette-test.mjs, hier als Funktion, weil zwei Reisen (A für
   den Entwurf, C/D für das Organisationsinserat) sie brauchen. */
async function inseratVeroeffentlichen({ cookie, userId, org, mod }) {
  const anlegenPfad = org ? `/api/org/${org}/inserate` : "/api/entwuerfe";
  const r0 = await post(anlegenPfad, { origin: BASIS, cookie, body: {} });
  assertGleich(r0.status, 201, "entwurf anlegen");
  const ref = r0.json.publicRef;
  let version = r0.json.version;

  const p1 = await patch(`/api/entwuerfe/${ref}`, { origin: BASIS, cookie, body: { version, daten: { trans: "sale", typ: "wohnung", ortId: ORT_ID, genauigkeit: "ungefaehr" } } });
  assertGleich(p1.status, 200, "patch1"); version = p1.json.version;
  const p2 = await patch(`/api/entwuerfe/${ref}`, { origin: BASIS, cookie, body: { version, daten: { zimmer: 3.5, flaeche: 90, preis: 850000 } } });
  assertGleich(p2.status, 200, "patch2"); version = p2.json.version;
  const hoch = await uploadDatei(cookie, BILD_PFAD, "foto.jpg", "image/jpeg");
  assertGleich(hoch.status, 201, "bild hochladen");
  const p3 = await patch(`/api/entwuerfe/${ref}`, {
    origin: BASIS, cookie,
    body: { version, daten: { titel: `Prüfobjekt Kontolöschung ${ref}`, beschreibung: `Ein Prüfobjekt für die Kontolöschungs-Reise, Referenz ${ref}, mit genug Text für die Vollständigkeitsprüfung.`, name: "Prüfperson", email: `kloeprobe+${TS}@example.com`, bilder: [hoch.json.id] } }
  });
  assertGleich(p3.status, 200, "patch3");

  const submit = await post(`/api/entwuerfe/${ref}/aktion`, { origin: BASIS, cookie, body: { absicht: "einreichen" } });
  assertGleich(submit.status, 200, "einreichen");
  const ver = await post(`/api/moderation/${ref}`, { origin: BASIS, cookie: mod.cookie, body: { absicht: "freigeben-und-veroeffentlichen" } });
  assertGleich(ver.status, 200, "freigeben-und-veroeffentlichen");
  return { ref, assetId: hoch.json.id };
}

/* ---------- 390 px per CDP (dasselbe Muster wie scripts/intern-mobil-test.mjs) ---------- */
const CHROME = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const schlaf = ms => new Promise(r => setTimeout(r, ms));

async function seite(port) {
  for (let i = 0; i < 80; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const p = l.find(x => x.type === "page");
      if (p) return p.webSocketDebuggerUrl;
    } catch { /* Chrome noch nicht bereit */ }
    await schlaf(250);
  }
  throw new Error("Chrome antwortet nicht");
}

/* Eigener Port ≥ 9600, eigenes Profil /tmp/fw-h4-<port> — Prozess und Profil
   werden in jedem Fall (auch bei einem Fehler) wieder entfernt. */
async function mitSeiteArbeiten(fn) {
  const port = 9600 + Math.floor(Math.random() * 300);
  const profil = `/tmp/fw-h4-${port}`;
  const kind = spawn(CHROME, ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=390,844",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, "about:blank"], { stdio: "ignore" });
  try {
    const ws = new WebSocket(await seite(port));
    await new Promise(ok => { ws.onopen = ok; });
    let nr = 0; const offen = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && offen.has(m.id)) { offen.get(m.id)(m); offen.delete(m.id); } };
    const cmd = (method, params) => new Promise(ok => { const id = ++nr; offen.set(id, ok); ws.send(JSON.stringify({ id, method, params })); });
    const js = async expr => {
      const r = await cmd("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      return r.result && r.result.result ? r.result.result.value : null;
    };
    await cmd("Page.enable"); await cmd("Runtime.enable"); await cmd("Network.enable");
    await cmd("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await fn({ cmd, js });
    ws.close();
  } finally {
    kind.kill();
    /* Abwarten statt eines nicht abgewarteten setTimeout: der Prozess dieses
       Skripts endet am Schluss über process.exit() — ein "fire and forget"-
       Timer würde dann nie mehr feuern und das Profil verwaiste. */
    await schlaf(500);
    try { rmSync(profil, { recursive: true, force: true }); } catch { /* schon weg */ }
  }
}

/* ---------- Aufräumen ---------- */
async function aufraeumen() {
  /* Nur, was diese Reise selbst noch aufräumen MUSS (Konten und Organisationen
     bleiben stehen, wie bei den anderen Prüfskripten — sie tragen Prüfspuren
     bzw. sind selbst der geprüfte Löschvorgang). */
  console.log("Aufräumen: keine zusätzlichen Zeilen — die geprüfte Löschung selbst räumt A/C auf, Rest bleibt als Prüfspur.");
}

const START = Date.now();
console.log(`Basis: ${BASIS}  —  Kontolöschung-Prüfreise startet (TS=${TS})`);

let A, B, MOD;
let refEntwurfA, assetIdA, publicRefFavorit, refInquiryA, listingIdA;

try {
  /* ================= Reise A: eigenes Konto, persönliche Daten ================= */
  await schritt("A.1", "A registrieren/bestätigen/anmelden", async () => {
    A = await konto(EMAIL_A, "Person A (Kontolöschung)", "a-auth");
    return `id=${A.id}`;
  });

  await schritt("A.2", "A legt einen Entwurf mit Bild an", async () => {
    const r0 = await post("/api/entwuerfe", { origin: BASIS, cookie: A.cookie, body: {} });
    assertGleich(r0.status, 201, "entwurf anlegen");
    refEntwurfA = r0.json.publicRef;
    const hoch = await uploadDatei(A.cookie, BILD_PFAD, "foto.jpg", "image/jpeg");
    assertGleich(hoch.status, 201, "bild hochladen");
    assetIdA = hoch.json.id;
    const p = await patch(`/api/entwuerfe/${refEntwurfA}`, { origin: BASIS, cookie: A.cookie, body: { version: r0.json.version, daten: { titel: "Entwurf von A", bilder: [assetIdA] } } });
    assertGleich(p.status, 200, "bild im entwurf speichern");
    const [row] = await sql`SELECT id, status FROM listing WHERE public_ref = ${refEntwurfA}`;
    assertTrue(!!row, "keine listing-Zeile für den Entwurf gefunden");
    listingIdA = String(row.id);
    assertGleich(row.status, "draft", "status");
    return `publicRef=${refEntwurfA}, assetId=${assetIdA}`;
  });

  await schritt("A.3", "A merkt ein veröffentlichtes Objekt", async () => {
    const [obj] = await sql`SELECT public_ref FROM listing_public LIMIT 1`;
    assertTrue(!!obj, "kein veröffentlichtes Objekt in der Datenbank gefunden");
    publicRefFavorit = String(obj.public_ref);
    const r = await post("/api/favoriten", { origin: BASIS, cookie: A.cookie, body: { publicRef: publicRefFavorit } });
    assertGleich(r.status, 200, "merken");
    assertGleich(r.json.gemerkt, true, "gemerkt");
    return `publicRef=${publicRefFavorit}`;
  });

  await schritt("A.4", "A speichert eine Suche mit Suchabo", async () => {
    const r = await post("/api/suchabo", { origin: BASIS, cookie: A.cookie, body: { query: {}, label: "Prüfsuche Kontolöschung", frequency: "daily" } });
    assertGleich(r.status, 201, "suchabo anlegen");
    const [row] = await sql`SELECT id FROM saved_search WHERE user_id = ${A.id}`;
    assertTrue(!!row, "keine saved_search-Zeile gefunden");
    return "gespeichert";
  });

  await schritt("A.5", "A sendet eine Anfrage zum gemerkten Objekt", async () => {
    const r = await post("/api/inquiries", {
      origin: BASIS, cookie: A.cookie,
      body: { publicRef: publicRefFavorit, art: "listing_question", name: "Person A", email: EMAIL_A, nachricht: "Ist dieses Objekt noch verfügbar? (Kontolöschungs-Prüfreise)", firma: "" }
    });
    assertGleich(r.status, 201, "anfrage senden");
    refInquiryA = r.json.publicRef;
    const [row] = await sql`SELECT sender_user_id FROM inquiry WHERE public_ref = ${refInquiryA}`;
    assertGleich(String(row.sender_user_id), A.id, "sender_user_id vor der Löschung");
    return `publicRef=${refInquiryA}`;
  });

  await schritt("A.6", "GET /api/konto/export (A) enthält den Entwurf und keine internen Kennungen ausser publicRef", async () => {
    const r = await get("/api/konto/export", { cookie: A.cookie });
    assertGleich(r.status, 200, "status");
    assertTrue(String(r.text ?? "").includes("attachment") === false, "Content-Type-Prüfung über Header, nicht Body");
    const gefunden = (r.json.eigeneInserate ?? []).some(i => i.publicRef === refEntwurfA);
    assertTrue(gefunden, `${refEntwurfA} nicht im Export gefunden`);
    assertTrue((r.json.favoriten ?? []).includes(publicRefFavorit), "Favorit nicht im Export gefunden");
    return `eigeneInserate=${r.json.eigeneInserate.length}, favoriten=${r.json.favoriten.length}`;
  });

  await schritt("A.7", "GET /api/konto/export ohne Sitzung → 401", async () => {
    const r = await get("/api/konto/export", {});
    assertGleich(r.status, 401, "status");
    return "status=401";
  });

  await schritt("B.1", "B registrieren; B's Export enthält A's Daten nicht (IDOR-Falsifikation)", async () => {
    B = await konto(EMAIL_B, "Person B (Kontolöschung)", "b-auth");
    const r = await get("/api/konto/export", { cookie: B.cookie });
    assertGleich(r.status, 200, "status");
    const text = JSON.stringify(r.json);
    assertTrue(!text.includes(refEntwurfA), "B's Export enthält A's Entwurfsreferenz");
    assertTrue(!text.includes(refInquiryA), "B's Export enthält A's Anfragereferenz");
    return `B sieht ${r.json.eigeneInserate.length} eigene(s) Inserat(e), keines von A`;
  });

  await schritt("A.8", "Löschung mit falschem Passwort → 4xx, Konto unverändert", async () => {
    const r = await post("/api/konto/loeschen", { origin: BASIS, cookie: A.cookie, body: { passwort: "falsches-passwort-xyz", bestaetigung: "LÖSCHEN" } });
    assertTrue(r.status >= 400 && r.status < 500, `status=${r.status}, erwartet 4xx`);
    const [row] = await sql`SELECT deleted_at FROM app_user WHERE id = ${A.id}`;
    assertTrue(row.deleted_at == null, "app_user wäre bereits gelöscht/anonymisiert — falsches Passwort hätte nichts ändern dürfen");
    return `status=${r.status}`;
  });

  await schritt("A.9", "Löschung mit falschem Bestätigungswort → 422", async () => {
    const r = await post("/api/konto/loeschen", { origin: BASIS, cookie: A.cookie, body: { passwort: PASSWORT, bestaetigung: "vielleicht" } });
    assertGleich(r.status, 422, "status");
    return "status=422";
  });

  let loeschAntwort;
  await schritt("A.10", "Löschung mit richtigem Passwort + Bestätigungswort → 200, Zusammenfassung", async () => {
    const r = await post("/api/konto/loeschen", { origin: BASIS, cookie: A.cookie, body: { passwort: PASSWORT, bestaetigung: "LÖSCHEN" } });
    assertGleich(r.status, 200, "status");
    loeschAntwort = r.json;
    assertTrue(Array.isArray(r.json.geloescht) && r.json.geloescht.includes("listing_entwurf"), "listing_entwurf fehlt in geloescht[]");
    assertTrue(Array.isArray(r.json.zurueckgestellt) && r.json.zurueckgestellt.includes("inquiry_gesendet"), "inquiry_gesendet fehlt in zurueckgestellt[]");
    assertTrue(cookieGeloescht(r.setCookies), "das Sitzungscookie wurde nicht gelöscht/geleert");
    return `geloescht=${JSON.stringify(r.json.geloescht)}, zurueckgestellt=${JSON.stringify(r.json.zurueckgestellt)}`;
  });

  await schritt("A.11", "Altes Passwort meldet nicht mehr an", async () => {
    const r = await anmelden(EMAIL_A, PASSWORT, "a-nach-loeschung");
    assertTrue(r.status !== 200, `sign-in nach Löschung erfolgreich (status=${r.status})`);
    return `status=${r.status}`;
  });

  await schritt("A.12", "Das alte Sitzungscookie ist ungültig (GET /api/konto/export → 401)", async () => {
    const r = await get("/api/konto/export", { cookie: A.cookie });
    assertGleich(r.status, 401, "status");
    return "status=401";
  });

  await schritt("A.13", "Der Entwurf ist weg (DB)", async () => {
    const z = await sql`SELECT id FROM listing WHERE public_ref = ${refEntwurfA}`;
    assertGleich(z.length, 0, "Anzahl verbleibender listing-Zeilen");
    return "0 Zeilen";
  });

  await schritt("A.14", "Der Favorit ist weg (DB)", async () => {
    const z = await sql`SELECT id FROM favorite WHERE user_id = ${A.id}`;
    assertGleich(z.length, 0, "Anzahl verbleibender favorite-Zeilen");
    return "0 Zeilen";
  });

  await schritt("A.15", "Die Anfrage bleibt, aber sender_user_id ist NULL", async () => {
    const [row] = await sql`SELECT sender_user_id, sender_email FROM inquiry WHERE public_ref = ${refInquiryA}`;
    assertTrue(!!row, "die Anfrage-Zeile ist verschwunden — sie hätte bleiben sollen");
    assertTrue(row.sender_user_id == null, `sender_user_id ist nicht NULL: ${row.sender_user_id}`);
    assertGleich(String(row.sender_email), EMAIL_A, "sender_email bleibt (zurückgestellt)");
    return "sender_user_id=NULL, sender_email bleibt";
  });

  await schritt("A.16", "app_user ist anonymisiert (Tombstone)", async () => {
    const [row] = await sql`SELECT email, display_name, phone, platform_role, deleted_at FROM app_user WHERE id = ${A.id}`;
    assertTrue(!!row, "app_user-Zeile ist verschwunden — sie hätte bleiben sollen (Fremdschlüssel)");
    assertTrue(/^geloescht\+.+@konto\.geloescht\.invalid$/.test(String(row.email)), `email nicht im Tombstone-Format: ${row.email}`);
    assertGleich(row.display_name, "Gelöschtes Konto", "display_name");
    assertTrue(row.phone == null, "phone ist nicht NULL");
    assertGleich(row.platform_role, "user", "platform_role");
    assertTrue(row.deleted_at != null, "deleted_at ist NULL");
    return `email=${row.email}`;
  });

  await schritt("A.17", "Das Medienobjekt des Entwurfs ist aus der Datenbank UND (bei lokalem Speicher) aus dem Dateisystem weg", async () => {
    const z = await sql`SELECT id FROM media_asset WHERE id = ${assetIdA}`;
    assertGleich(z.length, 0, "media_asset-Zeile besteht noch");
    const orig = join(APP_ROOT, "var", "uploads", `${assetIdA}.jpg`);
    if (existsSync(join(APP_ROOT, "var", "uploads"))) {
      assertTrue(!existsSync(orig), `Originaldatei besteht noch: ${orig}`);
      return `DB-Zeile weg, Originaldatei weg (${orig})`;
    }
    return "DB-Zeile weg (kein lokaler Speicherordner gefunden — S3-Betrieb, Dateiprüfung übersprungen)";
  });

  await schritt("A.18", "audit_log trägt account.deleted mit A's (jetzt anonymisierter) Kennung", async () => {
    const [row] = await sql`SELECT actor_user_id FROM audit_log WHERE entity_type = 'app_user' AND entity_id = ${A.id} AND action = 'account.deleted'`;
    assertTrue(!!row, "kein audit_log-Eintrag 'account.deleted' gefunden");
    return "audit_log: account.deleted";
  });

  /* ================= Reise C/D: alleinige Besitzerin, Übergabe, dann Löschung ================= */
  let C, D, orgSlug, orgId, orgRef, assignedAssetId;
  await schritt("C.1", "C registrieren und Organisation Alpha anlegen (owner)", async () => {
    C = await konto(EMAIL_C, "Person C (Kontolöschung)", "c-auth");
    const r = await post("/api/org", { origin: BASIS, cookie: C.cookie, body: { displayName: ORG_NAME, kind: "agency", locale: "de" } });
    assertGleich(r.status, 201, "org anlegen");
    orgSlug = r.json.slug; orgId = r.json.id;
    return `slug=${orgSlug}`;
  });

  await schritt("C.2", "Moderationskonto anmelden (Rückfall wie in anliegen-test.mjs)", async () => {
    MOD = await moderatorAnmelden("kl");
    return `mod=${MOD.email}`;
  });

  await schritt("C.3", "Organisationsinserat bis zur Veröffentlichung bringen und C zuweisen", async () => {
    const { ref, assetId } = await inseratVeroeffentlichen({ cookie: C.cookie, userId: C.id, org: orgSlug, mod: MOD });
    orgRef = ref; assignedAssetId = assetId;
    const zu = await post(`/api/org/${orgSlug}/inserate/${orgRef}/zuweisen`, { origin: BASIS, cookie: C.cookie, body: { userId: C.id } });
    assertGleich(zu.status, 200, "zuweisen");
    const [row] = await sql`SELECT status, assigned_user_id, published_by_org_id FROM listing WHERE public_ref = ${orgRef}`;
    assertGleich(row.status, "published", "status vor der Löschung");
    assertGleich(String(row.assigned_user_id), C.id, "assigned_user_id vor der Löschung");
    return `orgRef=${orgRef}, status=published, assigned=${row.assigned_user_id}`;
  });

  await schritt("C.4", "C ist alleinige Besitzerin einer aktiven Organisation → Löschung 409/SOLE_OWNER", async () => {
    const r = await post("/api/konto/loeschen", { origin: BASIS, cookie: C.cookie, body: { passwort: PASSWORT, bestaetigung: "LÖSCHEN" } });
    assertGleich(r.status, 409, "status");
    assertGleich(r.json?.fields?.grund, "SOLE_OWNER", "fields.grund");
    assertTrue(String(r.json?.fields?.organisationen ?? "").includes(ORG_NAME), "Organisationsname fehlt in der Fehlerantwort");
    const [row] = await sql`SELECT deleted_at FROM app_user WHERE id = ${C.id}`;
    assertTrue(row.deleted_at == null, "C wäre trotz Blockade gelöscht worden");
    return `status=409, grund=SOLE_OWNER`;
  });

  await schritt("C.5", "C lädt D ein (agent), D nimmt an", async () => {
    const seit = Date.now();
    const rEinladen = await post(`/api/org/${orgSlug}/mitglieder`, { origin: BASIS, cookie: C.cookie, body: { email: EMAIL_D, rolle: "agent" } });
    assertGleich(rEinladen.status, 201, "einladen");
    const mail = await neuesteMail(EMAIL_D, seit);
    assertTrue(!!mail, "keine Einladungsmail für D gefunden");
    const token = tokenAusEinladungsMail(mail);
    D = await konto(EMAIL_D, "Person D (Kontolöschung)", "d-auth");
    const an = await post(`/api/einladungen/${token}`, { origin: BASIS, cookie: D.cookie });
    assertGleich(an.status, 200, "annehmen");
    return `D=${D.id}, rolle=agent`;
  });

  await schritt("C.6", "C ernennt D zur Besitzerin (owner → owner, P5.7-Rollenvergabe)", async () => {
    const r = await patch(`/api/org/${orgSlug}/mitglieder/${D.id}`, { origin: BASIS, cookie: C.cookie, body: { rolle: "owner" } });
    assertGleich(r.status, 200, "rolle ändern");
    const [row] = await sql`SELECT role FROM org_membership WHERE organization_id = ${orgId} AND user_id = ${D.id}`;
    assertGleich(row.role, "owner", "rolle in der DB");
    return "D ist jetzt owner";
  });

  await schritt("C.7", "Jetzt gelingt C's Löschung (zwei Besitzerinnen)", async () => {
    const r = await post("/api/konto/loeschen", { origin: BASIS, cookie: C.cookie, body: { passwort: PASSWORT, bestaetigung: "LÖSCHEN" } });
    assertGleich(r.status, 200, "status");
    return `geloescht=${JSON.stringify(r.json.geloescht)}, bleibt=${JSON.stringify(r.json.bleibt)}`;
  });

  await schritt("C.8", "D bleibt Besitzerin, C's Mitgliedschaft ist deaktiviert", async () => {
    const [d] = await sql`SELECT role, is_active FROM org_membership WHERE organization_id = ${orgId} AND user_id = ${D.id}`;
    assertGleich(d.role, "owner", "D-Rolle");
    assertGleich(d.is_active, true, "D aktiv");
    const [c] = await sql`SELECT is_active FROM org_membership WHERE organization_id = ${orgId} AND user_id = ${C.id}`;
    assertGleich(c.is_active, false, "C-Mitgliedschaft aktiv (hätte deaktiviert sein müssen)");
    return "D=owner/aktiv, C=inaktiv";
  });

  await schritt("C.9", "Das Organisationsinserat bleibt veröffentlicht, assigned_user_id ist NULL", async () => {
    const [row] = await sql`SELECT status, assigned_user_id, published_by_org_id FROM listing WHERE public_ref = ${orgRef}`;
    assertGleich(row.status, "published", "status nach der Löschung");
    assertTrue(row.assigned_user_id == null, `assigned_user_id ist nicht NULL: ${row.assigned_user_id}`);
    assertGleich(String(row.published_by_org_id), orgId, "published_by_org_id unverändert");
    return "status=published, assigned_user_id=NULL";
  });

  await schritt("C.10", "Das Bild des Organisationsinserats bleibt (kein fremdes Eigentum wird gelöscht)", async () => {
    const z = await sql`SELECT id FROM media_asset WHERE id = ${assignedAssetId}`;
    assertGleich(z.length, 1, "das Bild des Organisationsinserats hätte bestehen bleiben müssen");
    return "media_asset besteht weiter";
  });

  /* ================= Reise E: Teammitglied löscht sein eigenes Konto ================= */
  let E;
  await schritt("E.1", "D lädt E als agent ein, E nimmt an", async () => {
    const seit = Date.now();
    const rEinladen = await post(`/api/org/${orgSlug}/mitglieder`, { origin: BASIS, cookie: D.cookie, body: { email: EMAIL_E, rolle: "agent" } });
    assertGleich(rEinladen.status, 201, "einladen");
    const mail = await neuesteMail(EMAIL_E, seit);
    assertTrue(!!mail, "keine Einladungsmail für E gefunden");
    const token = tokenAusEinladungsMail(mail);
    E = await konto(EMAIL_E, "Person E (Kontolöschung)", "e-auth");
    const an = await post(`/api/einladungen/${token}`, { origin: BASIS, cookie: E.cookie });
    assertGleich(an.status, 200, "annehmen");
    return `E=${E.id}, rolle=agent`;
  });

  await schritt("E.2", "E (Agent, keine Besitzerin) löscht das eigene Konto → 200, keine Blockade", async () => {
    const r = await post("/api/konto/loeschen", { origin: BASIS, cookie: E.cookie, body: { passwort: PASSWORT, bestaetigung: "LÖSCHEN" } });
    assertGleich(r.status, 200, "status");
    return `geloescht=${JSON.stringify(r.json.geloescht)}, bleibt=${JSON.stringify(r.json.bleibt)}`;
  });

  await schritt("E.3", "E's Mitgliedschaft ist deaktiviert, die Organisation lebt unverändert weiter", async () => {
    const [e] = await sql`SELECT is_active FROM org_membership WHERE organization_id = ${orgId} AND user_id = ${E.id}`;
    assertGleich(e.is_active, false, "E-Mitgliedschaft aktiv (hätte deaktiviert sein müssen)");
    const [org] = await sql`SELECT is_active, archived_at FROM organization WHERE id = ${orgId}`;
    assertGleich(org.is_active, true, "Organisation ist nicht mehr aktiv");
    assertTrue(org.archived_at == null, "Organisation wäre stillgelegt worden");
    return "E=inaktiv, Organisation unverändert aktiv";
  });

  /* ================= 390 px: /de/konto/loeschen ohne Überbreite ================= */
  /* Dasselbe CDP-Muster wie scripts/intern-mobil-test.mjs — eigener Port,
     eigenes Profil, Prozess wird danach beendet. B ist noch ein normales,
     nicht gelöschtes Konto und eignet sich als angemeldete Sitzung dafür. */
  await mitSeiteArbeiten(async ({ cmd, js }) => {
    const basisUrl = new URL(BASIS);
    const cookieName = B.cookie.split("=")[0];
    const cookieValue = B.cookie.split("=").slice(1).join("=");
    await cmd("Network.setCookie", { name: cookieName, value: cookieValue, domain: basisUrl.hostname, path: "/", httpOnly: true, secure: false });

    await schritt("M.1", "/de/konto/loeschen bei 390 px: kein horizontales Scrollen", async () => {
      await cmd("Page.navigate", { url: `${BASIS}/de/konto/loeschen` });
      await schlaf(2500);
      const breite = await js("document.documentElement.scrollWidth");
      assertTrue(breite === 390, `scrollWidth=${breite}, erwartet 390`);
      return `scrollWidth=${breite}`;
    });
    await schritt("M.2", "Passwort- und Bestätigungsfeld haben je ein <label>", async () => {
      const anzahl = await js(`document.querySelectorAll('label[for="klPasswort"],label[for="klBestaetigung"]').length`);
      assertTrue(anzahl === 2, `${anzahl}/2 Labels gefunden`);
      return `${anzahl}/2 Labels`;
    });
    await schritt("M.3", "Der Löschen-Knopf hat sichtbaren Text", async () => {
      const text = await js(`(document.querySelector('form button[type="submit"]')||{}).textContent`);
      assertTrue(!!text && text.trim().length > 0, "kein Text im Absende-Knopf gefunden");
      return `Knopftext: "${(text || "").trim()}"`;
    });
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
  const w1 = 6;
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
const berichtPfad = join(varOrdner, "kontoloeschung-bericht.json");
writeFileSync(berichtPfad, JSON.stringify(bericht, null, 2));
console.log(`Bericht geschrieben: ${berichtPfad}`);

process.exit(fehlerAnzahl > 0 ? 1 : 0);
