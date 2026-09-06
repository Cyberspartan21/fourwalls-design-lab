import type { Metadata } from "next";
import { istLocale, DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n";
import { seoMeta } from "@/lib/seo";
import { Kopf } from "@/components/site/kopf";
import { alleWissen } from "@/lib/wissen";
import de from "@/i18n/messages/de/wissen.json";
import fr from "@/i18n/messages/fr/wissen.json";
import it from "@/i18n/messages/it/wissen.json";
import en from "@/i18n/messages/en/wissen.json";

/* Wissensseiten, Übersicht (P5.9 Phase B, Entscheid 24) — sieben kleine,
   nützliche Beiträge, kein Ratgeber-Portal. Slugs sind in allen Sprachen
   identisch (lib/wissen.ts), darum ist derselbe Pfad `/${l}/wissen` in jeder
   Sprache canonical für sich selbst.

   i18n/messages/<locale>/wissen.json (Präfix ws_) ist bewusst NICHT in
   i18n/index.ts registriert — dasselbe Muster wie service.json
   (app/[locale]/verkaufen/page.tsx): ein lokaler, ungebündelter Katalog,
   gelesen ohne den globalen uebersetzer(). */
const WS: Record<Locale, Record<string, string>> = { de, fr, it, en };
function ws(locale: Locale, key: string): string { return WS[locale]?.[key] ?? WS.de[key] ?? key; }

const ABSICHT_LABEL: Record<string, string> = {
  verkaufen: "ws_absicht_verkaufen", bewerten: "ws_absicht_bewerten", mieten: "ws_absicht_mieten",
  vermieten: "ws_absicht_vermieten", verwalten: "ws_absicht_verwalten", wissen: "ws_absicht_wissen"
};

type Params = { locale: string };
function localeAus(roh: string): Locale { return istLocale(roh) ? roh : DEFAULT_LOCALE; }
const PFAD_WISSEN = "wissen";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const locale = localeAus((await params).locale);
  const titel = ws(locale, "ws_wissenWort");
  return seoMeta({
    locale,
    pfade: Object.fromEntries(LOCALES.map(l => [l, `/${l}/${PFAD_WISSEN}`])) as Record<Locale, string>,
    titel: `${titel}`,
    beschreibung: ws(locale, "ws_uebersichtLead")
  });
}

export default async function WissenUebersicht({ params }: { params: Promise<Params> }) {
  const locale = localeAus((await params).locale);
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/${PFAD_WISSEN}`])) as Record<Locale, string>;
  const beitraege = alleWissen(locale);
  const titel = ws(locale, "ws_wissenWort");

  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      <main id="inhalt" className="wiz an rechtstext">
        <span className="schrittz">{titel}</span>
        <h1>{titel}</h1>
        <p style={{ marginTop: 14 }}>{ws(locale, "ws_uebersichtLead")}</p>

        <div style={{ marginTop: 30, display: "grid", gap: 26 }}>
          {beitraege.map(b => (
            <article key={b.slug}>
              <span className="schrittz">{ws(locale, ABSICHT_LABEL[b.absicht] ?? "ws_absicht_wissen")}</span>
              <h2 style={{ marginTop: 4 }}><a href={`/${locale}/${PFAD_WISSEN}/${b.slug}`}>{b.titel}</a></h2>
              <p>{b.beschreibung}</p>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
