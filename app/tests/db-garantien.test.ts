import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

/* ============================================================
   FOURWALLS — Datenbankgarantien aus db/migrations/0022_db_garantien.sql
   (P5.10 §19-Nachtrag, H6-Befund)

   Drei Regeln, die seit 0022 nicht mehr nur die Anwendung, sondern die
   Datenbank selbst erzwingt:
     (a) listing.assigned_user_id nur aktives Mitglied der Herausgeber-Org
     (b) inquiry.listing_id nur auf ein veröffentlichtes/reserviertes Inserat
     (c) service_lead.status folgt den Übergängen aus server/anliegen.ts
         UEBERGAENGE (Trigger service_lead_status_guard)

   Läuft direkt gegen DATABASE_URL, wie tests/uebergaenge.test.ts (server-only
   verhindert den Import der echten Servicefunktionen aus einer reinen
   node:test-Umgebung). Ohne DATABASE_URL wird die ganze Datei übersprungen,
   statt zu scheitern — siehe tests/storage-s3.test.ts für dasselbe Muster.

   Jeder Test legt eigene Wegwerfzeilen an (eindeutige UUID/Text je Lauf) und
   räumt sie in einem finally wieder weg.

   Aufruf: npm test (braucht DATABASE_URL in der Umgebung, z. B. via
   `set -a; . ./.env.local; set +a`). */

const url = process.env.DATABASE_URL;

if (!url) {
  test("db-garantien: übersprungen (DATABASE_URL fehlt)", (t) => {
    t.skip("DATABASE_URL nicht gesetzt — Integrationstest übersprungen");
  });
} else {
  const sql = postgres(url, { max: 2, onnotice: () => {} });

  const LAUF = randomUUID();
  let testUserId: string;
  let mitgliedUserId: string;
  let testPropertyId: string;
  let testOrgId: string;

  function sqlstate(fehler: unknown): string | undefined {
    return (fehler as { code?: string } | undefined)?.code;
  }

  before(async () => {
    testUserId = randomUUID();
    await sql`INSERT INTO app_user (id, email, display_name, platform_role)
              VALUES (${testUserId}, ${`db-garantien-test-${LAUF}@example.ch`}, 'DB-Garantien Testperson', 'user')`;

    mitgliedUserId = randomUUID();
    await sql`INSERT INTO app_user (id, email, display_name, platform_role)
              VALUES (${mitgliedUserId}, ${`db-garantien-mitglied-${LAUF}@example.ch`}, 'DB-Garantien Mitglied', 'user')`;

    testPropertyId = randomUUID();
    await sql`INSERT INTO property (id, kind, postal_code, city, canton, geo_precision, geo_radius_m)
              VALUES (${testPropertyId}, 'apartment', '8001', 'Zürich', 'ZH', 'approximate', 450)`;

    testOrgId = randomUUID();
    await sql`INSERT INTO organization (id, slug, kind, legal_name, display_name)
              VALUES (${testOrgId}, ${`db-garantien-test-org-${LAUF}`}, 'agency',
                      'DB-Garantien Testfirma AG', 'DB-Garantien Testfirma')`;
    await sql`INSERT INTO org_membership (organization_id, user_id, role, is_active)
              VALUES (${testOrgId}, ${mitgliedUserId}, 'agent', true)`;
  });

  after(async () => {
    await sql`DELETE FROM organization WHERE id = ${testOrgId}`;
    await sql`DELETE FROM property WHERE id = ${testPropertyId}`;
    await sql`DELETE FROM app_user WHERE id IN (${testUserId}, ${mitgliedUserId})`;
    await sql.end();
  });

  // ---------- (a) listing.assigned_user_id ----------

  test("(a) assigned_user_id: Zuweisung an ein Nicht-Mitglied wird abgelehnt", async () => {
    const id = randomUUID();
    try {
      await sql`INSERT INTO listing (id, property_id, transaction, publisher_kind, published_by_org_id)
                VALUES (${id}, ${testPropertyId}, 'sale', 'agency', ${testOrgId})`;
      await assert.rejects(
        sql`UPDATE listing SET assigned_user_id = ${testUserId} WHERE id = ${id}`,
        (e) => sqlstate(e) === "23514"
      );
    } finally {
      await sql`DELETE FROM listing WHERE id = ${id}`;
    }
  });

  test("(a) assigned_user_id: Zuweisung an ein aktives Mitglied gelingt", async () => {
    const id = randomUUID();
    try {
      await sql`INSERT INTO listing (id, property_id, transaction, publisher_kind, published_by_org_id)
                VALUES (${id}, ${testPropertyId}, 'sale', 'agency', ${testOrgId})`;
      await sql`UPDATE listing SET assigned_user_id = ${mitgliedUserId} WHERE id = ${id}`;
      const [zeile] = await sql`SELECT assigned_user_id FROM listing WHERE id = ${id}`;
      assert.equal(zeile?.assigned_user_id, mitgliedUserId);
    } finally {
      await sql`DELETE FROM listing WHERE id = ${id}`;
    }
  });

  test("(a) assigned_user_id: NULL bleibt erlaubt (keine Zuweisung)", async () => {
    const id = randomUUID();
    try {
      await sql`INSERT INTO listing (id, property_id, transaction, publisher_kind, published_by_org_id, assigned_user_id)
                VALUES (${id}, ${testPropertyId}, 'sale', 'agency', ${testOrgId}, NULL)`;
      const [zeile] = await sql`SELECT assigned_user_id FROM listing WHERE id = ${id}`;
      assert.equal(zeile?.assigned_user_id, null);
    } finally {
      await sql`DELETE FROM listing WHERE id = ${id}`;
    }
  });

  test("(a) assigned_user_id: Mitgliedschaft wird deaktiviert — eine spätere Zuweisung an dieselbe Person schlägt fehl", async () => {
    const id = randomUUID();
    try {
      await sql`UPDATE org_membership SET is_active = false
                WHERE organization_id = ${testOrgId} AND user_id = ${mitgliedUserId}`;
      await sql`INSERT INTO listing (id, property_id, transaction, publisher_kind, published_by_org_id)
                VALUES (${id}, ${testPropertyId}, 'sale', 'agency', ${testOrgId})`;
      await assert.rejects(
        sql`UPDATE listing SET assigned_user_id = ${mitgliedUserId} WHERE id = ${id}`,
        (e) => sqlstate(e) === "23514"
      );
    } finally {
      await sql`DELETE FROM listing WHERE id = ${id}`;
      await sql`UPDATE org_membership SET is_active = true
                WHERE organization_id = ${testOrgId} AND user_id = ${mitgliedUserId}`;
    }
  });

  // ---------- (b) inquiry.listing_id ----------

  test("(b) inquiry: listing_id auf ein Entwurf-Inserat wird abgelehnt", async () => {
    const listingId = randomUUID();
    const inquiryId = randomUUID();
    try {
      await sql`INSERT INTO listing (id, property_id, transaction, publisher_kind, published_by_user_id)
                VALUES (${listingId}, ${testPropertyId}, 'sale', 'private_person', ${testUserId})`;
      await assert.rejects(
        sql`INSERT INTO inquiry (id, kind, listing_id, sender_name, sender_email, recipient_user_id, message)
            VALUES (${inquiryId}, 'listing_question', ${listingId}, 'Interessent Test',
                    ${`db-garantien-interessent-${LAUF}@example.ch`}, ${testUserId}, 'Testanfrage')`,
        (e) => sqlstate(e) === "23514"
      );
    } finally {
      await sql`DELETE FROM inquiry WHERE id = ${inquiryId}`;
      await sql`DELETE FROM listing WHERE id = ${listingId}`;
    }
  });

  test("(b) inquiry: listing_id auf ein veröffentlichtes Inserat gelingt", async () => {
    const listingId = randomUUID();
    const inquiryId = randomUUID();
    try {
      await sql`INSERT INTO listing (id, property_id, transaction, publisher_kind, published_by_user_id, title, slug, price_chf)
                VALUES (${listingId}, ${testPropertyId}, 'sale', 'private_person', ${testUserId},
                        'DB-Garantien Testinserat', ${`db-garantien-test-${LAUF}`}, 1000000)`;
      for (const status of ["submitted", "in_review", "approved", "published"]) {
        await sql`UPDATE listing SET status = ${status} WHERE id = ${listingId}`;
      }
      await sql`INSERT INTO inquiry (id, kind, listing_id, sender_name, sender_email, recipient_user_id, message)
                VALUES (${inquiryId}, 'listing_question', ${listingId}, 'Interessent Test',
                        ${`db-garantien-interessent2-${LAUF}@example.ch`}, ${testUserId}, 'Testanfrage')`;
      const [zeile] = await sql`SELECT listing_id FROM inquiry WHERE id = ${inquiryId}`;
      assert.equal(zeile?.listing_id, listingId);
    } finally {
      await sql`DELETE FROM inquiry WHERE id = ${inquiryId}`;
      await sql`DELETE FROM listing WHERE id = ${listingId}`;
    }
  });

  test("(b) inquiry: listing_id IS NULL (Anfrage ohne Objektbezug) bleibt erlaubt", async () => {
    const inquiryId = randomUUID();
    try {
      await sql`INSERT INTO inquiry (id, kind, listing_id, sender_name, sender_email, recipient_user_id, message)
                VALUES (${inquiryId}, 'general', NULL, 'Interessent Test',
                        ${`db-garantien-allgemein-${LAUF}@example.ch`}, ${testUserId}, 'Allgemeine Anfrage')`;
      const [zeile] = await sql`SELECT listing_id FROM inquiry WHERE id = ${inquiryId}`;
      assert.equal(zeile?.listing_id, null);
    } finally {
      await sql`DELETE FROM inquiry WHERE id = ${inquiryId}`;
    }
  });

  // ---------- (c) service_lead.status ----------

  test("(c) service_lead: new → qualified direkt (ohne contacted) wird abgelehnt", async () => {
    const id = randomUUID();
    try {
      await sql`INSERT INTO service_lead (id, service, contact_name, contact_email)
                VALUES (${id}, 'sell', 'DB-Garantien Testperson', ${`db-garantien-lead1-${LAUF}@example.ch`})`;
      await assert.rejects(
        sql`UPDATE service_lead SET status = 'qualified' WHERE id = ${id}`,
        (e) => sqlstate(e) === "23514"
      );
    } finally {
      await sql`DELETE FROM service_lead WHERE id = ${id}`;
    }
  });

  test("(c) service_lead: regulärer Weg new → contacted → qualified → closed gelingt", async () => {
    const id = randomUUID();
    try {
      await sql`INSERT INTO service_lead (id, service, contact_name, contact_email)
                VALUES (${id}, 'sell', 'DB-Garantien Testperson', ${`db-garantien-lead2-${LAUF}@example.ch`})`;
      for (const status of ["contacted", "qualified", "closed"]) {
        await sql`UPDATE service_lead SET status = ${status} WHERE id = ${id}`;
      }
      const [zeile] = await sql`SELECT status FROM service_lead WHERE id = ${id}`;
      assert.equal(zeile?.status, "closed");
    } finally {
      await sql`DELETE FROM service_lead WHERE id = ${id}`;
    }
  });

  test("(c) service_lead: closed ist Endstation, auch für die Anwendung", async () => {
    const id = randomUUID();
    try {
      await sql`INSERT INTO service_lead (id, service, contact_name, contact_email)
                VALUES (${id}, 'sell', 'DB-Garantien Testperson', ${`db-garantien-lead3-${LAUF}@example.ch`})`;
      await sql`UPDATE service_lead SET status = 'closed' WHERE id = ${id}`;
      await assert.rejects(
        sql`UPDATE service_lead SET status = 'new' WHERE id = ${id}`,
        (e) => sqlstate(e) === "23514"
      );
    } finally {
      await sql`DELETE FROM service_lead WHERE id = ${id}`;
    }
  });

  test("(c) service_lead: declined ist Endstation", async () => {
    const id = randomUUID();
    try {
      await sql`INSERT INTO service_lead (id, service, contact_name, contact_email)
                VALUES (${id}, 'sell', 'DB-Garantien Testperson', ${`db-garantien-lead4-${LAUF}@example.ch`})`;
      await sql`UPDATE service_lead SET status = 'declined' WHERE id = ${id}`;
      await assert.rejects(
        sql`UPDATE service_lead SET status = 'contacted' WHERE id = ${id}`,
        (e) => sqlstate(e) === "23514"
      );
    } finally {
      await sql`DELETE FROM service_lead WHERE id = ${id}`;
    }
  });
}
