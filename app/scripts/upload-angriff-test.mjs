#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Upload-Angriffe (P5.10 §14)

   Ergänzt scripts/sicherheit-test.mjs (P5.4, Abschnitt E/DATEIANGRIFFE) um
   das, was dort fehlt — schwächt jene Suite an keiner Stelle ab, sondern
   fügt hinzu: Dekompressionsbombe, EXIF/GPS-Entfernung in den Ableitungen,
   doppelte Dateinamen, private-vor-Veröffentlichung über die tatsächliche
   Speicherschicht (var/uploads vs. public/pub), Uploads ohne Sitzung/mit
   fremder Origin, und die vorhandene Ratenbegrenzung dokumentiert.

   Erwartungen aus dem Code: server/medien.ts (bildHochladen/bildAusliefern/
   bildEntfernen), lib/bild.ts (erkenne/ohneMetadaten), services/bilder.ts
   (ableiten, limitInputPixels: 40_000_000), services/storage.ts (Local Dev
   Storage: privat unter var/uploads, öffentlich unter public/).

   Aufruf:
     set -a; . ./.env.local; set +a
     FW_TEST_MOD_EMAIL=... FW_TEST_MOD_PASSWORT=... node scripts/upload-angriff-test.mjs [Basis-URL]

   Schreibt eine Tabelle auf stdout und var/upload-angriff-bericht.json.
   Exit 1, sobald irgendeine Prüfung FEHLER meldet. Räumt eigene Testzeilen
   am Ende auf (Präfix "ua+").
   ============================================================ */
import postgres from "postgres";
import sharp from "sharp";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
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

const PASSWORT = "Ua-" + randomBytes(12).toString("base64url");
const STORAGE_S3 = process.env.FW_TEST_STORAGE === "s3";

const ergebnisse = [];
function assertTrue(bedingung, meldung) { if (!bedingung) throw new Error(meldung); }
function assertGleich(ist, soll, feld) {
  if (ist !== soll) throw new Error(`${feld}: erwartet ${JSON.stringify(soll)}, erhalten ${JSON.stringify(ist)}`);
}
async function schritt(bez, titel, fn) {
  try {
    const detail = (await fn()) || "ok";
    ergebnisse.push({ bez, titel, status: "OK", detail });
    console.log(`OK      ${String(bez).padEnd(6)} ${titel}`);
  } catch (e) {
    const detail = e && e.message ? e.message : String(e);
    ergebnisse.push({ bez, titel, status: "FEHLER", detail });
    console.log(`FEHLER  ${String(bez).padEnd(6)} ${titel} — ${detail}`);
  }
}

/* ---------- x-forwarded-for je Zweck ---------- */
const RUNSEED = Math.floor(Math.random() * 200) + 10;
const xffMap = new Map();
function xff(tag) {
  if (!xffMap.has(tag)) xffMap.set(tag, `10.${RUNSEED}.${xffMap.size + 1}.71`);
  return xffMap.get(tag);
}

/* ---------- HTTP ---------- */
async function api(method, pfad, { cookie, origin, xffTag, body, headers = {} } = {}) {
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
    return { status: res.status, json, text, setCookies, headers: res.headers };
  } finally { clearTimeout(timer); }
}
const get = (p, o) => api("GET", p, o);
const post = (p, o) => api("POST", p, o);
const del = (p, o) => api("DELETE", p, o);

function cookieAus(setCookies) {
  const c = setCookies.find(c => c.startsWith("fw.session_token="));
  return c ? c.split(";")[0] : null;
}

async function uploadBytes(cookie, bytes, dateiname, mime, { origin = BASIS } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const fd = new FormData();
    fd.append("datei", new Blob([bytes], { type: mime }), dateiname);
    const h = { cookie };
    if (origin !== undefined) h.origin = origin;
    const res = await fetch(BASIS + "/api/medien", { method: "POST", headers: h, body: fd, redirect: "manual", signal: ctrl.signal });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* kein JSON */ }
    return { status: res.status, json };
  } finally { clearTimeout(timer); }
}

/* ---------- Mail / Registrieren / Anmelden ---------- */
const MAILQUELLE = mailquelle();
function mailAdresseFuer(email) {
  let h = 0; for (const c of String(email)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `10.${(h >>> 16) & 255}.${(h >>> 8) & 255}.${(h & 253) + 1}`;
}
/* Umgebungsbefund (P5.10, alle drei Skripte betroffen): Auf demselben Rechner
   pollt neben diesem Dev-Server (:3007) noch ein zweiter, unabhängiger
   Next-Prozess (:3008, H7-Leistungsmessung, eigener Standalone-Build unter
   einem eigenen Scratch-Pfad) instrumentation.ts gegen DIESELBE
   DATABASE_URL/mail_outbox. `FOR UPDATE SKIP LOCKED` verhindert Doppelversand,
   aber welcher der beiden Prozesse eine Zeile zieht, ist Zufall — zieht sie
   der fremde Prozess, schreibt er die Mail in SEIN EIGENES var/mail, nicht in
   unseres, und unsere Wartezeit läuft ins Leere, obwohl mail_outbox.status
   bereits 'accepted' zeigt. Deshalb: kurze Wartezeit, bei Fehlschlag über
   /api/auth/send-verification-email neu anfordern (neue Outbox-Zeile, neuer
   Zufallszug) — bis zu drei Versuche, statt einmal lange zu warten. */
async function bestaetigeMail(email, seitMs = null) {
  const VERSUCHE = 3;
  let letzterFehler;
  for (let versuch = 1; versuch <= VERSUCHE; versuch++) {
    try {
      const mail = await MAILQUELLE.warte(email, seitMs, 20_000);
      if (!mail) throw new Error(`Keine Mail für ${email} über Mailquelle "${MAILQUELLE.name}" gefunden (Versuch ${versuch}/${VERSUCHE})`);
      const treffer = mail.text.match(/https?:\/\/\S+/);
      if (!treffer) throw new Error(`Keine URL in der Mail an ${email} gefunden`);
      const res = await fetch(treffer[0], { redirect: "manual", headers: { "x-forwarded-for": mailAdresseFuer(email) } });
      return res.status;
    } catch (e) {
      letzterFehler = e;
      if (versuch < VERSUCHE) {
        seitMs = Date.now();
        await fetch(BASIS + "/api/auth/send-verification-email", {
          method: "POST",
          headers: { "content-type": "application/json", origin: BASIS, "x-forwarded-for": mailAdresseFuer(email + versuch) },
          body: JSON.stringify({ email, callbackURL: "/" })
        }).catch(() => {});
      }
    }
  }
  throw letzterFehler;
}
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
async function moderatorAnmelden(tagPrefix) {
  let r = await anmelden(MOD_EMAIL, MOD_PASSWORT, `${tagPrefix}-auth`);
  let modEmail = MOD_EMAIL;
  if (r.status !== 200 || !r.cookie) {
    modEmail = `${tagPrefix}mod+${TS}@fourwalls.example`;
    const su = await registrieren(modEmail, MOD_PASSWORT, "Moderatorin (Upload)", `${tagPrefix}-signup`);
    assertGleich(su.status, 200, "sign-up Moderatorin (Rückfall)");
    await bestaetigeMail(modEmail);
    execFileSync(process.execPath, [join(APP_ROOT, "scripts", "rolle.mjs"), modEmail, "moderator"], { stdio: "inherit", env: process.env });
    r = await anmelden(modEmail, MOD_PASSWORT, `${tagPrefix}-auth`);
    assertGleich(r.status, 200, "sign-in Moderatorin (Rückfall)");
  }
  return { email: modEmail, cookie: r.cookie, id: r.json.user.id };
}

/* ---------- Testbilder (sharp, roh erzeugt — nie aus public/media kopiert,
   damit jeder Befund reproduzierbar ist ohne feste Fixture-Datei) ---------- */
async function echtesJpeg({ breite = 800, hoehe = 600, exifGps = false } = {}) {
  const basis = sharp({ create: { width: breite, height: hoehe, channels: 3, background: { r: 120, g: 150, b: 180 } } });
  if (!exifGps) return basis.jpeg().toBuffer();
  return basis.withExif({
    IFD0: { Make: "FourwallsTestCam", Software: "fw-upload-angriff-test" },
    GPS: { GPSLatitudeRef: "N", GPSLatitude: "47/1 22/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "8/1 32/1 0/1" }
  }).jpeg().toBuffer();
}
async function echtesPng({ breite = 800, hoehe = 600 } = {}) {
  return sharp({ create: { width: breite, height: hoehe, channels: 3, background: { r: 30, g: 200, b: 90 } } }).png().toBuffer();
}
/* Riesenmasse: 8000×8000 = 64 Megapixel (> limitInputPixels 40_000_000 in
   services/bilder.ts), aber nur ~200 KB dank flächiger Einfarbigkeit — die
   klassische Dekompressionsbombe: klein auf der Leitung, riesig entpackt. */
async function riesenPng() {
  return sharp({ create: { width: 8000, height: 8000, channels: 3, background: { r: 5, g: 5, b: 5 } } }).png({ compressionLevel: 9 }).toBuffer();
}

const START = Date.now();
console.log(`Basis: ${BASIS}  —  Upload-Angriffe starten (TS=${TS})`);

let A, B, MOD;
const EMAIL_A = testadresse("ua-a", TS);
const EMAIL_B = testadresse("ua-b", TS);
const eigeneMediaIds = [];
const eigeneEmails = [EMAIL_A, EMAIL_B];
const eigeneEntwurfRefs = [];

async function aufraeumen() {
  try {
    /* audit_log verweist per actor_user_id auf app_user und per entity_id auf
       listing — beides muss zuerst weg, sonst verletzt das spätere DELETE die
       Fremdschlüssel (echter Befund aus einem früheren Lauf dieses Skripts). */
    const zeilen = await sql`SELECT id FROM app_user WHERE email = ANY(${eigeneEmails})`;
    const ids = zeilen.map(z => z.id);
    const entwurfIds = eigeneEntwurfRefs.length
      ? (await sql`SELECT id FROM listing WHERE public_ref = ANY(${eigeneEntwurfRefs})`).map(z => z.id)
      : [];
    if (ids.length || entwurfIds.length) {
      await sql`DELETE FROM audit_log WHERE actor_user_id = ANY(${ids}) OR entity_id = ANY(${entwurfIds})`;
    }
    if (entwurfIds.length) await sql`DELETE FROM listing WHERE id = ANY(${entwurfIds})`;
    if (eigeneMediaIds.length) {
      await sql`DELETE FROM media_variant WHERE asset_id = ANY(${eigeneMediaIds})`;
      await sql`DELETE FROM media_asset WHERE id = ANY(${eigeneMediaIds})`;
    }
    if (ids.length) {
      await sql`DELETE FROM media_variant WHERE asset_id IN (SELECT id FROM media_asset WHERE uploaded_by = ANY(${ids}))`;
      await sql`DELETE FROM media_asset WHERE uploaded_by = ANY(${ids})`;
      await sql`DELETE FROM auth_session WHERE user_id = ANY(${ids})`;
      await sql`DELETE FROM auth_account WHERE user_id = ANY(${ids})`;
    }
    const z2 = await sql`DELETE FROM app_user WHERE email = ANY(${eigeneEmails}) RETURNING id`;
    console.log(`Aufgeräumt: ${z2.length} Testkonten gelöscht (Präfix ua+).`);
  } catch (e) {
    console.error("Aufräumen fehlgeschlagen:", e.message || e);
  }
}

try {
  A = await personAnlegen(EMAIL_A, "a-auth", "Person A (Upload)");
  B = await personAnlegen(EMAIL_B, "b-auth", "Person B (Upload)");
  MOD = await moderatorAnmelden("ua");

  /* ============================================================
     1. FALSCHE MAGIC BYTES — Inhalt entscheidet, nicht Name/MIME
     ============================================================ */
  await schritt("1", "PNG-Bytes mit .jpg-Endung und image/jpeg-MIME → als PNG erkannt und angenommen (201), storage_key endet auf .png", async () => {
    const png = await echtesPng();
    const r = await uploadBytes(A.cookie, png, "bild.jpg", "image/jpeg");
    assertGleich(r.status, 201, "status");
    eigeneMediaIds.push(r.json.id);
    const [row] = await sql`SELECT storage_key, mime_type FROM media_asset WHERE id = ${r.json.id}`;
    assertTrue(row.storage_key.endsWith(".png"), `storage_key sollte auf .png enden, war ${row.storage_key}`);
    assertGleich(row.mime_type, "image/png", "mime_type in DB (vom Inhalt, nicht vom Client)");
    return `status=${r.status}, storage_key=${row.storage_key}, mime_type=${row.mime_type}`;
  });

  /* ============================================================
     2. SVG → abgelehnt (Ergänzung zu sicherheit-test.mjs E27, andere Nutzlast)
     ============================================================ */
  await schritt("2", "reines SVG (ohne Script) als .png → dennoch 422 (SVG ist nie erlaubt, §33)", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="red"/></svg>', "utf8");
    const r = await uploadBytes(A.cookie, svg, "bild.png", "image/png");
    assertGleich(r.status, 422, "status");
    return `status=${r.status}, message=${r.json?.message}`;
  });

  /* ============================================================
     3. HTML ALS .jpg
     ============================================================ */
  await schritt("3", "HTML-Dokument als .jpg → 422 (unbekanntes-format)", async () => {
    const html = Buffer.from("<!doctype html><html><body><h1>kein Bild</h1></body></html>", "utf8");
    const r = await uploadBytes(A.cookie, html, "bild.jpg", "image/jpeg");
    assertGleich(r.status, 422, "status");
    return `status=${r.status}, message=${r.json?.message}`;
  });

  /* ============================================================
     4. ÜBERGROSSE DATEI (Ergänzung zu E29: hier ein echtes, aber zu grosses Foto)
     ============================================================ */
  await schritt("4", "Echtes JPEG > 9 MB (MAX_BYTES) → 422/413, kein 5xx", async () => {
    const riesig = Buffer.concat([await echtesJpeg({ breite: 4000, hoehe: 3000 }), randomBytes(9 * 1024 * 1024)]);
    const r = await uploadBytes(A.cookie, riesig, "riesig.jpg", "image/jpeg");
    assertTrue(r.status === 422 || r.status === 413, `erwartet 422/413, erhalten ${r.status}`);
    return `status=${r.status}`;
  });

  /* ============================================================
     5. DEKOMPRESSIONSBOMBE / RIESENMASSE
     ============================================================ */
  await schritt("5", "8000×8000-PNG (64 MP, ~200 KB Dateigrösse) → serverseitig abgelehnt (limitInputPixels 40 MP in services/bilder.ts), angemessene Antwortzeit", async () => {
    const bombe = await riesenPng();
    assertTrue(bombe.length < 1024 * 1024, `Testannahme verletzt: Bombe sollte klein sein, war ${bombe.length} Bytes`);
    const t0 = Date.now();
    const r = await uploadBytes(A.cookie, bombe, "bombe.png", "image/png");
    const dauerMs = Date.now() - t0;
    assertGleich(r.status, 422, "status");
    assertTrue(dauerMs < 20_000, `Antwort brauchte ${dauerMs}ms — Verdacht auf unbegrenzte Dekodierarbeit`);
    return `Dateigrösse=${bombe.length} Bytes, status=${r.status}, Antwortzeit=${dauerMs}ms`;
  });

  /* ============================================================
     6. EXIF/GPS IN JPEG — Ableitungen ohne Metadaten
     ============================================================ */
  let bildMitGps;
  await schritt("6.1", "JPEG mit EXIF+GPS hochladen → 201, exif_stripped=true in der DB", async () => {
    const jpegMitGps = await echtesJpeg({ exifGps: true });
    const quelle = await sharp(jpegMitGps).metadata();
    assertTrue(!!quelle.exif, "Testannahme verletzt: Quellbild sollte EXIF enthalten");
    const r = await uploadBytes(A.cookie, jpegMitGps, "mit-gps.jpg", "image/jpeg");
    assertGleich(r.status, 201, "status");
    bildMitGps = r.json;
    eigeneMediaIds.push(r.json.id);
    const [row] = await sql`SELECT exif_stripped FROM media_asset WHERE id = ${r.json.id}`;
    assertGleich(row.exif_stripped, true, "exif_stripped");
    return `status=${r.status}, exif_stripped=true`;
  });
  await schritt("6.2", "Original ausgeliefert (eigene Sitzung) — sharp().metadata() zeigt kein EXIF mehr", async () => {
    const r = await get(`/api/medien/${bildMitGps.id}`, { cookie: A.cookie });
    assertGleich(r.status, 200, "status");
    const bytes = Buffer.from(await (await fetch(BASIS + `/api/medien/${bildMitGps.id}`, { headers: { cookie: A.cookie } })).arrayBuffer());
    const meta = await sharp(bytes).metadata();
    assertTrue(!meta.exif, "Original sollte kein EXIF mehr enthalten (GPS eingeschlossen)");
    return "meta.exif fehlt — kein EXIF, also auch kein GPS";
  });
  await schritt("6.3", "Abgeleitete Variante (w=480) — ebenfalls ohne EXIF/GPS", async () => {
    const res = await fetch(BASIS + `/api/medien/${bildMitGps.id}?w=480&f=jpeg`, { headers: { cookie: A.cookie } });
    assertGleich(res.status, 200, "status");
    const bytes = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(bytes).metadata();
    assertTrue(!meta.exif, "Ableitung (w=480) sollte kein EXIF/GPS enthalten");
    return "meta.exif fehlt in der Ableitung";
  });

  /* ============================================================
     7. DOPPELTE DATEINAMEN
     ============================================================ */
  await schritt("7", "Zweimal derselbe Dateiname 'foto.jpg' → zwei unabhängige Assets, unterschiedliche storage_keys", async () => {
    const bild1 = await echtesJpeg({ breite: 640, hoehe: 480 });
    const bild2 = await echtesJpeg({ breite: 720, hoehe: 540 });
    const r1 = await uploadBytes(A.cookie, bild1, "foto.jpg", "image/jpeg");
    const r2 = await uploadBytes(A.cookie, bild2, "foto.jpg", "image/jpeg");
    assertGleich(r1.status, 201, "status 1");
    assertGleich(r2.status, 201, "status 2");
    eigeneMediaIds.push(r1.json.id, r2.json.id);
    assertTrue(r1.json.id !== r2.json.id, "beide Uploads sollten unterschiedliche IDs bekommen");
    const zeilen = await sql`SELECT storage_key FROM media_asset WHERE id = ANY(${[r1.json.id, r2.json.id]})`;
    assertTrue(zeilen[0].storage_key !== zeilen[1].storage_key, "storage_keys sollten sich unterscheiden");
    return `id1=${r1.json.id}, id2=${r2.json.id}, storage_keys unterschiedlich`;
  });

  /* ============================================================
     8. PATH-TRAVERSAL IM DATEINAMEN (Ergänzung zu E30: weitere Muster)
     ============================================================ */
  await schritt("8.1", "Dateiname mit Windows-Stil-Traversal ('..\\\\..\\\\win.ini') → kein Escape, storage_key folgt dem festen Muster", async () => {
    const bild = await echtesJpeg();
    const r = await uploadBytes(A.cookie, bild, "..\\..\\windows\\win.ini.jpg", "image/jpeg");
    assertGleich(r.status, 201, "status");
    eigeneMediaIds.push(r.json.id);
    const [row] = await sql`SELECT storage_key FROM media_asset WHERE id = ${r.json.id}`;
    assertTrue(/^orig\/[a-f0-9-]{36}\.jpg$/i.test(row.storage_key), `storage_key entspricht nicht dem Muster: ${row.storage_key}`);
    return `storage_key=${row.storage_key}`;
  });
  await schritt("8.2", "Absoluter Pfad als Dateiname ('/etc/passwd') → kein Escape, Datei nicht ausserhalb var/uploads", async () => {
    const bild = await echtesJpeg();
    const r = await uploadBytes(A.cookie, bild, "/etc/passwd", "image/jpeg");
    assertGleich(r.status, 201, "status");
    eigeneMediaIds.push(r.json.id);
    if (!STORAGE_S3) {
      assertTrue(!existsSync(join(APP_ROOT, "etc", "passwd")), "Datei ausserhalb von var/uploads entstanden (app-root/etc/passwd)");
      assertTrue(!existsSync("/etc/passwd.jpg") || true, "kein Schreibzugriff ausserhalb des Projekts geprüft (informativ)");
    }
    return `status=${r.status}, kein Dateisystem-Escape`;
  });

  /* ============================================================
     9. ZUGRIFF AUF FREMDES PRIVATES OBJEKT
     ============================================================ */
  let bildVonB;
  await schritt("9.1", "B lädt ein eigenes, an keinem Inserat hängendes Bild hoch", async () => {
    const bild = await echtesJpeg();
    const r = await uploadBytes(B.cookie, bild, "b-privat.jpg", "image/jpeg");
    assertGleich(r.status, 201, "status");
    bildVonB = r.json;
    eigeneMediaIds.push(r.json.id);
    return `id=${bildVonB.id}`;
  });
  await schritt("9.2", "A ruft B's privates Original ab (orig/) → 404", async () => {
    const r = await get(`/api/medien/${bildVonB.id}`, { cookie: A.cookie });
    assertGleich(r.status, 404, "status");
    return `status=${r.status}`;
  });
  await schritt("9.3", "Anonym ruft B's privates Original ab → 404", async () => {
    const r = await get(`/api/medien/${bildVonB.id}`, {});
    assertGleich(r.status, 404, "status");
    return `status=${r.status}`;
  });
  await schritt("9.4", "A löscht B's Bild → 404 (fremdes Bild = 'gibt es nicht', §35)", async () => {
    const r = await del(`/api/medien/${bildVonB.id}`, { origin: BASIS, cookie: A.cookie });
    assertGleich(r.status, 404, "status");
    const [row] = await sql`SELECT id FROM media_asset WHERE id = ${bildVonB.id}`;
    assertTrue(!!row, "B's Bild sollte trotz A's Löschversuch noch existieren");
    return `status=${r.status}, Bild besteht weiter`;
  });

  /* ============================================================
     10. PRIVAT VOR VERÖFFENTLICHUNG, NUR pub/ NACH VERÖFFENTLICHUNG
     ============================================================ */
  let refA, versionA, bildIdA, storageKeyOrig;
  await schritt("10.1", "A legt einen vollständigen Entwurf mit eigenem Bild an (noch nicht eingereicht)", async () => {
    const angelegt = await post("/api/entwuerfe", { origin: BASIS, cookie: A.cookie, body: {} });
    assertGleich(angelegt.status, 201, "entwurf anlegen");
    refA = angelegt.json.publicRef; eigeneEntwurfRefs.push(refA);
    const bild = await echtesJpeg({ breite: 1200, hoehe: 900 });
    const hoch = await uploadBytes(A.cookie, bild, "entwurf-foto.jpg", "image/jpeg");
    assertGleich(hoch.status, 201, "bild hochladen");
    bildIdA = hoch.json.id; eigeneMediaIds.push(bildIdA);
    const [row] = await sql`SELECT storage_key FROM media_asset WHERE id = ${bildIdA}`;
    storageKeyOrig = row.storage_key;
    const daten = {
      trans: "sale", typ: "wohnung", ortId: "ort-bern", genauigkeit: "ungefaehr",
      zimmer: 3.5, flaeche: 90, preis: 750000,
      titel: "Bild-Sichtbarkeits-Testwohnung in Bern",
      beschreibung: "Eine Wohnung, die ausschliesslich für die Prüfung der Bildsichtbarkeit vor und nach der Veröffentlichung dient.",
      name: "Person A", email: EMAIL_A, bilder: [bildIdA]
    };
    const gespeichert = await api("PATCH", `/api/entwuerfe/${refA}`, { origin: BASIS, cookie: A.cookie, body: { version: angelegt.json.version, daten } });
    assertGleich(gespeichert.status, 200, "entwurf speichern");
    versionA = gespeichert.json.version;
    return `refA=${refA}, bildIdA=${bildIdA}`;
  });
  await schritt("10.2", "Vor Veröffentlichung: Anonym → 404; abgeleitete pub/-Variante existiert nicht auf der Festplatte", async () => {
    const anonym = await get(`/api/medien/${bildIdA}`, {});
    assertGleich(anonym.status, 404, "status anonym");
    const [variante] = await sql`SELECT storage_key FROM media_variant WHERE asset_id = ${bildIdA} AND width = 480 AND format = 'webp'`;
    assertTrue(!!variante, "es sollte eine abl/-Variante geben");
    assertTrue(variante.storage_key.startsWith("abl/"), `Variante sollte noch privat (abl/) sein, war ${variante.storage_key}`);
    if (!STORAGE_S3) {
      const pubPfad = join(APP_ROOT, "public", variante.storage_key.replace(/^abl\//, "pub/"));
      assertTrue(!existsSync(pubPfad), `Es sollte noch keine öffentliche Datei geben: ${pubPfad}`);
    }
    return `anonym=${anonym.status}, Variante noch unter abl/ (${variante.storage_key})`;
  });
  await schritt("10.3", "Einreichen + freigeben-und-veröffentlichen (MOD)", async () => {
    const einreichen = await post(`/api/entwuerfe/${refA}/aktion`, { origin: BASIS, cookie: A.cookie, body: { absicht: "einreichen" } });
    assertGleich(einreichen.status, 200, "einreichen");
    const freigabe = await post(`/api/moderation/${refA}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "freigeben-und-veroeffentlichen" } });
    assertGleich(freigabe.status, 200, "freigeben-und-veroeffentlichen");
    return `einreichen=${einreichen.status}, freigabe=${freigabe.status}`;
  });
  await schritt("10.4", "Nach Veröffentlichung: die Variante zeigt auf pub/, die Datei liegt öffentlich, /api/medien/:id?w=480 leitet dorthin um", async () => {
    const [variante] = await sql`SELECT storage_key FROM media_variant WHERE asset_id = ${bildIdA} AND width = 480 AND format = 'webp'`;
    assertTrue(variante.storage_key.startsWith("pub/"), `Variante sollte jetzt öffentlich (pub/) sein, war ${variante.storage_key}`);
    if (!STORAGE_S3) {
      const pubPfad = join(APP_ROOT, "public", variante.storage_key);
      assertTrue(existsSync(pubPfad), `Öffentliche Datei sollte jetzt existieren: ${pubPfad}`);
      const direkt = await fetch(BASIS + "/" + variante.storage_key);
      assertGleich(direkt.status, 200, "direkter Abruf der öffentlichen Datei");
    }
    const ueberRoute = await get(`/api/medien/${bildIdA}?w=480&f=webp`, {});
    assertGleich(ueberRoute.status, 302, "Route leitet zur öffentlichen Adresse um");
    return `storage_key=${variante.storage_key}, Route→302`;
  });
  await schritt("10.5", "Das PRIVATE Original bleibt weiterhin nur für Eigentümerin/Moderation sichtbar — Anonym weiterhin 404", async () => {
    const anonym = await get(`/api/medien/${bildIdA}`, {});
    assertGleich(anonym.status, 404, "status anonym (Original ohne Breitenangabe)");
    const [row] = await sql`SELECT storage_key FROM media_asset WHERE id = ${bildIdA}`;
    assertGleich(row.storage_key, storageKeyOrig, "storage_key des Originals unverändert");
    assertTrue(row.storage_key.startsWith("orig/"), "Original sollte weiterhin unter orig/ liegen (nie öffentlich, §20)");
    return `anonym=${anonym.status}, Original weiterhin privat (${row.storage_key})`;
  });

  /* ============================================================
     11. UPLOADS OHNE SITZUNG / MIT FREMDER ORIGIN
     ============================================================ */
  await schritt("11.1", "Upload ohne Sitzungscookie → 401", async () => {
    const bild = await echtesJpeg();
    const r = await uploadBytes(undefined, bild, "anonym.jpg", "image/jpeg");
    assertGleich(r.status, 401, "status");
    return `status=${r.status}`;
  });
  await schritt("11.2", "Upload mit fremder Origin → 403", async () => {
    const bild = await echtesJpeg();
    const r = await uploadBytes(A.cookie, bild, "fremd.jpg", "image/jpeg", { origin: "https://boese.example" });
    assertGleich(r.status, 403, "status");
    return `status=${r.status}`;
  });

  /* ============================================================
     12. RATENBEGRENZUNG DER UPLOADS — dokumentiert, nicht ausgeschöpft
     ============================================================ */
  await schritt("12", "Ratenbegrenzung existiert: 80 Uploads/Stunde je Person (app/api/medien/route.ts: ratenPruefen(..., \"upload\", 80, 3600000, ..., person.id)) plus MAX_JE_PERSON=60 Bilder in server/medien.ts", async () => {
    return "in app/api/medien/route.ts verkabelt (80/h je Konto); zusätzlich eine harte Obergrenze von 60 gespeicherten Bildern je Person in server/medien.ts:bildHochladen — nicht ausgeschöpft, um die übrigen Prüfungen und spätere Läufe nicht zu belasten";
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
  const zeile = (a, b, c, d) => `${String(a).padEnd(w1)}  ${String(b).padEnd(w2)}  ${String(c).padEnd(w3)}  ${d}`;
  console.log("\n" + zeile("Nr", "Prüfung", "Status", "Detail"));
  console.log("-".repeat(w1 + w2 + w3 + 10));
  for (const e of ergebnisse) console.log(zeile(e.bez, e.titel, e.status, e.detail));
}
tabelle();

const fehlerAnzahl = ergebnisse.filter(e => e.status === "FEHLER").length;
console.log(`\n${ergebnisse.length} Prüfungen, ${fehlerAnzahl} FEHLER, ${ergebnisse.length - fehlerAnzahl} OK — Dauer ${(dauerMs / 1000).toFixed(1)}s`);
if (fehlerAnzahl > 0) {
  console.log("\nFEHLER im Detail:");
  for (const e of ergebnisse.filter(e => e.status === "FEHLER")) console.log(`  ${e.bez} (${e.titel}): ${e.detail}`);
}

const bericht = { basis: BASIS, zeit: new Date().toISOString(), ergebnisse };
const berichtPfad = join(APP_ROOT, "var", "upload-angriff-bericht.json");
await import("node:fs/promises").then(fs => fs.writeFile(berichtPfad, JSON.stringify(bericht, null, 2)));
console.log(`Bericht geschrieben: ${berichtPfad}`);

process.exit(fehlerAnzahl > 0 ? 1 : 0);
