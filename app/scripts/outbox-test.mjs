#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Mail-Outbox-Prüfung (P5.5 §25–§33, §77)

   Prüft die Outbox unabhängig vom Next.js-Server, direkt gegen die
   Datenbank (mail_outbox) und den SMTP-Adapter (nodemailer, dieselbe
   Konfiguration wie services/mail-smtp.ts):

     1. Verbindung zur Mail-Attrappe (STARTTLS) steht.
     2. Eine Zeile wird eingereiht, «verarbeitet» (abgeholt, gesendet,
        als angenommen markiert) — und erscheint in Mailpit.
     3. Eine Zeile mit einem Versand, der scheitert, wird nicht geworfen,
        sondern als «failed» mit späterer Fälligkeit vermerkt.
     4. Beleg: Die Outbox-Zeile entsteht in derselben Transaktion wie eine
        fachliche Änderung; scheitert der (spätere, ausserhalb der
        Transaktion liegende) SMTP-Versand, bleibt die fachliche Zeile
        unberührt stehen.

   Aufruf:
     set -a; . ./.env.local; set +a
     MAIL_PROVIDER=smtp SMTP_HOST=localhost SMTP_PORT=58025 SMTP_TLS=starttls \
     SMTP_USER=fwdev SMTP_PASSWORD=fwdev-nur-lokal SMTP_VERIFY_CERT=nein \
     APP_ENV=development node scripts/outbox-test.mjs

   Die Datei ändert an der Anwendung nichts — sie meldet nur Befunde.
   ============================================================ */
import postgres from "postgres";
import nodemailer from "nodemailer";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a)"); process.exit(2); }

const SMTP_HOST = process.env.SMTP_HOST ?? "localhost";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 58025);
const SMTP_TLS = process.env.SMTP_TLS ?? "starttls";
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_VERIFY_CERT = process.env.SMTP_VERIFY_CERT ?? "nein";
if (!SMTP_USER || !SMTP_PASSWORD) { console.error("SMTP_USER/SMTP_PASSWORD fehlen"); process.exit(2); }

const MAILPIT_API = process.env.MAILPIT_API ?? "http://localhost:58026/api/v1/messages";
const TS = Date.now();

/* Eine Verbindung für den ganzen Lauf — Voraussetzung für die TEMP TABLE in
   Schritt 4 (session-gebunden), wie beim übrigen Skript. */
const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });

/* ---------- SMTP-Transporte — genau die Konfiguration aus services/mail-smtp.ts ---------- */
function transport({ host = SMTP_HOST, port = SMTP_PORT } = {}) {
  return nodemailer.createTransport({
    host, port,
    secure: SMTP_TLS === "tls",
    requireTLS: SMTP_TLS === "starttls",
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    tls: { rejectUnauthorized: SMTP_VERIFY_CERT === "ja", minVersion: "TLSv1.2" }
  });
}
const echterTransport = transport();
/* Ein Port, an dem nichts lauscht — erzwingt einen Verbindungsfehler für den
   Fehlerfall, falls Mailpit selbst nichts ablehnt. */
const kaputterTransport = transport({ host: "127.0.0.1", port: 58999 });

/* Dieselbe Bereinigung wie server/outbox.ts / lib/log.ts: keine Geheimnis-Wörter. */
const VERBOTEN = /secret|password|passwort|token|authorization|cookie|database_url/gi;
function fehlermeldung(err) {
  const roh = `${err?.name ?? "Error"}: ${err?.message ?? String(err)}`;
  return roh.replace(VERBOTEN, "[entfernt]").slice(0, 300);
}
const WARTEZEIT_MIN = [1, 5, 25];

/* Eine Zeile «verarbeiten» — dieselbe Logik wie server/outbox.ts:verarbeiten(),
   hier gegen einen frei wählbaren Transport, um den Fehlerfall zu erzwingen. */
async function verarbeiteZeile(id, mailTransport) {
  const [z] = await sql`SELECT id, recipient, subject, body_text, attempts FROM mail_outbox WHERE id = ${id}`;
  if (!z) throw new Error(`Outbox-Zeile ${id} nicht gefunden`);
  try {
    const info = await mailTransport.sendMail({ from: process.env.MAIL_FROM ?? "noreply@fourwalls.example", to: z.recipient, subject: z.subject, text: z.body_text });
    await sql`UPDATE mail_outbox SET status = 'accepted', provider_id = ${String(info.messageId)}, accepted_at = now() WHERE id = ${id}`;
    return { angenommen: true, kennung: String(info.messageId) };
  } catch (err) {
    const versuche = z.attempts + 1;
    const meldung = fehlermeldung(err);
    if (versuche >= 4) {
      await sql`UPDATE mail_outbox SET status = 'abandoned', attempts = ${versuche}, last_error = ${meldung} WHERE id = ${id}`;
    } else {
      const wartMin = WARTEZEIT_MIN[versuche - 1] ?? 25;
      await sql`UPDATE mail_outbox SET status = 'failed', attempts = ${versuche}, last_error = ${meldung},
                       next_attempt_at = now() + make_interval(mins => ${wartMin}) WHERE id = ${id}`;
    }
    return { angenommen: false, fehler: meldung };
  }
}

/* ---------- Ergebnistabelle (wie scripts/lieferkette-test.mjs) ---------- */
const ergebnisse = [];
function assertTrue(bedingung, meldung) { if (!bedingung) throw new Error(meldung); }
function assertGleich(ist, soll, feld) {
  if (ist !== soll) throw new Error(`${feld}: erwartet ${JSON.stringify(soll)}, erhalten ${JSON.stringify(ist)}`);
}
async function schritt(nr, titel, fn) {
  try {
    const detail = (await fn()) || "ok";
    ergebnisse.push({ nr, titel, status: "OK", detail });
    console.log(`OK      ${String(nr).padStart(2)}  ${titel}`);
  } catch (e) {
    const detail = e && e.message ? e.message : String(e);
    ergebnisse.push({ nr, titel, status: "FEHLER", detail });
    console.log(`FEHLER  ${String(nr).padStart(2)}  ${titel} — ${detail}`);
  }
}

const START = Date.now();
console.log(`Outbox-Prüfung startet gegen ${SMTP_HOST}:${SMTP_PORT} (TLS=${SMTP_TLS}) — TS=${TS}`);

let zeileErfolg, zeileFehler;

await schritt(1, "Verbindung zur Mail-Attrappe steht (STARTTLS, Anmeldung)", async () => {
  await echterTransport.verify();
  return `verify() OK (${SMTP_HOST}:${SMTP_PORT})`;
});

await schritt(2, "Zeile einreihen (an test@example.com)", async () => {
  const empfaenger = `test+${TS}@example.com`;
  const [z] = await sql`
    INSERT INTO mail_outbox (recipient, subject, body_text, locale, kind, ref_type, ref_id)
    VALUES (${empfaenger}, ${"Outbox-Prüfung " + TS}, ${"Prüftext " + TS}, 'de', 'inquiry', 'outbox-test', ${String(TS)})
    RETURNING id, status`;
  assertGleich(z.status, "created", "status nach dem Einreihen");
  zeileErfolg = { id: z.id, empfaenger };
  return `id=${z.id}, status=${z.status}`;
});

await schritt(3, "Verarbeiten: Zeile wird angenommen (status=accepted, provider_id gesetzt)", async () => {
  const ergebnis = await verarbeiteZeile(zeileErfolg.id, echterTransport);
  assertTrue(ergebnis.angenommen, `Versand nicht angenommen: ${ergebnis.fehler ?? "?"}`);
  const [z] = await sql`SELECT status, provider_id, accepted_at FROM mail_outbox WHERE id = ${zeileErfolg.id}`;
  assertGleich(z.status, "accepted", "status nach dem Verarbeiten");
  assertTrue(!!z.provider_id, "provider_id ist leer");
  assertTrue(z.accepted_at != null, "accepted_at ist NULL");
  return `status=${z.status}, provider_id=${z.provider_id}`;
});

await schritt(4, "Mailpit zeigt die Nachricht", async () => {
  const res = await fetch(MAILPIT_API + "?limit=50");
  assertGleich(res.status, 200, "Mailpit-API-Status");
  const daten = await res.json();
  const treffer = (daten.messages ?? []).find(m => (m.To ?? []).some(t => t.Address === zeileErfolg.empfaenger));
  assertTrue(!!treffer, `${zeileErfolg.empfaenger} nicht unter den Mailpit-Nachrichten gefunden`);
  return `gefunden: ID=${treffer.ID}, Subject=${treffer.Subject}`;
});

await schritt(5, "Fehlerfall einreihen und verarbeiten — kein Wurf, status=failed", async () => {
  const empfaenger = `fehlerfall+${TS}@example.com`;
  const [z] = await sql`
    INSERT INTO mail_outbox (recipient, subject, body_text, locale, kind, ref_type, ref_id)
    VALUES (${empfaenger}, ${"Fehlerfall " + TS}, ${"Prüftext " + TS}, 'de', 'inquiry', 'outbox-test', ${String(TS)})
    RETURNING id`;
  zeileFehler = { id: z.id, empfaenger };

  /* Erst versuchen, ob Mailpit selbst ablehnt (x@invalid); tut es das nicht,
     erzwingt der geschlossene Port 58999 den Fehler. */
  let ergebnis;
  try {
    await echterTransport.sendMail({ from: "noreply@fourwalls.example", to: "x@invalid", subject: "Prüfung", text: "Prüfung" });
    /* Mailpit hat auch das angenommen — für den Test also der kaputte Port. */
    ergebnis = await verarbeiteZeile(zeileFehler.id, kaputterTransport);
  } catch {
    /* Mailpit lehnte selbst ab — den Fehlerfall trotzdem über die Zeile abbilden. */
    ergebnis = await verarbeiteZeile(zeileFehler.id, kaputterTransport);
  }
  assertTrue(!ergebnis.angenommen, "Versand hätte scheitern müssen, wurde aber angenommen");

  const [z2] = await sql`SELECT status, attempts, next_attempt_at, last_error FROM mail_outbox WHERE id = ${zeileFehler.id}`;
  assertGleich(z2.status, "failed", "status nach dem Fehlversuch");
  assertGleich(Number(z2.attempts), 1, "attempts nach dem ersten Fehlversuch");
  assertTrue(new Date(z2.next_attempt_at).getTime() > Date.now(), "next_attempt_at liegt nicht in der Zukunft");
  assertTrue(!/passwort|password|secret|token/i.test(z2.last_error ?? ""), "last_error enthält ein verbotenes Wort");
  return `status=${z2.status}, attempts=${z2.attempts}, next_attempt_at=${new Date(z2.next_attempt_at).toISOString()}`;
});

await schritt(6, "Beleg: fachliche Zeile und Outbox-Zeile stehen nach der Transaktion, obwohl der (spätere) Versand scheitert", async () => {
  /* Stellvertreter für «die fachliche Änderung», ohne eine echte Fachtabelle
     zu berühren — session-gebundene TEMP TABLE (eine Verbindung, max: 1). */
  await sql`CREATE TEMP TABLE IF NOT EXISTS _outbox_test_fachlich (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), erstellt_am timestamptz NOT NULL DEFAULT now())`;

  const empfaenger = `beleg+${TS}@example.com`;
  const { fachId, outboxId } = await sql.begin(async tx => {
    const [fach] = await tx`INSERT INTO _outbox_test_fachlich DEFAULT VALUES RETURNING id`;
    const [outbox] = await tx`
      INSERT INTO mail_outbox (recipient, subject, body_text, locale, kind, ref_type, ref_id)
      VALUES (${empfaenger}, ${"Beleg " + TS}, ${"Prüftext " + TS}, 'de', 'inquiry', 'outbox-test', ${String(TS)})
      RETURNING id`;
    /* Kein SMTP-Versand hier — genau das ist der Punkt: die Nachricht wird
       nur eingereiht, versendet wird sie erst später, ausserhalb dieser
       Transaktion. */
    return { fachId: fach.id, outboxId: outbox.id };
  });
  /* Die Transaktion ist bereits committet. Jetzt — «später» — versucht der
     Arbeiter den Versand und scheitert am geschlossenen Port. */
  const ergebnis = await verarbeiteZeile(outboxId, kaputterTransport);
  assertTrue(!ergebnis.angenommen, "Der erzwungene Fehlversuch hätte scheitern müssen");

  const [fachZeile] = await sql`SELECT id FROM _outbox_test_fachlich WHERE id = ${fachId}`;
  const [outboxZeile] = await sql`SELECT status FROM mail_outbox WHERE id = ${outboxId}`;
  assertTrue(!!fachZeile, "die fachliche Zeile ist nach dem gescheiterten Versand verschwunden");
  assertGleich(outboxZeile.status, "failed", "outbox-status nach dem gescheiterten, späteren Versand");
  return `fachliche Zeile (${fachId}) steht unverändert; outbox-Zeile (${outboxId}) ist «failed» und wird wiederholt`;
});

/* ---------- Abschluss ---------- */
const dauerMs = Date.now() - START;

function tabelle() {
  const w1 = 4;
  const w2 = Math.max(20, ...ergebnisse.map(e => e.titel.length));
  const w3 = 6;
  const zeile = (a, b, c, d) => `${String(a).padStart(w1)}  ${String(b).padEnd(w2)}  ${String(c).padEnd(w3)}  ${d}`;
  console.log("\n" + zeile("Nr", "Schritt", "Status", "Detail"));
  console.log("-".repeat(w1 + w2 + w3 + 10));
  for (const e of ergebnisse) console.log(zeile(e.nr, e.titel, e.status, e.detail));
}
tabelle();

const fehlerAnzahl = ergebnisse.filter(e => e.status === "FEHLER").length;
console.log(`\n${ergebnisse.length} Schritte, ${fehlerAnzahl} FEHLER, ${ergebnisse.length - fehlerAnzahl} OK — Dauer ${(dauerMs / 1000).toFixed(1)}s`);

await sql.end();
process.exit(fehlerAnzahl > 0 ? 1 : 0);
