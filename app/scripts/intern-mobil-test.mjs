#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Intern/Anliegen: Mobil (390 px) + Basis-A11y (P5.8)

   Nimmt die Liste und ein Detail des internen Bereichs bei 390 px auf
   (dasselbe CDP-Muster wie tools/baseline.mjs, ohne Screenshot) und prüft:
     - document.documentElement.scrollWidth === 390 (kein horizontales Scrollen)
     - Filter-Steuerelemente haben ein <label>
     - die Tabelle hat <th scope="col">
     - die Statuswechsel-Knöpfe haben sichtbaren Text

   Braucht Chrome und Node ≥ 22 (globales WebSocket) sowie ein staff-Konto
   (wird hier per API angelegt und per SQL hochgestuft, wie in
   scripts/anliegen-test.mjs).

   Aufruf:
     set -a; . ./.env.local; set +a
     node scripts/intern-mobil-test.mjs [Basis-URL]
   ============================================================ */
import postgres from "postgres";
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { mailquelle } from "./lib/mailquelle.mjs";

const MAILQUELLE = mailquelle();

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASIS = (process.argv[2] || "http://localhost:3007").replace(/\/$/, "");
const TS = Date.now();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a)"); process.exit(2); }
const sql = postgres(DATABASE_URL, { max: 2, onnotice: () => {} });

const PASSWORT = "Mobil-" + randomBytes(12).toString("base64url");
const EMAIL = `imstaff+${TS}@example.com`;

/* Eigene x-forwarded-for-Adresse für dieses Skript (Ratenlimit ist je
   Herkunft) — läuft in CI sequentiell mit anderen HTTP-Suiten gegen denselben
   Server, deshalb eine eigene Adresse statt der gemeinsamen Standard-Herkunft. */
const RUNSEED = Math.floor(Math.random() * 200) + 10;
const XFF = `10.${RUNSEED}.1.31`;

const ergebnisse = [];
function assertTrue(bedingung, meldung) { if (!bedingung) throw new Error(meldung); }
async function schritt(titel, fn) {
  try {
    const detail = (await fn()) || "ok";
    ergebnisse.push({ titel, status: "OK", detail });
    console.log(`OK      ${titel}`);
  } catch (e) {
    const detail = e && e.message ? e.message : String(e);
    ergebnisse.push({ titel, status: "FEHLER", detail });
    console.log(`FEHLER  ${titel} — ${detail}`);
  }
}

async function api(method, pfad, { body } = {}) {
  const h = { "x-forwarded-for": XFF }; let payload;
  if (body !== undefined) { h["content-type"] = "application/json"; payload = JSON.stringify(body); }
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

async function mitSeiteArbeiten(fn) {
  const port = 9800 + Math.floor(Math.random() * 400);
  const profil = `/tmp/fw-intern-mobil-${port}`;
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
    setTimeout(() => { try { rmSync(profil, { recursive: true, force: true }); } catch { /* schon weg */ } }, 500);
  }
}

const START = Date.now();
console.log(`Basis: ${BASIS}  —  Intern/Anliegen: Mobil + A11y (TS=${TS})`);

let cookieRoh, ref;

try {
  await schritt("staff-Konto anlegen, bestätigen, anmelden, hochstufen", async () => {
    const seit = Date.now();
    const su = await api("POST", "/api/auth/sign-up/email", { body: { email: EMAIL, password: PASSWORT, name: "Mobil Staff" } });
    assertTrue(su.status === 200, `sign-up status=${su.status}`);
    const mail = await MAILQUELLE.warte(EMAIL, seit);
    assertTrue(!!mail, `keine Bestätigungsmail für ${EMAIL} über Mailquelle "${MAILQUELLE.name}" gefunden`);
    const treffer = mail.text.match(/https?:\/\/\S+/);
    assertTrue(!!treffer, "keine URL in der Bestätigungsmail gefunden");
    const best = await fetch(treffer[0], { redirect: "manual", headers: { "x-forwarded-for": XFF } });
    assertTrue(best.status === 302, `Bestätigung status=${best.status}`);
    const si = await api("POST", "/api/auth/sign-in/email", { body: { email: EMAIL, password: PASSWORT } });
    assertTrue(si.status === 200, `sign-in status=${si.status}`);
    cookieRoh = cookieAus(si.setCookies);
    assertTrue(!!cookieRoh, "kein Sitzungscookie erhalten");
    await sql`UPDATE app_user SET platform_role = 'staff' WHERE id = ${si.json.user.id}`;
    return `id=${si.json.user.id}`;
  });

  await schritt("Ein Anliegen anlegen (für die Detailseite)", async () => {
    const r = await api("POST", "/api/anliegen", {
      body: { dienst: "sell", kontakt: { name: "Mobil Prüfperson", email: `imkontakt+${TS}@example.com` },
        objekt: { ortId: "ort-zuerich", typ: "wohnung" }, sprache: "de", herkunft: { seite: "/de/verkaufen" }, firma: "" }
    });
    assertTrue(r.status === 201, `status=${r.status}`);
    ref = r.json.publicRef;
    return `publicRef=${ref}`;
  });

  const cookieName = cookieRoh.split("=")[0];
  const cookieValue = cookieRoh.split("=").slice(1).join("=");

  await mitSeiteArbeiten(async ({ cmd, js }) => {
    const basisUrl = new URL(BASIS);
    await cmd("Network.setCookie", { name: cookieName, value: cookieValue, domain: basisUrl.hostname, path: "/", httpOnly: true, secure: false });

    await schritt("Liste /de/intern/anliegen bei 390 px: kein horizontales Scrollen", async () => {
      await cmd("Page.navigate", { url: `${BASIS}/de/intern/anliegen` });
      await schlaf(2500);
      const breite = await js("document.documentElement.scrollWidth");
      assertTrue(breite === 390, `scrollWidth=${breite}, erwartet 390`);
      return `scrollWidth=${breite}`;
    });
    await schritt("Liste: Filter-Steuerelemente haben ein <label>", async () => {
      const anzahl = await js(`document.querySelectorAll('label[for="fStatus"],label[for="fService"],label[for="fLocale"],label[for="fQ"]').length`);
      assertTrue(anzahl === 4, `${anzahl}/4 Filter-Labels gefunden`);
      return `${anzahl}/4 Filter-Labels`;
    });
    await schritt("Liste: Tabelle hat <th scope=\"col\">", async () => {
      const anzahl = await js(`document.querySelectorAll('table th[scope="col"]').length`);
      assertTrue(anzahl > 0, "kein <th scope=\"col\"> gefunden");
      return `${anzahl} <th scope> gefunden`;
    });

    await schritt("Detail /de/intern/anliegen/<ref> bei 390 px: kein horizontales Scrollen", async () => {
      await cmd("Page.navigate", { url: `${BASIS}/de/intern/anliegen/${ref.toLowerCase()}` });
      await schlaf(2500);
      const breite = await js("document.documentElement.scrollWidth");
      assertTrue(breite === 390, `scrollWidth=${breite}, erwartet 390`);
      return `scrollWidth=${breite}`;
    });
    await schritt("Detail: Statuswechsel-Knöpfe haben sichtbaren Text", async () => {
      const texte = await js(`Array.from(document.querySelectorAll('button.knopf')).map(b => b.textContent.trim())`);
      assertTrue(Array.isArray(texte) && texte.length > 0, "keine Status-Knöpfe gefunden");
      assertTrue(texte.every(t => t.length > 0), `ein Knopf ohne Text: ${JSON.stringify(texte)}`);
      return `Knöpfe: ${JSON.stringify(texte)}`;
    });
    await schritt("Detail: Zuweisen-Auswahl hat aria-label", async () => {
      const hat = await js(`!!document.querySelector('select[aria-label]')`);
      assertTrue(hat === true, "kein select[aria-label] gefunden");
      return "select[aria-label] vorhanden";
    });
  });
} finally {
  if (ref) await sql`DELETE FROM service_lead WHERE public_ref = ${ref}`;
  await sql.end({ timeout: 5 });
}

const dauerMs = Date.now() - START;
console.log(`\n${ergebnisse.length} Prüfungen, ${ergebnisse.filter(e => e.status === "FEHLER").length} FEHLER — Dauer ${(dauerMs / 1000).toFixed(1)}s`);
process.exit(ergebnisse.some(e => e.status === "FEHLER") ? 1 : 0);
