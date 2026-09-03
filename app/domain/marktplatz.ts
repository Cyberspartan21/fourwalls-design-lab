/* Marktplatz-Vokabular: der P3-Suchvertrag in Typen.

   Die Oberfläche (Karten, Karte, Chips) spricht die Begriffe des Prototyps —
   buy/rent, wohnung/haus…, privat/agentur/… — und muss nichts umlernen. Die
   Datenbank spricht sale/rent, apartment/house…, private_person/agency…
   Übersetzt wird genau hier, in eine Richtung pro Tabelle. Die Zusammenfassung
   (Suchtreffer) ist bewusst schlank: was Liste und Karte brauchen, nichts,
   was nur die Objektseite braucht. */

import type { PropertyKind, PublisherKind, Transaction } from "./listing";

export type Trans = "buy" | "rent";
export type Typ = "wohnung" | "haus" | "villa" | "chalet" | "mfh" | "gewerbe" | "grundstueck" | "parkplatz";
export type Quelle = "privat" | "agentur" | "verwaltung" | "entwickler" | "fourwalls";
export type Tier = "standard" | "verified" | "exclusive";
export type VerfArt = "sofort" | "datum" | "vereinbarung" | "reserviert" | "verkauft" | "vermietet";
export type Genauigkeit = "exakt" | "ungefaehr" | "gemeinde";
export type Sort = "empfohlen" | "neu" | "preis-auf" | "preis-ab" | "m2" | "flaeche" | "zimmer";
export type Etage = "" | "eg" | "nichteg" | "ab2" | "dach";
export type Verf = "" | "sofort" | "3mt";
export type OrtTyp = "ort" | "plz" | "kanton" | "region";

export const TYPEN: Typ[] = ["wohnung", "haus", "villa", "chalet", "mfh", "gewerbe", "grundstueck", "parkplatz"];
export const QUELLEN: Quelle[] = ["privat", "agentur", "verwaltung", "entwickler", "fourwalls"];
export const SORTS: Sort[] = ["empfohlen", "neu", "preis-auf", "preis-ab", "m2", "flaeche", "zimmer"];
export const FEATURES = ["balcony", "terrace", "garden", "parking", "garage", "lift", "lakeview", "mountainview", "fireplace", "parquet", "floorheating", "minergie", "cellar", "washtower", "pool", "sauna", "evcharging", "concierge"] as const;
export type Feature = (typeof FEATURES)[number];
export const UMKREISE = [0, 5, 10, 20, 30, 50] as const;

export const TYP_ZU_KIND: Record<Typ, PropertyKind> = { wohnung: "apartment", haus: "house", villa: "villa", chalet: "chalet", mfh: "multi_family", gewerbe: "commercial", grundstueck: "land", parkplatz: "parking" };
export const KIND_ZU_TYP: Record<PropertyKind, Typ> = { apartment: "wohnung", house: "haus", villa: "villa", chalet: "chalet", multi_family: "mfh", commercial: "gewerbe", land: "grundstueck", parking: "parkplatz" };
export const QUELLE_ZU_KIND: Record<Quelle, PublisherKind[]> = { privat: ["private_person"], agentur: ["agency", "institutional"], verwaltung: ["property_manager"], entwickler: ["developer"], fourwalls: ["fourwalls"] };
export const KIND_ZU_QUELLE: Record<PublisherKind, Quelle> = { private_person: "privat", agency: "agentur", institutional: "agentur", property_manager: "verwaltung", developer: "entwickler", fourwalls: "fourwalls" };
export const TRANS_ZU_DB: Record<Trans, Transaction> = { buy: "sale", rent: "rent" };
export const DB_ZU_TRANS: Record<Transaction, Trans> = { sale: "buy", rent: "rent" };

/* Etage nur bei Objekten mit Geschosslage; Grundstück nicht bei Wohnung/Parkplatz */
export const hatEtage = (t: Typ | "") => t === "wohnung" || t === "gewerbe";
export const hatGrundstueck = (t: Typ | "") => t !== "wohnung" && t !== "parkplatz";
/* CHF/m² nur wo aussagekräftig: Kauf + Wohnfläche + Wohnobjekt, auf 100 gerundet */
export const WOHNOBJEKTE: Typ[] = ["wohnung", "haus", "villa", "chalet"];
export function proM2(t: { transactionType: Trans; priceOnRequest: boolean; price: number | null; livingArea: number | null; propertyType: Typ }): number | null {
  if (t.transactionType !== "buy" || t.priceOnRequest || !t.price || !t.livingArea) return null;
  if (!WOHNOBJEKTE.includes(t.propertyType)) return null;
  return Math.round(t.price / t.livingArea / 100) * 100;
}
export const verfuegbarFrei = (art: VerfArt) => !["reserviert", "verkauft", "vermietet"].includes(art);

/* ---------- Anfrage (SearchQuery) ---------- */
export interface Ort { typ: OrtTyp; id: string; label: string }
export interface Bounds { n: number; s: number; o: number; w: number }
export interface Suchanfrage {
  trans: Trans; ort: string | null; umkreisKm: number; bounds: Bounds | null;
  typ: Typ | ""; pMin: number | null; pMax: number | null; ziMin: number | null; ziMax: number | null;
  flMin: number | null; flMax: number | null; grMin: number | null; bjVon: number | null; bjBis: number | null;
  etage: Etage; verf: Verf; feat: Feature[]; quelle: Quelle | ""; nurFrei: boolean;
  sort: Sort; seite: number; proSeite: number; modus: "list" | "map";
  ref?: string | null;   // einzelnes Inserat als Zusammenfassung (Kartenvorschau)
}
export const LEER: Suchanfrage = {
  trans: "buy", ort: null, umkreisKm: 0, bounds: null, typ: "", pMin: null, pMax: null, ziMin: null, ziMax: null,
  flMin: null, flMax: null, grMin: null, bjVon: null, bjBis: null, etage: "", verf: "", feat: [], quelle: "", nurFrei: true,
  sort: "neu", seite: 1, proSeite: 24, modus: "list"
};

/* ---------- Treffer: schlanke Zusammenfassung (Feldnamen wie im Prototyp) ---------- */
export interface Treffer {
  id: string;                 // öffentliche Referenz FWL-…, die eine Identität überall
  slug: string;               // Routen-Segment: <slug>-<ref>
  transactionType: Trans; propertyType: Typ; title: string;
  city: string; postalCode: string; canton: string;
  lat: number | null; lng: number | null; genauigkeitM: number; genauigkeit: Genauigkeit;
  price: number | null; priceOnRequest: boolean; rentNet: number | null; rentNK: number | null;   // CHF, nicht Rappen
  rooms: number | null; livingArea: number | null; plotArea: number | null; floor: number | null; yearBuilt: number | null;
  bild: { webp: { width: number; url: string }[]; jpeg: { width: number; url: string }[] } | null;   // Adressen baut der Speicheranbieter (Server)
  listingSource: Quelle; listingTier: Tier; verificationStatus: "verified" | "none";
  availability: { art: VerfArt; datum: string | null };
  neu: boolean; fw: boolean;
  publishedAt: string;
}
/* Punkt für die Karte: nur, was karte.js für Preisschild, Farbe und Auswahl braucht */
export interface Punkt { id: string; slug: string; lat: number; lng: number; transactionType: Trans; price: number | null; rentNet: number | null; priceOnRequest: boolean; listingTier: Tier; availability: { art: VerfArt } }

export interface GeoAntwort { interpretation: "schweiz" | "ausschnitt" | "umkreis" | "region" | "kanton" | "plz" | "gemeinde"; mittelpunkt: { lat: number; lng: number } | null; umkreisKm: number; bounds: [number, number, number, number] | null; label: string | null; ortId: string | null }
export interface Suchergebnis {
  treffer: Treffer[]; total: number; seite: number; proSeite: number; hatMehr: boolean;
  geo: GeoAntwort; facetten: { typ: Record<string, number>; quelle: Record<string, number> };
  punkte?: Punkt[]; dauerMs: number; quelle: "server";
}

/* Preisschild für die Karte — wie kurzPreis() in karte.js */
export function kurzPreis(t: Pick<Treffer, "transactionType" | "price" | "rentNet" | "priceOnRequest">): string {
  const w = t.transactionType === "rent" ? t.rentNet : t.price;
  if (t.priceOnRequest || w == null) return "a. A.";
  if (t.transactionType === "rent") return Math.round(w / 10) * 10 + ".–";
  if (w >= 1e6) return (w / 1e6).toFixed(w >= 1e7 ? 0 : 2).replace(/\.?0+$/, "") + " Mio.";
  return Math.round(w / 1000) + "k";
}
