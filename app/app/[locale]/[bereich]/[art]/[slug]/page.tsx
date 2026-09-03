import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { LOCALES, PFAD, istLocale, uebersetzer, type Locale } from "@/i18n";
import { env } from "@/server/env";
import { findePubliziertesInserat, typLabel } from "@/server/listings";
import { baueDossier } from "@/domain/dossier";
import { ObjektSeite } from "@/components/property/seite";
import type { ListingDetail } from "@/domain/listing";

/* /de/immobilien/kaufen/seehaus-walensee-fwl-2026-000142

   Die öffentliche Referenz am Ende ist der Schlüssel; der Slug davor ist
   Lesbarkeit. Stimmt er nicht (alter Slug, andere Sprache, Tippfehler), führt
   eine 301 auf die kanonische Adresse. Entwürfe sind keine Treffer — auch
   nicht mit erratener Referenz: die Sicht listing_public kennt sie nicht. */

export const dynamic = "force-dynamic";
type Params = { locale: string; bereich: string; art: string; slug: string };

const RE = /^(?:(.*)-)?(fwl-\d{4}-\d{6})$/i;

function pfad(l: Locale, d: ListingDetail) {
  const p = PFAD[l];
  return `/${l}/${p.immobilien}/${d.transaction === "rent" ? p.mieten : p.kaufen}/${d.slug}-${d.publicRef.toLowerCase()}`;
}

async function laden(params: Promise<Params>) {
  const { locale, bereich, art, slug } = await params;
  if (!istLocale(locale)) notFound();
  const m = RE.exec(slug); if (!m) notFound();
  const ref = m[2]!.toUpperCase();
  const d = await findePubliziertesInserat(ref, locale);
  if (!d) notFound();
  const p = PFAD[locale];
  const kanonisch = pfad(locale, d);
  const gewollt = `/${locale}/${bereich}/${art}/${slug}`;
  return { locale, d, kanonisch, umleiten: gewollt !== kanonisch || bereich !== p.immobilien };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, d, kanonisch } = await laden(params);
  const site = env().NEXT_PUBLIC_SITE_URL;
  const t = uebersetzer(locale);
  const story = d.sections.story?.absaetze[0] ?? d.description ?? d.tagline ?? "";
  const beschreibung = (d.tagline ? d.tagline + " " : "") + story;
  return {
    title: `${d.title} · ${d.property.postalCode} ${d.property.city} — Fourwalls`,
    description: beschreibung.length > 158 ? beschreibung.slice(0, 155).replace(/\s+\S*$/, "") + "…" : beschreibung,
    alternates: { canonical: site + kanonisch, languages: Object.fromEntries(LOCALES.map(l => [l, site + pfad(l, d)])) },
    robots: d.isDemo && env().APP_ENV !== "development" ? { index: false } : undefined,
    openGraph: { title: d.title, description: d.tagline ?? undefined, url: site + kanonisch, images: d.images[0]?.sources.jpeg.find(s => s.width === 1600)?.url ? [site + d.images[0].sources.jpeg.find(s => s.width === 1600)!.url] : [] },
    other: { "fw:typ": typLabel(d.property.kind, locale), "fw:demo": String(d.isDemo), "fw:t": t("exclusive") }
  };
}

export default async function Seite({ params }: { params: Promise<Params> }) {
  const { locale, d, kanonisch, umleiten } = await laden(params);
  if (umleiten) permanentRedirect(kanonisch);
  const t = uebersetzer(locale);
  const dossier = baueDossier(d, t, locale, typLabel(d.property.kind, locale));
  const site = env().NEXT_PUBLIC_SITE_URL;

  /* Strukturierte Daten: nur, was belegt ist. Keine Bewertungen, keine
     Verfügbarkeitsversprechen, keine erfundenen Organisationsangaben. */
  const ld = {
    "@context": "https://schema.org", "@type": "RealEstateListing",
    name: d.title, url: site + kanonisch, datePosted: d.publishedAt.slice(0, 10),
    ...(d.tagline ? { description: d.tagline } : {}),
    ...(d.images[0] ? { image: site + (d.images[0].sources.jpeg.find(s => s.width === 1600)?.url ?? "") } : {}),
    ...(d.priceChf && !d.priceOnRequest ? { offers: { "@type": "Offer", price: d.priceChf / 100, priceCurrency: "CHF" } } : {}),
    about: { "@type": d.property.kind === "apartment" ? "Apartment" : "House", address: { "@type": "PostalAddress", postalCode: d.property.postalCode, addressLocality: d.property.city, addressRegion: d.property.canton, addressCountry: "CH" } }
  };
  const ldText = JSON.stringify(ld).replace(/</g, "\\u003c");

  return (
    <>
      {/* eslint-disable-next-line react/no-danger -- JSON.stringify mit maskiertem «<»; das übliche, sichere Muster für JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldText }} />
      <ObjektSeite d={dossier} t={t} locale={locale} />
    </>
  );
}
