#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Anfragen ↔ Konto (P5.6)

   Prüft, dass eine Anfrage eines angemeldeten Kontos mit sender_user_id
   verknüpft wird, dass «Meine Anfragen» (/konto/anfragen) nur die eigenen
   Anfragen zeigt (IDOR-Falsifikation mit einem zweiten Konto) und dass eine
   anonyme Anfrage weiterhin ohne Konto möglich bleibt (sender_user_id NULL).

   Aufruf:
     set -a; . ./.env.local; set +a
     node scripts/anfragen-test.mjs [Basis-URL]      Standard: http://localhost:3007

   Mailquelle (P5.5 §53/§54/§63) — siehe scripts/lib/mailquelle.mjs:
     FW_TEST_MAIL_QUELLE   dev (Standard) | mailpit | imap
     (weitere Variablen siehe scripts/lieferkette-test.mjs)

   Ausgabe:
     - nummerierte Tabelle auf stdout (Schritt → OK/FEHLER + Detail)
     - var/anfragen-bericht.json
     - Exit 1 bei irgendeinem FEHLER, sonst 0

   Achtung Ratenlimit: /sign-in/email erlaubt 8 Anmeldungen je 5 Minuten und
   Herkunft (server/auth.ts) — deshalb wie in lieferkette-test.mjs eine
   eigene x-forwarded-for-Adresse je Testperson.

   Die Datei ändert an der Anwendung nichts — sie meldet nur Befunde.
   ============================================================ */
import postgres from "postgres";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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

const EMAIL_A = testadresse("afa", TS);
const EMAIL_B = testadresse("afb", TS);
const EMAIL_ANON = testadresse("afc", TS);
const PASSWORT = "Lauf-" + randomBytes(12).toString("base64url");

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

/* Verschiedene x-forwarded-for-Adressen je Testperson (Ratenlimit 8/5min je Herkunft). */
const RUNSEED = Math.floor(Math.random() * 200) + 10;
const xffMap = new Map();
function xff(tag) {
  if (!xffMap.has(tag)) xffMap.set(tag, `10.${RUNSEED}.${xffMap.size + 1}.21`);
  return xffMap.get(tag);
}

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
    return { status: res.status, json, text, setCookies, location: res.headers.get("location") };
  } finally { clearTimeout(timer); }
}
const get = (p, o) => api("GET", p, o);
const post = (p, o) => api("POST", p, o);

function cookieAus(setCookies) {
  const c = setCookies.find(c => c.startsWith("fw.session_token="));
  return c ? c.split(";")[0] : null;
}

async function holenHtml(pfad, { cookie, headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const h = { ...headers };
    if (cookie) h["cookie"] = cookie;
    const res = await fetch(BASIS + pfad, { headers: h, redirect: "manual", signal: ctrl.signal });
    const text = await res.text().catch(() => "");
    return { status: res.status, text, location: res.headers.get("location") };
  } finally { clearTimeout(timer); }
}

async function registrieren(email, passwort, name, xffTag) {
  return post("/api/auth/sign-up/email", { origin: BASIS, xffTag, body: { email, password: passwort, name } });
}
async function anmelden(email, passwort, xffTag) {
  const r = await post("/api/auth/sign-in/email", { origin: BASIS, xffTag, body: { email, password: passwort } });
  return { ...r, cookie: cookieAus(r.setCookies) };
}

const MAILQUELLE = mailquelle();
async function bestaetigeMail(email) {
  const mail = await MAILQUELLE.warte(email, null);
  if (!mail) throw new Error(`Keine Mail für ${email} über Mailquelle "${MAILQUELLE.name}" gefunden (30 s gewartet)`);
  const treffer = mail.text.match(/https?:\/\/\S+/);
  if (!treffer) throw new Error(`Keine URL in der Mail an ${email} gefunden`);
  const res = await fetch(treffer[0], { redirect: "manual" });
  return res.status;
}

async function personAnlegen(email, xffTag, name) {
  const su = await registrieren(email, PASSWORT, name, xffTag);
  assertGleich(su.status, 200, `sign-up status (${email})`);
  const best = await bestaetigeMail(email);
  assertGleich(best, 302, `bestätigung status (${email})`);
  const si = await anmelden(email, PASSWORT, xffTag);
  assertGleich(si.status, 200, `sign-in status (${email})`);
  assertTrue(!!si.cookie, `kein Sitzungscookie für ${email}`);
  return { email, cookie: si.cookie, id: si.json.user.id };
}

const START = Date.now();
console.log(`Basis: ${BASIS}  —  Anfragen-↔-Konto-Prüfung startet (TS=${TS})`);

let refZiel, titelZiel;
let A, B;
let publicRefA, msgA, refIdA;

await schritt(1, "Ein veröffentlichtes Demo-Inserat als Ziel wählen", async () => {
  const [row] = await sql`SELECT public_ref, title FROM listing WHERE status IN ('published','reserved') ORDER BY public_ref LIMIT 1`;
  assertTrue(!!row, "kein veröffentlichtes Inserat in der Datenbank gefunden");
  refZiel = String(row.public_ref); titelZiel = String(row.title ?? "");
  return `refZiel=${refZiel}, titel=${titelZiel}`;
});

await schritt(2, "USER A registrieren, bestätigen, anmelden", async () => {
  A = await personAnlegen(EMAIL_A, "a-auth", "User A (Anfragen)");
  return `id=${A.id}`;
});

await schritt(3, "USER A sendet eine Anfrage zum Ziel-Inserat", async () => {
  msgA = `Automatisierte Anfragen-Prüfung — bitte ignorieren — ${TS}-${randomBytes(6).toString("hex")}`;
  const r = await post("/api/inquiries", {
    origin: BASIS, xffTag: "a-inquiry", cookie: A.cookie,
    body: { publicRef: refZiel, art: "viewing_request", name: "User A (Anfragen)", email: EMAIL_A, nachricht: msgA, firma: "" }
  });
  assertGleich(r.status, 201, "status");
  assertTrue(!!r.json?.publicRef, "keine publicRef in der Antwort");
  publicRefA = r.json.publicRef;
  return `status=${r.status}, inquiry=${publicRefA}`;
});

await schritt(4, "sender_user_id ist in der DB gesetzt und stimmt mit A überein", async () => {
  const [row] = await sql`SELECT id, sender_user_id FROM inquiry WHERE public_ref = ${publicRefA}`;
  assertTrue(!!row, `keine inquiry-Zeile für ${publicRefA} gefunden`);
  assertTrue(row.sender_user_id != null, "sender_user_id ist NULL");
  assertGleich(String(row.sender_user_id), String(A.id), "sender_user_id");
  refIdA = row.id;
  return `sender_user_id=${row.sender_user_id}`;
});

await schritt(5, "Die Anfrage erscheint in meineAnfragen(A) (dieselbe Abfrage wie /konto/anfragen)", async () => {
  const z = await sql`
    SELECT i.public_ref, l.title AS listing_title FROM inquiry i
      LEFT JOIN listing l ON l.id = i.listing_id
     WHERE i.sender_user_id = ${A.id} ORDER BY i.created_at DESC LIMIT 100`;
  const treffer = z.find(r => r.public_ref === publicRefA);
  assertTrue(!!treffer, `${publicRefA} nicht in meineAnfragen(A) (${z.length} Zeilen)`);
  assertGleich(String(treffer.listing_title ?? ""), titelZiel, "listing_title");
  return `gefunden, listing_title=${treffer.listing_title}`;
});

await schritt(6, "GET /konto/anfragen (A) — 200, enthält den Titel des Ziel-Inserats", async () => {
  const r = await holenHtml("/de/konto/anfragen", { cookie: A.cookie });
  assertGleich(r.status, 200, "status");
  assertTrue(r.text.includes(titelZiel), `Titel «${titelZiel}» nicht im HTML gefunden`);
  return `status=${r.status}, Titel im HTML gefunden`;
});

await schritt(7, "USER B registrieren, bestätigen, anmelden", async () => {
  B = await personAnlegen(EMAIL_B, "b-auth", "User B (Anfragen)");
  return `id=${B.id}`;
});

await schritt(8, "IDOR-Falsifikation: GET /konto/anfragen (B) zeigt A's Anfrage NICHT", async () => {
  const r = await holenHtml("/de/konto/anfragen", { cookie: B.cookie });
  assertGleich(r.status, 200, "status");
  assertTrue(!r.text.includes(msgA), "A's Nachricht im HTML von B gefunden");
  assertTrue(!r.text.includes(publicRefA), "A's Anfrage-Referenz im HTML von B gefunden");
  return `status=${r.status}, weder Nachricht noch Referenz von A im HTML von B gefunden`;
});

await schritt(9, "Anonyme Anfrage (kein Cookie) bleibt weiterhin möglich", async () => {
  const nachricht = `Automatisierte Anfragen-Prüfung (anonym) — bitte ignorieren — ${TS}-${randomBytes(6).toString("hex")}`;
  const r = await post("/api/inquiries", {
    origin: BASIS, xffTag: "anon-inquiry",
    body: { publicRef: refZiel, art: "listing_question", name: "Anonyme Prüfperson", email: EMAIL_ANON, nachricht, firma: "" }
  });
  assertGleich(r.status, 201, "status");
  assertTrue(!!r.json?.publicRef, "keine publicRef in der Antwort");
  const [row] = await sql`SELECT sender_user_id FROM inquiry WHERE public_ref = ${r.json.publicRef}`;
  assertTrue(!!row, "keine inquiry-Zeile gefunden");
  assertTrue(row.sender_user_id == null, `sender_user_id ist nicht NULL: ${row.sender_user_id}`);
  return `status=${r.status}, inquiry=${r.json.publicRef}, sender_user_id=NULL`;
});

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

const bericht = {
  basis: BASIS, zeit: new Date().toISOString(), dauerMs,
  personen: { a: EMAIL_A, b: EMAIL_B },
  refZiel: refZiel ?? null,
  ergebnisse
};
const varOrdner = join(APP_ROOT, "var");
mkdirSync(varOrdner, { recursive: true });
const berichtPfad = join(varOrdner, "anfragen-bericht.json");
writeFileSync(berichtPfad, JSON.stringify(bericht, null, 2));
console.log(`Bericht geschrieben: ${berichtPfad}`);

await sql.end();
process.exit(fehlerAnzahl > 0 ? 1 : 0);
