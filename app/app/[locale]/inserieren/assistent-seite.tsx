import type { Locale } from "@/i18n";
import { LOCALES, uebersetzer } from "@/i18n";
import { sql } from "@/server/db";
import { Kopf } from "@/components/site/kopf";
import { Assistent } from "@/components/inserieren/assistent";
import type { Entwurf } from "@/domain/entwurf";

/* Rahmen und Wörterbuch für den Assistenten. Die Texte werden einmal
   serverseitig zusammengestellt; die Client-Komponente bekommt fertige
   Zeichenketten und keinen Übersetzer (kleineres Bündel). */
export async function AssistentSeite({ locale, start }:
  { locale: Locale; start: { publicRef: string; version: number; daten: Entwurf; status: string; rueckmeldung: { nachricht: string; grund: string | null } | null } | null }) {
  const t = uebersetzer(locale);
  const merkmale = await sql`SELECT key, coalesce(${sql("name_" + locale)}, name_de) AS name FROM feature ORDER BY sort_order`;
  const schluessel = ["w_schritt", "w_von", "w_zurueck", "w_weiter", "w_verkaufen", "w_vermieten", "w_verkaufenHin", "w_vermietenHin",
    "w_bitteWaehlen", "w_bitteAngeben", "w_flaecheFehler", "w_preisFehler", "w_titelFehler", "w_beschreibungFehler", "w_emailFehler",
    "w_ortFehler", "w_bildFehler", "w_zimmer", "w_wohnflaeche", "w_grundstueck", "w_baujahr", "w_etage", "w_nettomiete", "w_kaufpreis",
    "w_aufAnfrage", "w_nebenkosten", "w_titel", "w_beschreibung", "w_sprache", "w_spracheHin", "w_name", "w_telefon", "w_kontaktHin",
    "w_ortLabel", "w_ortSuchen", "w_erkannt", "w_strasse", "w_hausnummer", "w_strassePrivat", "w_lageFrage", "w_lageUngefaehr",
    "w_lageUngefaehrHin", "w_lageGemeinde", "w_lageGemeindeHin", "w_exaktGesperrt", "w_bildHochladen", "w_bildEntfernen", "w_bilderHin",
    "w_gewaehlteBilder", "w_meineBilder", "w_titelbild", "w_bereit", "w_bereitText", "w_absicht", "w_preis", "w_typ", "w_bilderZahl",
    "w_speichern", "w_gespeichert", "w_speichert", "w_nichtGespeichert", "w_speicherFehler", "w_konflikt", "w_neuLaden",
    "w_einreichen", "w_eingereichtTitel", "w_eingereichtText", "w_fehltNoch", "w_anmeldenNoetig", "w_anmeldenNoetigText",
    "w_inseratsbedingungenHin", "w_inseratsbedingungenLink",
    "w_rueckmeldung", "k_email", "k_meineInserate", "ausstattung", "verfuegbar", "sofort", "abDatum", "aufAnfrage"];
  const texte: Record<string, string> = {};
  for (const k of schluessel) texte[k] = t(k);
  for (const s of ["absicht", "typ", "ort", "fakten", "preis", "text", "bilder", "kontakt", "pruefen"]) texte["w_schritt_" + s] = t("w_schritt_" + s);
  for (const k of ["wohnung", "haus", "villa", "chalet", "mfh", "gewerbe", "grundstueck", "parkplatz"]) texte["w_typ_" + k] = t("w_typ_" + k);
  for (const f of ["trans", "typ", "ortId", "flaeche", "grundstueck", "zimmer", "preis", "titel", "beschreibung", "name", "email", "bilder"]) texte["w_feld_" + f] = t("w_feld_" + f);
  for (const m of merkmale) texte["feat_" + String(m.key)] = String(m.name);

  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, start ? `/${l}/inserieren/${start.publicRef.toLowerCase()}` : `/${l}/inserieren`])) as Record<Locale, string>;
  const weiterZiel = start ? `/${locale}/inserieren/${start.publicRef.toLowerCase()}` : `/${locale}/inserieren`;

  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      <main id="inhalt" className="wiz an">
        <Assistent locale={locale} t={texte} start={start}
          anmeldenHref={`/${locale}/konto/anmelden?weiter=${encodeURIComponent(weiterZiel)}`}
          kontoHref={`/${locale}/konto`} />
      </main>
    </>
  );
}
