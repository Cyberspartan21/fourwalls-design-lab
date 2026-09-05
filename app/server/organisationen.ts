import "server-only";
import { z } from "zod";
import { sql } from "./db";
import { einreihen } from "./outbox";
import { mailtext } from "@/lib/mailtext";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/log";
import { orgDarf, darfRolleVergeben, type OrgRolle } from "@/domain/orgrechte";
import type { Person } from "@/domain/rechte";
import type { OrgKontext } from "./org-kontext";
import { medienLogoVeroeffentlichen } from "./medien";

/* Organisationen — anlegen, Profil lesen/ändern, Stilllegen, Team.

   Dieselbe Regel wie überall (§13/§65): eine fremde oder unbekannte
   Organisation führt zu NOT_FOUND. Diese Datei bekommt eine Organisation nie
   selbst zu fassen — sie erhält immer einen `OrgKontext`, den
   `server/org-kontext.ts:verlangeOrgRecht()` schon geprüft hat. Was ausser der
   Mitgliedschaft noch nötig ist (welche Rolle, ob die eigene Person betroffen
   ist), prüft jede Funktion hier zusätzlich selbst — das Teamrecht allein
   entscheidet nicht über Sonderfälle wie «letzte Besitzerin». */

const KIND = ["agency", "property_manager", "developer", "institutional"] as const;
const LOCALE = ["de", "fr", "it", "en"] as const;

const OrganisationAnlegenSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().min(2).max(160).optional(),
  kind: z.enum(KIND),
  locale: z.enum(LOCALE),
  website: z.string().trim().url().refine(u => u.startsWith("https://"), "website muss https verwenden").optional(),
  publicEmail: z.string().trim().email().optional(),
  publicPhone: z.string().trim().max(40).optional(),
  street: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(20).optional(),
  city: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional()
}).strict();

const ProfilAendernSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  legalName: z.string().trim().min(2).max(160).optional(),
  locale: z.enum(LOCALE).optional(),
  website: z.string().trim().url().refine(u => u.startsWith("https://"), "website muss https verwenden").nullable().optional(),
  publicEmail: z.string().trim().email().nullable().optional(),
  publicPhone: z.string().trim().max(40).nullable().optional(),
  street: z.string().trim().max(120).nullable().optional(),
  postalCode: z.string().trim().max(20).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  /* Logo (P5.7 §11): dieselbe Kennung wie bei Inseratsbildern, aus
     server/medien.ts — Eigentümerschaft prüft profilAendern selbst. */
  logoAssetId: z.string().uuid().nullable().optional()
}).strict();

export interface OrgProfil {
  id: string;
  publicRef: string;
  slug: string;
  kind: string;
  displayName: string;
  legalName: string;
  locale: "de" | "fr" | "it" | "en";
  verificationState: "unverified" | "pending_review" | "verified";
  isActive: boolean;
  archivedAt: string | null;
  verifiedAt: string | null;
  website: string | null;
  publicEmail: string | null;
  publicPhone: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  description: string | null;
  logoAssetId: string | null;
  createdAt: string;
}

const alsZeit = (v: unknown): string => v instanceof Date ? v.toISOString() : String(v);

const alsProfil = (r: Record<string, unknown>): OrgProfil => ({
  id: String(r.id), publicRef: String(r.public_ref), slug: String(r.slug), kind: String(r.kind),
  displayName: String(r.display_name), legalName: String(r.legal_name),
  locale: (r.locale as OrgProfil["locale"]) ?? "de",
  verificationState: r.verification_state as OrgProfil["verificationState"],
  isActive: Boolean(r.is_active), archivedAt: r.archived_at ? alsZeit(r.archived_at) : null,
  verifiedAt: r.verified_at ? alsZeit(r.verified_at) : null,
  website: r.website != null ? String(r.website) : null,
  publicEmail: r.public_email != null ? String(r.public_email) : null,
  publicPhone: r.public_phone != null ? String(r.public_phone) : null,
  street: r.street != null ? String(r.street) : null,
  postalCode: r.postal_code != null ? String(r.postal_code) : null,
  city: r.city != null ? String(r.city) : null,
  description: r.description != null ? String(r.description) : null,
  logoAssetId: r.logo_asset_id != null ? String(r.logo_asset_id) : null,
  createdAt: alsZeit(r.created_at)
});

const PROFIL_FELDER = `id, public_ref, slug, kind, display_name, legal_name, locale, verification_state, is_active,
  archived_at, verified_at, website, public_email, public_phone, street, postal_code, city, description, logo_asset_id, created_at`;

/* Ein lesbarer, eindeutiger Slug — dieselbe Herleitung wie bei Inseraten
   (server/moderation.ts:freierSlug), hier auf `organization.slug`. */
type Tx = typeof sql;
function slugBasis(text: string): string {
  const ohneAkzent = text.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return ohneAkzent.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "organisation";
}
async function freierSlug(tx: Tx, basis: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const kandidat = i === 0 ? basis : `${basis}-${i + 1}`;
    const belegt = await tx`SELECT 1 FROM organization WHERE slug = ${kandidat} LIMIT 1`;
    if (!belegt[0]) return kandidat;
  }
  return `${basis}-${Date.now().toString(36)}`;
}

/* Höchstens 5 Organisationen je Person — eine Missbrauchsbremse, keine
   fachliche Grenze. Zählt alle je angelegten, auch stillgelegte: wer die
   Bremse umgehen könnte, indem er alte Organisationen archiviert, hätte
   effektiv keine Bremse. */
const ORG_LIMIT = 5;

export async function organisationAnlegen(person: Person, roheEingabe: unknown): Promise<OrgProfil> {
  if (!person.emailBestaetigt) {
    throw new AppError("FORBIDDEN", "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse, bevor Sie eine Organisation anlegen");
  }
  const eingabe = OrganisationAnlegenSchema.parse(roheEingabe);
  const legalName = eingabe.legalName ?? eingabe.displayName;

  const anzahlZeile = await sql`SELECT count(*)::int AS n FROM organization WHERE created_by = ${person.id}`;
  if (Number(anzahlZeile[0]?.n ?? 0) >= ORG_LIMIT) {
    throw new AppError("CONFLICT", `Sie haben bereits die zulässige Höchstzahl von ${ORG_LIMIT} Organisationen angelegt`);
  }

  const profil = await sql.begin(async tx => {
    const basis = slugBasis(eingabe.displayName);
    const slug = await freierSlug(tx, basis);
    const orgRows = await tx`
      INSERT INTO organization (slug, kind, legal_name, display_name, locale, website, public_email, public_phone,
                                 street, postal_code, city, description, created_by, is_active)
      VALUES (${slug}, ${eingabe.kind}, ${legalName}, ${eingabe.displayName}, ${eingabe.locale},
              ${eingabe.website ?? null}, ${eingabe.publicEmail ?? null}, ${eingabe.publicPhone ?? null},
              ${eingabe.street ?? null}, ${eingabe.postalCode ?? null}, ${eingabe.city ?? null},
              ${eingabe.description ?? null}, ${person.id}, true)
      RETURNING ${sql.unsafe(PROFIL_FELDER)}`;
    const org = orgRows[0]!;
    await tx`INSERT INTO org_membership (organization_id, user_id, role, is_active) VALUES (${org.id}, ${person.id}, 'owner', true)`;
    await tx`INSERT INTO audit_log (actor_user_id, actor_role, action, entity_type, entity_id, new_state)
             VALUES (${person.id}, ${person.rolle}, 'org.created', 'organization', ${org.id}, 'unverified')`;
    return alsProfil(org);
  });
  log.info("organisation.angelegt", { org: profil.slug, actor: person.id });
  return profil;
}

/* ---------- Profil ---------- */
export async function profilLesen(kontext: OrgKontext): Promise<OrgProfil> {
  const z = await sql`SELECT ${sql.unsafe(PROFIL_FELDER)} FROM organization WHERE id = ${kontext.org.id} LIMIT 1`;
  if (!z[0]) throw new AppError("NOT_FOUND", "Diese Organisation gibt es nicht");
  return alsProfil(z[0]);
}

export async function profilAendern(kontext: OrgKontext, akteur: Person, roheEingabe: unknown): Promise<OrgProfil> {
  if (!orgDarf(kontext.mitglied.rolle, "MANAGE_PUBLISHER_PROFILE")) {
    throw new AppError("FORBIDDEN", "Dafür fehlt Ihnen die Berechtigung in diesem Team");
  }
  const eingabe = ProfilAendernSchema.parse(roheEingabe);
  const heikel = "legalName" in eingabe || "locale" in eingabe;
  if (heikel && !orgDarf(kontext.mitglied.rolle, "MANAGE_ORGANIZATION")) {
    throw new AppError("FORBIDDEN", "Firmenname und Sprache darf nur die Besitzerin ändern");
  }

  /* Ein neu gesetztes Logo muss der handelnden Person gehören — dieselbe
     Regel wie bei Inseratsbildern (server/entwuerfe.ts:materialisieren). */
  if ("logoAssetId" in eingabe && eingabe.logoAssetId != null) {
    const ok = await sql`SELECT 1 FROM media_asset WHERE id = ${eingabe.logoAssetId} AND uploaded_by = ${akteur.id}`;
    if (!ok[0]) throw new AppError("FORBIDDEN", "Dieses Bild gehört nicht zu Ihrem Konto");
  }

  const jetzt = await profilLesen(kontext);
  const naechste = {
    displayName: "displayName" in eingabe ? eingabe.displayName! : jetzt.displayName,
    legalName: "legalName" in eingabe ? eingabe.legalName! : jetzt.legalName,
    locale: "locale" in eingabe ? eingabe.locale! : jetzt.locale,
    website: "website" in eingabe ? (eingabe.website ?? null) : jetzt.website,
    publicEmail: "publicEmail" in eingabe ? (eingabe.publicEmail ?? null) : jetzt.publicEmail,
    publicPhone: "publicPhone" in eingabe ? (eingabe.publicPhone ?? null) : jetzt.publicPhone,
    street: "street" in eingabe ? (eingabe.street ?? null) : jetzt.street,
    postalCode: "postalCode" in eingabe ? (eingabe.postalCode ?? null) : jetzt.postalCode,
    city: "city" in eingabe ? (eingabe.city ?? null) : jetzt.city,
    description: "description" in eingabe ? (eingabe.description ?? null) : jetzt.description,
    logoAssetId: "logoAssetId" in eingabe ? (eingabe.logoAssetId ?? null) : jetzt.logoAssetId
  };

  const z = await sql`
    UPDATE organization SET
      display_name = ${naechste.displayName}, legal_name = ${naechste.legalName}, locale = ${naechste.locale},
      website = ${naechste.website}, public_email = ${naechste.publicEmail}, public_phone = ${naechste.publicPhone},
      street = ${naechste.street}, postal_code = ${naechste.postalCode}, city = ${naechste.city},
      description = ${naechste.description}, logo_asset_id = ${naechste.logoAssetId}
    WHERE id = ${kontext.org.id}
    RETURNING ${sql.unsafe(PROFIL_FELDER)}`;
  /* Ein gesetztes Logo wird öffentlich (abl/ → pub/). Nicht in der Transaktion
     oben: der Objektspeicher ist kein Transaktionsteilnehmer, und ein neu
     gesetztes Logo, dessen Kopie scheitert, ist ehrlicher als ein halb
     zurückgerolltes Profil — der Fehler geht als 500 an den Aufrufer. */
  if (naechste.logoAssetId) await medienLogoVeroeffentlichen(sql, naechste.logoAssetId);
  await sql`INSERT INTO audit_log (actor_user_id, actor_role, action, entity_type, entity_id)
            VALUES (${akteur.id}, ${akteur.rolle}, 'org.profile_changed', 'organization', ${kontext.org.id})`;
  log.info("organisation.profil_geaendert", { org: kontext.org.slug });
  return alsProfil(z[0]!);
}

/* ---------- Stilllegen ----------
   Kein Löschen: der Prüfpfad und alle bereits veröffentlichten Inserate
   bleiben nachvollziehbar (§40/§46). Solange noch etwas im Markt oder in
   Prüfung steht, ist Stilllegen ein Widerspruch — deshalb CONFLICT. */
const BLOCKIERT_STILLLEGEN = ["published", "reserved", "submitted", "in_review", "approved"];

export async function stilllegen(kontext: OrgKontext, akteur: Person): Promise<void> {
  if (!orgDarf(kontext.mitglied.rolle, "MANAGE_ORGANIZATION")) {
    throw new AppError("FORBIDDEN", "Dafür fehlt Ihnen die Berechtigung in diesem Team");
  }
  const blockiertZeile = await sql`
    SELECT count(*)::int AS n FROM listing
     WHERE published_by_org_id = ${kontext.org.id} AND status = ANY(${BLOCKIERT_STILLLEGEN}::listing_status[])`;
  if (Number(blockiertZeile[0]?.n ?? 0) > 0) {
    throw new AppError("CONFLICT", "Diese Organisation hat noch veröffentlichte oder in Prüfung stehende Inserate — Stilllegen erst danach möglich");
  }
  await sql.begin(async tx => {
    await tx`UPDATE organization SET archived_at = now(), is_active = false WHERE id = ${kontext.org.id}`;
    await tx`UPDATE org_membership SET is_active = false WHERE organization_id = ${kontext.org.id}`;
    await tx`INSERT INTO audit_log (actor_user_id, actor_role, action, entity_type, entity_id, previous_state, new_state)
             VALUES (${akteur.id}, ${akteur.rolle}, 'org.archived', 'organization', ${kontext.org.id}, 'active', 'archived')`;
  });
  log.info("organisation.stillgelegt", { org: kontext.org.slug });
}

/* ---------- Team ---------- */
export interface MitgliedZeile {
  userId: string;
  name: string;
  email: string | null;
  rolle: OrgRolle;
  isActive: boolean;
  createdAt: string;
}
export interface OffeneEinladungZeile {
  id: string;
  email: string;
  rolle: OrgRolle;
  expiresAt: string;
}

export async function mitglieder(kontext: OrgKontext): Promise<{ mitglieder: MitgliedZeile[]; einladungen: OffeneEinladungZeile[] }> {
  const darfMitgliederVerwalten = orgDarf(kontext.mitglied.rolle, "MANAGE_MEMBERS");
  const z = await sql`
    SELECT u.id AS user_id, u.display_name, u.email, m.role, m.is_active, m.created_at
      FROM org_membership m JOIN app_user u ON u.id = m.user_id
     WHERE m.organization_id = ${kontext.org.id} AND m.is_active
     ORDER BY m.role, u.display_name`;
  const mitgliederZeilen: MitgliedZeile[] = z.map(r => ({
    userId: String(r.user_id), name: String(r.display_name ?? "—"),
    email: darfMitgliederVerwalten ? String(r.email ?? "") : null,
    rolle: r.role as OrgRolle, isActive: Boolean(r.is_active), createdAt: alsZeit(r.created_at)
  }));

  let einladungen: OffeneEinladungZeile[] = [];
  if (darfMitgliederVerwalten) {
    const e = await sql`
      SELECT id, email, role, expires_at FROM org_invitation
       WHERE organization_id = ${kontext.org.id} AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC`;
    einladungen = e.map(r => ({ id: String(r.id), email: String(r.email), rolle: r.role as OrgRolle, expiresAt: alsZeit(r.expires_at) }));
  }
  return { mitglieder: mitgliederZeilen, einladungen };
}

/* ---------- Rolle ändern ----------
   Reihenfolge bewusst: zuerst die Datenintegrität («nie ohne Besitzerin
   dastehen», §16) — das gilt unabhängig davon, wer die Änderung auslöst.
   Erst danach die persönliche Einschränkung («eigene Rolle nie selbst
   ändern», §17), die auch eine Besitzerin mit einer Mitbesitzerin träfe. */
export async function rolleAendern(kontext: OrgKontext, akteur: Person, zielUserId: string, neueRolle: OrgRolle): Promise<void> {
  if (!darfRolleVergeben(kontext.mitglied.rolle, neueRolle)) {
    throw new AppError("FORBIDDEN", "Dafür fehlt Ihnen die Berechtigung, diese Rolle zu vergeben");
  }
  const [ziel] = await sql`
    SELECT role FROM org_membership WHERE organization_id = ${kontext.org.id} AND user_id = ${zielUserId} AND is_active LIMIT 1`;
  if (!ziel) throw new AppError("NOT_FOUND", "Dieses Mitglied gibt es nicht");
  const vorherigeRolle = ziel.role as OrgRolle;

  if (vorherigeRolle === "owner" && neueRolle !== "owner") {
    const ownerZeile = await sql`
      SELECT count(*)::int AS n FROM org_membership WHERE organization_id = ${kontext.org.id} AND role = 'owner' AND is_active`;
    if (Number(ownerZeile[0]?.n ?? 0) <= 1) throw new AppError("CONFLICT", "Die letzte Besitzerin kann nicht herabgestuft werden");
  }
  if (zielUserId === akteur.id) {
    throw new AppError("FORBIDDEN", "Sie können Ihre eigene Rolle nicht ändern");
  }

  await sql.begin(async tx => {
    await tx`UPDATE org_membership SET role = ${neueRolle} WHERE organization_id = ${kontext.org.id} AND user_id = ${zielUserId}`;
    await tx`INSERT INTO audit_log (actor_user_id, actor_role, action, entity_type, entity_id, previous_state, new_state, reason)
             VALUES (${akteur.id}, ${akteur.rolle}, 'org.role_changed', 'organization', ${kontext.org.id}, ${vorherigeRolle}, ${neueRolle}, ${`Mitglied ${zielUserId}`})`;
  });
  log.info("organisation.rolle_geaendert", { org: kontext.org.slug, ziel: zielUserId, von: vorherigeRolle, nach: neueRolle });
}

/* ---------- Mitglied entfernen ----------
   Die letzte Besitzerin fällt nie weg — unabhängig davon, wer die Entfernung
   auslöst. Sich selbst entfernen darf nur eine Besitzerin, und nur, solange
   eine weitere Besitzerin übrig bleibt (§16/§17). */
export async function mitgliedEntfernen(kontext: OrgKontext, akteur: Person, zielUserId: string): Promise<void> {
  if (!orgDarf(kontext.mitglied.rolle, "MANAGE_MEMBERS")) {
    throw new AppError("FORBIDDEN", "Dafür fehlt Ihnen die Berechtigung in diesem Team");
  }
  const [ziel] = await sql`
    SELECT role FROM org_membership WHERE organization_id = ${kontext.org.id} AND user_id = ${zielUserId} AND is_active LIMIT 1`;
  if (!ziel) throw new AppError("NOT_FOUND", "Dieses Mitglied gibt es nicht");
  const zielRolle = ziel.role as OrgRolle;

  const ownerZeile = await sql`
    SELECT count(*)::int AS n FROM org_membership WHERE organization_id = ${kontext.org.id} AND role = 'owner' AND is_active`;
  if (zielRolle === "owner" && Number(ownerZeile[0]?.n ?? 0) <= 1) {
    throw new AppError("CONFLICT", "Die letzte Besitzerin kann nicht entfernt werden");
  }
  if (zielUserId === akteur.id && zielRolle !== "owner") {
    throw new AppError("FORBIDDEN", "Sie können sich nicht selbst aus dem Team entfernen");
  }

  const [person] = await sql`SELECT email, locale FROM app_user WHERE id = ${zielUserId} LIMIT 1`;

  await sql.begin(async tx => {
    await tx`UPDATE org_membership SET is_active = false WHERE organization_id = ${kontext.org.id} AND user_id = ${zielUserId}`;
    await tx`UPDATE listing SET assigned_user_id = NULL WHERE published_by_org_id = ${kontext.org.id} AND assigned_user_id = ${zielUserId}`;
    await tx`INSERT INTO audit_log (actor_user_id, actor_role, action, entity_type, entity_id, previous_state, reason)
             VALUES (${akteur.id}, ${akteur.rolle}, 'org.member_removed', 'organization', ${kontext.org.id}, ${zielRolle}, ${`Mitglied ${zielUserId}`})`;
    if (person?.email) {
      const locale = (person.locale === "fr" || person.locale === "it" || person.locale === "en") ? person.locale : "de";
      const { betreff, text } = mailtext("org_member_removed", locale, { org: kontext.org.displayName });
      await einreihen(tx, { an: String(person.email), betreff, text, locale, art: "org_member_removed", bezug: { art: "organization", kennung: kontext.org.id } });
    }
  });
  log.info("organisation.mitglied_entfernt", { org: kontext.org.slug, ziel: zielUserId });
}
