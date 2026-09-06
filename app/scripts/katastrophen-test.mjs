#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Backup/Restore-Katastrophentest (P5.10 §20)

   Beweist automatisiert, nummeriert, dass eine Sicherung wirklich etwas wert
   ist: Datenbank UND Objektspeicher werden gesichert, in einer Wegwerf-
   Umgebung wiederhergestellt, gegen das Original verglichen — und ein
   tatsächlich gelöschtes Testobjekt wird aus der Sicherung zurückgeholt.
   Nichts davon verändert die echte Entwicklungsdatenbank oder die echten
   Objekte in fw-dev-s3 auf Dauer: jede Wegwerf-Ressource wird am Ende
   entfernt (siehe Schritt 18), nur das eine Testobjekt unter dem Präfix
   restore-test/ wird kurz gelöscht und wieder hergestellt, um den Ausfall zu
   beweisen — danach ebenfalls entfernt.

   Projekt-Isolation (docs/PROJECT-ISOLATION-RULE.md): Der einzige Container,
   den dieses Skript anfasst, ist fw-dev-db (per Namen, nie per Portmuster).
   Wegwerf-Datenbanken tragen ausschliesslich den Namen fw_restore_test_<ts>,
   Wegwerf-Behälter ausschliesslich fw-restore-test-<ts>.

   Aufruf (lokal, gegen den Dev-Container fw-dev-db):
     set -a; . ./.env.local; set +a
     S3_ENDPOINT=http://localhost:59000 S3_REGION=us-east-1 \
     S3_ACCESS_KEY_ID=fwdev S3_SECRET_ACCESS_KEY=fwdev-nur-lokal-0000 \
     S3_FORCE_PATH_STYLE=ja \
     S3_BUCKET_PRIVATE=fw-dev-privat S3_BUCKET_PUBLIC=fw-dev-oeffentlich \
     node scripts/katastrophen-test.mjs

   Braucht (lokal): DATABASE_URL (zeigt auf fw-dev-db), die S3_*-Variablen
   oben, und `docker` auf dem PATH (für pg_dump/pg_restore — dieser Rechner
   hat keine lokalen Postgres-Clientwerkzeuge, siehe scripts/db-backup.sh).

   Aufruf (CI, P5.10 §43): kein fw-dev-db-Container, kein MinIO — nur ein
   namenloser Postgres-Dienstcontainer, erreichbar über DATABASE_URL, und
   STORAGE_PROVIDER=local (kein Objektspeicher). Zwei Umgebungsvariablen
   schalten das Skript entsprechend um, ohne dass sich an Schritten oder
   Prüfungen sonst etwas ändert:
     FW_KATASTROPHE_DB_MODUS=direkt   pg_dump/pg_restore/psql direkt auf dem
                                       PATH statt über `docker exec fw-dev-db`
                                       (Postgres-Client auf dem Runner
                                       installiert, z. B. apt-get install
                                       postgresql-client)
     FW_KATASTROPHE_SPEICHER=aus      Schritte 10–18 (Objektspeicher) und die
                                       S3_*-Pflichtvariablen entfallen; nur
                                       der Datenbankteil (Schritte 1–9) läuft

   Ausgabe:
     - nummerierte Tabelle auf stdout (Schritt → OK/FEHLER + Detail)
     - var/backups/<datum>.dump               (DB-Sicherung, Custom-Format)
     - var/backups/s3-<ts>/                   (Objektspeicher-Sicherung)
     - var/backups/bericht-<ts>.md            (lesbarer Bericht)
     - docs/backup-nachweis.json              (maschinenlesbarer Nachweis)
     - Exit 1 bei irgendeinem FEHLER, sonst 0
   ============================================================ */
import postgres from "postgres";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CreateBucketCommand, DeleteBucketCommand } from "@aws-sdk/client-s3";
import { clientAusUmgebung, sichern, wiederherstellen, vergleichen, inventar } from "./speicher-backup.mjs";

const HIER = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HIER, "..");
const REPO_ROOT = join(APP_ROOT, "..");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a)"); process.exit(2); }

// "container" (Standard, lokal): pg_dump/pg_restore laufen über `docker exec
// fw-dev-db`. "direkt" (CI, P5.10 §43): kein solcher Container vorhanden —
// dieselben Werkzeuge laufen direkt auf dem PATH gegen DATABASE_URL.
const DB_MODUS = process.env.FW_KATASTROPHE_DB_MODUS === "direkt" ? "direkt" : "container";
// Objektspeicher-Teil (Schritte 10–18) nur, wenn nicht ausdrücklich
// abgeschaltet — in CI gibt es kein MinIO (STORAGE_PROVIDER=local).
const SPEICHER_AKTIV = process.env.FW_KATASTROPHE_SPEICHER !== "aus";

const CONTAINER = "fw-dev-db"; // einziger Container, den dieses Skript anfasst (Projekt-Isolation)
const DBNAME = (() => {
  const m = /\/([^/?]+)(\?.*)?$/.exec(DATABASE_URL);
  if (!m) throw new Error("DATABASE_URL: Datenbankname nicht erkennbar");
  return m[1];
})();

const now = new Date();
const DATUM = now.toISOString().slice(0, 10);
const TS = now.toISOString().replace(/[:.]/g, "-");

const RESTORE_DB = `fw_restore_test_${TS}`;
// S3-Behälternamen dürfen keine Grossbuchstaben tragen (anders als der
// Datenbankname oben, der in Anführungszeichen gesetzt wird) — eigene,
// kleingeschriebene Fassung des Zeitstempels nur dafür.
const RESTORE_BUCKET = `fw-restore-test-${TS.toLowerCase()}`;
const BACKUP_ORDNER = join(APP_ROOT, "var", "backups");
const DUMP_DATEI = join(BACKUP_ORDNER, `${DATUM}.dump`);
const S3_BACKUP_ORDNER = join(BACKUP_ORDNER, `s3-${TS}`);
const BERICHT_DATEI = join(BACKUP_ORDNER, `bericht-${TS}.md`);
const NACHWEIS_DATEI = join(REPO_ROOT, "docs", "backup-nachweis.json");

const S3_BUCKET_PRIVATE = process.env.S3_BUCKET_PRIVATE;
const S3_BUCKET_PUBLIC = process.env.S3_BUCKET_PUBLIC;
if (SPEICHER_AKTIV && (!S3_BUCKET_PRIVATE || !S3_BUCKET_PUBLIC)) {
  console.error("S3_BUCKET_PRIVATE und S3_BUCKET_PUBLIC fehlen (siehe Kopfkommentar für alle nötigen S3_*-Variablen). Ohne Objektspeicher: FW_KATASTROPHE_SPEICHER=aus setzen.");
  process.exit(2);
}

/* Die Tabellen, deren Zeilenzahl Original und Wiederherstellung exakt gleich
   sein muss (P5.10 §20). */
const KRITISCHE_TABELLEN = [
  "listing", "organization", "app_user", "inquiry", "service_lead",
  "media_asset", "saved_search", "audit_log", "mail_outbox"
];

const ergebnisse = [];
async function schritt(nr, titel, fn) {
  try {
    const detail = (await fn()) ?? "ok";
    ergebnisse.push({ nr, titel, status: "OK", detail });
    console.log(`OK      ${String(nr).padStart(2)}  ${titel}${detail && detail !== "ok" ? " — " + detail : ""}`);
    return detail;
  } catch (e) {
    const detail = e && e.message ? e.message : String(e);
    ergebnisse.push({ nr, titel, status: "FEHLER", detail });
    console.log(`FEHLER  ${String(nr).padStart(2)}  ${titel} — ${detail}`);
    throw e;
  }
}

function docker(args, opts = {}) {
  return execFileSync("docker", args, { maxBuffer: 1024 * 1024 * 200, ...opts });
}

/* ---------- Datenbankverbindungen ---------- */
const wartung = postgres(DATABASE_URL.replace(/\/[^/?]+(\?.*)?$/, "/postgres"), { max: 1, onnotice: () => {} });
const original = postgres(DATABASE_URL, { max: 2, onnotice: () => {} });
let restoreSql; // erst nach dem Anlegen der Wegwerf-DB verfügbar

const dbBefund = { dumpBytes: 0, tabellen: {}, vergleich: "abweichend" };
const speicherBefund = { objekte: 0, wiederhergestellt: false };

console.log(`Katastrophentest startet — Datenbank ${DBNAME}, TS=${TS}`);
mkdirSync(BACKUP_ORDNER, { recursive: true });

try {
  // ---------- (a) Datenbank sichern ----------
  await schritt(1, DB_MODUS === "direkt"
    ? "pg_dump der Datenbank (Custom-Format) direkt auf dem PATH (CI, kein fw-dev-db)"
    : "pg_dump der Dev-Datenbank (Custom-Format) über docker exec", async () => {
    const puffer = DB_MODUS === "direkt"
      ? execFileSync("pg_dump", ["-d", DATABASE_URL, "-Fc"], { maxBuffer: 1024 * 1024 * 200 })
      : docker(["exec", CONTAINER, "pg_dump", "-U", "fourwalls", "-Fc", "-d", DBNAME]);
    writeFileSync(DUMP_DATEI, puffer);
    dbBefund.dumpBytes = puffer.length;
    return `${DUMP_DATEI} (${puffer.length} Bytes)`;
  });

  // ---------- (b) Wegwerf-DB anlegen, Sicherung hineinspielen ----------
  await schritt(2, `Wegwerf-Datenbank ${RESTORE_DB} anlegen`, async () => {
    await wartung.unsafe(`CREATE DATABASE "${RESTORE_DB}" OWNER fourwalls`);
    return RESTORE_DB;
  });

  await schritt(3, DB_MODUS === "direkt"
    ? "Sicherung in die Wegwerf-Datenbank einspielen (scripts/db-restore.sh, direkt auf dem PATH)"
    : "Sicherung in die Wegwerf-Datenbank einspielen (scripts/db-restore.sh, im Container)", async () => {
    const zielUrl = DATABASE_URL.replace(/\/[^/?]+(\?.*)?$/, `/${RESTORE_DB}`);
    if (DB_MODUS === "direkt") {
      const ausgabe = execFileSync("bash", [join(HIER, "db-restore.sh"), DUMP_DATEI, zielUrl], { encoding: "utf8", maxBuffer: 1024 * 1024 * 200 });
      return ausgabe.trim().split("\n").pop();
    }
    const dumpImContainer = `/tmp/katastrophen-test-${TS}.dump`;
    const skriptImContainer = `/tmp/db-restore-${TS}.sh`;
    docker(["cp", DUMP_DATEI, `${CONTAINER}:${dumpImContainer}`]);
    docker(["cp", join(HIER, "db-restore.sh"), `${CONTAINER}:${skriptImContainer}`]);
    const zielUrlImContainer = `postgresql://fourwalls:fourwalls_dev@localhost:5432/${RESTORE_DB}`;
    const ausgabe = docker(["exec", CONTAINER, "bash", skriptImContainer, dumpImContainer, zielUrlImContainer], { encoding: "utf8" });
    docker(["exec", CONTAINER, "rm", "-f", dumpImContainer, skriptImContainer]);
    return ausgabe.trim().split("\n").pop();
  });

  restoreSql = postgres(DATABASE_URL.replace(/\/[^/?]+(\?.*)?$/, `/${RESTORE_DB}`), { max: 2, onnotice: () => {} });

  // ---------- (c) Vergleich kritischer Kategorien ----------
  await schritt(4, "Zeilenzahlen kritischer Tabellen vergleichen", async () => {
    const abweichungen = [];
    for (const tabelle of KRITISCHE_TABELLEN) {
      const [{ n: nOriginal }] = await original.unsafe(`SELECT count(*)::int AS n FROM ${tabelle}`);
      const [{ n: nRestore }] = await restoreSql.unsafe(`SELECT count(*)::int AS n FROM ${tabelle}`);
      dbBefund.tabellen[tabelle] = { original: nOriginal, restore: nRestore };
      if (nOriginal !== nRestore) abweichungen.push(`${tabelle}: ${nOriginal} ≠ ${nRestore}`);
    }
    if (abweichungen.length) throw new Error(abweichungen.join("; "));
    return KRITISCHE_TABELLEN.map(t => `${t}=${dbBefund.tabellen[t].original}`).join(", ");
  });

  await schritt(5, "Summe: Anzahl veröffentlichter Inserate (count published)", async () => {
    const [{ n: nOriginal }] = await original`SELECT count(*)::int AS n FROM listing WHERE status = 'published'`;
    const [{ n: nRestore }] = await restoreSql`SELECT count(*)::int AS n FROM listing WHERE status = 'published'`;
    dbBefund.tabellen["listing.published"] = { original: nOriginal, restore: nRestore };
    if (nOriginal !== nRestore) throw new Error(`published: ${nOriginal} ≠ ${nRestore}`);
    return `published=${nOriginal}`;
  });

  await schritt(6, "Prüfsummen: md5 über sortierte public_refs je Tabelle mit public_ref", async () => {
    const tabellenMitRef = await original`
      SELECT table_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'public_ref' ORDER BY table_name`;
    const abweichungen = [];
    for (const { table_name: tabelle } of tabellenMitRef) {
      const [{ md5: md5Original }] = await original.unsafe(
        `SELECT md5(coalesce(string_agg(public_ref, ',' ORDER BY public_ref), '')) AS md5 FROM ${tabelle}`);
      const [{ md5: md5Restore }] = await restoreSql.unsafe(
        `SELECT md5(coalesce(string_agg(public_ref, ',' ORDER BY public_ref), '')) AS md5 FROM ${tabelle}`);
      dbBefund.tabellen[`${tabelle}.md5(public_ref)`] = { original: md5Original, restore: md5Restore };
      if (md5Original !== md5Restore) abweichungen.push(tabelle);
    }
    if (abweichungen.length) throw new Error(`Prüfsumme weicht ab: ${abweichungen.join(", ")}`);
    return `${tabellenMitRef.length} Tabelle(n) mit public_ref, alle Prüfsummen gleich`;
  });

  await schritt(7, "Öffentliche Sicht listing_public funktioniert nach der Wiederherstellung", async () => {
    const [{ n: nOriginal }] = await original`SELECT count(*)::int AS n FROM listing_public`;
    const [{ n: nRestore }] = await restoreSql`SELECT count(*)::int AS n FROM listing_public`;
    dbBefund.tabellen["listing_public"] = { original: nOriginal, restore: nRestore };
    if (nOriginal !== nRestore) throw new Error(`listing_public: ${nOriginal} ≠ ${nRestore}`);
    return `listing_public=${nOriginal}`;
  });

  await schritt(8, "Migrationsstand identisch (schema_migration)", async () => {
    const namenOriginal = (await original`SELECT name FROM schema_migration ORDER BY name`).map(r => r.name);
    const namenRestore = (await restoreSql`SELECT name FROM schema_migration ORDER BY name`).map(r => r.name);
    if (JSON.stringify(namenOriginal) !== JSON.stringify(namenRestore)) {
      throw new Error(`Migrationsstand weicht ab: ${namenOriginal.length} ≠ ${namenRestore.length} Migration(en)`);
    }
    return `${namenOriginal.length} Migration(en), identisch`;
  });

  dbBefund.vergleich = "identisch";
} finally {
  // ---------- (d) Wegwerf-DB löschen ----------
  if (restoreSql) await restoreSql.end();
  try {
    await schritt(9, `Wegwerf-Datenbank ${RESTORE_DB} löschen`, async () => {
      await wartung.unsafe(`DROP DATABASE IF EXISTS "${RESTORE_DB}"`);
      return "gelöscht";
    });
  } catch { /* bereits im Bericht vermerkt */ }
  await wartung.end();
  await original.end();
}

// ---------- (e) Objektspeicher ----------
if (!SPEICHER_AKTIV) {
  console.log("Objektspeicher übersprungen (FW_KATASTROPHE_SPEICHER=aus) — nur der Datenbankteil (Schritte 1–9) lief.");
} else {
const s3 = clientAusUmgebung();
const testSchluessel = `restore-test/${TS}.txt`;
const testInhalt = `FOURWALLS Katastrophentest ${TS}\n`;

try {
  await schritt(10, `Testobjekt hochladen (${testSchluessel}) in ${S3_BUCKET_PUBLIC}`, async () => {
    await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET_PUBLIC, Key: testSchluessel, Body: testInhalt }));
    return testSchluessel;
  });

  const manifestPrivat = await schritt(11, `Bucket-Inventar + Sicherung: ${S3_BUCKET_PRIVATE} → ${S3_BACKUP_ORDNER}/privat`, async () => {
    const m = await sichern(s3, S3_BUCKET_PRIVATE, join(S3_BACKUP_ORDNER, "privat"));
    return `${m.objekte.length} Objekt(e)`;
  });
  const manifestOeffentlich = await schritt(12, `Bucket-Inventar + Sicherung: ${S3_BUCKET_PUBLIC} → ${S3_BACKUP_ORDNER}/oeffentlich`, async () => {
    const m = await sichern(s3, S3_BUCKET_PUBLIC, join(S3_BACKUP_ORDNER, "oeffentlich"));
    return `${m.objekte.length} Objekt(e), inkl. Testobjekt`;
  });
  const inventarPrivat = JSON.parse(readFileSync(join(S3_BACKUP_ORDNER, "privat", "inventar.json"), "utf8"));
  const inventarOeffentlich = JSON.parse(readFileSync(join(S3_BACKUP_ORDNER, "oeffentlich", "inventar.json"), "utf8"));
  speicherBefund.objekte = inventarPrivat.objekte.length + inventarOeffentlich.objekte.length;
  void manifestPrivat; void manifestOeffentlich;

  await schritt(13, `Wegwerf-Behälter ${RESTORE_BUCKET} anlegen`, async () => {
    await s3.send(new CreateBucketCommand({ Bucket: RESTORE_BUCKET }));
    return RESTORE_BUCKET;
  });

  await schritt(14, "Wiederherstellung beider Behälter in den Wegwerf-Behälter (privat/ und oeffentlich/ als Präfix)", async () => {
    const hochPrivat = await wiederherstellen(s3, RESTORE_BUCKET, join(S3_BACKUP_ORDNER, "privat"), "privat/");
    const hochOeffentlich = await wiederherstellen(s3, RESTORE_BUCKET, join(S3_BACKUP_ORDNER, "oeffentlich"), "oeffentlich/");
    return `${hochPrivat.length + hochOeffentlich.length} Objekt(e) wiederhergestellt`;
  });

  await schritt(15, "Vergleich: Existenz, Grösse, ETag — Wegwerf-Behälter gegen Original", async () => {
    const befundePrivat = await vergleichen(s3, RESTORE_BUCKET, join(S3_BACKUP_ORDNER, "privat"), "privat/");
    const befundeOeffentlich = await vergleichen(s3, RESTORE_BUCKET, join(S3_BACKUP_ORDNER, "oeffentlich"), "oeffentlich/");
    const alle = [...befundePrivat, ...befundeOeffentlich];
    const abweichend = alle.filter(b => !b.gleich);
    if (abweichend.length) throw new Error(`${abweichend.length} von ${alle.length} Objekt(en) weichen ab: ${abweichend.slice(0, 5).map(b => b.schluessel).join(", ")}`);
    return `${alle.length} von ${alle.length} Objekt(en) stimmen überein (Existenz, Grösse, ETag)`;
  });

  await schritt(16, "Ausfall beweisen: Testobjekt im echten Behälter löschen, Abruf schlägt fehl", async () => {
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET_PUBLIC, Key: testSchluessel }));
    try {
      await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET_PUBLIC, Key: testSchluessel }));
      throw new Error("Abruf ist nach dem Löschen unerwartet gelungen");
    } catch (e) {
      const code = e?.name || e?.Code;
      if (code !== "NoSuchKey" && code !== "NotFound") throw e;
      return `Abruf schlägt wie erwartet fehl (${code})`;
    }
  });

  await schritt(17, "Aus der Sicherung zurückspielen: Testobjekt wiederherstellen, Abruf gelingt wieder", async () => {
    const inhalt = readFileSync(join(S3_BACKUP_ORDNER, "oeffentlich", testSchluessel));
    await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET_PUBLIC, Key: testSchluessel, Body: inhalt }));
    const antwort = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET_PUBLIC, Key: testSchluessel }));
    const gelesen = Buffer.concat(await (async () => {
      const teile = []; for await (const t of antwort.Body) teile.push(t); return teile;
    })());
    if (gelesen.toString("utf8") !== testInhalt) throw new Error("Wiederhergestellter Inhalt weicht vom Original ab");
    speicherBefund.wiederhergestellt = true;
    return "Inhalt stimmt mit dem Original überein";
  });
} finally {
  // ---------- Aufräumen: Wegwerf-Behälter + Testobjekt ----------
  try {
    await schritt(18, `Aufräumen: ${RESTORE_BUCKET} leeren+löschen, Testobjekt aus ${S3_BUCKET_PUBLIC} entfernen`, async () => {
      const inhalt = await inventar(s3, RESTORE_BUCKET);
      for (const o of inhalt) await s3.send(new DeleteObjectCommand({ Bucket: RESTORE_BUCKET, Key: o.schluessel }));
      await s3.send(new DeleteBucketCommand({ Bucket: RESTORE_BUCKET }));
      await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET_PUBLIC, Key: testSchluessel }));
      return `${inhalt.length} Objekt(e) + Behälter entfernt, Testobjekt entfernt`;
    });
  } catch { /* bereits im Bericht vermerkt */ }
}
}

// ---------- Nachweis + Bericht schreiben ----------
const fehlgeschlagen = ergebnisse.filter(e => e.status === "FEHLER");

const nachweis = {
  datum: now.toISOString(),
  db: dbBefund,
  speicher: speicherBefund,
  werkzeug: "scripts/katastrophen-test.mjs"
};
mkdirSync(dirname(NACHWEIS_DATEI), { recursive: true });
writeFileSync(NACHWEIS_DATEI, JSON.stringify(nachweis, null, 2) + "\n");

const berichtZeilen = [
  `# Katastrophentest — ${now.toISOString()}`,
  "",
  `Datenbank: \`${DBNAME}\` · Wegwerf-DB: \`${RESTORE_DB}\` · Wegwerf-Behälter: \`${RESTORE_BUCKET}\``,
  "",
  "## Schritte",
  "",
  "| # | Schritt | Status | Detail |",
  "|---|---------|--------|--------|",
  ...ergebnisse.map(e => `| ${e.nr} | ${e.titel} | ${e.status} | ${String(e.detail).replaceAll("|", "\\|")} |`),
  "",
  "## Datenbank — Vergleich Original vs. Wiederherstellung",
  "",
  "| Kategorie | Original | Wiederherstellung |",
  "|-----------|----------|--------------------|",
  ...Object.entries(dbBefund.tabellen).map(([k, v]) => `| ${k} | ${v.original} | ${v.restore} |`),
  "",
  `Ergebnis: **${dbBefund.vergleich}**. Sicherung: \`${DUMP_DATEI}\` (${dbBefund.dumpBytes} Bytes).`,
  "",
  "## Objektspeicher",
  "",
  `${speicherBefund.objekte} Objekt(e) gesichert nach \`${S3_BACKUP_ORDNER}\`. Testobjekt gelöscht und aus der Sicherung wiederhergestellt: **${speicherBefund.wiederhergestellt ? "ja" : "nein"}**.`,
  "",
  `Siehe auch: db/RESTORE.md (Befehle), docs/backup-nachweis.json (maschinenlesbar).`
];
writeFileSync(BERICHT_DATEI, berichtZeilen.join("\n") + "\n");

console.log("");
console.log(`Bericht: ${BERICHT_DATEI}`);
console.log(`Nachweis: ${NACHWEIS_DATEI}`);
console.log(fehlgeschlagen.length ? `${fehlgeschlagen.length} Schritt(e) fehlgeschlagen.` : "Alle Schritte erfolgreich.");
process.exit(fehlgeschlagen.length ? 1 : 0);
