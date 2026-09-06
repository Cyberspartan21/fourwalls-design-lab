import type { Metadata } from "next";
import { istLocale, DEFAULT_LOCALE, uebersetzer, type Locale } from "@/i18n";
import { seoMeta } from "@/lib/seo";
import { RechtsSeite, ladeRechtsDokument, rechtsSprachLinks, FREIGEGEBEN } from "@/components/rechtliches/rechtsseite";

/* Inseratsbedingungen (P5.9 Phase B, Entscheid 21/22) — Abschnittsgerüst,
   ergänzt um die tatsächlich geltende Regel (Moderation vor Veröffentlichung,
   siehe server/moderation.ts, domain/rechte.ts:IN_PRUEFUNG). */
type Params = { locale: string };
function localeAus(roh: string): Locale { return istLocale(roh) ? roh : DEFAULT_LOCALE; }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const locale = localeAus((await params).locale);
  const dokument = ladeRechtsDokument(locale, "inseratsbedingungen");
  return seoMeta({
    locale,
    pfade: rechtsSprachLinks("inseratsbedingungen"),
    titel: `${dokument.titel}`,
    beschreibung: uebersetzer(locale)("re_inseratsbedingungen_beschreibung"),
    ...(dokument.stand !== FREIGEGEBEN ? { robots: { index: false, follow: false } } : {})
  });
}

export default async function InseratsbedingungenSeite({ params }: { params: Promise<Params> }) {
  const locale = localeAus((await params).locale);
  const t = uebersetzer(locale);
  const dokument = ladeRechtsDokument(locale, "inseratsbedingungen");
  return <RechtsSeite locale={locale} t={t} schluessel="inseratsbedingungen" dokument={dokument} />;
}
