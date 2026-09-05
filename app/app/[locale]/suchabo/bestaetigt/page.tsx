import { istLocale, uebersetzer, DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n";
import { Kopf } from "@/components/site/kopf";

/* Ziel des Bestätigungslinks aus der Suchabo-Mail (Double-Opt-in, anonym).
   Statischer Text — die Bestätigung selbst geschah bereits in
   app/api/suchabo/bestaetigen/route.ts, das hierher umleitet. */
export default async function SuchaboBestaetigt({ params, searchParams }:
  { params: Promise<{ locale: string }>; searchParams: Promise<{ fehler?: string }> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const { fehler } = await searchParams;
  const t = uebersetzer(locale);
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/suchabo/bestaetigt${fehler ? "?fehler=1" : ""}`])) as Record<Locale, string>;

  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      <main className="wiz an" style={{ maxWidth: 640 }}>
        <h2>{fehler ? t("sa_bestaetigtFehlerTitel") : t("sa_bestaetigtTitel")}</h2>
        <p style={{ color: "var(--leise)", marginTop: 10 }}>{fehler ? t("sa_bestaetigtFehlerText") : t("sa_bestaetigtText")}</p>
        <div style={{ marginTop: 26 }}><a className="knopf voll" href={`/${locale}`}>{t("sa_zurStartseite")}</a></div>
      </main>
    </>
  );
}
