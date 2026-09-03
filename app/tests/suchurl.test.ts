import { test } from "node:test";
import assert from "node:assert/strict";
import { anfrageAusParams, paramsAusAnfrage } from "../domain/suchurl.ts";
import { kurzPreis, proM2, LEER } from "../domain/marktplatz.ts";

test("Suchadresse: Parameter des Prototyps werden gelesen und zurückgeschrieben", () => {
  const q = anfrageAusParams({ ort: "ort-zuerich", um: "10", typ: "wohnung", pmax: "1500000", zi: "3.5", feat: "balcony,lift", sort: "preis-auf", seite: "2", alle: "1" }, "buy");
  assert.equal(q.ort, "ort-zuerich"); assert.equal(q.umkreisKm, 10); assert.equal(q.typ, "wohnung"); assert.equal(q.pMax, 1500000); assert.equal(q.ziMin, 3.5);
  assert.deepEqual(q.feat, ["balcony", "lift"]); assert.equal(q.sort, "preis-auf"); assert.equal(q.seite, 2); assert.equal(q.nurFrei, false);
  const p = paramsAusAnfrage(q);
  assert.equal(p.get("ort"), "ort-zuerich"); assert.equal(p.get("um"), "10"); assert.equal(p.get("pmax"), "1500000"); assert.equal(p.get("feat"), "balcony,lift"); assert.equal(p.get("alle"), "1"); assert.equal(p.get("seite"), "2");
  assert.equal(paramsAusAnfrage(LEER).toString(), "", "Leere Anfrage = leere Adresse");
});
test("Suchadresse: Ungültiges fällt nachsichtig zurück (Seite), streng abgewiesen (API)", () => {
  const q = anfrageAusParams({ um: "999999", sort: "id;DROP", typ: "<script>", ort: "ort-x'OR" }, "buy");
  assert.equal(q.umkreisKm, 0); assert.equal(q.sort, "neu"); assert.equal(q.typ, ""); assert.equal(q.ort, null);
  assert.throws(() => anfrageAusParams({ um: "999999" }, "buy", true), /Ungültige Suchparameter/);
  assert.throws(() => anfrageAusParams({ box: "1,2,3,4" }, "buy", true));
});
test("Marktplatz: Preisschild und CHF/m² wie im Prototyp", () => {
  assert.equal(kurzPreis({ transactionType: "buy", price: 5480000, rentNet: null, priceOnRequest: false }), "5.48 Mio.");
  assert.equal(kurzPreis({ transactionType: "buy", price: 890000, rentNet: null, priceOnRequest: false }), "890k");
  assert.equal(kurzPreis({ transactionType: "rent", price: null, rentNet: 2385, priceOnRequest: false }), "2390.–");
  assert.equal(kurzPreis({ transactionType: "buy", price: null, rentNet: null, priceOnRequest: true }), "a. A.");
  assert.equal(proM2({ transactionType: "buy", priceOnRequest: false, price: 5480000, livingArea: 289, propertyType: "haus" }), 19000);
  assert.equal(proM2({ transactionType: "rent", priceOnRequest: false, price: null, livingArea: 100, propertyType: "wohnung" }), null);
  assert.equal(proM2({ transactionType: "buy", priceOnRequest: false, price: 900000, livingArea: 100, propertyType: "gewerbe" }), null);
});
