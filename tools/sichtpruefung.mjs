/* ============================================================
   FOURWALLS — Sichtprüfung der Regressionszustände (P5.9 Phase B, WS H)

   Nimmt einen Ordner mit PNGs entgegen (die Ausgabe von tools/baseline.mjs)
   und prüft JEDE Datei rein rechnerisch — ohne einen Menschen, der
   hinschaut — auf genau den Fehler, der in P5.8 durchgerutscht ist: eine
   leere Seite ("blatt"-Fehler), die als Screenshot unauffällig aussieht,
   weil nichts abgestürzt ist, aber nichts zeigt.

   Je Bild:
     1. Dateigrösse > 20 KB (eine winzige Datei ist fast immer eine leere
        oder fast einfarbige Fläche — PNG komprimiert Einfarbigkeit sehr gut).
     2. Bildmasse plausibel: Breite = erwartete Viewportbreite × Geräte-
        pixelverhältnis. tools/baseline.mjs nimmt mobile Zustände (Dateiname
        beginnt mit "m-") mit deviceScaleFactor 2 bei 390 CSS-Pixel breit auf
        → 780 physische Pixel; Desktop-Zustände mit deviceScaleFactor 1 bei
        1440 CSS-Pixel breit → 1440 physische Pixel.
     3. Anteil der Pixel, die NICHT der häufigsten Farbe entsprechen, ≥ 2,5 %.
        Eine leere/fast leere Seite ist praktisch einfarbig (die häufigste
        Farbe deckt fast alles ab) — genau das hätte den "blatt"-Fehler aus
        P5.8 erkannt, ohne dass jemand das Bild ansehen musste.

   PNG-Dekodierung: sharp liegt bereits als Abhängigkeit in app/node_modules
   (siehe app/package.json) — keine neue Installation nötig. Kein eigener
   PNG-Parser, kein pngjs.

   Aufruf: node tools/sichtpruefung.mjs <ordner>
   Exit 1, wenn irgendein Bild eine der drei Prüfungen verfehlt, sonst 0.
   ============================================================ */
import { createRequire } from "node:module";
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/* sharp ist eine Abhängigkeit von app/ (app/package.json), nicht der
   Repo-Wurzel — dieses Werkzeug lebt unter tools/, deshalb node_modules
   ausdrücklich über einen require() relativ zu app/ auflösen, statt eine
   zweite Kopie an der Wurzel zu erwarten. */
const HIER = dirname(fileURLToPath(import.meta.url));
const APP_NODE_MODULES = join(HIER, "..", "app", "node_modules");
const require = createRequire(join(APP_NODE_MODULES, "package.json"));
let sharp;
try {
  sharp = require("sharp");
} catch {
  console.error(`sharp nicht gefunden unter ${APP_NODE_MODULES} — vorher "npm ci" in app/ ausführen.`);
  process.exit(2);
}

const ordner = process.argv[2];
if (!ordner) { console.error("Aufruf: node tools/sichtpruefung.mjs <ordner>"); process.exit(1); }

const MIN_BYTES = 20 * 1024;
const MIN_ANTEIL_PROZENT = 2.5; /* Textseiten im Viewport (verwalten, bewertung, offenes Menü) liegen bei 3,6–4,4 %; eine leere Seite mit blossem Kopf deutlich darunter (P5.9-Messung). */

function erwarteteBreite(dateiname) {
  return dateiname.startsWith("m-") ? 780 : 1440;
}

async function pruefeDatei(pfad, dateiname) {
  const fehler = [];

  const groesse = statSync(pfad).size;
  if (!(groesse > MIN_BYTES)) fehler.push(`Datei ${(groesse / 1024).toFixed(1)} KB nicht > 20 KB`);

  const { data, info } = await sharp(pfad).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const sollBreite = erwarteteBreite(dateiname);
  if (width !== sollBreite) fehler.push(`Breite ${width}px ≠ erwartet ${sollBreite}px`);

  /* Häufigste Farbe zählen (RGB, Alpha ignoriert — Screenshots sind
     durchgehend deckend) über den rohen Pixelpuffer. */
  const gesamtPixel = width * height;
  const zaehlung = new Map();
  for (let i = 0; i < data.length; i += channels) {
    const schluessel = channels >= 3 ? (data[i] << 16) | (data[i + 1] << 8) | data[i + 2] : data[i];
    zaehlung.set(schluessel, (zaehlung.get(schluessel) ?? 0) + 1);
  }
  let haeufigste = 0;
  for (const anzahl of zaehlung.values()) if (anzahl > haeufigste) haeufigste = anzahl;
  const anteilAnders = gesamtPixel > 0 ? ((gesamtPixel - haeufigste) / gesamtPixel) * 100 : 0;
  if (!(anteilAnders >= MIN_ANTEIL_PROZENT)) {
    fehler.push(`nur ${anteilAnders.toFixed(2)} % abweichende Pixel (Schwelle ${MIN_ANTEIL_PROZENT} %) — Seite könnte leer/einfarbig sein`);
  }

  return { dateiname, groesseKb: groesse / 1024, width, height, anteilAnders, fehler };
}

async function main() {
  let dateien;
  try {
    dateien = readdirSync(ordner).filter(f => f.toLowerCase().endsWith(".png")).sort();
  } catch (e) {
    console.error(`Ordner nicht lesbar: ${ordner} — ${e.message}`);
    process.exit(2);
  }
  if (dateien.length === 0) {
    console.error(`Keine PNG-Dateien in ${ordner} gefunden.`);
    process.exit(2);
  }

  const ergebnisse = [];
  for (const dateiname of dateien) {
    try {
      ergebnisse.push(await pruefeDatei(join(ordner, dateiname), dateiname));
    } catch (e) {
      ergebnisse.push({ dateiname, groesseKb: 0, width: 0, height: 0, anteilAnders: 0, fehler: [`nicht lesbar/kein gültiges PNG: ${e.message}`] });
    }
  }

  const breiteSpalte = Math.max(...ergebnisse.map(e => e.dateiname.length), 10);
  const kopf = `${"Datei".padEnd(breiteSpalte)}  ${"KB".padStart(8)}  ${"Masse".padStart(11)}  ${"Anteil".padStart(8)}  Status`;
  console.log(kopf);
  console.log("-".repeat(kopf.length));
  for (const e of ergebnisse) {
    const zeichen = e.fehler.length === 0 ? "✓" : "✗";
    const masse = `${e.width}x${e.height}`;
    const zeile = `${e.dateiname.padEnd(breiteSpalte)}  ${e.groesseKb.toFixed(1).padStart(8)}  ${masse.padStart(11)}  ${e.anteilAnders.toFixed(2).padStart(7)}%  ${zeichen}${e.fehler.length ? " " + e.fehler.join("; ") : ""}`;
    console.log(zeile);
  }

  const fehlerhaft = ergebnisse.filter(e => e.fehler.length > 0);
  console.log(`\n${ergebnisse.length} Bilder geprüft · ${fehlerhaft.length} mit Befund`);
  process.exit(fehlerhaft.length > 0 ? 1 : 0);
}

main();
