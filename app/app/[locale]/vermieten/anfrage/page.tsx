import type { Metadata } from "next";
import { istLocale, DEFAULT_LOCALE, LOCALES, uebersetzer, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { Kopf } from "@/components/site/kopf";
import { AnliegenFormular } from "@/components/anliegen/anliegen-formular";
import { anliegenTexte } from "@/components/anliegen/texte";
import { NOINDEX } from "@/lib/seo";

/* Vermietung anfragen — Dienst "let". Objekt→Situation→Kontakt→Prüfen. */
export const dynamic = "force-dynamic";
type Params = { locale: string };

function localeAus(roh: string): Locale { return istLocale(roh) ? roh : DEFAULT_LOCALE; }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const locale = localeAus((await params).locale);
  const t = uebersetzer(locale);
  /* Formularseite (Entscheid 26): NOINDEX, kein Canonical/hreflang — die
     Landeseite /vermieten ist das Suchziel, nicht dieses Formular. */
  return { ...NOINDEX, title: t("al_meta_let_titel") };
}

export default async function VermietenAnfrage({ params }: { params: Promise<Params> }) {
  const { locale: roh } = await params;
  const locale = localeAus(roh);
  const t = uebersetzer(locale);
  const s = await sitzung();
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/vermieten/anfrage`])) as Record<Locale, string>;

  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      <main id="inhalt" className="wiz an">
        <p className="hin" style={{ color: "var(--leise)" }}>{t("al_let_lead")}</p>
        <AnliegenFormular dienst="let" angemeldet={s !== null} locale={locale} t={anliegenTexte(t)} />
      </main>
    </>
  );
}
