import type { Metadata } from "next";
import { istLocale, DEFAULT_LOCALE, uebersetzer, type Locale } from "@/i18n";
import { seoMeta } from "@/lib/seo";
import { RechtsSeite, ladeRechtsDokument, rechtsSprachLinks, FREIGEGEBEN } from "@/components/rechtliches/rechtsseite";

/* Anbieterbedingungen (P5.9 Phase B, Entscheid 21/22) — Abschnittsgerüst für
   Organisationen, ergänzt um die tatsächlichen Teamrollen (domain/orgrechte.ts). */
type Params = { locale: string };
function localeAus(roh: string): Locale { return istLocale(roh) ? roh : DEFAULT_LOCALE; }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const locale = localeAus((await params).locale);
  const dokument = ladeRechtsDokument(locale, "anbieterbedingungen");
  return seoMeta({
    locale,
    pfade: rechtsSprachLinks("anbieterbedingungen"),
    titel: `${dokument.titel}`,
    beschreibung: uebersetzer(locale)("re_anbieterbedingungen_beschreibung"),
    ...(dokument.stand !== FREIGEGEBEN ? { robots: { index: false, follow: false } } : {})
  });
}

export default async function AnbieterbedingungenSeite({ params }: { params: Promise<Params> }) {
  const locale = localeAus((await params).locale);
  const t = uebersetzer(locale);
  const dokument = ladeRechtsDokument(locale, "anbieterbedingungen");
  return <RechtsSeite locale={locale} t={t} schluessel="anbieterbedingungen" dokument={dokument} />;
}
