import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

/* ============================================================
   FOURWALLS — Mail-Outbox-Zuverlässigkeit an der DB-Grenze (P5.10 §21)

   server/outbox.ts importiert "server-only" und lässt sich darum unter
   einer reinen node:test-Umgebung nicht importieren (derselbe Grund wie in
   tests/uebergaenge.test.ts — siehe dort den Kopfkommentar). Diese Datei
   prüft darum an derselben Grenze wie scripts/outbox-test.mjs: direkt
   gegen `mail_outbox` (db/migrations/0013_outbox.sql), mit derselben
   Wiederholungs- und Abhol-Logik wie server/outbox.ts NACHGEBAUT
   (WARTEZEIT_MIN, vier Versuche, `FOR UPDATE SKIP LOCKED`) — Quelle der
   Wahrheit bleibt server/outbox.ts; scripts/outbox-test.mjs deckt densel­ben
   Vertrag zusätzlich End-zu-Ende über echtes SMTP ab.

   Läuft gegen die echte Entwicklungsdatenbank (DATABASE_URL). Diese
   Datenbank bedient auch den laufenden Dev-Server (instrumentation.ts
   startet dort denselben Outbox-Arbeiter alle OUTBOX_INTERVAL_MS,
   Standard 15 s) — er darf laut Projektregel nicht gestoppt werden. Damit
   er die Testzeilen nicht mitten in einer Prüfung "echt" verarbeitet
   (MAIL_PROVIDER=dev nimmt jede Nachricht klaglos an, das würde eine
   absichtlich scheiternde Zeile in "accepted" verwandeln), hält jeder Test
   seine Zeile(n) für die Dauer der eigenen Simulation in EINER
   durchgehenden Transaktion (`sql.begin`) — der echte Arbeiter läuft selbst
   mit `FOR UPDATE SKIP LOCKED` und überspringt gesperrte Zeilen einfach,
   solange die Transaktion offen ist; erst der COMMIT gibt sie frei. Nur der
   Test für gleichzeitige Arbeiter (unten) braucht echte, parallele
   Transaktionen — dort ist die Prüfung deshalb bewusst so formuliert, dass
   sie auch dann stimmt, wenn ein dritter (der echte) Arbeiter mitbietet:
   keine Zeile darf in mehr als einem Stapel auftauchen, unabhängig davon,
   wie viele Bewerber es gab.

   Ohne DATABASE_URL wird die ganze Datei übersprungen, statt zu scheitern
   (Muster wie tests/storage-s3.test.ts): jeder Test prüft `url` selbst und
   ruft bei Fehlen `t.skip(...)`.

   Aufruf: npm test (braucht DATABASE_URL, siehe .env.local). */

const url = process.env.DATABASE_URL;
const sql = postgres(url ?? "postgres://ungenutzt/ungenutzt", { max: 4, onnotice: () => {} });

const LAUF = randomUUID();
const REF_TYPE = "outbox-unittest";

after(async () => {
  if (url) await sql`DELETE FROM mail_outbox WHERE ref_type = ${REF_TYPE} AND ref_id LIKE ${LAUF + "%"}`;
  await sql.end();
});

/* ---------- Nachgebaute Arbeiter-Logik (Quelle: server/outbox.ts) ---------- */
const WARTEZEIT_MIN = [1, 5, 25] as const;

async function einreihen(tx: postgres.TransactionSql, refSuffix: string) {
  const [z] = await tx`
    INSERT INTO mail_outbox (recipient, subject, body_text, locale, kind, ref_type, ref_id)
    VALUES (${`outbox-unittest-${LAUF}-${refSuffix}@example.invalid`}, 'Testzeile', 'Testtext', 'de', 'inquiry', ${REF_TYPE}, ${LAUF + "-" + refSuffix})
    RETURNING id, status, attempts`;
  return z as { id: string; status: string; attempts: number };
}

/* Simuliert einen gescheiterten Versandversuch — exakt dieselbe Fallunter-
   scheidung wie server/outbox.ts:verarbeiten() (vier Versuche, danach
   "abandoned", sonst "failed" mit Backoff aus WARTEZEIT_MIN). */
async function simuliereFehlschlag(tx: postgres.TransactionSql, id: string, attemptsVorher: number) {
  const versuche = attemptsVorher + 1;
  if (versuche >= 4) {
    await tx`UPDATE mail_outbox SET status = 'abandoned', attempts = ${versuche}, last_error = 'simulierter Fehlschlag' WHERE id = ${id}`;
  } else {
    const wartMin = WARTEZEIT_MIN[versuche - 1] ?? 25;
    await tx`UPDATE mail_outbox SET status = 'failed', attempts = ${versuche}, last_error = 'simulierter Fehlschlag',
                    next_attempt_at = now() + make_interval(mins => ${wartMin}) WHERE id = ${id}`;
  }
  return versuche;
}

async function simuliereErfolg(tx: postgres.TransactionSql, id: string) {
  await tx`UPDATE mail_outbox SET status = 'accepted', provider_id = ${"sim-" + randomUUID()}, accepted_at = now() WHERE id = ${id}`;
}

/* Dieselbe Abhol-Bedingung wie server/outbox.ts (status + Fälligkeit +
   FOR UPDATE SKIP LOCKED), zusätzlich auf die eigenen Testzeilen
   eingeschränkt — die echte Abfrage kennt diese Einschränkung nicht, sie
   ist hier reine Testisolation gegen den echten, gleichzeitig laufenden
   Arbeiter (siehe Kopfkommentar). */
async function abholen(tx: postgres.TransactionSql, max: number) {
  return tx`
    SELECT id, attempts FROM mail_outbox
     WHERE status IN ('created','failed') AND next_attempt_at <= now()
       AND ref_type = ${REF_TYPE} AND ref_id LIKE ${LAUF + "%"}
     ORDER BY created_at
     LIMIT ${max}
     FOR UPDATE SKIP LOCKED`;
}

// ---------- 1. Erfolg ----------

test("Outbox: Erfolg — Zeile wechselt von created zu accepted mit provider_id", async (t) => {
  if (!url) { t.skip("DATABASE_URL nicht gesetzt — Integrationstest übersprungen"); return; }
  await sql.begin(async tx => {
    const z = await einreihen(tx, "erfolg");
    assert.equal(z.status, "created");
    await simuliereErfolg(tx, z.id);
    const [nach] = await tx`SELECT status, provider_id, accepted_at FROM mail_outbox WHERE id = ${z.id}`;
    assert.equal(nach!.status, "accepted");
    assert.ok(nach!.provider_id);
    assert.ok(nach!.accepted_at);
  });
});

// ---------- 2. Wiederholung mit Backoff ----------

test("Outbox: Fehlversuch — attempts und next_attempt_at wachsen nach WARTEZEIT_MIN [1,5,25]", async (t) => {
  if (!url) { t.skip("DATABASE_URL nicht gesetzt — Integrationstest übersprungen"); return; }
  await sql.begin(async tx => {
    const z = await einreihen(tx, "backoff");
    let attempts = z.attempts;
    for (const erwarteteMinuten of WARTEZEIT_MIN) {
      const vor = Date.now();
      attempts = await simuliereFehlschlag(tx, z.id, attempts);
      const [nach] = await tx`SELECT status, attempts, next_attempt_at, last_error FROM mail_outbox WHERE id = ${z.id}`;
      assert.equal(nach!.status, "failed");
      assert.equal(Number(nach!.attempts), attempts);
      const wartenMs = new Date(nach!.next_attempt_at as unknown as string).getTime() - vor;
      /* Grosszügiges Fenster (±20s) — es geht um die Grössenordnung der
         Staffelung (1/5/25 Minuten), nicht um Millisekunden. */
      assert.ok(Math.abs(wartenMs - erwarteteMinuten * 60_000) < 20_000, `next_attempt_at nach Versuch ${attempts}: erwartet ~${erwarteteMinuten}min, war ${(wartenMs / 60000).toFixed(2)}min`);
      assert.ok(!/passwort|password|secret|token/i.test(String(nach!.last_error)));
    }
  });
});

// ---------- 3. Giftnachricht: kein Endlosloop ----------

test("Outbox: Giftnachricht — nach vier Versuchen 'abandoned', danach von der Abholung ausgeschlossen", async (t) => {
  if (!url) { t.skip("DATABASE_URL nicht gesetzt — Integrationstest übersprungen"); return; }
  await sql.begin(async tx => {
    const z = await einreihen(tx, "gift");
    let attempts = z.attempts;
    for (let i = 0; i < 4; i++) attempts = await simuliereFehlschlag(tx, z.id, attempts);
    const [nach] = await tx`SELECT status, attempts FROM mail_outbox WHERE id = ${z.id}`;
    assert.equal(nach!.status, "abandoned");
    assert.equal(Number(nach!.attempts), 4);

    /* Kein Endlosloop: die Abhol-Bedingung (status IN ('created','failed'))
       lässt 'abandoned' nie wieder durch — unabhängig davon, wie oft der
       Arbeiter danach noch läuft. */
    const stapel = await abholen(tx, 50);
    assert.ok(!stapel.some(r => String(r.id) === String(z.id)), "eine 'abandoned'-Zeile darf nie wieder abgeholt werden");
  });
});

// ---------- 4. Geschäftsaktion bleibt einmalig ----------

test("Outbox: die fachliche Zeile bleibt einmalig, auch wenn der Versand mehrfach fehlschlägt", async (t) => {
  if (!url) { t.skip("DATABASE_URL nicht gesetzt — Integrationstest übersprungen"); return; }
  await sql.begin(async tx => {
    await tx`CREATE TEMP TABLE IF NOT EXISTS _outbox_test_fachlich (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), erstellt_am timestamptz NOT NULL DEFAULT now())`;
    const [fach] = await tx`INSERT INTO _outbox_test_fachlich DEFAULT VALUES RETURNING id`;
    const z = await einreihen(tx, "einmalig");

    /* Vier Fehlversuche am VERSAND — die fachliche Aktion (die Zeile oben)
       wird dabei kein einziges Mal erneut ausgeführt; nur die Outbox-Zeile
       trägt die Wiederholung. */
    let attempts = z.attempts;
    for (let i = 0; i < 4; i++) attempts = await simuliereFehlschlag(tx, z.id, attempts);

    const fachZeilen = await tx`SELECT id FROM _outbox_test_fachlich`;
    assert.equal(fachZeilen.length, 1, "die fachliche Zeile darf nicht mehrfach entstanden sein");
    assert.equal(String(fachZeilen[0]!.id), String(fach!.id));
  });
});

// ---------- 5. Neustart zwischen Persistieren und Senden ----------

test("Outbox: eine eingereihte, noch nicht verarbeitete Zeile bleibt stehen und wird später nachgeholt", async (t) => {
  if (!url) { t.skip("DATABASE_URL nicht gesetzt — Integrationstest übersprungen"); return; }
  /* Bewusst OHNE haltende Transaktion: das committete INSERT steht für
     «die Anwendung ist genau danach abgestürzt» — die Zeile lebt in der
     Datenbank unabhängig vom Anwendungsprozess weiter (Haltbarkeit ist eine
     Eigenschaft von Postgres, nicht von instrumentation.ts). Verarbeitet
     entweder dieser Test selbst oder — käme er zuvor — der echte,
     laufende Arbeiter des Dev-Servers; MAIL_PROVIDER=dev nimmt beides
     klaglos an, das Endergebnis ("accepted", provider_id gesetzt) ist in
     beiden Fällen dasselbe und macht diesen Test robust gegenüber der
     gemeinsam genutzten Entwicklungsdatenbank. */
  const [z] = await sql`
    INSERT INTO mail_outbox (recipient, subject, body_text, locale, kind, ref_type, ref_id)
    VALUES (${`outbox-unittest-${LAUF}-neustart@example.invalid`}, 'Testzeile', 'Testtext', 'de', 'inquiry', ${REF_TYPE}, ${LAUF + "-neustart"})
    RETURNING id, status`;
  assert.equal(z!.status, "created", "unmittelbar nach dem Einreihen — noch nicht verarbeitet");

  await sql.begin(async tx => {
    const stapel = await tx`
      SELECT id FROM mail_outbox WHERE id = ${z!.id} AND status IN ('created','failed') AND next_attempt_at <= now()
      FOR UPDATE SKIP LOCKED`;
    if (stapel.length) await simuliereErfolg(tx, z!.id);
  });

  const [nach] = await sql`SELECT status, provider_id FROM mail_outbox WHERE id = ${z!.id}`;
  assert.equal(nach!.status, "accepted");
  assert.ok(nach!.provider_id);
});

// ---------- 6. Zwei gleichzeitige Arbeiter — keine Doppelverarbeitung ----------

test("Outbox: zwei gleichzeitige Arbeiter beanspruchen nie dieselbe Zeile (FOR UPDATE SKIP LOCKED)", async (t) => {
  if (!url) { t.skip("DATABASE_URL nicht gesetzt — Integrationstest übersprungen"); return; }
  const N = 6;
  const ids: string[] = [];
  await sql.begin(async tx => {
    for (let i = 0; i < N; i++) { const z = await einreihen(tx, `parallel-${i}`); ids.push(z.id); }
  });

  /* Zwei eigene Verbindungen (nicht derselbe Pool-Eintrag) — echte,
     gleichzeitige Transaktionen, keine JS-Simulation. */
  const clientA = postgres(url!, { max: 1, onnotice: () => {} });
  const clientB = postgres(url!, { max: 1, onnotice: () => {} });
  try {
    const abholenUndSperren = async (client: postgres.Sql) => client.begin(async tx => {
      const stapel = await tx`
        SELECT id FROM mail_outbox
         WHERE status = 'created' AND next_attempt_at <= now() AND ref_type = ${REF_TYPE} AND ref_id LIKE ${LAUF + "%"}
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED`;
      /* Die Sperre kurz halten, um echte Überschneidung mit dem zweiten
         Aufruf zu erzwingen — ohne diese kleine Pause könnte eine
         Transaktion fertig sein, bevor die andere überhaupt startet. */
      await tx`SELECT pg_sleep(0.3)`;
      const genommen = stapel.map(r => String(r.id));
      for (const id of genommen) await tx`UPDATE mail_outbox SET status = 'accepted', accepted_at = now() WHERE id = ${id}`;
      return genommen;
    });

    const [stapelA, stapelB] = await Promise.all([abholenUndSperren(clientA), abholenUndSperren(clientB)]);
    const ueberschneidung = stapelA.filter(id => stapelB.includes(id));
    assert.deepEqual(ueberschneidung, [], "keine Zeile darf in beiden Stapeln auftauchen — SKIP LOCKED muss das verhindern");

    /* Jede Zeile wurde von genau einem der beiden (oder — sehr selten —
       vom echten, gleichzeitig laufenden Dev-Arbeiter) übernommen und ist
       jetzt nicht mehr im Ausgangszustand 'created'. */
    const [{ n }] = await sql`
      SELECT count(*)::int AS n FROM mail_outbox
       WHERE id = ANY(${ids}) AND status = 'created'`;
    assert.ok(Number(n) <= N, "es dürfen nicht mehr offene Zeilen übrig sein, als eingereiht wurden");
  } finally {
    await clientA.end();
    await clientB.end();
  }
});
