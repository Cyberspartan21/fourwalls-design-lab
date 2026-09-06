import type { Metadata } from "next";
import { istLocale, DEFAULT_LOCALE, uebersetzer, type Locale } from "@/i18n";
import { seoMeta } from "@/lib/seo";
import { RechtsSeite, ladeRechtsDokument, rechtsSprachLinks, FREIGEGEBEN } from "@/components/rechtliches/rechtsseite";
import { Firmendaten } from "@/components/rechtliches/firmendaten";

/* Impressum (P5.9 Phase B, Entscheid 21/22). Der Fliesstext ist ein Entwurf
   (content/rechtliches/<locale>/impressum.md); die Firmenangaben selbst
   kommen live aus config/company.ts (components/rechtliches/firmendaten.tsx),
   nie aus dem Markdown — sonst könnten sie veralten, ohne dass es auffällt. */
type Params = { locale: string };
function localeAus(roh: string): Locale { return istLocale(roh) ? roh : DEFAULT_LOCALE; }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const locale = localeAus((await params).locale);
  const dokument = ladeRechtsDokument(locale, "impressum");
  return seoMeta({
    locale,
    pfade: rechtsSprachLinks("impressum"),
    titel: `${dokument.titel}`,
    beschreibung: uebersetzer(locale)("re_impressum_beschreibung"),
    ...(dokument.stand !== FREIGEGEBEN ? { robots: { index: false, follow: false } } : {})
  });
}

export default async function ImpressumSeite({ params }: { params: Promise<Params> }) {
  const locale = localeAus((await params).locale);
  const t = uebersetzer(locale);
  const dokument = ladeRechtsDokument(locale, "impressum");
  return <RechtsSeite locale={locale} t={t} schluessel="impressum" dokument={dokument} extra={<Firmendaten t={t} />} />;
}
