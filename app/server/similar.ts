import "server-only";
import { sql } from "./db";
import { env } from "./env";
import { alsTreffer } from "./search";
import type { Treffer } from "@/domain/marktplatz";

/* Ähnliche Objekte — deterministisch, erklärbar, in SQL.

   Dieselbe Punktzahl wie FWP.aehnliche() im Prototyp:
     Pflicht: gleiche Transaktion, gleiche Objektart, veröffentlicht (frei),
              nicht das Objekt selbst, Preis innerhalb ±35 % (wenn beide einen haben)
     Punkte:  Objektart +40 · gleicher Kanton +20 · gleiche Gemeinde +15
              Preisnähe bis +20 · Zimmer bis +10 · Wohnfläche bis +10
     Reihenfolge: Punkte absteigend, dann öffentliche Referenz — stabil.
   Kein Zufall, keine KI, keine Bezahlung. Entwürfe können nie erscheinen:
   gelesen wird `listing_public`, gefiltert auf status = published. */

export async function aehnliche(publicRef: string, n = 3): Promise<Treffer[]> {
  const nurEcht = env().APP_ENV === "production";
  const zeilen = await sql`
    WITH b AS (
      SELECT lp.id, lp.transaction, lp.property_kind, lp.canton, lp.place_id, lp.city, lp.rooms, lp.living_area_m2,
             CASE WHEN lp.transaction = 'rent' THEN lp.rent_net_chf ELSE lp.price_chf END AS wert
        FROM listing_public lp WHERE lp.public_ref = ${publicRef}
    ),
    kand AS (
      SELECT lp.*, b.wert AS basis, b.rooms AS b_rooms, b.living_area_m2 AS b_fl, b.canton AS b_kt, b.place_id AS b_place, b.city AS b_city,
             CASE WHEN lp.transaction = 'rent' THEN lp.rent_net_chf ELSE lp.price_chf END AS wert
        FROM listing_public lp, b
       WHERE lp.status = 'published' AND lp.public_ref <> ${publicRef}
         AND lp.transaction = b.transaction AND lp.property_kind = b.property_kind
         AND (${nurEcht} = false OR lp.is_demo = false)
    ),
    punkte AS (
      SELECT k.*,
             40
             + (k.canton = k.b_kt)::int * 20
             + (COALESCE(k.place_id = k.b_place, k.city = k.b_city))::int * 15
             + CASE WHEN k.basis IS NOT NULL AND k.wert IS NOT NULL THEN
                 CASE WHEN abs(k.wert - k.basis)::numeric / k.basis <= 0.35 THEN round(20 * (1 - (abs(k.wert - k.basis)::numeric / k.basis) / 0.35)) ELSE -1000 END
               ELSE 0 END
             + CASE WHEN k.b_rooms IS NOT NULL AND k.rooms IS NOT NULL THEN greatest(0, 10 - abs(k.rooms - k.b_rooms) * 4) ELSE 0 END
             + CASE WHEN k.b_fl IS NOT NULL AND k.living_area_m2 IS NOT NULL THEN greatest(0, 10 - abs(k.living_area_m2 - k.b_fl) / 12.0) ELSE 0 END
             AS p
        FROM kand k
    )
    SELECT p.public_ref, p.slug, p.transaction, p.property_kind, p.title, p.city, p.postal_code, p.canton,
           ST_X(p.geom_public::geometry) AS lng, ST_Y(p.geom_public::geometry) AS lat, p.geo_precision, p.geo_radius_m,
           p.price_chf, p.price_on_request, p.rent_net_chf, p.rent_extra_chf, p.rooms, p.living_area_m2, p.plot_area_m2, p.floor, p.built_year,
           p.publisher_kind, p.represented_by_org_id, p.status, p.available_immediately, p.available_from, p.published_at,
           (SELECT regexp_replace(a.storage_key, '^demo/(.*)-\\d+\\.[a-z]+$', '\\1') FROM listing_image li JOIN media_asset a ON a.id = li.asset_id WHERE li.listing_id = p.id ORDER BY li.is_cover DESC, li.sort_order LIMIT 1) AS img,
           EXISTS (SELECT 1 FROM organization o WHERE o.id = p.published_by_org_id AND o.verified_at IS NOT NULL) AS verified,
           p.p AS punkte
      FROM punkte p
     WHERE p.p > 0
     ORDER BY p.p DESC, p.public_ref
     LIMIT ${Math.min(Math.max(n, 1), 6)}`;
  return zeilen.map(z => alsTreffer(z));
}
