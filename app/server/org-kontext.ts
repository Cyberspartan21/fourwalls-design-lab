import "server-only";
import { sql } from "./db";
import { AppError } from "@/lib/errors";
import { orgDarf, type OrgMitglied, type OrgRecht, type OrgRolle } from "@/domain/orgrechte";
import type { Person } from "@/domain/rechte";

/* Der Organisationskontext — die eine Stelle, die beantwortet, in welchem
   Team eine Person gerade handelt (P5.7 §7, §61, §62).

   Regeln:
   1. Die Organisation kommt aus der Adresse (Slug im Pfad) oder aus einer
      Kennung im Body. Beides ist nur ein WUNSCH des Browsers. Ob die Person
      dort Mitglied ist, entscheidet ausschliesslich org_membership — frisch
      je Anfrage, nie aus einem Cookie oder einem Client-Zustand.
   2. Eine widerrufene Zugehörigkeit gilt sofort: die nächste Anfrage sieht
      is_active = false und wird abgewiesen.
   3. Fremde oder unbekannte Organisationen antworten NOT_FOUND, nie FORBIDDEN —
      keine Bestätigung, dass es sie gibt (§15). */

export interface OrgKopf {
  id: string;
  publicRef: string;
  slug: string;
  kind: "agency" | "developer" | "property_manager" | "institutional" | "fourwalls";
  displayName: string;
  legalName: string;
  locale: "de" | "fr" | "it" | "en";
  verificationState: "unverified" | "pending_review" | "verified";
  isActive: boolean;
  archivedAt: string | null;
}

export interface OrgKontext {
  org: OrgKopf;
  mitglied: OrgMitglied;
}

const alsKopf = (o: Record<string, unknown>): OrgKopf => ({
  id: String(o.id), publicRef: String(o.public_ref), slug: String(o.slug),
  kind: o.kind as OrgKopf["kind"], displayName: String(o.display_name), legalName: String(o.legal_name),
  locale: (o.locale as OrgKopf["locale"]) ?? "de", verificationState: o.verification_state as OrgKopf["verificationState"],
  isActive: Boolean(o.is_active), archivedAt: o.archived_at ? String(o.archived_at) : null
});

/* Alle aktiven Zugehörigkeiten einer Person — für den Umschalter (§18). */
export async function meineOrganisationen(personId: string): Promise<{ org: OrgKopf; rolle: OrgRolle }[]> {
  const z = await sql`
    SELECT o.id, o.public_ref, o.slug, o.kind, o.display_name, o.legal_name, o.locale, o.verification_state, o.is_active, o.archived_at, m.role
      FROM org_membership m JOIN organization o ON o.id = m.organization_id
     WHERE m.user_id = ${personId} AND m.is_active AND o.is_active AND o.archived_at IS NULL
     ORDER BY o.display_name`;
  return z.map(r => ({ org: alsKopf(r), rolle: r.role as OrgRolle }));
}

/* Die Zugehörigkeit zu EINER Organisation (per Slug oder id). null, wenn es die
   Organisation nicht gibt, sie stillgelegt ist oder die Person nicht (mehr)
   aktives Mitglied ist — alle drei Fälle sehen für den Aufrufer gleich aus. */
export async function orgKontext(personId: string, orgSlugOderId: string): Promise<OrgKontext | null> {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/i.test(orgSlugOderId) && !/^[0-9a-f-]{36}$/i.test(orgSlugOderId)) return null;
  const z = await sql`
    SELECT o.id, o.public_ref, o.slug, o.kind, o.display_name, o.legal_name, o.locale, o.verification_state, o.is_active, o.archived_at, m.role
      FROM organization o
      JOIN org_membership m ON m.organization_id = o.id AND m.user_id = ${personId} AND m.is_active
     WHERE (o.slug = ${orgSlugOderId} OR o.id::text = ${orgSlugOderId})
       AND o.is_active AND o.archived_at IS NULL
     LIMIT 1`;
  const r = z[0];
  if (!r) return null;
  return { org: alsKopf(r), mitglied: { orgId: String(r.id), rolle: r.role as OrgRolle } };
}

/* Mitglied sein UND ein Teamrecht haben — sonst NOT_FOUND (kein Mitglied) bzw.
   FORBIDDEN (Mitglied ohne dieses Recht). Plattformrollen spielen hier keine
   Rolle: eine Moderatorin ohne Mitgliedschaft ist für das Team ein Fremder. */
export async function verlangeOrgRecht(person: Person, orgSlugOderId: string, recht: OrgRecht): Promise<OrgKontext> {
  const k = await orgKontext(person.id, orgSlugOderId);
  if (!k) throw new AppError("NOT_FOUND", "Diese Organisation gibt es nicht");
  if (!orgDarf(k.mitglied.rolle, recht)) throw new AppError("FORBIDDEN", "Dafür fehlt Ihnen die Berechtigung in diesem Team");
  return k;
}

/* Die Zugehörigkeit zur Organisation eines gegebenen Inserats — für die
   Ressourcenprüfungen in domain/rechte.ts (imTeam). null bei Privatinseraten. */
export async function mitgliedFuerInserat(personId: string, orgId: string | null): Promise<OrgMitglied | null> {
  if (!orgId) return null;
  const z = await sql`
    SELECT m.role FROM org_membership m JOIN organization o ON o.id = m.organization_id
     WHERE m.organization_id = ${orgId} AND m.user_id = ${personId} AND m.is_active AND o.is_active AND o.archived_at IS NULL LIMIT 1`;
  return z[0] ? { orgId, rolle: z[0].role as OrgRolle } : null;
}
