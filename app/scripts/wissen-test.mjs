#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Wissensseiten-Falsifikation (P5.10 §31, Teil 2)

   Prüft per fetch (kein Browser, wie scripts/seo-test.mjs) die sieben
   Wissensbeiträge (content/wissen/de/*.md, Slugs identisch in allen vier
   Sprachen, siehe lib/wissen.ts) in allen vier Sprachen:

     - Status 200
     - genau ein <h1>, dessen Text dem Frontmatter-Titel entspricht
     - Überschriftenfolge: h1, danach h2, ein h3 kommt nie vor dem ersten h2
     - jeder interne Link (href beginnend mit "/") im Artikelkörper
       antwortet 200 (folgt höchstens einem Redirect)
     - der Quellen-Abschnitt ist gerendert, wenn das Frontmatter `quellen`
       nicht leer ist
     - Article-JSON-LD mit headline = Titel, datePublished im Format
       JJJJ-MM-TT, inLanguage = Sprache
     - hreflang: vier Sprachen + x-default
     - Bannwort-Wächter: die im Auftrag genannten Behauptungen dürfen im
       sichtbaren Text nicht vorkommen («geprüft» allein ist erlaubt)

   Aufruf:
     node scripts/wissen-test.mjs [Basis-URL]   Standard: http://localhost:3007

   Kein Datenbankzugriff nötig — die Slugs kommen direkt aus
   content/wissen/de/*.md, der Frontmatter-Titel wird aus derselben Datei
   gelesen (dasselbe einfache Frontmatter-Format wie lib/wissen.ts, hier
   eigens nachgebildet, damit dieses Skript ohne den Next-Prozess und ohne
   TypeScript-Importe auskommt).

   Ausgabe: nummerierte Tabelle auf stdout, var/wissen-bericht.json,
   Exit 1 bei irgendeinem FEHLER, sonst 0.
   ============================================================ */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HIER, "..");
const BASIS = (process.argv[2] || "http://localhost:3007").replace(/\/$/, "");
const TIMEOUT_MS = 20_000;

const LOCALES = ["de", "fr", "it", "en"];
const WISSEN_ORDNER = join(APP_ROOT, "content", "wissen");

/* Bannwörter aus dem Auftrag — «geprüft» allein ist erlaubt, nur die
   zusammengesetzten/konkreten Behauptungen sind es nicht. */
const BANNWOERTER = [
  "Geprüftes Inserat", "geprüfte Identität", "verifiziert", "Marktmiete",
  "Käuferliste", "immer kostenlos", "garantiert", "innerhalb von 24",
  "Eigentümer-Report"
];

/* ws_quellen aus app/i18n/messages/<locale>/wissen.json — hier als flache
   Konstante, damit dieses Skript ohne TypeScript-Import auskommt (siehe
   Kommentar oben zu SLUGS/Frontmatter). */
const QUELLEN_LABEL = { de: "Quellen", fr: "Sources", it: "Fonti", en: "Sources" };

/* ---------- HTTP ---------- */
async function holen(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: "manual", signal: ctrl.signal });
    const text = await res.text().catch(() => "");
    return { status: res.status, text, location: res.headers.get("location") };
  } catch (e) {
    return { status: 0, text: "", location: null, fehler: String(e && e.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

/* Wie in scripts/seo-test.mjs (iv): folgt höchstens einem Redirect, meldet
   den finalen Status. */
async function holenMitEinemRedirect(url) {
  let r = await holen(url);
  if (r.status >= 300 && r.status < 400 && r.location) {
    const ziel = new URL(r.location, url).toString();
    r = await holen(ziel);
  }
  return r;
}

/* ---------- Ergebnis-Buchführung (dasselbe Muster wie seo-test.mjs) ---------- */
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

/* ---------- Frontmatter (nachgebildet aus lib/wissen.ts, nur zum Lesen) ---------- */
function parseSkalar(roh) {
  const t = roh.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
  return t;
}
function parseWissenFrontmatter(quelltext) {
  const zeilen = quelltext.replace(/\r\n/g, "\n").split("\n");
  const frontmatter = {};
  if (zeilen[0]?.trim() !== "---") return { frontmatter, body: quelltext.trim() };
  let i = 1;
  for (; i < zeilen.length; i++) {
    const zeile = zeilen[i];
    if (zeile.trim() === "---") { i++; break; }
    const treffer = zeile.match(/^([a-zA-Z][a-zA-Z0-9]*):\s?(.*)$/);
    if (!treffer) continue;
    const schluessel = treffer[1];
    const rest = treffer[2].trim();
    if (rest === "[]") { frontmatter[schluessel] = []; continue; }
    if (rest !== "") { frontmatter[schluessel] = parseSkalar(rest); continue; }
    const liste = [];
    while (i + 1 < zeilen.length && /^\s+-\s?/.test(zeilen[i + 1])) {
      i++;
      liste.push(parseSkalar(zeilen[i].replace(/^\s+-\s?/, "")));
    }
    frontmatter[schluessel] = liste;
  }
  const body = zeilen.slice(i).join("\n").trim();
  return { frontmatter, body };
}
function ladeFrontmatter(locale, slug) {
  const datei = join(WISSEN_ORDNER, locale, `${slug}.md`);
  const roh = readFileSync(datei, "utf8");
  return parseWissenFrontmatter(roh).frontmatter;
}

/* Slugs aus content/wissen/de/*.md — die Sprache ist beliebig, weil die
   Slugs laut lib/wissen.ts in allen vier Sprachen identisch sind. */
const SLUGS = readdirSync(join(WISSEN_ORDNER, "de"))
  .filter(d => d.endsWith(".md"))
  .map(d => d.slice(0, -3))
  .sort();
if (SLUGS.length === 0) {
  console.error(`Keine Wissensbeiträge unter ${join(WISSEN_ORDNER, "de")} gefunden.`);
  process.exit(2);
}

/* ---------- HTML-Auszüge ---------- */
function zaehle(muster, text) { return (text.match(new RegExp(muster, "gi")) || []).length; }
function treffer(muster, text) { return new RegExp(muster, "i").exec(text); }

function artikelKoerper(html) {
  /* Der Artikelkörper beginnt beim <h1> (Titel) und endet vor der
     schliessenden </main> — enthält Fliesstext, Quellen, Verwandte
     Beiträge und die CTA-Leiste, wie in
     app/[locale]/wissen/[slug]/page.tsx gerendert. */
  const m = /<main[^>]*>([\s\S]*)<\/main>/i.exec(html);
  return m ? m[1] : html;
}

/* Überschriftenfolge: h1 zuerst, danach beliebig viele h2/h3, aber ein h3
   darf nie vor dem ersten h2 vorkommen (siehe Auftrag). */
function pruefeUeberschriftenfolge(html) {
  const koerper = artikelKoerper(html);
  const ueberschriften = [...koerper.matchAll(/<(h1|h2|h3)[\s>]/gi)].map(m => m[1].toLowerCase());
  assertTrue(ueberschriften.length > 0, "keine Überschriften im Artikelkörper gefunden");
  assertTrue(ueberschriften[0] === "h1", `erste Überschrift ist <${ueberschriften[0] ?? "(keine)"}>, nicht <h1>`);
  let h2Gesehen = false;
  for (const tag of ueberschriften.slice(1)) {
    if (tag === "h1") throw new Error("mehr als ein <h1> im Artikelkörper");
    if (tag === "h2") h2Gesehen = true;
    if (tag === "h3" && !h2Gesehen) throw new Error("<h3> kommt vor dem ersten <h2>");
  }
  return `Reihenfolge: ${ueberschriften.join(" → ")}`;
}

/* React escaped Textknoten (z. B. Apostroph → &#x27;) — für Vergleiche mit
   dem rohen Frontmatter-Text (Titel, Quellen) muss das rückgängig gemacht
   werden. Reicht für die Zeichen, die in diesen Inhalten tatsächlich
   vorkommen; kein vollständiger Entity-Decoder. */
function decodeHtmlEntities(text) {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function ohneScriptUndStyle(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
}
function sichtbarerText(html) {
  return ohneScriptUndStyle(html).replace(/<[^>]+>/g, " ");
}

/* ---------- Hauptlauf ---------- */
const HTML_CACHE = new Map(); // Schlüssel: `${locale}/${slug}` → html

for (const slug of SLUGS) {
  for (const locale of LOCALES) {
    const pfad = `/${locale}/wissen/${slug}`;
    const cacheKey = `${locale}/${slug}`;
    const frontmatter = ladeFrontmatter(locale, slug);
    const titel = typeof frontmatter.titel === "string" ? frontmatter.titel : slug;
    const quellen = Array.isArray(frontmatter.quellen) ? frontmatter.quellen : [];
    const aktualisiert = typeof frontmatter.aktualisiert === "string" ? frontmatter.aktualisiert : "";

    const html = await schritt(`${pfad} — 200`, async () => {
      const r = await holen(BASIS + pfad);
      assertTrue(r.status === 200, `status ${r.status} statt 200`);
      HTML_CACHE.set(cacheKey, r.text);
      return `status 200, ${r.text.length} Bytes`;
    });
    if (html === null) continue; // Seite nicht erreichbar — Folgeprüfungen ergäben nur Rauschen.
    const seite = HTML_CACHE.get(cacheKey);

    await schritt(`${pfad} — genau ein h1 = Frontmatter-Titel`, async () => {
      const anzahl = zaehle("<h1[\\s>]", seite);
      assertTrue(anzahl === 1, `nicht genau ein <h1> (${anzahl})`);
      const h1Text = decodeHtmlEntities(treffer("<h1[^>]*>([^<]*)</h1>", seite)?.[1]?.trim() ?? "");
      assertTrue(h1Text === titel, `h1 "${h1Text}" entspricht nicht dem Frontmatter-Titel "${titel}"`);
      return `h1 = "${h1Text}"`;
    });

    await schritt(`${pfad} — Überschriftenfolge (h1, dann h2, h3 nur nach h2)`, async () => pruefeUeberschriftenfolge(seite));

    await schritt(`${pfad} — interne Links im Artikel antworten 200`, async () => {
      const koerper = artikelKoerper(seite);
      const links = [...new Set([...koerper.matchAll(/href="(\/[^"]*)"/g)].map(m => m[1]))];
      if (links.length === 0) return "keine internen Links im Artikelkörper";
      const ergebnisse2 = [];
      for (const href of links) {
        const r = await holenMitEinemRedirect(BASIS + href);
        assertTrue(r.status === 200, `Link "${href}" → Status ${r.status} statt 200`);
        ergebnisse2.push(href);
      }
      return `${ergebnisse2.length} Link(s) ok: ${ergebnisse2.join(", ")}`;
    });

    await schritt(`${pfad} — Quellen-Abschnitt${quellen.length > 0 ? "" : " (keine Quellen im Frontmatter — Abschnitt darf fehlen)"}`, async () => {
      const koerper = artikelKoerper(seite);
      if (quellen.length === 0) return "keine Quellen im Frontmatter — nichts zu prüfen";
      const label = QUELLEN_LABEL[locale];
      assertTrue(new RegExp(`<h3[^>]*>${label}</h3>`, "i").test(koerper), `Überschrift "${label}" (ws_quellen) fehlt im Artikelkörper`);
      const koerperDecoded = decodeHtmlEntities(koerper);
      for (const q of quellen) {
        assertTrue(koerperDecoded.includes(q), `Quelle nicht im HTML gefunden: "${q}"`);
      }
      return `Überschrift "${label}" + ${quellen.length} Quelle(n) gerendert`;
    });

    await schritt(`${pfad} — Article-JSON-LD (headline, datePublished, inLanguage)`, async () => {
      const ld = treffer('<script type="application/ld\\+json">(.*?)</script>', seite);
      assertTrue(!!ld, "kein JSON-LD-Script gefunden");
      assertTrue(seite.includes('"@type":"Article"'), "kein Article im JSON-LD");
      const headlineM = /"headline":"((?:[^"\\]|\\.)*)"/.exec(seite);
      assertTrue(!!headlineM, "headline fehlt im JSON-LD");
      const headline = JSON.parse(`"${headlineM[1]}"`);
      assertTrue(headline === titel, `headline "${headline}" entspricht nicht dem Frontmatter-Titel "${titel}"`);
      const dateM = /"datePublished":"([^"]*)"/.exec(seite);
      assertTrue(!!dateM, "datePublished fehlt im JSON-LD");
      assertTrue(/^\d{4}-\d{2}-\d{2}$/.test(dateM[1]), `datePublished nicht im Format JJJJ-MM-TT: "${dateM[1]}"`);
      assertTrue(dateM[1] === aktualisiert, `datePublished "${dateM[1]}" entspricht nicht dem Frontmatter-Feld aktualisiert "${aktualisiert}"`);
      const langM = /"inLanguage":"([^"]*)"/.exec(seite);
      assertTrue(!!langM && langM[1] === locale, `inLanguage "${langM?.[1] ?? "(fehlt)"}" statt "${locale}"`);
      return `headline ok, datePublished=${dateM[1]}, inLanguage=${locale}`;
    });

    await schritt(`${pfad} — hreflang (4 Sprachen + x-default)`, async () => {
      for (const l of [...LOCALES, "x-default"]) {
        assertTrue(new RegExp(`<link rel="alternate" hreflang="${l}"`, "i").test(seite), `hreflang ${l} fehlt`);
      }
      return "alle 5 hreflang-Einträge vorhanden";
    });

    await schritt(`${pfad} — Bannwort-Wächter`, async () => {
      const text = sichtbarerText(seite);
      for (const wort of BANNWOERTER) {
        assertTrue(!text.includes(wort), `Bannwort im sichtbaren Text gefunden: "${wort}"`);
      }
      return "kein Bannwort im sichtbaren Text gefunden";
    });
  }
}

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
const okAnzahl = ergebnisse.filter(e => e.status === "OK").length;
console.log(`\n${ergebnisse.length} Schritte, ${fehlerAnzahl} FEHLER, ${okAnzahl} OK — ${SLUGS.length} Slugs × ${LOCALES.length} Sprachen`);

if (fehlerAnzahl > 0) {
  console.log("\nFEHLER im Detail:");
  for (const e of ergebnisse.filter(e => e.status === "FEHLER")) console.log(`  Schritt ${e.nr} (${e.titel}): ${e.detail}`);
}

const varOrdner = join(APP_ROOT, "var");
mkdirSync(varOrdner, { recursive: true });
writeFileSync(join(varOrdner, "wissen-bericht.json"), JSON.stringify({ basis: BASIS, zeit: new Date().toISOString(), slugs: SLUGS, ergebnisse }, null, 2));

process.exit(fehlerAnzahl > 0 ? 1 : 0);
