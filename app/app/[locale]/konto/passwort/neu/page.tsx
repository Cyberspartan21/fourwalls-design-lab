import type { Metadata } from "next";
import { istLocale, uebersetzer, DEFAULT_LOCALE, type Locale } from "@/i18n";
import { KontoRahmen } from "../../kopfzeile";
import { PasswortNeuFormular } from "@/components/konto/formulare";
import { NOINDEX } from "@/lib/seo";

export const dynamic = "force-dynamic";

/* NOINDEX (Auth-Fluss, P5.9 Phase B). */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  return { ...NOINDEX, title: uebersetzer(locale)("k_passwortNeu") };
}

export default async function PasswortNeu({ params, searchParams }:
  { params: Promise<{ locale: string }>; searchParams: Promise<{ token?: string; error?: string }> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const { token, error } = await searchParams;
  const t = uebersetzer(locale);
  const txt = Object.fromEntries(["k_passwortNeu", "k_passwortSetzen", "k_mindestens"].map(k => [k, t(k)]));
  /* Ohne gültige Marke gibt es kein Formular — die Bibliothek hängt bei
     abgelaufenen oder gebrauchten Marken `error` an die Adresse. */
  if (!token || error) {
    return (
      <KontoRahmen locale={locale} titel={t("k_passwortVergessen")}>
        <div className="hinweisbox" role="alert">
          <b>{t("k_passwortVergessen")}</b>
          <p style={{ marginTop: 6 }}>{t("k_mailGesendet")}</p>
          <a className="knopf" style={{ marginTop: 10 }} href={`/${locale}/konto/passwort`}>{t("k_linkSenden")}</a>
        </div>
      </KontoRahmen>
    );
  }
  return (
    <KontoRahmen locale={locale} titel={t("k_passwortNeu")}>
      <PasswortNeuFormular t={txt} token={token} weiter={`/${locale}/konto/anmelden`} />
    </KontoRahmen>
  );
}
