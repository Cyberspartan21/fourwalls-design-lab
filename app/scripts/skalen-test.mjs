/* ============================================================
   FOURWALLS — Skalen-Test der Datenbank-Suche (PostGIS)

   Misst listing_public bei 320 (Ist-Bestand), 2 000, 10 000 und 50 000
   Inseraten. Timings kommen aus EXPLAIN (ANALYZE, BUFFERS) — DB-Zeit, nicht
   Client-Zeit.

   Synthetischer Bestand: public_ref beginnt mit 'FWI-2026-9' / 'FWL-2026-9',
   wird je Stufe erzeugt, gemessen und danach restlos wieder gelöscht. Der
   Ist-Bestand (public_ref NICHT mit 9 beginnend) wird nie verändert.

   Aufruf:  set -a; . ./.env.local; set +a; node scripts/skalen-test.mjs
   Umgebung: DATABASE_URL (verweigert in production)
   ============================================================ */
import postgres from "postgres";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
const appOrdner = join(hier, "..");
const berichtPfad = join(appOrdner, "var", "skalen-bericht.json");

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL fehlt"); process.exit(1); }
const appEnv = process.env.APP_ENV ?? "development";
if (appEnv === "production") { console.error("Skalen-Test in Produktion verweigert"); process.exit(2); }

const sql = postgres(url, { max: 1, onnotice: () => {} });

const ZEHN_MINUTEN_MS = 10 * 60 * 1000;
const RELEVANTE_INDIZES = [
  "listing_geom_gix", "property_geom_public_gix", "listing_aktiv_neu", "listing_aktiv_preis",
];

// ---------- Hilfsfunktionen ----------

function median(werte) {
  const s = [...werte].sort((a, b) => a - b);
  const mitte = Math.floor(s.length / 2);
  return s.length % 2 ? s[mitte] : (s[mitte - 1] + s[mitte]) / 2;
}

function parseExecutionTime(planText) {
  const m = planText.match(/Execution Time:\s*([\d.]+)\s*ms/);
  return m ? parseFloat(m[1]) : null;
}

function parseTopNode(planText) {
  const ersteZeile = planText.split("\n")[0] ?? "";
  const m = ersteZeile.match(/^\s*->?\s*([A-Za-z0-9 ]+?)\s*\(cost=/);
  return m ? m[1].trim() : ersteZeile.trim();
}

function welcheIndizes(planText) {
  return RELEVANTE_INDIZES.filter((n) => planText.includes(n));
}

async function explainEinmal(text, params = []) {
  const zeilen = params.length ? await sql.unsafe(text, params) : await sql.unsafe(text);
  return zeilen.map((z) => z["QUERY PLAN"]).join("\n");
}

async function explainDreimal(label, text, params = []) {
  const laeufe = [];
  for (let i = 0; i < 3; i++) {
    const planText = await explainEinmal(text, params);
    laeufe.push({ planText, execMs: parseExecutionTime(planText) });
  }
  const execTimes = laeufe.map((l) => l.execMs).filter((v) => v !== null);
  const letzterPlan = laeufe[laeufe.length - 1].planText;
  return {
    label,
    medianMs: execTimes.length ? median(execTimes) : null,
    execTimes,
    topNode: parseTopNode(letzterPlan),
    indexVerwendet: welcheIndizes(letzterPlan),
    alleLaeufePlanText: laeufe.map((l) => l.planText),
  };
}

// ---------- Die sieben Abfragen (feste Zeichenketten, keine Nutzereingaben) ----------

const ABFRAGE_1 = `EXPLAIN (ANALYZE, BUFFERS) SELECT lp.public_ref FROM listing_public lp
WHERE lp.transaction='sale' AND lp.status='published'
ORDER BY lp.published_at DESC, lp.public_ref DESC LIMIT 24`;

const ABFRAGE_2 = `EXPLAIN (ANALYZE, BUFFERS) SELECT lp.public_ref FROM listing_public lp
WHERE lp.transaction='sale' AND lp.status='published'
  AND lp.price_chf BETWEEN 50000000 AND 200000000 AND lp.rooms >= 3.5
ORDER BY lp.price_chf ASC NULLS LAST, lp.public_ref LIMIT 24`;

const ABFRAGE_3 = `EXPLAIN (ANALYZE, BUFFERS) SELECT lp.public_ref FROM listing_public lp
WHERE lp.transaction='sale' AND lp.status='published'
  AND ST_DWithin(lp.geom_public, ST_SetSRID(ST_MakePoint(8.3093,47.0502),4326)::geography, 20000)
ORDER BY lp.published_at DESC LIMIT 24`;

const ABFRAGE_4 = `EXPLAIN (ANALYZE, BUFFERS) SELECT lp.public_ref FROM listing_public lp
WHERE lp.transaction='rent' AND lp.status='published'
  AND lp.geom_public && ST_MakeEnvelope(8.40,47.30,8.70,47.45,4326)::geography
LIMIT 2000`;

const ABFRAGE_5 = `EXPLAIN (ANALYZE, BUFFERS) SELECT count(*), lp.property_kind, lp.publisher_kind
FROM listing_public lp
WHERE lp.transaction='sale' AND lp.status='published'
  AND ST_DWithin(lp.geom_public, ST_SetSRID(ST_MakePoint(8.5417,47.3769),4326)::geography, 10000)
GROUP BY 2,3`;

const ABFRAGE_6 = `EXPLAIN (ANALYZE, BUFFERS) SELECT lp.public_ref FROM listing_public lp
WHERE lp.transaction='sale' AND lp.status='published'
ORDER BY lp.price_per_m2 ASC NULLS LAST, lp.public_ref LIMIT 24`;

const ABFRAGE_7 = `EXPLAIN (ANALYZE, BUFFERS) SELECT lp.public_ref FROM listing_public lp
WHERE lp.status='published' AND lp.transaction='sale'
  AND lp.property_kind = (SELECT property_kind FROM listing_public WHERE public_ref = $1)
  AND lp.public_ref <> $1
  AND abs(lp.price_chf - (SELECT price_chf FROM listing_public WHERE public_ref = $1))::numeric
      / (SELECT price_chf FROM listing_public WHERE public_ref = $1) <= 0.35
ORDER BY lp.public_ref LIMIT 3`;

async function alleAbfragenMessen() {
  const ergebnisse = [];
  ergebnisse.push(await explainDreimal("1 Standard (neu, Kauf)", ABFRAGE_1));
  ergebnisse.push(await explainDreimal("2 Preis+Zimmer", ABFRAGE_2));
  ergebnisse.push(await explainDreimal("3 Umkreis 20km Luzern", ABFRAGE_3));
  ergebnisse.push(await explainDreimal("4 Kartenausschnitt (Miete)", ABFRAGE_4));
  ergebnisse.push(await explainDreimal("5 Zählung mit Facetten", ABFRAGE_5));
  ergebnisse.push(await explainDreimal("6 Sortierung CHF/m²", ABFRAGE_6));

  const refZeile = await sql`
    SELECT public_ref FROM listing_public
    WHERE transaction='sale' AND status='published'
    ORDER BY public_ref LIMIT 1`;
  if (refZeile.length === 0) {
    ergebnisse.push({
      label: "7 Ähnliche Inserate",
      medianMs: null, execTimes: [], topNode: null, indexVerwendet: [],
      alleLaeufePlanText: [], fehler: "kein veröffentlichtes Kauf-Inserat vorhanden",
    });
  } else {
    const ref = refZeile[0].public_ref;
    try {
      const r = await explainDreimal("7 Ähnliche Inserate", ABFRAGE_7, [ref]);
      r.basisReferenz = ref;
      ergebnisse.push(r);
    } catch (e) {
      ergebnisse.push({
        label: "7 Ähnliche Inserate", medianMs: null, execTimes: [], topNode: null,
        indexVerwendet: [], alleLaeufePlanText: [], fehler: String(e.message ?? e), basisReferenz: ref,
      });
    }
  }
  return ergebnisse;
}

// ---------- Synthetischen Bestand erzeugen ----------

async function bestandErzeugen(n) {
  await sql`
    INSERT INTO property (public_ref, kind, postal_code, city, canton, country,
      geom_exact, geo_precision, geo_radius_m, rooms, living_area_m2, built_year, place_id)
    SELECT
      'FWI-2026-9' || lpad(i::text, 5, '0'),
      (ARRAY['apartment','house','villa','chalet','multi_family','commercial','land','parking']::property_kind[])[1 + (i % 8)],
      '8000', 'Synth',
      (ARRAY['ZH','BE','LU','VD','GE','TI','SG','AG'])[1 + (i % 8)],
      'CH',
      ST_SetSRID(ST_MakePoint(
        5.96 + (i*0.618034 - floor(i*0.618034)) * (10.49-5.96),
        45.82 + (i*0.381966 - floor(i*0.381966)) * (47.81-45.82)
      ), 4326)::geography,
      (ARRAY['exact','approximate','municipality']::geo_precision[])[1 + (i % 3)],
      (ARRAY[0,450,2000])[1 + (i % 3)],
      1.5 + (i % 12) * 0.5,
      40 + (i % 20) * 15,
      1900 + (i % 120),
      NULL
    FROM generate_series(1, ${n}) AS i`;

  await sql`
    INSERT INTO listing (public_ref, property_id, transaction, status, publisher_kind,
      published_by_org_id, title, content_locale, price_chf, rent_net_chf, slug, is_demo, published_at)
    SELECT
      'FWL-2026-9' || lpad(s.i::text, 5, '0'),
      p.id,
      (ARRAY['sale','rent']::transaction_kind[])[1 + (s.i % 2)],
      'draft',
      'agency',
      (SELECT id FROM organization WHERE slug = 'fourwalls'),
      'Synth ' || s.i,
      'de',
      CASE WHEN (s.i % 2) = 0 THEN (300000 + (s.i % 50) * 80000) * 100 ELSE NULL END,
      CASE WHEN (s.i % 2) = 1 THEN (1200 + (s.i % 40) * 150) * 100 ELSE NULL END,
      'synth-' || s.i,
      true,
      now() - (s.i % 400) * interval '1 day'
    FROM generate_series(1, ${n}) AS s(i)
    JOIN property p ON p.public_ref = 'FWI-2026-9' || lpad(s.i::text, 5, '0')`;
}

async function veroeffentlichen() {
  const schritte = [];
  await sql.begin(async (tx) => {
    await tx`SELECT set_config('app.actor_id', '00000000-0000-0000-0000-00000000dead', true)`;
    await tx`SELECT set_config('app.reason', 'skalen-test', true)`;

    let t0 = Date.now();
    await tx`UPDATE listing SET status='submitted' WHERE public_ref LIKE 'FWL-2026-9%'`;
    schritte.push({ schritt: "draft→submitted", ms: Date.now() - t0 });

    t0 = Date.now();
    await tx`UPDATE listing SET status='in_review' WHERE public_ref LIKE 'FWL-2026-9%'`;
    schritte.push({ schritt: "submitted→in_review", ms: Date.now() - t0 });

    t0 = Date.now();
    await tx`UPDATE listing SET status='approved' WHERE public_ref LIKE 'FWL-2026-9%'`;
    schritte.push({ schritt: "in_review→approved", ms: Date.now() - t0 });

    t0 = Date.now();
    await tx`UPDATE listing SET status='published', is_indexable=true WHERE public_ref LIKE 'FWL-2026-9%'`;
    schritte.push({ schritt: "approved→published", ms: Date.now() - t0 });
  });
  for (const s of schritte) {
    if (s.ms > 60000) console.warn(`  Befund: Statuswechsel ${s.schritt} brauchte ${s.ms} ms (>60 s)`);
  }
  return schritte;
}

async function aufraeumen() {
  await sql.begin(async (tx) => {
    await tx`DELETE FROM audit_log
             WHERE entity_type = 'listing'
               AND entity_id IN (SELECT id FROM listing WHERE public_ref LIKE 'FWL-2026-9%')`;
    await tx`DELETE FROM listing WHERE public_ref LIKE 'FWL-2026-9%'`;
    await tx`DELETE FROM property WHERE public_ref LIKE 'FWI-2026-9%'`;
  });
  const rest = await sql`SELECT count(*)::int AS n FROM listing WHERE public_ref LIKE 'FWL-2026-9%'`;
  if (rest[0].n !== 0) {
    throw new Error(`Aufräumen unvollständig: ${rest[0].n} Synth-Zeilen übrig`);
  }
  await sql.unsafe("VACUUM ANALYZE listing, property");
}

// ---------- Ablauf ----------

async function main() {
  const start0 = await sql`SELECT count(*)::int AS n FROM listing WHERE public_ref NOT LIKE 'FWL-2026-9%'`;
  console.log(`Ist-Bestand vor dem Test: ${start0[0].n} Inserate (unverändert, public_ref beginnt nicht mit 9)`);

  const stufen = [320, 2000, 10000, 50000];
  const bericht = { generated_at: new Date().toISOString(), app_env: appEnv, ist_bestand: start0[0].n, stufen: [] };

  for (const n of stufen) {
    console.log(`\n=== Stufe ${n} ===`);
    const stufenStart = Date.now();
    const eintrag = { n_ziel: n, generiert: n !== 320 };

    if (n !== 320) {
      const check = await sql`SELECT count(*)::int AS n FROM listing WHERE public_ref LIKE 'FWL-2026-9%'`;
      if (check[0].n !== 0) throw new Error(`Vor Stufe ${n} liegen noch ${check[0].n} Synth-Zeilen vor — Abbruch`);

      console.log(`  erzeuge ${n} synthetische Inserate …`);
      const tGen0 = Date.now();
      await bestandErzeugen(n);
      eintrag.generierung_ms = Date.now() - tGen0;

      console.log(`  veröffentliche (vier Statuswechsel) …`);
      eintrag.veroeffentlichung_schritte = await veroeffentlichen();

      if (n === 50000 && Date.now() - stufenStart > ZEHN_MINUTEN_MS) {
        console.error("Abbruch: 50k-Stufe brauchte bereits vor der Messung länger als 10 Minuten (Erzeugung/Veröffentlichung).");
        eintrag.abgebrochen = "Zeitlimit vor Messung überschritten";
        bericht.stufen.push(eintrag);
        break;
      }
    }

    await sql.unsafe("ANALYZE listing, property");

    console.log("  messe sieben Abfragen (je 3×) …");
    const tMess0 = Date.now();
    const abfragen = await alleAbfragenMessen();
    eintrag.messung_ms = Date.now() - tMess0;

    eintrag.gesamtbestand_listing = (await sql`SELECT count(*)::int AS n FROM listing`)[0].n;

    eintrag.abfragen = abfragen.map((a) => ({
      label: a.label,
      median_ms: a.medianMs,
      exec_times_ms: a.execTimes,
      top_node: a.topNode,
      index_verwendet: a.indexVerwendet,
      fuer_interaktive_suche_ungeeignet: a.medianMs !== null && a.medianMs > 200,
      fehler: a.fehler,
      basis_referenz: a.basisReferenz,
    }));
    if (n === 50000) {
      eintrag.explain_vollstaendig = abfragen.map((a) => ({ label: a.label, laeufe: a.alleLaeufePlanText }));
    }

    if (n !== 320) {
      if (n === 50000 && Date.now() - stufenStart > ZEHN_MINUTEN_MS) {
        console.error("Befund: 50k-Stufe brauchte bereits vor dem Aufräumen länger als 10 Minuten.");
        eintrag.abgebrochen = "Zeitlimit vor Aufräumen überschritten";
      }
      console.log("  räume auf …");
      const tClean0 = Date.now();
      await aufraeumen();
      eintrag.aufraeumen_ms = Date.now() - tClean0;
    }

    eintrag.stufe_gesamt_ms = Date.now() - stufenStart;
    if (n === 50000 && eintrag.stufe_gesamt_ms > ZEHN_MINUTEN_MS) {
      console.error(`Befund: 50k-Stufe insgesamt ${eintrag.stufe_gesamt_ms} ms (> 10 Minuten).`);
    }

    bericht.stufen.push(eintrag);
  }

  // ---------- Tabelle auf stdout ----------
  console.log("\n\n=== Ergebnistabelle (Median ms aus EXPLAIN ANALYZE, DB-Zeit) ===");
  for (const stufe of bericht.stufen) {
    console.log(`\nStufe ${stufe.n_ziel} (Listing-Gesamtbestand während der Messung: ${stufe.gesamtbestand_listing ?? "?"})`);
    const zeilen = (stufe.abfragen ?? []).map((a) => ({
      Abfrage: a.label,
      "Median ms": a.median_ms !== null ? a.median_ms.toFixed(2) : (a.fehler ? "Fehler" : "–"),
      "Index?": a.index_verwendet.length ? a.index_verwendet.join(",") : "nein",
      "Oberster Knoten": a.top_node ?? "–",
      "ungeeignet >200ms": a.fuer_interaktive_suche_ungeeignet ? "JA" : "",
    }));
    console.table(zeilen);
  }

  // ---------- Endkontrolle ----------
  const restKontrolle = await sql`SELECT count(*)::int AS n FROM listing WHERE public_ref LIKE 'FWL-2026-9%'`;
  console.log(`\nEndkontrolle: verbleibende Synth-Inserate = ${restKontrolle[0].n}`);
  const bestandKontrolle = await sql`SELECT count(*)::int AS n FROM listing WHERE public_ref NOT LIKE 'FWL-2026-9%'`;
  console.log(`Ist-Bestand nach dem Test: ${bestandKontrolle[0].n} Inserate (Ausgangswert war ${start0[0].n})`);
  bericht.rest_synth_am_ende = restKontrolle[0].n;
  bericht.ist_bestand_am_ende = bestandKontrolle[0].n;

  mkdirSync(join(appOrdner, "var"), { recursive: true });
  writeFileSync(berichtPfad, JSON.stringify(bericht, null, 2));
  console.log(`\nBericht geschrieben: ${berichtPfad}`);
}

try {
  await main();
} finally {
  await sql.end();
}
