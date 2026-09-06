import type { Locale, T } from "@/i18n";
import { LOCALES, uebersetzer } from "@/i18n";
import { Kopf } from "@/components/site/kopf";

/* Rahmen für alle Kontoseiten: dieselbe Kopfleiste wie im Marktplatz, darunter
   eine schmale Spalte in der Formularsprache des Assistenten.

   `nav`: schmale Sekundärnavigation zu den Kundenfunktionen — bewusst
   opt-in (Standard aus), weil KontoRahmen auch die Anmelde-/Registrier-/
   Passwortseiten trägt, wo eine angemeldete Navigation nichts zu suchen hat.
   Angemeldete Kontounterseiten reichen `nav` einfach mit. `aktiv` markiert den
   aktuellen Eintrag (aria-current="page") — der Seitenschlüssel aus NAV_ITEMS.
   Gleiche Reihenfolge auf allen sechs Seiten: Übersicht, Merkliste, Gespeicherte
   Suchen, Zuletzt angesehen, Anfragen, Anliegen. «Meine Inserate» ist kein
   eigener Nav-Eintrag, sondern der Listenabschnitt auf /konto (Übersicht)
   selbst. «Anfragen» sind Objektanfragen an ein Inserat (§inquiries),
   «Anliegen» sind Bitten an FOURWALLS selbst (Verkauf, Vermietung, Bewertung,
   Verwaltung, Beratung — §P5.8, domain/anliegen.ts) — zwei verschiedene
   Dinge, zwei Einträge. */
const NAV_ITEMS: { key: string; href: (l: Locale) => string; label: (t: T) => string }[] = [
  { key: "uebersicht", href: l => `/${l}/konto`, label: t => t("k_uebersicht") },
  { key: "favoriten", href: l => `/${l}/konto/favoriten`, label: t => t("fv_navLink") },
  { key: "suchabos", href: l => `/${l}/konto/suchabos`, label: t => t("k_gespeicherteSuchen") },
  { key: "verlauf", href: l => `/${l}/konto/verlauf`, label: t => t("k_zuletztAngesehen") },
  { key: "anfragen", href: l => `/${l}/konto/anfragen`, label: t => t("af_titel") },
  { key: "anliegen", href: l => `/${l}/konto/anliegen`, label: t => t("al_titel") }
];

export function KontoRahmen({ locale, titel, lead, breit = false, nav = false, aktiv, children }:
  { locale: Locale; titel: string; lead?: string; breit?: boolean; nav?: boolean; aktiv?: string; children: React.ReactNode }) {
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/konto`])) as Record<Locale, string>;
  const t = uebersetzer(locale);
  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      <main id="inhalt" className="wiz an" style={breit ? { maxWidth: 980 } : undefined}>
        <h1 className="titel">{titel}</h1>
        {lead && <p style={{ color: "var(--leise)", marginTop: 10, maxWidth: "56ch" }}>{lead}</p>}
        {nav && (
          <nav style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            {NAV_ITEMS.map(it => (
              <a key={it.key} className="knopf leise" href={it.href(locale)} aria-current={aktiv === it.key ? "page" : undefined}>{it.label(t)}</a>
            ))}
          </nav>
        )}
        {children}
      </main>
    </>
  );
}
