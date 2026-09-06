import type { Metadata } from "next";
import { istLocale, uebersetzer, DEFAULT_LOCALE, type Locale } from "@/i18n";
import { env } from "@/server/env";
import { KontoRahmen } from "../kopfzeile";
import { PasswortVergessenFormular } from "@/components/konto/formulare";
import { NOINDEX } from "@/lib/seo";

export const dynamic = "force-dynamic";

/* NOINDEX (Auth-Fluss, P5.9 Phase B). */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  return { ...NOINDEX, title: uebersetzer(locale)("k_passwortVergessen") };
}

export default async function PasswortVergessen({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const t = uebersetzer(locale);
  const txt = Object.fromEntries(["k_email", "k_linkSenden", "k_pruefenMail", "k_mailGesendet"].map(k => [k, t(k)]));
  return (
    <KontoRahmen locale={locale} titel={t("k_passwortVergessen")}>
      <PasswortVergessenFormular t={txt} zielUrl={`${env().NEXT_PUBLIC_SITE_URL}/${locale}/konto/passwort/neu`} />
    </KontoRahmen>
  );
}
