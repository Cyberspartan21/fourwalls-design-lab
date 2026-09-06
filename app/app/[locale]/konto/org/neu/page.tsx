import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { istLocale, uebersetzer, DEFAULT_LOCALE, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { KontoRahmen } from "../../kopfzeile";
import { OrganisationAnlegenFormular } from "@/components/org/organisation-anlegen-formular";
import { BestaetigungErneut } from "@/components/konto/formulare";
import { NOINDEX } from "@/lib/seo";

/* Organisation anlegen (P5.7 §1) — ein Formular, keine eigene Navigation:
   diese Seite steht ausserhalb des OrgRahmens (es gibt noch keine
   Organisation), aber innerhalb des KontoRahmens (angemeldete Person). */
export const dynamic = "force-dynamic";

/* NOINDEX (Konto, P5.9 Phase B). */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  return { ...NOINDEX, title: uebersetzer(locale)("og_neu_titel") };
}

export default async function OrganisationNeu({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  if (!s) redirect(`/${locale}/konto/anmelden?weiter=${encodeURIComponent(`/${locale}/konto/org/neu`)}`);
  const t = uebersetzer(locale);

  const txt = Object.fromEntries([
    "og_feld_anzeigename", "og_feld_firmenname", "og_feld_firmennameHin", "og_feld_art",
    "og_art_agency", "og_art_property_manager", "og_art_developer", "og_art_institutional",
    "og_feld_sprache", "og_feld_website", "og_feld_publicEmail", "og_feld_publicPhone",
    "og_feld_strasse", "og_feld_plz", "og_feld_ort", "og_feld_beschreibung", "og_anlegenKnopf",
    "og_anbieterbedingungenHin", "og_anbieterbedingungenLink"
  ].map(k => [k, t(k)]));

  return (
    <KontoRahmen locale={locale} titel={t("og_neu_titel")} lead={t("og_neu_lead")}>
      {!s.person.emailBestaetigt && (
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <BestaetigungErneut t={{ k_emailUnbestaetigt: t("k_emailUnbestaetigt"), k_emailBestaetigenHin: t("og_neu_emailHin"), k_erneutSenden: t("k_erneutSenden"), k_pruefenMail: t("k_pruefenMail") }} email={s.email} />
        </div>
      )}
      <OrganisationAnlegenFormular t={txt} locale={locale} />
    </KontoRahmen>
  );
}
