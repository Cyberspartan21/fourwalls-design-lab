import "server-only";
import { z } from "zod";
import { sql } from "./db";
import { env } from "./env";
import { mail } from "@/services/mail";
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

export async function anfrageAnnehmen(a: Anfrage, herkunft: { ipHash: string; uaHash: string | null }): Promise<{ publicRef: string }> {
  const nurEcht = env().APP_ENV === "production";
  /* Nur ein veröffentlichtes Inserat kann eine Anfrage empfangen. */
  const inserate = await sql`
    SELECT l.id, l.title, l.published_by_org_id, l.contact_user_id, u.email AS kontakt_email, o.email AS org_email
      FROM listing l
      LEFT JOIN app_user u ON u.id = l.contact_user_id
      LEFT JOIN organization o ON o.id = l.published_by_org_id
     WHERE l.public_ref = ${a.publicRef}
       AND l.status IN ('published','reserved')
       AND (${nurEcht} = false OR l.is_demo = false)
     LIMIT 1`;
  const ins = inserate[0];
  if (!ins) throw new AppError("NOT_FOUND", "Dieses Inserat ist nicht erreichbar");

  const zeilen = await sql`
    INSERT INTO inquiry (kind, listing_id, sender_name, sender_email, sender_phone, recipient_user_id, recipient_org_id, message, wants_alert, source, ip_hash, user_agent_hash)
    VALUES (${a.art}, ${ins.id}, ${glatt(a.name)}, ${a.email}, ${a.telefon ? glatt(a.telefon) : null},
            ${ins.contact_user_id ?? null}, ${ins.published_by_org_id ?? null},
            ${a.nachricht.replace(/\r\n?/g, "\n")}, ${a.suchabo === true}, 'web', ${herkunft.ipHash}, ${herkunft.uaHash})
    RETURNING public_ref`;
  const publicRef = String(zeilen[0]?.public_ref);
  log.info("inquiry.angenommen", { inquiry: publicRef, listing: a.publicRef, art: a.art });

  /* Empfänger aus der Beziehung Inserat → Ansprechperson → Organisation.
     In der Entwicklung landet alles in der Senke; kein echtes Postfach ist
     Teil der Fachlogik. */
  const e = env();
  const an = e.APP_ENV === "development" ? e.MAIL_DEV_SINK : (ins.kontakt_email ?? ins.org_email);
  if (!an) { log.warn("inquiry.ohneEmpfaenger", { inquiry: publicRef }); return { publicRef }; }
  try {
    await mail().senden({
      an, betreff: `Anfrage ${publicRef} · ${ins.title}`,
      text: `Anfrage zu ${a.publicRef} (${ins.title})\nArt: ${a.art}\nVon: ${glatt(a.name)} <${a.email}>${a.telefon ? `\nTelefon: ${glatt(a.telefon)}` : ""}\n\n${a.nachricht}`,
      bezug: { art: "inquiry", kennung: publicRef }
    });
  } catch (err) {
    /* Die Anfrage steht in der Datenbank; der Versand ist nachholbar. */
    log.error("inquiry.mailFehler", { inquiry: publicRef, fehler: err instanceof Error ? err.message : String(err) });
  }
  return { publicRef };
}
