#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Zuletzt angesehen & Vergleich (P5.6 §27–§34)

   Prüft über echtes HTTP + direkten Datenbankzugriff:
     a) Ein angemeldetes Konto ruft eine Objektseite auf → recently_viewed
        bekommt eine Zeile für Konto+Inserat.
     b) Zweiter Aufruf derselben Objektseite → weiterhin nur eine Zeile
        (kein Duplikat), aber viewed_at wird aktualisiert.
     c) 30 verschiedene Objektseiten nacheinander → recently_viewed hat für
        dieses Konto höchstens 24 Zeilen (die Begrenzung greift aktiv).
     d) GET /api/vergleich?refs=<zwei echte>,<eine erfundene> → nur die zwei
        echten kommen zurück, die erfundene fehlt einfach.
     e) IDOR-Falsifikation: ein archiviertes (nicht öffentliches) Demo-
        Inserat fehlt im Vergleichsergebnis.

   Nur EIN Login (Ratenlimit: 8 Anmeldungen/5 Minuten je Konto) — die
   Objektseiten werden danach mit demselben Sitzungscookie wiederholt
   aufgerufen.

   Aufruf:
     set -a; . ./.env.local; set +a
     node scripts/verlauf-vergleich-test.mjs [Basis-URL]   Standard: http://localhost:3007
   ============================================================ */
import postgres from "postgres";
import { randomBytes } from "node:crypto";
import { testadresse, mailquelle } from "./lib/mailquelle.mjs";

const BASIS = (process.argv[2] || "http://localhost:3007").replace(/\/$/, "");
const TIMEOUT_MS = 30_000;
const TS = Date.now();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a)"); process.exit(2); }
const sql = postgres(DATABASE_URL, { max: 4, onnotice: () => {} });

const EMAIL = testadresse("vlvg", TS);
const PASSWORT = "Lauf-" + randomBytes(12).toString("base64url");
const MAILQUELLE = mailquelle();

const LOCALES_PFAD = { de: { immobilien: "immobilien", kaufen: "kaufen", mieten: "mieten" } };

const ergebnisse = [];
function assertTrue(bedingung, meldung) { if (!bedingung) throw new Error(meldung); }
function assertGleich(ist, soll, feld) { if (ist !== soll) throw new Error(`${feld}: erwartet ${JSON.stringify(soll)}, erhalten ${JSON.stringify(ist)}`); }

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

async function api(method, pfad, { cookie, origin, body, headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const h = { ...headers };
    if (cookie) h["cookie"] = cookie;
    if (origin !== undefined) h["origin"] = origin;
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

async function holenHtml(pfad, { cookie } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const h = {};
    if (cookie) h["cookie"] = cookie;
    const res = await fetch(BASIS + pfad, { headers: h, redirect: "manual", signal: ctrl.signal });
    const text = await res.text().catch(() => "");
    return { status: res.status, text };
  } finally { clearTimeout(timer); }
}

function cookieAus(setCookies) {
  const c = setCookies.find(c => c.startsWith("fw.session_token="));
  return c ? c.split(";")[0] : null;
}

async function bestaetigeMail(email) {
  const mail = await MAILQUELLE.warte(email, null);
  if (!mail) throw new Error(`Keine Mail für ${email} über Mailquelle "${MAILQUELLE.name}" gefunden (30 s gewartet)`);
  const treffer = mail.text.match(/https?:\/\/\S+/);
  if (!treffer) throw new Error(`Keine URL in der Mail an ${email} gefunden`);
  const res = await fetch(treffer[0], { redirect: "manual" });
  return res.status;
}

function objektPfad(z) {
  const p = LOCALES_PFAD.de;
  const art = z.transaction === "rent" ? p.mieten : p.kaufen;
  return `/de/${p.immobilien}/${art}/${z.slug}-${z.public_ref.toLowerCase()}`;
}

const START = Date.now();
console.log(`Basis: ${BASIS}  —  Zuletzt-angesehen/Vergleich-Prüfung startet (TS=${TS})`);

let cookie, personId;
let refA, refB; // zwei verschiedene, öffentliche Demo-Referenzen für a/b
let dreissigRefs = []; // 30 verschiedene öffentliche Demo-Referenzen für c
let vergleichRefs = []; // zwei echte, öffentliche Referenzen für d
let archiviertRef = null; // ein nicht (mehr) öffentliches Demo-Inserat für e

await schritt(1, "Konto registrieren, bestätigen, anmelden (ein einziges Mal)", async () => {
  const su = await post("/api/auth/sign-up/email", { origin: BASIS, body: { email: EMAIL, password: PASSWORT, name: "Verlauf-Vergleich-Test" } });
  assertGleich(su.status, 200, "sign-up status");
  const best = await bestaetigeMail(EMAIL);
  assertGleich(best, 302, "bestätigung status");
  const si = await post("/api/auth/sign-in/email", { origin: BASIS, body: { email: EMAIL, password: PASSWORT } });
  assertGleich(si.status, 200, "sign-in status");
  cookie = cookieAus(si.setCookies);
  assertTrue(!!cookie, "kein Sitzungscookie erhalten");
  personId = si.json.user.id;
  return `email=${EMAIL}, id=${personId}`;
});

await schritt(2, "Genug öffentliche Demo-Inserate für die Prüfung finden (>= 32)", async () => {
  const zeilen = await sql`
    SELECT public_ref, slug, transaction FROM listing
     WHERE is_demo AND status IN ('published','reserved')
     ORDER BY public_ref LIMIT 40`;
  assertTrue(zeilen.length >= 32, `nur ${zeilen.length} öffentliche Demo-Inserate gefunden, mindestens 32 nötig`);
  refA = zeilen[0]; refB = zeilen[1];
  dreissigRefs = zeilen.slice(0, 30);
  vergleichRefs = [zeilen[0].public_ref, zeilen[1].public_ref];
  return `refA=${refA.public_ref}, refB=${refB.public_ref}, 30 Referenzen für Schritt c bereit`;
});

await schritt(3, "Ein archiviertes (nicht öffentliches) Demo-Inserat für die IDOR-Prüfung finden", async () => {
  const zeilen = await sql`SELECT public_ref FROM listing WHERE is_demo AND status = 'archived' ORDER BY public_ref LIMIT 1`;
  if (!zeilen.length) { archiviertRef = null; return "kein archiviertes Demo-Inserat vorhanden — Teilschritt e wird ausgelassen"; }
  archiviertRef = zeilen[0].public_ref;
  return `archiviertRef=${archiviertRef}`;
});

await sql`DELETE FROM recently_viewed WHERE user_id = ${personId}`;

await schritt(4, "(a) Objektseite von refA aufrufen → recently_viewed bekommt eine Zeile", async () => {
  const r = await holenHtml(objektPfad(refA), { cookie });
  assertGleich(r.status, 200, "status");
  const zeilen = await sql`SELECT viewed_at FROM recently_viewed rv JOIN listing l ON l.id = rv.listing_id WHERE rv.user_id = ${personId} AND l.public_ref = ${refA.public_ref}`;
  assertGleich(zeilen.length, 1, "Anzahl Zeilen für refA");
  return `1 Zeile, viewed_at=${zeilen[0].viewed_at.toISOString()}`;
});

await schritt(5, "(b) Zweiter Aufruf derselben Objektseite → weiterhin genau eine Zeile, viewed_at aktualisiert", async () => {
  const vorher = await sql`SELECT viewed_at FROM recently_viewed rv JOIN listing l ON l.id = rv.listing_id WHERE rv.user_id = ${personId} AND l.public_ref = ${refA.public_ref}`;
  await new Promise(r => setTimeout(r, 1100)); // sichtbarer Unterschied im Zeitstempel
  const r = await holenHtml(objektPfad(refA), { cookie });
  assertGleich(r.status, 200, "status");
  const nachher = await sql`SELECT viewed_at FROM recently_viewed rv JOIN listing l ON l.id = rv.listing_id WHERE rv.user_id = ${personId} AND l.public_ref = ${refA.public_ref}`;
  assertGleich(nachher.length, 1, "weiterhin genau eine Zeile für refA (kein Duplikat)");
  assertTrue(nachher[0].viewed_at.getTime() > vorher[0].viewed_at.getTime(), "viewed_at wurde nicht aktualisiert");
  return `weiterhin 1 Zeile, viewed_at aktualisiert (${vorher[0].viewed_at.toISOString()} -> ${nachher[0].viewed_at.toISOString()})`;
});

await schritt(6, "(c) 30 verschiedene Objektseiten nacheinander aufrufen → höchstens 24 Zeilen", async () => {
  for (const z of dreissigRefs) {
    const r = await holenHtml(objektPfad(z), { cookie });
    assertGleich(r.status, 200, `status für ${z.public_ref}`);
  }
  const zeilen = await sql`SELECT count(*)::int AS n FROM recently_viewed WHERE user_id = ${personId}`;
  assertTrue(zeilen[0].n <= 24, `recently_viewed hat ${zeilen[0].n} Zeilen, erwartet <= 24`);
  return `30 Objektseiten aufgerufen, recently_viewed hat ${zeilen[0].n} Zeilen (<= 24)`;
});

await schritt(7, "(c) Die verbliebenen Zeilen sind die zuletzt angesehenen (neueste zuerst)", async () => {
  const zeilen = await sql`
    SELECT l.public_ref FROM recently_viewed rv JOIN listing l ON l.id = rv.listing_id
     WHERE rv.user_id = ${personId} ORDER BY rv.viewed_at DESC`;
  const erwarteteNeueste = dreissigRefs[dreissigRefs.length - 1].public_ref;
  assertGleich(zeilen[0]?.public_ref, erwarteteNeueste, "neueste Zeile");
  return `neueste Zeile ist die zuletzt aufgerufene Referenz (${erwarteteNeueste})`;
});

await schritt(8, "(d) GET /api/vergleich mit zwei echten + einer erfundenen Referenz", async () => {
  const erfunden = "FWL-2026-999999";
  const refs = [...vergleichRefs, erfunden].join(",");
  const r = await get(`/api/vergleich?refs=${encodeURIComponent(refs)}`);
  assertGleich(r.status, 200, "status");
  const ids = (r.json?.treffer ?? []).map(t => t.id);
  assertGleich(ids.length, 2, "Anzahl Treffer");
  assertTrue(vergleichRefs.every(ref => ids.includes(ref)), `beide echten Referenzen fehlen im Ergebnis (${ids.join(",")})`);
  assertTrue(!ids.includes(erfunden), "erfundene Referenz erscheint im Ergebnis");
  return `treffer=${ids.join(",")}, erfundene Referenz fehlt korrekt`;
});

await schritt(9, "(e) IDOR-Falsifikation: ein archiviertes Demo-Inserat fehlt im Vergleichsergebnis", async () => {
  if (!archiviertRef) return "ausgelassen — kein archiviertes Demo-Inserat in der Datenbank vorhanden";
  const refs = [...vergleichRefs, archiviertRef].join(",");
  const r = await get(`/api/vergleich?refs=${encodeURIComponent(refs)}`);
  assertGleich(r.status, 200, "status");
  const ids = (r.json?.treffer ?? []).map(t => t.id);
  assertTrue(!ids.includes(archiviertRef), `archiviertes Inserat ${archiviertRef} erscheint im Vergleichsergebnis`);
  assertGleich(ids.length, 2, "nur die zwei öffentlichen Referenzen erscheinen");
  return `archiviertRef=${archiviertRef} fehlt korrekt im Ergebnis (treffer=${ids.join(",")})`;
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

await sql`DELETE FROM recently_viewed WHERE user_id = ${personId}`.catch(() => {});
await sql.end();
process.exit(fehlerAnzahl > 0 ? 1 : 0);
