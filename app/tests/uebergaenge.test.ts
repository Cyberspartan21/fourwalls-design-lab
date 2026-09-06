import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

/* ============================================================
   FOURWALLS — Ungültige Übergänge an der Service-/DB-Grenze (P5.10 §19)

   Prüft, an welcher Grenze acht konkrete, in der Praxis versuchbare Übergänge
   wirklich verhindert werden: DB-Constraint (schlägt in JEDER Verbindung fehl,
   auch bei einem Fehler in der Anwendung), Service (nur die geprüfte
   Anwendungsfunktion verweigert, eine rohe SQL-Verbindung könnte es trotzdem)
   oder nur UI (nirgends erzwungen).

   Läuft direkt gegen DATABASE_URL (wie scripts/migrate.mjs, kein server/db.ts
   — server/db.ts importiert "server-only", was unter einer reinen node:test-
   Umgebung [ohne den bundlerspezifischen "react-server"-Exportpfad] sofort
   wirft; siehe node_modules/server-only/package.json). Jeder Test legt seine
   eigenen Wegwerfzeilen an (eindeutige UUID/Text je Lauf) und räumt sie in
   einem finally wieder weg — die Dev-Datenbank behält sonst nichts zurück.

   Was diese Datei NICHT prüfen kann: die tatsächliche Service-Funktion für
   Anliegen (server/anliegen.ts `statusSetzen`) und für Anfragen
   (server/inquiries.ts) lassen sich aus demselben Grund (server-only) nicht
   direkt importieren. Wo eine Servicegrenze behauptet wird, steht als Beleg
   die Fundstelle im Quelltext plus der bestehende Ende-zu-Ende-Test, der sie
   über HTTP abdeckt (scripts/anliegen-test.mjs, scripts/anliegen-reisen-test.mjs).

   Ohne DATABASE_URL wird die ganze Datei übersprungen, statt zu scheitern
   (Muster wie tests/storage-s3.test.ts): jeder Test prüft `url` selbst und
   ruft bei Fehlen `t.skip(...)`.

   Aufruf: npm test (braucht DATABASE_URL in der Umgebung, z. B. via
   `set -a; . ./.env.local; set +a` oder wie in CI als Job-Umgebungsvariable). */

const url = process.env.DATABASE_URL;
const sql = postgres(url ?? "postgres://ungenutzt/ungenutzt", { max: 2, onnotice: () => {} });

const LAUF = randomUUID();
let testUserId: string;
let testPropertyId: string;
let testOrgId: string;

before(async () => {
  if (!url) return;
  testUserId = randomUUID();
  await sql`INSERT INTO app_user (id, email, display_name, platform_role)
            VALUES (${testUserId}, ${`uebergaenge-test-${LAUF}@example.ch`}, 'Übergänge Testperson', 'user')`;

  testPropertyId = randomUUID();
  await sql`INSERT INTO property (id, kind, postal_code, city, canton, geo_precision, geo_radius_m)
            VALUES (${testPropertyId}, 'apartment', '8001', 'Zürich', 'ZH', 'approximate', 450)`;

  testOrgId = randomUUID();
  await sql`INSERT INTO organization (id, slug, kind, legal_name, display_name)
            VALUES (${testOrgId}, ${`uebergaenge-test-org-${LAUF}`}, 'agency',
                    'Übergänge Testfirma AG', 'Übergänge Testfirma')`;
  /* Bewusst OHNE org_membership — testOrgId dient auch als Organisation ohne
     jedes Mitglied, für den Zuweisungs-Test unten. */
});

after(async () => {
  if (url) {
    await sql`DELETE FROM organization WHERE id = ${testOrgId}`;
    await sql`DELETE FROM property WHERE id = ${testPropertyId}`;
    await sql`DELETE FROM app_user WHERE id = ${testUserId}`;
  }
  await sql.end();
});

/* Kürzt eine PostgreSQL-Fehlermeldung auf ihren SQLSTATE-Code, damit die Tests
   nicht an einem übersetzten Wortlaut hängen. */
function sqlstate(fehler: unknown): string | undefined {
  return (fehler as { code?: string } | undefined)?.code;
}

// ---------- 1. listing: draft → published ohne Moderation ----------

test("listing draft → published wird an der DB-Grenze verweigert (check_violation)", async (t) => {
  if (!url) { t.skip("DATABASE_URL nicht gesetzt — Integrationstest übersprungen"); return; }
  const id = randomUUID();
  try {
    await sql`INSERT INTO listing (id, property_id, transaction, publisher_kind, published_by_user_id, title, slug, price_chf)
              VALUES (${id}, ${testPropertyId}, 'sale', 'private_person', ${testUserId},
                      'Testinserat', ${`uebergaenge-test-${LAUF}-a`}, 1000000)`;
    await assert.rejects(
      sql`UPDATE listing SET status = 'published' WHERE id = ${id}`,
      (e) => sqlstate(e) === "23514"
    );
    const [zeile] = await sql`SELECT status FROM listing WHERE id = ${id}`;
    assert.equal(zeile?.status, "draft", "Status darf nach der verweigerten Änderung nicht published sein");
  } finally {
    await sql`DELETE FROM listing WHERE id = ${id}`;
  }
});

// ---------- 2. listing: published → draft ----------

test("listing published → draft wird an der DB-Grenze verweigert (check_violation)", async (t) => {
  if (!url) { t.skip("DATABASE_URL nicht gesetzt — Integrationstest übersprungen"); return; }
  const id = randomUUID();
  try {
    await sql`INSERT INTO listing (id, property_id, transaction, publisher_kind, published_by_user_id, title, slug, price_chf)
              VALUES (${id}, ${testPropertyId}, 'sale', 'private_person', ${testUserId},
                      'Testinserat', ${`uebergaenge-test-${LAUF}-b`}, 1000000)`;
    for (const status of ["submitted", "in_review", "approved", "published"]) {
      await sql`UPDATE listing SET status = ${status} WHERE id = ${id}`;
    }
    await assert.rejects(
      sql`UPDATE listing SET status = 'draft' WHERE id = ${id}`,
      (e) => sqlstate(e) === "23514"
    );
    const [zeile] = await sql`SELECT status FROM listing WHERE id = ${id}`;
    assert.equal(zeile?.status, "published");
  } finally {
    await sql`DELETE FROM listing WHERE id = ${id}`;
  }
});

// ---------- 3. listing: archived → published ----------

test("listing archived → published bleibt verhindert — Endstation (check_violation)", async (t) => {
  if (!url) { t.skip("DATABASE_URL nicht gesetzt — Integrationstest übersprungen"); return; }
  const id = randomUUID();
  try {
    await sql`INSERT INTO listing (id, property_id, transaction, publisher_kind, published_by_user_id, title, slug, price_chf)
              VALUES (${id}, ${testPropertyId}, 'sale', 'private_person', ${testUserId},
                      'Testinserat', ${`uebergaenge-test-${LAUF}-c`}, 1000000)`;
    for (const status of ["submitted", "in_review", "approved", "published", "archived"]) {
      await sql`UPDATE listing SET status = ${status} WHERE id = ${id}`;
    }
    await assert.rejects(
      sql`UPDATE listing SET status = 'published' WHERE id = ${id}`,
      (e) => sqlstate(e) === "23514"
    );
    const [zeile] = await sql`SELECT status FROM listing WHERE id = ${id}`;
    assert.equal(zeile?.status, "archived");
  } finally {
    await sql`DELETE FROM listing WHERE id = ${id}`;
  }
});

// ---------- 4. org_invitation: accepted + revoked gleichzeitig ----------

test("org_invitation accepted_at + revoked_at gleichzeitig wird von der DB abgelehnt (CHECK)", async (t) => {
  if (!url) { t.skip("DATABASE_URL nicht gesetzt — Integrationstest übersprungen"); return; }
  const id = randomUUID();
  await assert.rejects(
    sql`INSERT INTO org_invitation (id, organization_id, email, token_hash, expires_at, accepted_at, revoked_at)
        VALUES (${id}, ${testOrgId}, ${`uebergaenge-invite-${LAUF}@example.ch`},
                ${`uebergaenge-test-token-${LAUF}-a`}, now() + interval '7 days', now(), now())`,
    (e) => sqlstate(e) === "23514"
  );

  // Eine gültige Einladung (nur angenommen) darf danach nicht per UPDATE zusätzlich widerrufen werden.
  const id2 = randomUUID();
  try {
    await sql`INSERT INTO org_invitation (id, organization_id, email, token_hash, expires_at, accepted_at)
              VALUES (${id2}, ${testOrgId}, ${`uebergaenge-invite2-${LAUF}@example.ch`},
                      ${`uebergaenge-test-token-${LAUF}-b`}, now() + interval '7 days', now())`;
    await assert.rejects(
      sql`UPDATE org_invitation SET revoked_at = now() WHERE id = ${id2}`,
      (e) => sqlstate(e) === "23514"
    );
  } finally {
    await sql`DELETE FROM org_invitation WHERE id = ${id2}`;
  }
});

// ---------- 5. service_lead: new → closed direkt ----------

test("service_lead new → closed direkt: DB erlaubt es (Trigger seit 0022 folgt UEBERGAENGE, new→closed ist darin enthalten)", async (t) => {
  if (!url) { t.skip("DATABASE_URL nicht gesetzt — Integrationstest übersprungen"); return; }
  const id = randomUUID();
  try {
    await sql`INSERT INTO service_lead (id, service, contact_name, contact_email)
              VALUES (${id}, 'owner_consultation', 'Übergänge Testperson', ${`uebergaenge-lead-${LAUF}@example.ch`})`;
    const [vor] = await sql`SELECT status FROM service_lead WHERE id = ${id}`;
    assert.equal(vor?.status, "new");

    // Seit db/migrations/0022_db_garantien.sql bewacht service_lead_status_guard
    // jeden Wechsel — new → closed ist darin (wie in UEBERGAENGE) ausdrücklich
    // erlaubt, kein unbewachter Durchgriff mehr.
    await sql`UPDATE service_lead SET status = 'closed' WHERE id = ${id}`;
    const [nach] = await sql`SELECT status FROM service_lead WHERE id = ${id}`;
    assert.equal(nach?.status, "closed");

    /* Servicegrenze: server/anliegen.ts UEBERGAENGE.new enthält "closed" —
       new → closed direkt ist dort eine ABSICHTLICH erlaubte Abkürzung (z. B.
       offensichtlicher Spam), keine Lücke. Nicht direkt importierbar hier
       ("server-only", siehe Kopfkommentar) — belegt durch scripts/anliegen-test.mjs
       (Ende-zu-Ende über HTTP, Teil von app-ci.yml). */
  } finally {
    await sql`DELETE FROM service_lead WHERE id = ${id}`;
  }
});

// ---------- 6. listing.assigned_user_id auf ein Nicht-Mitglied ----------

test("listing.assigned_user_id auf Nicht-Mitglied wird an der DB-Grenze verweigert (check_violation, seit 0022)", async (t) => {
  if (!url) { t.skip("DATABASE_URL nicht gesetzt — Integrationstest übersprungen"); return; }
  const id = randomUUID();
  try {
    await sql`INSERT INTO listing (id, property_id, transaction, publisher_kind, published_by_org_id)
              VALUES (${id}, ${testPropertyId}, 'sale', 'agency', ${testOrgId})`;

    const mitgliedschaft = await sql`
      SELECT 1 FROM org_membership WHERE organization_id = ${testOrgId} AND user_id = ${testUserId}`;
    assert.equal(mitgliedschaft.length, 0, "Testperson darf zu Beginn kein Mitglied der Testorganisation sein");

    // Seit db/migrations/0022_db_garantien.sql prüft ein Trigger
    // (listing_zuweisung_guard) org_membership VOR dem UPDATE — auch eine rohe
    // SQL-Verbindung kann die Zuweisung an eine organisationsfremde Person
    // nicht mehr durchsetzen.
    await assert.rejects(
      sql`UPDATE listing SET assigned_user_id = ${testUserId} WHERE id = ${id}`,
      (e) => sqlstate(e) === "23514"
    );
    const [zeile] = await sql`SELECT assigned_user_id FROM listing WHERE id = ${id}`;
    assert.equal(zeile?.assigned_user_id, null);

    /* Servicegrenze (zusätzlich, nicht ersetzt): server/entwuerfe.ts
       `zuweisen()` prüft org_membership schon vor dem UPDATE und verweigert
       mit AppError("VALIDATION", …) — die DB-Garantie unten fängt zusätzlich
       jeden Weg ab, der diese Servicefunktion nicht durchläuft. */
  } finally {
    await sql`DELETE FROM listing WHERE id = ${id}`;
  }
});

// ---------- 7. inquiry auf ein Entwurf-Inserat ----------

test("inquiry auf ein Entwurf-Inserat wird an der DB-Grenze verweigert (check_violation, seit 0022)", async (t) => {
  if (!url) { t.skip("DATABASE_URL nicht gesetzt — Integrationstest übersprungen"); return; }
  const listingId = randomUUID();
  const inquiryId = randomUUID();
  try {
    await sql`INSERT INTO listing (id, property_id, transaction, publisher_kind, published_by_user_id)
              VALUES (${listingId}, ${testPropertyId}, 'sale', 'private_person', ${testUserId})`;
    const [vor] = await sql`SELECT status FROM listing WHERE id = ${listingId}`;
    assert.equal(vor?.status, "draft");

    // Seit db/migrations/0022_db_garantien.sql prüft ein Trigger
    // (inquiry_listing_status_guard) beim INSERT, dass ein gesetztes listing_id
    // auf ein veröffentlichtes oder reserviertes Inserat zeigt.
    await assert.rejects(
      sql`INSERT INTO inquiry (id, kind, listing_id, sender_name, sender_email, recipient_user_id, message)
          VALUES (${inquiryId}, 'listing_question', ${listingId}, 'Interessent Test',
                  ${`uebergaenge-interessent-${LAUF}@example.ch`}, ${testUserId}, 'Testanfrage')`,
      (e) => sqlstate(e) === "23514"
    );
    const zeile = await sql`SELECT id FROM inquiry WHERE id = ${inquiryId}`;
    assert.equal(zeile.length, 0, "Die abgelehnte Anfrage darf keine Zeile hinterlassen haben");

    /* Servicegrenze (zusätzlich, nicht ersetzt): server/inquiries.ts löst den
       Empfänger nur über `WHERE l.status IN ('published','reserved')` auf
       (Zeile ~52) — die tatsächliche Anfrage-Funktion der Anwendung kommt für
       ein Entwurf-Inserat gar nicht bis zum INSERT. Die DB-Garantie oben fängt
       zusätzlich jeden Weg ab, der diese Servicefunktion nicht durchläuft. */
  } finally {
    await sql`DELETE FROM inquiry WHERE id = ${inquiryId}`;
    await sql`DELETE FROM listing WHERE id = ${listingId}`;
  }
});

// ---------- 8. Duplikat external_ref innerhalb derselben Organisation ----------

test("Duplikat external_ref in derselben Organisation wird von der DB abgelehnt (unique_violation)", async (t) => {
  if (!url) { t.skip("DATABASE_URL nicht gesetzt — Integrationstest übersprungen"); return; }
  const idA = randomUUID();
  const idB = randomUUID();
  const externalRef = `uebergaenge-test-ext-${LAUF}`;
  try {
    await sql`INSERT INTO listing (id, property_id, transaction, publisher_kind, published_by_org_id, external_ref)
              VALUES (${idA}, ${testPropertyId}, 'sale', 'agency', ${testOrgId}, ${externalRef})`;
    await assert.rejects(
      sql`INSERT INTO listing (id, property_id, transaction, publisher_kind, published_by_org_id, external_ref)
          VALUES (${idB}, ${testPropertyId}, 'sale', 'agency', ${testOrgId}, ${externalRef})`,
      (e) => sqlstate(e) === "23505"
    );
    const vorhanden = await sql`SELECT id FROM listing WHERE id = ${idB}`;
    assert.equal(vorhanden.length, 0, "Der zweite Import darf keine Zeile hinterlassen haben");
  } finally {
    await sql`DELETE FROM listing WHERE id IN (${idA}, ${idB})`;
  }
});
