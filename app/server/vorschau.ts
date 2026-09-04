import "server-only";
import { sql } from "./db";
import { AppError } from "@/lib/errors";
import { EntwurfSchema, type Entwurf } from "@/domain/entwurf";
import { darfVorschauSehen, type Person, type Status } from "@/domain/rechte";
import { TYP_ZU_KIND, type Typ } from "@/domain/marktplatz";
import type { ListingDetail, Media } from "@/domain/listing";
import type { Locale } from "@/i18n";

/* Die Vorschau eines noch nicht veröffentlichten Inserats.

   Sie zeigt dasselbe Dossier, das später öffentlich steht — gebaut aus den
   Assistentendaten, damit die Person und die Moderation sehen, was entsteht,
   bevor es entsteht.

   Der Zugang ist eng: Eigentümerin immer, Moderation während der Prüfung,
   sonst niemand. Wer nichts sehen darf, bekommt NOT_FOUND — auch angemeldet,
   auch mit erratener Referenz (§36/§37). Ein `noindex` wäre kein Schutz und
   ist hier auch nicht die Begründung; die Prüfung steht im Server. */

export interface VorschauErgebnis { detail: ListingDetail; status: Status; publicRef: string; eigen: boolean }

export async function vorschau(person: Person | null, publicRef: string, locale: Locale): Promise<VorschauErgebnis> {
  if (!/^FWL-\d{4}-\d{6}$/.test(publicRef)) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");
  const z = await sql`
    SELECT l.id, l.public_ref, l.status, l.draft_data, l.published_by_user_id, l.slug, l.published_at,
           u.display_name AS person_name, u.email AS person_email
      FROM listing l LEFT JOIN app_user u ON u.id = l.published_by_user_id
     WHERE l.public_ref = ${publicRef} LIMIT 1`;
  const r = z[0];
  if (!r) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");

  const inserat = { ownerId: r.published_by_user_id ? String(r.published_by_user_id) : null, status: r.status as Status };
  const e = darfVorschauSehen(person, inserat);
  if (!e.erlaubt) {
    /* Angemeldet oder nicht — dieselbe Antwort. Nur wer angemeldet werden
       könnte und es nicht ist, bekommt 401 statt 404. */
    if (e.grund === "keine-sitzung") throw new AppError("UNAUTHORIZED", "Bitte melden Sie sich an");
    throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");
  }

  const d = EntwurfSchema.parse(r.draft_data ?? {});
  const ort = d.ortId
    ? (await sql`SELECT canton, name_de, name_fr, name_it, name_en, postal_codes FROM place WHERE key = ${d.ortId} LIMIT 1`)[0]
    : null;

  const bilder = d.bilder.length
    ? await sql`SELECT a.id, v.width, v.format, v.storage_key
                  FROM media_asset a LEFT JOIN media_variant v ON v.asset_id = a.id
                 WHERE a.id = ANY(${d.bilder}::uuid[]) ORDER BY array_position(${d.bilder}::uuid[], a.id), v.width`
    : [];

  const merkmale = d.merkmale.length
    ? await sql`SELECT key, coalesce(${sql("name_" + locale)}, name_de) AS name FROM feature WHERE key = ANY(${d.merkmale}) ORDER BY sort_order`
    : [];

  return {
    detail: alsDetail(d, r, ort, bilder, merkmale, locale),
    status: r.status as Status,
    publicRef: String(r.public_ref),
    eigen: person != null && String(r.published_by_user_id ?? "") === person.id
  };
}

type Zeile = Record<string, unknown>;
function alsDetail(d: Entwurf, r: Zeile, ort: Zeile | null | undefined, bilder: Zeile[], merkmale: Zeile[], locale: Locale): ListingDetail {
  const miete = d.trans === "rent";
  const nachAsset = new Map<string, Media>();
  for (const b of bilder) {
    const id = String(b.id);
    const vorhanden = nachAsset.get(id) ?? { key: id, alt: d.titel ?? "", category: null, sources: { webp: [], jpeg: [] } };
    if (b.width && b.storage_key) {
      const url = `/api/medien/${id}`;
      const quelle = { width: Number(b.width), url };
      if (String(b.format) === "webp") vorhanden.sources.webp.push(quelle); else vorhanden.sources.jpeg.push(quelle);
    }
    nachAsset.set(id, vorhanden);
  }
  /* Ohne Variante bleibt wenigstens eine Adresse übrig, damit das Bild erscheint. */
  for (const [id, m] of nachAsset) if (!m.sources.jpeg.length && !m.sources.webp.length) m.sources.jpeg.push({ width: 960, url: `/api/medien/${id}` });

  const name = (o: Zeile | null | undefined) => o ? String(o["name_" + locale] ?? o.name_de ?? "") : "";

  return {
    publicRef: String(r.public_ref), slug: String(r.slug ?? ""), transaction: miete ? "rent" : "sale",
    status: "published", isDemo: false, isExclusive: false,
    locale, contentLocale: d.sprache,
    title: d.titel ?? "", tagline: null, description: d.beschreibung ?? null,
    priceChf: miete ? null : (d.preis != null ? Math.round(d.preis * 100) : null),
    rentNetChf: miete ? (d.preis != null ? Math.round(d.preis * 100) : null) : null,
    rentExtraChf: miete && d.nebenkosten != null ? Math.round(d.nebenkosten * 100) : null,
    priceOnRequest: d.preisAufAnfrage,
    availableFrom: d.verfuegbarAb, availableImmediately: d.sofortVerfuegbar,
    publishedAt: r.published_at instanceof Date ? r.published_at.toISOString() : new Date().toISOString(),
    /* Die Vorschau zeigt keine Karte: der öffentliche Punkt entsteht erst mit
       der Veröffentlichung im Trigger. Was hier fehlt, fehlt bewusst. */
    geo: null,
    property: {
      kind: d.typ ? TYP_ZU_KIND[d.typ as Typ] : "apartment",
      rooms: d.zimmer, livingAreaM2: d.flaeche, usableAreaM2: d.nutzflaeche, plotAreaM2: d.grundstueck,
      volumeM3: null, bedrooms: d.schlafzimmer, bathrooms: d.badezimmer,
      floor: d.etage, floorsTotal: d.geschosse, builtYear: d.baujahr, renovatedYear: null, ceilingHeightM: null,
      postalCode: String((ort?.postal_codes as string[] | undefined)?.[0] ?? ""), city: name(ort), canton: String(ort?.canton ?? "")
    },
    publisher: {
      kind: "private_person", orgName: null, orgVerified: false,
      /* In der Vorschau steht der eigene Name; öffentlich erscheint er nur,
         soweit die Objektseite ihn zeigt — Kontaktdaten nie (§56). */
      personName: String(r.person_name ?? d.name ?? ""), personTitle: null, phone: null,
      representedByFourwalls: false
    },
    images: [...nachAsset.values()],
    floorplans: [], documents: [],
    features: merkmale.map(m => ({ key: String(m.key), label: String(m.name) })),
    sections: {
      ...(d.beschreibung ? { story: { titel: d.titel ?? "", absaetze: [d.beschreibung] } } : {})
    }
  };
}
