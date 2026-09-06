import "server-only";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { auth } from "./auth";
import { APIError } from "better-auth/api";
import { sql } from "./db";
import { storage } from "@/services/storage";
import { medienZurueckziehen } from "./medien";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/log";
import type { Person, Status } from "@/domain/rechte";
import type { OrgRolle } from "@/domain/orgrechte";
import { alleinigeEigentuemerschaften, klassifiziereInserat, type OrgMitgliedschaftFuerLoeschung } from "@/domain/kontoloeschung";

/* Konto löschen (P5.10 §9–§12).

   Ablauf, in dieser Reihenfolge — jeder Schritt kann abbrechen, bevor der
   nächste beginnt:

     1. Passwort erneut prüfen (auth.api.verifyPassword — dieselbe Sitzung,
        kein neuer Anmeldevorgang, kein zusätzliches Sitzungscookie).
     2. Organisationsregel (§10): ist die Person die EINZIGE aktive
        Besitzerin einer aktiven Organisation, wird die Löschung mit
        CONFLICT/SOLE_OWNER abgelehnt — bevor irgendetwas geschrieben wird.
     3. Die eigentliche Löschung/Anonymisierung/Zurückstellung in EINER
        Datenbanktransaktion (§9). Scheitert ein Teil, bleibt das Konto
        unverändert.
     4. Nach dem erfolgreichen Commit: verwaiste Objekte im Speicher
        entfernen (kein Transaktionsteilnehmer, wie services/storage.ts es
        an anderer Stelle schon hält — server/organisationen.ts:profilAendern)
        und alle Sitzungen/das Cookie beenden.

   Was NICHT hier entschieden wird: irgendeine Aufbewahrungsfrist. Jede
   "ZURUECKGESTELLT_RECHTSENTSCHEID"-Behandlung aus domain/kontoloeschung.ts
   bleibt genau das — zurückgestellt, nicht terminiert. */

type Tx = typeof sql;

/* ---------- 1: Passwort ---------- */
/* Better Auth hat mit `/verify-password` (auth.api.verifyPassword) eine
   serverseitige Prüfung des aktuellen Passworts der ANGEMELDETEN Person —
   ohne neue Sitzung, ohne neues Cookie, ohne eigene Kryptografie (§9: "prüfe,
   ob eine Server-API zum Passwortcheck existiert" — sie existiert). */
export async function passwortDerSitzungPruefen(passwort: string): Promise<void> {
  const h = await headers();
  try {
    await auth.api.verifyPassword({ headers: h, body: { password: passwort } });
  } catch (e) {
    if (e instanceof APIError) throw new AppError("VALIDATION", "Das Passwort stimmt nicht", { passwort: "falsch" });
    throw e;
  }
}

/* ---------- 2: Organisationsregel ---------- */
async function eigeneOrgMitgliedschaften(personId: string): Promise<OrgMitgliedschaftFuerLoeschung[]> {
  const z = await sql`
    SELECT o.id AS org_id, o.display_name AS org_name, o.slug AS org_slug, m.role,
           (o.is_active AND o.archived_at IS NULL) AS organisation_aktiv,
           EXISTS (
             SELECT 1 FROM org_membership m2
              WHERE m2.organization_id = m.organization_id AND m2.role = 'owner'
                AND m2.is_active AND m2.user_id <> ${personId}
           ) AS weitere_owner
      FROM org_membership m JOIN organization o ON o.id = m.organization_id
     WHERE m.user_id = ${personId} AND m.is_active`;
  return z.map(r => ({
    orgId: String(r.org_id),
    orgName: String(r.org_name),
    orgSlug: String(r.org_slug),
    rolle: r.role as OrgRolle,
    organisationAktiv: Boolean(r.organisation_aktiv),
    weitereAktiveEigentuemerinVorhanden: Boolean(r.weitere_owner)
  }));
}

/* Für die Seite /konto/loeschen (Warnung + Link zum Team) UND für die
   Löschung selbst — dieselbe Quelle, keine zweite Abfrage, die abweichen könnte. */
export async function alleinigeOrganisationenLesen(personId: string): Promise<{ orgId: string; orgName: string; orgSlug: string }[]> {
  const mitgliedschaften = await eigeneOrgMitgliedschaften(personId);
  return alleinigeEigentuemerschaften(mitgliedschaften).map(m => ({ orgId: m.orgId, orgName: m.orgName, orgSlug: m.orgSlug! }));
}

/* ---------- 3+4: Die Löschung ---------- */
export interface KontoLoeschungZusammenfassung {
  geloescht: string[];
  bleibt: string[];
  zurueckgestellt: string[];
}

/* Eigene, private Entwürfe/Prüfstand-Inserate ganz entfernen — inklusive
   Liegenschaft (falls von keinem anderen Inserat mehr gebraucht) und Bilder.
   Storage-Schlüssel werden nur GESAMMELT; gelöscht wird erst nach dem Commit
   (services/storage.ts ist kein Transaktionsteilnehmer). */
async function entwuerfeLoeschen(tx: Tx, personId: string): Promise<{ anzahl: number; storageKeys: string[] }> {
  const listingRows = await tx`
    SELECT id, property_id, draft_data FROM listing
     WHERE published_by_user_id = ${personId} AND published_by_org_id IS NULL
       AND status IN ('draft','submitted','in_review','changes_required','rejected')`;
  if (!listingRows.length) return { anzahl: 0, storageKeys: [] };
  const listingIds = listingRows.map(r => String(r.id));
  const propertyIds = [...new Set(listingRows.map(r => String(r.property_id)))];

  /* Bilder eines Entwurfs stehen zunächst NUR im Assistentenstand
     (`draft_data.bilder`, ein Array von media_asset-Kennungen) — eine Zeile
     in `listing_image` entsteht erst beim Einreichen (materialisieren(),
     server/entwuerfe.ts). Ein reiner Entwurf (nie eingereicht) hat also gar
     keine `listing_image`-Zeile; ein abgelehnter/zurückgeschickter Entwurf
     (rejected/changes_required) kann beides haben. Beide Quellen zählen. */
  const bildRows = await tx`SELECT DISTINCT asset_id FROM listing_image WHERE listing_id = ANY(${listingIds})`;
  const assetIdsAusBildern = new Set(bildRows.map(r => String(r.asset_id)));
  for (const r of listingRows) {
    const bilder = (r.draft_data as { bilder?: unknown } | null)?.bilder;
    if (Array.isArray(bilder)) for (const b of bilder) if (typeof b === "string") assetIdsAusBildern.add(b);
  }
  const assetIds = [...assetIdsAusBildern];

  /* Reihenfolge: die Inserate zuerst (räumt listing_image/listing_content/
     moderation_case/draft_claim per ON DELETE CASCADE mit; inquiry.listing_id
     und service_lead.listing_id werden per ON DELETE SET NULL entkoppelt,
     ohne dass diese Anfragen/Anliegen selbst verschwinden). Danach die
     Liegenschaft, nur wenn sie kein anderes Inserat (mehr) trägt — dasselbe
     Haus kann über Jahre mehrere Inserate haben (0003). Zuletzt die Bilder,
     nur wenn kein Inserat und kein Organisationslogo sie noch braucht. */
  await tx`DELETE FROM listing WHERE id = ANY(${listingIds})`;
  await tx`DELETE FROM property WHERE id = ANY(${propertyIds})
             AND NOT EXISTS (SELECT 1 FROM listing WHERE listing.property_id = property.id)`;

  const storageKeys: string[] = [];
  for (const assetId of assetIds) {
    const [z] = await tx`
      SELECT (EXISTS (SELECT 1 FROM listing_image WHERE asset_id = ${assetId})
              OR EXISTS (SELECT 1 FROM organization WHERE logo_asset_id = ${assetId})) AS gebraucht`;
    if (z?.gebraucht) continue;
    const varianten = await tx`SELECT storage_key FROM media_variant WHERE asset_id = ${assetId}`;
    const [asset] = await tx`SELECT storage_key FROM media_asset WHERE id = ${assetId}`;
    if (!asset) continue;
    await tx`DELETE FROM media_asset WHERE id = ${assetId}`;
    storageKeys.push(String(asset.storage_key), ...varianten.map(v => String(v.storage_key)));
  }
  return { anzahl: listingIds.length, storageKeys };
}

/* Eigene, private Inserate, die öffentlich waren/sind (oder es bereits
   archiviert sind): in den Endzustand 'archived' versetzen (§9). Damit
   verschwinden sie aus `listing_public` (WHERE status IN ('published',
   'reserved'), 0008/0009) — dieselbe Sicht, über die jede öffentliche Anzeige
   läuft — vollständig und unumkehrbar (0004: 'archived' hat keinen
   Folgezustand). Medien bleiben im Speicher, werden aber nicht mehr
   öffentlich ausgeliefert (pub/ → abl/, wie beim Pausieren). */
async function aktiveInserateZurueckstellen(tx: Tx, person: Person): Promise<number> {
  const rows = await tx`
    SELECT id, status FROM listing
     WHERE published_by_user_id = ${person.id} AND published_by_org_id IS NULL
       AND status IN ('published','reserved','paused','expired','sold','rented','archived')`;
  if (!rows.length) return 0;
  await tx`SELECT set_config('app.actor_id', ${person.id}, true), set_config('app.reason', 'konto-geloescht', true)`;
  for (const r of rows) {
    const status = String(r.status) as Status;
    if (status === "published" || status === "reserved") await medienZurueckziehen(tx, String(r.id));
    if (status !== "archived") await tx`UPDATE listing SET status = 'archived' WHERE id = ${r.id}`;
  }
  return rows.length;
}

/* Zuweisung im Team einer Organisation aufheben — unabhängig davon, ob die
   Person dort noch (aktives) Mitglied ist (P5.7 §38-Logik, hier global auf
   die gelöschte Person angewendet: sie kann in keinem Team mehr zuständig sein). */
async function orgZuweisungenAufheben(tx: Tx, personId: string): Promise<number> {
  const z = await tx`UPDATE listing SET assigned_user_id = NULL WHERE assigned_user_id = ${personId} RETURNING id`;
  return z.length;
}

async function passwortEreignisAufraeumen(tx: Tx, personId: string, email: string): Promise<{
  organisationen: number; einladungen: number; mailGeloescht: number; mailBleibt: number;
  anfragen: number; anliegen: number; favoriten: number; suchen: number; verlauf: number;
}> {
  const orgMitgliedschaften = await tx`UPDATE org_membership SET is_active = false WHERE user_id = ${personId} AND is_active RETURNING organization_id`;
  const einladungen = await tx`
    UPDATE org_invitation SET revoked_at = now()
     WHERE email = ${email} AND accepted_at IS NULL AND revoked_at IS NULL RETURNING id`;

  const [mailBleibtZeile] = await tx`SELECT count(*)::int AS n FROM mail_outbox WHERE recipient = ${email} AND status = 'accepted'`;
  const mailGeloescht = await tx`DELETE FROM mail_outbox WHERE recipient = ${email} AND status IN ('created','failed','abandoned') RETURNING id`;

  const anfragen = await tx`UPDATE inquiry SET sender_user_id = NULL WHERE sender_user_id = ${personId} RETURNING id`;
  const anliegen = await tx`UPDATE service_lead SET user_id = NULL WHERE user_id = ${personId} RETURNING id`;
  const favoriten = await tx`DELETE FROM favorite WHERE user_id = ${personId} RETURNING id`;
  /* search_alert/search_alert_sent räumt ON DELETE CASCADE mit. */
  const suchen = await tx`DELETE FROM saved_search WHERE user_id = ${personId} RETURNING id`;
  const verlauf = await tx`DELETE FROM recently_viewed WHERE user_id = ${personId} RETURNING id`;

  return {
    organisationen: orgMitgliedschaften.length,
    einladungen: einladungen.length,
    mailGeloescht: mailGeloescht.length,
    mailBleibt: Number(mailBleibtZeile?.n ?? 0),
    anfragen: anfragen.length,
    anliegen: anliegen.length,
    favoriten: favoriten.length,
    suchen: suchen.length,
    verlauf: verlauf.length
  };
}

/* Die Person selbst: Tombstone statt Löschen (§9) — die Zeile bleibt wegen
   bestehender Fremdschlüssel (audit_log, listing, inquiry, service_lead,
   org_membership …). */
async function personAnonymisieren(tx: Tx, personId: string): Promise<void> {
  const tombstone = `geloescht+${randomUUID()}@konto.geloescht.invalid`;
  await tx`
    UPDATE app_user SET
      email = ${tombstone}, display_name = 'Gelöschtes Konto', phone = NULL,
      platform_role = 'user', email_verified = false, anonymous_key = NULL, deleted_at = now()
    WHERE id = ${personId}`;
}

export async function kontoLoeschen(person: Person, email: string, passwort: string): Promise<KontoLoeschungZusammenfassung> {
  await passwortDerSitzungPruefen(passwort);

  const mitgliedschaften = await eigeneOrgMitgliedschaften(person.id);
  const alleinig = alleinigeEigentuemerschaften(mitgliedschaften);
  if (alleinig.length) {
    throw new AppError(
      "CONFLICT",
      "Sie sind die einzige Besitzerin/der einzige Besitzer einer aktiven Organisation. " +
        "Machen Sie zuerst eine andere Person zur Besitzerin oder legen Sie die Organisation still.",
      { grund: "SOLE_OWNER", organisationen: alleinig.map(o => o.orgName).join(", ") }
    );
  }

  /* Nur zur Einordnung im Bericht: wie viele private Inserate welcher Art es
     überhaupt gibt (die eigentliche Arbeit übernehmen die Funktionen oben —
     diese Zählung dupliziert keine Schreiblogik, nur eine Lesezählung für die
     Zusammenfassung nach aussen). Beide Rollen zählen: wer ein Inserat
     angelegt hat (published_by_user_id) UND wer im Team dafür zuständig war
     (assigned_user_id) — ein Organisationsinserat kann beides getrennt sein. */
  const inseratZeilen = await sql`
    SELECT status, published_by_org_id FROM listing
     WHERE published_by_user_id = ${person.id} OR assigned_user_id = ${person.id}`;
  const eigeneEntwuerfeVorhanden = inseratZeilen.some(
    r => klassifiziereInserat({ orgId: r.published_by_org_id ? String(r.published_by_org_id) : null, status: r.status as Status }) === "loeschen"
  );
  const eigeneAktiveVorhanden = inseratZeilen.some(
    r => klassifiziereInserat({ orgId: r.published_by_org_id ? String(r.published_by_org_id) : null, status: r.status as Status }) === "zurueckstellen"
  );
  const fremdeOrgInserateVorhanden = inseratZeilen.some(
    r => klassifiziereInserat({ orgId: r.published_by_org_id ? String(r.published_by_org_id) : null, status: r.status as Status }) === "fremdes_eigentum"
  );

  let storageKeys: string[] = [];
  let z: Awaited<ReturnType<typeof passwortEreignisAufraeumen>>;
  await sql.begin(async tx => {
    const entwuerfe = await entwuerfeLoeschen(tx, person.id);
    storageKeys = entwuerfe.storageKeys;
    await aktiveInserateZurueckstellen(tx, person);
    await orgZuweisungenAufheben(tx, person.id);
    z = await passwortEreignisAufraeumen(tx, person.id, email);
    await personAnonymisieren(tx, person.id);
    await tx`DELETE FROM auth_session WHERE user_id = ${person.id}`;
    await tx`INSERT INTO audit_log (actor_user_id, actor_role, action, entity_type, entity_id)
             VALUES (${person.id}, ${person.rolle}, 'account.deleted', 'app_user', ${person.id})`;
  });

  /* Nach dem Commit: Speicherobjekte entfernen (kein Transaktionsteilnehmer)
     und die Sitzung im Browser beenden. Ein Fehler hier ändert am
     erfolgreichen Löschen des Kontos nichts mehr — er wird protokolliert. */
  await Promise.all(storageKeys.map(k => storage().loeschen(k).catch(e => log.warn("konto.loeschung.speicherfehler", { schluessel: k, fehler: String(e) }))));
  try {
    const h = await headers();
    await auth.api.signOut({ headers: h });
  } catch (e) {
    log.warn("konto.loeschung.abmeldenFehlgeschlagen", { fehler: String(e) });
  }

  log.info("konto.geloescht", { actor: person.id, org_deaktiviert: mitgliedschaften.length });

  const geloescht = ["auth_session", "auth_account", "auth_verification", "favorite", "saved_search", "recently_viewed"];
  if (eigeneEntwuerfeVorhanden) geloescht.push("listing_entwurf");
  if (z!.mailGeloescht > 0) geloescht.push("mail_outbox_ungesendet");

  const bleibt = ["audit_log", "app_user"];
  if (fremdeOrgInserateVorhanden) bleibt.push("listing_organisation");
  if (mitgliedschaften.length > 0) bleibt.push("org_membership");
  if (z!.einladungen > 0) bleibt.push("org_invitation");

  const zurueckgestellt: string[] = [];
  if (eigeneAktiveVorhanden) zurueckgestellt.push("listing_aktiv");
  if (z!.anfragen > 0) zurueckgestellt.push("inquiry_gesendet");
  if (z!.anliegen > 0) zurueckgestellt.push("service_lead");
  if (z!.mailBleibt > 0) zurueckgestellt.push("mail_outbox_gesendet");

  return { geloescht, bleibt, zurueckgestellt };
}
