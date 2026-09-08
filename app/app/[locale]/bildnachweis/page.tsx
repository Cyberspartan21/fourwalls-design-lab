import type { Metadata } from "next";
import { istLocale, DEFAULT_LOCALE, LOCALES, uebersetzer, type Locale } from "@/i18n";
import { seoMeta } from "@/lib/seo";
import { Kopf } from "@/components/site/kopf";

/* Bildnachweis: das Titelbild der Exclusive-Objektseite steht unter
   CC BY-SA 3.0 und verlangt sichtbare Namensnennung im Produkt; ausserdem
   legt die Seite offen, dass die übrigen Objektbilder generiert sind.
   Nicht in der Sitemap (app/sitemap.ts) und mit robots noindex, follow —
   dieselbe Behandlung wie andere reine Hintergrundinformationen, die keine
   Suchmaschinen-Zielseite sind. */
type Params = { locale: string };
function localeAus(roh: string): Locale { return istLocale(roh) ? roh : DEFAULT_LOCALE; }
const PFAD_BILDNACHWEIS = "bildnachweis";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const locale = localeAus((await params).locale);
  const t = uebersetzer(locale);
  return seoMeta({
    locale,
    pfade: Object.fromEntries(LOCALES.map(l => [l, `/${l}/${PFAD_BILDNACHWEIS}`])) as Record<Locale, string>,
    titel: `${t("bn_titel")}`,
    beschreibung: t("bn_lead"),
    robots: { index: false, follow: true }
  });
}

export default async function BildnachweisSeite({ params }: { params: Promise<Params> }) {
  const locale = localeAus((await params).locale);
  const t = uebersetzer(locale);
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/${PFAD_BILDNACHWEIS}`])) as Record<Locale, string>;

  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      <main id="inhalt" className="wiz an rechtstext">
        <h1>{t("bn_titel")}</h1>
        <p style={{ marginTop: 14 }}>{t("bn_lead")}</p>

        <h2>{t("bn_echte")}</h2>
        <p><span style={{ color: "var(--ink)" }}>{t("bn_motiv")}:</span> {t("bn_motivText")}</p>
        <p><span style={{ color: "var(--ink)" }}>{t("bn_fotograf")}:</span> Roland zh</p>
        <p><span style={{ color: "var(--ink)" }}>{t("bn_quelle")}:</span> Wikimedia Commons, Datei «Wollishofen - Villa Moser-Nef - Cassiopeiasteg 2015-05-06 13-49-07.JPG» — <a href="https://commons.wikimedia.org/wiki/File:Wollishofen_-_Villa_Moser-Nef_-_Cassiopeiasteg_2015-05-06_13-49-07.JPG" target="_blank" rel="noopener noreferrer">{t("bn_datei")}</a></p>
        <p><span style={{ color: "var(--ink)" }}>{t("bn_lizenz")}:</span> <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 3.0</a></p>
        <p><span style={{ color: "var(--ink)" }}>{t("bn_bearbeitung")}:</span> {t("bn_bearbeitungText")}</p>

        <h2>{t("bn_uebrige")}</h2>
        <p>{t("bn_uebrigeText")}</p>
      </main>
    </>
  );
}
