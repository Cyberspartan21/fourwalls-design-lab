import type { Locale } from "@/i18n";
import { LOCALES, uebersetzer } from "@/i18n";
import { Kopf } from "@/components/site/kopf";

/* Rahmen für alle Kontoseiten: dieselbe Kopfleiste wie im Marktplatz, darunter
   eine schmale Spalte in der Formularsprache des Assistenten. */
export function KontoRahmen({ locale, titel, lead, breit = false, children }:
  { locale: Locale; titel: string; lead?: string; breit?: boolean; children: React.ReactNode }) {
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/konto`])) as Record<Locale, string>;
  void uebersetzer(locale);
  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      <main className="wiz an" style={breit ? { maxWidth: 980 } : undefined}>
        <h2>{titel}</h2>
        {lead && <p style={{ color: "var(--leise)", marginTop: 10, maxWidth: "56ch" }}>{lead}</p>}
        {children}
      </main>
    </>
  );
}
