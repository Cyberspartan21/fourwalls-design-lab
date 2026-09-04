import "server-only";
import { sql } from "./db";
import { mail } from "@/services/mail";
import type { Nachricht } from "@/services/mail";
import { log } from "@/lib/log";

/* Die Mail-Outbox (P5.5 §25–§33, §77).

   Jede Nachricht wird zuerst — in derselben Datenbanktransaktion wie die
   fachliche Änderung — als Zeile in `mail_outbox` angelegt (`einreihen`).
   Ein Arbeiter im Serverprozess (`verarbeiten`, aufgerufen aus
   instrumentation.ts) holt fällige Zeilen ab und übergibt sie dem
   Mailanbieter. Scheitert der Versand, bleibt die fachliche Änderung
   unberührt — nur die Outbox-Zeile trägt den Fehler und wird wiederholt. */

type Tx = typeof sql;

/* In eine laufende Transaktion einreihen — die übliche Form: die fachliche
   Änderung und die Nachricht stehen und fallen zusammen. */
export async function einreihen(tx: Tx, n: Nachricht): Promise<void> {
  await tx`
    INSERT INTO mail_outbox (recipient, subject, body_text, locale, kind, ref_type, ref_id)
    VALUES (${n.an}, ${n.betreff}, ${n.text}, ${n.locale}, ${n.art}, ${n.bezug?.art ?? null}, ${n.bezug?.kennung ?? null})`;
}

/* Für Stellen ohne eigene Transaktion (z. B. die Better-Auth-Hooks). */
export async function einreihenOhneTx(n: Nachricht): Promise<void> {
  await einreihen(sql, n);
}

/* ---------- Wiederholung ---------- */
/* Wartezeit nach dem 1., 2., 3. Fehlversuch. Ab dem 4. gescheiterten Versuch
   wird aufgegeben. */
const WARTEZEIT_MIN = [1, 5, 25] as const;

/* Fehlermeldung fürs Protokoll und `last_error`: kurz, ohne Geheimnisse.
   Dieselbe Bereinigung wie lib/log.ts — Geheimnis-Wörter werden entfernt. */
const VERBOTEN = /secret|password|passwort|token|authorization|cookie|database_url/gi;
function fehlermeldung(err: unknown): string {
  const e = err instanceof Error ? err : new Error(String(err));
  const roh = `${e.name}: ${e.message}`;
  return roh.replace(VERBOTEN, "[entfernt]").slice(0, 300);
}

/* Fällige Zeilen abholen und versenden. `FOR UPDATE SKIP LOCKED` erlaubt es,
   diese Funktion mehrfach gleichzeitig laufen zu lassen, ohne dass zwei
   Arbeiter dieselbe Nachricht doppelt verschicken. */
export async function verarbeiten(max = 20): Promise<{ angenommen: number; fehlgeschlagen: number; aufgegeben: number }> {
  let angenommen = 0, fehlgeschlagen = 0, aufgegeben = 0;

  await sql.begin(async tx => {
    const zeilen = await tx`
      SELECT id, recipient, subject, body_text, locale, kind, ref_type, ref_id, attempts
        FROM mail_outbox
       WHERE status IN ('created', 'failed') AND next_attempt_at <= now()
       ORDER BY created_at
       LIMIT ${max}
       FOR UPDATE SKIP LOCKED`;

    for (const r of zeilen) {
      const id = String(r.id);
      const recipient = String(r.recipient);
      const kind = r.kind as Nachricht["art"];
      const attempts = Number(r.attempts);
      const refType = r.ref_type != null ? String(r.ref_type) : null;
      const refId = r.ref_id != null ? String(r.ref_id) : null;
      const anDomain = recipient.split("@")[1] ?? "?";
      const n: Nachricht = {
        an: recipient, betreff: String(r.subject), text: String(r.body_text),
        locale: r.locale as Nachricht["locale"], art: kind,
        ...(refType != null || refId != null ? { bezug: { art: refType ?? "", kennung: refId ?? "" } } : {})
      };
      try {
        const ergebnis = await mail().senden(n);
        await tx`UPDATE mail_outbox SET status = 'accepted', provider_id = ${ergebnis.kennung}, accepted_at = now() WHERE id = ${id}`;
        log.info("outbox.angenommen", { id, art: kind, anDomain });
        angenommen++;
      } catch (err) {
        const versuche = attempts + 1;
        const meldung = fehlermeldung(err);
        if (versuche >= 4) {
          await tx`UPDATE mail_outbox SET status = 'abandoned', attempts = ${versuche}, last_error = ${meldung} WHERE id = ${id}`;
          log.warn("outbox.aufgegeben", { id, art: kind, anDomain, versuche });
          aufgegeben++;
        } else {
          const wartMin = WARTEZEIT_MIN[versuche - 1] ?? 25;
          await tx`UPDATE mail_outbox SET status = 'failed', attempts = ${versuche}, last_error = ${meldung},
                          next_attempt_at = now() + make_interval(mins => ${wartMin}) WHERE id = ${id}`;
          log.warn("outbox.fehlgeschlagen", { id, art: kind, anDomain, versuche });
          fehlgeschlagen++;
        }
      }
    }
  });

  return { angenommen, fehlgeschlagen, aufgegeben };
}

/* Zählung je Status — für den Bericht und die Gesundheitsprüfung. */
export async function zustand(): Promise<Record<string, number>> {
  const z = await sql`SELECT status, count(*)::int AS n FROM mail_outbox GROUP BY status`;
  const aus: Record<string, number> = {};
  for (const r of z) aus[String(r.status)] = Number(r.n);
  return aus;
}
