import { z } from "zod";
import { TYPEN, FEATURES, type Typ } from "./marktplatz.ts";
import type { Locale } from "@/i18n";

/* Der Inserats-Entwurf — was der Assistent sammelt und wann er vollständig ist.

   Zwei Dinge stehen hier bewusst zusammen:

   1. Das Schema (`EntwurfSchema`) ist zugleich die Erlaubnisliste. Es kennt nur
      Assistentenfelder. Wer `status`, `published_at`, `ownerId` oder eine Rolle
      mitschickt, bekommt einen Fehler statt einer Wirkung (§67) — `.strict()`
      lehnt Unbekanntes ab, statt es stillschweigend zu verwerfen.
   2. Die Vollständigkeitsregeln (`fehlend`) sind typabhängig und dieselben wie
      im P4-Assistenten: kein Zimmerzwang für Parkplätze, keine Wohnfläche für
      Land, kein Kaufpreis bei Miete (§39/§40).

   Rein: keine Datenbank, keine Sitzung. Prüfbar in tests/entwurf.test.ts. */

/* ---------- Was der Assistent sammelt ---------- */
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const zahl = (min: number, max: number) => z.coerce.number().min(min).max(max).nullable().optional().transform(v => v ?? null);

export const EntwurfSchema = z.object({
  /* 1 Absicht */
  trans: z.enum(["sale", "rent"]).nullable().optional().transform(v => v ?? null),
  /* 2 Objektart */
  typ: z.enum(TYPEN as [Typ, ...Typ[]]).nullable().optional().transform(v => v ?? null),
  /* 3 Lage — strukturiert über den Ortsindex, nie als freier Text (§28) */
  ortId: z.string().regex(/^ort-[a-z0-9-]{1,40}$/).nullable().optional().transform(v => v ?? null),
  /* Strasse und Nummer bleiben privat und unbestätigt: es gibt keinen
     Adressdienst, der sie prüfen könnte (§29). Sie verlassen den Server nie. */
  strasse: z.string().trim().max(120).nullable().optional().transform(v => v ?? null),
  hausnummer: z.string().trim().max(20).nullable().optional().transform(v => v ?? null),
  /* Wie genau die Lage öffentlich wird. «exakt» ist gesperrt, solange keine
     geprüfte Adresse vorliegt — wir behaupten keine Präzision, die wir nicht
     haben (§29/§30). Der öffentliche Punkt entsteht serverseitig. */
  genauigkeit: z.enum(["ungefaehr", "gemeinde"]).default("ungefaehr"),
  /* 4 Fakten */
  zimmer: zahl(0.5, 30), flaeche: zahl(1, 100000), nutzflaeche: zahl(1, 100000), grundstueck: zahl(1, 10_000_000),
  baujahr: zahl(1000, 2100), etage: zahl(-3, 60), geschosse: zahl(1, 60),
  schlafzimmer: zahl(0, 40), badezimmer: zahl(0, 40),
  /* 5 Preis (in Franken; der Server rechnet in Rappen) */
  preis: zahl(0, 100_000_000), preisAufAnfrage: z.boolean().default(false),
  nebenkosten: zahl(0, 100_000), kaution: zahl(0, 1_000_000),
  sofortVerfuegbar: z.boolean().default(false), verfuegbarAb: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().transform(v => v ?? null),
  /* 6 Text — in der Sprache, in der die Person schreibt (§55) */
  titel: z.string().trim().max(70).nullable().optional().transform(v => v ?? null),
  beschreibung: z.string().trim().max(4000).nullable().optional().transform(v => v ?? null),
  sprache: z.enum(["de", "fr", "it", "en"]).default("de"),
  /* 7 Merkmale und Bilder */
  merkmale: z.array(z.enum(FEATURES)).max(18).default([]),
  bilder: z.array(z.string().uuid()).max(20).default([]),
  /* 8 Kontakt */
  name: z.string().trim().max(120).nullable().optional().transform(v => v ?? null),
  email: z.string().trim().toLowerCase().max(200).nullable().optional().transform(v => v ?? null),
  telefon: z.string().trim().max(40).nullable().optional().transform(v => v ?? null)
}).strict();

export type Entwurf = z.infer<typeof EntwurfSchema>;
export const LEERER_ENTWURF: Entwurf = EntwurfSchema.parse({});

export const SCHRITTE = ["absicht", "typ", "ort", "fakten", "preis", "text", "bilder", "kontakt", "pruefen"] as const;
export type Schritt = (typeof SCHRITTE)[number];

/* ---------- Vollständigkeit ----------
   Welche Angaben ein Inserat braucht, hängt von der Objektart ab. Die Regeln
   sind die des P4-Assistenten, ergänzt um das, was das Produktionsmodell
   verlangt (Ort als Entität, Kontakt). Fehlt etwas, nennt die Funktion Feld
   und Schritt — die Oberfläche springt dorthin, die Einreichung wird
   abgelehnt (§38/§39). */
export const OHNE_ZIMMER: Typ[] = ["grundstueck", "parkplatz", "gewerbe", "mfh"];
export const OHNE_WOHNFLAECHE: Typ[] = ["grundstueck", "parkplatz"];
export const MIT_ETAGE: Typ[] = ["wohnung", "gewerbe"];

export interface Mangel { feld: string; schritt: Schritt; }

export function fehlend(d: Entwurf): Mangel[] {
  const m: Mangel[] = [];
  const fehlt = (feld: string, schritt: Schritt) => m.push({ feld, schritt });

  if (!d.trans) fehlt("trans", "absicht");
  if (!d.typ) fehlt("typ", "typ");
  if (!d.ortId) fehlt("ortId", "ort");

  if (d.typ && !OHNE_WOHNFLAECHE.includes(d.typ) && (d.flaeche == null || d.flaeche < 8)) fehlt("flaeche", "fakten");
  if (d.typ === "grundstueck" && (d.grundstueck == null || d.grundstueck < 1)) fehlt("grundstueck", "fakten");
  if (d.typ && !OHNE_ZIMMER.includes(d.typ) && d.zimmer == null) fehlt("zimmer", "fakten");

  if (!d.preisAufAnfrage && (d.preis == null || d.preis <= 0)) fehlt("preis", "preis");

  if (!d.titel || d.titel.length < 8) fehlt("titel", "text");
  if (!d.beschreibung || d.beschreibung.length < 30) fehlt("beschreibung", "text");

  if (!d.name) fehlt("name", "kontakt");
  if (!d.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) fehlt("email", "kontakt");

  /* Mindestens ein Bild: ein Inserat ohne Bild fällt im Marktplatz durch —
     die Ergebniskarte lebt vom Foto. */
  if (d.bilder.length < 1) fehlt("bilder", "bilder");
  return m;
}

export const istVollstaendig = (d: Entwurf) => fehlend(d).length === 0;

/* Welche Felder ein Schritt zeigt — für die Sprungmarke bei Mängeln. */
export function schrittFuer(feld: string): Schritt {
  const s: Record<string, Schritt> = { trans: "absicht", typ: "typ", ortId: "ort", strasse: "ort", genauigkeit: "ort",
    flaeche: "fakten", zimmer: "fakten", grundstueck: "fakten", baujahr: "fakten", etage: "fakten",
    preis: "preis", preisAufAnfrage: "preis", nebenkosten: "preis",
    titel: "text", beschreibung: "text", bilder: "bilder", merkmale: "bilder",
    name: "kontakt", email: "kontakt", telefon: "kontakt" };
  return s[feld] ?? "pruefen";
}

/* Titel für die Liste «Meine Inserate», solange die Person noch keinen
   geschrieben hat. */
export function arbeitstitel(d: Entwurf, ortLabel: string | null, t: (k: string) => string): string {
  if (d.titel) return d.titel;
  const teile = [d.typ ? t("w_typ_" + d.typ) : null, ortLabel].filter(Boolean);
  return teile.length ? teile.join(" · ") : t("w_neuerEntwurf");
}

/* Die Sprache, in der der Inhalt verfasst wurde — nie geraten, nie automatisch
   übersetzt (§55). Die Oberfläche ist in vier Sprachen; der Inseratstext
   bleibt, wie er eingegeben wurde. */
export const inhaltsSprache = (d: Entwurf): Locale => d.sprache;
