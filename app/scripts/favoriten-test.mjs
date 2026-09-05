#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Merkliste (Favoriten) über Konto: Prüfreise

   Prüft, dass die serverseitige Merkliste angemeldeter Personen
   geräteübergreifend, dupliktenfrei, pro Person getrennt und gegen fremde
   Referenzen (IDOR) abgesichert ist. Läuft gegen einen laufenden Server per
   HTTP (Stil wie scripts/lieferkette-test.mjs, hier auf das Nötige gekürzt).

   Aufruf:
     set -a; . ./.env.local; set +a
     node scripts/favoriten-test.mjs [Basis-URL]      Standard: http://localhost:3007

   Ausgabe: nummerierte Tabelle, Exit 1 bei irgendeinem FEHLER, sonst 0.
   Die Datei ändert an der Anwendung nichts — sie meldet nur Befunde.
   ============================================================ */
import postgres from "postgres";
import { randomBytes } from "node:crypto";
import { mailquelle, testadresse } from "./lib/mailquelle.mjs";

const BASIS = (process.argv[2] || "http://localhost:3007").replace(/\/$/, "");
const TIMEOUT_MS = 60_000;
const TS = Date.now();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a)"); process.exit(2); }
const sql = postgres(DATABASE_URL, { max: 4, onnotice: () => {} });

const PASSWORT = "Merk-" + randomBytes(12).toString("base64url");
const EMAIL_A = testadresse("fva", TS);
const EMAIL_B = testadresse("fvb", TS);
const EMAIL_C = testadresse("fvc", TS);
const REF_FREMD_ENTWURF = "FWL-2099-000001";   // existiert nicht — steht für «fremd/nicht existent»
const REF_ERFUNDEN = "FWL-2099-999999";        // sieht gültig aus, existiert aber nicht

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

/* ---------- Verschiedene x-forwarded-for-Adressen (Registrierung 5/h, Anmeldung 8/5min je Herkunft) ---------- */
const RUNSEED = Math.floor(Math.random() * 200) + 10;
const xffMap = new Map();
function xff(tag) {
  if (!xffMap.has(tag)) xffMap.set(tag, `10.${RUNSEED}.${xffMap.size + 1}.21`);
  return xffMap.get(tag);
}

/* ---------- HTTP-Hilfsfunktionen ---------- */
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
function cookieAus(setCookies) {
  const c = setCookies.find(c => c.startsWith("fw.session_token="));
  return c ? c.split(";")[0] : null;
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
async function registrieren(email, passwort, name, xffTag) {
  return post("/api/auth/sign-up/email", { origin: BASIS, xffTag, body: { email, password: passwort, name } });
}
async function anmelden(email, passwort, xffTag) {
  const r = await post("/api/auth/sign-in/email", { origin: BASIS, xffTag, body: { email, password: passwort } });
  return { ...r, cookie: cookieAus(r.setCookies) };
}
async function registrierenUndAnmelden(email, name, tagPrefix) {
  const su = await registrieren(email, PASSWORT, name, `${tagPrefix}-signup`);
  assertGleich(su.status, 200, "sign-up status");
  const best = await bestaetigeMail(email);
  assertGleich(best, 302, "bestätigung status");
  const si = await anmelden(email, PASSWORT, `${tagPrefix}-auth`);
  assertGleich(si.status, 200, "sign-in status");
  assertTrue(!!si.cookie, "kein Sitzungscookie erhalten");
  return { email, cookie: si.cookie, id: si.json.user.id };
}

const START = Date.now();
console.log(`Basis: ${BASIS}  —  Merkliste-Prüfreise startet (TS=${TS})`);

let A, B, C, refDemo, listingIdDemo;

await schritt(1, "Demo-Inserat aus der DB besorgen", async () => {
  const [row] = await sql`SELECT id, public_ref FROM listing WHERE is_demo AND status = 'published' LIMIT 1`;
  assertTrue(!!row, "kein veröffentlichtes Demo-Inserat gefunden");
  refDemo = row.public_ref; listingIdDemo = row.id;
  return `refDemo=${refDemo}`;
});

await schritt(2, "Anonym: GET /api/favoriten → 401", async () => {
  const r = await get("/api/favoriten", {});
  assertGleich(r.status, 401, "status");
  return `status=${r.status}`;
});

await schritt(3, "Konto A registrieren, bestätigen, anmelden", async () => {
  A = await registrierenUndAnmelden(EMAIL_A, "Fav A", "a");
  return `id=${A.id}`;
});

await schritt(4, "A merkt das Demo-Inserat → gemerkt:true, genau eine Zeile in der DB", async () => {
  const r = await post("/api/favoriten", { origin: BASIS, cookie: A.cookie, body: { publicRef: refDemo } });
  assertGleich(r.status, 200, "status");
  assertGleich(r.json?.gemerkt, true, "gemerkt");
  const zeilen = await sql`SELECT id FROM favorite WHERE user_id = ${A.id} AND listing_id = ${listingIdDemo}`;
  assertGleich(zeilen.length, 1, "Anzahl Zeilen in favorite");
  return `gemerkt=${r.json.gemerkt}, dbZeilen=${zeilen.length}`;
});

await schritt(5, "A kippt erneut → gemerkt:false, keine Zeile mehr in der DB", async () => {
  const r = await post("/api/favoriten", { origin: BASIS, cookie: A.cookie, body: { publicRef: refDemo } });
  assertGleich(r.status, 200, "status");
  assertGleich(r.json?.gemerkt, false, "gemerkt");
  const zeilen = await sql`SELECT id FROM favorite WHERE user_id = ${A.id} AND listing_id = ${listingIdDemo}`;
  assertGleich(zeilen.length, 0, "Anzahl Zeilen in favorite");
  return `gemerkt=${r.json.gemerkt}, dbZeilen=${zeilen.length}`;
});

await schritt(6, "A merkt erneut, GET zeigt die Referenz genau einmal (kein Duplikat)", async () => {
  const r1 = await post("/api/favoriten", { origin: BASIS, cookie: A.cookie, body: { publicRef: refDemo } });
  assertGleich(r1.json?.gemerkt, true, "gemerkt nach erneutem Merken");
  const liste = await get("/api/favoriten", { cookie: A.cookie });
  assertGleich(liste.status, 200, "status");
  const vorkommen = (liste.json.refs ?? []).filter(x => x === refDemo).length;
  assertGleich(vorkommen, 1, "Vorkommen von refDemo in refs");
  return `refs=${JSON.stringify(liste.json.refs)}`;
});

await schritt(7, "Konto B: eigene Merkliste ist leer, sieht NICHT die von A", async () => {
  B = await registrierenUndAnmelden(EMAIL_B, "Fav B", "b");
  const r = await get("/api/favoriten", { cookie: B.cookie });
  assertGleich(r.status, 200, "status");
  assertGleich((r.json.refs ?? []).length, 0, "Anzahl refs für B");
  assertTrue(!(r.json.refs ?? []).includes(refDemo), "B sieht refDemo von A");
  return `refs(B)=${JSON.stringify(r.json.refs)}`;
});

await schritt(8, "IDOR: B merkt eine nur im Entwurf/nicht existente Referenz → NOT_FOUND, keine Zeile", async () => {
  const r = await post("/api/favoriten", { origin: BASIS, cookie: B.cookie, body: { publicRef: REF_FREMD_ENTWURF } });
  assertGleich(r.status, 404, "status");
  assertGleich(r.json?.error, "NOT_FOUND", "error-code");
  const zeilen = await sql`
    SELECT f.id FROM favorite f JOIN listing l ON l.id = f.listing_id
     WHERE f.user_id = ${B.id} AND l.public_ref = ${REF_FREMD_ENTWURF}`;
  assertGleich(zeilen.length, 0, "Anzahl Zeilen für die fremde Referenz");
  return `status=${r.status}, error=${r.json?.error}`;
});

await schritt(9, "Konto C: Merge mit einer echten und einer erfundenen Referenz → ok:true, nur die echte übernommen", async () => {
  C = await registrierenUndAnmelden(EMAIL_C, "Fav C", "c");
  const r = await post("/api/favoriten/merge", { origin: BASIS, cookie: C.cookie, body: { refs: [refDemo, REF_ERFUNDEN] } });
  assertGleich(r.status, 200, "status");
  assertGleich(r.json?.ok, true, "ok");
  const liste = await get("/api/favoriten", { cookie: C.cookie });
  assertGleich(liste.status, 200, "status (liste)");
  assertTrue((liste.json.refs ?? []).includes(refDemo), "refDemo fehlt nach Merge");
  assertTrue(!(liste.json.refs ?? []).includes(REF_ERFUNDEN), "erfundene Referenz wurde übernommen");
  return `refs(C)=${JSON.stringify(liste.json.refs)}`;
});

await schritt(10, "Merge zweimal hintereinander mit denselben refs → kein Duplikat, kein Fehler", async () => {
  const r = await post("/api/favoriten/merge", { origin: BASIS, cookie: C.cookie, body: { refs: [refDemo, REF_ERFUNDEN] } });
  assertGleich(r.status, 200, "status");
  assertGleich(r.json?.ok, true, "ok");
  const zeilen = await sql`SELECT id FROM favorite WHERE user_id = ${C.id} AND listing_id = ${listingIdDemo}`;
  assertGleich(zeilen.length, 1, "Anzahl Zeilen in favorite nach doppeltem Merge");
  const liste = await get("/api/favoriten", { cookie: C.cookie });
  const vorkommen = (liste.json.refs ?? []).filter(x => x === refDemo).length;
  assertGleich(vorkommen, 1, "Vorkommen von refDemo in refs(C) nach doppeltem Merge");
  return `dbZeilen=${zeilen.length}, vorkommenInRefs=${vorkommen}`;
});

/* ---------- P5.7-Politur: anonyme Merkliste (/konto/favoriten ohne Sitzung) ---------- */
let refAnonA, refAnonB;

await schritt(11, "Zwei echte, öffentliche Demo-Referenzen für die anonyme Merkliste besorgen", async () => {
  const zeilen = await sql`SELECT public_ref FROM listing WHERE is_demo AND status IN ('published','reserved') ORDER BY public_ref LIMIT 2`;
  assertTrue(zeilen.length === 2, "nicht genug öffentliche Demo-Inserate gefunden");
  refAnonA = zeilen[0].public_ref; refAnonB = zeilen[1].public_ref;
  return `refAnonA=${refAnonA}, refAnonB=${refAnonB}`;
});

await schritt(12, "Anonym: GET /api/favoriten/aufloesen?refs=<2 echte Refs> → 200 mit 2 Treffern", async () => {
  const r = await get(`/api/favoriten/aufloesen?refs=${encodeURIComponent(`${refAnonA},${refAnonB}`)}`, {});
  assertGleich(r.status, 200, "status");
  const ids = (r.json?.treffer ?? []).map(x => x.id);
  assertGleich(ids.length, 2, "Anzahl Treffer");
  assertTrue(ids.includes(refAnonA) && ids.includes(refAnonB), `beide Referenzen fehlen im Ergebnis (${ids.join(",")})`);
  return `treffer=${ids.join(",")}`;
});

await schritt(13, "Anonym: GET /de/konto/favoriten → 200 (kein Redirect zur Anmeldung mehr)", async () => {
  const r = await get("/de/konto/favoriten", {});
  assertGleich(r.status, 200, "status");
  return `status=${r.status}`;
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
