import { istLocale, uebersetzer, DEFAULT_LOCALE, type Locale } from "@/i18n";
import { env } from "@/server/env";
import { KontoRahmen } from "../kopfzeile";
import { PasswortVergessenFormular } from "@/components/konto/formulare";

export const dynamic = "force-dynamic";

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
