import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "./db";
import { env } from "./env";
import { einreihen } from "./outbox";
import { mailtext } from "@/lib/mailtext";
import { AppError } from "@/lib/errors";
import { SuchanfrageSchema } from "@/domain/suchurl";

/* Gespeicherte Suchen und Suchabos (P5.6).

   Zwei Wege, dieselbe Tabelle: angemeldet hängt die Suche an `user_id` und
   ist sofort aktiv (die Kontoadresse ist schon bestätigt) — anonym hängt sie
   an einen belanglosen `anonymous_key` (nur zur Erfüllung der
   Datenbankbedingung, es gibt bewusst keine anonyme Verwaltungsoberfläche)
   und verlangt eine Bestätigung per E-Mail (Double-Opt-in), bevor je etwas
   verschickt wird.

   Die Alarmprüfung (server/suchabo-matching.ts) nutzt für die eigentliche
   Suche ausschliesslich server/search.ts:suche() — hier wird nichts davon
   dupliziert, nur validiert (SuchanfrageSchema) und gespeichert. */

export type Frequenz = "immediately" | "daily" | "weekly";
type Traeger = { userId: string } | { email: string };
type MailLocale = "de" | "fr" | "it" | "en";

/* Die Datenbank kennt den ENUM-Wert 'instant' (db/migrations/0001_grundlage.sql),
   nach aussen (API, Domäne) heisst derselbe Wert "immediately" — Übersetzung
   an dieser einen Stelle, wie TRANS_ZU_DB/DB_ZU_TRANS in domain/marktplatz.ts. */
type DbFrequenz = "instant" | "daily" | "weekly";
const FREQUENZ_ZU_DB: Record<Frequenz, DbFrequenz> = { immediately: "instant", daily: "daily", weekly: "weekly" };
const DB_ZU_FREQUENZ: Record<string, Frequenz> = { instant: "immediately", daily: "daily", weekly: "weekly" };

const LOCALES: readonly MailLocale[] = ["de", "fr", "it", "en"];
function alsMailLocale(l: unknown): MailLocale {
  return (LOCALES as readonly string[]).includes(String(l)) ? (l as MailLocale) : "de";
}

function token(): string {
  return randomBytes(24).toString("base64url");
}

export interface MeineSucheZeile {
  id: string;
  label: string | null;
  query: unknown;
  createdAt: string;
  alert: { id: string; frequency: string; isPaused: boolean; confirmedAt: string | null; lastSentAt: string | null };
}

/* ---------- Anlegen ---------- */
export async function anlegen(
  traeger: Traeger,
  query: unknown,
  label: string | null,
  frequency: Frequenz,
  locale: string = "de"
): Promise<{ savedSearchId: string; alertId: string; erfordertBestaetigung: boolean }> {
  const anfrage = SuchanfrageSchema.parse(query);

  return sql.begin(async tx => {
    if ("userId" in traeger) {
      const [u] = await tx`SELECT email, locale FROM app_user WHERE id = ${traeger.userId} AND deleted_at IS NULL LIMIT 1`;
      if (!u?.email) throw new AppError("VALIDATION", "Kein Konto gefunden");
      const unsubscribe = token();
      const ssRows = await tx`
        INSERT INTO saved_search (user_id, query, label)
        VALUES (${traeger.userId}, ${sql.json(anfrage)}, ${label})
        RETURNING id`;
      const ss = ssRows[0]!;
      const saRows = await tx`
        INSERT INTO search_alert (saved_search_id, email, confirmed_at, confirm_token, unsubscribe_token, frequency)
        VALUES (${ss.id}, ${String(u.email)}, now(), NULL, ${unsubscribe}, ${FREQUENZ_ZU_DB[frequency]})
        RETURNING id`;
      const sa = saRows[0]!;
      return { savedSearchId: String(ss.id), alertId: String(sa.id), erfordertBestaetigung: false };
    }

    /* Anonym: KEINE anonyme Verwaltungsoberfläche — anonymous_key erfüllt
       nur saved_search_hat_traeger, wird sonst nirgends verwendet. */
    const anonymousKey = randomUUID();
    const confirmToken = token();
    const unsubscribeToken = token();
    const ssRows = await tx`
      INSERT INTO saved_search (anonymous_key, query, label)
      VALUES (${anonymousKey}, ${sql.json(anfrage)}, ${label})
      RETURNING id`;
    const ss = ssRows[0]!;
    const saRows = await tx`
      INSERT INTO search_alert (saved_search_id, email, confirm_token, unsubscribe_token, frequency)
      VALUES (${ss.id}, ${traeger.email}, ${confirmToken}, ${unsubscribeToken}, ${FREQUENZ_ZU_DB[frequency]})
      RETURNING id`;
    const sa = saRows[0]!;

    const mailLocale = alsMailLocale(locale);
    const bestaetigenUrl = `${env().NEXT_PUBLIC_SITE_URL}/api/suchabo/bestaetigen?token=${confirmToken}&locale=${mailLocale}`;
    const { betreff, text } = mailtext("search_alert_confirm", mailLocale, { url: bestaetigenUrl, label: label ?? "" });
    await einreihen(tx, {
      an: traeger.email, betreff, text, locale: mailLocale, art: "search_alert_confirm",
      bezug: { art: "saved_search", kennung: String(ss.id) }
    });

    return { savedSearchId: String(ss.id), alertId: String(sa.id), erfordertBestaetigung: true };
  });
}

/* ---------- Bestätigen (Double-Opt-in, anonym) ---------- */
export async function bestaetigen(tokenWert: string): Promise<boolean> {
  const z = await sql`
    UPDATE search_alert SET confirmed_at = now(), confirm_token = NULL
     WHERE confirm_token = ${tokenWert} RETURNING id`;
  return z.length > 0;
}

/* ---------- Abmelden (Link in jeder Mail, anonym wie angemeldet) ---------- */
export async function abmelden(tokenWert: string): Promise<boolean> {
  const z = await sql`
    UPDATE search_alert SET is_paused = true
     WHERE unsubscribe_token = ${tokenWert} RETURNING id`;
  return z.length > 0;
}

/* ---------- Meine Suchen (nur angemeldet) ---------- */
export async function meineSuchen(userId: string): Promise<MeineSucheZeile[]> {
  const z = await sql`
    SELECT ss.id, ss.label, ss.query, ss.created_at,
           sa.id AS alert_id, sa.frequency, sa.is_paused, sa.confirmed_at, sa.last_sent_at
      FROM saved_search ss
      JOIN LATERAL (
        SELECT * FROM search_alert WHERE saved_search_id = ss.id ORDER BY created_at LIMIT 1
      ) sa ON true
     WHERE ss.user_id = ${userId}
     ORDER BY ss.created_at DESC`;
  return z.map(r => ({
    id: String(r.id),
    label: r.label != null ? String(r.label) : null,
    query: r.query,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    alert: {
      id: String(r.alert_id),
      frequency: DB_ZU_FREQUENZ[String(r.frequency)] ?? "daily",
      isPaused: Boolean(r.is_paused),
      confirmedAt: r.confirmed_at ? (r.confirmed_at instanceof Date ? r.confirmed_at.toISOString() : String(r.confirmed_at)) : null,
      lastSentAt: r.last_sent_at ? (r.last_sent_at instanceof Date ? r.last_sent_at.toISOString() : String(r.last_sent_at)) : null
    }
  }));
}

/* ---------- Eigentum ----------
   Fremde Referenz führt zu NOT_FOUND, nicht FORBIDDEN (§13/§65, dieselbe
   Regel wie server/entwuerfe.ts): wer nichts sehen darf, soll nicht erfahren,
   dass es existiert. */
async function eigentumPruefen(userId: string, savedSearchId: string): Promise<void> {
  const z = await sql`SELECT 1 FROM saved_search WHERE id = ${savedSearchId} AND user_id = ${userId} LIMIT 1`;
  if (!z.length) throw new AppError("NOT_FOUND", "Dieses Suchabo gibt es nicht");
}

export async function umbenennen(userId: string, savedSearchId: string, label: string | null): Promise<void> {
  await eigentumPruefen(userId, savedSearchId);
  await sql`UPDATE saved_search SET label = ${label} WHERE id = ${savedSearchId}`;
}

export async function frequenzAendern(userId: string, savedSearchId: string, frequency: Frequenz): Promise<void> {
  await eigentumPruefen(userId, savedSearchId);
  await sql`UPDATE search_alert SET frequency = ${FREQUENZ_ZU_DB[frequency]} WHERE saved_search_id = ${savedSearchId}`;
}

export async function pausierenUmschalten(userId: string, savedSearchId: string, isPaused: boolean): Promise<void> {
  await eigentumPruefen(userId, savedSearchId);
  await sql`UPDATE search_alert SET is_paused = ${isPaused} WHERE saved_search_id = ${savedSearchId}`;
}

export async function loeschen(userId: string, savedSearchId: string): Promise<void> {
  await eigentumPruefen(userId, savedSearchId);
  /* ON DELETE CASCADE räumt search_alert/search_alert_sent automatisch mit. */
  await sql`DELETE FROM saved_search WHERE id = ${savedSearchId}`;
}
