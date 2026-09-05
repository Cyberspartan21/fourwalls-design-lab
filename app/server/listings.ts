import "server-only";
import { sql } from "./db";
import { env } from "./env";
import { alsMedia } from "@/services/storage";
import type { Locale } from "@/i18n";
import { uebersetzer } from "@/i18n";
import type { ListingDetail, Sections, Media, GeoPrecision, PropertyKind, PublisherKind, Transaction, DocumentAccess, ImageCategory } from "@/domain/listing";

/* Die einzige Stelle, die ein Inserat aus der Datenbank holt.

   Grundsätze:
   - Nur über die Sicht listing_public: sie enthält weder geom_exact noch
     Strasse. Was diese Datei nicht liest, kann sie nicht ausliefern.
   - Jeder Wert aus der Adresszeile ist ein Parameter, nie SQL-Text.
   - In der Produktion werden Demo-Inserate nicht ausgeliefert. */

const FEAT_KEYS: Record<PropertyKind, string> = {
  apartment: "w_typWohnung", house: "w_typHaus", villa: "w_typVilla", chalet: "w_typChalet",
  multi_family: "w_typMfh", commercial: "w_typGewerbe", land: "w_typGrundstueck", parking: "w_typParkplatz"
};

const gueltigeRef = (s: string) => /^FWL-\d{4}-\d{6}$/.test(s);

export async function findePubliziertesInserat(publicRef: string, locale: Locale): Promise<ListingDetail | null> {
  if (!gueltigeRef(publicRef)) return null;
  const nurEcht = env().APP_ENV === "production";

  const zeilen = await sql`
    SELECT lp.id, lp.public_ref, lp.slug, lp.transaction, lp.status, lp.is_demo,
           lp.title, lp.description, lp.content_locale,
           lp.price_chf, lp.rent_net_chf, lp.rent_extra_chf, lp.price_on_request,
           lp.available_from, lp.available_immediately, lp.published_at,
           lp.publisher_kind, lp.represented_by_org_id,
           lp.property_kind, lp.rooms, lp.living_area_m2, lp.plot_area_m2, lp.floor, lp.built_year,
           lp.postal_code, lp.city, lp.canton,
           ST_X(lp.geom_public::geometry) AS lng, ST_Y(lp.geom_public::geometry) AS lat,
           lp.geo_precision, lp.geo_radius_m,
           p.usable_area_m2, p.volume_m3, p.bedrooms, p.bathrooms, p.floors_total, p.renovated_year, p.ceiling_height_m,
           o.display_name AS org_name, o.kind AS org_kind, o.slug AS org_slug, (o.verification_state = 'verified') AS org_verified,
           ro.kind AS rep_kind,
           u.display_name AS person_name, m.public_title AS person_title, o.public_phone AS org_phone,
           c.title AS c_title, c.tagline AS c_tagline, c.sections AS c_sections, c.locale AS c_locale
      FROM listing_public lp
      JOIN listing l  ON l.id = lp.id
      JOIN property p ON p.id = lp.property_id
      LEFT JOIN organization o  ON o.id = lp.published_by_org_id
      LEFT JOIN organization ro ON ro.id = lp.represented_by_org_id
      LEFT JOIN app_user u ON u.id = COALESCE(l.assigned_user_id, l.contact_user_id)
      LEFT JOIN org_membership m ON m.user_id = u.id AND m.organization_id = o.id
      /* Inhalt in der gewünschten Sprache, sonst in der Verfassungssprache. */
      LEFT JOIN LATERAL (
        SELECT * FROM listing_content lc WHERE lc.listing_id = lp.id
         ORDER BY (lc.locale = ${locale}) DESC, (lc.locale = lp.content_locale) DESC LIMIT 1
      ) c ON true
     WHERE lp.public_ref = ${publicRef}
       AND (${nurEcht} = false OR lp.is_demo = false)
     LIMIT 1`;

  const z = zeilen[0];
  if (!z) return null;

  const [bilder, plaene, doks, merkmale] = await Promise.all([
    sql`SELECT li.sort_order, li.category, li.caption, a.storage_key, a.id AS asset_id,
               coalesce(json_agg(json_build_object('storage_key', v.storage_key, 'width', v.width, 'format', v.format)
                        ORDER BY v.width) FILTER (WHERE v.id IS NOT NULL), '[]') AS varianten
          FROM listing_image li
          JOIN media_asset a ON a.id = li.asset_id
          LEFT JOIN media_variant v ON v.asset_id = a.id
         WHERE li.listing_id = ${z.id}
         GROUP BY li.id, a.id ORDER BY li.sort_order`,
    sql`SELECT level_label, area_m2, access FROM floorplan WHERE listing_id = ${z.id} ORDER BY sort_order`,
    sql`SELECT name, doc_type, pages, access FROM listing_document WHERE listing_id = ${z.id} ORDER BY sort_order`,
    sql`SELECT f.key, f.name_de, f.name_fr, f.name_it, f.name_en
          FROM property_feature pf JOIN feature f ON f.key = pf.feature_key
         WHERE pf.property_id = (SELECT property_id FROM listing WHERE id = ${z.id})
         ORDER BY f.sort_order, f.key`
  ]);

  const t = uebersetzer(locale);
  const sections = (z.c_sections ?? {}) as Sections;

  const images: Media[] = bilder.map(b => {
    const key = String(b.storage_key).replace(/^demo\//, "").replace(/-\d+\.(jpg|webp)$/, "");
    return alsMedia(key, String(b.caption ?? z.c_title ?? z.title), (b.category as ImageCategory) ?? null,
      b.varianten as { storage_key: string; width: number; format: "jpeg" | "webp" | "avif" }[]);
  });

  /* Grundriss-Zeichnungen: eigene, erstautorisierte SVG-Dateien aus public/plans,
     nie hochgeladene. Verknüpft über den redaktionellen Inhalt. */
  const planInhalt = ((sections as { grundrisse?: { geschoss: string; datei?: string; raeume?: { name: string; m2?: number }[] }[] }).grundrisse) ?? [];

  const nameNach = (r: Record<string, unknown>) =>
    String(r[`name_${locale}`] ?? r.name_de ?? r.key);

  return {
    publicRef: z.public_ref, slug: z.slug, transaction: z.transaction as Transaction,
    status: z.status as "published" | "reserved", isDemo: Boolean(z.is_demo),
    isExclusive: z.publisher_kind === "fourwalls" && z.rep_kind === "fourwalls",
    locale, contentLocale: (z.c_locale ?? z.content_locale) as Locale,
    title: z.c_title ?? z.title, tagline: z.c_tagline ?? null, description: z.description ?? null,
    priceChf: z.price_chf == null ? null : Number(z.price_chf),
    rentNetChf: z.rent_net_chf == null ? null : Number(z.rent_net_chf),
    rentExtraChf: z.rent_extra_chf == null ? null : Number(z.rent_extra_chf),
    priceOnRequest: Boolean(z.price_on_request),
    availableFrom: z.available_from ? String(z.available_from) : null,
    availableImmediately: Boolean(z.available_immediately),
    publishedAt: String(z.published_at),
    geo: z.lng == null || z.lat == null ? null
      : { lng: Number(z.lng), lat: Number(z.lat), precision: z.geo_precision as GeoPrecision, radiusM: Number(z.geo_radius_m) },
    property: {
      kind: z.property_kind as PropertyKind,
      rooms: z.rooms == null ? null : Number(z.rooms), livingAreaM2: z.living_area_m2, usableAreaM2: z.usable_area_m2,
      plotAreaM2: z.plot_area_m2, volumeM3: z.volume_m3, bedrooms: z.bedrooms, bathrooms: z.bathrooms,
      floor: z.floor, floorsTotal: z.floors_total, builtYear: z.built_year, renovatedYear: z.renovated_year,
      ceilingHeightM: z.ceiling_height_m == null ? null : Number(z.ceiling_height_m),
      postalCode: z.postal_code, city: z.city, canton: z.canton
    },
    publisher: {
      kind: z.publisher_kind as PublisherKind, orgName: z.org_name ?? null, orgVerified: Boolean(z.org_verified),
      orgSlug: z.org_slug ?? null,
      personName: z.person_name ?? null, personTitle: z.person_title ?? null, phone: z.org_phone ?? null,
      representedByFourwalls: z.rep_kind === "fourwalls"
    },
    images,
    floorplans: plaene.map((pl, i) => ({
      level: pl.level_label, areaM2: pl.area_m2, access: pl.access as DocumentAccess,
      ...(planInhalt[i]?.datei ? { file: `/plans/${planInhalt[i]!.datei}` } : {}),
      rooms: (planInhalt[i]?.raeume ?? []).map(r => ({ name: r.name, m2: r.m2 ?? null }))
    })),
    documents: doks.map(d => ({ name: d.name, type: d.doc_type ?? "pdf", pages: d.pages, access: d.access as DocumentAccess })),
    features: merkmale.map(f => ({ key: f.key, label: nameNach(f) })),
    sections
  };
}

/* Typenbezeichnung in der Sprache der Seite. */
export const typLabel = (kind: PropertyKind, locale: Locale) => uebersetzer(locale)(FEAT_KEYS[kind]);
