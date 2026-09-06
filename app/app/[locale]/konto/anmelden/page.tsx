import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { istLocale, uebersetzer, DEFAULT_LOCALE, PFAD, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { KontoRahmen } from "../kopfzeile";
import { AnmeldeFormular } from "@/components/konto/formulare";
import { NOINDEX } from "@/lib/seo";

export const dynamic = "force-dynamic";

/* NOINDEX (Auth-Fluss, P5.9 Phase B). */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  return { ...NOINDEX, title: uebersetzer(locale)("k_anmeldenTitel") };
}

export default async function Anmelden({ params, searchParams }:
  { params: Promise<{ locale: string }>; searchParams: Promise<{ weiter?: string }> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const { weiter } = await searchParams;
  const t = uebersetzer(locale);
  /* Wer schon angemeldet ist, hat hier nichts zu suchen. */
  if (await sitzung()) redirect(ziel(locale, weiter));
  const txt = Object.fromEntries(["k_anmelden", "k_email", "k_passwort", "k_passwortVergessen", "k_keinKonto",
    "k_registrieren", "k_falscheDaten", "k_anmeldenTitel"].map(k => [k, t(k)]));
  return (
    <KontoRahmen locale={locale} titel={t("k_anmeldenTitel")}>
      <AnmeldeFormular t={txt} weiter={ziel(locale, weiter)}
        registrierenHref={`/${locale}/konto/registrieren${weiter ? `?weiter=${encodeURIComponent(weiter)}` : ""}`}
        passwortHref={`/${locale}/konto/passwort`} />
    </KontoRahmen>
  );
}

/* Nur eigene Pfade als Ziel — ein «weiter» auf eine fremde Adresse wäre eine
   offene Weiterleitung. */
function ziel(locale: Locale, weiter?: string): string {
  void PFAD;
  if (weiter && weiter.startsWith("/") && !weiter.startsWith("//")) return weiter;
  return `/${locale}/konto`;
}
