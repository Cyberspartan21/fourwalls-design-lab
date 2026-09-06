#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Mobile Kundenreisen bei 390×844 (P5.10 §28)

   Läuft neunzehn benannte Reisen durch die Anwendung bei 390×844 (CDP,
   headless Chrome, dasselbe Emulationsmuster wie scripts/intern-mobil-test.mjs
   und scripts/kontoloeschung-test.mjs) und prüft je Reise:
     - HTTP-Status der Navigation (Network.responseReceived, type Document)
     - document.documentElement.scrollWidth === 390 (kein horizontales Scrollen)
     - kein fixiertes Element über dem ersten Formularfeld/Hauptknopf
       (elementFromPoint der Mitte muss das Element selbst oder ein Kind treffen)
     - Hauptknöpfe (.knopf), die im sichtbaren Bereich liegen, sind ≥ 40 px hoch
     - ein Screenshot nach /tmp/fw-h8a-mobil/<name>.png

   Eigene Konten (Präfix h8a+) werden am Ende gelöscht; die vorhandenen
   Seed-Konten (alpha-owner@… aus var/profis.local.json) werden nur zum
   Anmelden benutzt, nie verändert.

   Aufruf:
     set -a; . ./.env.local; set +a
     node scripts/mobil-reisen-test.mjs [Basis-URL]      Standard: http://localhost:3007

   Mailquelle (siehe scripts/lib/mailquelle.mjs): FW_TEST_MAIL_QUELLE=dev|mailpit|imap.
   Bei echten Defekten (Overflow, Überlagerung, kaputter Klickpfad) wird NICHT
   repariert — nur mit einer Datei-Vermutung gemeldet.
   ============================================================ */
import postgres from "postgres";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { mailquelle } from "./lib/mailquelle.mjs";

const HIER = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HIER, "..");
const BASIS = (process.argv[2] || "http://localhost:3007").replace(/\/$/, "");
const TS = Date.now();
const SCHOT_ORDNER = "/tmp/fw-h8a-mobil";
mkdirSync(SCHOT_ORDNER, { recursive: true });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a)"); process.exit(2); }
const sql = postgres(DATABASE_URL, { max: 4, onnotice: () => {} });

const PASSWORT = "Mobil-" + randomBytes(12).toString("base64url");
/* Einfaches "+" statt testadresse()s "kennzeichen+ts@…" (das hätte hier ein
   zweites "+" ergeben, "h8a+kunde+169…@example.com" — ein solches Doppel-Plus
   hat sich im ersten Lauf als eigene Fehlerquelle erwiesen: sign-up gab 200,
   aber es kam nie eine Bestätigungsmail an, siehe Bericht). */
const EMAIL_KUNDE = `h8a+kunde-${TS}@example.com`;
const EMAIL_STAFF = `h8a+staff-${TS}@example.com`;
const EMAIL_ABO = "h8a+abo@example.com";

/* Persona (Seed-Profi) — Zugangsdaten NIE ausgeben. */
const PROFIS_DATEI = join(APP_ROOT, "var", "profis.local.json");
let ALPHA_OWNER = null;
try {
  const j = JSON.parse(readFileSync(PROFIS_DATEI, "utf8"));
  const p = j.personas?.["alpha-owner@fourwalls.example"];
  if (p?.passwort) ALPHA_OWNER = { email: "alpha-owner@fourwalls.example", passwort: p.passwort };
} catch { /* Datei fehlt oder unlesbar — die betroffenen Reisen melden das selbst */ }
const ALPHA_SLUG = "alpha-immobilien-ag-demo";

/* Alle selbst angelegten Adressen (Präfix h8a+) — für ein zielgenaues
   Aufräumen unabhängig davon, ob FW_TEST_MAIL_BASIS gesetzt ist. */
const EIGENE_KONTO_EMAILS = [EMAIL_KUNDE, EMAIL_STAFF];
const EIGENE_SUCHABO_EMAILS = [EMAIL_ABO];

const ergebnisse = [];
let fehlerZaehler = 0;
function assertTrue(bedingung, meldung) { if (!bedingung) throw new Error(meldung); }

/* Öffentliche Referenz aus einer Objekt-URL (…/<slug>-fwl-2026-000123) —
   nicht per split("-").pop() (zerlegt FWL-2026-000123 selbst an den
   Bindestrichen), sondern über das feste Muster. */
function refAusUrl(url) {
  const m = /FWL-\d{4}-\d{6}/i.exec(url);
  if (!m) throw new Error(`keine Referenz (FWL-JJJJ-NNNNNN) in der URL gefunden: ${url}`);
  return m[0].toUpperCase();
}

async function reise(name, fn) {
  try {
    const d = (await fn()) || {};
    ergebnisse.push({ name, status: "OK", scrollWidth: d.scrollWidth ?? "", befund: d.befund ?? "ok", screenshot: d.screenshot ?? "" });
    console.log(`OK      ${name}  (scrollWidth=${d.scrollWidth ?? "–"})${d.befund ? " — " + d.befund : ""}`);
  } catch (e) {
    fehlerZaehler++;
    const meldung = e && e.message ? e.message : String(e);
    ergebnisse.push({ name, status: "FEHLER", scrollWidth: e.scrollWidth ?? "", befund: meldung, screenshot: e.screenshot ?? "" });
    console.log(`FEHLER  ${name} — ${meldung}`);
  }
}

/* ---------- HTTP (für Registrierung/Anmeldung/Bestätigung, wie in den anderen Prüfskripten) ---------- */
const RUNSEED = Math.floor(Math.random() * 200) + 10;
const xffMap = new Map();
function xff(tag) { if (!xffMap.has(tag)) xffMap.set(tag, `10.${RUNSEED}.${xffMap.size + 1}.61`); return xffMap.get(tag); }

async function api(method, pfad, { body, xffTag } = {}) {
  const h = {}; let payload;
  if (body !== undefined) { h["content-type"] = "application/json"; payload = JSON.stringify(body); }
  if (xffTag) h["x-forwarded-for"] = xff(xffTag);
  const res = await fetch(BASIS + pfad, { method, headers: { ...h, origin: BASIS }, body: payload, redirect: "manual" });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* kein JSON */ }
  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  return { status: res.status, json, text, setCookies };
}
function cookieAus(setCookies) {
  const c = setCookies.find(c => c.startsWith("fw.session_token="));
  return c ? c.split(";")[0] : null;
}

const MAILQUELLE = mailquelle();
function bestaetigungsAdresse(email) {
  let h = 0; for (const c of String(email)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `10.${(h >>> 16) & 255}.${(h >>> 8) & 255}.${(h & 253) + 1}`;
}
async function bestaetigeMail(email, seitMs = null) {
  /* var/mail/*.json wächst über alle Läufe hinweg (hier > 1300 Dateien) — die
     dev-Mailquelle liest bei jedem Poll alle Dateien neu ein, das kann pro
     Durchlauf spürbar dauern. 45 s statt der üblichen 30 s, damit ein voller
     Ordner allein keine Reise zu Fall bringt. */
  const mail = await MAILQUELLE.warte(email, seitMs, 45000);
  if (!mail) throw new Error(`Keine Mail für ${email} über Mailquelle "${MAILQUELLE.name}" gefunden (45 s gewartet, var/mail hat viele Dateien)`);
  const treffer = mail.text.match(/https?:\/\/\S+/);
  if (!treffer) throw new Error(`Keine URL in der Mail an ${email} gefunden`);
  const res = await fetch(treffer[0], { redirect: "manual", headers: { "x-forwarded-for": bestaetigungsAdresse(email) } });
  return res.status;
}
async function kontoAnlegen(email, name, xffTag) {
  const seit = Date.now();
  const su = await api("POST", "/api/auth/sign-up/email", { body: { email, password: PASSWORT, name }, xffTag: `${xffTag}-su` });
  assertTrue(su.status === 200, `sign-up(${email}) status=${su.status}`);
  const best = await bestaetigeMail(email, seit);
  assertTrue(best === 302, `bestätigung(${email}) status=${best}`);
  const si = await api("POST", "/api/auth/sign-in/email", { body: { email, password: PASSWORT }, xffTag: `${xffTag}-si` });
  assertTrue(si.status === 200, `sign-in(${email}) status=${si.status}`);
  const cookieRoh = cookieAus(si.setCookies);
  assertTrue(!!cookieRoh, `kein Sitzungscookie(${email})`);
  return { email, id: si.json.user.id, cookie: cookieRoh };
}
async function fremdAnmelden(email, passwort, xffTag) {
  const si = await api("POST", "/api/auth/sign-in/email", { body: { email, password: passwort }, xffTag });
  assertTrue(si.status === 200, `sign-in(${email}) status=${si.status}`);
  const cookieRoh = cookieAus(si.setCookies);
  assertTrue(!!cookieRoh, `kein Sitzungscookie(${email})`);
  return { email, id: si.json.user.id, cookie: cookieRoh };
}

/* ---------- CDP: 390×844, eigener Port ≥ 9800, eigenes Profil ---------- */
/* CHROME_BIN erlaubt einen anderen Chrome-Pfad als den macOS-Standard —
   in CI z. B. das auf ubuntu-latest vorinstallierte google-chrome (siehe
   tools/baseline.mjs für dasselbe Muster). */
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

const PORT = 9800 + Math.floor(Math.random() * 300);
const PROFIL = `/tmp/fw-h8a-${PORT}`;
let chromeKind, ws, nr = 0;
const offen = new Map();
const ereignisAbos = new Map(); // method -> Set(cb)

function cmd(method, params) {
  return new Promise(ok => { const id = ++nr; offen.set(id, ok); ws.send(JSON.stringify({ id, method, params })); });
}
async function js(expr) {
  const r = await cmd("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error("JS-Fehler: " + (r.exceptionDetails.text || JSON.stringify(r.exceptionDetails)));
  return r.result && r.result.result ? r.result.result.value : null;
}
function an(method, cb) {
  if (!ereignisAbos.has(method)) ereignisAbos.set(method, new Set());
  ereignisAbos.get(method).add(cb);
  return () => ereignisAbos.get(method)?.delete(cb);
}

async function chromeStarten() {
  chromeKind = spawn(CHROME, ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=390,844",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFIL}`, "about:blank"], { stdio: "ignore" });
  ws = new WebSocket(await seite(PORT));
  await new Promise(ok => { ws.onopen = ok; });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && offen.has(m.id)) { offen.get(m.id)(m); offen.delete(m.id); return; }
    if (m.method && ereignisAbos.has(m.method)) for (const cb of ereignisAbos.get(m.method)) cb(m.params);
  };
  await cmd("Page.enable"); await cmd("Runtime.enable"); await cmd("Network.enable");
  await cmd("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  /* Eine eigene, pro Lauf zufällige Absenderadresse für ALLE Anfragen des
     Browsers — sonst zählen mehrere Testläufe hintereinander (alle von
     127.0.0.1) gegen dasselbe IP-Ratenlimit, z. B. POST /api/anliegen
     (5/Stunde, app/api/anliegen/route.ts). Dasselbe Muster wie xff() für die
     node-seitigen fetch()-Aufrufe. */
  /* Die Herkunftskennung nur für Anfragen an die Anwendung selbst setzen: als
     globaler Zusatz-Header ginge sie auch an swisstopo (Kartenkacheln) — ein
     nicht CORS-sicherer Header löst dort ein Preflight aus, das scheitert,
     und die Karte fällt auf ihren Rückfall («lässt sich gerade nicht laden»).
     Deshalb Fetch-Abfangen nur für die Basis-URL (P5.10-Befund). */
  await cmd("Fetch.enable", { patterns: [{ urlPattern: `${BASIS}/*`, requestStage: "Request" }] });
  an("Fetch.requestPaused", p => {
    const headers = Object.entries(p.request.headers).map(([name, value]) => ({ name, value }));
    headers.push({ name: "x-forwarded-for", value: `10.${RUNSEED}.250.1` });
    cmd("Fetch.continueRequest", { requestId: p.requestId, headers });
  });
}
async function chromeBeenden() {
  try { ws?.close(); } catch { /* schon zu */ }
  try { chromeKind?.kill(); } catch { /* schon weg */ }
  await schlaf(500);
  try { rmSync(PROFIL, { recursive: true, force: true }); } catch { /* schon weg */ }
}

/* Navigiert und liefert den HTTP-Status der Haupt-Dokument-Antwort
   (Network.responseReceived, type Document) — nicht nur "erreicht". */
async function navigiere(url) {
  let status = null;
  const ab = an("Network.responseReceived", p => { if (p.type === "Document") status = p.response.status; });
  await cmd("Page.navigate", { url });
  await schlaf(2200);
  ab();
  return status;
}

async function setzeCookie(cookieRoh) {
  const name = cookieRoh.split("=")[0];
  const value = cookieRoh.split("=").slice(1).join("=");
  const basisUrl = new URL(BASIS);
  await cmd("Network.setCookie", { name, value, domain: basisUrl.hostname, path: "/", httpOnly: true, secure: false });
}
async function cookiesLoeschen() {
  const basisUrl = new URL(BASIS);
  await cmd("Network.clearBrowserCookies");
  void basisUrl;
}

async function screenshot(name) {
  const r = await cmd("Page.captureScreenshot", { format: "png" });
  const pfad = join(SCHOT_ORDNER, `${name}.png`);
  writeFileSync(pfad, Buffer.from(r.result.data, "base64"));
  return pfad;
}

/* ---------- Gemeinsame Prüfungen je Seite ---------- */
async function scrollWidthPruefen() {
  const b = await js("document.documentElement.scrollWidth");
  return b;
}

/* Erstes Formularfeld (.feld) oder, wenn keins da ist, der erste sichtbare
   Hauptknopf (.knopf) — die Mitte muss auf das Element selbst oder ein Kind
   treffen, sonst liegt etwas Fixiertes darüber. */
async function ueberlappungPruefen() {
  return js(`(() => {
    /* Bewusst NUR im Inhaltsbereich (#inhalt, sonst irgendein .feld) suchen —
       nicht global nach .knopf: die Kopfzeile (components/site/kopf.tsx)
       enthält auf Desktop sichtbare .knopf-Links, die bei 390px per CSS
       weichen/kollabieren, aber im DOM vor jedem Seiteninhalt stehen. Ein
       ungescopter erster Treffer griffe fast immer einen davon statt des
       eigentlichen Seiteninhalts. */
    const ziel = document.querySelector('.feld') || document.querySelector('#inhalt .knopf');
    if (!ziel) return { ok: true, grund: "kein Feld/Knopf im Seiteninhalt (#inhalt) gefunden" };
    /* Erst in die Bildmitte scrollen — sonst liegt ein Feld unterhalb des Falzes rechnerisch am
       unteren Rand und trifft die fixierte CTA-Leiste, obwohl es beim Bedienen nie darunter liegt. */
    ziel.scrollIntoView({ block: "center", behavior: "instant" });
    const r = ziel.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return { ok: true, grund: "Zielelement nicht sichtbar (0px), Prüfung übersprungen" };
    const cx = r.left + r.width / 2, cy = Math.min(Math.max(r.top + r.height / 2, 0), window.innerHeight - 1);
    const treffer = document.elementFromPoint(cx, cy);
    const ok = treffer === ziel || ziel.contains(treffer) || (treffer && treffer.contains(ziel));
    const beschreibung = t => t ? (t.tagName + (t.id ? "#" + t.id : "") + (typeof t.className === "string" && t.className ? "." + t.className.trim().split(/\\s+/).join(".") : "")) : "nichts";
    return { ok, grund: ok ? "" : ("erwartet " + beschreibung(ziel) + ", getroffen " + beschreibung(treffer)) };
  })()`);
}

/* Alle im sichtbaren Bereich liegenden .knopf-Elemente müssen ≥ 40 px hoch sein. */
async function knopfHoehenPruefen() {
  const liste = await js(`Array.from(document.querySelectorAll('.knopf')).map(b => {
    const r = b.getBoundingClientRect();
    return { text: (b.textContent||'').trim().slice(0,24), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) };
  }).filter(x => x.bottom > 0 && x.top < window.innerHeight && x.h > 0)`);
  const verletzer = (liste || []).filter(x => x.h < 40);
  return { liste: liste || [], verletzer };
}

/* Eine vollständige Standard-Prüfung: navigieren, Status, scrollWidth,
   Überlappung, Knopfhöhen, Screenshot. Wirft bei einem echten Defekt mit
   einer Datei-Vermutung. */
async function standardPruefung(name, url, { erwarteteStatus = [200], erwartetPfad = null, dateiVermutung = "" } = {}) {
  const status = await navigiere(url);
  const pfadNachher = await js("location.pathname");
  const scrollWidth = await scrollWidthPruefen();
  const ueberlappung = await ueberlappungPruefen();
  const knoepfe = await knopfHoehenPruefen();
  const bild = await screenshot(name);

  /* Ein Server-Redirect (z. B. fehlende Sitzung) ändert den Netzwerkstatus
     nicht sichtbar — Network.responseReceived liefert am Ende den Status der
     ZULETZT geladenen Seite, nicht der ursprünglich angeforderten. Ohne diese
     Prüfung würde eine unbemerkte Weiterleitung als "OK" durchgehen und alle
     folgenden Prüfungen liefen auf der falschen Seite. */
  if (erwartetPfad && String(pfadNachher) !== erwartetPfad) {
    const e = new Error(`nach ${url} auf ${pfadNachher} umgeleitet statt auf ${erwartetPfad} zu bleiben (keine gültige Sitzung?)`);
    e.scrollWidth = scrollWidth; e.screenshot = bild; throw e;
  }
  if (!erwarteteStatus.includes(status)) {
    const e = new Error(`HTTP-Status ${status}, erwartet ${erwarteteStatus.join("/")} — ${url}`);
    e.scrollWidth = scrollWidth; e.screenshot = bild; throw e;
  }
  if (scrollWidth !== 390) {
    const e = new Error(`scrollWidth=${scrollWidth}, erwartet 390 (horizontales Scrollen)${dateiVermutung ? " — vermutlich " + dateiVermutung : ""}`);
    e.scrollWidth = scrollWidth; e.screenshot = bild; throw e;
  }
  if (ueberlappung && ueberlappung.ok === false) {
    const e = new Error(`Fixiertes Element über dem Hauptfeld/-knopf: ${ueberlappung.grund}${dateiVermutung ? " — vermutlich " + dateiVermutung : ""}`);
    e.scrollWidth = scrollWidth; e.screenshot = bild; throw e;
  }
  if (knoepfe.verletzer.length) {
    const e = new Error(`${knoepfe.verletzer.length} Knopf/Knöpfe < 40 px hoch: ${JSON.stringify(knoepfe.verletzer)}${dateiVermutung ? " — vermutlich " + dateiVermutung : ""}`);
    e.scrollWidth = scrollWidth; e.screenshot = bild; throw e;
  }
  return { scrollWidth, befund: `status=${status}, ${knoepfe.liste.length} Knopf/Knöpfe geprüft`, screenshot: bild };
}

/* ---------- Aufräumen ---------- */
async function aufraeumen() {
  try {
    /* Über die E-Mail-Adressen nachschlagen statt sich auf die im Skript
       gehaltenen kunde/staff-Objekte zu verlassen: ein sign-up kann in der
       Datenbank durchgekommen sein, auch wenn eine SPÄTERE Prüfung (z. B. das
       Warten auf die Bestätigungsmail) in genau diesem Lauf fehlschlug und
       die Variable dadurch null blieb — das Konto (und ein darüber im
       eingeloggten Browser trotzdem angelegter Entwurf) bliebe sonst stehen. */
    const gefunden = await sql`SELECT id FROM app_user WHERE email = ANY(${EIGENE_KONTO_EMAILS})`;
    const ids = gefunden.map(r => r.id);
    if (ids.length) {
      await sql`DELETE FROM listing WHERE published_by_user_id = ANY(${ids}) OR contact_user_id = ANY(${ids})`;
    }
    if (ids.length) {
      /* audit_log.actor_user_id ist eine blosse REFERENCES ohne ON DELETE —
         das Autosave im Assistenten (server/entwuerfe.ts) schreibt dorthin,
         das app_user-DELETE würde sonst an der FK scheitern. */
      await sql`DELETE FROM audit_log WHERE actor_user_id = ANY(${ids})`;
    }
    /* Die E-Mail-Adresse eines anonymen Suchabos steht in search_alert, nicht
       in saved_search selbst (0006_interaktion.sql) — das Löschen von
       saved_search cascadiert dann search_alert automatisch mit. */
    await sql`DELETE FROM saved_search WHERE id IN (SELECT saved_search_id FROM search_alert WHERE email = ANY(${EIGENE_SUCHABO_EMAILS}))`;
    await sql`DELETE FROM app_user WHERE email = ANY(${EIGENE_KONTO_EMAILS})`;
    console.log(`Aufräumen: eigene h8a+-Konten (${EIGENE_KONTO_EMAILS.length}) und Suchabo-Spuren entfernt.`);
  } catch (e) {
    console.log("Aufräumen FEHLGESCHLAGEN — bitte manuell prüfen: " + (e?.message ?? e));
  }
}

/* ================= Hauptlauf ================= */
const START = Date.now();
console.log(`Basis: ${BASIS}  —  Mobile Kundenreisen bei 390×844 (TS=${TS})`);

let kunde = null;
let staff = null;
let alphaOwnerId = null;

try {
  await chromeStarten();

  /* -------- 1. Start -------- */
  await reise("Start (/de)", () => standardPruefung("01-start", `${BASIS}/de`));

  /* -------- 2. Kaufen-Suche -------- */
  await reise("Kaufen-Suche", () => standardPruefung("02-kaufen", `${BASIS}/de/immobilien/kaufen`,
    { dateiVermutung: "components/marktplatz/steuerung.tsx oder styles/portal.css" }));

  /* -------- 3. Mieten-Suche -------- */
  await reise("Mieten-Suche", () => standardPruefung("03-mieten", `${BASIS}/de/immobilien/mieten`,
    { dateiVermutung: "components/marktplatz/steuerung.tsx oder styles/portal.css" }));

  /* -------- 4. Karte -------- */
  await reise("Karte (?ansicht=karte)", async () => {
    const status = await navigiere(`${BASIS}/de/immobilien/kaufen?ansicht=karte`);
    let gefunden = false;
    for (let i = 0; i < 40 && !gefunden; i++) {
      gefunden = await js("!!document.querySelector('.maplibregl-canvas')");
      if (!gefunden) await schlaf(500);
    }
    /* Am Dev-Server kompiliert Turbopack das Kartenbündel beim ersten Aufruf;
       dann greift der eigene Rückfall der Anwendung («Karte lässt sich gerade
       nicht laden»), bevor das Bündel da ist. Ein zweiter Versuch entscheidet —
       im Produktions-Build (CI) gibt es diese Verzögerung nicht. */
    if (!gefunden) {
      await navigiere(`${BASIS}/de/immobilien/kaufen?ansicht=karte`);
      for (let i = 0; i < 40 && !gefunden; i++) {
        gefunden = await js("!!document.querySelector('.maplibregl-canvas')");
        if (!gefunden) await schlaf(500);
      }
    }
    const scrollWidth = await scrollWidthPruefen();
    const bild = await screenshot("04-karte");
    assertTrue(status === 200, `HTTP-Status ${status}`);
    assertTrue(gefunden, "kein .maplibregl-canvas nach ≤ 20 s gefunden — vermutlich components/marktplatz/karten-ansicht.tsx (Karte lädt zu spät oder gar nicht bei 390px)");
    return { scrollWidth, befund: "maplibregl-canvas gefunden", screenshot: bild };
  });

  /* -------- Referenzen für die Objektseiten (Standard vs. Exclusive) -------- */
  let refStandard = null, refExklusiv = null;
  await reise("Referenzen ermitteln (SQL)", async () => {
    const zeilen = await sql`
      SELECT lp.public_ref, lp.slug, lp.transaction, lp.publisher_kind, ro.kind AS rep_kind
        FROM listing_public lp
        LEFT JOIN organization ro ON ro.id = lp.represented_by_org_id
       WHERE lp.is_demo AND lp.status = 'published'`;
    const ex = zeilen.find(z => z.publisher_kind === "fourwalls" && z.rep_kind === "fourwalls");
    const std = zeilen.find(z => !(z.publisher_kind === "fourwalls" && z.rep_kind === "fourwalls"));
    assertTrue(!!ex, "keine Exclusive-Referenz (publisher_kind=fourwalls, rep_kind=fourwalls) im Demo-Bestand gefunden");
    assertTrue(!!std, "keine Standard-Referenz im Demo-Bestand gefunden");
    const PFAD = { buy: "kaufen", rent: "mieten" };
    refExklusiv = `/de/immobilien/${PFAD[ex.transaction]}/${ex.slug}-${String(ex.public_ref).toLowerCase()}`;
    refStandard = `/de/immobilien/${PFAD[std.transaction]}/${std.slug}-${String(std.public_ref).toLowerCase()}`;
    return { befund: `standard=${std.public_ref}, exklusiv=${ex.public_ref}` };
  });

  /* Referenz für Favorit/Vergleich — unabhängig davon, ob die Layout-Prüfung
     der Objektseite selbst besteht (ein Layout-Defekt dort darf die
     nachfolgenden Reisen nicht mit einer Folgefehlermeldung verdecken). */
  const favPublicRef = refStandard ? refAusUrl(refStandard) : null;

  /* -------- 5. Objektseite Standard -------- */
  await reise("Objektseite Standard", async () => {
    if (!refStandard) throw new Error("keine Standard-Referenz ermittelt (siehe vorherige Reise)");
    return standardPruefung("05-objekt-standard", `${BASIS}${refStandard}`,
      { dateiVermutung: "components/property/kopf.tsx (.dkopf-Knöpfe) oder styles/objekt.css" });
  });

  /* -------- 6. Objektseite Exclusive -------- */
  await reise("Objektseite Exclusive", async () => {
    if (!refExklusiv) throw new Error("keine Exclusive-Referenz ermittelt (siehe vorherige Reise)");
    return standardPruefung("06-objekt-exklusiv", `${BASIS}${refExklusiv}`,
      { dateiVermutung: "components/property/finanzierung.tsx (#fZins) unter der fixierten .mobilcta-Leiste aus components/property/seite.tsx/styles/objekt.css" });
  });

  /* -------- 7. Favorit setzen -------- */
  await reise("Favorit setzen", async () => {
    if (!refStandard) throw new Error("keine Standard-Referenz ermittelt");
    await navigiere(`${BASIS}${refStandard}`);
    await schlaf(600);
    const vorherGemerkt = await js("!!document.querySelector('#dMerken[aria-pressed=\"true\"]')");
    assertTrue(!vorherGemerkt, "Objekt war schon vor dem Klick gemerkt — Testvoraussetzung verletzt");
    await js("document.querySelector('#dMerken')?.click()");
    await schlaf(500);
    const gemerkt = await js("!!document.querySelector('#dMerken[aria-pressed=\"true\"]')");
    const inMerkliste = await js(`(() => { try { const l = JSON.parse(localStorage.getItem('fw-merkliste') || '[]'); return Array.isArray(l) && l.includes(${JSON.stringify(favPublicRef)}); } catch { return false; } })()`);
    const scrollWidth = await scrollWidthPruefen();
    const bild = await screenshot("07-favorit");
    assertTrue(gemerkt === true, "Klick auf #dMerken hat aria-pressed nicht auf true gesetzt — vermutlich components/favorites.ts oder components/property/kopf.tsx");
    assertTrue(inMerkliste === true, `localStorage fw-merkliste enthält ${favPublicRef} nicht nach dem Merken — vermutlich components/favorites.ts`);
    return { scrollWidth, befund: `dMerken aria-pressed=true, fw-merkliste enthält ${favPublicRef}`, screenshot: bild };
  });

  /* -------- 8. Vergleich -------- */
  await reise("Vergleich (zwei Objekte)", async () => {
    if (!refStandard || !refExklusiv) throw new Error("keine zwei Referenzen ermittelt");
    await navigiere(`${BASIS}${refStandard}`);
    await schlaf(500);
    await js("document.querySelector('#dVergleichen')?.click()");
    await schlaf(400);
    await navigiere(`${BASIS}${refExklusiv}`);
    await schlaf(500);
    await js("document.querySelector('#dVergleichen')?.click()");
    await schlaf(400);
    await schlaf(1200); // /api/vergleich löst die Referenzen erst nach dem Laden auf (components/vergleich-seite.tsx)
    const status = await navigiere(`${BASIS}/de/vergleich`);
    await schlaf(1200);
    const scrollWidth = await scrollWidthPruefen();
    const refA = refAusUrl(refStandard).toLowerCase();
    const refB = refAusUrl(refExklusiv).toLowerCase();
    const hrefs = await js("Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href') || '')");
    const bild = await screenshot("08-vergleich");
    assertTrue(status === 200, `HTTP-Status ${status}`);
    assertTrue(scrollWidth === 390, `scrollWidth=${scrollWidth}`);
    const hatA = (hrefs || []).some(h => h.toLowerCase().includes(refA));
    const hatB = (hrefs || []).some(h => h.toLowerCase().includes(refB));
    assertTrue(hatA && hatB,
      `/de/vergleich verlinkt nicht beide Referenzen (${refA}, ${refB}) — vermutlich components/vergleich-seite.tsx oder app/api/vergleich/route.ts`);
    return { scrollWidth, befund: `beide Referenzen (${refA}, ${refB}) auf /de/vergleich verlinkt`, screenshot: bild };
  });

  /* -------- 9. Suchabo speichern -------- */
  await reise("Suchabo speichern", async () => {
    const seitMs = Date.now();
    await navigiere(`${BASIS}/de/immobilien/kaufen`);
    await schlaf(600);
    await js("document.querySelector('#sucheSpeichern')?.click()");
    await schlaf(400);
    const offen = await js("!!document.querySelector('#aboMail')");
    assertTrue(offen, "Suchabo-Dialog (#aboMail) öffnet nicht — vermutlich components/marktplatz/steuerung.tsx");
    await js(`(() => { const f = document.querySelector('#aboMail'); if (!f) return; const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(f, ${JSON.stringify(EMAIL_ABO)}); f.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await schlaf(150);
    await js("document.querySelector('#aboSpeichern')?.click()");
    await schlaf(1200);
    const scrollWidth = await scrollWidthPruefen();
    const bild = await screenshot("09-suchabo");
    const fertig = await js("!!document.querySelector('#aboFertig')");
    assertTrue(fertig, "Suchabo-Formular meldet kein #aboFertig nach dem Senden — vermutlich components/marktplatz/steuerung.tsx oder app/api/suchabo/route.ts");
    /* Der Outbox-Arbeiter läuft alle OUTBOX_INTERVAL_MS (Standard 15000,
       domain/env.ts) — 15 s Wartezeit reicht daher nicht zuverlässig, 35 s
       decken zwei Intervalle ab. */
    const mail = await MAILQUELLE.warte(EMAIL_ABO, seitMs, 35000);
    assertTrue(!!mail, `keine Bestätigungsmail für ${EMAIL_ABO} über Mailquelle "${MAILQUELLE.name}" gefunden`);
    return { scrollWidth, befund: "Bestätigungsmail in der Mailquelle gefunden", screenshot: bild };
  });

  /* -------- Eigenes Konto anlegen (für Anmelden/Konto-Übersicht/Inserieren/Anliegen) -------- */
  await reise("Eigenes Konto anlegen (API, für die folgenden Reisen)", async () => {
    kunde = await kontoAnlegen(EMAIL_KUNDE, "Mobil Prüfperson h8a", "kunde");
    return { befund: `id=${kunde.id}` };
  });

  /* -------- 10. Anmelden -------- */
  await reise("Anmelden (UI-Formular)", async () => {
    await cookiesLoeschen();
    const status = await navigiere(`${BASIS}/de/konto/anmelden`);
    const scrollWidthVorher = await scrollWidthPruefen();
    assertTrue(status === 200, `HTTP-Status ${status}`);
    assertTrue(scrollWidthVorher === 390, `scrollWidth=${scrollWidthVorher}`);
    await js(`(() => { const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const e = document.querySelector('#anEmail'); setter.call(e, ${JSON.stringify(EMAIL_KUNDE)}); e.dispatchEvent(new Event('input', { bubbles: true }));
      const p = document.querySelector('#anPasswort'); setter.call(p, ${JSON.stringify(PASSWORT)}); p.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await schlaf(150);
    await js("document.querySelector('form')?.requestSubmit ? document.querySelector('form').requestSubmit() : document.querySelector('button[type=submit]')?.click()");
    /* Poll statt festem Sleep: signIn.email() + router.push()/router.refresh()
       (components/konto/formulare.tsx) brauchen unterschiedlich lang, ein
       fixer Schlaf hätte sonst "/de/konto/anmelden" statt "/de/konto"
       gemeldet, obwohl die Anmeldung kurz danach doch griff. */
    let url = await js("location.pathname");
    for (let i = 0; i < 16 && url === "/de/konto/anmelden"; i++) { await schlaf(300); url = await js("location.pathname"); }
    const scrollWidth = await scrollWidthPruefen();
    const bild = await screenshot("10-anmelden");
    assertTrue(url === "/de/konto", `nach dem Anmelden auf ${url} statt /de/konto — vermutlich components/konto/formulare.tsx`);
    return { scrollWidth, befund: `weitergeleitet nach ${url}`, screenshot: bild };
  });

  /* -------- 11. Konto-Übersicht -------- */
  await reise("Konto-Übersicht", () => standardPruefung("11-konto", `${BASIS}/de/konto`,
    { erwartetPfad: "/de/konto", dateiVermutung: "app/[locale]/konto/page.tsx" }));

  /* -------- 12. Privates Inserat -------- */
  await reise("Privates Inserat (/de/inserieren)", async () => {
    const status = await navigiere(`${BASIS}/de/inserieren`);
    await schlaf(1200); // Weiterleitung in einen neuen Entwurf (VorabUebernahme), siehe components/inserieren/uebernahme.tsx
    const url = await js("location.pathname");
    const schrittSichtbar = await js("!!document.querySelector('.grosswahl')");
    assertTrue(status === 200 || status === null, `HTTP-Status ${status}`);
    assertTrue(schrittSichtbar, "Assistent-Schritt 1 (.grosswahl) nicht sichtbar — vermutlich components/inserieren/assistent.tsx");
    await js("document.querySelectorAll('.grosswahl button')[0]?.click()");
    await schlaf(400);
    const gesetzt = await js("document.querySelectorAll('.grosswahl button')[0]?.getAttribute('aria-pressed') === 'true'");
    const scrollWidth = await scrollWidthPruefen();
    const bild = await screenshot("12-inserieren");
    assertTrue(gesetzt, "Klick auf das erste Feld des Assistenten hat aria-pressed nicht gesetzt — vermutlich components/inserieren/assistent.tsx");
    return { scrollWidth, befund: `Schritt 1 ausfüllbar, Seite ${url}`, screenshot: bild };
  });

  /* -------- 13. Professionelles Dashboard -------- */
  await reise("Professionelles Dashboard (/de/konto/org/<slug>)", async () => {
    if (!ALPHA_OWNER) throw new Error(`var/profis.local.json ohne Passwort für alpha-owner@fourwalls.example gefunden (${PROFIS_DATEI}) — scripts/seed-profis.mjs zuerst laufen lassen?`);
    const owner = await fremdAnmelden(ALPHA_OWNER.email, ALPHA_OWNER.passwort, "alpha-owner");
    alphaOwnerId = owner.id;
    await cookiesLoeschen();
    await setzeCookie(owner.cookie);
    return standardPruefung("13-org-dashboard", `${BASIS}/de/konto/org/${ALPHA_SLUG}`,
      { erwartetPfad: `/de/konto/org/${ALPHA_SLUG}`, dateiVermutung: `app/[locale]/konto/org/[slug]/page.tsx` });
  });

  /* -------- 14. Organisationsteam -------- */
  await reise("Organisationsteam (/de/konto/org/<slug>/team)", () => standardPruefung(
    "14-org-team", `${BASIS}/de/konto/org/${ALPHA_SLUG}/team`,
    { erwartetPfad: `/de/konto/org/${ALPHA_SLUG}/team`, dateiVermutung: `app/[locale]/konto/org/[slug]/team/page.tsx` }));

  /* -------- Zurück zum eigenen Konto für Anliegen/Anmelden-Reisen -------- */
  await reise("Zurück zum eigenen Konto (Cookie wechseln)", async () => {
    await cookiesLoeschen();
    await setzeCookie(kunde.cookie);
    return { befund: "Cookie auf h8a-Kundenkonto gesetzt" };
  });

  /* -------- 15. Anliegen-Formular (Bewertung) -------- */
  let anliegenRef = null;
  await reise("Anliegen-Formular (/de/bewertung)", async () => {
    const status = await navigiere(`${BASIS}/de/bewertung`);
    const scrollWidthVorher = await scrollWidthPruefen();
    assertTrue(status === 200, `HTTP-Status ${status}`);
    assertTrue(scrollWidthVorher === 390, `scrollWidth=${scrollWidthVorher}`);

    /* Ort tippen + Vorschlag wählen */
    await js(`(() => { const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const f = document.querySelector('#al-ort'); setter.call(f, 'Zürich'); f.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    let vorschlagDa = false;
    for (let i = 0; i < 10 && !vorschlagDa; i++) { await schlaf(300); vorschlagDa = await js("!!document.querySelector('.vorschlaege.an button')"); }
    assertTrue(vorschlagDa, "kein Ort-Vorschlag erschienen — vermutlich components/anliegen/objekt-block.tsx oder app/api/orte/route.ts");
    await js("document.querySelector('.vorschlaege.an button')?.click()");
    await schlaf(300);

    /* Objektart */
    await js("document.querySelector('#al-typ .grosswahl button')?.click()");
    await schlaf(200);

    /* Weiter -> Kontakt */
    await js("document.querySelector('button.knopf.voll.gross')?.click()");
    await schlaf(500);
    const kontaktSichtbar = await js("!!document.querySelector('#al-name')");
    assertTrue(kontaktSichtbar, "Kontaktschritt (#al-name) nach «Weiter» nicht sichtbar — vermutlich components/anliegen/anliegen-formular.tsx");

    /* Kontakt ausfüllen */
    const kontaktName = "Mobil Prüfperson h8a";
    await js(`(() => { const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const n = document.querySelector('#al-name'); setter.call(n, ${JSON.stringify(kontaktName)}); n.dispatchEvent(new Event('input', { bubbles: true }));
      const e = document.querySelector('#al-email'); setter.call(e, ${JSON.stringify(EMAIL_KUNDE)}); e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await schlaf(200);

    /* Weiter -> Prüfen */
    await js("document.querySelector('button.knopf.voll.gross')?.click()");
    await schlaf(500);

    /* Senden */
    await js("document.querySelector('button.knopf.voll.gross')?.click()");
    await schlaf(1500);

    const scrollWidth = await scrollWidthPruefen();
    const bild = await screenshot("15-anliegen");
    const erfolgText = await js("(document.querySelector('[role=status]')||{}).textContent || ''");
    const treffer = /FWS-\d{4}-\d{6}/.exec(erfolgText || "");
    assertTrue(!!treffer, `keine Erfolgsmeldung mit FWS-Referenz gefunden (Text: ${JSON.stringify((erfolgText || "").slice(0, 200))}) — vermutlich components/anliegen/anliegen-formular.tsx oder app/api/anliegen/route.ts`);
    anliegenRef = treffer[0];
    return { scrollWidth, befund: `Referenz ${anliegenRef}`, screenshot: bild };
  });

  /* -------- 16. Meine Anliegen -------- */
  await reise("Meine Anliegen (/de/konto/anliegen)", async () => {
    const r = await standardPruefung("16-meine-anliegen", `${BASIS}/de/konto/anliegen`,
      { erwartetPfad: "/de/konto/anliegen", dateiVermutung: "app/[locale]/konto/anliegen/page.tsx oder server/anliegen.ts" });
    if (anliegenRef) {
      const text = await js("document.body.innerText || ''");
      assertTrue((text || "").includes(anliegenRef), `Referenz ${anliegenRef} nicht auf /de/konto/anliegen gefunden`);
    }
    return r;
  });

  /* -------- 17. Interner Lead (staff-Konto) -------- */
  await reise("Interner Lead (/de/intern/anliegen, staff-Konto per SQL)", async () => {
    staff = await kontoAnlegen(EMAIL_STAFF, "Mobil Staff h8a", "staff");
    await sql`UPDATE app_user SET platform_role = 'staff' WHERE id = ${staff.id}`;
    await cookiesLoeschen();
    await setzeCookie(staff.cookie);

    const listeStatus = await navigiere(`${BASIS}/de/intern/anliegen`);
    const listePfad = await js("location.pathname");
    await schlaf(500); // eine vereinzelte Messung während der Hydration lieferte hier einmalig scrollWidth=728
    const scrollWidthListe = await scrollWidthPruefen();
    const bildListe = await screenshot("17-intern-liste");
    assertTrue(listePfad === "/de/intern/anliegen", `nach /de/intern/anliegen auf ${listePfad} umgeleitet (keine gültige Sitzung als staff?)`);
    assertTrue(listeStatus === 200, `Liste HTTP-Status ${listeStatus}`);
    assertTrue(scrollWidthListe === 390, `Liste scrollWidth=${scrollWidthListe}`);

    if (!anliegenRef) throw new Error("keine Anliegen-Referenz aus der vorherigen Reise vorhanden");
    const detailStatus = await navigiere(`${BASIS}/de/intern/anliegen/${anliegenRef.toLowerCase()}`);
    const scrollWidthDetail = await scrollWidthPruefen();
    const bildDetail = await screenshot("17-intern-detail");
    const text = await js("document.body.innerText || ''");
    assertTrue(detailStatus === 200, `Detail HTTP-Status ${detailStatus}`);
    assertTrue(scrollWidthDetail === 390, `Detail scrollWidth=${scrollWidthDetail}`);
    assertTrue((text || "").includes(anliegenRef), `Referenz ${anliegenRef} nicht auf der Detailseite gefunden — vermutlich app/[locale]/intern/anliegen/[ref]/page.tsx`);

    return { scrollWidth: scrollWidthDetail, befund: `Liste ok, Detail zeigt ${anliegenRef}`, screenshot: `${bildListe} , ${bildDetail}` };
  });

  /* -------- Zurück zu anonym für die letzten beiden Reisen -------- */
  await cookiesLoeschen();

  /* -------- 18. Wissensbeitrag -------- */
  await reise("Wissensbeitrag (/de/wissen/immobilien-einschaetzung)", () => standardPruefung(
    "18-wissen", `${BASIS}/de/wissen/immobilien-einschaetzung`,
    { dateiVermutung: "app/[locale]/wissen/[slug]/page.tsx" }));

  /* -------- 19. Rechtsseite -------- */
  await reise("Rechtsseite (/de/datenschutz)", () => standardPruefung(
    "19-datenschutz", `${BASIS}/de/datenschutz`,
    { dateiVermutung: "app/[locale]/datenschutz/page.tsx" }));

} finally {
  await chromeBeenden();
  await aufraeumen();
  void alphaOwnerId;
  await sql.end({ timeout: 5 });
}

/* ================= Bericht ================= */
const dauerMs = Date.now() - START;
console.log("\n" + "=".repeat(78));
console.log("Reise".padEnd(46), "Status".padEnd(8), "scrollWidth", " Befund");
for (const r of ergebnisse) {
  console.log(r.name.padEnd(46), r.status.padEnd(8), String(r.scrollWidth).padEnd(11), " " + r.befund);
  if (r.screenshot) console.log("  Screenshot:", r.screenshot);
}
console.log("=".repeat(78));
console.log(`${ergebnisse.length - fehlerZaehler}/${ergebnisse.length} Reisen OK` + (fehlerZaehler ? `, ${fehlerZaehler} FEHLER` : "") + ` — Dauer ${(dauerMs / 1000).toFixed(1)}s`);
process.exit(fehlerZaehler ? 1 : 0);
