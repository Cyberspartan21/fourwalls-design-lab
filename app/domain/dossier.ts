/* Anzeigemodell der Objektseite — aus dem Domänenobjekt gebaut.

   Der Grundsatz aus P1 steht hier als Code: Blöcke ohne Inhalt entstehen gar
   nicht. `abschnitte` enthält nur, was auch etwas zeigt; die Ankernavigation
   folgt daraus. Die Komponenten prüfen nichts mehr selbst — sie zeichnen, was
   hier steht. Das lässt sich ohne Browser prüfen (tests/dossier.test.mjs). */

import type { ListingDetail, Sections } from "./listing";
import type { Locale, T } from "@/i18n";
import { chf, zahl } from "@/i18n";
import { finanz } from "./listing";

export type AbschnittId = "uebersicht" | "bilder" | "eckdaten" | "grundrisse" | "lage" | "finanzierung" | "dokumente" | "fragen" | "kontakt" | "aehnliche";

export interface Abschnitt { id: AbschnittId; titel: string; klein?: string }

export interface Eck { wert: string; label: string }
export interface Fakt { label: string; wert: string }
export interface Gruppe { titel: string; zeilen: Fakt[] }

export interface Dossier {
  detail: ListingDetail;
  preis: string;                 // «CHF 5’480’000.–» oder «Preis auf Anfrage»
  preisNebenzeile: string | null; // «18’960 CHF/m²» oder Nebenkosten bei Miete
  monatlich: { total: string } | null;
  verfuegbar: string;
  typ: string;
  eck: Eck[];
  fakten: Fakt[];
  gruppen: Gruppe[];
  geakKlasse: string | null;
  kategorien: string[];          // Bildkategorien, die vorkommen
  abschnitte: Abschnitt[];
  /* Sichtbarkeitsentscheide, die die Seite braucht */
  zeigeMedienAbschnitt: boolean;
  zeigeLageDossier: boolean;
}

const LABEL_GRUPPEN = {
  gebaeude:   ["o_secGebaeude",  { bauweise: "o_lgBauweise", dach: "o_lgDach", fenster: "o_lgFenster", zustand: "o_lgZustand", ausrichtung: "o_lgAusrichtung", volumen: "o_lgVolumen", qualitaet: "o_lgQualitaet" }],
  ausstattung:["ausstattung",    { kueche: "o_laKueche", baeder: "o_laBaeder", boeden: "o_laBoeden", geraete: "o_laGeraete", waschen: "o_laWaschen", cheminee: "o_laCheminee", lift: "o_laLift", smarthome: "o_laSmarthome", stauraum: "o_laStauraum" }],
  aussen:     ["o_secAussen",    { balkon: "o_loBalkon", terrasse: "o_loTerrasse", garten: "o_loGarten", pool: "o_loPool", aussicht: "o_loAussicht", privatsphaere: "o_loPrivatsphaere" }],
  parkieren:  ["o_secParkieren", { garage: "o_lpGarage", tiefgarage: "o_lpTiefgarage", aussenplaetze: "o_lpAussenplaetze", ladestation: "o_lpLadestation" }],
  energie:    ["o_secEnergie",   { heizung: "o_leHeizung", energietraeger: "o_leEnergietraeger", verteilung: "o_leVerteilung", photovoltaik: "o_lePhotovoltaik", geak: "o_leGeak", minergie: "o_leMinergie" }]
} as const;

function gruppe(t: T, titelKey: string, obj: Record<string, string | number | boolean> | undefined, labels: Record<string, string>): Gruppe | null {
  if (!obj) return null;
  const zeilen = Object.entries(obj)
    .filter(([k, v]) => v !== null && v !== undefined && v !== "" && v !== false && k !== "geakKlasse")
    .map(([k, v]) => ({ label: t(labels[k] ?? k), wert: v === true ? "Ja" : String(v) }));
  return zeilen.length ? { titel: t(titelKey), zeilen } : null;
}

export function etageText(floor: number, locale: Locale, t: T): string {
  if (floor === 0) return t("o_egKurz");
  if (locale === "fr") return floor + (floor === 1 ? "er" : "e") + " étage";
  if (locale === "it") return floor + "° piano";
  if (locale === "en") return floor + (floor === 1 ? "st" : floor === 2 ? "nd" : floor === 3 ? "rd" : "th") + " floor";
  return floor + ". OG";
}

export function verfuegbarLabel(d: ListingDetail, t: T): string {
  if (d.status === "reserved") return t("reserviert");
  if (d.availableImmediately) return t("sofort");
  if (d.availableFrom) return `${t("abDatum")} ${d.availableFrom}`;
  return t("nachVereinbarung");
}

export function baueDossier(d: ListingDetail, t: T, locale: Locale, typ: string, aehnlicheAnzahl = 0): Dossier {
  const s: Sections = d.sections;
  const p = d.property;
  const miete = d.transaction === "rent";

  const preis = d.priceOnRequest ? t("aufAnfrage")
    : miete ? (d.rentNetChf != null ? chf(d.rentNetChf) + " " + t("proMonat") : t("aufAnfrage"))
    : (d.priceChf != null ? chf(d.priceChf) : t("aufAnfrage"));
  /* CHF/m² wie im Prototyp: nur Kauf + Wohnfläche, auf 100 gerundet */
  const m2 = !miete && d.priceChf && p.livingAreaM2 && !d.priceOnRequest ? Math.round(d.priceChf / 100 / p.livingAreaM2 / 100) * 100 : null;
  const preisNebenzeile = miete
    ? (d.rentExtraChf != null ? `+ ${chf(d.rentExtraChf)} ${t("nebenkosten")}` : null)
    : (m2 ? `${zahl(m2)} ${t("proM2")}` : null);
  /* Monatliche Kosten nur bei Kauf eines Wohnobjekts mit Preis — wie monatlichMoeglich() im Prototyp */
  const wohnobjekt = ["apartment", "house", "villa", "chalet", "multi_family"].includes(p.kind);
  const monatlich = !miete && d.priceChf && !d.priceOnRequest && wohnobjekt
    ? { total: "CHF " + zahl(finanz(d.priceChf, 0.2, 0.019).total) } : null;
  const verfuegbar = verfuegbarLabel(d, t);

  const eck: Eck[] = [
    p.rooms != null ? { wert: String(p.rooms), label: t("o_fZimmer") } : null,
    p.livingAreaM2 != null ? { wert: p.livingAreaM2 + " m²", label: t("o_fWohnflaeche") } : null,
    p.plotAreaM2 != null ? { wert: p.plotAreaM2 + " m²", label: t("o_fGrundstueck") } : null,
    p.builtYear != null ? { wert: String(p.builtYear), label: t("o_fBaujahr") } : null,
    { wert: verfuegbar, label: t("verfuegbar") }
  ].filter((x): x is Eck => x !== null);

  const fakten: Fakt[] = [
    { label: t("o_fPreis"), wert: preis },
    p.rooms != null ? { label: t("o_fZimmer"), wert: String(p.rooms) } : null,
    p.livingAreaM2 != null ? { label: t("o_fWohnflaeche"), wert: p.livingAreaM2 + " m²" } : null,
    p.usableAreaM2 != null ? { label: t("o_fNutzflaeche"), wert: p.usableAreaM2 + " m²" } : null,
    p.plotAreaM2 != null ? { label: t("o_fGrundstueck"), wert: p.plotAreaM2 + " m²" } : null,
    p.bedrooms != null ? { label: t("o_fSchlafzimmer"), wert: String(p.bedrooms) } : null,
    p.bathrooms != null ? { label: t("o_fBadezimmer"), wert: String(p.bathrooms) } : null,
    p.builtYear != null ? { label: t("o_fBaujahr"), wert: String(p.builtYear) } : null,
    p.renovatedYear != null ? { label: t("o_fRenovation"), wert: String(p.renovatedYear) } : null,
    p.floorsTotal != null ? { label: t("o_fGeschosse"), wert: String(p.floorsTotal) } : null,
    p.ceilingHeightM != null ? { label: t("o_fRaumhoehe"), wert: p.ceilingHeightM + " m" } : null,
    p.volumeM3 != null ? { label: t("o_fKubatur"), wert: zahl(p.volumeM3) + " m³" } : null,
    p.floor != null && p.floorsTotal == null ? { label: t("o_fEtage"), wert: etageText(p.floor, locale, t) } : null,
    m2 ? { label: t("proM2"), wert: zahl(m2) } : null,
    { label: t("verfuegbar"), wert: verfuegbar },
    { label: t("o_fReferenz"), wert: d.publicRef }
  ].filter((x): x is Fakt => x !== null);

  const gruppen = (Object.entries(LABEL_GRUPPEN) as [keyof typeof LABEL_GRUPPEN, readonly [string, Record<string, string>]][])
    .map(([k, [titelKey, labels]]) => gruppe(t, titelKey, s[k] as Record<string, string | number | boolean> | undefined, labels))
    .filter((g): g is Gruppe => g !== null);

  const geakKlasse = s.energie?.geakKlasse ?? null;
  const kategorien = ["alle", ...Array.from(new Set(d.images.map(b => b.category).filter((c): c is NonNullable<typeof c> => !!c)))];
  const med = s.medien ?? {};
  const zeigeMedienAbschnitt = d.images.length > 3 || !!med.video || !!med.tour360;
  const zeigeLageDossier = !!s.lage;

  const absaetzeDa = (s.story?.absaetze?.length ?? 0) > 0 || !!d.description;
  const hlDa = (s.highlights?.length ?? 0) > 0;
  const abschnitte: Abschnitt[] = [];
  const add = (id: AbschnittId, titel: string, da: boolean, klein?: string) => { if (da) abschnitte.push(klein ? { id, titel, klein } : { id, titel }); };
  add("uebersicht", t("o_secUebersicht"), absaetzeDa || hlDa);
  add("bilder", t("bilderMedien"), zeigeMedienAbschnitt, bildLabel(d.images.length, t));
  add("eckdaten", t("o_secEckdaten"), true);
  add("grundrisse", t("o_secGrundrisse"), d.floorplans.length > 0);
  add("lage", t("o_secLage"), true);
  add("finanzierung", t("o_secFinanzierung"), !!monatlich, t("o_secRichtwerte"));
  add("dokumente", t("o_secDokumente"), d.documents.length > 0);
  add("fragen", t("o_secFragen"), (s.faq?.length ?? 0) > 0);
  add("kontakt", t("o_secKontakt"), true);
  add("aehnliche", t("o_secAehnliche"), aehnlicheAnzahl > 0);

  return { detail: d, preis, preisNebenzeile, monatlich, verfuegbar, typ, eck, fakten, gruppen, geakKlasse, kategorien, abschnitte, zeigeMedienAbschnitt, zeigeLageDossier };
}

export const bildLabel = (n: number, t: T) => `${n} ${n === 1 ? t("bild1") : t("bildN")}`;
