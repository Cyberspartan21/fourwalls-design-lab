import { istLocale, uebersetzer, DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n";
import { Kopf } from "@/components/site/kopf";

/* Ziel des Abmeldelinks aus jeder Suchabo-Mail — die einzige Verwaltung für
   anonyme Suchabos. Die Abmeldung selbst geschah bereits in
   app/api/suchabo/abmelden/route.ts, das hierher umleitet. */
export default async function SuchaboAbgemeldet({ params, searchParams }:
  { params: Promise<{ locale: string }>; searchParams: Promise<{ fehler?: string }> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const { fehler } = await searchParams;
  const t = uebersetzer(locale);
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/suchabo/abgemeldet${fehler ? "?fehler=1" : ""}`])) as Record<Locale, string>;

  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      <main className="wiz an" style={{ maxWidth: 640 }}>
        <h2>{fehler ? t("sa_abgemeldetFehlerTitel") : t("sa_abgemeldetTitel")}</h2>
        <p style={{ color: "var(--leise)", marginTop: 10 }}>{fehler ? t("sa_abgemeldetFehlerText") : t("sa_abgemeldetText")}</p>
        <div style={{ marginTop: 26 }}><a className="knopf voll" href={`/${locale}`}>{t("sa_zurStartseite")}</a></div>
      </main>
    </>
  );
}
