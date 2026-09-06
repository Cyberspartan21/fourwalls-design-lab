import { rechtsseiteFreigegeben } from "@/config/start-tor";
import type { MetadataRoute } from "next";
import { LOCALES, DEFAULT_LOCALE, PFAD, type Locale } from "@/i18n";
import { env } from "@/server/env";
import { sql } from "@/server/db";
import { wissenEintraege } from "@/lib/seo";

/* Die Sitemap (P5.9 Phase B) — nur öffentliche, indexierbare Adressen:
   Startseite, kaufen/mieten-Basis, veröffentlichte Inserate, aktive
   Anbieterseiten, Service-Landeseiten, Rechts-/Vertrauensseiten (feste
   Liste, siehe RECHTS_UND_VERTRAUEN) und — sobald gefüllt — Wissensseiten
   (lib/seo.ts wissenEintraege()). KEIN Eintrag für Formulare, Konto,
   Intern, Moderation, Vorschau, Vergleich, Suchabo-Zustände oder
   Demo-Technikrouten — dieselbe Grenze wie in lib/seo.ts beschrieben.

   Jede Ressource bekommt EINEN Eintrag je Sprache (nicht nur einen mit
   Alternates) — Google empfiehlt, jede Sprachversion selbst als <url>
   aufzunehmen, mit demselben vollständigen Alternates-Block (inkl.
   Selbstverweis). Next.js' eigenes Beispiel (docs/.../sitemap.md) zeigt nur
   einen Eintrag je Ressource; hier bewusst einer je Sprache.

   `is_demo`: dieselbe Regel wie das noindex der Objektseite
   (app/[locale]/[bereich]/[art]/[slug]/page.tsx) — Demo-Inserate erscheinen
   nur, wenn APP_ENV=development ist.

   45'000-Grenze (Google: max. 50'000 URLs/Sitemap): mit vier Sprachen pro
   Ressource ist sie bei rund 11'250 Inseraten/Anbietern erreicht. Heute weit
   davon entfernt; sobald nötig, teilt `generateSitemaps` (siehe
   node_modules/next/dist/docs/.../generate-sitemaps.md) die Ausgabe in
   mehrere /sitemap/<id>.xml auf — hier bewusst noch nicht umgesetzt. */
export const dynamic = "force-dynamic";

const RECHTSSEITEN = ["impressum", "datenschutz", "agb", "inseratsbedingungen", "anbieterbedingungen"] as const;
const VERTRAUENSSEITE = "ueber-fourwalls";
const SERVICES = ["verkaufen", "vermieten", "bewertung", "verwalten", "beratung"] as const;

type Eintrag = MetadataRoute.Sitemap[number];

/* Ein Eintrag je Sprache, alle mit demselben vollständigen Alternates-Block
   (inkl. x-default → Deutsch). */
function mehrsprachig(pfade: Record<Locale, string>, lastModified?: Date | string): Eintrag[] {
  const site = env().NEXT_PUBLIC_SITE_URL;
  const languages: Record<string, string> = { "x-default": site + pfade[DEFAULT_LOCALE] };
  for (const l of LOCALES) languages[l] = site + pfade[l];
  return LOCALES.map(l => ({
    url: site + pfade[l],
    ...(lastModified !== undefined ? { lastModified } : {}),
    alternates: { languages }
  }));
}

function objektPfade(publicRef: string, slug: string, transaction: string): Record<Locale, string> {
  const art = transaction === "rent" ? "mieten" : "kaufen";
  return Object.fromEntries(LOCALES.map(l => {
    const p = PFAD[l];
    return [l, `/${l}/${p.immobilien}/${art === "mieten" ? p.mieten : p.kaufen}/${slug}-${publicRef.toLowerCase()}`];
  })) as Record<Locale, string>;
}

function anbieterPfade(slug: string): Record<Locale, string> {
  return Object.fromEntries(LOCALES.map(l => [l, `/${l}/${PFAD[l].anbieter}/${slug}`])) as Record<Locale, string>;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const inDev = env().APP_ENV === "development";
  const eintraege: Eintrag[] = [];

  /* Startseite */
  eintraege.push(...mehrsprachig(Object.fromEntries(LOCALES.map(l => [l, `/${l}`])) as Record<Locale, string>));

  /* kaufen/mieten-Basis (ohne Filter) */
  for (const art of ["kaufen", "mieten"] as const) {
    eintraege.push(...mehrsprachig(Object.fromEntries(LOCALES.map(l => {
      const p = PFAD[l];
      return [l, `/${l}/${p.immobilien}/${art === "mieten" ? p.mieten : p.kaufen}`];
    })) as Record<Locale, string>));
  }

  /* Service-Landeseiten — derselbe Pfad in jeder Sprache (siehe
     app/[locale]/verkaufen/page.tsx u.a.: sprachLinks = `/${l}/verkaufen`). */
  for (const dienst of SERVICES) {
    eintraege.push(...mehrsprachig(Object.fromEntries(LOCALES.map(l => [l, `/${l}/${dienst}`])) as Record<Locale, string>));
  }

  /* Rechts-/Vertrauensseiten — feste Liste. WP4 baut diese Routen
     (app/[locale]/{impressum,datenschutz,agb,inseratsbedingungen,
     anbieterbedingungen,ueber-fourwalls}); die Sitemap nimmt sie ungeprüft
     auf, sobald diese Datei läuft — ob die Route zum Zeitpunkt eines
     bestimmten Sitemap-Aufrufs schon existiert, hängt vom Stand des
     WP4-Auftrags ab (siehe Bericht). */
  /* Rechtsseiten nur, wenn freigegeben (sonst tragen sie noindex, siehe
     components/rechtliches/rechtsseite.tsx) — die Vertrauensseite immer. */
  const freigegebeneRechtsseiten = RECHTSSEITEN.filter(k => rechtsseiteFreigegeben(k));
  for (const seite of [...freigegebeneRechtsseiten, VERTRAUENSSEITE]) {
    eintraege.push(...mehrsprachig(Object.fromEntries(LOCALES.map(l => [l, `/${l}/${seite}`])) as Record<Locale, string>));
  }

  /* Veröffentlichte Inserate — published und reserved (dieselben Status,
     die die Objektseite selbst ausliefert, findePubliziertesInserat()),
     Demo-Bestand nur in development. */
  const inserate = await sql`
    SELECT lp.public_ref, lp.slug, lp.transaction, lp.published_at
      FROM listing_public lp
     WHERE (${inDev} = true OR lp.is_demo = false)`;
  for (const z of inserate) {
    const pfade = objektPfade(String(z.public_ref), String(z.slug), String(z.transaction));
    eintraege.push(...mehrsprachig(pfade, z.published_at as Date));
  }

  /* Aktive Anbieter (nicht stillgelegt) — dieselbe Bedingung wie
     server/anbieter.ts:anbieterProfil(). */
  const anbieter = await sql`SELECT slug, updated_at FROM organization WHERE is_active AND archived_at IS NULL`;
  for (const z of anbieter) {
    eintraege.push(...mehrsprachig(anbieterPfade(String(z.slug)), z.updated_at as Date));
  }

  /* Wissensseiten (/wissen/<slug>) — Erweiterungsstelle, heute leer
     (lib/seo.ts wissenEintraege(), die Route existiert noch nicht). */
  for (const w of wissenEintraege()) {
    eintraege.push(...mehrsprachig(Object.fromEntries(LOCALES.map(l => [l, `/${l}/wissen${w.slug ? "/" + w.slug : ""}`])) as Record<Locale, string>, w.lastModified));
  }

  return eintraege;
}
