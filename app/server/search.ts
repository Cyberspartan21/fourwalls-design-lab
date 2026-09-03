import "server-only";
import { z } from "zod";
import { sql } from "./db";
import { env } from "./env";

/* Kleinster ehrlicher Suchanbieter über PostGIS.

   Beweist den P3-Vertrag serverseitig: nur veröffentlichte Inserate, Art,
   Umkreis, Preis, Seiten. Es wird ausschliesslich geom_public gelesen — die
   Sicht listing_public kennt nichts anderes. Umkreis über ST_DWithin auf
   geography (Meter), getragen vom GIST-Index aus Migration 0008. */

export const SuchanfrageSchema = z.object({
  transaction: z.enum(["sale", "rent"]).default("sale"),
  lat: z.coerce.number().min(45.7).max(47.9).optional(),
  lng: z.coerce.number().min(5.9).max(10.6).optional(),
  radiusKm: z.coerce.number().min(0.5).max(50).default(10),
  priceMin: z.coerce.number().int().min(0).optional(),
  priceMax: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
});
export type Suchanfrage = z.infer<typeof SuchanfrageSchema>;

export interface Suchtreffer {
  publicRef: string; slug: string; title: string; transaction: "sale" | "rent";
  priceChf: number | null; rentNetChf: number | null; priceOnRequest: boolean;
  rooms: number | null; livingAreaM2: number | null; postalCode: string; city: string; canton: string;
  geo: { lng: number; lat: number; precision: string; radiusM: number } | null;
  distanceM: number | null; isDemo: boolean;
}
export interface Suchergebnis { total: number; page: number; pageSize: number; treffer: Suchtreffer[] }

export async function suche(q: Suchanfrage): Promise<Suchergebnis> {
  const nurEcht = env().APP_ENV === "production";
  const mitOrt = q.lat != null && q.lng != null;
  const lat = q.lat ?? 0, lng = q.lng ?? 0, radiusM = Math.round(q.radiusKm * 1000);
  const preisSpalte = q.transaction === "rent" ? sql`lp.rent_net_chf` : sql`lp.price_chf`;
  const min = q.priceMin != null ? q.priceMin * 100 : null, max = q.priceMax != null ? q.priceMax * 100 : null;

  const wo = sql`
    WHERE lp.status = 'published'
      AND lp.transaction = ${q.transaction}
      AND (${nurEcht} = false OR lp.is_demo = false)
      AND (${!mitOrt} OR ST_DWithin(lp.geom_public, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radiusM}))
      AND (${min}::bigint IS NULL OR ${preisSpalte} >= ${min}::bigint)
      AND (${max}::bigint IS NULL OR ${preisSpalte} <= ${max}::bigint)`;

  const [zaehlung, zeilen] = await Promise.all([
    sql`SELECT count(*)::int AS n FROM listing_public lp ${wo}`,
    sql`SELECT lp.public_ref, lp.slug, lp.title, lp.transaction, lp.price_chf, lp.rent_net_chf, lp.price_on_request,
               lp.rooms, lp.living_area_m2, lp.postal_code, lp.city, lp.canton, lp.is_demo,
               ST_X(lp.geom_public::geometry) AS lng, ST_Y(lp.geom_public::geometry) AS lat, lp.geo_precision, lp.geo_radius_m,
               CASE WHEN ${mitOrt} THEN ST_Distance(lp.geom_public, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) END AS distance_m
          FROM listing_public lp ${wo}
         ORDER BY distance_m NULLS LAST, lp.published_at DESC
         LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`
  ]);

  return {
    total: Number(zaehlung[0]?.n ?? 0), page: q.page, pageSize: q.pageSize,
    treffer: zeilen.map(z => ({
      publicRef: z.public_ref, slug: z.slug, title: z.title, transaction: z.transaction,
      priceChf: z.price_chf == null ? null : Number(z.price_chf), rentNetChf: z.rent_net_chf == null ? null : Number(z.rent_net_chf),
      priceOnRequest: Boolean(z.price_on_request), rooms: z.rooms == null ? null : Number(z.rooms), livingAreaM2: z.living_area_m2,
      postalCode: z.postal_code, city: z.city, canton: z.canton, isDemo: Boolean(z.is_demo),
      geo: z.lng == null ? null : { lng: Number(z.lng), lat: Number(z.lat), precision: z.geo_precision, radiusM: Number(z.geo_radius_m) },
      distanceM: z.distance_m == null ? null : Math.round(Number(z.distance_m))
    }))
  };
}
