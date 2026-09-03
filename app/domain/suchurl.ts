/* Suchanfrage ⇄ Adresszeile — reine Logik ohne Server-Abhängigkeit, damit
   Server (Seite, API) und Client (Filterleiste) dieselben Regeln nutzen.
   Parameternamen wie im P2-Prototyp (ort, um, typ, pmin, pmax, zi, …). */
import { z } from "zod";
import { AppError } from "../lib/errors.ts";
import { LEER, FEATURES, SORTS, TYPEN, QUELLEN, type Suchanfrage } from "./marktplatz.ts";

const NUM = (min: number, max: number) => z.coerce.number().int().min(min).max(max).nullable().optional().transform(v => v ?? null);
export const SuchanfrageSchema = z.object({
  trans: z.enum(["buy", "rent"]).default("buy"),
  ort: z.string().regex(/^(ort|plz|kt|rg)-[A-Za-z0-9-]{1,40}$/).nullable().optional().transform(v => v ?? null),
  umkreisKm: z.coerce.number().min(0).max(50).default(0),
  bounds: z.object({ n: z.number().min(45).max(48.5), s: z.number().min(45).max(48.5), o: z.number().min(5).max(11), w: z.number().min(5).max(11) })
    .refine(b => b.n > b.s && b.o > b.w, "Ausschnitt leer").refine(b => (b.n - b.s) <= 4 && (b.o - b.w) <= 7, "Ausschnitt zu gross").nullable().optional().transform(v => v ?? null),
  typ: z.enum(TYPEN as [string, ...string[]]).or(z.literal("")).default(""),
  pMin: NUM(0, 1e9), pMax: NUM(0, 1e9), ziMin: z.coerce.number().min(0).max(30).nullable().optional().transform(v => v ?? null), ziMax: z.coerce.number().min(0).max(30).nullable().optional().transform(v => v ?? null),
  flMin: NUM(0, 100000), flMax: NUM(0, 100000), grMin: NUM(0, 10_000_000), bjVon: NUM(1000, 2100), bjBis: NUM(1000, 2100),
  etage: z.enum(["", "eg", "nichteg", "ab2", "dach"]).default(""),
  verf: z.enum(["", "sofort", "3mt"]).default(""),
  feat: z.array(z.enum(FEATURES)).max(18).default([]),
  quelle: z.enum(QUELLEN as [string, ...string[]]).or(z.literal("")).default(""),
  nurFrei: z.boolean().default(true),
  sort: z.enum(SORTS as [string, ...string[]]).default("neu"),
  seite: z.coerce.number().int().min(1).max(50).default(1),
  proSeite: z.coerce.number().int().min(1).max(48).default(24),
  modus: z.enum(["list", "map"]).default("list"),
  ref: z.string().regex(/^FWL-\d{4}-\d{6}$/).nullable().optional().transform(v => v ?? null)
});

/* URL-Parameter (P2-Namen) → Anfrage. Ungültiges wird verworfen, nicht geraten. */
export function anfrageAusParams(p: Record<string, string | string[] | undefined>, trans?: "buy" | "rent", streng = false): Suchanfrage {
  const g = (k: string) => { const v = p[k]; return Array.isArray(v) ? v[0] : v; };
  const n = (k: string) => { const v = g(k); if (v == null || v === "") return null; const x = Number(String(v).replace(/[^\d.]/g, "")); return Number.isFinite(x) ? x : null; };
  const roh = {
    trans: trans ?? (g("trans") === "rent" ? "rent" : "buy"), ort: g("ort") || null, umkreisKm: n("um") ?? 0,
    bounds: (() => { const b = g("box"); if (!b) return null; const t = b.split(",").map(Number); return t.length === 4 && t.every(Number.isFinite) ? { n: t[0]!, s: t[1]!, o: t[2]!, w: t[3]! } : null; })(),
    typ: g("typ") ?? "", pMin: n("pmin"), pMax: n("pmax"), ziMin: n("zi"), ziMax: n("zimax"), flMin: n("fl"), flMax: n("flmax"), grMin: n("gr"), bjVon: n("bjv"), bjBis: n("bjb"),
    etage: g("et") ?? "", verf: g("vf") ?? "", feat: (g("feat") ?? "").split(",").filter(Boolean), quelle: g("quelle") ?? "", nurFrei: g("alle") !== "1",
    sort: g("sort") ?? "neu", seite: n("seite") ?? 1, proSeite: 24, modus: g("ansicht") === "karte" ? "map" : "list",
    ref: g("ref") || null
  };
  /* Nachsichtig lesen: ein ungültiger Einzelwert fällt auf den Standard zurück, die Suche bleibt möglich */
  const r = SuchanfrageSchema.safeParse(roh);
  if (r.success) return r.data as Suchanfrage;
  /* API: ungültige Werte werden abgewiesen, nicht stillschweigend ersetzt */
  if (streng) throw new AppError("VALIDATION", "Ungültige Suchparameter", Object.fromEntries(r.error.issues.map(i => [String(i.path[0] ?? "?"), i.message])));
  const flat = { ...roh } as Record<string, unknown>;
  for (const issue of r.error.issues) { const k = issue.path[0] as keyof Suchanfrage; if (k) flat[k] = (LEER as unknown as Record<string, unknown>)[k]; }
  const r2 = SuchanfrageSchema.safeParse(flat);
  return (r2.success ? r2.data : LEER) as Suchanfrage;
}

/* Anfrage → URL-Parameter (Gegenstück, für Links, Chips und Suchabos) */
export function paramsAusAnfrage(q: Partial<Suchanfrage>): URLSearchParams {
  const Q = { ...LEER, ...q }; const p = new URLSearchParams();
  if (Q.ort) p.set("ort", Q.ort); if (Q.umkreisKm > 0) p.set("um", String(Q.umkreisKm));
  if (Q.bounds) p.set("box", [Q.bounds.n, Q.bounds.s, Q.bounds.o, Q.bounds.w].map(x => x.toFixed(4)).join(","));
  if (Q.typ) p.set("typ", Q.typ); if (Q.quelle) p.set("quelle", Q.quelle);
  const num: [string, number | null][] = [["pmin", Q.pMin], ["pmax", Q.pMax], ["zi", Q.ziMin], ["zimax", Q.ziMax], ["fl", Q.flMin], ["flmax", Q.flMax], ["gr", Q.grMin], ["bjv", Q.bjVon], ["bjb", Q.bjBis]];
  for (const [k, v] of num) if (v != null) p.set(k, String(v));
  if (Q.etage) p.set("et", Q.etage); if (Q.verf) p.set("vf", Q.verf); if (!Q.nurFrei) p.set("alle", "1");
  if (Q.feat.length) p.set("feat", Q.feat.join(",")); if (Q.sort !== "neu") p.set("sort", Q.sort);
  if (Q.seite > 1) p.set("seite", String(Q.seite)); if (Q.modus === "map") p.set("ansicht", "karte");
  return p;
}

