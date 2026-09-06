import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { istLocale, DEFAULT_LOCALE, LOCALES, PFAD, type Locale } from "@/i18n";
import { seoMeta, jsonLd } from "@/lib/seo";
import { env } from "@/server/env";
import { Kopf } from "@/components/site/kopf";
import { wissen, wissenBody } from "@/lib/wissen";
import de from "@/i18n/messages/de/wissen.json";
import fr from "@/i18n/messages/fr/wissen.json";
import it from "@/i18n/messages/it/wissen.json";
import en from "@/i18n/messages/en/wissen.json";

/* Wissensseiten, Detail (P5.9 Phase B, Entscheid 24). Fliesstext-Layout wie
   die Rechtsseiten (components/rechtliches/rechtsseite.tsx): dieselben
   Klassen `wiz an rechtstext`, derselbe renderMarkdown() (lib/markdown.ts,
   über lib/wissen.ts:wissenBody). Der Slug ist in allen Sprachen identisch
   (lib/wissen.ts), darum ist derselbe Pfad `/${l}/wissen/<slug>` in jeder
   Sprache canonical für sich selbst — kein Slug-Mapping nötig. */
const WS: Record<Locale, Record<string, string>> = { de, fr, it, en };
function ws(locale: Locale, key: string): string { return WS[locale]?.[key] ?? WS.de[key] ?? key; }

type Params = { locale: string; slug: string };
function localeAus(roh: string): Locale { return istLocale(roh) ? roh : DEFAULT_LOCALE; }
const PFAD_WISSEN = "wissen";

/* Ein CTA je Absicht — dieselbe Zuordnung wie im Auftrag (P5.9 Phase B):
   verkaufen → /verkaufen und /bewertung, bewerten → /bewertung,
   mieten → Mietsuche, vermieten → /vermieten, verwalten → /verwalten,
   wissen → /ueber-fourwalls. */
function ctaLinks(locale: Locale, absicht: string): { href: string; text: string }[] {
  const p = PFAD[locale];
  switch (absicht) {
    case "verkaufen":
      return [
        { href: `/${locale}/verkaufen`, text: ws(locale, "ws_cta_verkaufen_mitFw") },
        { href: `/${locale}/bewertung`, text: ws(locale, "ws_cta_verkaufen_bewertung") }
      ];
    case "bewerten":
      return [{ href: `/${locale}/bewertung`, text: ws(locale, "ws_cta_bewerten") }];
    case "mieten":
      return [{ href: `/${locale}/${p.immobilien}/${p.mieten}`, text: ws(locale, "ws_cta_mieten") }];
    case "vermieten":
      return [{ href: `/${locale}/vermieten`, text: ws(locale, "ws_cta_vermieten") }];
    case "verwalten":
      return [{ href: `/${locale}/verwalten`, text: ws(locale, "ws_cta_verwalten") }];
    default:
      return [{ href: `/${locale}/ueber-fourwalls`, text: ws(locale, "ws_cta_wissen") }];
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale: roh, slug } = await params;
  const locale = localeAus(roh);
  const dokument = wissen(locale, slug);
  if (!dokument) return {};
  return seoMeta({
    locale,
    pfade: Object.fromEntries(LOCALES.map(l => [l, `/${l}/${PFAD_WISSEN}/${slug}`])) as Record<Locale, string>,
    titel: `${dokument.titel}`,
    beschreibung: dokument.beschreibung,
    ogTyp: "article"
  });
}

export default async function WissenDetailSeite({ params }: { params: Promise<Params> }) {
  const { locale: roh, slug } = await params;
  const locale = localeAus(roh);
  const dokument = wissen(locale, slug);
  if (!dokument) notFound();

  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/${PFAD_WISSEN}/${slug}`])) as Record<Locale, string>;
  const verwandte = dokument.verwandt.map(s => wissen(locale, s)).filter((d): d is NonNullable<typeof d> => d !== null);
  const site = env().NEXT_PUBLIC_SITE_URL;
  const kanon = site + `/${locale}/${PFAD_WISSEN}/${slug}`;

  const ld = {
    "@context": "https://schema.org", "@type": "Article",
    headline: dokument.titel, description: dokument.beschreibung,
    datePublished: dokument.aktualisiert, dateModified: dokument.aktualisiert,
    inLanguage: locale,
    author: { "@type": "Organization", name: "Fourwalls" },
    mainEntityOfPage: kanon
  };

  return (
    <>
      {/* eslint-disable-next-line react/no-danger -- JSON.stringify mit maskiertem «<» (lib/seo.ts jsonLd()); das übliche, sichere Muster für JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      <main className="wiz an rechtstext">
        <span className="schrittz">{ws(locale, "ws_wissenWort")}</span>
        <h1>{dokument.titel}</h1>
        <p style={{ marginTop: 14 }}>{dokument.beschreibung}</p>

        <div style={{ marginTop: 22 }}>{wissenBody(dokument)}</div>

        <div className="hinweisbox" style={{ marginTop: 32 }}>
          <p>{ws(locale, "ws_aktualisiert").replace("{datum}", new Intl.DateTimeFormat(`${locale}-CH`, { dateStyle: "long" }).format(new Date(dokument.aktualisiert)))}</p>
        </div>

        {dokument.quellen.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h3>{ws(locale, "ws_quellen")}</h3>
            <ul>{dokument.quellen.map((q, i) => <li key={i}>{q}</li>)}</ul>
          </section>
        )}

        {verwandte.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h3>{ws(locale, "ws_verwandteBeitraege")}</h3>
            <ul>{verwandte.map(v => <li key={v.slug}><a href={`/${locale}/${PFAD_WISSEN}/${v.slug}`}>{v.titel}</a></li>)}</ul>
          </section>
        )}

        <section style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--linie)", display: "flex", gap: 12, flexWrap: "wrap" }}>
          {ctaLinks(locale, dokument.absicht).map(c => <a key={c.href} className="knopf" href={c.href}>{c.text}</a>)}
        </section>
      </main>
    </>
  );
}
