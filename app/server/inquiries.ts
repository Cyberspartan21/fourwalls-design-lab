import "server-only";
import { z } from "zod";
import { sql } from "./db";
import { env } from "./env";
import { einreihen } from "./outbox";
import { mailtext } from "@/lib/mailtext";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/log";

/* Die erste echte Schreiboperation der Anwendung.

   Reihenfolge, die zählt: prüfen → Inserat serverseitig auflösen → Zeile in
   `inquiry` → Nachricht dem Mailanbieter übergeben. Erst wenn die Zeile steht,
   gilt die Anfrage als angenommen. Scheitert der Versand, bleibt die Zeile —
   ein Mensch kann sie noch bearbeiten; das Protokoll hält es fest.

   Der Browser nennt nur die öffentliche Referenz. Empfänger, Inserat und
   Organisation werden hier aus der Datenbank bestimmt — nie aus dem Formular. */

export const AnfrageSchema = z.object({
  publicRef: z.string().regex(/^FWL-\d{4}-\d{6}$/),
  art: z.enum(["viewing_request", "listing_question"]),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  telefon: z.string().trim().max(40).optional().or(z.literal("")),
  nachricht: z.string().trim().min(5).max(2000),
  suchabo: z.boolean().optional(),
  /* Honigtopf: ein für Menschen unsichtbares Feld. Wer es füllt, ist ein Skript. */
  firma: z.string().max(0).optional()
}).strict();
export type Anfrage = z.infer<typeof AnfrageSchema>;

/* Steuerzeichen und Zeilenumbrüche im Namen sind nie gewollt. */
const glatt = (s: string) => s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

export async function anfrageAnnehmen(a: Anfrage, herkunft: { ipHash: string; uaHash: string | null }, senderUserId: string | null = null): Promise<{ publicRef: string }> {
  const nurEcht = env().APP_ENV === "production";
  /* Nur ein veröffentlichtes Inserat kann eine Anfrage empfangen. */
  const inserate = await sql`
    SELECT l.id, l.title, l.published_by_org_id, l.contact_user_id, l.assigned_user_id,
           au.email AS zugewiesen_email, au.locale AS zugewiesen_locale,
           EXISTS (SELECT 1 FROM org_membership om JOIN organization oo ON oo.id = om.organization_id
                    WHERE om.organization_id = l.published_by_org_id AND om.user_id = l.assigned_user_id
                      AND om.is_active AND oo.is_active AND oo.archived_at IS NULL) AS zugewiesen_aktiv,
           cu.email AS kontakt_email, cu.locale AS kontakt_locale,
           o.email AS org_email, o.public_email AS org_public_email, o.locale AS org_locale
      FROM listing l
      LEFT JOIN app_user au ON au.id = l.assigned_user_id
      LEFT JOIN app_user cu ON cu.id = l.contact_user_id
      LEFT JOIN organization o ON o.id = l.published_by_org_id
     WHERE l.public_ref = ${a.publicRef}
       AND l.status IN ('published','reserved')
       AND (${nurEcht} = false OR l.is_demo = false)
     LIMIT 1`;
  const ins = inserate[0];
  if (!ins) throw new AppError("NOT_FOUND", "Dieses Inserat ist nicht erreichbar");

  /* Empfängeradresse — deterministisch, nie aus dem Formular (§34/§37):
     1. Organisationsinserat mit aktiver Zuweisung → die zugewiesene Person.
     2. Organisationsinserat ohne (aktive) Zuweisung → das öffentliche
        Postfach der Organisation.
     3. Privatinserat → die Ansprechperson des Inserats.
     `recipient_org_id` wird bei Organisationsinseraten immer gesetzt — der
     Posteingang der Organisation sieht die Anfrage auch dann, wenn sie an
     eine Person adressiert ist. In der Entwicklung landet der tatsächliche
     Versand immer in der Senke; die recipient_*-Spalten bleiben ehrlich. */
  let empfaengerEmail: string | null = null;
  let recipientUserId: string | null = null;
  let recipientOrgId: string | null = null;
  let zielLocale: string | null | undefined = null;
  if (ins.published_by_org_id) {
    recipientOrgId = String(ins.published_by_org_id);
    if (ins.assigned_user_id && ins.zugewiesen_aktiv && ins.zugewiesen_email) {
      empfaengerEmail = String(ins.zugewiesen_email);
      recipientUserId = String(ins.assigned_user_id);
      zielLocale = ins.zugewiesen_locale;
    } else {
      empfaengerEmail = (ins.org_public_email ?? ins.org_email) ? String(ins.org_public_email ?? ins.org_email) : null;
      zielLocale = ins.org_locale;
    }
  } else {
    empfaengerEmail = ins.kontakt_email ? String(ins.kontakt_email) : null;
    recipientUserId = ins.contact_user_id ? String(ins.contact_user_id) : null;
    zielLocale = ins.kontakt_locale;
  }

  const e = env();
  const an = e.APP_ENV === "development" ? e.MAIL_DEV_SINK : empfaengerEmail;
  const l = zielLocale === "fr" || zielLocale === "it" || zielLocale === "en" ? zielLocale : "de";

  const publicRef = await sql.begin(async tx => {
    const zeilen = await tx`
      INSERT INTO inquiry (kind, listing_id, sender_user_id, sender_name, sender_email, sender_phone, recipient_user_id, recipient_org_id, message, wants_alert, source, ip_hash, user_agent_hash)
      VALUES (${a.art}, ${ins.id}, ${senderUserId}, ${glatt(a.name)}, ${a.email}, ${a.telefon ? glatt(a.telefon) : null},
              ${recipientUserId}, ${recipientOrgId},
              ${a.nachricht.replace(/\r\n?/g, "\n")}, ${a.suchabo === true}, 'web', ${herkunft.ipHash}, ${herkunft.uaHash})
      RETURNING public_ref`;
    const ref = String(zeilen[0]?.public_ref);

    /* Die Nachricht an die Anbieterin steht in derselben Transaktion wie die
       Anfrage — steht die Zeile, steht auch die Nachricht in der Outbox. */
    if (an) {
      const kontaktinfo = `Art: ${a.art}\nVon: ${glatt(a.name)} <${a.email}>${a.telefon ? `\nTelefon: ${glatt(a.telefon)}` : ""}\n\n${a.nachricht}`;
      const { betreff, text } = mailtext("inquiry", l, { titel: ins.title ?? "", referenz: ref, name: glatt(a.name), nachricht: kontaktinfo });
      await einreihen(tx, { an, betreff, text, locale: l, art: "inquiry", bezug: { art: "inquiry", kennung: ref } });
    }
    return ref;
  });
  log.info("inquiry.angenommen", { inquiry: publicRef, listing: a.publicRef, art: a.art });
  if (!an) log.warn("inquiry.ohneEmpfaenger", { inquiry: publicRef });
  return { publicRef };
}

export interface MeineAnfrage {
  publicRef: string;
  kind: string;
  status: string;
  message: string;
  createdAt: string;
  listing: { publicRef: string; title: string; slug: string | null; transaction: "sale" | "rent" | null } | null;
}

/* Die eigenen Anfragen einer angemeldeten Person — unabhängig davon, ob das
   Inserat später gelöscht wurde (ON DELETE SET NULL auf listing_id). Ein
   gelöschtes Inserat lässt die Anfrage nicht verschwinden, nur `listing`
   wird dann `null`.

   slug/transaction zusätzlich zur Basisabfrage, nur um den Link zur
   Objektseite bauen zu können ([bereich]/[art]/[slug] löst Abweichungen
   selbst per Redirect auf — die genaue Art hier ist trotzdem besser als
   geraten). */
export async function meineAnfragen(personId: string): Promise<MeineAnfrage[]> {
  const z = await sql`
    SELECT i.public_ref, i.kind, i.status, i.message, i.created_at,
           l.public_ref AS listing_ref, l.title AS listing_title, l.slug AS listing_slug, l.transaction AS listing_transaction
      FROM inquiry i
      LEFT JOIN listing l ON l.id = i.listing_id
     WHERE i.sender_user_id = ${personId}
     ORDER BY i.created_at DESC LIMIT 100`;
  return z.map(r => ({
    publicRef: String(r.public_ref),
    kind: String(r.kind),
    status: String(r.status),
    message: String(r.message),
    createdAt: new Date(r.created_at).toISOString(),
    listing: r.listing_ref
      ? { publicRef: String(r.listing_ref), title: String(r.listing_title ?? ""), slug: r.listing_slug ? String(r.listing_slug) : null, transaction: r.listing_transaction === "rent" ? "rent" : r.listing_transaction === "sale" ? "sale" : null }
      : null
  }));
}
