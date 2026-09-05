import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { sql } from "./db";
import { einreihen } from "./outbox";
import { mailtext } from "@/lib/mailtext";
import { env } from "./env";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/log";
import { orgDarf, darfRolleVergeben, type OrgRolle } from "@/domain/orgrechte";
import type { Person } from "@/domain/rechte";
import type { OrgKontext } from "./org-kontext";

/* Einladungen ins Team (P5.7 §13/§14).

   Der Token verlässt den Server nur einmal — in der Mail. Gespeichert wird
   ausschliesslich sein Hash (`token_hash`); ein Datenbankleck ergibt keine
   gültigen Einladungen (§14). Jede Zustandsprüfung (angenommen, widerrufen,
   abgelaufen) läuft serverseitig — nie über ein Feld, das der Browser
   mitschickt. */

const EinladenSchema = z.object({
  email: z.string().trim().email(),
  rolle: z.enum(["admin", "agent", "viewer"])
}).strict();

const GUELTIGKEIT_TAGE = 7;

function neuerToken(): string {
  return randomBytes(32).toString("base64url");
}
function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/* a***@domain — genug, um eine Adresse wiederzuerkennen, ohne sie preiszugeben. */
function emailMaskieren(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const erster = email.slice(0, 1);
  const domain = email.slice(at + 1);
  return `${erster}***@${domain}`;
}

type MailLocale = "de" | "fr" | "it" | "en";
const alsLocale = (v: unknown): MailLocale => v === "fr" || v === "it" || v === "en" ? v : "de";

/* ---------- Einladen ---------- */
export async function einladen(kontext: OrgKontext, akteur: Person, roheEingabe: unknown): Promise<void> {
  if (!orgDarf(kontext.mitglied.rolle, "MANAGE_MEMBERS")) {
    throw new AppError("FORBIDDEN", "Dafür fehlt Ihnen die Berechtigung in diesem Team");
  }
  const { email, rolle } = EinladenSchema.parse(roheEingabe);
  if (!darfRolleVergeben(kontext.mitglied.rolle, rolle)) {
    throw new AppError("FORBIDDEN", "Dafür fehlt Ihnen die Berechtigung, diese Rolle zu vergeben");
  }

  const schonMitglied = await sql`
    SELECT 1 FROM org_membership m JOIN app_user u ON u.id = m.user_id
     WHERE m.organization_id = ${kontext.org.id} AND m.is_active AND u.email = ${email} LIMIT 1`;
  if (schonMitglied[0]) throw new AppError("CONFLICT", "Diese Adresse ist bereits Mitglied dieses Teams");

  const token = neuerToken();
  const hash = tokenHash(token);
  const mailLocale = alsLocale(kontext.org.locale);
  const url = `${env().NEXT_PUBLIC_SITE_URL}/${mailLocale}/einladung/${token}`;
  const ablaufDatum = new Date(Date.now() + GUELTIGKEIT_TAGE * 24 * 60 * 60 * 1000);
  const ablauf = ablaufDatum.toLocaleDateString("de-CH");

  await sql.begin(async tx => {
    /* Eine offene Einladung an dieselbe Adresse wird widerrufen — «erneut
       senden» statt eines Konflikts mit dem eindeutigen Index. */
    await tx`
      UPDATE org_invitation SET revoked_at = now()
       WHERE organization_id = ${kontext.org.id} AND email = ${email} AND accepted_at IS NULL AND revoked_at IS NULL`;
    await tx`
      INSERT INTO org_invitation (organization_id, email, role, token_hash, invited_by, expires_at)
      VALUES (${kontext.org.id}, ${email}, ${rolle}, ${hash}, ${akteur.id}, ${ablaufDatum})`;
    await tx`
      INSERT INTO audit_log (actor_user_id, actor_role, action, entity_type, entity_id, new_state)
      VALUES (${akteur.id}, ${akteur.rolle}, 'org.member_invited', 'organization', ${kontext.org.id}, ${rolle})`;
    const { betreff, text } = mailtext("org_invitation", mailLocale, { org: kontext.org.displayName, rolle, url, ablauf });
    await einreihen(tx, { an: email, betreff, text, locale: mailLocale, art: "org_invitation", bezug: { art: "organization", kennung: kontext.org.id } });
  });
  log.info("einladung.versendet", { org: kontext.org.slug, rolle });
}

/* ---------- Öffentlich lesen (ohne Sitzung) ----------
   Nur das Nötigste für die Annahmeseite — keine Mitgliederliste, keine
   Interna (§15). */
export interface EinladungOeffentlich {
  orgDisplayName: string;
  rolle: OrgRolle;
  emailMaskiert: string;
  expiresAt: string;
  zustand: "offen" | "abgelaufen" | "angenommen" | "widerrufen";
}
const alsZeit = (v: unknown): string => v instanceof Date ? v.toISOString() : String(v);

async function einladungZeileLaden(token: string) {
  const hash = tokenHash(token);
  const z = await sql`
    SELECT oi.id, oi.email, oi.role, oi.expires_at, oi.accepted_at, oi.revoked_at, o.display_name AS org_display_name
      FROM org_invitation oi JOIN organization o ON o.id = oi.organization_id
     WHERE oi.token_hash = ${hash} LIMIT 1`;
  return z[0] ?? null;
}

function zustandVon(r: Record<string, unknown>): EinladungOeffentlich["zustand"] {
  if (r.accepted_at) return "angenommen";
  if (r.revoked_at) return "widerrufen";
  if (new Date(String(r.expires_at)).getTime() < Date.now()) return "abgelaufen";
  return "offen";
}

export async function einladungLesen(token: string): Promise<EinladungOeffentlich> {
  const r = await einladungZeileLaden(token);
  if (!r) throw new AppError("NOT_FOUND", "Diese Einladung gibt es nicht");
  return {
    orgDisplayName: String(r.org_display_name), rolle: r.role as OrgRolle,
    emailMaskiert: emailMaskieren(String(r.email)), expiresAt: alsZeit(r.expires_at), zustand: zustandVon(r)
  };
}

/* ---------- Annehmen (mit Sitzung) ----------
   Die eingeladene Adresse muss der angemeldeten Person gehören (§14, «wrong
   account») — sonst könnte jede eingeladene Person die Einladung einer
   anderen annehmen, solange sie den Link kennt. */
export async function annehmen(person: Person, token: string): Promise<{ orgSlug: string; rolle: OrgRolle }> {
  const r = await einladungZeileLaden(token);
  if (!r) throw new AppError("NOT_FOUND", "Diese Einladung gibt es nicht");
  const zustand = zustandVon(r);
  if (zustand === "widerrufen") throw new AppError("CONFLICT", "Diese Einladung wurde widerrufen");
  if (zustand === "angenommen") throw new AppError("CONFLICT", "Diese Einladung wurde bereits angenommen");
  if (zustand === "abgelaufen") throw new AppError("CONFLICT", "Diese Einladung ist abgelaufen");

  if (!person.emailBestaetigt) {
    throw new AppError("FORBIDDEN", "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse");
  }
  const [pu] = await sql`SELECT email FROM app_user WHERE id = ${person.id} AND deleted_at IS NULL LIMIT 1`;
  if (!pu?.email || String(pu.email).toLowerCase() !== String(r.email).toLowerCase()) {
    throw new AppError("FORBIDDEN", "Diese Einladung gilt für eine andere Adresse");
  }

  return sql.begin(async tx => {
    const upd = await tx`
      UPDATE org_invitation SET accepted_at = now(), accepted_by = ${person.id}
       WHERE id = ${r.id} AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
       RETURNING organization_id, role`;
    if (!upd[0]) throw new AppError("CONFLICT", "Diese Einladung ist nicht mehr gültig");
    const orgId = String(upd[0].organization_id);
    const rolle = upd[0].role as OrgRolle;

    await tx`
      INSERT INTO org_membership (organization_id, user_id, role, is_active)
      VALUES (${orgId}, ${person.id}, ${rolle}, true)
      ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, is_active = true`;
    await tx`
      INSERT INTO audit_log (actor_user_id, actor_role, action, entity_type, entity_id, new_state)
      VALUES (${person.id}, ${person.rolle}, 'org.invitation_accepted', 'organization', ${orgId}, ${rolle})`;
    const [o] = await tx`SELECT slug FROM organization WHERE id = ${orgId}`;
    log.info("einladung.angenommen", { org: orgId, rolle });
    return { orgSlug: String(o!.slug), rolle };
  });
}

/* ---------- Widerrufen ---------- */
export async function widerrufen(kontext: OrgKontext, invitationId: string): Promise<void> {
  if (!orgDarf(kontext.mitglied.rolle, "MANAGE_MEMBERS")) {
    throw new AppError("FORBIDDEN", "Dafür fehlt Ihnen die Berechtigung in diesem Team");
  }
  const z = await sql`
    UPDATE org_invitation SET revoked_at = now()
     WHERE id = ${invitationId} AND organization_id = ${kontext.org.id} AND accepted_at IS NULL AND revoked_at IS NULL
     RETURNING id`;
  if (!z[0]) throw new AppError("NOT_FOUND", "Diese Einladung gibt es nicht");
  log.info("einladung.widerrufen", { org: kontext.org.slug, id: invitationId });
}
