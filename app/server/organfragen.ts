import "server-only";
import { sql } from "./db";
import type { OrgKontext } from "./org-kontext";

/* Der Posteingang einer Organisation (P5.7 §35) — nur, was `inquiry.status`
   tatsächlich hergibt. Kein erfundener Bearbeitungsstand. */

export interface OrgAnfrageZeile {
  publicRef: string;
  status: string;
  senderName: string;
  senderEmail: string;
  senderPhone: string | null;
  message: string;
  createdAt: string;
  listing: { publicRef: string; title: string } | null;
  zugewiesen: { id: string; name: string } | null;
}

const PRO_SEITE_STANDARD = 25;

export async function orgAnfragen(kontext: OrgKontext, seite: number, proSeite: number = PRO_SEITE_STANDARD): Promise<{ zeilen: OrgAnfrageZeile[]; total: number; seite: number; hatMehr: boolean }> {
  const s = Math.max(1, Math.floor(Number(seite) || 1));
  const offset = (s - 1) * proSeite;

  const [zeilen, zaehlung] = await Promise.all([
    sql`
      SELECT i.public_ref, i.status, i.sender_name, i.sender_email, i.sender_phone, i.message, i.created_at,
             l.public_ref AS listing_ref, l.title AS listing_title,
             l.assigned_user_id, u.display_name AS zugewiesen_name
        FROM inquiry i
        LEFT JOIN listing l ON l.id = i.listing_id
        LEFT JOIN app_user u ON u.id = l.assigned_user_id
       WHERE i.recipient_org_id = ${kontext.org.id}
       ORDER BY i.created_at DESC
       LIMIT ${proSeite} OFFSET ${offset}`,
    sql`SELECT count(*)::int AS n FROM inquiry WHERE recipient_org_id = ${kontext.org.id}`
  ]);

  const total = Number(zaehlung[0]?.n ?? 0);
  const alsZeile = (r: Record<string, unknown>): OrgAnfrageZeile => ({
    publicRef: String(r.public_ref),
    status: String(r.status),
    senderName: String(r.sender_name),
    senderEmail: String(r.sender_email),
    senderPhone: r.sender_phone ? String(r.sender_phone) : null,
    message: String(r.message),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    listing: r.listing_ref ? { publicRef: String(r.listing_ref), title: String(r.listing_title ?? "") } : null,
    zugewiesen: r.assigned_user_id ? { id: String(r.assigned_user_id), name: String(r.zugewiesen_name ?? "—") } : null
  });
  return { zeilen: zeilen.map(alsZeile), total, seite: s, hatMehr: offset + zeilen.length < total };
}
