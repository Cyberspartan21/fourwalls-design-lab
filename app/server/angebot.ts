import "server-only";
import { sql } from "./db";
import { env } from "./env";

/* Ob der Menüpunkt «Neubau» überhaupt etwas zu zeigen hat (P5.9 Phase B,
   config/policy.ts: neubauAngebot). Fourwalls hat den Menüpunkt lange
   gezeigt, unabhängig davon, ob wirklich Bauträger-Inserate existieren —
   das war eine Sackgasse. Diese Abfrage entscheidet stattdessen aus dem
   tatsächlichen Datenbestand: existiert mindestens ein veröffentlichtes,
   öffentliches Inserat mit publisher_kind = 'developer'?

   Einfacher Modul-Cache statt unstable_cache: die Kopfleiste wird auf jeder
   Seite gerendert, ein Zähl-Query pro Aufruf wäre unnötig teuer. 60 Sekunden
   TTL reichen, weil ein neues Bauträger-Inserat nicht sekundengenau in der
   Navigation auftauchen muss. */

const TTL_MS = 60_000;
let zwischenspeicher: { bis: number; wert: boolean } | null = null;

export async function gibtEsBautraegerInserate(): Promise<boolean> {
  if (zwischenspeicher && zwischenspeicher.bis > Date.now()) return zwischenspeicher.wert;
  const nurEcht = env().APP_ENV === "production";
  const z = await sql`
    SELECT 1 FROM listing_public lp
     WHERE lp.publisher_kind = 'developer'
       AND (${nurEcht} = false OR lp.is_demo = false)
     LIMIT 1`;
  const wert = z.length > 0;
  zwischenspeicher = { bis: Date.now() + TTL_MS, wert };
  return wert;
}
