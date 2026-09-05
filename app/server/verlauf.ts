import "server-only";
import { sql } from "./db";

/* Zuletzt angesehen einer angemeldeten Person — geräteübergreifend
   (recently_viewed, db/migrations/0015_kundenerlebnis.sql). Anonym bleibt
   das im Browser (components/verlauf.ts).

   Ein Verlaufs-Eintrag ist keine kritische Operation: er darf eine
   Objektseite nie zum Absturz bringen. Deshalb wirft eintragen() nie —
   findet sich die Referenz nicht (falsch, gelöscht), tut die Funktion
   einfach nichts. Der Aufrufer fängt trotzdem zusätzlich ab (§ siehe
   Objektseite), das hier ist die zweite, eigene Absicherung. */

const REF = /^FWL-\d{4}-\d{6}$/;
const HOECHSTZAHL = 24;

export async function eintragen(personId: string, publicRef: string): Promise<void> {
  if (!REF.test(publicRef)) return;
  const l = await sql`SELECT id FROM listing WHERE public_ref = ${publicRef} LIMIT 1`;
  const listingId = l[0]?.id as string | undefined;
  if (!listingId) return;

  await sql`
    INSERT INTO recently_viewed (user_id, listing_id) VALUES (${personId}, ${listingId})
    ON CONFLICT (user_id, listing_id) DO UPDATE SET viewed_at = now()`;

  await sql`
    DELETE FROM recently_viewed WHERE user_id = ${personId} AND id NOT IN (
      SELECT id FROM recently_viewed WHERE user_id = ${personId} ORDER BY viewed_at DESC LIMIT ${HOECHSTZAHL}
    )`;
}

/* Die letzten (höchstens 24) öffentlichen Referenzen dieser Person, neueste zuerst. */
export async function listeVerlauf(personId: string): Promise<string[]> {
  const z = await sql`
    SELECT l.public_ref FROM recently_viewed rv JOIN listing l ON l.id = rv.listing_id
     WHERE rv.user_id = ${personId}
     ORDER BY rv.viewed_at DESC
     LIMIT ${HOECHSTZAHL}`;
  return z.map(r => String(r.public_ref));
}
