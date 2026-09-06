import type { Metadata } from "next";
import { istLocale, DEFAULT_LOCALE, uebersetzer, type Locale } from "@/i18n";
import { seoMeta } from "@/lib/seo";
import { RechtsSeite, ladeRechtsDokument, rechtsSprachLinks, FREIGEGEBEN } from "@/components/rechtliches/rechtsseite";

/* Allgemeine Geschäftsbedingungen (P5.9 Phase B, Entscheid 21/22) — reines
   Abschnittsgerüst, Text folgt nach rechtlicher Prüfung. */
type Params = { locale: string };
function localeAus(roh: string): Locale { return istLocale(roh) ? roh : DEFAULT_LOCALE; }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const locale = localeAus((await params).locale);
  const dokument = ladeRechtsDokument(locale, "agb");
  return seoMeta({
    locale,
    pfade: rechtsSprachLinks("agb"),
    titel: `${dokument.titel}`,
    beschreibung: uebersetzer(locale)("re_agb_beschreibung"),
    ...(dokument.stand !== FREIGEGEBEN ? { robots: { index: false, follow: false } } : {})
  });
}

export default async function AgbSeite({ params }: { params: Promise<Params> }) {
  const locale = localeAus((await params).locale);
  const t = uebersetzer(locale);
  const dokument = ladeRechtsDokument(locale, "agb");
  return <RechtsSeite locale={locale} t={t} schluessel="agb" dokument={dokument} />;
}
