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
import de_konto from "./messages/de/konto.json";
import de_favoriten from "./messages/de/favoriten.json";
import de_verlauf from "./messages/de/verlauf.json";
import de_vergleich from "./messages/de/vergleich.json";
import de_anfragen from "./messages/de/anfragen.json";
import de_anbieter from "./messages/de/anbieter.json";
import de_org from "./messages/de/org.json";
import de_anliegen from "./messages/de/anliegen.json";
import de_service from "./messages/de/service.json";
import de_intern from "./messages/de/intern.json";
import fr_common from "./messages/fr/common.json";
import fr_navigation from "./messages/fr/navigation.json";
import fr_search from "./messages/fr/search.json";
import fr_property from "./messages/fr/property.json";
import fr_listing from "./messages/fr/listing.json";
import fr_account from "./messages/fr/account.json";
import fr_konto from "./messages/fr/konto.json";
import fr_favoriten from "./messages/fr/favoriten.json";
import fr_verlauf from "./messages/fr/verlauf.json";
import fr_vergleich from "./messages/fr/vergleich.json";
import fr_anfragen from "./messages/fr/anfragen.json";
import fr_anbieter from "./messages/fr/anbieter.json";
import fr_org from "./messages/fr/org.json";
import fr_anliegen from "./messages/fr/anliegen.json";
import fr_service from "./messages/fr/service.json";
import fr_intern from "./messages/fr/intern.json";
import it_common from "./messages/it/common.json";
import it_navigation from "./messages/it/navigation.json";
import it_search from "./messages/it/search.json";
import it_property from "./messages/it/property.json";
import it_listing from "./messages/it/listing.json";
import it_account from "./messages/it/account.json";
import it_konto from "./messages/it/konto.json";
import it_favoriten from "./messages/it/favoriten.json";
import it_verlauf from "./messages/it/verlauf.json";
import it_vergleich from "./messages/it/vergleich.json";
import it_anfragen from "./messages/it/anfragen.json";
import it_anbieter from "./messages/it/anbieter.json";
import it_org from "./messages/it/org.json";
import it_anliegen from "./messages/it/anliegen.json";
import it_service from "./messages/it/service.json";
import it_intern from "./messages/it/intern.json";
import en_common from "./messages/en/common.json";
import en_navigation from "./messages/en/navigation.json";
import en_search from "./messages/en/search.json";
import en_property from "./messages/en/property.json";
import en_listing from "./messages/en/listing.json";
import en_account from "./messages/en/account.json";
import en_konto from "./messages/en/konto.json";
import en_favoriten from "./messages/en/favoriten.json";
import en_verlauf from "./messages/en/verlauf.json";
import en_vergleich from "./messages/en/vergleich.json";
import en_anfragen from "./messages/en/anfragen.json";
import en_anbieter from "./messages/en/anbieter.json";
import en_org from "./messages/en/org.json";
import en_anliegen from "./messages/en/anliegen.json";
import en_service from "./messages/en/service.json";
import en_intern from "./messages/en/intern.json";

export const LOCALES = ["de", "fr", "it", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";

export const istLocale = (s: string): s is Locale => (LOCALES as readonly string[]).includes(s);

type Katalog = Record<string, string>;

const KATALOGE: Record<Locale, Katalog> = {
  de: { ...de_common, ...de_navigation, ...de_search, ...de_property, ...de_listing, ...de_account, ...de_konto, ...de_favoriten, ...de_verlauf, ...de_vergleich, ...de_anfragen, ...de_anbieter, ...de_org, ...de_anliegen, ...de_service, ...de_intern },
  fr: { ...fr_common, ...fr_navigation, ...fr_search, ...fr_property, ...fr_listing, ...fr_account, ...fr_konto, ...fr_favoriten, ...fr_verlauf, ...fr_vergleich, ...fr_anfragen, ...fr_anbieter, ...fr_org, ...fr_anliegen, ...fr_service, ...fr_intern },
  it: { ...it_common, ...it_navigation, ...it_search, ...it_property, ...it_listing, ...it_account, ...it_konto, ...it_favoriten, ...it_verlauf, ...it_vergleich, ...it_anfragen, ...it_anbieter, ...it_org, ...it_anliegen, ...it_service, ...it_intern },
  en: { ...en_common, ...en_navigation, ...en_search, ...en_property, ...en_listing, ...en_account, ...en_konto, ...en_favoriten, ...en_verlauf, ...en_vergleich, ...en_anfragen, ...en_anbieter, ...en_org, ...en_anliegen, ...en_service, ...en_intern }
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
export const PFAD: Record<Locale, { immobilien: string; kaufen: string; mieten: string; anbieter: string }> = {
  de: { immobilien: "immobilien", kaufen: "kaufen",   mieten: "mieten",    anbieter: "anbieter" },
  fr: { immobilien: "immobilier", kaufen: "acheter",  mieten: "louer",     anbieter: "prestataires" },
  it: { immobilien: "immobili",   kaufen: "comprare", mieten: "affittare", anbieter: "operatori" },
  en: { immobilien: "properties", kaufen: "buy",      mieten: "rent",      anbieter: "publishers" }
};

/* Anzahlformate wie im Prototyp: CHF 5’480’000.– mit typografischem Apostroph. */
export const chf = (rappenOderFranken: number, inRappen = true) => {
  const franken = inRappen ? Math.round(rappenOderFranken / 100) : Math.round(rappenOderFranken);
  return "CHF " + String(franken).replace(/\B(?=(\d{3})+(?!\d))/g, "’") + ".–";
};
export const zahl = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "’");
