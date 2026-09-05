/* Fachliche Darstellung eines Inserats — was die Anwendung kennt, unabhängig
   davon, wie die Datenbank es speichert und wie die Seite es zeigt.

   Drei Schichten, drei Formen (Auftrag §23):
     Datenbankzeile  → server/listings.ts liest sie und baut daraus …
     Domänenobjekt   → diese Datei
     Anzeigemodell   → domain/dossier.ts baut daraus, was die Seite braucht

   Keine Komponente kennt Tabellenspalten. */

import type { Locale } from "@/i18n";

export type Transaction = "sale" | "rent";
export type PropertyKind = "apartment" | "house" | "villa" | "chalet" | "multi_family" | "commercial" | "land" | "parking";
export type GeoPrecision = "exact" | "approximate" | "municipality";
export type PublisherKind = "private_person" | "fourwalls" | "agency" | "developer" | "property_manager" | "institutional";
export type DocumentAccess = "public" | "authenticated" | "on_request" | "after_viewing" | "qualified" | "internal";
export type ImageCategory = "aussen" | "wohnen" | "kueche" | "schlafen" | "bad" | "lage" | "plan";

/* Was den Server verlässt: die öffentliche Lage. Nie die exakte. */
export interface PublicGeo {
  lng: number;
  lat: number;
  precision: GeoPrecision;
  radiusM: number;
}

/* Ein Bild, wie die Oberfläche es braucht — ohne Wissen über den Speicher. */
export interface Media {
  key: string;
  alt: string;
  category: ImageCategory | null;
  /* Quellen nach Format, je Breite eine Adresse. Aus dem StorageProvider. */
  sources: { webp: MediaSource[]; jpeg: MediaSource[] };
}
export interface MediaSource { width: number; url: string }

export interface Floorplan { level: string; areaM2: number | null; access: DocumentAccess; file?: string; rooms: { name: string; m2: number | null }[] }
export interface ListingDocument { name: string; type: string; pages: number | null; sizeLabel?: string; access: DocumentAccess; hint?: string; url?: string }
export interface Feature { key: string; label: string }

export interface Publisher {
  kind: PublisherKind;
  orgName: string | null;
  orgVerified: boolean;
  /* Der Slug der herausgebenden Organisation — für den Link zum öffentlichen
     Anbieterprofil (P5.7). null bei Privatinseraten oder Fourwalls-Mandaten
     ohne eigenes Profil. */
  orgSlug: string | null;
  personName: string | null;
  personTitle: string | null;
  phone: string | null;
  /* «Fourwalls vertritt die Verkäuferschaft» — die Aussage aus P1, als Tatsache
     aus der Datenbank (represented_by), nicht aus der Gestaltung. */
  representedByFourwalls: boolean;
}

/* Redaktionelle Abschnitte — Struktur wie das P1-Dossier. Alle optional:
   fehlt einer, fehlt der Abschnitt auf der Seite. */
export interface Sections {
  story?: { titel: string; absaetze: string[] };
  highlights?: string[];
  gebaeude?: Record<string, string | number | boolean>;
  ausstattung?: Record<string, string | number | boolean>;
  energie?: Record<string, string | number | boolean> & { geakKlasse?: string };
  aussen?: Record<string, string | number | boolean>;
  parkieren?: Record<string, string | number | boolean>;
  medien?: {
    video?: { titel?: string; dauer?: string; hinweis?: string };
    tour360?: { titel?: string; raeume?: number; hinweis?: string };
    modell3d?: { titel?: string; hinweis?: string };
    sonne?: { ausrichtung: string; hauptraeume: string; sonnenstunden: string; grundlage: string };
  };
  lage?: {
    beschreibung?: string; gemeinde?: string; quartier?: string; charakter?: string; steuerfuss?: string;
    oev?: Poi[]; schulen?: Poi[]; einkauf?: Poi[]; gesundheit?: Poi[]; freizeit?: Poi[]; verkehr?: Poi[];
    fahrzeiten?: { ziel: string; zeit: string }[];
  };
  finanzen?: { nebenkosten?: string; preisM2Kontext?: string };
  faq?: { frage: string; antwort: string }[];
  naechsteSchritte?: string[];
}
export interface Poi { name: string; distanz?: string; zeit?: string }

export interface PropertyFacts {
  kind: PropertyKind;
  rooms: number | null;
  livingAreaM2: number | null;
  usableAreaM2: number | null;
  plotAreaM2: number | null;
  volumeM3: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  floorsTotal: number | null;
  builtYear: number | null;
  renovatedYear: number | null;
  ceilingHeightM: number | null;
  postalCode: string;
  city: string;
  canton: string;
}

export interface ListingDetail {
  publicRef: string;
  slug: string;
  transaction: Transaction;
  status: "published" | "reserved";
  isDemo: boolean;
  isExclusive: boolean;
  locale: Locale;             // Sprache, in der der Inhalt geliefert wird
  contentLocale: Locale;      // Sprache, in der der Inhalt verfasst wurde
  title: string;
  tagline: string | null;
  description: string | null;
  priceChf: number | null;    // Rappen
  rentNetChf: number | null;
  rentExtraChf: number | null;
  priceOnRequest: boolean;
  availableFrom: string | null;
  availableImmediately: boolean;
  publishedAt: string;
  geo: PublicGeo | null;
  property: PropertyFacts;
  publisher: Publisher;
  images: Media[];
  floorplans: Floorplan[];
  documents: ListingDocument[];
  features: Feature[];
  sections: Sections;
}

/* Der Anteil eines Kaufpreises, den die Bankenpraxis als Eigenmittel, Zins,
   Amortisation und Unterhalt rechnet — unverändert aus objekt.js. */
export function finanz(preisRappen: number, ekAnteil: number, zins: number) {
  const preis = preisRappen / 100;
  const ek = preis * ekAnteil, hyp = preis - ek, hyp2 = Math.max(0, hyp - preis * 0.65);
  const zinsM = hyp * zins / 12, amortM = hyp2 / 15 / 12, unterhM = preis * 0.01 / 12;
  const kalk = hyp * 0.05 / 12 + amortM + unterhM;
  const r = (n: number) => Math.round(n / 10) * 10;
  return { ek: r(ek), hyp: r(hyp), belehnung: Math.round(hyp / preis * 100), zinsM: r(zinsM), amortM: r(amortM),
    unterhM: r(unterhM), total: r(zinsM + amortM + unterhM), einkommen: r(kalk * 12 / 0.33) };
}
