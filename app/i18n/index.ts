/* Übersetzungen: die 437 Schlüssel aus P5.1, nach Bereichen getrennt.

   Bewusst ohne Bibliothek. Der Bedarf ist ein flacher Schlüssel je Sprache mit
   Rückfall auf Deutsch — exakt das Verhalten des Prototyps (`t()` in core.js),
   damit sich beim Umzug kein Text ändert. Kommen Pluralformen oder ICU-Muster
   dazu, ist der Wechsel auf eine Bibliothek an dieser einen Stelle möglich. */

import de_common from "./messages/de/common.json";
import de_navigation from "./messages/de/navigation.json";
import de_search from "./messages/de/search.json";
import de_property from "./messages/de/property.json";
import de_listing from "./messages/de/listing.json";
import de_account from "./messages/de/account.json";
import fr_common from "./messages/fr/common.json";
import fr_navigation from "./messages/fr/navigation.json";
import fr_search from "./messages/fr/search.json";
import fr_property from "./messages/fr/property.json";
import fr_listing from "./messages/fr/listing.json";
import fr_account from "./messages/fr/account.json";
import it_common from "./messages/it/common.json";
import it_navigation from "./messages/it/navigation.json";
import it_search from "./messages/it/search.json";
import it_property from "./messages/it/property.json";
import it_listing from "./messages/it/listing.json";
import it_account from "./messages/it/account.json";
import en_common from "./messages/en/common.json";
import en_navigation from "./messages/en/navigation.json";
import en_search from "./messages/en/search.json";
import en_property from "./messages/en/property.json";
import en_listing from "./messages/en/listing.json";
import en_account from "./messages/en/account.json";

export const LOCALES = ["de", "fr", "it", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";

export const istLocale = (s: string): s is Locale => (LOCALES as readonly string[]).includes(s);

type Katalog = Record<string, string>;

const KATALOGE: Record<Locale, Katalog> = {
  de: { ...de_common, ...de_navigation, ...de_search, ...de_property, ...de_listing, ...de_account },
  fr: { ...fr_common, ...fr_navigation, ...fr_search, ...fr_property, ...fr_listing, ...fr_account },
  it: { ...it_common, ...it_navigation, ...it_search, ...it_property, ...it_listing, ...it_account },
  en: { ...en_common, ...en_navigation, ...en_search, ...en_property, ...en_listing, ...en_account }
};

/* Übersetzer für eine Sprache. Unbekannter Schlüssel → Deutsch → Schlüssel
   selbst, wie im Prototyp: so fällt ein fehlender Text auf, statt zu verschwinden. */
export function uebersetzer(locale: Locale) {
  const k = KATALOGE[locale], de = KATALOGE.de;
  return (key: string): string => k[key] ?? de[key] ?? key;
}
export type T = ReturnType<typeof uebersetzer>;

/* Die sprachabhängigen Pfadwörter — Sprache gehört in die Adresse, nicht in
   einen Cookie. Dieselbe Liegenschaft, vier Adressen, eine Datenbankzeile. */
export const PFAD: Record<Locale, { immobilien: string; kaufen: string; mieten: string }> = {
  de: { immobilien: "immobilien", kaufen: "kaufen",   mieten: "mieten" },
  fr: { immobilien: "immobilier", kaufen: "acheter",  mieten: "louer" },
  it: { immobilien: "immobili",   kaufen: "comprare", mieten: "affittare" },
  en: { immobilien: "properties", kaufen: "buy",      mieten: "rent" }
};

/* Anzahlformate wie im Prototyp: CHF 5’480’000.– mit typografischem Apostroph. */
export const chf = (rappenOderFranken: number, inRappen = true) => {
  const franken = inRappen ? Math.round(rappenOderFranken / 100) : Math.round(rappenOderFranken);
  return "CHF " + String(franken).replace(/\B(?=(\d{3})+(?!\d))/g, "’") + ".–";
};
export const zahl = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "’");
