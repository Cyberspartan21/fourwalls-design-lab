import type { Locale } from "@/i18n";
import { LOCALES, uebersetzer } from "@/i18n";
import { Kopf } from "@/components/site/kopf";

/* Rahmen für alle Kontoseiten: dieselbe Kopfleiste wie im Marktplatz, darunter
   eine schmale Spalte in der Formularsprache des Assistenten.

   `nav`: schmale Sekundärnavigation zu den Kundenfunktionen — bewusst
   opt-in (Standard aus), weil KontoRahmen auch die Anmelde-/Registrier-/
   Passwortseiten trägt, wo eine angemeldete Navigation nichts zu suchen hat.
   Angemeldete Kontounterseiten reichen `nav` einfach mit. */
export function KontoRahmen({ locale, titel, lead, breit = false, nav = false, children }:
  { locale: Locale; titel: string; lead?: string; breit?: boolean; nav?: boolean; children: React.ReactNode }) {
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/konto`])) as Record<Locale, string>;
  const t = uebersetzer(locale);
  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      <main className="wiz an" style={breit ? { maxWidth: 980 } : undefined}>
        <h2>{titel}</h2>
        {lead && <p style={{ color: "var(--leise)", marginTop: 10, maxWidth: "56ch" }}>{lead}</p>}
        {nav && (
          <nav style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <a className="knopf leise" href={`/${locale}/konto`}>{t("k_meineInserate")}</a>
            <a className="knopf leise" href={`/${locale}/konto/favoriten`}>{t("fv_navLink")}</a>
            <a className="knopf leise" href={`/${locale}/konto/suchabos`}>{t("k_gespeicherteSuchen")}</a>
            <a className="knopf leise" href={`/${locale}/konto/verlauf`}>{t("k_zuletztAngesehen")}</a>
            <a className="knopf leise" href={`/${locale}/konto/anfragen`}>{t("af_titel")}</a>
          </nav>
        )}
        {children}
      </main>
    </>
  );
}
