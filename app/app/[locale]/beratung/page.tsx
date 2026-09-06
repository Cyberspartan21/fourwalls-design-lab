import type { Metadata } from "next";
import { istLocale, DEFAULT_LOCALE, LOCALES, uebersetzer, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { Kopf } from "@/components/site/kopf";
import { AnliegenFormular } from "@/components/anliegen/anliegen-formular";
import { anliegenTexte } from "@/components/anliegen/texte";
import { seoMeta } from "@/lib/seo";

/* Beratung anfragen — Dienst "owner_consultation". Nur Kontakt (mit
   Nachricht) → Prüfen; kein Objekt nötig. */
export const dynamic = "force-dynamic";
type Params = { locale: string };

function localeAus(roh: string): Locale { return istLocale(roh) ? roh : DEFAULT_LOCALE; }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const locale = localeAus((await params).locale);
  const t = uebersetzer(locale);
  const pfade = Object.fromEntries(LOCALES.map(l => [l, `/${l}/beratung`])) as Record<Locale, string>;
  return seoMeta({ locale, pfade, titel: t("al_meta_beratung_titel"), beschreibung: t("al_meta_beratung_beschreibung"), ogTyp: "website" });
}

export default async function BeratungAnfrage({ params }: { params: Promise<Params> }) {
  const { locale: roh } = await params;
  const locale = localeAus(roh);
  const t = uebersetzer(locale);
  const s = await sitzung();
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/beratung`])) as Record<Locale, string>;

  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      <main id="inhalt" className="wiz an">
        <h1 className="titel">{t("al_meta_beratung_titel")}</h1>
        <p className="hin" style={{ color: "var(--leise)" }}>{t("al_beratung_lead")}</p>
        <AnliegenFormular dienst="owner_consultation" angemeldet={s !== null} locale={locale} t={anliegenTexte(t)} />
      </main>
    </>
  );
}
