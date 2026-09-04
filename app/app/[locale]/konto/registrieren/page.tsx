import { redirect } from "next/navigation";
import { istLocale, uebersetzer, DEFAULT_LOCALE, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { KontoRahmen } from "../kopfzeile";
import { RegistrierFormular } from "@/components/konto/formulare";

export const dynamic = "force-dynamic";

export default async function Registrieren({ params, searchParams }:
  { params: Promise<{ locale: string }>; searchParams: Promise<{ weiter?: string }> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const { weiter } = await searchParams;
  const t = uebersetzer(locale);
  if (await sitzung()) redirect(ziel(locale, weiter));
  const txt = Object.fromEntries(["k_registrieren", "k_email", "k_passwort", "k_name", "k_mindestens",
    "k_habenKonto", "k_anmelden", "k_falscheDaten"].map(k => [k, t(k)]));
  return (
    <KontoRahmen locale={locale} titel={t("k_registrierenTitel")} lead={t("k_registrierenLead")}>
      <RegistrierFormular t={txt} weiter={ziel(locale, weiter)}
        anmeldenHref={`/${locale}/konto/anmelden${weiter ? `?weiter=${encodeURIComponent(weiter)}` : ""}`} />
    </KontoRahmen>
  );
}
function ziel(locale: Locale, weiter?: string): string {
  if (weiter && weiter.startsWith("/") && !weiter.startsWith("//")) return weiter;
  return `/${locale}/konto`;
}
