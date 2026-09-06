import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { LOCALES, PFAD, istLocale, uebersetzer, type Locale } from "@/i18n";
import { env } from "@/server/env";
import { seoMeta, jsonLd } from "@/lib/seo";
import { anbieterProfil, type AnbieterProfil } from "@/server/anbieter";
import { woerter } from "@/components/marktplatz/labels";
import { Karte, objektPfad } from "@/components/marktplatz/karte";
import { Kopf } from "@/components/site/kopf";
import { AUSSAGEN } from "@/config/policy";
import an_de from "@/i18n/messages/de/anbieter.json";
import an_fr from "@/i18n/messages/fr/anbieter.json";
import an_it from "@/i18n/messages/it/anbieter.json";
import an_en from "@/i18n/messages/en/anbieter.json";

/* Gemeinsame Ladelogik und Darstellung der öffentlichen Anbieterseite
   (P5.7 §10, §11, §43, §53) — von VIER Routen genutzt, je einer pro
   sprachabhängigem Pfadwort (siehe PFAD[locale].anbieter):

     app/[locale]/anbieter/[slug]/page.tsx      (de)
     app/[locale]/prestataires/[slug]/page.tsx  (fr)
     app/[locale]/operatori/[slug]/page.tsx     (it)
     app/[locale]/publishers/[slug]/page.tsx    (en)

   Diese Aufteilung in vier LITERALE Ordner (statt eines einzigen dynamischen)
   ist nötig, weil `[locale]/[bereich]` bereits die eine erlaubte dynamische
   Position auf dieser Ebene belegt (Objektseite, P5.2) — Next.js lässt keine
   zweite, anders benannte dynamische Position an derselben Stelle zu. Vier
   statische Ordner stören das nicht; sie haben Vorrang vor `[bereich]` und
   verweisen bei falschem Wort/falscher Sprache per 301 auf das kanonische
   Pfadwort (dasselbe Muster wie bei der Objektseite).

   Diese Datei liegt unter `_anbieter/` (Unterstrich = privater Ordner, siehe
   Next.js-Konvention) und ist deshalb selbst keine Route. */

type Params = { locale: string; slug: string };

/* Eigene, UNREGISTRIERTE Übersetzung (i18n/index.ts ist tabu, siehe Auftrag).
   Vier flache Wörterbücher, dieselbe Rückfalllogik wie uebersetzer(). */
const AN: Record<Locale, Record<string, string>> = { de: an_de, fr: an_fr, it: an_it, en: an_en };
function anT(locale: Locale) {
  const k = AN[locale], de = AN.de;
  return (key: string): string => k[key] ?? de[key] ?? key;
}

/* Art des Anbieters → übersetztes Label. `fourwalls` kommt auf dieser
   öffentlichen Profilseite praktisch nie vor (Fourwalls hat keine eigene
   Anbieterseite in diesem Sinn) — bleibt deshalb ohne Label. */
const ART_LABEL: Partial<Record<AnbieterProfil["kind"], string>> = {
  agency: "an_artAgentur",
  property_manager: "an_artVerwaltung",
  developer: "an_artBautraeger",
  institutional: "an_artInstitutionell"
};

export function pfadAnbieter(l: Locale, slug: string): string {
  return `/${l}/${PFAD[l].anbieter}/${slug}`;
}

async function laden(params: Promise<Params>, wort: string) {
  const { locale, slug } = await params;
  if (!istLocale(locale)) notFound();
  const profil = await anbieterProfil(slug);
  if (!profil) notFound();
  const kanonisch = pfadAnbieter(locale, profil.slug);
  const wortStimmt = PFAD[locale].anbieter === wort;
  return { locale, profil, kanonisch, umleiten: !wortStimmt };
}

export async function generateAnbieterMetadata(params: Promise<Params>, wort: string): Promise<Metadata> {
  const { locale, profil } = await laden(params, wort);
  const beschreibung = profil.description
    ? (profil.description.length > 158 ? profil.description.slice(0, 155).replace(/\s+\S*$/, "") + "…" : profil.description)
    : profil.displayName;
  const pfade = Object.fromEntries(LOCALES.map(l => [l, pfadAnbieter(l, profil.slug)])) as Record<Locale, string>;
  /* Kein robots-Eintrag: Anbieterseiten sind öffentlich und indexierbar
     (seoMeta() indexiert per Voreinstellung). */
  return seoMeta({ locale, pfade, titel: profil.displayName, beschreibung, ogTyp: "website" });
}

export async function AnbieterSeiteRoute({ params, wort }: { params: Promise<Params>; wort: string }) {
  const { locale, profil, kanonisch, umleiten } = await laden(params, wort);
  if (umleiten) permanentRedirect(kanonisch);

  const t = anT(locale);
  const haupt = uebersetzer(locale);
  const w = woerter(haupt);
  const pfad = PFAD[locale];
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, pfadAnbieter(l, profil.slug)])) as Record<Locale, string>;
  const artKey = ART_LABEL[profil.kind];
  const ort = [profil.postalCode, profil.city].filter(Boolean).join(" ");
  const site = env().NEXT_PUBLIC_SITE_URL;

  /* Organisation: nur, was diese Seite tatsächlich zeigt — kein Bewertungs-,
     kein RealEstateAgent-Markup, keine Zahl, die hier nicht steht (§Auftrag). */
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org", "@type": "Organization",
    name: profil.displayName, url: site + kanonisch,
    ...(profil.logo?.sources.jpeg[0]?.url ? { logo: site + profil.logo.sources.jpeg[0].url } : {}),
    ...(ort ? { address: { "@type": "PostalAddress", postalCode: profil.postalCode ?? undefined, addressLocality: profil.city ?? undefined, addressCountry: "CH" } } : {}),
    ...(profil.publicPhone ? { telephone: profil.publicPhone } : {}),
    ...(profil.publicEmail ? { email: profil.publicEmail } : {})
  };

  return (
    <>
      {/* eslint-disable-next-line react/no-danger -- JSON.stringify mit maskiertem «<» (lib/seo.ts jsonLd()); das übliche, sichere Muster für JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      <main id="inhalt" className="wiz an" style={{ maxWidth: 980 }}>
        {/* Logo: die kleinste WebP-Ableitung, JPEG als Rückfall — Adressen kommen
            aus dem Speicheranbieter (pub/), nie aus einem Upload-Pfad (§44). */}
        {profil.logo && profil.logo.sources.jpeg[0] && (
          <picture>
            {profil.logo.sources.webp[0] && <source type="image/webp" srcSet={profil.logo.sources.webp[0].url} />}
            <img src={profil.logo.sources.jpeg[0].url} alt="" width={96} height={96}
              style={{ width: 96, height: 96, objectFit: "contain", display: "block", marginBottom: 14 }} />
          </picture>
        )}
        {/* h1 statt h2: einzige Hauptüberschrift der Seite (P5.9 Phase B).
           styles/portal.css stylt `.wiz h2` per Tag-Selektor, nicht `.wiz h1`
           (styles/*.css liegen ausserhalb dieses Auftrags) — die bisherige
           Optik (Petrona, Gewicht 300, gleiche Grösse) bleibt hier deshalb
           inline erhalten, statt eine neue globale Regel zu ergänzen. Inhalt
           inkl. der «verifiziert»-Zeile unverändert (WP1-Zeile, siehe Auftrag). */}
        <h1 style={{ fontFamily: "var(--d)", fontWeight: 300, fontSize: "clamp(1.5rem,3vw,2.3rem)", marginTop: 8, letterSpacing: "-.015em" }}>
          {profil.displayName}
          {(AUSSAGEN.identitaetGeprueft.stand as string) === "bestaetigt" && profil.verificationState === "verified" && <span className="q"> · {w.geprueft}</span>}
        </h1>
        {artKey && <p style={{ color: "var(--leise)" }}>{t(artKey)}</p>}
        {ort && <p>{ort}</p>}
        {profil.website && (
          <p><a href={profil.website} target="_blank" rel="noopener noreferrer nofollow">{t("an_website")}</a></p>
        )}
        {(profil.publicEmail || profil.publicPhone) && (
          <p>
            <strong>{t("an_kontakt")}</strong><br />
            {profil.publicEmail && <a href={`mailto:${profil.publicEmail}`}>{profil.publicEmail}</a>}
            {profil.publicEmail && profil.publicPhone && <br />}
            {profil.publicPhone && <a href={`tel:${profil.publicPhone}`}>{profil.publicPhone}</a>}
          </p>
        )}
        {profil.description && <p style={{ maxWidth: "60ch" }}>{profil.description}</p>}

        <h2>{t("an_inserate")}</h2>
        {profil.aktiveInserate.length ? (
          <div className="gitter">
            {profil.aktiveInserate.map(l => <Karte key={l.id} l={l} w={w} locale={locale} href={objektPfad(locale, pfad, l)} />)}
          </div>
        ) : <p>{t("an_keineInserate")}</p>}
      </main>
    </>
  );
}
