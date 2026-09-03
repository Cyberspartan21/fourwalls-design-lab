import "server-only";
import { sql } from "./db";
import type { Locale } from "@/i18n";
import type { OrtTyp } from "@/domain/marktplatz";

/* GeoProvider — serverseitig, aus der Tabelle `place`.

   Dieselben Entitäten wie im P3-Prototyp (ort-…, plz-…, kt-…, rg-…), dieselben
   Kennungen, dieselbe Vorschlagslogik (Anfang, enthalten, ein Tippfehler).
   Die Kennung ist sprachunabhängig: ein Sprachwechsel ändert das Label, nie
   die Entität. 73 Zeilen — sie werden einmal je Prozess gelesen und für eine
   Minute gehalten; ein späterer Adressdienst bedient dieselbe Schnittstelle. */

export interface Place {
  id: string; key: string; kind: "municipality" | "canton" | "region";
  canton: string | null; name: Record<Locale, string>; aliases: string[]; postalCodes: string[];
  lat: number | null; lng: number | null;
  box: [number, number, number, number] | null;   // [n, s, o, w]
  parentKey: string | null;
}
export interface OrtEntitaet {
  typ: OrtTyp; id: string; label: string; sub?: string | undefined;
  kt?: string | undefined; kantone?: string[] | undefined; plz?: string[] | undefined; ortId?: string | undefined;
  lat?: number | undefined; lng?: number | undefined; box?: [number, number, number, number] | undefined; placeId: string;
}

let cache: { bis: number; orte: Place[] } | null = null;
async function alle(): Promise<Place[]> {
  if (cache && cache.bis > Date.now()) return cache.orte;
  const z = await sql`
    SELECT p.id, p.key, p.kind, p.canton, p.name_de, p.name_fr, p.name_it, p.name_en, p.aliases, p.postal_codes,
           ST_Y(p.centroid::geometry) AS lat, ST_X(p.centroid::geometry) AS lng,
           CASE WHEN p.bbox IS NULL THEN NULL ELSE json_build_array(ST_YMax(p.bbox::geometry), ST_YMin(p.bbox::geometry), ST_XMax(p.bbox::geometry), ST_XMin(p.bbox::geometry)) END AS box,
           e.key AS parent_key
      FROM place p LEFT JOIN place e ON e.id = p.parent_id
     WHERE p.kind IN ('municipality','canton','region')`;
  const orte: Place[] = z.map(r => ({
    id: r.id, key: r.key, kind: r.kind, canton: r.canton,
    name: { de: r.name_de, fr: r.name_fr ?? r.name_de, it: r.name_it ?? r.name_de, en: r.name_en ?? r.name_de },
    aliases: r.aliases ?? [], postalCodes: r.postal_codes ?? [],
    lat: r.lat == null ? null : Number(r.lat), lng: r.lng == null ? null : Number(r.lng),
    box: r.box ? (r.box as number[]).map(Number) as [number, number, number, number] : null, parentKey: r.parent_key ?? null
  }));
  cache = { bis: Date.now() + 60_000, orte };
  return orte;
}

const norm = (s: string) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9 ]+/g, " ").trim();
/* Ein Tippfehler auf ähnlich langen Wörtern (wie geo.js nah()) */
function nah(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1 || b.length < 4) return false;
  let i = 0, j = 0, f = 0;
  while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++f > 1) return false; if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; } }
  return f + (a.length - i) + (b.length - j) <= 1;
}
const KT_WORT: Record<Locale, string> = { de: "Kanton", fr: "Canton", it: "Cantone", en: "Canton" };

function kantonZusatz(p: Place | undefined, locale: Locale, orte: Place[]): string {
  if (!p?.canton) return "";
  const kt = orte.find(o => o.kind === "canton" && o.canton === p.canton);
  return kt ? `${KT_WORT[locale]} ${kt.name[locale]}` : p.canton;
}

function alsEntitaet(p: Place, locale: Locale, orte: Place[]): OrtEntitaet {
  if (p.kind === "region") return { typ: "region", id: p.key, label: p.name[locale], sub: p.aliases.join(", "), kantone: p.aliases, box: p.box ?? undefined, placeId: p.id };
  if (p.kind === "canton") return { typ: "kanton", id: p.key, label: p.name[locale], sub: KT_WORT[locale], kt: p.canton ?? undefined, box: p.box ?? undefined, lat: p.lat ?? undefined, lng: p.lng ?? undefined, placeId: p.id };
  return { typ: "ort", id: p.key, label: p.name[locale], sub: kantonZusatz(p, locale, orte), kt: p.canton ?? undefined, plz: p.postalCodes, lat: p.lat ?? undefined, lng: p.lng ?? undefined, placeId: p.id };
}

/* Eine Entität anhand ihrer Kennung (ort-…, plz-…, kt-…, rg-…). */
export async function getPlace(id: string, locale: Locale = "de"): Promise<OrtEntitaet | null> {
  if (!id || !/^[a-z]{2,3}-[A-Za-z0-9-]{1,40}$/.test(id)) return null;
  const orte = await alle();
  if (id.startsWith("plz-")) {
    const plz = id.slice(4);
    const o = orte.find(x => x.kind === "municipality" && x.postalCodes.includes(plz));
    return o ? { typ: "plz", id, label: `${plz} ${o.name[locale]}`, sub: kantonZusatz(o, locale, orte), ortId: o.key, kt: o.canton ?? undefined, plz: [plz], lat: o.lat ?? undefined, lng: o.lng ?? undefined, placeId: o.id } : null;
  }
  const p = orte.find(x => x.key === id);
  return p ? alsEntitaet(p, locale, orte) : null;
}

/* Autocomplete über alle Entitätsarten — Rangfolge wie im Prototyp. */
export async function suche(q: string, locale: Locale = "de", limit = 8): Promise<OrtEntitaet[]> {
  const roh = String(q ?? "").trim().slice(0, 60);
  if (!roh) return [];
  const n = norm(roh); const orte = await alle();
  const out: (OrtEntitaet & { treffer: number })[] = [];
  const gem = orte.filter(o => o.kind === "municipality");
  if (/^\d{2,4}$/.test(roh)) {
    for (const o of gem) for (const p of o.postalCodes) if (p.startsWith(roh)) out.push({ ...(await getPlace("plz-" + p, locale))!, treffer: 100 - Math.abs(p.length - roh.length) });
    if (!out.length && roh.length === 4) { const kurz = roh.slice(0, 3); for (const o of gem) for (const p of o.postalCodes) if (p.startsWith(kurz)) out.push({ ...(await getPlace("plz-" + p, locale))!, treffer: 70 }); }
  }
  for (const r of orte.filter(o => o.kind === "region")) { const nm = norm(r.name[locale]), de = norm(r.name.de); if (nm.startsWith(n) || de.startsWith(n) || norm(r.key.slice(3)).startsWith(n)) out.push({ ...alsEntitaet(r, locale, orte), treffer: 90 }); }
  for (const k of orte.filter(o => o.kind === "canton")) { const nm = norm(k.name[locale]), de = norm(k.name.de); if (nm.startsWith(n) || de.startsWith(n) || norm(k.canton ?? "") === n) out.push({ ...alsEntitaet(k, locale, orte), treffer: 85 }); }
  for (const o of gem) {
    const keys = [norm(o.name.de), norm(o.name.fr), norm(o.name.it), norm(o.name.en), ...o.aliases.map(norm)];
    let p = 0;
    for (const k of keys) { if (k === n) { p = 100; break; } if (k.startsWith(n)) p = Math.max(p, 95); else if (k.includes(n) && n.length >= 3) p = Math.max(p, 70); else if (nah(k, n)) p = Math.max(p, 60); }
    if (p) out.push({ ...alsEntitaet(o, locale, orte), treffer: p });
  }
  const rang: Record<string, number> = { ort: 3, plz: 2, kanton: 1, region: 0 };
  return out.sort((a, b) => b.treffer - a.treffer || (rang[b.typ] ?? 0) - (rang[a.typ] ?? 0)).slice(0, Math.min(limit, 12)).map(({ treffer: _t, ...e }) => e);
}

/* Freitext (Altlinks, getippte Eingaben) → Entität */
export async function forward(text: string, locale: Locale = "de"): Promise<OrtEntitaet | null> {
  if (/^(ort|rg|kt|plz)-/.test(text)) return getPlace(text, locale);
  const t = await suche(text, locale, 1);
  return t[0] ?? null;
}

export const SCHWEIZ_BOX: [number, number, number, number] = [47.81, 45.82, 10.49, 5.96];
