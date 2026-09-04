#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Sicherheits-Falsifikation der Lieferkette
   (Konto, Entwurf, Moderation) über HTTP.

   Aufruf:
     set -a; . ./.env.local; set +a
     node scripts/sicherheit-test.mjs [Basis-URL]

   Schreibt eine Tabelle auf stdout und var/sicherheit-bericht.json.
   Exit 1, sobald irgendeine Prüfung FEHLER meldet.

   Die Datei ändert an der Anwendung nichts — sie meldet nur Befunde.
   ============================================================ */
import postgres from "postgres";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";

const HIER = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HIER, "..");

const BASIS = (process.argv[2] || "http://localhost:3007").replace(/\/$/, "");
const TIMEOUT_MS = 60_000;
const TS = Date.now();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a)"); process.exit(2); }
const sql = postgres(DATABASE_URL, { max: 4, onnotice: () => {} });

/* ---------- Kennungen für Personen und Ergebnisse ---------- */
const EMAIL_A = `a+${TS}@example.com`;
const EMAIL_B = `b+${TS}@example.com`;
const PASSWORT = "TestPasswort123!";
const MOD_EMAIL_STANDARD = "mod@fourwalls.example";
const MOD_PASSWORT_STANDARD = "moderation-langes-passwort";

const BILD_PFAD = join(APP_ROOT, "public", "media", "zurich-altbau-1-960.jpg");

const ergebnisse = [];

function assertTrue(bedingung, meldung) { if (!bedingung) throw new Error(meldung); }
function assertGleich(ist, soll, feld) {
  if (ist !== soll) throw new Error(`${feld}: erwartet ${JSON.stringify(soll)}, erhalten ${JSON.stringify(ist)}`);
}

async function pruef(id, titel, fn) {
  try {
    const detail = (await fn()) || "ok";
    ergebnisse.push({ id, titel, status: "OK", detail });
    console.log(`OK      ${id.padEnd(5)} ${titel}`);
  } catch (e) {
    const detail = e && e.message ? e.message : String(e);
    ergebnisse.push({ id, titel, status: "FEHLER", detail });
    console.log(`FEHLER  ${id.padEnd(5)} ${titel} — ${detail}`);
  }
}

/* ---------- Verschiedene x-forwarded-for-Adressen, damit eigene Läufe
   nicht in die eigenen Ratenlimits laufen (Anmeldung 8/5min, Registrierung
   5/h je Herkunft/Adresse). ---------- */
const RUNSEED = Math.floor(Math.random() * 200) + 10;
const xffMap = new Map();
function xff(tag) {
  if (!xffMap.has(tag)) xffMap.set(tag, `10.${RUNSEED}.${xffMap.size + 1}.7`);
  return xffMap.get(tag);
}

/* ---------- HTTP-Hilfsfunktionen ---------- */
async function api(method, pfad, { cookie, origin, secFetchSite, xffTag, body, headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const h = { ...headers };
    if (cookie) h["cookie"] = cookie;
    if (origin !== undefined) h["origin"] = origin;
    if (secFetchSite) h["sec-fetch-site"] = secFetchSite;
    if (xffTag) h["x-forwarded-for"] = xff(xffTag);
    let payload;
    if (body !== undefined) { h["content-type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await fetch(BASIS + pfad, { method, headers: h, body: payload, redirect: "manual", signal: ctrl.signal });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* kein JSON */ }
    const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    return { status: res.status, json, text, setCookies, headers: res.headers };
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

/* ---------- Mail: die neueste Bestätigungsmail für eine Adresse finden und aufrufen ---------- */
const MAIL_ORDNER = join(APP_ROOT, "var", "mail");
function neuesteMailFuer(email) {
  const dateien = readdirSync(MAIL_ORDNER).filter(f => f.endsWith(".json"));
  let beste = null, besteZeit = -1;
  for (const f of dateien) {
    let j; try { j = JSON.parse(readFileSync(join(MAIL_ORDNER, f), "utf8")); } catch { continue; }
    if (j.an !== email) continue;
    const z = new Date(j.zeit).getTime();
    if (z > besteZeit) { besteZeit = z; beste = j; }
  }
  return beste;
}
async function bestaetigeMail(email) {
  const mail = neuesteMailFuer(email);
  if (!mail) throw new Error(`Keine Mail für ${email} in var/mail gefunden`);
  const treffer = mail.text.match(/https?:\/\/\S+/);
  if (!treffer) throw new Error(`Keine URL in der Mail an ${email} gefunden`);
  const res = await fetch(treffer[0], { redirect: "manual" });
  return res.status;
}

/* ---------- Registrieren / Anmelden ---------- */
async function registrieren(email, passwort, name, xffTag, zusatz = {}) {
  return post("/api/auth/sign-up/email", { origin: BASIS, xffTag, body: { email, password: passwort, name, ...zusatz } });
}
async function anmelden(email, passwort, xffTag) {
  const r = await post("/api/auth/sign-in/email", { origin: BASIS, xffTag, body: { email, password: passwort } });
  return { ...r, cookie: cookieAus(r.setCookies) };
}

/* ---------- Einen vollständigen Entwurf aufbauen ---------- */
async function entwurfVollstaendigAnlegen(cookie, { name, email, titel, beschreibung, bildId }) {
  const angelegt = await post("/api/entwuerfe", { origin: BASIS, cookie, body: {} });
  assertGleich(angelegt.status, 201, "entwurf anlegen");
  const ref = angelegt.json.publicRef;
  let version = angelegt.json.version;

  let benutzterBildId = bildId;
  if (!benutzterBildId) {
    const hoch = await uploadDatei(cookie, BILD_PFAD, "foto.jpg", "image/jpeg");
    assertGleich(hoch.status, 201, "bild hochladen");
    benutzterBildId = hoch.json.id;
  }

  const daten = {
    trans: "sale", typ: "wohnung", ortId: "ort-bern", genauigkeit: "ungefaehr",
    zimmer: 3.5, flaeche: 90, preis: 750000,
    titel: titel ?? "Schöne Altbauwohnung in Bern",
    beschreibung: beschreibung ?? "Eine wunderschöne, helle Altbauwohnung mit viel Charme und Platz für die ganze Familie.",
    name, email,
    bilder: [benutzterBildId]
  };
  const gespeichert = await patch(`/api/entwuerfe/${ref}`, { origin: BASIS, cookie, body: { version, daten } });
  assertGleich(gespeichert.status, 200, "entwurf vollständig speichern");
  version = gespeichert.json.version;
  return { ref, version, bildId: benutzterBildId };
}

/* ============================================================
   VORBEREITUNG
   ============================================================ */
let A, B, MOD;
let refA, versionA, bildIdA;
let refB, versionB, bildIdB;
const [{ count: listingCountVorher }] = await sql`SELECT count(*)::int AS count FROM listing`;

async function vorbereiten() {
  console.log(`Basis: ${BASIS}  —  Vorbereitung startet (TS=${TS})`);

  /* USER A: registrieren, bestätigen, anmelden */
  const suA = await registrieren(EMAIL_A, PASSWORT, "User A", "a-signup");
  assertGleich(suA.status, 200, "sign-up A");
  await bestaetigeMail(EMAIL_A);
  const siA = await anmelden(EMAIL_A, PASSWORT, "a-auth");
  assertGleich(siA.status, 200, "sign-in A");
  assertTrue(!!siA.cookie, "kein Sitzungscookie für A erhalten");
  A = { email: EMAIL_A, cookie: siA.cookie, id: siA.json.user.id };

  /* USER B: registrieren, bestätigen, anmelden */
  const suB = await registrieren(EMAIL_B, PASSWORT, "User B", "b-signup");
  assertGleich(suB.status, 200, "sign-up B");
  await bestaetigeMail(EMAIL_B);
  const siB = await anmelden(EMAIL_B, PASSWORT, "b-auth");
  assertGleich(siB.status, 200, "sign-in B");
  assertTrue(!!siB.cookie, "kein Sitzungscookie für B erhalten");
  B = { email: EMAIL_B, cookie: siB.cookie, id: siB.json.user.id };

  /* MODERATOR: anmelden, sonst registrieren + Rolle setzen */
  let siMod = await anmelden(MOD_EMAIL_STANDARD, MOD_PASSWORT_STANDARD, "mod-auth");
  let modEmail = MOD_EMAIL_STANDARD;
  if (siMod.status !== 200 || !siMod.cookie) {
    modEmail = `mod+${TS}@fourwalls.example`;
    const suMod = await registrieren(modEmail, MOD_PASSWORT_STANDARD, "Moderator Test", "mod-signup");
    assertGleich(suMod.status, 200, "sign-up Moderator (Fallback)");
    await bestaetigeMail(modEmail);
    siMod = await anmelden(modEmail, MOD_PASSWORT_STANDARD, "mod-auth");
    assertGleich(siMod.status, 200, "sign-in Moderator (Fallback)");
    execFileSync(process.execPath, [join(APP_ROOT, "scripts", "rolle.mjs"), modEmail, "moderator"], { stdio: "inherit", env: process.env });
  }
  /* Sicherstellen, dass die E-Mail bestätigt ist — sonst kann der Moderator
     später sein eigenes Inserat gar nicht erst einreichen (§16). */
  const [modRow] = await sql`SELECT email_verified FROM app_user WHERE email = ${modEmail}`;
  if (modRow && !modRow.email_verified) {
    await post("/api/auth/send-verification-email", { origin: BASIS, body: { email: modEmail, callbackURL: "/" } });
    await bestaetigeMail(modEmail);
  }
  MOD = { email: modEmail, cookie: siMod.cookie, id: siMod.json.user.id };

  /* USER A: vollständigen Entwurf anlegen */
  const eA = await entwurfVollstaendigAnlegen(A.cookie, { name: "User A", email: EMAIL_A });
  refA = eA.ref; versionA = eA.version; bildIdA = eA.bildId;

  /* USER B: vollständigen Entwurf anlegen (eigenes Bild) */
  const eB = await entwurfVollstaendigAnlegen(B.cookie, { name: "User B", email: EMAIL_B });
  refB = eB.ref; versionB = eB.version; bildIdB = eB.bildId;

  console.log(`Vorbereitung fertig: A=${A.id} (${refA})  B=${B.id} (${refB})  MOD=${MOD.id} (${MOD.email})`);
}

await vorbereiten();

/* ============================================================
   A. IDOR-MATRIX (§65)
   ============================================================ */

await pruef("A1", "B liest A-Entwurf → 404", async () => {
  const r = await get(`/api/entwuerfe/${refA}`, { cookie: B.cookie });
  assertGleich(r.status, 404, "status");
  return `status=${r.status}`;
});

await pruef("A2", "B speichert in A-Entwurf → 404", async () => {
  const r = await patch(`/api/entwuerfe/${refA}`, { origin: BASIS, cookie: B.cookie, body: { version: versionA, daten: { titel: "Übernommen" } } });
  assertGleich(r.status, 404, "status");
  return `status=${r.status}`;
});

await pruef("A3", "B reicht A-Entwurf ein → 404", async () => {
  const r = await post(`/api/entwuerfe/${refA}/aktion`, { origin: BASIS, cookie: B.cookie, body: { absicht: "einreichen" } });
  assertGleich(r.status, 404, "status");
  return `status=${r.status}`;
});

await pruef("A4", "B zieht A-Entwurf zurück → 404", async () => {
  const r = await post(`/api/entwuerfe/${refA}/aktion`, { origin: BASIS, cookie: B.cookie, body: { absicht: "zurueckziehen" } });
  assertGleich(r.status, 404, "status");
  return `status=${r.status}`;
});

await pruef("A5", "B hängt A-Bild an eigenen Entwurf und reicht ein → PATCH oder Einreichen scheitert; keine listing_image-Zeile entsteht", async () => {
  const bPatch = await patch(`/api/entwuerfe/${refB}`, { origin: BASIS, cookie: B.cookie, body: { version: versionB, daten: { bilder: [bildIdA] } } });
  let details = [`patch=${bPatch.status}`];
  if (bPatch.status === 200) {
    versionB = bPatch.json.version;
    const aktion = await post(`/api/entwuerfe/${refB}/aktion`, { origin: BASIS, cookie: B.cookie, body: { absicht: "einreichen" } });
    details.push(`einreichen=${aktion.status}`);
    assertTrue(aktion.status === 403 || aktion.status === 422, `Einreichen mit fremdem Bild hätte scheitern müssen, war ${aktion.status}`);
  } else {
    assertTrue(bPatch.status === 403 || bPatch.status === 422, `PATCH mit fremdem Bild hätte scheitern müssen, war ${bPatch.status}`);
  }
  const zeilen = await sql`
    SELECT 1 FROM listing_image li JOIN listing l ON l.id = li.listing_id
     WHERE l.public_ref = ${refB} AND li.asset_id = ${bildIdA}`;
  assertGleich(zeilen.length, 0, "listing_image mit fremdem Bild an B's Inserat");
  return details.join(", ") + ", listing_image-Zeilen=0";
});

await pruef("A6", "B löscht A-Bild → 404", async () => {
  const r = await del(`/api/medien/${bildIdA}`, { origin: BASIS, cookie: B.cookie });
  assertGleich(r.status, 404, "status");
  return `status=${r.status}`;
});

await pruef("A7", "B ruft A-Bild ab → 404 (Entwurf unveröffentlicht)", async () => {
  const r = await get(`/api/medien/${bildIdA}`, { cookie: B.cookie });
  assertGleich(r.status, 404, "status");
  return `status=${r.status}`;
});

await pruef("A8", "Anonym ruft A-Bild ab → 404", async () => {
  const r = await get(`/api/medien/${bildIdA}`, {});
  assertGleich(r.status, 404, "status");
  return `status=${r.status}`;
});

await pruef("A9", "B öffnet Moderationswarteschlange → 403", async () => {
  const r = await get("/api/moderation", { cookie: B.cookie });
  assertGleich(r.status, 403, "status");
  return `status=${r.status}`;
});

await pruef("A10", "B öffnet A-Fall in der Moderation → 403", async () => {
  const r = await get(`/api/moderation/${refA}`, { cookie: B.cookie });
  assertGleich(r.status, 403, "status");
  return `status=${r.status}`;
});

await pruef("A11", "B genehmigt A-Inserat → 403", async () => {
  const r = await post(`/api/moderation/${refA}`, { origin: BASIS, cookie: B.cookie, body: { absicht: "freigeben" } });
  assertGleich(r.status, 403, "status");
  return `status=${r.status}`;
});

await pruef("A12", "Anonym: GET Entwurf → 401, GET Moderationswarteschlange → 401", async () => {
  const r1 = await get(`/api/entwuerfe/${refA}`, {});
  const r2 = await get("/api/moderation", {});
  assertGleich(r1.status, 401, "entwuerfe/:ref anonym");
  assertGleich(r2.status, 401, "moderation anonym");
  return `entwuerfe=${r1.status}, moderation=${r2.status}`;
});

/* ============================================================
   B. RECHTEAUSWEITUNG (§66)
   ============================================================ */

await pruef("B13", "Registrierung mit platform_role:'admin' im Body → 400/422, Konto (falls angelegt) hat platform_role='user'", async () => {
  const email = `esc13+${TS}@example.com`;
  const r = await registrieren(email, PASSWORT, "Esc13", "esc13-signup", { platform_role: "admin" });
  assertTrue(r.status === 400 || r.status === 422, `erwartet 400/422, erhalten ${r.status}`);
  const zeilen = await sql`SELECT platform_role FROM app_user WHERE email = ${email}`;
  if (zeilen[0]) assertGleich(zeilen[0].platform_role, "user", "platform_role in DB");
  return `status=${r.status}, dbRolle=${zeilen[0]?.platform_role ?? "kein Konto angelegt"}`;
});

await pruef("B14", "Registrierung mit role:'admin' → Konto hat platform_role='user'", async () => {
  const email = `esc14+${TS}@example.com`;
  const r = await registrieren(email, PASSWORT, "Esc14", "esc14-signup", { role: "admin" });
  assertTrue(r.status === 200 || r.status === 400 || r.status === 422, `unerwarteter Status ${r.status}`);
  const zeilen = await sql`SELECT platform_role FROM app_user WHERE email = ${email}`;
  if (zeilen[0]) assertGleich(zeilen[0].platform_role, "user", "platform_role in DB");
  return `status=${r.status}, dbRolle=${zeilen[0]?.platform_role ?? "kein Konto angelegt"}`;
});

await pruef("B15", "PATCH mit daten.status:'published' → 422, Status in DB unverändert", async () => {
  const [vor] = await sql`SELECT status FROM listing WHERE public_ref = ${refA}`;
  const r = await patch(`/api/entwuerfe/${refA}`, { origin: BASIS, cookie: A.cookie, body: { version: versionA, daten: { status: "published" } } });
  assertGleich(r.status, 422, "status");
  const [nach] = await sql`SELECT status FROM listing WHERE public_ref = ${refA}`;
  assertGleich(nach.status, vor.status, "listing.status in DB");
  return `status=${r.status}, dbStatus vorher/nachher=${vor.status}/${nach.status}`;
});

await pruef("B16", "PATCH mit daten.ownerId:'<B>' → 422, Eigentümer in DB unverändert", async () => {
  const [vor] = await sql`SELECT published_by_user_id FROM listing WHERE public_ref = ${refA}`;
  const r = await patch(`/api/entwuerfe/${refA}`, { origin: BASIS, cookie: A.cookie, body: { version: versionA, daten: { ownerId: B.id } } });
  assertGleich(r.status, 422, "status");
  const [nach] = await sql`SELECT published_by_user_id FROM listing WHERE public_ref = ${refA}`;
  assertGleich(String(nach.published_by_user_id), String(vor.published_by_user_id), "listing.published_by_user_id in DB");
  return `status=${r.status}, owner unverändert=${nach.published_by_user_id === vor.published_by_user_id}`;
});

await pruef("B17", "Gefälschtes Sitzungscookie → 401", async () => {
  const r = await get(`/api/entwuerfe/${refA}`, { cookie: "fw.session_token=abc123zzzgefaelschtestokenwert" });
  assertGleich(r.status, 401, "status");
  return `status=${r.status}`;
});

/* ============================================================
   C. MODERATIONS-INTEGRITÄT (§42/§74)
   ============================================================ */

await pruef("C18", "A reicht ein (200); A versucht 'veroeffentlichen' auf eigenem Inserat → 403", async () => {
  const einreichen = await post(`/api/entwuerfe/${refA}/aktion`, { origin: BASIS, cookie: A.cookie, body: { absicht: "einreichen" } });
  assertGleich(einreichen.status, 200, "einreichen");
  const versuch = await post(`/api/moderation/${refA}`, { origin: BASIS, cookie: A.cookie, body: { absicht: "veroeffentlichen" } });
  assertGleich(versuch.status, 403, "veroeffentlichen durch A");
  return `einreichen=${einreichen.status}, veroeffentlichen(A)=${versuch.status}`;
});

await pruef("C19", "Moderator liest Fall (200); Änderung ohne Nachricht → 422", async () => {
  const fall = await get(`/api/moderation/${refA}`, { cookie: MOD.cookie });
  assertGleich(fall.status, 200, "fall lesen");
  const ohneNachricht = await post(`/api/moderation/${refA}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "aenderung", grund: "incomplete" } });
  assertGleich(ohneNachricht.status, 422, "aenderung ohne nachricht");
  return `fall=${fall.status}, aenderungOhneNachricht=${ohneNachricht.status}`;
});

const RUECKMELDUNG_TEXT = "Bitte ergänzen Sie ein zweites Foto vom Wohnzimmer, das erste ist zu dunkel.";
await pruef("C20", "Moderator verlangt Änderung mit Nachricht → 200; A sieht sie unter rueckmeldung.nachricht", async () => {
  const mitNachricht = await post(`/api/moderation/${refA}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "aenderung", grund: "incomplete", nachricht: RUECKMELDUNG_TEXT } });
  assertGleich(mitNachricht.status, 200, "aenderung mit nachricht");
  const gelesen = await get(`/api/entwuerfe/${refA}`, { cookie: A.cookie });
  assertGleich(gelesen.status, 200, "A liest eigenen entwurf");
  assertGleich(gelesen.json?.rueckmeldung?.nachricht, RUECKMELDUNG_TEXT, "rueckmeldung.nachricht");
  versionA = gelesen.json.version;
  return `aenderung=${mitNachricht.status}, rueckmeldung sichtbar=ja`;
});

await pruef("C21", "A reicht erneut ein → 200; Moderator 'freigeben-und-veroeffentlichen' → 200", async () => {
  const erneut = await post(`/api/entwuerfe/${refA}/aktion`, { origin: BASIS, cookie: A.cookie, body: { absicht: "einreichen" } });
  assertGleich(erneut.status, 200, "erneut einreichen");
  const freigabe = await post(`/api/moderation/${refA}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "freigeben-und-veroeffentlichen" } });
  assertGleich(freigabe.status, 200, "freigeben-und-veroeffentlichen");
  return `einreichen=${erneut.status}, freigabe=${freigabe.status}`;
});

await pruef("C22", "audit_log: vollständige Statusfolge mit gesetztem actor_user_id", async () => {
  const zeilen = await sql`
    SELECT al.previous_state AS von, al.new_state AS nach, al.actor_user_id AS akteur
      FROM audit_log al JOIN listing l ON l.id = al.entity_id
     WHERE al.entity_type = 'listing' AND l.public_ref = ${refA}
     ORDER BY al.created_at ASC, al.id ASC`;
  const erwartet = [
    ["draft", "submitted"], ["submitted", "in_review"], ["in_review", "changes_required"],
    ["changes_required", "submitted"], ["submitted", "in_review"], ["in_review", "approved"], ["approved", "published"]
  ];
  assertGleich(zeilen.length, erwartet.length, "Anzahl audit_log-Zeilen");
  for (let i = 0; i < erwartet.length; i++) {
    assertGleich(zeilen[i].von, erwartet[i][0], `Zeile ${i} von`);
    assertGleich(zeilen[i].nach, erwartet[i][1], `Zeile ${i} nach`);
    assertTrue(zeilen[i].akteur != null, `Zeile ${i}: actor_user_id ist null`);
  }
  return `Statusfolge korrekt (${zeilen.length} Übergänge, alle mit actor_user_id)`;
});

await pruef("C23", "Moderator als Eigentümer: eigenes Inserat freigeben → 403 (eigenes-inserat)", async () => {
  const eMod = await entwurfVollstaendigAnlegen(MOD.cookie, { name: "Moderator Test", email: MOD.email });
  const einreichen = await post(`/api/entwuerfe/${eMod.ref}/aktion`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "einreichen" } });
  assertGleich(einreichen.status, 200, "moderator reicht eigenen entwurf ein");
  const freigeben = await post(`/api/moderation/${eMod.ref}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "freigeben" } });
  assertGleich(freigeben.status, 403, "moderator gibt eigenes inserat frei");
  return `einreichen=${einreichen.status}, freigeben eigenes Inserat=${freigeben.status} (${eMod.ref})`;
});

/* ============================================================
   D. HERKUNFT/CSRF (§64)
   ============================================================ */

await pruef("D24", "POST /api/entwuerfe mit fremder Herkunft → 403", async () => {
  const r = await post("/api/entwuerfe", { origin: "https://boese.example", cookie: A.cookie, body: {} });
  assertGleich(r.status, 403, "status");
  return `status=${r.status}`;
});

await pruef("D25", "PATCH mit sec-fetch-site: cross-site → 403", async () => {
  const r = await patch(`/api/entwuerfe/${refA}`, { origin: BASIS, cookie: A.cookie, secFetchSite: "cross-site", body: { version: versionA, daten: {} } });
  assertGleich(r.status, 403, "status");
  return `status=${r.status}`;
});

await pruef("D26", "POST /api/moderation/:ref mit fremder Herkunft → 403", async () => {
  const r = await post(`/api/moderation/${refA}`, { origin: "https://boese.example", cookie: MOD.cookie, body: { absicht: "freigeben" } });
  assertGleich(r.status, 403, "status");
  return `status=${r.status}`;
});

/* ============================================================
   E. DATEIANGRIFFE (§69)
   ============================================================ */

await pruef("E27", "SVG mit <script> als .jpg hochladen → 422", async () => {
  const svg = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "utf8");
  const r = await uploadBytes(A.cookie, svg, "bild.jpg", "image/jpeg");
  assertGleich(r.status, 422, "status");
  return `status=${r.status}, message=${r.json?.message}`;
});

await pruef("E28", "Shell-Skript als .jpg → 422", async () => {
  const sh = Buffer.from("#!/bin/bash\necho hacked\n", "utf8");
  const r = await uploadBytes(A.cookie, sh, "bild.jpg", "image/jpeg");
  assertGleich(r.status, 422, "status");
  return `status=${r.status}, message=${r.json?.message}`;
});

await pruef("E29", "Datei > 9 MB → 422 oder 413", async () => {
  const kopf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const rest = randomBytes(10 * 1024 * 1024);
  const gross = Buffer.concat([kopf, rest]);
  const r = await uploadBytes(A.cookie, gross, "bild.jpg", "image/jpeg");
  assertTrue(r.status === 422 || r.status === 413, `erwartet 422/413, erhalten ${r.status}`);
  return `status=${r.status}, message=${r.json?.message}`;
});

await pruef("E30", "Dateiname mit Pfadwechsel — kein Datei-Escape, Speichername folgt <uuid>.<jpg|png|webp>", async () => {
  const r = await uploadDatei(A.cookie, BILD_PFAD, "../../etc/passwd.jpg", "image/jpeg");
  assertTrue(r.status === 201 || r.status === 422, `unerwarteter Status ${r.status}`);
  let details = [`status=${r.status}`];
  if (r.status === 201) {
    const id = r.json.id;
    const [zeile] = await sql`SELECT storage_key FROM media_asset WHERE id = ${id}`;
    assertTrue(!!zeile, "media_asset-Zeile nicht gefunden");
    assertTrue(/^upload\/[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(zeile.storage_key), `storage_key entspricht nicht dem Muster: ${zeile.storage_key}`);
    const dateiName = zeile.storage_key.replace(/^upload\//, "");
    assertTrue(existsSync(join(APP_ROOT, "var", "uploads", dateiName)), "Datei liegt nicht in var/uploads");
    details.push(`storage_key=${zeile.storage_key}`);
  }
  /* Ausserhalb von var/uploads darf nichts entstanden sein. */
  assertTrue(!existsSync(join(APP_ROOT, "etc", "passwd.jpg")), "Datei ausserhalb von var/uploads entstanden (app-root/etc)");
  assertTrue(!existsSync(join(APP_ROOT, "..", "etc", "passwd.jpg")), "Datei ausserhalb von var/uploads entstanden (../etc)");
  assertTrue(!existsSync(join(APP_ROOT, "public", "media", "passwd.jpg")), "Datei ausserhalb von var/uploads entstanden (public/media)");
  const inhalt = readdirSync(join(APP_ROOT, "var", "uploads"));
  assertTrue(!inhalt.some(f => f.includes("passwd")), "eine Datei mit 'passwd' im Namen liegt in var/uploads");
  return details.join(", ") + ", keine Datei ausserhalb var/uploads";
});

await pruef("E31", "Fremde Asset-ID im Entwurf — DB-Gegenkontrolle (siehe A5)", async () => {
  const zeilen = await sql`
    SELECT 1 FROM listing_image li JOIN listing l ON l.id = li.listing_id
     WHERE l.public_ref = ${refB} AND li.asset_id = ${bildIdA}`;
  assertGleich(zeilen.length, 0, "listing_image mit fremdem Bild an B's Inserat");
  return "keine listing_image-Zeile mit fremdem Asset (bestätigt aus A5)";
});

/* ============================================================
   F. EINSCHLEUSUNG (§68)
   ============================================================ */

await pruef("F32", "Titel/Beschreibung mit <script> und onerror — öffentliche Seite escaped, kein aktives Element", async () => {
  const titelPayload = "<script>alert(1)</script>";
  const beschreibungPayload = "<script>alert(1)</script><img src=x onerror=alert(1)> Sicherheitstest für das Escaping der Ausgabe.";
  const e = await entwurfVollstaendigAnlegen(A.cookie, {
    name: "User A", email: EMAIL_A, titel: titelPayload, beschreibung: beschreibungPayload, bildId: bildIdA
  });
  const einreichen = await post(`/api/entwuerfe/${e.ref}/aktion`, { origin: BASIS, cookie: A.cookie, body: { absicht: "einreichen" } });
  assertGleich(einreichen.status, 200, "einreichen (XSS-Entwurf)");
  const veroeffentlichen = await post(`/api/moderation/${e.ref}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "freigeben-und-veroeffentlichen" } });
  assertGleich(veroeffentlichen.status, 200, "freigeben-und-veroeffentlichen (XSS-Entwurf)");

  const [zeile] = await sql`SELECT slug, transaction FROM listing WHERE public_ref = ${e.ref}`;
  assertTrue(!!zeile && !!zeile.slug, "kein Slug für veröffentlichtes Inserat gefunden");
  const bereich = zeile.transaction === "rent" ? "mieten" : "kaufen";
  const url = `${BASIS}/de/immobilien/${bereich}/${zeile.slug}-${e.ref.toLowerCase()}`;
  const seite = await fetch(url, { redirect: "manual" });
  assertGleich(seite.status, 200, `status der öffentlichen Seite (${url})`);
  const html = await seite.text();
  assertTrue(!html.includes("<script>alert(1)</script>"), "unescaped <script>alert(1)</script> in der Ausgabe gefunden");
  assertTrue(!html.includes("<img src=x onerror=alert(1)>"), "aktives, unescaptes <img onerror> in der Ausgabe gefunden");
  assertTrue(html.includes("&lt;script&gt;"), "escapte Form (&lt;script&gt;) nicht in der Ausgabe gefunden");
  assertTrue(html.includes("&lt;img src=x onerror=alert(1)&gt;") || html.includes("\\u003cimg src=x onerror=alert(1)\\u003e"), "escapte Form des img-Tags nicht in der Ausgabe gefunden");
  return `Seite=200, kein aktives <script>, escapte Form vorhanden (${url})`;
});

await pruef("F33", "SQL-Einschleusung in der Referenz → 404, listing-Anzahl unverändert", async () => {
  const [{ count: vor }] = await sql`SELECT count(*)::int AS count FROM listing`;
  const boesePfad = "/api/entwuerfe/" + encodeURIComponent("FWL-2026-000001' OR 1=1--");
  const r = await get(boesePfad, { cookie: A.cookie });
  assertGleich(r.status, 404, "status");
  const [{ count: nach }] = await sql`SELECT count(*)::int AS count FROM listing`;
  assertGleich(nach, vor, "listing-Anzahl vor/nach der Einschleusung");
  return `status=${r.status}, listing-Anzahl unverändert (${vor})`;
});

/* ============================================================
   G. AUFZÄHLUNGSSCHUTZ (§86)
   ============================================================ */

await pruef("G34", "Anmeldung: unbekannte E-Mail vs. bekannte E-Mail+falsches Passwort — gleicher Status und gleiche Meldung", async () => {
  const unbekannt = await anmelden(`kein-konto-${TS}@example.com`, "irgendeinPasswort123", "enum-auth");
  const falschesPw = await anmelden(EMAIL_A, "definitivFalschesPw123", "enum-auth");
  assertGleich(unbekannt.status, falschesPw.status, "Statuscode");
  assertGleich(unbekannt.json?.message, falschesPw.json?.message, "Fehlermeldung");
  assertGleich(unbekannt.json?.code, falschesPw.json?.code, "Fehlercode");
  return `status=${unbekannt.status} für beide, message="${unbekannt.json?.message}"`;
});

await pruef("G35", "Passwort-Zurücksetzen: unbekannte vs. bekannte E-Mail — gleicher Statuscode", async () => {
  const unbekannt = await post("/api/auth/request-password-reset", { origin: BASIS, xffTag: "enum-forget", body: { email: `kein-konto-${TS}@example.com`, redirectTo: "/" } });
  const bekannt = await post("/api/auth/request-password-reset", { origin: BASIS, xffTag: "enum-forget", body: { email: EMAIL_A, redirectTo: "/" } });
  assertGleich(unbekannt.status, bekannt.status, "Statuscode");
  return `status=${unbekannt.status} für beide`;
});

await pruef("G36", "Registrierung mit vergebener E-Mail — keine zweite Zeile in DB, altes Passwort funktioniert weiter", async () => {
  const [{ count: vor }] = await sql`SELECT count(*)::int AS count FROM app_user WHERE email = ${EMAIL_A}`;
  const r = await registrieren(EMAIL_A, "einAnderesPasswort123", "Dup A", "dup36-signup");
  assertGleich(r.status, 200, "status (Attrappe erwartet)");
  const [{ count: nach }] = await sql`SELECT count(*)::int AS count FROM app_user WHERE email = ${EMAIL_A}`;
  assertGleich(nach, vor, "Anzahl Konten mit A's E-Mail");
  assertGleich(vor, 1, "es sollte genau ein Konto mit A's E-Mail geben");
  const nochGueltig = await anmelden(EMAIL_A, PASSWORT, "enum-auth");
  assertGleich(nochGueltig.status, 200, "ursprüngliches Passwort funktioniert weiterhin");
  return `signup=${r.status}, Konten=${nach}, ursprüngliches Passwort gültig=ja`;
});

/* ============================================================
   H. SITZUNG (§61/§76)
   ============================================================ */

await pruef("H37", "Nach sign-out: dasselbe Cookie liefert 401", async () => {
  const signout = await post("/api/auth/sign-out", { origin: BASIS, cookie: A.cookie, body: {} });
  assertGleich(signout.status, 200, "sign-out");
  const danach = await get(`/api/entwuerfe/${refA}`, { cookie: A.cookie });
  assertGleich(danach.status, 401, "entwuerfe/:ref nach sign-out");
  return `sign-out=${signout.status}, danach=${danach.status}`;
});

await pruef("H38", "Serverseitig widerrufene Sitzung: altes Cookie liefert 401", async () => {
  const frisch = await anmelden(EMAIL_A, PASSWORT, "a-auth");
  assertGleich(frisch.status, 200, "erneute Anmeldung A");
  const rohWert = decodeURIComponent(frisch.cookie.split("=").slice(1).join("="));
  const token = rohWert.split(".")[0];
  const geloescht = await sql`DELETE FROM auth_session WHERE token = ${token} RETURNING id`;
  assertGleich(geloescht.length, 1, "genau eine auth_session-Zeile gelöscht");
  const danach = await get(`/api/entwuerfe/${refA}`, { cookie: frisch.cookie });
  assertGleich(danach.status, 401, "entwuerfe/:ref nach serverseitigem Widerruf");
  return `sitzung gelöscht=${geloescht.length}, danach=${danach.status}`;
});

/* ============================================================
   ABSCHLUSS: listing-Anzahl, Tabelle, Bericht
   ============================================================ */

const [{ count: listingCountNachher }] = await sql`SELECT count(*)::int AS count FROM listing`;
const erzeugteEntwuerfe = 4; /* refA, refB, C23-Moderator-Entwurf, F32-XSS-Entwurf */
const listingDiffOk = listingCountNachher - listingCountVorher === erzeugteEntwuerfe;
ergebnisse.push({
  id: "Z", titel: `listing-Anzahl vorher/nachher (${listingCountVorher} → ${listingCountNachher}, erwartet +${erzeugteEntwuerfe})`,
  status: listingDiffOk ? "OK" : "FEHLER",
  detail: listingDiffOk ? "Differenz entspricht den selbst erzeugten Entwürfen" : `unerwartete Differenz: ${listingCountNachher - listingCountVorher}`
});

function tabelle() {
  const w1 = Math.max(2, ...ergebnisse.map(e => e.id.length));
  const w2 = Math.max(20, ...ergebnisse.map(e => e.titel.length));
  const w3 = 6;
  const zeile = (a, b, c, d) => `${String(a).padEnd(w1)}  ${String(b).padEnd(w2)}  ${String(c).padEnd(w3)}  ${d}`;
  console.log("\n" + zeile("Nr", "Prüfung", "Status", "Detail"));
  console.log("-".repeat(w1 + w2 + w3 + 10));
  for (const e of ergebnisse) console.log(zeile(e.id, e.titel, e.status, e.detail));
}
tabelle();

const fehlerAnzahl = ergebnisse.filter(e => e.status === "FEHLER").length;
console.log(`\n${ergebnisse.length} Prüfungen, ${fehlerAnzahl} FEHLER, ${ergebnisse.length - fehlerAnzahl} OK`);

const bericht = {
  basis: BASIS, zeit: new Date().toISOString(), personen: { a: EMAIL_A, b: EMAIL_B, moderator: MOD.email },
  listingCountVorher, listingCountNachher,
  ergebnisse
};
const berichtPfad = join(APP_ROOT, "var", "sicherheit-bericht.json");
await import("node:fs/promises").then(fs => fs.writeFile(berichtPfad, JSON.stringify(bericht, null, 2)));
console.log(`Bericht geschrieben: ${berichtPfad}`);

await sql.end();
process.exit(fehlerAnzahl > 0 ? 1 : 0);
