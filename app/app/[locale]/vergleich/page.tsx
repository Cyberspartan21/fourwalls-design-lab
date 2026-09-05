import { istLocale, uebersetzer, DEFAULT_LOCALE, LOCALES, PFAD, type Locale } from "@/i18n";
import { woerter } from "@/components/marktplatz/labels";
import { Kopf } from "@/components/site/kopf";
import { VergleichSeite } from "@/components/vergleich-seite";

/* Vergleich — öffentlich, ohne Konto. Die Referenzen liegen im Browser
   (components/vergleich.ts); diese Seite ist nur der Rahmen, die eigentliche
   Auflösung übernimmt die Client-Komponente über /api/vergleich (P5.6 §34). */
export const dynamic = "force-dynamic";

export default async function Vergleich({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const t = uebersetzer(locale);
  const p = PFAD[locale];
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/vergleich`])) as Record<Locale, string>;
  const titel = t("vg_titel");

  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      <main className="wiz an" style={{ maxWidth: 1100 }}>
        <h2>{titel}</h2>
        <VergleichSeite
          locale={locale}
          w={woerter(t)}
          tx={{
            leer: t("vg_leer"), leerLink: t("vg_leerLink"), entfernen: t("vg_entfernen"), ansehen: t("k_ansehen"),
            preis: t("o_fPreis"), proM2: t("proM2"), ort: t("o_gemeindeWort"), typ: t("w_typ"),
            verfuegbarkeit: t("verfuegbar"), anbieter: t("anbieter"),
            zimmer: t("o_fZimmer"), wohnflaeche: t("o_fWohnflaeche"), grundstueck: t("o_fGrundstueck"),
            baujahr: t("o_fBaujahr"), etage: t("o_fEtage")
          }}
        />
      </main>
    </>
  );
}
