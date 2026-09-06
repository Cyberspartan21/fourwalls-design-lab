import type { Locale, T } from "@/i18n";
import { LOCALES, uebersetzer } from "@/i18n";
import { Kopf } from "@/components/site/kopf";

/* Rahmen für den internen Bereich (P5.8 §24–§30, §80).

   Bewusst ein eigener Rahmen, nicht KontoRahmen: der interne Bereich ist kein
   Kundenkonto, keine Organisation und keine Moderation — ein «Fourwalls
   intern»-Eyebrow markiert das unmissverständlich, und der einzige Rückweg
   führt zum eigenen Konto, nie in einen dieser drei Bereiche hinein. */
export function InternRahmen({ locale, titel, lead, sprachPfad, children }:
  { locale: Locale; titel: string; lead?: string; sprachPfad?: string; children: React.ReactNode }) {
  const t: T = uebersetzer(locale);
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}${sprachPfad ?? "/intern/anliegen"}`])) as Record<Locale, string>;

  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      <main id="inhalt" className="wiz an" style={{ maxWidth: 1100 }}>
        <span className="schrittz">{t("in_eyebrow")}</span>
        <h1 className="titel">{titel}</h1>
        {lead && <p style={{ color: "var(--leise)", marginTop: 10, maxWidth: "60ch" }}>{lead}</p>}
        <div style={{ marginTop: 14 }}>
          <a className="knopf leise" href={`/${locale}/konto`}>{t("in_zurueckZuKonto")}</a>
        </div>
        {children}
      </main>
    </>
  );
}
