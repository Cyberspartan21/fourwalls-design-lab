import type { Locale, T } from "@/i18n";
import { LOCALES } from "@/i18n";
import { Kopf } from "@/components/site/kopf";
import { rechtsDokument, renderMarkdown, type RechtsDokument } from "@/lib/markdown";

/* Gemeinsamer Rahmen der fünf Rechtsseiten (Impressum, Datenschutz, AGB,
   Inseratsbedingungen, Anbieterbedingungen) — P5.9 Phase B.

   Der Pfad ist in allen vier Sprachen dasselbe Wort (z. B. `/fr/impressum`,
   nicht `/fr/mentions-legales`): das hält generateMetadata und diese
   Komponente einfach und macht sprachneutrale Verlinkung möglich. */
export const RECHTS_SCHLUESSEL = ["impressum", "datenschutz", "agb", "inseratsbedingungen", "anbieterbedingungen"] as const;
export type RechtsSchluessel = (typeof RECHTS_SCHLUESSEL)[number];

export const FREIGEGEBEN = "FREIGEGEBEN";

export function ladeRechtsDokument(locale: Locale, schluessel: RechtsSchluessel): RechtsDokument {
  return rechtsDokument(locale, schluessel);
}

export function rechtsSprachLinks(schluessel: RechtsSchluessel): Record<Locale, string> {
  return Object.fromEntries(LOCALES.map(l => [l, `/${l}/${schluessel}`])) as Record<Locale, string>;
}

/* `extra` nimmt zusätzlichen, aus Code gerenderten Inhalt auf (das Impressum
   braucht die Firmenangaben aus config/company.ts, nicht aus dem Markdown —
   sie sollen nie in einer Textdatei veralten können). Er erscheint nach dem
   eingeleiteten Markdown-Text. */
export function RechtsSeite({ locale, t, schluessel, dokument, extra }:
  { locale: Locale; t: T; schluessel: RechtsSchluessel; dokument: RechtsDokument; extra?: React.ReactNode }) {
  const sprachLinks = rechtsSprachLinks(schluessel);
  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      <main id="inhalt" className="wiz an rechtstext">
        <span className="schrittz">{t("re_eyebrow")}</span>
        <h1>{dokument.titel}</h1>
        {dokument.stand !== FREIGEGEBEN && (
          <div className="hinweisbox" role="status" style={{ marginTop: 16 }}>
            <p>{t("re_statusEntwurf")}</p>
          </div>
        )}
        <div style={{ marginTop: 22 }}>{renderMarkdown(dokument.body)}</div>
        {extra}
      </main>
    </>
  );
}
