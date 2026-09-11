/* ============================================================
   FOURWALLS — Wasserlinie eines Heldenbilds messen

   Der Wasser-Shader auf der UFER-Startseite (final/ufer/index.html) teilt
   das Bild mit EINER waagrechten Linie `uWL` und bewegt alles darunter —
   über die ganze Bildbreite. Steht dort noch Terrasse, Steg, Rasen oder
   Fels, wackelt das mit. Genau das hat der Auftraggeber beanstandet.

   Dieses Werkzeug schätzt die Linie nicht, sondern misst sie: Es sucht die
   HÖCHSTE Linie, unterhalb derer JEDE Bildzeile zu mindestens `--anteil`
   (Standard 95 %) aus Wasser besteht. Ergibt sich kein nennenswertes Band,
   taugt das Bild für diesen Helden nicht.

   Wassererkennung je Pixel, bewusst grosszügig, damit Spiegelungen und
   Schatten nicht fälschlich als Ufer gelten:
     - Blau- oder Grünanteil liegt deutlich über Rot (Seewasser, Pool)
     - sehr helle, entsättigte Fläche (Himmel, der sich spiegelt)
     - dunkle, entsättigte Fläche (Wasser im Schatten)

   Aufruf:
     node tools/wasserlinie.mjs <bild.jpg> [weitere ...] [--anteil 0.95] [--bild]

   `--bild` legt neben jeder Datei eine Kontrollaufnahme `<name>-pruef.jpg`
   ab, in der der bewegte Bereich rot eingefärbt ist. Damit lässt sich mit
   einem Blick prüfen, ob wirklich nur Wasser bewegt wird.

   Ausgabe je Bild: gemessene Wasserlinie, Höhe des Wasserbands in Prozent.
   Exit 1, wenn ein Bild kein Band von mindestens 15 % erreicht.
   ============================================================ */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
const sharp = createRequire(join(hier, "..", "app", "package.json"))("sharp");

const argv = process.argv.slice(2);
const mitBild = argv.includes("--bild");
const aIdx = argv.indexOf("--anteil");
const SCHWELLE = aIdx >= 0 ? Number(argv[aIdx + 1]) : 0.95;
const dateien = argv.filter((a, i) => !a.startsWith("--") && !(aIdx >= 0 && i === aIdx + 1));
if (!dateien.length) { console.error("Aufruf: node tools/wasserlinie.mjs <bild.jpg> [...] [--anteil 0.95] [--bild]"); process.exit(2); }

function istWasser(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const saettigung = max === 0 ? 0 : (max - min) / max;
  const helligkeit = max / 255;
  if ((b > r + 10 || g > r + 10) && saettigung > 0.08) return true;
  if (helligkeit > 0.78 && saettigung < 0.20) return true;
  if (helligkeit < 0.36 && saettigung < 0.34) return true;
  return false;
}

let fehler = 0;
for (const datei of dateien) {
  const { data, info } = await sharp(datei).resize(640).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const anteil = new Array(H);
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 0; x < W; x++) { const i = (y * W + x) * C; if (istWasser(data[i], data[i + 1], data[i + 2])) n++; }
    anteil[y] = n / W;
  }
  let y = H - 1;
  while (y > 0 && anteil[y] >= SCHWELLE) y--;
  const wl = (y + 1) / H, band = (H - y - 1) / H;
  const name = datei.replace(/.*\//, "");
  const urteil = band >= 0.15 ? "ok" : "ZU WENIG WASSER";
  console.log(`${name.padEnd(28)} wl=${wl.toFixed(3)}  Wasserband ${(band * 100).toFixed(0)} %  ${urteil}`);
  if (band < 0.15) fehler++;

  if (mitBild) {
    const meta = await sharp(datei).metadata();
    const px = Math.round(wl * meta.height);
    const marke = Buffer.from(
      `<svg width="${meta.width}" height="${meta.height}">` +
      `<rect x="0" y="${px}" width="${meta.width}" height="${meta.height - px}" fill="#ff0044" opacity="0.34"/>` +
      `<rect x="0" y="${Math.max(0, px - 3)}" width="${meta.width}" height="6" fill="#ff0044"/></svg>`);
    await sharp(datei).composite([{ input: marke, top: 0, left: 0 }]).jpeg({ quality: 84 })
      .toFile(datei.replace(/\.[a-z]+$/i, "") + "-pruef.jpg");
  }
}
process.exit(fehler ? 1 : 0);
