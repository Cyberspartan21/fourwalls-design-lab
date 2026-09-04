import { test } from "node:test";
import assert from "node:assert/strict";
import { EntwurfSchema, LEERER_ENTWURF, fehlend, istVollstaendig, schrittFuer } from "../domain/entwurf.ts";

const vollstaendig = {
  trans: "sale", typ: "wohnung", ortId: "ort-bern", genauigkeit: "ungefaehr",
  zimmer: 3.5, flaeche: 90, preis: 750000, titel: "Helle Wohnung am Park",
  beschreibung: "Ruhige Lage, Balkon nach Süden, zwei Minuten zum Bus. 2019 renoviert.",
  name: "Anna Beispiel", email: "anna@example.com", bilder: ["11111111-1111-4111-8111-111111111111"]
};

test("Das Schema ist die Erlaubnisliste — Unbekanntes wird abgewiesen", () => {
  assert.throws(() => EntwurfSchema.parse({ ...vollstaendig, status: "published" }));
  assert.throws(() => EntwurfSchema.parse({ ...vollstaendig, ownerId: "fremd" }));
  assert.throws(() => EntwurfSchema.parse({ ...vollstaendig, platform_role: "admin" }));
  assert.throws(() => EntwurfSchema.parse({ ...vollstaendig, published_at: "2020-01-01" }));
  assert.doesNotThrow(() => EntwurfSchema.parse(vollstaendig));
});

test("Die Lagegenauigkeit «exakt» ist nicht wählbar, solange keine Adresse geprüft wird", () => {
  assert.throws(() => EntwurfSchema.parse({ ...vollstaendig, genauigkeit: "exakt" }));
  assert.equal(EntwurfSchema.parse({}).genauigkeit, "ungefaehr");
});

test("Vollständigkeit hängt an der Objektart", () => {
  assert.equal(istVollstaendig(EntwurfSchema.parse(vollstaendig)), true);
  /* Parkplatz: weder Zimmer noch Wohnfläche */
  const parkplatz = EntwurfSchema.parse({ ...vollstaendig, typ: "parkplatz", zimmer: null, flaeche: null });
  assert.deepEqual(fehlend(parkplatz).map(m => m.feld), []);
  /* Land: keine Wohnfläche, aber eine Grundstücksfläche */
  const land = EntwurfSchema.parse({ ...vollstaendig, typ: "grundstueck", zimmer: null, flaeche: null });
  assert.deepEqual(fehlend(land).map(m => m.feld), ["grundstueck"]);
  assert.deepEqual(fehlend(EntwurfSchema.parse({ ...land, grundstueck: 800 })).map(m => m.feld), []);
  /* Wohnung ohne Zimmerzahl: unvollständig */
  assert.deepEqual(fehlend(EntwurfSchema.parse({ ...vollstaendig, zimmer: null })).map(m => m.feld), ["zimmer"]);
});

test("Ein leerer Entwurf nennt alle fehlenden Angaben mit ihrem Schritt", () => {
  const m = fehlend(LEERER_ENTWURF);
  assert.deepEqual(m.map(x => x.feld).sort(),
    ["beschreibung", "bilder", "email", "name", "ortId", "preis", "titel", "trans", "typ"].sort());
  assert.equal(m.find(x => x.feld === "titel")?.schritt, "text");
  assert.equal(schrittFuer("preis"), "preis");
});

test("Preis auf Anfrage ersetzt den Preis", () => {
  assert.equal(istVollstaendig(EntwurfSchema.parse({ ...vollstaendig, preis: null, preisAufAnfrage: true })), true);
});

test("Zu kurze Texte gelten als fehlend", () => {
  assert.equal(fehlend(EntwurfSchema.parse({ ...vollstaendig, titel: "Kurz" })).some(m => m.feld === "titel"), true);
  assert.equal(fehlend(EntwurfSchema.parse({ ...vollstaendig, beschreibung: "Zu kurz." })).some(m => m.feld === "beschreibung"), true);
});

test("Die Sprache des Inhalts wird gespeichert, nicht geraten", () => {
  assert.equal(EntwurfSchema.parse({}).sprache, "de");
  assert.equal(EntwurfSchema.parse({ sprache: "it" }).sprache, "it");
  assert.throws(() => EntwurfSchema.parse({ sprache: "rm" }));
});
