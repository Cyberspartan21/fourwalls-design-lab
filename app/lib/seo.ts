import "server-only";
import type { Metadata } from "next";
import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/i18n";
import { env } from "@/server/env";
import { alleWissen } from "./wissen.ts";

/* Technisches SEO an einer Stelle (P5.9 Phase B, Entscheid 26) — jede Seite,
   die Metadaten setzt, tut das über `seoMeta()` oder die Konstante
   `NOINDEX`, statt selbst Canonical/hreflang/OpenGraph zu bauen.

   Regel, verbindlich für alle Seiten in dieser Anwendung:
   - Öffentliche, informative Seiten (Startseite, Suchseiten, Objektseiten,
     Anbieterseiten, Service-Landeseiten, Rechts-/Vertrauensseiten,
     Wissensseiten) bekommen `seoMeta()`: Canonical, hreflang je Sprache
     (inkl. x-default → Deutsch), OpenGraph, Titel, Beschreibung.
   - Formulare (alle …/anfrage-Seiten), Konto und alle Unterseiten, der
     interne Bereich, Moderation, Vorschau, Vergleich, Merkliste/Suchabos
     und jeder Auth-Fluss (anmelden/registrieren/passwort/einladung)
     bekommen `NOINDEX`: kein Canonical, kein hreflang — ihre Adresse zeigt
     je nach Sitzung anderen Inhalt oder ist nie ein sinnvolles Suchziel. */

export type OgTyp = "website" | "article";

export interface SeoMetaOptionen {
  locale: Locale;
  /* Relativer Pfad je Sprache, z. B. { de: "/de/verkaufen", fr: "/fr/verkaufen", … } */
  pfade: Record<Locale, string>;
  titel: string;
  beschreibung: string;
  /* Fehlt robots, ist die Seite indexierbar (Standard). */
  robots?: { index: boolean; follow: boolean } | undefined;
  /* Absolute oder von NEXT_PUBLIC_SITE_URL aus relative Bild-URL. */
  ogBild?: string;
  ogTyp?: OgTyp;
}

export function seoMeta(opt: SeoMetaOptionen): Metadata {
  const site = env().NEXT_PUBLIC_SITE_URL;
  const absolut = (pfad: string) => (pfad.startsWith("http") ? pfad : site + pfad);
  const kanon = absolut(opt.pfade[opt.locale]);

  const languages: Record<string, string> = { "x-default": absolut(opt.pfade[DEFAULT_LOCALE]) };
  for (const l of LOCALES) languages[l] = absolut(opt.pfade[l]);

  const robots = opt.robots ?? { index: true, follow: true };

  return {
    title: opt.titel,
    description: opt.beschreibung,
    alternates: { canonical: kanon, languages },
    openGraph: {
      title: opt.titel,
      description: opt.beschreibung,
      url: kanon,
      siteName: "Fourwalls",
      locale: `${opt.locale}_CH`,
      type: opt.ogTyp ?? "website",
      ...(opt.ogBild ? { images: [absolut(opt.ogBild)] } : {})
    },
    robots
  };
}

/* Für reine NOINDEX-Seiten: kein Canonical, kein hreflang (siehe Regel
   oben). Seiten setzen zusätzlich einen eigenen `title`. */
export const NOINDEX: Metadata = { robots: { index: false, follow: false } };

/* JSON-LD sicher in ein <script>-Tag: `<` maskiert, damit kein
   eingebettetes `</script>` das umgebende Markup aufbricht — das übliche,
   sichere Muster für dangerouslySetInnerHTML mit JSON.stringify. */
export function jsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

/* Sitemap-Einträge für die Wissensseiten (P5.9 Phase B, Entscheid 24):
   die Übersicht (/wissen) und die sieben veröffentlichten Beiträge
   (/wissen/<slug>). Slugs sind in allen vier Sprachen identisch
   (lib/wissen.ts) — ein Aufruf mit DEFAULT_LOCALE genügt, app/sitemap.ts
   vervielfacht selbst auf LOCALES.

   app/sitemap.ts baut aus jedem Eintrag `/${l}/wissen/${w.slug}` — für die
   Übersicht ist `slug` deshalb bewusst ein leerer String, was
   `/${l}/wissen/` ergibt (mit abschliessendem Schrägstrich). Next
   normalisiert das mit einem 308 auf die kanonische Adresse `/${l}/wissen`
   (next.config.ts setzt `trailingSlash` nicht, Standard ist die
   Normalisierung) — funktional korrekt, auch wenn eine Suchmaschine damit
   eine weiterleitende statt der kanonischen Adresse sieht. app/sitemap.ts
   selbst wird durch diesen Auftrag nicht verändert (siehe Auftrag). */
export function wissenEintraege(): { slug: string; lastModified: string }[] {
  const beitraege = alleWissen(DEFAULT_LOCALE);
  const uebersichtStand = beitraege.reduce((max, d) => (d.aktualisiert > max ? d.aktualisiert : max), "");
  return [
    { slug: "", lastModified: uebersichtStand },
    ...beitraege.map(d => ({ slug: d.slug, lastModified: d.aktualisiert }))
  ];
}
