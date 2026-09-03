/* Firmenangaben — Übernahme von final/company.js in die Anwendung.

   Fourwalls ist für diesen Stand eine fiktive Firma. Jedes Feld trägt seinen
   Stand: bestaetigt (von der Firma geprüft), platzhalter (sieht echt aus,
   ist es nicht) oder offen (nichts bekannt — bleibt leer, wird nicht erfunden).

   Keine Geheimnisse hier: diese Datei darf in ein Client-Bündel gelangen. */

export type Stand = "bestaetigt" | "platzhalter" | "offen";

type Feld<T> = { wert: T | null; stand: Stand; hinweis?: string };

export const firma = {
  markenname:   { wert: "Fourwalls",            stand: "platzhalter" } as Feld<string>,
  firmierung:   { wert: "Fourwalls AG",         stand: "platzhalter" } as Feld<string>,
  rechtsform:   { wert: "AG",                   stand: "platzhalter" } as Feld<string>,
  uid:          { wert: null, stand: "offen", hinweis: "CHE-Nummer aus dem Handelsregister" } as Feld<string>,
  strasse:      { wert: "Löwenstrasse 12",      stand: "platzhalter" } as Feld<string>,
  plzOrt:       { wert: "8001 Zürich",          stand: "platzhalter" } as Feld<string>,
  telefon:      { wert: "+41 44 555 01 01",     stand: "platzhalter" } as Feld<string>,
  email:        { wert: "hallo@fourwalls.example", stand: "platzhalter", hinweis: ".example ist reserviert (RFC 2606)" } as Feld<string>,
  whatsapp:     { wert: null, stand: "offen", hinweis: "Ohne echte Nummer kein WhatsApp-Knopf" } as Feld<string>,
  staedte:      { wert: ["Zürich", "Bern", "Genf", "Lugano"], stand: "platzhalter" } as Feld<string[]>,
  impressumUrl: { wert: null, stand: "offen" } as Feld<string>,
  datenschutzUrl: { wert: null, stand: "offen" } as Feld<string>,
  mitgliedschaften: { wert: null, stand: "offen", hinweis: "Erst aufnehmen, wenn belegt" } as Feld<string[]>
} as const;

type FeldName = keyof typeof firma;

export function feld<K extends FeldName>(name: K, ersatz?: NonNullable<(typeof firma)[K]["wert"]>) {
  const f = firma[name];
  return (f.wert ?? ersatz ?? null) as (typeof firma)[K]["wert"];
}

/* Nur bestätigte Angaben dürfen als Tatsache über die Firma nach aussen —
   etwa in strukturierte Daten. Platzhalter erscheinen im Auftritt (damit er
   vollständig wirkt), aber nicht als maschinenlesbare Behauptung. */
export const bestaetigt = <K extends FeldName>(name: K) => firma[name].stand === "bestaetigt" && firma[name].wert != null;

export const offeneFelder = () =>
  (Object.entries(firma) as [FeldName, Feld<unknown>][])
    .filter(([, f]) => f.stand !== "bestaetigt")
    .map(([name, f]) => ({ feld: name, stand: f.stand, hinweis: f.hinweis ?? "" }));
