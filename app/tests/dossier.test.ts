import { test } from "node:test";
import assert from "node:assert/strict";
import { finanz } from "../domain/listing.ts";

/* Finanzlogik wie im Prototyp: 20 % Eigenmittel, 1.9 % → CHF 16’070 im Monat für 5.48 Mio. */
test("Tragbarkeit: Referenzwerte des Seehaus-Dossiers", () => {
  const f = finanz(548000000, 0.2, 0.019);
  assert.equal(f.ek, 1096000); assert.equal(f.hyp, 4384000); assert.equal(f.belehnung, 80); assert.equal(f.total, 16070);
});
