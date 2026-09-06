import type { Metadata } from "next";
import { istLocale, DEFAULT_LOCALE, uebersetzer, type Locale } from "@/i18n";
import { seoMeta } from "@/lib/seo";
import { RechtsSeite, ladeRechtsDokument, rechtsSprachLinks, FREIGEGEBEN } from "@/components/rechtliches/rechtsseite";

/* Datenschutzerklärung (P5.9 Phase B, Entscheid 21/22) — Entwurf, aus dem
   tatsächlichen Verhalten der Anwendung abgeleitet (siehe
   content/rechtliches/de/datenschutz.md für die Belege je Aussage). */
type Params = { locale: string };
function localeAus(roh: string): Locale { return istLocale(roh) ? roh : DEFAULT_LOCALE; }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const locale = localeAus((await params).locale);
  const dokument = ladeRechtsDokument(locale, "datenschutz");
  return seoMeta({
    locale,
    pfade: rechtsSprachLinks("datenschutz"),
    titel: `${dokument.titel}`,
    beschreibung: uebersetzer(locale)("re_datenschutz_beschreibung"),
    ...(dokument.stand !== FREIGEGEBEN ? { robots: { index: false, follow: false } } : {})
  });
}

export default async function DatenschutzSeite({ params }: { params: Promise<Params> }) {
  const locale = localeAus((await params).locale);
  const t = uebersetzer(locale);
  const dokument = ladeRechtsDokument(locale, "datenschutz");
  return <RechtsSeite locale={locale} t={t} schluessel="datenschutz" dokument={dokument} />;
}
