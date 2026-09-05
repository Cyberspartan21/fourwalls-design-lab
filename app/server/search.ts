import "server-only";
import { sql } from "./db";
import { env } from "./env";
import { getPlace, SCHWEIZ_BOX, type OrtEntitaet } from "./geo";
import { alsMedia } from "@/services/storage";
type MediaVariante = { storage_key: string; width: number; format: "jpeg" | "webp" | "avif" };
import type { Locale } from "@/i18n";
import { TYP_ZU_KIND, QUELLE_ZU_KIND, KIND_ZU_TYP, KIND_ZU_QUELLE, DB_ZU_TRANS, TRANS_ZU_DB,
  type Suchanfrage, type Suchergebnis, type Treffer, type Punkt, type GeoAntwort, type VerfArt } from "@/domain/marktplatz";

/* Der Suchanbieter: EINE Umsetzung des P3-Vertrags über PostGIS.

   Liste, Karte, Ähnliche und Startseite fragen alle hier — es gibt keine
   zweite Filterlogik. Was der Prototyp im Browser über 304 Objekte rechnete,
   rechnet die Datenbank: Umkreis über ST_DWithin, Ausschnitt über
   ST_MakeEnvelope, Gemeinde über place_id, Kanton/Region über Spalten.
   Gelesen wird nur `listing_public` — sie kennt keine exakte Lage.

   Grenzen (§61/62): jeder Parameter wird geprüft und begrenzt; Sortierung
   und Spalten kommen aus Allowlists, nie aus der Eingabe. */

export { SuchanfrageSchema, anfrageAusParams, paramsAusAnfrage } from "@/domain/suchurl";

/* ---------- Die Suche ---------- */
export async function suche(q: Suchanfrage, locale: Locale = "de"): Promise<Suchergebnis> {
  const t0 = Date.now();
  const nurEcht = env().APP_ENV === "production";
  const trans = TRANS_ZU_DB[q.trans];

  /* Geografie: Ausschnitt schlägt Umkreis schlägt Gebiet */
  let ort: OrtEntitaet | null = null;
  const geo: GeoAntwort = { interpretation: "schweiz", mittelpunkt: null, umkreisKm: q.umkreisKm, bounds: null, label: null, ortId: null };
  let geoWo = sql``;
  if (q.bounds) {
    const b = q.bounds;
    geoWo = sql`AND lp.geom_public && ST_MakeEnvelope(${b.w}, ${b.s}, ${b.o}, ${b.n}, 4326)::geography`;
    geo.interpretation = "ausschnitt"; geo.bounds = [b.n, b.s, b.o, b.w];
  } else if (q.ort) {
    ort = await getPlace(q.ort, locale);
    if (ort) {
      geo.label = ort.label; geo.ortId = ort.id;
      if (q.umkreisKm > 0 && ort.lat != null && ort.lng != null && ort.typ !== "region") {
        const m = Math.round(q.umkreisKm * 1000);
        geoWo = sql`AND ST_DWithin(lp.geom_public, ST_SetSRID(ST_MakePoint(${ort.lng}, ${ort.lat}), 4326)::geography, ${m})`;
        geo.interpretation = "umkreis"; geo.mittelpunkt = { lat: ort.lat, lng: ort.lng }; geo.bounds = boxUm(ort.lat, ort.lng, q.umkreisKm * 1.15);
      } else if (ort.typ === "region") { geoWo = sql`AND lp.canton = ANY(${ort.kantone ?? []})`; geo.interpretation = "region"; geo.bounds = ort.box ?? null; }
      else if (ort.typ === "kanton") { geoWo = sql`AND lp.canton = ${ort.kt ?? ""}`; geo.interpretation = "kanton"; geo.bounds = ort.box ?? null; }
      else if (ort.typ === "plz") { geoWo = sql`AND lp.postal_code = ${ort.plz?.[0] ?? ""}`; geo.interpretation = "plz"; geo.mittelpunkt = { lat: ort.lat!, lng: ort.lng! }; }
      else { geoWo = sql`AND lp.place_id = ${ort.placeId}`; geo.interpretation = "gemeinde"; geo.mittelpunkt = { lat: ort.lat!, lng: ort.lng! }; }
    }
  }

  const preis = q.trans === "rent" ? sql`lp.rent_net_chf` : sql`lp.price_chf`;
  const rp = (chf: number | null) => chf == null ? null : Math.round(chf * 100);
  const kinds = q.quelle ? QUELLE_ZU_KIND[q.quelle as keyof typeof QUELLE_ZU_KIND] : null;
  const wo = sql`
    WHERE lp.transaction = ${trans}
      AND (${nurEcht} = false OR lp.is_demo = false)
      AND (${q.nurFrei} = false OR lp.status = 'published')
      ${geoWo}
      ${q.typ ? sql`AND lp.property_kind = ${TYP_ZU_KIND[q.typ as keyof typeof TYP_ZU_KIND]}` : sql``}
      ${kinds ? sql`AND lp.publisher_kind = ANY(${kinds}::publisher_kind[])` : sql``}
      ${q.pMin != null ? sql`AND ${preis} >= ${rp(q.pMin)}` : sql``}
      ${q.pMax != null ? sql`AND ${preis} <= ${rp(q.pMax)}` : sql``}
      ${q.ziMin != null ? sql`AND lp.rooms >= ${q.ziMin}` : sql``}
      ${q.ziMax != null ? sql`AND lp.rooms <= ${q.ziMax}` : sql``}
      ${q.flMin != null ? sql`AND lp.living_area_m2 >= ${q.flMin}` : sql``}
      ${q.flMax != null ? sql`AND lp.living_area_m2 <= ${q.flMax}` : sql``}
      ${q.grMin != null ? sql`AND lp.plot_area_m2 >= ${q.grMin}` : sql``}
      ${q.bjVon != null ? sql`AND lp.built_year >= ${q.bjVon}` : sql``}
      ${q.bjBis != null ? sql`AND lp.built_year <= ${q.bjBis}` : sql``}
      ${q.etage === "eg" ? sql`AND lp.floor = 0` : q.etage === "nichteg" ? sql`AND lp.floor > 0` : q.etage === "ab2" ? sql`AND lp.floor >= 2` : q.etage === "dach" ? sql`AND lp.floor >= 6` : sql``}
      ${q.verf === "sofort" ? sql`AND lp.available_immediately` : q.verf === "3mt" ? sql`AND (lp.available_immediately OR (lp.available_from IS NOT NULL AND lp.available_from <= current_date + 92))` : sql``}
      ${q.feat.length ? sql`AND NOT EXISTS (SELECT 1 FROM unnest(${q.feat}::text[]) f(k) WHERE NOT EXISTS (SELECT 1 FROM property_feature pf WHERE pf.property_id = lp.property_id AND pf.feature_key = f.k))` : sql``}`;

  /* Sortierung aus der Allowlist — nie aus der Eingabe zusammengesetzt */
  const exklusiv = sql`(lp.represented_by_org_id IS NOT NULL AND lp.publisher_kind = 'fourwalls')`;
  const vollstaendigkeit = sql`((SELECT count(*) FROM listing_image li WHERE li.listing_id = lp.id) > 3)::int * 3 + (lp.living_area_m2 IS NOT NULL)::int * 2 + (lp.rooms IS NOT NULL)::int + (lp.built_year IS NOT NULL)::int
    + EXISTS (SELECT 1 FROM property_feature pf WHERE pf.property_id = lp.property_id)::int + EXISTS (SELECT 1 FROM organization o WHERE o.id = lp.published_by_org_id AND o.verification_state = 'verified')::int * 2`;
  const order = ({
    "preis-auf": sql`${preis} ASC NULLS LAST, lp.public_ref`,
    "preis-ab": sql`${preis} DESC NULLS LAST, lp.public_ref`,
    "flaeche": sql`lp.living_area_m2 DESC NULLS LAST, lp.public_ref`,
    "zimmer": sql`lp.rooms DESC NULLS LAST, lp.public_ref`,
    "m2": sql`(CASE WHEN lp.transaction = 'sale' AND NOT lp.price_on_request AND lp.property_kind IN ('apartment','house','villa','chalet') THEN lp.price_per_m2 END) ASC NULLS LAST, lp.public_ref`,
    "empfohlen": sql`${vollstaendigkeit} DESC, lp.published_at DESC, lp.public_ref`,
    /* «Neuste»: höchstens drei Exclusive oben — sichtbar begrenzt, Demo-Regel (policy.ts: exclusivePlatzierung) */
    "neu": sql`(CASE WHEN ${exklusiv} AND row_number() OVER (PARTITION BY ${exklusiv} ORDER BY lp.published_at DESC, lp.public_ref) <= 3 THEN 0 ELSE 1 END), lp.published_at DESC, lp.public_ref DESC`
  } as Record<string, ReturnType<typeof sql>>)[q.sort] ?? sql`lp.published_at DESC, lp.public_ref DESC`;

  const zaehlung = sql`SELECT count(*)::int AS n, lp.property_kind, lp.publisher_kind FROM listing_public lp ${wo} GROUP BY 2, 3`;
  const zeilenSql = (limit: number, offset: number) => sql`
    SELECT lp.public_ref, lp.slug, lp.transaction, lp.property_kind, lp.title, lp.city, lp.postal_code, lp.canton,
           ST_X(lp.geom_public::geometry) AS lng, ST_Y(lp.geom_public::geometry) AS lat, lp.geo_precision, lp.geo_radius_m,
           lp.price_chf, lp.price_on_request, lp.rent_net_chf, lp.rent_extra_chf, lp.rooms, lp.living_area_m2, lp.plot_area_m2, lp.floor, lp.built_year,
           lp.publisher_kind, lp.represented_by_org_id, lp.status, lp.available_immediately, lp.available_from, lp.published_at,
           (SELECT json_agg(json_build_object('storage_key', v.storage_key, 'width', v.width, 'format', v.format) ORDER BY v.width)
              FROM media_variant v
             WHERE v.asset_id = (SELECT li.asset_id FROM listing_image li WHERE li.listing_id = lp.id ORDER BY li.is_cover DESC, li.sort_order LIMIT 1)) AS bild_varianten,
           EXISTS (SELECT 1 FROM organization o WHERE o.id = lp.published_by_org_id AND o.verification_state = 'verified') AS verified
      FROM listing_public lp ${wo}
     ORDER BY ${order}
     LIMIT ${limit} OFFSET ${offset}`;

  const kartenModus = q.modus === "map";
  if (q.ref) {
    const z = await sql`SELECT lp.public_ref, lp.slug, lp.transaction, lp.property_kind, lp.title, lp.city, lp.postal_code, lp.canton,
           ST_X(lp.geom_public::geometry) AS lng, ST_Y(lp.geom_public::geometry) AS lat, lp.geo_precision, lp.geo_radius_m,
           lp.price_chf, lp.price_on_request, lp.rent_net_chf, lp.rent_extra_chf, lp.rooms, lp.living_area_m2, lp.plot_area_m2, lp.floor, lp.built_year,
           lp.publisher_kind, lp.represented_by_org_id, lp.status, lp.available_immediately, lp.available_from, lp.published_at,
           (SELECT json_agg(json_build_object('storage_key', v.storage_key, 'width', v.width, 'format', v.format) ORDER BY v.width)
              FROM media_variant v
             WHERE v.asset_id = (SELECT li.asset_id FROM listing_image li WHERE li.listing_id = lp.id ORDER BY li.is_cover DESC, li.sort_order LIMIT 1)) AS bild_varianten,
           EXISTS (SELECT 1 FROM organization o WHERE o.id = lp.published_by_org_id AND o.verification_state = 'verified') AS verified
      FROM listing_public lp WHERE lp.public_ref = ${q.ref} AND (${nurEcht} = false OR lp.is_demo = false) LIMIT 1`;
    const t = z.map(alsTreffer);
    return { treffer: t, total: t.length, seite: 1, proSeite: 1, hatMehr: false, geo, facetten: { typ: {}, quelle: {} }, dauerMs: Date.now() - t0, quelle: "server" };
  }
  const [facRows, zeilen] = await Promise.all([zaehlung, zeilenSql(kartenModus ? 2000 : q.seite * q.proSeite, 0)]);
  const total = facRows.reduce((s, r) => s + Number(r.n), 0);
  const facetten = { typ: {} as Record<string, number>, quelle: {} as Record<string, number> };
  for (const r of facRows) { const t = KIND_ZU_TYP[r.property_kind as keyof typeof KIND_ZU_TYP]; const qq = KIND_ZU_QUELLE[r.publisher_kind as keyof typeof KIND_ZU_QUELLE]; facetten.typ[t] = (facetten.typ[t] ?? 0) + Number(r.n); facetten.quelle[qq] = (facetten.quelle[qq] ?? 0) + Number(r.n); }

  const treffer: Treffer[] = zeilen.map(alsTreffer);
  if (!geo.bounds) geo.bounds = treffer.length ? boxUmPunkte(treffer) : SCHWEIZ_BOX;

  if (kartenModus) {
    const punkte: Punkt[] = treffer.filter(t => t.lat != null).map(t => ({ id: t.id, slug: t.slug, lat: t.lat!, lng: t.lng!, transactionType: t.transactionType, price: t.price, rentNet: t.rentNet, priceOnRequest: t.priceOnRequest, listingTier: t.listingTier, availability: { art: t.availability.art } }));
    /* Die Seitenliste neben der Karte zeigt höchstens 60 Karten */
    return { treffer: treffer.slice(0, 60), punkte, total, seite: 1, proSeite: total, hatMehr: false, geo, facetten, dauerMs: Date.now() - t0, quelle: "server" };
  }
  return { treffer, total, seite: q.seite, proSeite: q.proSeite, hatMehr: total > treffer.length, geo, facetten, dauerMs: Date.now() - t0, quelle: "server" };
}

/* Zeile der Sicht → schlanke Zusammenfassung (Prototyp-Vokabular, CHF statt Rappen) */
export function alsTreffer(z: Record<string, unknown>): Treffer {
  const status = z.status as string;
  const art: VerfArt = status === "reserved" ? "reserviert" : status === "sold" ? "verkauft" : status === "rented" ? "vermietet"
    : z.available_immediately ? "sofort" : z.available_from ? "datum" : "vereinbarung";
  /* postgres.js liefert timestamptz als Date — als ISO-Datum ausliefern, nie als Date.toString() */
  const pub = z.published_at instanceof Date ? z.published_at.toISOString() : String(z.published_at ?? "");
  const gen = z.geo_precision === "exact" ? "exakt" : z.geo_precision === "approximate" ? "ungefaehr" : "gemeinde";
  const quelle = KIND_ZU_QUELLE[z.publisher_kind as keyof typeof KIND_ZU_QUELLE];
  const exklusiv = quelle === "fourwalls" && z.represented_by_org_id != null;
  return {
    id: String(z.public_ref), slug: `${z.slug}-${String(z.public_ref).toLowerCase()}`,
    transactionType: DB_ZU_TRANS[z.transaction as "sale" | "rent"], propertyType: KIND_ZU_TYP[z.property_kind as keyof typeof KIND_ZU_TYP],
    title: String(z.title), city: String(z.city), postalCode: String(z.postal_code), canton: String(z.canton),
    lat: z.lat == null ? null : Number(z.lat), lng: z.lng == null ? null : Number(z.lng), genauigkeitM: Number(z.geo_radius_m ?? 0), genauigkeit: gen,
    price: z.price_chf == null ? null : Number(z.price_chf) / 100, priceOnRequest: Boolean(z.price_on_request),
    rentNet: z.rent_net_chf == null ? null : Number(z.rent_net_chf) / 100, rentNK: z.rent_extra_chf == null ? null : Number(z.rent_extra_chf) / 100,
    rooms: z.rooms == null ? null : Number(z.rooms), livingArea: z.living_area_m2 == null ? null : Number(z.living_area_m2), plotArea: z.plot_area_m2 == null ? null : Number(z.plot_area_m2),
    floor: z.floor == null ? null : Number(z.floor), yearBuilt: z.built_year == null ? null : Number(z.built_year),
    /* Die Bildadressen kommen aus den tatsächlich vorhandenen Varianten —
       für Demo-Fixtures sind das sechs, für ein hochgeladenes Bild eine. */
    bild: (z.bild_varianten as MediaVariante[] | null)?.length
      ? alsMedia("", String(z.title), null, z.bild_varianten as MediaVariante[]).sources : null,
    listingSource: quelle, listingTier: exklusiv ? "exclusive" : (z.verified || quelle === "fourwalls") ? "verified" : "standard",
    verificationStatus: (z.verified || quelle === "fourwalls") ? "verified" : "none",
    availability: { art, datum: z.available_from ? String(z.available_from).slice(0, 10) : null },
    neu: pub ? (Date.now() - new Date(pub).getTime()) < 14 * 86400000 : false, fw: quelle === "fourwalls",
    publishedAt: pub.slice(0, 10)
  };
}

function boxUm(lat: number, lng: number, km: number): [number, number, number, number] {
  const dLat = km / 111, dLng = km / (111 * Math.cos(lat * Math.PI / 180));
  return [lat + dLat, lat - dLat, lng + dLng, lng - dLng];
}
/* Hüllrechteck mit 12 % Luft — wie boxUmPunkte() in geo.js */
function boxUmPunkte(p: { lat: number | null; lng: number | null }[], luft = 0.12): [number, number, number, number] {
  const q = p.filter(x => x.lat != null && x.lng != null) as { lat: number; lng: number }[];
  if (!q.length) return SCHWEIZ_BOX;
  const n = Math.max(...q.map(x => x.lat)), s = Math.min(...q.map(x => x.lat)), o = Math.max(...q.map(x => x.lng)), w = Math.min(...q.map(x => x.lng));
  const dl = Math.max(0.01, (n - s) * luft), dg = Math.max(0.01, (o - w) * luft);
  return [n + dl, s - dl, o + dg, w - dg];
}
