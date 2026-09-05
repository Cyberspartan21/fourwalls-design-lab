import { test } from "node:test";
import assert from "node:assert/strict";
import { AnliegenSchema, fehlend, type Anliegen } from "../domain/anliegen.ts";

const kontakt = { name: "Anna Beispiel", email: "anna@example.com" };
const herkunft = { seite: "/de/verkaufen" };

function anliegen(teile: Partial<Anliegen>): Anliegen {
  return AnliegenSchema.parse({ dienst: "owner_consultation", kontakt, sprache: "de", herkunft, ...teile });
}

test("fehlend: sell/let/valuation brauchen Ort und Objektart", () => {
  for (const dienst of ["sell", "let", "valuation"] as const) {
    const ohneObjekt = anliegen({ dienst });
    assert.deepEqual(fehlend(ohneObjekt).sort(), ["objekt.ortId", "objekt.typ"]);

    const nurOrt = anliegen({ dienst, objekt: { ortId: "ort-zuerich" } });
    assert.deepEqual(fehlend(nurOrt), ["objekt.typ"]);

    const nurTyp = anliegen({ dienst, objekt: { typ: "wohnung" } });
    assert.deepEqual(fehlend(nurTyp), ["objekt.ortId"]);

    const vollstaendig = anliegen({ dienst, objekt: { ortId: "ort-zuerich", typ: "wohnung" } });
    assert.deepEqual(fehlend(vollstaendig), []);
  }
});

test("fehlend: property_management braucht nur den Ort", () => {
  const ohneObjekt = anliegen({ dienst: "property_management" });
  assert.deepEqual(fehlend(ohneObjekt), ["objekt.ortId"]);

  const mitOrt = anliegen({ dienst: "property_management", objekt: { ortId: "plz-8001" } });
  assert.deepEqual(fehlend(mitOrt), []);
});

test("fehlend: owner_consultation braucht nichts weiter als den Kontakt", () => {
  const nurKontakt = anliegen({ dienst: "owner_consultation" });
  assert.deepEqual(fehlend(nurKontakt), []);
});

test("Das Schema ist die Erlaubnisliste — status/assignedStaffId/userId/notes werfen", () => {
  const basis = { dienst: "owner_consultation", kontakt, sprache: "de", herkunft };
  assert.doesNotThrow(() => AnliegenSchema.parse(basis));
  assert.throws(() => AnliegenSchema.parse({ ...basis, status: "new" }));
  assert.throws(() => AnliegenSchema.parse({ ...basis, assignedStaffId: "u-1" }));
  assert.throws(() => AnliegenSchema.parse({ ...basis, userId: "u-1" }));
  assert.throws(() => AnliegenSchema.parse({ ...basis, notes: "intern" }));
});

test("Unbekannter Dienst wird abgelehnt", () => {
  assert.throws(() => AnliegenSchema.parse({ dienst: "buy", kontakt, sprache: "de", herkunft }));
});

test("Der Honigtopf ist im Schema, aber nur leer erlaubt", () => {
  assert.doesNotThrow(() => AnliegenSchema.parse({ dienst: "owner_consultation", kontakt, sprache: "de", herkunft, firma: "" }));
  assert.throws(() => AnliegenSchema.parse({ dienst: "owner_consultation", kontakt, sprache: "de", herkunft, firma: "Bot GmbH" }));
});

test("Ein Wunschdatum in der Vergangenheit wird abgelehnt", () => {
  assert.throws(() => AnliegenSchema.parse({ dienst: "owner_consultation", kontakt: { ...kontakt, wunschdatum: "2000-01-01" }, sprache: "de", herkunft }));
  assert.doesNotThrow(() => AnliegenSchema.parse({ dienst: "owner_consultation", kontakt: { ...kontakt, wunschdatum: "2099-01-01" }, sprache: "de", herkunft }));
});
