#!/usr/bin/env node
/* ============================================================
   FOURWALLS — SEO und Index-Verhalten (P5.9 Phase B, Workstream H)

   Prüft per fetch (kein Browser) das, was Suchmaschinen tatsächlich sehen:
   öffentliche, indexierbare Seiten (Titel/Beschreibung/H1/Canonical/
   hreflang/OpenGraph/html-lang/robots), NOINDEX-Seiten, die 404-Seite,
   /sitemap.xml, /robots.txt, JSON-LD und einen Behauptungs-Wächter gegen
   werbliche/erfundene Aussagen im sichtbaren Text.

   Aufruf:
     set -a; . ./.env.local; set +a
     node scripts/seo-test.mjs [Basis-URL]   Standard: http://localhost:3007

   DATABASE_URL wird NUR für zwei einzelne SELECTs gebraucht: eine
   veröffentlichte Inserats-Referenz (für die Objektseite und ihr JSON-LD)
   und einen aktiven Anbieter-Slug (für die vier Anbieter-Sprachordner).
   Alles andere prüft dieses Skript ausschliesslich über HTTP.

   WP3a (404-SSR-Fix, Überschriften, Sprachumschalter mobil) und WP5
   (/wissen-Seiten) sind zum Zeitpunkt dieses Auftrags noch nicht fertig.
   Prüfungen, die davon abhängen (404-Inhalt, Wissensseiten), laufen
   trotzdem — schlagen sie fehl, werden sie als WARTET (nicht FEHLER)
   gemeldet und zählen nicht zum Exit-Code. Alles andere ist ein echter
   Befund und zählt.

   Ausgabe: nummerierte Tabelle auf stdout, var/seo-bericht.json,
   Exit 1 bei irgendeinem FEHLER, sonst 0 (WARTET bleibt Exit 0).
   ============================================================ */
import postgres from "postgres";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HIER, "..");
const BASIS = (process.argv[2] || "http://localhost:3007").replace(/\/$/, "");
const TIMEOUT_MS = 20_000;

const LOCALES = ["de", "fr", "it", "en"];
const PFAD = {
  de: { immobilien: "immobilien", kaufen: "kaufen",   mieten: "mieten",    anbieter: "anbieter" },
  fr: { immobilien: "immobilier", kaufen: "acheter",  mieten: "louer",     anbieter: "prestataires" },
  it: { immobilien: "immobili",   kaufen: "comprare", mieten: "affittare", anbieter: "operatori" },
  en: { immobilien: "properties", kaufen: "buy",      mieten: "rent",      anbieter: "publishers" }
};

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a) — nötig für eine Objekt-Referenz und einen Anbieter-Slug."); process.exit(2); }
const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

/* ---------- HTTP ---------- */
async function holen(pfad) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASIS + pfad, { redirect: "manual", signal: ctrl.signal });
    const text = await res.text().catch(() => "");
    return { status: res.status, text, location: res.headers.get("location") };
  } catch (e) {
    return { status: 0, text: "", location: null, fehler: String(e && e.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- Ergebnis-Buchführung ---------- */
let NR = 0;
const ergebnisse = [];
function assertTrue(bedingung, meldung) { if (!bedingung) throw new Error(meldung); }

async function schritt(titel, fn) {
  const nr = ++NR;
  try {
    const detail = (await fn()) || "ok";
    ergebnisse.push({ nr, titel, status: "OK", detail });
    console.log(`OK      ${String(nr).padStart(4)}  ${titel}`);
    return detail;
  } catch (e) {
    const detail = e && e.message ? e.message : String(e);
    ergebnisse.push({ nr, titel, status: "FEHLER", detail });
    console.log(`FEHLER  ${String(nr).padStart(4)}  ${titel} — ${detail}`);
    return null;
  }
}

async function schrittWartet(titel, wartetAuf, fn) {
  const nr = ++NR;
  try {
    const detail = (await fn()) || "ok";
    ergebnisse.push({ nr, titel, status: "OK", detail });
    console.log(`OK      ${String(nr).padStart(4)}  ${titel}`);
    return detail;
  } catch (e) {
    const detail = e && e.message ? e.message : String(e);
    ergebnisse.push({ nr, titel, status: "WARTET", detail: `wartet auf ${wartetAuf} — ${detail}` });
    console.log(`WARTET  ${String(nr).padStart(4)}  ${titel} — wartet auf ${wartetAuf}: ${detail}`);
    return null;
  }
}

/* Für Befunde, die kein Fehler sind (P5.10 §31 v): die Prüfung selbst lief
   sauber durch, aber ihr Ergebnis ist eine Beobachtung, kein Regressionsbefund
   (z. B. eine NOINDEX-Seite ohne eigenes Disallow-Präfix — die noindex-Meta
   schützt sie bereits). `fn` gibt entweder `{ detail }` (unauffällig, OK)
   oder `{ hinweis }` (Befund, zählt nicht zum Exit-Code) zurück. Eine Ausnahme
   bleibt ein echter FEHLER (z. B. robots.txt nicht erreichbar). */
async function schrittHinweis(titel, fn) {
  const nr = ++NR;
  try {
    const ergebnis = await fn();
    if (ergebnis && ergebnis.hinweis) {
      ergebnisse.push({ nr, titel, status: "HINWEIS", detail: ergebnis.hinweis });
      console.log(`HINWEIS ${String(nr).padStart(4)}  ${titel} — ${ergebnis.hinweis}`);
    } else {
      ergebnisse.push({ nr, titel, status: "OK", detail: ergebnis?.detail ?? "ok" });
      console.log(`OK      ${String(nr).padStart(4)}  ${titel}`);
    }
  } catch (e) {
    const detail = e && e.message ? e.message : String(e);
    ergebnisse.push({ nr, titel, status: "FEHLER", detail });
    console.log(`FEHLER  ${String(nr).padStart(4)}  ${titel} — ${detail}`);
  }
}

/* Für Prüfungen, die in dieser Umgebung (dev, :3007) grundsätzlich nicht
   entscheidbar sind (P5.10 §31 vi: DEMO_INHALTE=aus lässt sich hier nicht
   herstellen/prüfen) — `fn` liefert stattdessen einen Beleg (z. B. per grep
   im Quelltext), dass die betroffene Stelle die richtige Weiche überhaupt
   benutzt. Schlägt selbst dieser Beleg fehl, ist das ein echter FEHLER. */
async function schrittUebersprungen(titel, fn) {
  const nr = ++NR;
  try {
    const detail = (await fn()) || "ok";
    ergebnisse.push({ nr, titel, status: "ÜBERSPRUNGEN", detail: `übersprungen (dev) — ${detail}` });
    console.log(`ÜBERSPR ${String(nr).padStart(4)}  ${titel} — übersprungen (dev): ${detail}`);
  } catch (e) {
    const detail = e && e.message ? e.message : String(e);
    ergebnisse.push({ nr, titel, status: "FEHLER", detail });
    console.log(`FEHLER  ${String(nr).padStart(4)}  ${titel} — ${detail}`);
  }
}

/* ---------- HTML-Auszüge (reines Regex, kein DOM — Muster wie
   scripts/routen-test.mjs) ---------- */
function zaehle(muster, text) { return (text.match(new RegExp(muster, "gi")) || []).length; }
function treffer(muster, text) { return new RegExp(muster, "i").exec(text); }

const VERBOTENE_BEHAUPTUNGEN = [
  "Eigentümer-Report", "Marktmiete", "Geprüftes Inserat", "Käuferliste",
  "immer kostenlos", "garantiert", "innerhalb von 24", "revolutionär", "führend", "beste "
];

function ohneScript(html) { return html.replace(/<script[\s\S]*?<\/script>/gi, ""); }

/* Sichtbares HTML einer Seite gegen alle Kriterien aus a) prüfen und die
   rohe HTML zur Wiederverwendung (g) zurückgeben. */
function pruefeOeffentlicheSeite(html, locale) {
  assertTrue(zaehle('<title>[^<]*</title>', html) === 1, `nicht genau ein <title> (${zaehle('<title>[^<]*</title>', html)})`);
  const titelText = treffer('<title>([^<]*)</title>', html)?.[1] ?? "";
  const titelTreffer = titelText.match(/— Fourwalls/g) || [];
  assertTrue(titelTreffer.length === 1 && titelText.trim().endsWith("— Fourwalls"), `<title> endet nicht genau einmal auf «— Fourwalls»: "${titelText}"`);

  assertTrue(zaehle('<meta name="description" content="[^"]*"', html) === 1, `nicht genau eine meta description (${zaehle('<meta name="description" content="[^"]*"', html)})`);
  const beschreibung = treffer('<meta name="description" content="([^"]*)"', html)?.[1] ?? "";
  assertTrue(beschreibung.trim().length > 0, "meta description ist leer");
  assertTrue(!beschreibung.includes("nav.") && !beschreibung.includes("_"), `meta description sieht nach Schlüssel aus: "${beschreibung}"`);

  assertTrue(zaehle("<h1[\\s>]", html) === 1, `nicht genau ein <h1> (${zaehle("<h1[\\s>]", html)})`);

  assertTrue(zaehle('<link rel="canonical" href="[^"]*"', html) === 1, "nicht genau ein canonical");
  const canon = treffer('<link rel="canonical" href="([^"]*)"', html)?.[1] ?? "";
  assertTrue(/^https?:\/\//.test(canon), `canonical nicht absolut: "${canon}"`);

  for (const l of [...LOCALES, "x-default"]) {
    assertTrue(new RegExp(`<link rel="alternate" hreflang="${l}"`, "i").test(html), `hreflang ${l} fehlt`);
  }

  assertTrue(/<meta property="og:title" content="[^"]+"/.test(html), "og:title fehlt/leer");
  assertTrue(/<meta property="og:description" content="[^"]+"/.test(html), "og:description fehlt/leer");
  assertTrue(/<meta property="og:url" content="[^"]+"/.test(html), "og:url fehlt/leer");

  const langM = treffer('<html[^>]* lang="([a-zA-Z-]+)"', html);
  assertTrue(!!langM && langM[1] === locale, `html lang ist "${langM?.[1] ?? "(fehlt)"}" statt "${locale}"`);

  const robotsM = treffer('<meta name="robots" content="([^"]*)"', html);
  assertTrue(!robotsM || !robotsM[1].includes("noindex"), `robots enthält noindex: "${robotsM?.[1]}"`);
}

function pruefeKeineBehauptung(html) {
  const sichtbar = ohneScript(html);
  for (const phrase of VERBOTENE_BEHAUPTUNGEN) {
    assertTrue(!sichtbar.includes(phrase), `verbotene Behauptung im sichtbaren HTML gefunden: "${phrase}"`);
  }
}

/* ---------- Vorbereitung: eine veröffentlichte Inserats-Ref, ein
   Anbieter-Slug — die einzigen zwei Datenbankzugriffe dieses Skripts. ---------- */
let OBJEKT = null;
let ANBIETER_SLUG = null;
try {
  const [zeile] = await sql`SELECT public_ref, slug, transaction FROM listing_public ORDER BY published_at DESC NULLS LAST LIMIT 1`;
  if (zeile) OBJEKT = { publicRef: String(zeile.public_ref), slug: String(zeile.slug), transaction: String(zeile.transaction) };
  const [org] = await sql`SELECT slug FROM organization WHERE is_active AND archived_at IS NULL ORDER BY created_at LIMIT 1`;
  if (org) ANBIETER_SLUG = String(org.slug);
} finally {
  await sql.end();
}

function objektPfad(l, d) {
  const p = PFAD[l];
  const art = d.transaction === "rent" ? p.mieten : p.kaufen;
  return `/${l}/${p.immobilien}/${art}/${d.slug}-${d.publicRef.toLowerCase()}`;
}
function anbieterPfad(l, slug) { return `/${l}/${PFAD[l].anbieter}/${slug}`; }

/* ---------- a) Öffentliche, indexierbare Seiten ---------- */
/* Jeder Eintrag mit warten:"WP5" ist heute erwartungsgemäss noch nicht
   erreichbar (Route existiert nicht) — WARTET statt FEHLER, und bleibt
   ausserhalb der Behauptungs-Wächter-/JSON-LD-Pflichtmenge. */
const OEFFENTLICHE_SEITEN = [];
for (const l of LOCALES) OEFFENTLICHE_SEITEN.push({ label: `Start (${l})`, pfad: `/${l}`, locale: l });
for (const l of LOCALES) {
  OEFFENTLICHE_SEITEN.push({ label: `kaufen (${l})`, pfad: `/${l}/${PFAD[l].immobilien}/${PFAD[l].kaufen}`, locale: l });
  OEFFENTLICHE_SEITEN.push({ label: `mieten (${l})`, pfad: `/${l}/${PFAD[l].immobilien}/${PFAD[l].mieten}`, locale: l });
}
if (OBJEKT) OEFFENTLICHE_SEITEN.push({ label: "Objektseite (de)", pfad: objektPfad("de", OBJEKT), locale: "de" });
if (ANBIETER_SLUG) {
  for (const l of LOCALES) OEFFENTLICHE_SEITEN.push({ label: `Anbieterseite (${l})`, pfad: anbieterPfad(l, ANBIETER_SLUG), locale: l });
}
for (const dienst of ["verkaufen", "vermieten", "bewertung", "verwalten", "beratung"]) {
  OEFFENTLICHE_SEITEN.push({ label: `Service ${dienst} (de)`, pfad: `/de/${dienst}`, locale: "de" });
}
OEFFENTLICHE_SEITEN.push({ label: "ueber-fourwalls (de)", pfad: "/de/ueber-fourwalls", locale: "de" });

const WISSEN_SEITEN = [
  { label: "wissen (de)", pfad: "/de/wissen", locale: "de" },
  { label: "Wissensbeitrag (de)", pfad: "/de/wissen/immobilienverkauf-ablauf", locale: "de" }
];

if (!OBJEKT) await schritt("Voraussetzung: veröffentlichte Inserats-Referenz vorhanden", async () => { throw new Error("keine Zeile in listing_public gefunden — Seed/Import fehlt"); });
if (!ANBIETER_SLUG) await schritt("Voraussetzung: aktiver Anbieter-Slug vorhanden", async () => { throw new Error("keine aktive organization gefunden — scripts/seed-profis.mjs fehlt"); });

/* HTML je geprüfter Seite für spätere Wiederverwendung (g, h, f) merken. */
const HTML_CACHE = new Map();

for (const seite of OEFFENTLICHE_SEITEN) {
  await schritt(`a) ${seite.label} — indexierbar`, async () => {
    const r = await holen(seite.pfad);
    assertTrue(r.status === 200, `status ${r.status} statt 200`);
    HTML_CACHE.set(seite.pfad, r.text);
    pruefeOeffentlicheSeite(r.text, seite.locale);
    return `${seite.pfad} → 200, Meta/H1/Canonical/hreflang/OG/lang/robots ok`;
  });
}

for (const seite of WISSEN_SEITEN) {
  await schritt(`a) ${seite.label} — indexierbar`, async () => {
    const r = await holen(seite.pfad);
    assertTrue(r.status === 200, `status ${r.status} statt 200`);
    HTML_CACHE.set(seite.pfad, r.text);
    pruefeOeffentlicheSeite(r.text, seite.locale);
    return `${seite.pfad} → 200, Meta/H1/Canonical/hreflang/OG/lang/robots ok`;
  });
}

/* ---------- b) NOINDEX-Seiten ---------- */
const NOINDEX_SEITEN = [
  "/de/verkaufen/anfrage", "/de/vermieten/anfrage", "/de/verwalten/anfrage",
  "/de/konto/anmelden", "/de/konto/registrieren", "/de/vergleich", "/de/inserieren",
  "/de/impressum", "/de/datenschutz", "/de/agb"
];
for (const pfad of NOINDEX_SEITEN) {
  await schritt(`b) NOINDEX ${pfad}`, async () => {
    const r = await holen(pfad);
    assertTrue(r.status === 200, `status ${r.status} statt 200`);
    const robotsM = treffer('<meta name="robots" content="([^"]*)"', r.text);
    assertTrue(!!robotsM && robotsM[1].includes("noindex"), `robots enthält kein noindex: "${robotsM?.[1] ?? "(fehlt)"}"`);
    return `robots="${robotsM[1]}"`;
  });
}

/* Konto/Intern/Moderation/Vorschau anonym: 307 (Umleitung zum Anmelden) ODER
   404 ohne <main>-Inhalt (z. B. Vorschau mit unbekannter/keiner Referenz). */
const ANONYM_GESCHUETZT = [
  "/de/konto", "/de/intern/anliegen", "/de/moderation", "/de/vorschau/FWL-2026-000000"
];
for (const pfad of ANONYM_GESCHUETZT) {
  await schritt(`b) anonym geschützt ${pfad}`, async () => {
    const r = await holen(pfad);
    assertTrue(r.status === 307 || r.status === 404, `status ${r.status} statt 307/404`);
    if (r.status === 404) {
      assertTrue(!/<main[\s>]/i.test(r.text), "404 enthält trotzdem <main>-Inhalt");
      return "404 ohne <main>";
    }
    return `307 → ${r.location}`;
  });
}

/* ---------- c) 404 ---------- */
await schritt("c) 404 /de/gibt-es-nicht", async () => {
  const r = await holen("/de/gibt-es-nicht");
  assertTrue(r.status === 404, `status ${r.status} statt 404`);
  assertTrue(/<h1[^>]*>[^<]*Diese Seite gibt es nicht\.[^<]*<\/h1>/.test(r.text), "h1 „Diese Seite gibt es nicht.“ fehlt im initialen HTML");
  assertTrue(!r.text.includes("/Users/"), "HTML enthält „/Users/“ (Pfadleck)");
  /* Ein echtes Pfadleck ist ein Dateisystempfad («/node_modules/»); Chunk-Namen des Dev-Servers («node_modules_next_dist_…») sind keins. */
  assertTrue(!/["'\s(]\/(Users|home|opt|srv|root)\/[A-Za-z]/.test(r.text), "HTML enthält einen absoluten Dateisystempfad (Pfadleck)");
  return "404, h1 deutsch, kein Pfadleck";
});
await schritt("c) 404 /fr/nexiste-pas — globale Seite mit Sprachzeilen", async () => {
  const r = await holen("/fr/nexiste-pas");
  assertTrue(r.status === 404, `status ${r.status} statt 404`);
  assertTrue(/<h1[^>]*>[^<]*Diese Seite gibt es nicht\.[^<]*<\/h1>/.test(r.text), "h1 fehlt im initialen HTML");
  assertTrue(/n['’]existe pas/i.test(r.text), "französische Zeile („n'existe pas“) fehlt im HTML");
  return "404, h1 + französische Zeile";
});

/* ---------- d) /sitemap.xml ---------- */
let SITEMAP_TEXT = "";
await schritt("d) /sitemap.xml — Status, XML, Umfang", async () => {
  const r = await holen("/sitemap.xml");
  assertTrue(r.status === 200, `status ${r.status} statt 200`);
  SITEMAP_TEXT = r.text;
  assertTrue(r.text.trim().startsWith("<?xml"), "kein XML-Prolog");
  const auf = zaehle("<url>", r.text), zu = zaehle("<\\/url>", r.text);
  assertTrue(auf > 0 && auf === zu, `<url>/</url> unausgeglichen: ${auf} auf, ${zu} zu`);
  const locs = [...r.text.matchAll(/<loc>([^<]*)<\/loc>/g)].map(m => m[1]);
  assertTrue(locs.length > 0, "keine <loc> gefunden");
  for (const loc of locs) assertTrue(loc.startsWith(BASIS), `loc beginnt nicht mit der Basis-URL: "${loc}"`);
  assertTrue(locs.some(l => l === `${BASIS}/de`), "Startseite fehlt in der Sitemap");
  assertTrue(locs.some(l => l === `${BASIS}/de/${PFAD.de.immobilien}/${PFAD.de.kaufen}`), "kaufen-Basis fehlt in der Sitemap");
  if (OBJEKT) assertTrue(locs.some(l => l === `${BASIS}${objektPfad("de", OBJEKT)}`), "Objektseite fehlt in der Sitemap");
  if (ANBIETER_SLUG) assertTrue(locs.some(l => l === `${BASIS}${anbieterPfad("de", ANBIETER_SLUG)}`), "Anbieterseite fehlt in der Sitemap");
  assertTrue(locs.some(l => l === `${BASIS}/de/verkaufen`), "Service-Seite (verkaufen) fehlt in der Sitemap");
  /* Pfadverankert: nur ganze Segmente direkt nach der Sprache zählen — ein Anbieter-Slug,
     der zufällig «konto» enthält, ist kein Treffer. */
  const verboten = [/\/[a-z]{2}\/(konto|intern|moderation|vorschau|inserieren|vergleich|einladung)(\/|$)/, /\/anfrage$/];
  for (const muster of verboten) {
    const gefunden = locs.filter(l => muster.test(new URL(l).pathname));
    assertTrue(gefunden.length === 0, `verbotenes Muster ${muster} in der Sitemap: ${gefunden[0]}`);
  }
  assertTrue(zaehle("xhtml:link", r.text) > 0, "keine xhtml:link-Alternates gefunden");
  /* Rechtsseiten: nur solange sie noindex tragen, dürfen sie nicht in der Sitemap stehen —
     nach Freigabe (stand FREIGEGEBEN) gehören sie hinein. Konsistenz statt fester Liste. */
  for (const seite of ["impressum", "datenschutz", "agb", "inseratsbedingungen", "anbieterbedingungen"]) {
    const rs = await holen(`/de/${seite}`);
    const robotsM = treffer('<meta name="robots" content="([^"]*)"', rs.text);
    const noindex = !!robotsM && robotsM[1].includes("noindex");
    const inSitemap = locs.some(l => new URL(l).pathname === `/de/${seite}`);
    assertTrue(!(noindex && inSitemap), `Rechtsseite ${seite} ist noindex, steht aber in der Sitemap`);
  }
  return `${locs.length} <loc>, XML ausgeglichen, keine verbotenen Pfade`;
});

/* ---------- e) /robots.txt ---------- */
let ROBOTS_TEXT = "";
await schritt("e) /robots.txt — Sitemap, Disallow", async () => {
  const r = await holen("/robots.txt");
  assertTrue(r.status === 200, `status ${r.status} statt 200`);
  ROBOTS_TEXT = r.text;
  assertTrue(/Sitemap:/i.test(r.text), "„Sitemap:“ fehlt");
  assertTrue(/Disallow:\s*\/api\//.test(r.text), "Disallow für /api/ fehlt");
  for (const muster of ["konto", "intern", "moderation"]) {
    assertTrue(new RegExp(`Disallow:.*${muster}`, "i").test(r.text), `Disallow-Muster für ${muster} fehlt`);
  }
  return "Sitemap + Disallow-Muster vorhanden";
});

/* ---------- f) JSON-LD ---------- */
await schritt("f) JSON-LD Objektseite — RealEstateListing, datePosted", async () => {
  if (!OBJEKT) throw new Error("keine Objekt-Referenz vorhanden");
  const html = HTML_CACHE.get(objektPfad("de", OBJEKT)) ?? (await holen(objektPfad("de", OBJEKT))).text;
  assertTrue(/"@type":"RealEstateListing"/.test(html), "kein RealEstateListing im JSON-LD");
  const m = /"datePosted":"([^"]*)"/.exec(html);
  assertTrue(!!m, "datePosted fehlt im JSON-LD");
  assertTrue(/^\d{4}-\d{2}-\d{2}$/.test(m[1]), `datePosted nicht im Format JJJJ-MM-TT: "${m[1]}"`);
  return `datePosted=${m[1]}`;
});
await schritt("f) JSON-LD Start — WebSite", async () => {
  const html = HTML_CACHE.get("/de") ?? (await holen("/de")).text;
  assertTrue(/"@type":"WebSite"/.test(html), "kein WebSite im JSON-LD der Startseite");
  return "WebSite gefunden";
});
await schritt("f) JSON-LD Anbieterseite — Organization", async () => {
  if (!ANBIETER_SLUG) throw new Error("kein Anbieter-Slug vorhanden");
  const pfad = anbieterPfad("de", ANBIETER_SLUG);
  const html = HTML_CACHE.get(pfad) ?? (await holen(pfad)).text;
  assertTrue(/"@type":"Organization"/.test(html), "kein Organization im JSON-LD der Anbieterseite");
  return "Organization gefunden";
});
await schritt("f) JSON-LD Wissensbeitrag — Article", async () => {
  const pfad = "/de/wissen/immobilienverkauf-ablauf";
  const html = HTML_CACHE.get(pfad) ?? (await holen(pfad)).text;
  assertTrue(/"@type":"Article"/.test(html), "kein Article im JSON-LD des Wissensbeitrags");
  return "Article gefunden";
});

/* ---------- g) Behauptungs-Wächter ---------- */
for (const seite of OEFFENTLICHE_SEITEN) {
  await schritt(`g) Behauptungs-Wächter ${seite.pfad}`, async () => {
    const html = HTML_CACHE.get(seite.pfad);
    assertTrue(html !== undefined, "keine gespeicherte HTML für diese Seite (a) ist fehlgeschlagen");
    pruefeKeineBehauptung(html);
    return "keine verbotene Behauptung gefunden";
  });
}

/* ---------- h) externe Hosts auf der Startseite ---------- */
await schritt("h) Startseite ohne fonts.googleapis.com/fonts.gstatic.com/cdnjs.cloudflare.com", async () => {
  const html = HTML_CACHE.get("/de") ?? (await holen("/de")).text;
  for (const host of ["fonts.googleapis.com", "fonts.gstatic.com", "cdnjs.cloudflare.com"]) {
    assertTrue(!html.includes(host), `externer Host im HTML gefunden: ${host}`);
  }
  return "keine der drei externen Hosts gefunden";
});

/* ---------- i) kein Platzhalter-Host in Meta-URLs/Sitemap (P5.10 §31 i) ---------- */
const VERBOTENE_HOSTS = ["example", "localhost:3000", "127.0.0.1"];
function pruefeKeinePlatzhalterUrl(url, kontext) {
  assertTrue(url.startsWith(BASIS), `${kontext}: beginnt nicht mit der Basis-URL: "${url}"`);
  for (const verboten of VERBOTENE_HOSTS) {
    assertTrue(!url.includes(verboten), `${kontext}: enthält Platzhalter-Host "${verboten}": "${url}"`);
  }
}
const ALLE_INDEXIERBAR = [...OEFFENTLICHE_SEITEN, ...WISSEN_SEITEN];
for (const seite of ALLE_INDEXIERBAR) {
  await schritt(`i) kein Platzhalter-Host ${seite.pfad}`, async () => {
    const html = HTML_CACHE.get(seite.pfad);
    assertTrue(html !== undefined, "keine gespeicherte HTML für diese Seite (a) ist fehlgeschlagen");
    const canon = treffer('<link rel="canonical" href="([^"]*)"', html)?.[1];
    if (canon) pruefeKeinePlatzhalterUrl(canon, "canonical");
    const ogUrl = treffer('<meta property="og:url" content="([^"]*)"', html)?.[1];
    if (ogUrl) pruefeKeinePlatzhalterUrl(ogUrl, "og:url");
    const hreflangHrefs = [...html.matchAll(/<link rel="alternate" hreflang="[^"]+" href="([^"]*)"/gi)].map(m => m[1]);
    for (const href of hreflangHrefs) pruefeKeinePlatzhalterUrl(href, "hreflang");
    return `canonical/og:url/${hreflangHrefs.length} hreflang ohne Platzhalter-Host`;
  });
}
await schritt("i) kein Platzhalter-Host in der Sitemap", async () => {
  assertTrue(!!SITEMAP_TEXT, "Sitemap-Text nicht vorhanden (Schritt d ist fehlgeschlagen)");
  const locs = [...SITEMAP_TEXT.matchAll(/<loc>([^<]*)<\/loc>/g)].map(m => m[1]);
  for (const loc of locs) pruefeKeinePlatzhalterUrl(loc, "sitemap loc");
  return `${locs.length} <loc> ohne Platzhalter-Host`;
});

/* ---------- ii) keine rohen Übersetzungsschlüssel im sichtbaren Text (P5.10 §31 ii) ---------- */
const SCHLUESSEL_MUSTER = /\b(nav|al|sv|ws|vt|in|og|k|o|w|m|p)_[A-Za-z]{3,}\b|\bnav\.[a-zA-Z]+\b/g;
function sichtbarerText(html) {
  const bodyM = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  let bodyHtml = bodyM ? bodyM[1] : html;
  bodyHtml = bodyHtml.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  return bodyHtml.replace(/<[^>]+>/g, " ");
}
for (const seite of ALLE_INDEXIERBAR) {
  await schritt(`ii) keine rohen Übersetzungsschlüssel ${seite.pfad}`, async () => {
    const html = HTML_CACHE.get(seite.pfad);
    assertTrue(html !== undefined, "keine gespeicherte HTML für diese Seite (a) ist fehlgeschlagen");
    const text = sichtbarerText(html);
    const gefundeneSchluessel = [...new Set([...text.matchAll(SCHLUESSEL_MUSTER)].map(m => m[0]))];
    assertTrue(gefundeneSchluessel.length === 0, `roh wirkende Übersetzungsschlüssel im sichtbaren Text: ${gefundeneSchluessel.join(", ")}`);
    return "kein Übersetzungsschlüssel im sichtbaren Text gefunden";
  });
}

/* ---------- iii) keine Demo-Identität in Vertrauens-Metadaten (P5.10 §31 iii) ---------- */
await schritt("iii) Startseite ohne Organization-JSON-LD (Demo-Identität)", async () => {
  const html = HTML_CACHE.get("/de") ?? (await holen("/de")).text;
  assertTrue(!html.includes('"@type":"Organization"'), "Startseite enthält Organization im JSON-LD (Demo-Identität als Vertrauens-Metadatum) — config/company.ts hat kein bestätigtes Feld dafür");
  return "kein Organization-JSON-LD auf der Startseite (WebSite ist erlaubt)";
});

/* ---------- iv) hreflang-Ziele antworten 200, ≤ 1 Redirect (P5.10 §31 iv) ---------- */
async function holenAbsolut(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: "manual", signal: ctrl.signal });
    return { status: res.status, location: res.headers.get("location") };
  } catch (e) {
    return { status: 0, location: null, fehler: String(e && e.message || e) };
  } finally {
    clearTimeout(timer);
  }
}
async function pruefeHreflangZiele200(pfad, label) {
  return schritt(`iv) hreflang-Ziele 200 — ${label}`, async () => {
    const html = HTML_CACHE.get(pfad);
    assertTrue(html !== undefined, `keine gespeicherte HTML für ${pfad}`);
    const hreflangs = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]*)"/gi)].map(m => ({ lang: m[1], href: m[2] }));
    assertTrue(hreflangs.length > 0, "keine hreflang-Ziele gefunden");
    const ok = [];
    for (const { lang, href } of hreflangs) {
      let r = await holenAbsolut(href);
      if (r.status >= 300 && r.status < 400 && r.location) {
        const ziel = new URL(r.location, href).toString();
        r = await holenAbsolut(ziel);
      }
      assertTrue(r.status === 200, `hreflang ${lang} (${href}) → Status ${r.status} statt 200`);
      ok.push(`${lang}:200`);
    }
    return ok.join(", ");
  });
}
await pruefeHreflangZiele200("/de", "Startseite");
if (OBJEKT) await pruefeHreflangZiele200(objektPfad("de", OBJEKT), "Objektseite");
if (ANBIETER_SLUG) await pruefeHreflangZiele200(anbieterPfad("de", ANBIETER_SLUG), "Anbieterseite");
await pruefeHreflangZiele200("/de/verkaufen", "/de/verkaufen");

/* ---------- v) robots.txt Disallow deckt jede NOINDEX-Seite ab (P5.10 §31 v) ----------
   Kein Fehler, wenn eine NOINDEX-Seite ohne eigenes Disallow-Präfix bleibt —
   die noindex-Meta schützt sie bereits (siehe robots.ts-Kommentar: die Liste
   ist „Verteidigung in der Tiefe“, nicht die eigentliche Grenze). Das wird
   als HINWEIS gemeldet, nicht als FEHLER. */
function disallowMusterZuRegex(muster) {
  const esc = muster.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${esc}`);
}
const DISALLOW_MUSTER = [...ROBOTS_TEXT.matchAll(/^Disallow:\s*(\S+)/gim)].map(m => m[1]);
for (const pfad of NOINDEX_SEITEN) {
  await schrittHinweis(`v) Disallow deckt ${pfad}`, async () => {
    const gedeckt = DISALLOW_MUSTER.some(m => disallowMusterZuRegex(m).test(pfad));
    if (gedeckt) return { detail: "von einem Disallow-Präfix gedeckt" };
    const r = await holen(pfad);
    const istLoginRedirect = (r.status === 307 || r.status === 302 || r.status === 301) && !!r.location && /anmelden|login/i.test(r.location);
    if (istLoginRedirect) return { detail: `Login-Redirect (${r.location}), Disallow nicht nötig` };
    return { hinweis: `kein Disallow-Präfix deckt "${pfad}" ab, und die Seite ist kein Login-Redirect (Status ${r.status}) — nur die noindex-Meta schützt sie` };
  });
}

/* ---------- vi) Sitemap ohne demo- Slugs bei DEMO_INHALTE=aus (P5.10 §31 vi) ----------
   In dev (DEMO_INHALTE ausserhalb production standardmässig „an“, siehe
   server/env.ts:demoSichtbar()) nicht herstellbar/prüfbar — Beleg per grep,
   dass app/sitemap.ts die richtige Weiche überhaupt benutzt. */
await schrittUebersprungen("vi) Sitemap ohne demo- Slugs bei DEMO_INHALTE=aus", async () => {
  const quelltext = readFileSync(join(APP_ROOT, "app", "sitemap.ts"), "utf8");
  assertTrue(/demoSichtbar\s*\(/.test(quelltext), "app/sitemap.ts ruft demoSichtbar() nicht mehr auf — Beleg fehlt");
  const zeile = quelltext.split("\n").find(z => /demoSichtbar\s*\(/.test(z))?.trim();
  return `app/sitemap.ts verwendet demoSichtbar() (Beleg: "${zeile}") — Prüfung gegen echte demo- Slugs ist in dev nicht durchführbar`;
});

/* ---------- Zusammenfassung ---------- */
function tabelle() {
  const w1 = 4;
  const w2 = Math.max(20, ...ergebnisse.map(e => e.titel.length));
  const w3 = Math.max(7, ...ergebnisse.map(e => e.status.length));
  const zeile = (a, b, c, d) => `${String(a).padStart(w1)}  ${String(b).padEnd(w2)}  ${String(c).padEnd(w3)}  ${d}`;
  console.log("\n" + zeile("Nr", "Schritt", "Status", "Detail"));
  console.log("-".repeat(w1 + w2 + w3 + 10));
  for (const e of ergebnisse) console.log(zeile(e.nr, e.titel, e.status, e.detail));
}
tabelle();

const fehlerAnzahl = ergebnisse.filter(e => e.status === "FEHLER").length;
const wartetAnzahl = ergebnisse.filter(e => e.status === "WARTET").length;
const hinweisAnzahl = ergebnisse.filter(e => e.status === "HINWEIS").length;
const uebersprungenAnzahl = ergebnisse.filter(e => e.status === "ÜBERSPRUNGEN").length;
const okAnzahl = ergebnisse.filter(e => e.status === "OK").length;
console.log(`\n${ergebnisse.length} Schritte, ${fehlerAnzahl} FEHLER, ${wartetAnzahl} WARTET (WP3a/WP5), ${hinweisAnzahl} HINWEIS, ${uebersprungenAnzahl} ÜBERSPRUNGEN (dev), ${okAnzahl} OK`);

if (fehlerAnzahl > 0) {
  console.log("\nFEHLER im Detail:");
  for (const e of ergebnisse.filter(e => e.status === "FEHLER")) console.log(`  Schritt ${e.nr} (${e.titel}): ${e.detail}`);
}
if (wartetAnzahl > 0) {
  console.log("\nWARTET im Detail (kein Regressionsbefund dieses Auftrags):");
  for (const e of ergebnisse.filter(e => e.status === "WARTET")) console.log(`  Schritt ${e.nr} (${e.titel}): ${e.detail}`);
}
if (hinweisAnzahl > 0) {
  console.log("\nHINWEIS im Detail (kein Fehler, kein Regressionsbefund):");
  for (const e of ergebnisse.filter(e => e.status === "HINWEIS")) console.log(`  Schritt ${e.nr} (${e.titel}): ${e.detail}`);
}
if (uebersprungenAnzahl > 0) {
  console.log("\nÜBERSPRUNGEN im Detail (in dieser Umgebung nicht entscheidbar):");
  for (const e of ergebnisse.filter(e => e.status === "ÜBERSPRUNGEN")) console.log(`  Schritt ${e.nr} (${e.titel}): ${e.detail}`);
}

const varOrdner = join(APP_ROOT, "var");
mkdirSync(varOrdner, { recursive: true });
writeFileSync(join(varOrdner, "seo-bericht.json"), JSON.stringify({ basis: BASIS, zeit: new Date().toISOString(), objekt: OBJEKT, anbieterSlug: ANBIETER_SLUG, ergebnisse }, null, 2));

process.exit(fehlerAnzahl > 0 ? 1 : 0);
