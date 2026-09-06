/* Beschriftungen des Marktplatzes — reine Funktionen über dem Übersetzer.
   Server und Client nutzen dieselben; der Client bekommt `t` nicht, sondern
   fertige Wörterbücher (`Woerter`), die die Seite einmal serverseitig baut. */
import type { T, Locale } from "@/i18n";
import { chf, zahl } from "@/i18n";
import type { Treffer, Typ, Quelle, Sort, Etage, Verf, Feature } from "@/domain/marktplatz";
import { proM2 as proM2Rechnen } from "@/domain/marktplatz";

export const TYP_KEY: Record<Typ, string> = { wohnung: "w_typWohnung", haus: "w_typHaus", villa: "w_typVilla", chalet: "w_typChalet", mfh: "w_typMfh", gewerbe: "w_typGewerbe", grundstueck: "w_typGrundstueck", parkplatz: "w_typParkplatz" };
export const QUELLE_KEY: Record<Quelle, string> = { fourwalls: "exclusive", privat: "privat", agentur: "makler", verwaltung: "verwaltung", entwickler: "bautraeger" };
export const QUELLE_FILTER_KEY: Record<Quelle, string> = { fourwalls: "w_quellFourwalls", privat: "w_quellPrivat", agentur: "w_quellMakler", verwaltung: "w_quellVerwaltung", entwickler: "w_quellEntwickler" };
export const SORT_KEY: Record<Sort, string> = { empfohlen: "sortEmpfohlen", neu: "neuste", "preis-auf": "preisAuf", "preis-ab": "preisAb", m2: "sortM2", flaeche: "flaeche", zimmer: "zimmer" };
export const ETAGE_KEY: Record<Exclude<Etage, "">, string> = { eg: "eg", nichteg: "nichtEg", ab2: "ab2", dach: "dachgeschoss" };
export const VERF_KEY: Record<Exclude<Verf, "">, string> = { sofort: "sofort", "3mt": "in3Mt" };

/* Alles, was Karten und Steuerung an Text brauchen — einmal je Seite gebaut */
export type Woerter = Record<string, string>;
export function woerter(t: T): Woerter {
  const w: Woerter = {};
  for (const k of ["kaufen", "mieten", "filter", "mehrFilter", "preisChf", "flaecheFilter", "zimmerFilter", "grundFilter", "baujahr", "etage", "verfuegbar", "anbieter", "ausstattung", "statusZeigen", "zuruecksetzen", "anwenden", "treffer", "treffer1", "trefferN", "liste", "karte", "typ", "zimmerAb", "zimmerBis", "keinUmkreis", "km", "weitere", "p_leerH2", "keineTreffer", "suchaboSpeichern", "p_aboZeileB", "p_aboZeileSpan", "sucheSpeichern", "hierSuchen", "autoSuchen", "imAusschnitt", "karteLeerText", "karteFehler", "radiusMehr", "budgetMehr", "filterWeg", "wohnflaeche", "grundVon", "baujahrVon", "baujahrBis", "nk", "proM2", "geprueft", "neu", "exclusive", "merken", "gemerktOk", "o_ziKurz", "k_landWort", "ort", "preisVon", "preisBis", "flaecheVon", "flaecheBis", "artOrt", "artPlz", "artKanton", "artRegion", "nurFourwalls", "schliessen", "aboPrototyp", "aboHinweisDev", "wieSofort", "wieTaeglich", "wieWoechentlich", "sofort", "reserviert", "verkauft", "vermietet", "nachVereinbarung", "abDatum", "aufAnfrage", "proMonat", "privat", "makler", "verwaltung", "bautraeger", "mailFehler", "aehnlicheKeine", "o_secAehnliche", "suchaboTitel", "suchaboMail", "suchaboWie", "abbrechen", "speichern", "suchaboOk", "suchaboKonto", "zeigeAlle", "vg_vergleichen", "vg_imVergleich", "vg_voll"]) w[k] = t(k);
  for (const k of Object.values(TYP_KEY)) w[k] = t(k);
  for (const k of Object.values(QUELLE_FILTER_KEY)) w[k] = t(k);
  for (const k of Object.values(SORT_KEY)) w[k] = t(k);
  for (const k of ["eg", "nichtEg", "ab2", "dachgeschoss", "in3Mt"]) w[k] = t(k);
  return w;
}
/* Merkmalsnamen kommen aus der Tabelle `feature` (vier Sprachen), nicht aus dem Katalog */
export function mitMerkmalen(w: Woerter, zeilen: { key: string; name: string }[]): Woerter {
  for (const z of zeilen) w["feat_" + z.key] = z.name;
  return w;
}

export const typLabel = (w: Woerter, typ: Typ) => w[TYP_KEY[typ]] ?? typ;
export const quelleLabel = (w: Woerter, l: Pick<Treffer, "listingTier" | "listingSource">) => l.listingTier === "exclusive" ? w.exclusive! : (w[QUELLE_KEY[l.listingSource]] ?? l.listingSource);
export const quelleFilterLabel = (w: Woerter, q: Quelle) => w[QUELLE_FILTER_KEY[q]] ?? q;
export const featLabel = (w: Woerter, f: Feature | string) => w["feat_" + f] ?? f;
export const trefferLabel = (w: Woerter, n: number) => `${n} ${n === 1 ? w.treffer1 : w.trefferN}`;
export const chfText = (n: number) => "CHF " + zahl(n);

export function preisText(w: Woerter, l: Pick<Treffer, "transactionType" | "rentNet" | "priceOnRequest" | "price">): string {
  if (l.transactionType === "rent") return l.rentNet != null ? chfText(l.rentNet) + ".– " + w.proMonat : w.aufAnfrage!;
  if (l.priceOnRequest || l.price == null) return w.aufAnfrage!;
  return chfText(l.price) + ".–";
}
export function verfuegbarLabel(w: Woerter, locale: Locale, a: Treffer["availability"]): string {
  if (a.art === "sofort") return w.sofort!;
  if (a.art === "datum" && a.datum) { const d = new Date(a.datum); return w.abDatum + " " + d.toLocaleDateString(locale === "en" ? "en-GB" : locale + "-CH", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  if (a.art === "reserviert") return w.reserviert!;
  if (a.art === "verkauft") return w.verkauft!;
  if (a.art === "vermietet") return w.vermietet!;
  return w.nachVereinbarung!;
}
export const proM2 = proM2Rechnen;
export const fmtIn = (n: number | null) => n == null ? "" : zahl(n);
export { chf };
