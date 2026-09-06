#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Skalentest der Organisations-Übersicht (P5.7 §48/§49)

   Legt EINE Wegwerf-Organisation `fw-skalentest-<ts>` mit N Inseraten an
   (nur property + listing, gemischter Status, keine Bilder, is_demo=false)
   und misst per EXPLAIN (ANALYZE, BUFFERS) die fünf Abfragen der
   Herausgeber-Übersicht:

     (a) Seite 1, sortiert nach updated_at
     (b) Filter status = 'published'
     (c) Filter assigned_user_id
     (d) Volltext ILIKE auf den Titel
     (e) Posteingang: inquiry WHERE recipient_org_id (200 Anfragen)

   Prüft je Fall bei N=5000: Dauer < 150 ms UND (bei a/b/c) Verwendung des
   Index `listing_org_uebersicht` bzw. `listing_org_zuweisung`. Verstösse
   werden als Befund protokolliert (wie scripts/skalen-test.mjs), das Skript
   bricht deshalb nicht ab — die Zahlen entscheiden.

   Räumt am Ende NUR diese eine Organisation und ihre Zeilen weg, in der
   Reihenfolge, die die Fremdschlüssel verlangen (listing.published_by_org_id
   hat KEIN ON DELETE CASCADE): inquiry → listing → property →
   org_membership → organization. Wegwerf-Personen (app_user) werden
   ebenfalls entfernt.

   Aufruf:
     set -a; . ./.env.local; set +a
     node scripts/skalen-org-test.mjs             Stufen 10, 100, 1000, 5000
     node scripts/skalen-org-test.mjs 100 5000     nur diese Stufen
   Umgebung: DATABASE_URL (verweigert in production)
   ============================================================ */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a)"); process.exit(2); }
const appEnv = process.env.APP_ENV ?? "development";
if (appEnv === "production") { console.error("Skalentest in Produktion verweigert"); process.exit(2); }

const sql = postgres(url, { max: 1, onnotice: () => {} });

const STUFEN_ARG = process.argv.slice(2).map(Number).filter(n => Number.isFinite(n) && n > 0);
const STUFEN = STUFEN_ARG.length ? STUFEN_ARG : [10, 100, 1000, 5000];
const ZIEL_MS = 150;
const ZIEL_N = 5000;
const RELEVANTE_INDIZES = ["listing_org_uebersicht", "listing_org_zuweisung", "listing_status_idx", "listing_publisher_org", "inquiry_org_eingang", "listing_slug_uniq"];

// ---------- Hilfsfunktionen (wie scripts/skalen-test.mjs) ----------
function parseExecutionTime(planText) {
  const m = planText.match(/Execution Time:\s*([\d.]+)\s*ms/);
  return m ? parseFloat(m[1]) : null;
}
function parseTopNode(planText) {
  const ersteZeile = planText.split("\n")[0] ?? "";
  const m = ersteZeile.match(/^\s*->?\s*([A-Za-z0-9 ]+?)\s*\(cost=/);
  return m ? m[1].trim() : ersteZeile.trim();
}
function welcheIndizes(planText) { return RELEVANTE_INDIZES.filter(n => planText.includes(n)); }

async function explainEinmal(text, params = []) {
  const zeilen = params.length ? await sql.unsafe(text, params) : await sql.unsafe(text);
  return zeilen.map(z => z["QUERY PLAN"]).join("\n");
}

// ---------- Aufbau: EINE Organisation, N Inserate, 200 Anfragen ----------
async function organisationAufbauen(ts, n) {
  const slug = `fw-skalentest-${ts}`;
  const orgRow = await sql`
    INSERT INTO organization (slug, kind, legal_name, display_name)
    VALUES (${slug}, 'agency', 'Skalentest (Wegwerf)', 'Skalentest (Wegwerf)') RETURNING id`;
  const orgId = orgRow[0].id;

  const personen = [];
  for (let i = 0; i < 3; i++) {
    const email = `skalentest-${ts}-${i}@fourwalls.example`;
    const row = await sql`INSERT INTO app_user (email, display_name, platform_role) VALUES (${email}, ${"Skalentest Person " + i}, 'user') RETURNING id`;
    personen.push(row[0].id);
    await sql`INSERT INTO org_membership (organization_id, user_id, role) VALUES (${orgId}, ${row[0].id}, 'agent')`;
  }

  const stadtMarke = `Skalentest-${ts}`;
  await sql`
    INSERT INTO property (kind, postal_code, city, canton, country, geo_precision, geo_radius_m, rooms, living_area_m2)
    SELECT 'apartment', '8000', ${stadtMarke}, 'ZH', 'CH', 'municipality', 2000, 2.5, 60
    FROM generate_series(1, ${n})`;

  await sql`
    WITH props AS (SELECT id, row_number() OVER () AS rn FROM property WHERE city = ${stadtMarke})
    INSERT INTO listing (property_id, transaction, status, publisher_kind, published_by_org_id, assigned_user_id,
        title, content_locale, price_chf, slug, is_demo, published_at, updated_at)
    SELECT
      props.id, 'sale',
      (ARRAY['draft','submitted','published']::listing_status[])[1 + (rn % 3)],
      'agency', ${orgId},
      (ARRAY[${personen[0]}, ${personen[1]}, ${personen[2]}]::uuid[])[1 + (rn % 3)],
      'Skalentest Inserat ' || rn, 'de', 50000000, 'skalentest-' || ${ts} || '-' || rn, false,
      CASE WHEN (rn % 3) = 2 THEN now() - (rn % 90) * interval '1 day' ELSE NULL END,
      now() - (rn % 400) * interval '1 hour'
    FROM props`;

  /* Anfragen nur auf veröffentlichte Inserate — Migration 0022 (inquiry_listing_status_pruefen) verweigert Anfragen auf Entwürfe. */
  const listingIds = (await sql`SELECT id FROM listing WHERE published_by_org_id = ${orgId} AND status IN ('published','reserved') ORDER BY random() LIMIT 200`).map(r => r.id);
  for (const lid of listingIds) {
    await sql`
      INSERT INTO inquiry (kind, listing_id, sender_name, sender_email, recipient_org_id, message)
      VALUES ('listing_question', ${lid}, 'Skalentest Anfrage', 'skalentest-anfrage@fourwalls.example', ${orgId}, 'Automatisch erzeugte Anfrage für den Skalentest.')`;
  }

  return { orgId, personen, gesucht: personen[0], stadtMarke };
}

async function aufraeumen(orgId, personen, stadtMarke) {
  await sql.begin(async tx => {
    await tx`DELETE FROM inquiry WHERE recipient_org_id = ${orgId}`;
    await tx`DELETE FROM listing WHERE published_by_org_id = ${orgId}`;
    /* Nur die Properties DIESES Laufs — die genaue Stadtmarke (mit Zeitstempel),
       nie ein Muster, das auch einen anderen, gleichzeitigen Lauf träfe. */
    await tx`DELETE FROM property WHERE city = ${stadtMarke}`;
    await tx`DELETE FROM org_membership WHERE organization_id = ${orgId}`;
    await tx`DELETE FROM organization WHERE id = ${orgId}`;
    for (const p of personen) await tx`DELETE FROM app_user WHERE id = ${p}`;
  });
  const rest = await sql`SELECT count(*)::int AS n FROM organization WHERE id = ${orgId}`;
  if (rest[0].n !== 0) throw new Error(`Aufräumen unvollständig: Organisation ${orgId} noch vorhanden`);
}

// ---------- Die fünf Abfragen ----------
async function alleAbfragenMessen(orgId, gesuchterUser) {
  const ergebnisse = [];

  ergebnisse.push(await einzelneMessung(
    "a Seite 1 (updated_at)",
    `EXPLAIN (ANALYZE, BUFFERS) SELECT id, status, title, updated_at FROM listing
     WHERE published_by_org_id = $1 ORDER BY updated_at DESC LIMIT 24 OFFSET 0`,
    [orgId]
  ));
  ergebnisse.push(await einzelneMessung(
    "b Filter status=published",
    `EXPLAIN (ANALYZE, BUFFERS) SELECT id, status, title, updated_at FROM listing
     WHERE published_by_org_id = $1 AND status = 'published' ORDER BY updated_at DESC LIMIT 24 OFFSET 0`,
    [orgId]
  ));
  ergebnisse.push(await einzelneMessung(
    "c Filter assigned_user_id",
    `EXPLAIN (ANALYZE, BUFFERS) SELECT id, status, title, updated_at FROM listing
     WHERE published_by_org_id = $1 AND assigned_user_id = $2 ORDER BY updated_at DESC LIMIT 24 OFFSET 0`,
    [orgId, gesuchterUser]
  ));
  ergebnisse.push(await einzelneMessung(
    "d Volltext (Titel ILIKE)",
    `EXPLAIN (ANALYZE, BUFFERS) SELECT id, status, title, updated_at FROM listing
     WHERE published_by_org_id = $1 AND title ILIKE '%42%' ORDER BY updated_at DESC LIMIT 24 OFFSET 0`,
    [orgId]
  ));
  ergebnisse.push(await einzelneMessung(
    "e Posteingang (inquiry)",
    `EXPLAIN (ANALYZE, BUFFERS) SELECT id, created_at FROM inquiry
     WHERE recipient_org_id = $1 ORDER BY created_at DESC LIMIT 24 OFFSET 0`,
    [orgId]
  ));

  return ergebnisse;
}

async function einzelneMessung(label, text, params) {
  const laeufe = [];
  for (let i = 0; i < 3; i++) {
    const planText = await explainEinmal(text, params);
    laeufe.push({ planText, execMs: parseExecutionTime(planText) });
  }
  const execTimes = laeufe.map(l => l.execMs).filter(v => v !== null);
  const letzterPlan = laeufe[laeufe.length - 1].planText;
  const medianMs = execTimes.length ? [...execTimes].sort((a, b) => a - b)[Math.floor(execTimes.length / 2)] : null;
  return { label, medianMs, topNode: parseTopNode(letzterPlan), indexVerwendet: welcheIndizes(letzterPlan), planText: letzterPlan };
}

// ---------- Ablauf ----------
async function main() {
  const gesamtBericht = [];
  for (const n of STUFEN) {
    const ts = Date.now();
    console.log(`\n=== Stufe N=${n} ===`);
    console.log(`  lege Organisation fw-skalentest-${ts} mit ${n} Inseraten und 200 Anfragen an …`);
    const t0 = Date.now();
    const { orgId, personen, gesucht, stadtMarke } = await organisationAufbauen(ts, n);
    const aufbauMs = Date.now() - t0;

    await sql.unsafe("ANALYZE listing, property, inquiry");

    console.log("  messe fünf Abfragen (je 3×) …");
    const abfragen = await alleAbfragenMessen(orgId, gesucht);

    for (const a of abfragen) {
      const erwartetIndex = a.label.startsWith("a") || a.label.startsWith("b") || a.label.startsWith("c")
        ? a.indexVerwendet.some(i => i === "listing_org_uebersicht" || i === "listing_org_zuweisung")
        : true;
      const unterZiel = a.medianMs !== null && a.medianMs < ZIEL_MS;
      a.n = n; a.erwartetIndex = erwartetIndex; a.unterZiel = unterZiel;
      if (n === ZIEL_N && (!unterZiel || !erwartetIndex)) {
        console.warn(`  Befund: [${a.label}] bei N=${n}: ${a.medianMs ?? "?"} ms, Index=${a.indexVerwendet.join(",") || "keiner"} (erwartet <${ZIEL_MS} ms und passenden Index)`);
      }
    }

    console.log("  räume auf …");
    const tClean0 = Date.now();
    await aufraeumen(orgId, personen, stadtMarke);
    const aufraeumenMs = Date.now() - tClean0;

    gesamtBericht.push({ n, aufbauMs, aufraeumenMs, abfragen });
  }

  console.log("\n\n=== Ergebnistabelle (Median ms aus EXPLAIN ANALYZE, DB-Zeit) ===");
  for (const stufe of gesamtBericht) {
    console.log(`\nN = ${stufe.n}  (Aufbau ${stufe.aufbauMs} ms, Aufräumen ${stufe.aufraeumenMs} ms)`);
    console.table(stufe.abfragen.map(a => ({
      Abfrage: a.label,
      "Median ms": a.medianMs !== null ? a.medianMs.toFixed(2) : "–",
      "Index?": a.indexVerwendet.length ? a.indexVerwendet.join(",") : "nein",
      "Oberster Knoten": a.topNode ?? "–",
      [`< ${ZIEL_MS} ms`]: a.unterZiel ? "ja" : "nein",
      "erwarteter Index": a.erwartetIndex ? "ja" : "nein"
    })));
  }
}

try {
  await main();
} finally {
  await sql.end();
}
