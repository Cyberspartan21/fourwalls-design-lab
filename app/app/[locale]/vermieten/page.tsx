import type { Metadata } from "next";
import { istLocale, DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n";
import { Kopf } from "@/components/site/kopf";
import de from "@/i18n/messages/de/service.json";
import fr from "@/i18n/messages/fr/service.json";
import it from "@/i18n/messages/it/service.json";
import en from "@/i18n/messages/en/service.json";

/* Landeseite «Vermieten» — kurz, mietspezifisch (§12). Siehe Kommentar in
   app/[locale]/verkaufen/page.tsx zu service.json (angelegt, nicht
   registriert). */
const SV: Record<Locale, Record<string, string>> = { de, fr, it, en };
function sv(locale: Locale, key: string): string { return SV[locale]?.[key] ?? SV.de[key] ?? key; }

export const dynamic = "force-dynamic";
type Params = { locale: string };
function localeAus(roh: string): Locale { return istLocale(roh) ? roh : DEFAULT_LOCALE; }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const locale = localeAus((await params).locale);
  return { title: `${sv(locale, "sv_vmTitel")} — Fourwalls`, description: sv(locale, "sv_vmLead") };
}

export default async function Vermieten({ params }: { params: Promise<Params> }) {
  const { locale: roh } = await params;
  const locale = localeAus(roh);
  const t = (k: string) => sv(locale, k);
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/vermieten`])) as Record<Locale, string>;

  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} aktuell="verkaufen" />
      <main className="wiz an" style={{ maxWidth: 780 }}>
        <h2>{t("sv_vmTitel")}</h2>
        <p style={{ color: "var(--leise)", marginTop: 10, maxWidth: "56ch" }}>{t("sv_vmLead")}</p>

        <p style={{ marginTop: 32 }}>
          <a className="knopf voll" href={`/${locale}/vermieten/anfrage`}>{t("sv_ctaAnfrage")}</a>
        </p>

        <section style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid var(--linie)" }}>
          <h3 style={{ fontSize: ".95rem", fontWeight: 500 }}>{t("sv_vmAbgrenzungTitel")}</h3>
          <p style={{ marginTop: 8, color: "var(--leise)" }}>{t("sv_vmAbgrenzungText")} <a href={`/${locale}/verwalten`}>{t("sv_vmAbgrenzungLink")}</a></p>
        </section>
      </main>
    </>
  );
}
