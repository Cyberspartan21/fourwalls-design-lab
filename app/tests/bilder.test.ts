import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { ableiten, BREITEN } from "../services/bilder.ts";
import { hatMetadaten } from "../lib/bild.ts";

const jpeg = new Uint8Array(readFileSync("public/media/zurich-altbau-1-960.jpg"));

test("Ein 960 Pixel breites Original liefert nur die Breiten 480 und 960", async () => {
  const ergebnis = await ableiten(jpeg);
  assert.equal(ergebnis.breite, 960);
  assert.equal(ergebnis.hoehe, 540);
  assert.equal(ergebnis.originalFormat, "jpeg");

  const breiten = new Set(ergebnis.varianten.map(v => v.breite));
  assert.deepEqual([...breiten].sort((a, b) => a - b), [480, 960]);
  assert.ok(!breiten.has(1600) && !breiten.has(2400), "keine grösseren Breiten als das Original");

  for (const b of [480, 960]) {
    assert.ok(ergebnis.varianten.some(v => v.breite === b && v.format === "webp"), `webp ${b} fehlt`);
    assert.ok(ergebnis.varianten.some(v => v.breite === b && v.format === "jpeg"), `jpeg ${b} fehlt`);
  }
  assert.equal(ergebnis.varianten.length, 4);
});

test("EXIF-Orientierung wird angewendet, die längste Kante bleibt bei 2400, Metadaten verschwinden", async () => {
  /* 3000×2000, mit Orientierung 6 (90° im Uhrzeigersinn) und einem
     EXIF-Kommentar — wie eine Kamera es abliefert. */
  const roh = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 180, g: 90, b: 40 } } })
    .jpeg()
    .withMetadata({ orientation: 6, exif: { IFD0: { ImageDescription: "Testkommentar mit Ortsangabe" } } })
    .toBuffer();

  const ergebnis = await ableiten(new Uint8Array(roh));

  /* Nach der Rotation ist aus 3000×2000 (Querformat) ein Hochformat
     geworden; verkleinert auf höchstens 2400 px Kantenlänge: 1600×2400. */
  assert.ok(ergebnis.hoehe > ergebnis.breite, "aus dem Querformat wurde Hochformat");
  assert.equal(Math.max(ergebnis.breite, ergebnis.hoehe), 2400, "längste Kante ist 2400");

  assert.ok(ergebnis.varianten.length > 0);
  for (const v of ergebnis.varianten.filter(v => v.format === "jpeg")) {
    assert.equal(hatMetadaten(v.bytes), false, `Variante ${v.breite}px trägt noch Metadaten`);
  }
});

test("Ein Dokument mit Skriptfähigkeit (SVG) wird nicht als Bild abgeleitet", async () => {
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  await assert.rejects(() => ableiten(svg), /nicht dekodierbar/i);

  const svgMitMassen = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="red"/></svg>');
  await assert.rejects(() => ableiten(svgMitMassen), /nicht dekodierbar/i);
});

test("BREITEN ist die feste Skala 480/960/1600/2400", () => {
  assert.deepEqual(BREITEN, [480, 960, 1600, 2400]);
});
