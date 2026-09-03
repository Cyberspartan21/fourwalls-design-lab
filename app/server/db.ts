import "server-only";
import postgres from "postgres";
import { env } from "./env";
import { log } from "@/lib/log";

/* Ein Datenbankzugang für die ganze Anwendung.

   Bewusst kein ORM: Die Migrationen aus P5.1 sind geprüftes SQL und bleiben
   die Quelle der Wahrheit. Abfragen hier sind parametrisiert (Tagged Template
   — `sql\`...${wert}\`` erzeugt immer Parameter, nie Textverkettung), auch für
   PostGIS. Das ist die Antwort auf SQL-Injection über Slug, Kennung, Koordinate
   oder Suchtext: Es gibt keinen Weg, Nutzereingaben in den SQL-Text zu bekommen. */

declare global {
  var __fwSql: ReturnType<typeof postgres> | undefined;
}

function verbinden() {
  const e = env();
  return postgres(e.DATABASE_URL, {
    max: e.APP_ENV === "production" ? 10 : 4,
    idle_timeout: 20,
    connect_timeout: 5,
    /* Zeiten und Zahlen kommen als Text bzw. Number — numeric wird nicht
       stillschweigend zu float. Preise sind bigint in Rappen. */
    transform: { undefined: null },
    onnotice: () => {}
  });
}

/* In der Entwicklung überlebt der Pool das Neuladen der Module. */
export const sql = globalThis.__fwSql ?? verbinden();
if (env().APP_ENV !== "production") globalThis.__fwSql = sql;

/* Für die Bereitschaftsprüfung: antwortet die Datenbank überhaupt? */
export async function dbErreichbar(): Promise<boolean> {
  try {
    await sql`select 1`;
    return true;
  } catch (e) {
    log.error("db.unerreichbar", e);
    return false;
  }
}
