import "server-only";
import { sql } from "./db";
import { AppError } from "@/lib/errors";
import { alsTreffer } from "./search";
import type { Treffer } from "@/domain/marktplatz";

/* Merkliste angemeldeter Personen — geräteübergreifend in der Datenbank.

   Schlüssel bleibt überall die öffentliche Referenz (public_ref), nie die
   interne listing.id — wie im anonymen Repository (components/favorites.ts).
   Wer merkt, darf das Objekt auch dann in der Liste behalten, wenn es später
   nicht mehr öffentlich ist (pausiert, verkauft, archiviert): das entscheidet
   listeFavoriten() nicht mit, nur treffernachRefs() zeigt, was JETZT
   öffentlich ist. */

const REF = /^FWL-\d{4}-\d{6}$/;
const HOECHSTZAHL_MERGE = 200;

/* ---------- Meine Merkliste (alle Referenzen, auch nicht mehr öffentliche) ---------- */
export async function listeFavoriten(personId: string): Promise<string[]> {
  const z = await sql`
    SELECT l.public_ref FROM favorite f JOIN listing l ON l.id = f.listing_id
     WHERE f.user_id = ${personId}
     ORDER BY f.created_at DESC`;
  return z.map(r => String(r.public_ref));
}

/* ---------- Merken/Entmerken ----------
   Ein Klick zur Zeit: DELETE...RETURNING entscheidet, ob vorher schon gemerkt
   war; war es das nicht, folgt das INSERT. Kein Rennen kritisch. */
export async function favoritKippen(personId: string, publicRef: string): Promise<{ gemerkt: boolean }> {
  if (!REF.test(publicRef)) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");
  const l = await sql`SELECT id FROM listing WHERE public_ref = ${publicRef} LIMIT 1`;
  const listingId = l[0]?.id as string | undefined;
  if (!listingId) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");

  const geloescht = await sql`DELETE FROM favorite WHERE user_id = ${personId} AND listing_id = ${listingId} RETURNING id`;
  if (geloescht.length) return { gemerkt: false };
  /* Der Unique-Index ist partiell (WHERE user_id IS NOT NULL, wegen der
     anonymen Merkliste daneben) — ON CONFLICT muss dasselbe Prädikat tragen,
     sonst findet Postgres keinen passenden Index und lehnt die Anweisung ab. */
  await sql`INSERT INTO favorite (user_id, listing_id) VALUES (${personId}, ${listingId})
            ON CONFLICT (user_id, listing_id) WHERE user_id IS NOT NULL DO NOTHING`;
  return { gemerkt: true };
}

/* ---------- Übernahme der anonymen Merkliste beim Anmelden/Registrieren ----------
   Idempotent: zweimal derselbe Aufruf erzeugt keine Duplikate und keinen Fehler. */
export async function favoritenMergen(personId: string, publicRefs: string[]): Promise<void> {
  const refs = publicRefs.filter(r => REF.test(r)).slice(0, HOECHSTZAHL_MERGE);
  if (!refs.length) return;
  await sql`
    INSERT INTO favorite (user_id, listing_id)
    SELECT ${personId}, l.id FROM listing l WHERE l.public_ref = ANY(${refs})
    ON CONFLICT (user_id, listing_id) WHERE user_id IS NOT NULL DO NOTHING`;
}

/* ---------- Treffer zu einer Liste von Referenzen ----------
   Generisch gehalten (nicht "favoritenTreffer"): andere Teile von P5.6
   (Vergleich, zuletzt angesehen) brauchen dieselbe Auflösung. Nur, was JETZT
   öffentlich ist (listing_public kennt nur 'published'/'reserved'), erscheint
   im Ergebnis — der Aufrufer erkennt fehlende Referenzen durch Abgleich mit
   der angefragten Liste. Aufbau exakt wie server/search.ts (dieselbe Sicht,
   dieselben Spalten, alsTreffer()). */
export async function treffernachRefs(publicRefs: string[]): Promise<Treffer[]> {
  const refs = [...new Set(publicRefs.filter(r => REF.test(r)))].slice(0, HOECHSTZAHL_MERGE);
  if (!refs.length) return [];
  const z = await sql`
    SELECT lp.public_ref, lp.slug, lp.transaction, lp.property_kind, lp.title, lp.city, lp.postal_code, lp.canton,
           ST_X(lp.geom_public::geometry) AS lng, ST_Y(lp.geom_public::geometry) AS lat, lp.geo_precision, lp.geo_radius_m,
           lp.price_chf, lp.price_on_request, lp.rent_net_chf, lp.rent_extra_chf, lp.rooms, lp.living_area_m2, lp.plot_area_m2, lp.floor, lp.built_year,
           lp.publisher_kind, lp.represented_by_org_id, lp.status, lp.available_immediately, lp.available_from, lp.published_at,
           (SELECT json_agg(json_build_object('storage_key', v.storage_key, 'width', v.width, 'format', v.format) ORDER BY v.width)
              FROM media_variant v
             WHERE v.asset_id = (SELECT li.asset_id FROM listing_image li WHERE li.listing_id = lp.id ORDER BY li.is_cover DESC, li.sort_order LIMIT 1)) AS bild_varianten,
           EXISTS (SELECT 1 FROM organization o WHERE o.id = lp.published_by_org_id AND o.verification_state = 'verified') AS verified
      FROM listing_public lp WHERE lp.public_ref = ANY(${refs})`;
  return z.map(alsTreffer);
}
