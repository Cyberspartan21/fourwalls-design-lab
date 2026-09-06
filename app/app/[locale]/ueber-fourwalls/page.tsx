import type { Metadata } from "next";
import { istLocale, DEFAULT_LOCALE, LOCALES, uebersetzer, type Locale } from "@/i18n";
import { seoMeta } from "@/lib/seo";
import { Kopf } from "@/components/site/kopf";

/* Vertrauensseite «So arbeitet Fourwalls» (P5.9 Phase B, Entscheid 21/22).
   Nur Aussagen, die das Produkt heute trägt — siehe die Belege je Abschnitt:
   - Marktplatz + Eigentümer-Services: domain/anliegen.ts (DIENSTE)
   - Fourwalls Exclusive / Anfrage direkt: server/inquiries.ts, property.json
     (o_anfrageDirekt, o_wirVertreten)
   - Reihenfolge «Neuste»: server/search.ts (Sortierung "neu"),
     config/policy.ts (AUSSAGEN.exclusivePlatzierung, CONFIRM_REWORDED)
   - Ohne Konto: components/favorites.ts, components/verlauf.ts (lokale
     Speicherung), server/sitzung.ts (Konto nötig für Suchabo-Verwaltung
     über Geräte hinweg)
   - Sprachen: i18n/index.ts (LOCALES)
   - Kein Tracking: lib/sicherheitskoepfe.ts (CSP ohne Analytics-Hosts) */
type Params = { locale: string };
function localeAus(roh: string): Locale { return istLocale(roh) ? roh : DEFAULT_LOCALE; }
const PFAD_UEBER = "ueber-fourwalls";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const locale = localeAus((await params).locale);
  const t = uebersetzer(locale);
  return seoMeta({
    locale,
    pfade: Object.fromEntries(LOCALES.map(l => [l, `/${l}/${PFAD_UEBER}`])) as Record<Locale, string>,
    titel: `${t("vt_titel")}`,
    beschreibung: t("vt_lead")
  });
}

export default async function UeberFourwallsSeite({ params }: { params: Promise<Params> }) {
  const locale = localeAus((await params).locale);
  const t = uebersetzer(locale);
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/${PFAD_UEBER}`])) as Record<Locale, string>;

  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      <main id="inhalt" className="wiz an rechtstext">
        <span className="schrittz">{t("vt_eyebrow")}</span>
        <h1>{t("vt_titel")}</h1>
        <p style={{ marginTop: 14 }}>{t("vt_lead")}</p>

        <h2>{t("vt_was_h2")}</h2>
        <p>{t("vt_was_p1")}</p>
        <p>{t("vt_was_p2")}</p>

        <h2>{t("vt_vertritt_h2")}</h2>
        <p>{t("vt_vertritt_p1")}</p>
        <p>{t("vt_vertritt_p2")}</p>

        <h2>{t("vt_reihenfolge_h2")}</h2>
        <p>{t("vt_reihenfolge_p1")}</p>
        <p>{t("vt_reihenfolge_p2")}</p>

        <h2>{t("vt_ohneKonto_h2")}</h2>
        <p>{t("vt_ohneKonto_p1")}</p>
        <p>{t("vt_ohneKonto_p2")}</p>

        <h2>{t("vt_sprachen_h2")}</h2>
        <p>{t("vt_sprachen_p1")}</p>

        <h2>{t("vt_datenschutz_h2")}</h2>
        <p>{t("vt_datenschutz_p1")} <a href={`/${locale}/datenschutz`}>{t("vt_datenschutz_link")}</a>.</p>

        <h2>{t("vt_kontakt_h2")}</h2>
        <p>{t("vt_kontakt_p1")} <a href={`/${locale}/beratung`}>{t("vt_kontakt_formularLink")}</a>.</p>
        <p>{t("vt_kontakt_p2")}</p>
      </main>
    </>
  );
}
