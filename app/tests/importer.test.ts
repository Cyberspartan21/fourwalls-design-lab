import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error — JS-Skript ohne Typen; hier nur die Abbildung
import { ART, HERAUSGEBER, PRAEZISION, abgeleiteteAbschnitte, slugify, rp, synthetisch, MANDATE, L } from "../scripts/import-demo.mjs";

test("Importer: Bestand des Prototyps = 289 synthetische + 15 Mandate (31 synthetische Exclusive ersetzt)", () => {
  assert.equal(L.length, 320); assert.equal(synthetisch.length, 289); assert.equal(MANDATE.length, 15);
});
test("Importer: jede Quelle, Art und Genauigkeit des Prototyps ist abgebildet", () => {
  for (const l of synthetisch) { assert.ok(ART[l.propertyType], l.propertyType); assert.ok(HERAUSGEBER[l.listingSource], l.listingSource); assert.ok(PRAEZISION[l.geo.genauigkeit], l.geo.genauigkeit); }
});
test("Importer: Ableitung erfindet keine Fakten", () => {
  const ohne = { features: [], transactionType: "buy" };
  const s = abgeleiteteAbschnitte(ohne, "de");
  assert.equal(s.gebaeude, undefined); assert.equal(s.ausstattung, undefined); assert.equal(s.energie, undefined); assert.equal(s.story, undefined);
  assert.deepEqual(s.naechsteSchritte, ["Besichtigung anfragen", "Frage stellen", "Finanzierung prüfen"]);
  const mit = abgeleiteteAbschnitte({ features: ["parquet", "minergie", "garage"], yearBuilt: 2020, beschreibung: "Text", transactionType: "rent" }, "fr");
  assert.equal(mit.ausstattung.boeden, "Parkett"); assert.equal(mit.energie.minergie, "Minergie-zertifiziert"); assert.equal(mit.parkieren.garage, "Vorhanden");
  assert.match(mit.gebaeude.zustand, /Comme neuf/); assert.equal(mit.story.titel, "Description"); assert.equal(mit.naechsteSchritte[2], "Demander le dossier");
});
test("Importer: Rappen und Slugs", () => { assert.equal(rp(1234.5), 123450); assert.equal(rp(null), null); assert.equal(slugify("Weber & Cie Immobilien"), "weber-cie-immobilien"); assert.equal(slugify("Lemania Properties SA"), "lemania-properties-sa"); });
