#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Skalentest der Anliegen-Übersicht (P5.8 §68)

   Legt N synthetische `service_lead`-Zeilen an (contact_email
   `skalen+<n>-<rn>@example.com`, gemischte Status/Dienste/Sprachen/
   place_key, ein Teil mit user_id auf drei Wegwerf-Konten) und misst per
   EXPLAIN (ANALYZE, BUFFERS) die fünf Abfragen, die die interne Übersicht
   und die eigene Anliegenliste tatsächlich stellen (server/anliegen.ts):

     (a) leadListe: Seite 1, ohne Filter, sortiert nach created_at
     (b) leadListe: Filter status = 'new'
     (c) leadListe: Filter service = 'sell' AND status = 'new'
     (d) leadListe: Suche (ILIKE auf Name/E-Mail/Referenz)
     (e) meineAnliegen: Filter user_id (eigene Anliegenliste)

   Prüft je Fall bei N=10000: Dauer < 150 ms UND (bei a/b/c) Verwendung der
   Indizes `service_lead_eingang` bzw. `service_lead_dienst`. Verstösse
   werden als Befund protokolliert (wie scripts/skalen-org-test.mjs), das
   Skript bricht deshalb nicht ab — die Zahlen entscheiden.

   Räumt am Ende NUR die eigenen Zeilen weg: `service_lead` mit
   `contact_email LIKE 'skalen+%@example.com'`, plus die drei
   Wegwerf-Personen (app_user).

   Aufruf:
     set -a; . ./.env.local; set +a
     node scripts/skalen-anliegen-test.mjs               Stufen 100, 1000, 10000
     node scripts/skalen-anliegen-test.mjs 100 1000       nur diese Stufen
   Umgebung: DATABASE_URL (verweigert in production)
   ============================================================ */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a)"); process.exit(2); }
const appEnv = process.env.APP_ENV ?? "development";
if (appEnv === "production") { console.error("Skalentest in Produktion verweigert"); process.exit(2); }

const sql = postgres(url, { max: 1, onnotice: () => {} });

const STUFEN_ARG = process.argv.slice(2).map(Number).filter(n => Number.isFinite(n) && n > 0);
const STUFEN = STUFEN_ARG.length ? STUFEN_ARG : [100, 1000, 10000];
const ZIEL_MS = 150;
const ZIEL_N = 10000;
const RELEVANTE_INDIZES = ["service_lead_eingang", "service_lead_dienst", "service_lead_person", "service_lead_ort", "service_lead_zustaendig"];

// ---------- Hilfsfunktionen (wie scripts/skalen-org-test.mjs) ----------
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

// ---------- Aufbau: N Zeilen, drei Wegwerf-Personen, gemischte Werte ----------
async function datenAufbauen(ts, n) {
  const personen = [];
  for (let i = 0; i < 3; i++) {
    const email = `skalen-person-${ts}-${i}@example.com`;
    const row = await sql`INSERT INTO app_user (email, display_name, platform_role) VALUES (${email}, ${"Skalentest Person " + i}, 'user') RETURNING id`;
    personen.push(row[0].id);
  }

  await sql`
    INSERT INTO service_lead (
      service, status, user_id, contact_name, contact_email, preferred_channel, locale, place_key
    )
    SELECT
      (ARRAY['sell','let','valuation','property_management','owner_consultation']::service_kind[])[1 + (rn % 5)],
      (ARRAY['new','contacted','qualified','closed','declined']::service_lead_status[])[1 + (rn % 5)],
      CASE WHEN rn % 4 = 0 THEN (ARRAY[${personen[0]}, ${personen[1]}, ${personen[2]}]::uuid[])[1 + (rn % 3)] ELSE NULL END,
      'Skalentest Kontakt ' || rn,
      'skalen+' || ${ts} || '-' || rn || '@example.com',
      'email',
      (ARRAY['de','fr','it','en'])[1 + (rn % 4)],
      CASE WHEN rn % 3 = 0 THEN 'ort-zuerich' WHEN rn % 3 = 1 THEN 'ort-bern' ELSE NULL END
    FROM generate_series(1, ${n}) AS rn`;

  return { personen, gesuchterUser: personen[0] };
}

async function aufraeumen(personen) {
  await sql.begin(async tx => {
    await tx`DELETE FROM service_lead WHERE contact_email LIKE 'skalen+%@example.com'`;
    for (const p of personen) await tx`DELETE FROM app_user WHERE id = ${p}`;
  });
  const rest = await sql`SELECT count(*)::int AS n FROM service_lead WHERE contact_email LIKE 'skalen+%@example.com'`;
  if (rest[0].n !== 0) throw new Error(`Aufräumen unvollständig: ${rest[0].n} Zeile(n) übrig`);
}

// ---------- Die fünf Abfragen (Spiegel von server/anliegen.ts) ----------
async function alleAbfragenMessen(gesuchterUser) {
  const ergebnisse = [];

  ergebnisse.push(await einzelneMessung(
    "a Seite 1 (ohne Filter)",
    `EXPLAIN (ANALYZE, BUFFERS) SELECT sl.public_ref, sl.service, sl.status, sl.created_at, sl.contact_name, sl.contact_email
       FROM service_lead sl WHERE 1=1 ORDER BY sl.created_at DESC LIMIT 25 OFFSET 0`
  ));
  ergebnisse.push(await einzelneMessung(
    "b Filter status=new",
    `EXPLAIN (ANALYZE, BUFFERS) SELECT sl.public_ref, sl.service, sl.status, sl.created_at, sl.contact_name, sl.contact_email
       FROM service_lead sl WHERE sl.status = 'new' ORDER BY sl.created_at DESC LIMIT 25 OFFSET 0`
  ));
  ergebnisse.push(await einzelneMessung(
    "c Filter service=sell AND status=new",
    `EXPLAIN (ANALYZE, BUFFERS) SELECT sl.public_ref, sl.service, sl.status, sl.created_at, sl.contact_name, sl.contact_email
       FROM service_lead sl WHERE sl.service = 'sell' AND sl.status = 'new' ORDER BY sl.created_at DESC LIMIT 25 OFFSET 0`
  ));
  ergebnisse.push(await einzelneMessung(
    "d Suche (ILIKE Name/E-Mail/Referenz)",
    `EXPLAIN (ANALYZE, BUFFERS) SELECT sl.public_ref, sl.service, sl.status, sl.created_at, sl.contact_name, sl.contact_email
       FROM service_lead sl
      WHERE (sl.contact_name ILIKE '%42%' OR sl.contact_email ILIKE '%42%' OR sl.public_ref ILIKE '%42%')
      ORDER BY sl.created_at DESC LIMIT 25 OFFSET 0`
  ));
  ergebnisse.push(await einzelneMessung(
    "e Filter user_id (eigene Anliegen)",
    `EXPLAIN (ANALYZE, BUFFERS) SELECT sl.public_ref, sl.service, sl.status, sl.created_at
       FROM service_lead sl WHERE sl.user_id = $1 ORDER BY sl.created_at DESC LIMIT 100`,
    [gesuchterUser]
  ));

  return ergebnisse;
}

async function einzelneMessung(label, text, params = []) {
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
    console.log(`  lege ${n} synthetische service_lead-Zeilen an …`);
    const t0 = Date.now();
    const { personen, gesuchterUser } = await datenAufbauen(ts, n);
    const aufbauMs = Date.now() - t0;

    await sql.unsafe("ANALYZE service_lead");

    console.log("  messe fünf Abfragen (je 3×) …");
    const abfragen = await alleAbfragenMessen(gesuchterUser);

    for (const a of abfragen) {
      const erwartetIndex = a.label.startsWith("b")
        ? a.indexVerwendet.includes("service_lead_eingang")
        : a.label.startsWith("c")
        ? a.indexVerwendet.includes("service_lead_dienst")
        : true;
      const unterZiel = a.medianMs !== null && a.medianMs < ZIEL_MS;
      a.n = n; a.erwartetIndex = erwartetIndex; a.unterZiel = unterZiel;
      if (n === ZIEL_N && (!unterZiel || !erwartetIndex)) {
        console.warn(`  Befund: [${a.label}] bei N=${n}: ${a.medianMs ?? "?"} ms, Index=${a.indexVerwendet.join(",") || "keiner"} (erwartet <${ZIEL_MS} ms und passenden Index)`);
      }
    }

    console.log("  räume auf …");
    const tClean0 = Date.now();
    await aufraeumen(personen);
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
