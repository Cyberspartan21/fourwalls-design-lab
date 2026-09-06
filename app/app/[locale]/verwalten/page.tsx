import type { Metadata } from "next";
import { istLocale, DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n";
import { Kopf } from "@/components/site/kopf";
import { seoMeta } from "@/lib/seo";
import de from "@/i18n/messages/de/service.json";
import fr from "@/i18n/messages/fr/service.json";
import it from "@/i18n/messages/it/service.json";
import en from "@/i18n/messages/en/service.json";

/* Landeseite «Verwaltung anfragen» — P5.8. Siehe Kommentar in
   app/[locale]/verkaufen/page.tsx zu service.json (angelegt, nicht
   registriert). §35: beabsichtigter Umfang neutral als Anfrage-Themen, kein
   Leistungsversprechen; Preismodell nur, wenn config/policy.ts es über
   zusage() freigibt (heute nicht bestätigt — hier nicht verwendet, da kein
   konkreter Satz vorliegt). */
const SV: Record<Locale, Record<string, string>> = { de, fr, it, en };
function sv(locale: Locale, key: string): string { return SV[locale]?.[key] ?? SV.de[key] ?? key; }

export const dynamic = "force-dynamic";
type Params = { locale: string };
function localeAus(roh: string): Locale { return istLocale(roh) ? roh : DEFAULT_LOCALE; }

/* SEO-Titel abweichend von der sichtbaren Überschrift (t("sv_vwTitel") =
   "Verwaltung anfragen", i18n/messages/<sprache>/service.json — WP1-Datei, siehe
   Auftrag): dieselbe Formulierung stünde sonst zweimal in der Ergebnisliste,
   einmal für diese Landeseite und einmal für /verwalten/anfrage (P5.9 Phase B,
   Entscheid 26). Hier direkt hinterlegt statt in service.json. */
const VW_SEO_TITEL: Record<Locale, string> = {
  de: "Immobilienverwaltung mit Fourwalls",
  fr: "Gérance immobilière avec Fourwalls",
  it: "Amministrazione immobiliare con Fourwalls",
  en: "Property management with Fourwalls"
};

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const locale = localeAus((await params).locale);
  const pfade = Object.fromEntries(LOCALES.map(l => [l, `/${l}/verwalten`])) as Record<Locale, string>;
  return seoMeta({ locale, pfade, titel: VW_SEO_TITEL[locale], beschreibung: sv(locale, "sv_vwLead"), ogTyp: "website" });
}

export default async function Verwalten({ params }: { params: Promise<Params> }) {
  const { locale: roh } = await params;
  const locale = localeAus(roh);
  const t = (k: string) => sv(locale, k);
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/verwalten`])) as Record<Locale, string>;

  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} aktuell="verwalten" />
      <main id="inhalt" className="wiz an" style={{ maxWidth: 780 }}>
        <h1 className="titel">{t("sv_vwTitel")}</h1>
        <p style={{ color: "var(--leise)", marginTop: 10, maxWidth: "56ch" }}>{t("sv_vwLead")}</p>

        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 500 }}>{t("sv_vwThemenTitel")}</h2>
          <ul style={{ marginTop: 12, paddingLeft: 18, display: "grid", gap: 8 }}>
            <li>{t("sv_vwThema1")}</li>
            <li>{t("sv_vwThema2")}</li>
            <li>{t("sv_vwThema3")}</li>
            <li>{t("sv_vwThema4")}</li>
            <li>{t("sv_vwThema5")}</li>
            <li>{t("sv_vwThema6")}</li>
          </ul>
          <p style={{ marginTop: 10, color: "var(--leise)" }}>{t("sv_vwThemenHinweis")}</p>
        </section>

        <section style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: "1.05rem", fontWeight: 500 }}>{t("sv_vwProzessTitel")}</h2>
          <ol style={{ marginTop: 12, paddingLeft: 18, display: "grid", gap: 12 }}>
            {[1, 2, 3, 4].map(n => (
              <li key={n}><b>{t(`sv_vwSchritt${n}Titel`)}</b><br /><span style={{ color: "var(--leise)" }}>{t(`sv_vwSchritt${n}Text`)}</span></li>
            ))}
          </ol>
        </section>

        <p style={{ marginTop: 32 }}>
          <a className="knopf voll" href={`/${locale}/verwalten/anfrage`}>{t("sv_ctaAnfrage")}</a>
        </p>

        <section style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid var(--linie)" }}>
          <h2 style={{ fontSize: ".95rem", fontWeight: 500 }}>{t("sv_vwAbgrenzungTitel")}</h2>
          <p style={{ marginTop: 8, color: "var(--leise)" }}>{t("sv_vwAbgrenzungText")} <a href={`/${locale}/vermieten`}>{t("sv_vwAbgrenzungLink")}</a></p>
        </section>
      </main>
    </>
  );
}
