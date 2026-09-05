import { z } from "zod";
import { TYPEN, type Typ } from "./marktplatz.ts";

/* Ein Anliegen ist die Bitte einer Eigentümerin an FOURWALLS: verkaufen,
   vermieten, bewerten, verwalten oder besprechen (P5.8 §6–§9). Es ist KEINE
   Objektanfrage (siehe domain/inquiries — es gibt keine, `server/inquiries.ts`
   bleibt eigenständig) und KEIN Inserat.

   Wie `domain/entwurf.ts`: das Schema ist zugleich die Erlaubnisliste.
   `.strict()` lehnt Unbekanntes ab — wer `status`, `assignedStaffId`,
   `userId` oder `notes` mitschickt, bekommt einen Fehler statt einer Wirkung.

   Rein: keine Datenbank, keine Sitzung. Prüfbar in tests/anliegen.test.ts. */

export const DIENSTE = ["sell", "let", "valuation", "property_management", "owner_consultation"] as const;
export type Dienst = (typeof DIENSTE)[number];

/* Dienstbezeichnungen in vier Sprachen — für Betreffzeilen und Bestätigung,
   nicht für die Datenbank (dort steht der englische Schlüssel). */
export const DIENST_LABEL: Record<"de" | "fr" | "it" | "en", Record<Dienst, string>> = {
  de: { sell: "Verkauf", let: "Vermietung", valuation: "Bewertung", property_management: "Verwaltung", owner_consultation: "Beratung" },
  fr: { sell: "Vente", let: "Location", valuation: "Estimation", property_management: "Gérance", owner_consultation: "Conseil" },
  it: { sell: "Vendita", let: "Locazione", valuation: "Valutazione", property_management: "Amministrazione", owner_consultation: "Consulenza" },
  en: { sell: "Sale", let: "Letting", valuation: "Valuation", property_management: "Management", owner_consultation: "Consultation" }
};

const heutigesDatum = () => new Date().toISOString().slice(0, 10);

export const KontaktSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  telefon: z.string().trim().max(40).optional(),
  kanal: z.enum(["email", "phone", "whatsapp"]).default("email"),
  /* Terminwunsch als Wunsch, nie als Buchung (§40/§41) — und nicht in der
     Vergangenheit, das wäre offensichtlich kein echter Wunsch. */
  wunschdatum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .refine(v => v === undefined || v >= heutigesDatum(), "Das Datum darf nicht in der Vergangenheit liegen"),
  wunschfenster: z.enum(["morning", "afternoon", "evening"]).optional()
}).strict();
export type Kontakt = z.infer<typeof KontaktSchema>;

const ganzzahl = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const zahl = (min: number, max: number) => z.coerce.number().min(min).max(max);

export const ObjektSchema = z.object({
  /* Lage — strukturiert über den Ortsindex, nie als freier Text (wie im
     Assistenten). Gemeinde ODER Postleitzahl, nie Kanton/Region. */
  ortId: z.string().regex(/^(ort|plz)-[a-z0-9-]{1,40}$/).optional(),
  typ: z.enum(TYPEN as [Typ, ...Typ[]]).optional(),
  zimmer: zahl(0.5, 30).optional(),
  flaeche: ganzzahl(1, 100000).optional(),
  grundstueck: ganzzahl(1, 10_000_000).optional(),
  baujahr: ganzzahl(1000, 2100).optional(),
  einheiten: ganzzahl(1, 5000).optional(),
  zustand: z.enum(["new", "good", "renovation_needed", "unknown"]).optional(),
  belegung: z.enum(["owner", "rented", "vacant", "unknown"]).optional(),
  zeitpunkt: z.enum(["asap", "3m", "6m", "12m", "unsure"]).optional(),
  bereitsInseriert: z.boolean().optional(),
  andererMakler: z.boolean().optional(),
  leistungen: z.array(z.enum(["tenant_search", "full_management", "accounting", "maintenance", "advice"])).max(5).optional(),
  inseratRef: z.string().regex(/^FWL-\d{4}-\d{6}$/).optional(),
  nachricht: z.string().trim().max(4000).optional()
}).strict();
export type Objekt = z.infer<typeof ObjektSchema>;

export const AnliegenSchema = z.object({
  dienst: z.enum(DIENSTE),
  kontakt: KontaktSchema,
  objekt: ObjektSchema.optional(),
  sprache: z.enum(["de", "fr", "it", "en"]),
  herkunft: z.object({
    seite: z.string().trim().max(120),
    kampagne: z.string().trim().max(60).regex(/^[a-z0-9-]+$/).optional()
  }).strict(),
  /* Honigtopf: ein für Menschen unsichtbares Feld. Wer es füllt, ist ein
     Skript — server/anliegen.ts behandelt das gesondert (erfundene Referenz,
     nichts gespeichert), nicht als gewöhnlicher Validierungsfehler. */
  firma: z.string().max(0).optional()
}).strict();
export type Anliegen = z.infer<typeof AnliegenSchema>;

/* Welche Angaben ein Anliegen mindestens braucht, hängt vom Dienst ab:
   verkaufen/vermieten/bewerten brauchen Ort und Objektart, Verwaltung nur
   den Ort, eine Beratung nichts weiter als den Kontakt (§9). */
export function fehlend(a: Anliegen): string[] {
  const m: string[] = [];
  if (a.dienst === "sell" || a.dienst === "let" || a.dienst === "valuation") {
    if (!a.objekt?.ortId) m.push("objekt.ortId");
    if (!a.objekt?.typ) m.push("objekt.typ");
  } else if (a.dienst === "property_management") {
    if (!a.objekt?.ortId) m.push("objekt.ortId");
  }
  return m;
}
