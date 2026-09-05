import "server-only";
import { sql } from "./db";
import { EntwurfSchema } from "@/domain/entwurf";
import { KIND_ZU_TYP } from "@/domain/marktplatz";
import type { Status } from "@/domain/rechte";
import type { OrgKontext } from "./org-kontext";

/* Die Übersicht einer Organisation — serverseitig geblättert und gefiltert
   (P5.7 §21/§49/§60). Es gibt nur einen Weg zu diesen Zeilen: `orgId` kommt
   aus dem geprüften Organisationskontext, nie aus der Anfrage. */

export interface OrgInseratZeile {
  publicRef: string;
  status: Status;
  titel: string;
  trans: "sale" | "rent" | null;
  typ: string | null;
  ort: string | null;
  zugewiesen: { id: string; name: string } | null;
  aktualisiert: string;
  eingereicht: string | null;
  externalRef: string | null;
}

export interface OrgInseratFilter {
  q?: string;
  status?: Status | "";
  /* userId oder "keine" (unzugewiesen) oder "" (kein Filter) */
  zugewiesen?: string | "";
  trans?: "sale" | "rent" | "";
  sort?: "aktualisiert" | "status" | "titel";
  seite: number;
}

const PRO_SEITE = 25;
const STATUS_WERTE: Status[] = ["draft", "submitted", "in_review", "changes_required", "approved", "published", "paused", "reserved", "sold", "rented", "expired", "archived", "rejected"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bedingung(kontext: OrgKontext, f: OrgInseratFilter) {
  const status = f.status && STATUS_WERTE.includes(f.status) ? f.status : null;
  const trans = f.trans === "sale" || f.trans === "rent" ? f.trans : null;
  const zugewiesen = f.zugewiesen && (f.zugewiesen === "keine" || UUID.test(f.zugewiesen)) ? f.zugewiesen : null;
  const q = f.q?.trim().slice(0, 120) || null;
  return sql`
    WHERE l.published_by_org_id = ${kontext.org.id}
      ${status ? sql`AND l.status = ${status}` : sql``}
      ${trans ? sql`AND l.transaction = ${trans}` : sql``}
      ${zugewiesen === "keine" ? sql`AND l.assigned_user_id IS NULL` : zugewiesen ? sql`AND l.assigned_user_id = ${zugewiesen}` : sql``}
      ${q ? sql`AND (l.title ILIKE ${"%" + q + "%"} OR (l.draft_data->>'titel') ILIKE ${"%" + q + "%"} OR l.public_ref ILIKE ${"%" + q + "%"} OR l.external_ref ILIKE ${"%" + q + "%"})` : sql``}`;
}

export async function orgInserate(kontext: OrgKontext, filter: OrgInseratFilter): Promise<{ zeilen: OrgInseratZeile[]; total: number; seite: number; hatMehr: boolean }> {
  const seite = Math.max(1, Math.floor(Number(filter.seite) || 1));
  const offset = (seite - 1) * PRO_SEITE;
  const wo = bedingung(kontext, filter);
  const order = ({
    status: sql`l.status, l.updated_at DESC`,
    titel: sql`coalesce(l.title, l.draft_data->>'titel') ASC NULLS LAST, l.updated_at DESC`
  } as Record<string, ReturnType<typeof sql>>)[filter.sort ?? ""] ?? sql`l.updated_at DESC`;

  const [zeilen, zaehlung] = await Promise.all([
    sql`
      SELECT l.public_ref, l.status, l.title, l.draft_data, l.transaction, p.kind AS typ, p.city,
             l.assigned_user_id, u.display_name AS zugewiesen_name,
             l.updated_at, l.submitted_at, l.external_ref
        FROM listing l
        JOIN property p ON p.id = l.property_id
        LEFT JOIN app_user u ON u.id = l.assigned_user_id
        ${wo}
       ORDER BY ${order}
       LIMIT ${PRO_SEITE} OFFSET ${offset}`,
    sql`SELECT count(*)::int AS n FROM listing l ${wo}`
  ]);

  const total = Number(zaehlung[0]?.n ?? 0);
  const alsZeile = (r: Record<string, unknown>): OrgInseratZeile => {
    const d = EntwurfSchema.parse(r.draft_data ?? {});
    return {
      publicRef: String(r.public_ref),
      status: r.status as Status,
      titel: String(r.title ?? d.titel ?? ""),
      trans: r.transaction === "rent" ? "rent" : r.transaction === "sale" ? "sale" : null,
      typ: r.typ ? (KIND_ZU_TYP[r.typ as keyof typeof KIND_ZU_TYP] ?? String(r.typ)) : null,
      ort: r.city ? String(r.city) : null,
      zugewiesen: r.assigned_user_id ? { id: String(r.assigned_user_id), name: String(r.zugewiesen_name ?? "—") } : null,
      aktualisiert: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
      eingereicht: r.submitted_at ? (r.submitted_at instanceof Date ? r.submitted_at.toISOString() : String(r.submitted_at)) : null,
      externalRef: r.external_ref ? String(r.external_ref) : null
    };
  };
  return { zeilen: zeilen.map(alsZeile), total, seite, hatMehr: offset + zeilen.length < total };
}

/* Anzahl je Status — für die Reiter der Übersicht. */
export async function orgZaehlung(kontext: OrgKontext): Promise<Record<string, number>> {
  const z = await sql`SELECT status, count(*)::int AS n FROM listing WHERE published_by_org_id = ${kontext.org.id} GROUP BY status`;
  const out: Record<string, number> = {};
  for (const r of z) out[String(r.status)] = Number(r.n);
  return out;
}
