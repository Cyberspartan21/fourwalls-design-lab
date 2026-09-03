/* ============================================================
   FOURWALLS — Übersetzungen aus dem Prototyp herauslösen

   P4 hat rund 500 Schlüssel in zwei gewachsenen Objekten: `FWP.I18N` in
   core.js (Produktkern) und `UFER.T` in ufer.js (Navigation und Fusszeile).
   Für die Produktion sollen daraus nach Bereichen getrennte Kataloge werden.

   Dieses Werkzeug liest die Schlüssel aus den laufenden Dateien — nicht aus
   einer Abschrift. Was hier herauskommt, ist nachweislich das, was der geprüfte
   Prototyp anzeigt. Abtippen würde genau die Fehler einführen, die eine
   Migration unentdeckt mitschleppt.

   Aufruf: node tools/i18n-export.mjs [zielordner]
   ============================================================ */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/* fileURLToPath statt .pathname: sonst bleiben %20 aus Ordnernamen mit
   Leerzeichen stehen und keine Datei wird gefunden. */
const wurzel = fileURLToPath(new URL("..", import.meta.url));
const ziel = process.argv[2] || join(wurzel, "i18n");
const SPRACHEN = ["de", "fr", "it", "en"];

/* Die Prototyp-Dateien in einer Sandbox laden. listings.js und properties.js
   werden nur gebraucht, damit core.js durchläuft — ihre Daten interessieren hier
   nicht. */
const sandbox = { window: {}, document: { documentElement: {} }, localStorage: null,
  matchMedia: () => ({ matches: false, addEventListener() {} }), location: { search: "", hash: "" } };
globalThis.window = sandbox.window;
globalThis.document = sandbox.document;
globalThis.matchMedia = sandbox.matchMedia;
globalThis.location = sandbox.location;

const lies = p => readFileSync(join(wurzel, "final", p), "utf8");
(0, eval)(lies("listings.js"));
(0, eval)(lies("properties.js"));
(0, eval)(lies("core.js"));
(0, eval)(lies("company.js"));
(0, eval)(lies("ufer/ufer.js"));

const I18N = window.FWP.I18N;                 // Produktkern
const T    = window.UFER.T;                   // Navigation, Fusszeile

/* ---------- Bereichszuordnung ----------
   Nach Präfix und bekannten Schlüsseln. Was hier nicht zugeordnet wird, landet
   in `common` — sichtbar in der Zusammenfassung, damit es nicht stillschweigend
   verschwindet. */
const BEREICHE = [
  ["property",  k => k.startsWith("o_")],            // Objektseite (P4)
  ["wizard",    k => k.startsWith("w_")],            // Inserate-Assistent (P4)
  ["account",   k => k.startsWith("k_")],            // Konto-Bereich (P4)
  ["search",    k => /^(such|filter|sort|treffer|karte|hierSuchen|imAusschnitt|autoSuchen|umkreis|preis|zimmer|flaeche|grund|baujahr|etage|verfuegbar|anbieter|ausstattung|quelle|liste|kacheln|zeilen|buehne|ergebnis|lockern|radiusMehr|budgetMehr|filterWeg|keineTreffer|zeigeAlle|abo|wie)/i.test(k)],
  ["navigation",k => /^(immobilien|verkaufen|verwalten|wissen|konto|kaufen|mieten|gemerkt|inserieren|menue|schliessen|tag|nacht|weiter|zurueck)$/.test(k)],
  ["property",  k => /^(merken|gemerktOk|anfrage|melden|teilen|dokumente|lage|beschreibung|fakten|kontakt|geprueft|proM2|aufAnfrage|proMonat|nk|bild1|bildN|bilderMedien|exclusive|privat|makler|verwaltung|bautraeger|neu|kaution|bruttomiete|nettomiete|nebenkosten|sofort|abDatum|nachVereinbarung|reserviert|verkauft|vermietet|eg|ug|og|dachgeschoss)$/.test(k)],
  ["common",    () => true]
];

const bereichFuer = k => BEREICHE.find(([, passt]) => passt(k))[0];

/* ---------- Aufteilen ---------- */
const kataloge = {};        // kataloge[sprache][bereich][schluessel] = text
const zaehler = {};

for (const sprache of SPRACHEN) {
  kataloge[sprache] = {};
  const quelle = I18N[sprache] || {};
  for (const [k, v] of Object.entries(quelle)) {
    if (typeof v !== "string") continue;
    const b = bereichFuer(k);
    (kataloge[sprache][b] ||= {})[k] = v;
    if (sprache === "de") zaehler[b] = (zaehler[b] || 0) + 1;
  }
  /* ufer.js: Navigation und Fusszeile. Präfix `nav.`, damit die Herkunft
     erkennbar bleibt und nichts mit dem Produktkern kollidiert. */
  const navQuelle = T[sprache] || {};
  for (const [k, v] of Object.entries(navQuelle)) {
    if (typeof v !== "string") continue;
    (kataloge[sprache]["navigation"] ||= {})["nav." + k] = v;
    if (sprache === "de") zaehler["navigation"] = (zaehler["navigation"] || 0) + 1;
  }
}

/* ---------- Vollständigkeit prüfen ----------
   Ein Schlüssel, den es auf Deutsch gibt und in einer anderen Sprache nicht,
   fällt im Betrieb auf Deutsch zurück — und niemand merkt es. Hier wird er
   sichtbar. */
const luecken = [];
for (const bereich of Object.keys(kataloge.de)) {
  for (const k of Object.keys(kataloge.de[bereich])) {
    for (const sprache of ["fr", "it", "en"]) {
      if (!kataloge[sprache][bereich] || kataloge[sprache][bereich][k] === undefined) {
        luecken.push({ sprache, bereich, schluessel: k });
      }
    }
  }
}

/* ---------- Schreiben ---------- */
for (const sprache of SPRACHEN) {
  const ordner = join(ziel, sprache);
  mkdirSync(ordner, { recursive: true });
  for (const [bereich, eintraege] of Object.entries(kataloge[sprache])) {
    const sortiert = Object.fromEntries(Object.entries(eintraege).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(join(ordner, bereich + ".json"), JSON.stringify(sortiert, null, 2) + "\n");
  }
}

writeFileSync(join(ziel, "luecken.json"), JSON.stringify(luecken, null, 2) + "\n");

const gesamt = Object.values(zaehler).reduce((a, b) => a + b, 0);
console.log("Bereich        Schlüssel");
for (const [b, n] of Object.entries(zaehler).sort((a, b) => b[1] - a[1])) {
  console.log(b.padEnd(14) + String(n).padStart(5));
}
console.log("-".repeat(19));
console.log("gesamt".padEnd(14) + String(gesamt).padStart(5) + "  × 4 Sprachen");
console.log(luecken.length
  ? `\n⚠ ${luecken.length} fehlende Übersetzungen — siehe ${join(ziel, "luecken.json")}`
  : "\n✓ Alle Schlüssel in allen vier Sprachen vorhanden");
