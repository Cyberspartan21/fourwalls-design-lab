import "server-only";
import { sql } from "./db";
import { env } from "./env";
import { einreihen } from "./outbox";
import { suche } from "./search";
import { SuchanfrageSchema } from "@/domain/suchurl";
import type { Suchanfrage } from "@/domain/marktplatz";
import { objektPfad } from "@/components/marktplatz/karte";
import { mailtext } from "@/lib/mailtext";
import { log } from "@/lib/log";
import { PFAD, type Locale } from "@/i18n";

/* Alarmprüfung der Suchabos (P5.6).

   Wichtigstes Kriterium: die Suche selbst läuft ausschliesslich über
   server/search.ts:suche() — dieselbe Funktion, die auch die interaktive
   Suche nutzt. Hier wird keine zweite Filterlogik gebaut, nur validiert
   (SuchanfrageSchema), ausgeführt und gegen bereits Verschicktes
   (search_alert_sent) abgeglichen.

   Performance-Hinweis (P5.6-Bericht §23): Bei wenigen hundert Inseraten und
   einer Handvoll Alarme ist ein Abfragedurchlauf je Tick ausreichend
   performant. Bei grösserem Bestand: Alarme nach dem letzten
   published_at-Zeitpunkt filtern, den ein Alarm schon gesehen hat, statt
   jedes Mal den ganzen Katalog zu durchsuchen, oder Kandidaten
   ereignisgetrieben aus der Veröffentlichung selbst ableiten
   (P5.5-Outbox-Muster) statt zu pollen. */

const MAX_TREFFER_IN_MAIL = 10;
const MAIL_LOCALES = ["de", "fr", "it", "en"] as const;
function alsLocale(l: unknown): Locale {
  return (MAIL_LOCALES as readonly string[]).includes(String(l)) ? (l as Locale) : "de";
}

function preisAnzeige(t: { transactionType: "buy" | "rent"; priceOnRequest: boolean; price: number | null; rentNet: number | null }): string {
  if (t.priceOnRequest) return "a. A.";
  const wert = t.transactionType === "rent" ? t.rentNet : t.price;
  return wert == null ? "a. A." : `CHF ${wert}.–`;
}

export async function alarmeVerarbeiten(): Promise<{ geprueft: number; versendet: number }> {
  let geprueft = 0, versendet = 0;

  /* search_alert.frequency ist der ENUM alert_frequency (db/migrations/0001)
     mit den Werten 'instant'|'daily'|'weekly'. Nach aussen (API, Domäne)
     heisst der erste Wert "immediately" — siehe FREQUENZ_ZU_DB in
     server/gespeicherteSuchen.ts. Hier wird ausschliesslich der DB-Wert
     'instant' verwendet. */
  const alarme = await sql`
    SELECT sa.id, sa.email, sa.unsubscribe_token,
           ss.query, ss.label, ss.user_id, u.locale AS user_locale
      FROM search_alert sa
      JOIN saved_search ss ON ss.id = sa.saved_search_id
      LEFT JOIN app_user u ON u.id = ss.user_id
     WHERE sa.confirmed_at IS NOT NULL AND NOT sa.is_paused
       AND (sa.last_run_at IS NULL
            OR sa.frequency = 'instant'
            OR (sa.frequency = 'daily' AND sa.last_run_at < now() - interval '24 hours')
            OR (sa.frequency = 'weekly' AND sa.last_run_at < now() - interval '7 days'))`;

  for (const row of alarme) {
    geprueft++;
    const alertId = String(row.id);
    try {
      const locale = alsLocale(row.user_locale);
      const anfrage = SuchanfrageSchema.parse(row.query) as Suchanfrage;
      const ergebnis = await suche({ ...anfrage, seite: 1, proSeite: 48 }, locale);
      const refs = ergebnis.treffer.map(t => t.id);

      const zeilen = refs.length ? await sql`SELECT id, public_ref FROM listing WHERE public_ref = ANY(${refs})` : [];
      const listingIds = zeilen.map(z => String(z.id));
      const schonVersandt = listingIds.length
        ? await sql`SELECT listing_id FROM search_alert_sent WHERE alert_id = ${alertId} AND listing_id = ANY(${listingIds}::uuid[])`
        : [];
      const versandteSet = new Set(schonVersandt.map(s => String(s.listing_id)));
      const neu = zeilen.filter(z => !versandteSet.has(String(z.id)));

      if (neu.length === 0) {
        await sql`UPDATE search_alert SET last_run_at = now() WHERE id = ${alertId}`;
        continue;
      }

      const idZuTreffer = new Map(ergebnis.treffer.map(t => [t.id, t]));
      const pfad = PFAD[locale];
      const site = env().NEXT_PUBLIC_SITE_URL;
      const zeilenText = neu.slice(0, MAX_TREFFER_IN_MAIL)
        .map(z => idZuTreffer.get(String(z.public_ref)))
        .filter((t): t is NonNullable<typeof t> => !!t)
        .map(t => `${t.title} — ${preisAnzeige(t)} — ${site}${objektPfad(locale, pfad, t)}`)
        .join("\n");

      const abmeldeUrl = `${site}/api/suchabo/abmelden?token=${row.unsubscribe_token}&locale=${locale}`;
      const { betreff, text } = mailtext("search_alert_match", locale, {
        label: row.label != null ? String(row.label) : "", anzahl: String(neu.length), treffer: zeilenText, abmeldeUrl
      });

      await sql.begin(async tx => {
        await einreihen(tx, {
          an: String(row.email), betreff, text, locale, art: "search_alert_match",
          bezug: { art: "search_alert", kennung: alertId }
        });
        for (const z of neu) {
          await tx`INSERT INTO search_alert_sent (alert_id, listing_id) VALUES (${alertId}, ${z.id}) ON CONFLICT DO NOTHING`;
        }
        await tx`UPDATE search_alert SET last_run_at = now(), last_sent_at = now() WHERE id = ${alertId}`;
      });
      versendet++;
    } catch (e) {
      /* Ein einzelner fehlerhafter Alarm wirft nie die ganze Schleife um. */
      log.error("suchabo.alarm.fehler", e, { alertId });
    }
  }

  return { geprueft, versendet };
}
