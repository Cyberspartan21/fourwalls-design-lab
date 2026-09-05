import type { Metadata } from "next";
import { istLocale, DEFAULT_LOCALE, LOCALES, uebersetzer, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { Kopf } from "@/components/site/kopf";
import { AnliegenFormular } from "@/components/anliegen/anliegen-formular";
import { anliegenTexte } from "@/components/anliegen/texte";

/* Verwaltung anfragen — Dienst "property_management". Objekt→Situation→Kontakt→Prüfen. */
export const dynamic = "force-dynamic";
type Params = { locale: string };

function localeAus(roh: string): Locale { return istLocale(roh) ? roh : DEFAULT_LOCALE; }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const locale = localeAus((await params).locale);
  const t = uebersetzer(locale);
  return { title: t("al_meta_pm_titel"), description: t("al_meta_pm_beschreibung") };
}

export default async function VerwaltenAnfrage({ params }: { params: Promise<Params> }) {
  const { locale: roh } = await params;
  const locale = localeAus(roh);
  const t = uebersetzer(locale);
  const s = await sitzung();
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/verwalten/anfrage`])) as Record<Locale, string>;

  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      <main className="wiz an">
        <p className="hin" style={{ color: "var(--leise)" }}>{t("al_pm_lead")}</p>
        <AnliegenFormular dienst="property_management" angemeldet={s !== null} locale={locale} t={anliegenTexte(t)} />
      </main>
    </>
  );
}
