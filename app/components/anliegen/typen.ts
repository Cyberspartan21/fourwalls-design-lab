import type { Typ } from "@/domain/marktplatz";

/* Gemeinsame Client-Typen für die fünf Anliegen-Formulare — Spiegel des
   Serververtrags aus dem Auftrag (POST /api/anliegen), rein für die
   Oberfläche. Die verbindliche Prüfung liegt beim Server (domain/anliegen.ts,
   parallel gebaut); hier zählt nur, was der Assistent braucht, um ein
   plausibles Objekt zu bauen und Fehler wieder den richtigen Feldern
   zuzuordnen. */

export type Dienst = "sell" | "let" | "valuation" | "property_management" | "owner_consultation";
export type Kanal = "email" | "phone" | "whatsapp";
export type Wunschfenster = "morning" | "afternoon" | "evening";
export type Zustand = "new" | "good" | "renovation_needed" | "unknown";
export type Belegung = "owner" | "rented" | "vacant" | "unknown";
export type Zeitpunkt = "asap" | "3m" | "6m" | "12m" | "unsure";
export type Leistung = "tenant_search" | "full_management" | "accounting" | "maintenance" | "advice";

/* Die Schritte, aus denen sich die Reihenfolge je Dienst zusammensetzt.
   "situation" ist nur bei sell/let/property_management ein eigener Schritt;
   bei valuation gehört ihr einziges Feld (Nachricht) zum Objekt-Schritt, bei
   owner_consultation (nur Nachricht) zum Kontakt-Schritt — so bleibt die
   Anzahl sichtbarer Schritte genau die im Auftrag verlangte. */
export type Schritt = "objekt" | "situation" | "kontakt" | "pruefen";

export const SCHRITTE_JE_DIENST: Record<Dienst, Schritt[]> = {
  sell: ["objekt", "situation", "kontakt", "pruefen"],
  let: ["objekt", "situation", "kontakt", "pruefen"],
  property_management: ["objekt", "situation", "kontakt", "pruefen"],
  valuation: ["objekt", "kontakt", "pruefen"],
  owner_consultation: ["kontakt", "pruefen"]
};

export interface KontaktDaten {
  name: string;
  email: string;
  telefon: string;
  kanal: Kanal;
  wunschdatum: string;
  wunschfenster: Wunschfenster | "";
}
export const LEERER_KONTAKT: KontaktDaten = { name: "", email: "", telefon: "", kanal: "email", wunschdatum: "", wunschfenster: "" };

export interface ObjektDaten {
  ortId: string | null;
  /* Nur zur Anzeige in der Prüfen-Ansicht — geht nicht an den Server. */
  ortLabel: string;
  typ: Typ | null;
  zimmer: string;
  flaeche: string;
  grundstueck: string;
  baujahr: string;
  einheiten: string;
  zustand: Zustand | "";
  belegung: Belegung | "";
  zeitpunkt: Zeitpunkt | "";
  bereitsInseriert: boolean | null;
  andererMakler: boolean | null;
  leistungen: Leistung[];
  inseratRef: string;
  nachricht: string;
}
export const LEERES_OBJEKT: ObjektDaten = {
  ortId: null, ortLabel: "", typ: null, zimmer: "", flaeche: "", grundstueck: "", baujahr: "",
  einheiten: "", zustand: "", belegung: "", zeitpunkt: "", bereitsInseriert: null, andererMakler: null,
  leistungen: [], inseratRef: "", nachricht: ""
};

export const ZUSTAENDE: Zustand[] = ["new", "good", "renovation_needed", "unknown"];
export const BELEGUNGEN: Belegung[] = ["owner", "rented", "vacant", "unknown"];
export const ZEITPUNKTE: Zeitpunkt[] = ["asap", "3m", "6m", "12m", "unsure"];
export const LEISTUNGEN_LET: Leistung[] = ["tenant_search", "full_management", "advice"];
export const LEISTUNGEN_PM: Leistung[] = ["full_management", "accounting", "maintenance", "advice"];

/* Objekt braucht sell/let/valuation Ort+Typ, property_management nur Ort,
   owner_consultation gar kein Objekt (§Vertrag). */
export function objektPflichtig(dienst: Dienst): boolean {
  return dienst !== "owner_consultation";
}
export function typPflichtig(dienst: Dienst): boolean {
  return dienst === "sell" || dienst === "let" || dienst === "valuation";
}
