/* Migrationen einspielen — die geprüften SQL-Dateien aus ../db/migrations,
   in Reihenfolge, jede genau einmal (Buch in schema_migration).

   node scripts/migrate.mjs           Migrationen
   node scripts/migrate.mjs --seed    zusätzlich den Entwicklungsbestand (nie in Produktion)
   node scripts/migrate.mjs --test    die 16 Zusagen aus db/tests prüfen

   Kein Docker-Aufruf: läuft gegen DATABASE_URL, also lokal wie in CI wie in
   Staging. */
import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
const dbOrdner = join(hier, "..", "..", "db");
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL fehlt"); process.exit(1); }
const appEnv = process.env.APP_ENV ?? "development";
const argv = new Set(process.argv.slice(2));

const sql = postgres(url, { max: 1, onnotice: () => {} });

async function migrieren() {
  await sql`CREATE TABLE IF NOT EXISTS schema_migration (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  const fertig = new Set((await sql`SELECT name FROM schema_migration`).map(r => r.name));
  const dateien = readdirSync(join(dbOrdner, "migrations")).filter(f => /^\d{4}_.*\.sql$/.test(f)).sort();
  let neu = 0;
  for (const f of dateien) {
    if (fertig.has(f)) continue;
    const text = readFileSync(join(dbOrdner, "migrations", f), "utf8");
    /* Die Dateien bringen ihre eigene Transaktion mit (BEGIN/COMMIT). */
    await sql.unsafe(text);
    await sql`INSERT INTO schema_migration (name) VALUES (${f})`;
    console.log("✓ " + f); neu++;
  }
  if (!neu) console.log(`Schema aktuell (${dateien.length} Migrationen)`);
}

async function seeden() {
  if (appEnv === "production") { console.error("Seed in Produktion verweigert"); process.exit(2); }
  const dateien = readdirSync(join(dbOrdner, "seed")).filter(f => f.endsWith(".sql")).sort();
  for (const f of dateien) {
    await sql.unsafe(readFileSync(join(dbOrdner, "seed", f), "utf8"));
    console.log("✓ seed " + f);
  }
}

async function testen() {
  const text = readFileSync(join(dbOrdner, "tests", "schema-test.sql"), "utf8").replace(/^\\set .*$/m, "");
  const meldungen = [];
  const t = postgres(url, { max: 1, onnotice: n => meldungen.push(n.message) });
  try { await t.unsafe(text); }
  catch (e) { console.error("✗ " + e.message); await t.end(); process.exit(3); }
  await t.end();
  const ok = meldungen.filter(m => m.startsWith("✓"));
  ok.forEach(m => console.log(m));
  console.log(`${ok.length} von 16 Zusagen geprüft`);
  if (ok.length !== 16) process.exit(4);
}

try {
  if (argv.has("--test")) await testen();
  else { await migrieren(); if (argv.has("--seed")) await seeden(); }
} finally { await sql.end(); }
