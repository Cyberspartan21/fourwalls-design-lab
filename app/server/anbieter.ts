import "server-only";
import { sql } from "./db";
import { alsMedia } from "@/services/storage";
import { treffernachRefs } from "./favoriten";
import type { Media } from "@/domain/listing";
import type { Treffer } from "@/domain/marktplatz";

/* Das öffentliche Herausgeberprofil (P5.7 §10, §11, §43, §53).

   Nur Organisationen, die aktiv und nicht stillgelegt sind, haben ein
   Profil — alles andere ist NOT_FOUND (die Anbieterseite meldet 404, sie
   verrät nie, dass eine stillgelegte Organisation einmal existierte).

   Absichtlich NIE ausgeliefert: email, phone, uid_che, legal_name (§10).
   public_email/public_phone sind eigene, bewusst öffentliche Spalten.

   Die aktiven Inserate kommen aus derselben Sicht und derselben Umwandlung
   wie überall sonst (listing_public → alsTreffer, via treffernachRefs aus
   server/favoriten.ts) — keine zweite Bauweise für Suchtreffer. */

export interface AnbieterProfil {
  publicRef: string;
  slug: string;
  displayName: string;
  kind: "agency" | "developer" | "property_manager" | "institutional" | "fourwalls";
  description: string | null;
  website: string | null;
  publicEmail: string | null;
  publicPhone: string | null;
  city: string | null;
  postalCode: string | null;
  locale: "de" | "fr" | "it" | "en";
  verificationState: "unverified" | "pending_review" | "verified";
  logo: Media | null;
  aktiveInserate: Treffer[];
  anzahlAktiv: number;
}

type MediaVariante = { storage_key: string; width: number; format: "jpeg" | "webp" | "avif" };

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const HOECHSTZAHL_KARTEN = 48;

export async function anbieterProfil(slug: string): Promise<AnbieterProfil | null> {
  if (!SLUG_RE.test(slug)) return null;
  const z = await sql`
    SELECT o.id, o.public_ref, o.slug, o.display_name, o.kind, o.description, o.website,
           o.public_email, o.public_phone, o.city, o.postal_code, o.locale, o.verification_state,
           (SELECT json_agg(json_build_object('storage_key', v.storage_key, 'width', v.width, 'format', v.format) ORDER BY v.width)
              FROM media_variant v WHERE v.asset_id = o.logo_asset_id) AS logo_varianten
      FROM organization o
     WHERE o.slug = ${slug} AND o.is_active AND o.archived_at IS NULL
     LIMIT 1`;
  const r = z[0];
  if (!r) return null;

  const refZeilen = await sql`
    SELECT lp.public_ref FROM listing_public lp
     WHERE lp.published_by_org_id = ${r.id as string}
     ORDER BY lp.published_at DESC LIMIT ${HOECHSTZAHL_KARTEN}`;
  const refs = refZeilen.map(x => String(x.public_ref));
  const gefundene = await treffernachRefs(refs);
  /* treffernachRefs sortiert nicht nach der übergebenen Liste (ANY() ohne
     ORDER BY) — die Reihenfolge (neuste zuerst) wird hier wiederhergestellt. */
  const nachRef = new Map(gefundene.map(t => [t.id, t] as const));
  const aktiveInserate = refs.map(ref => nachRef.get(ref)).filter((t): t is Treffer => !!t);

  const anzahlZeile = await sql`SELECT count(*)::int AS n FROM listing_public lp WHERE lp.published_by_org_id = ${r.id as string}`;
  const anzahlAktiv = Number(anzahlZeile[0]?.n ?? 0);

  const logoVarianten = r.logo_varianten as MediaVariante[] | null;
  const logo = logoVarianten?.length ? alsMedia(String(r.slug) + "-logo", String(r.display_name), null, logoVarianten) : null;

  return {
    publicRef: String(r.public_ref), slug: String(r.slug), displayName: String(r.display_name),
    kind: r.kind as AnbieterProfil["kind"], description: (r.description as string | null) ?? null,
    website: (r.website as string | null) ?? null, publicEmail: (r.public_email as string | null) ?? null,
    publicPhone: (r.public_phone as string | null) ?? null, city: (r.city as string | null) ?? null,
    postalCode: (r.postal_code as string | null) ?? null, locale: (r.locale as AnbieterProfil["locale"]) ?? "de",
    verificationState: r.verification_state as AnbieterProfil["verificationState"],
    logo, aktiveInserate, anzahlAktiv
  };
}
