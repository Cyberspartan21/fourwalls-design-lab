#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Staging-Reset (P5.5 §53/§54/§63)

   Räumt nach einem Prüflauf gegen Staging auf: entfernt alle Konten mit
   auth_account, deren E-Mail NICHT in FW_KEEP_ACCOUNTS steht, samt ihren
   Inseraten und Medien (inkl. der Objekte im Speicher). Läuft gegen
   DATABASE_URL — verändert nichts an der laufenden Anwendung.

   Aufruf:
     set -a; . ./.env.local; set +a
     FW_KEEP_ACCOUNTS=anna.beispiel@example.com,mod@fourwalls.example \
       node scripts/staging-reset.mjs                 Trockenlauf (Standard)
     FW_KEEP_ACCOUNTS=... node scripts/staging-reset.mjs --ja   echte Löschung

   Regeln:
     - Demo-Inserate (listing.is_demo = true) werden NIE angefasst.
     - audit_log-Zeilen bleiben stehen (Fremdschlüssel!). Ein Konto, das in
       audit_log.actor_user_id referenziert ist (hat je eine Statusänderung
       ausgelöst — Einreichen, Moderation, …), wird NICHT gelöscht, nur
       seine Inserate und Medien. Das Skript meldet das je Konto («Konto
       bleibt — Prüfspur»).
     - Objekte im Speicher: bei STORAGE_PROVIDER=s3 direkt per
       @aws-sdk/client-s3 (DeleteObjectCommand; Behälter nach Präfix wie in
       lib/speicherschluessel.ts: pub/, demo/ → S3_BUCKET_PUBLIC, sonst
       S3_BUCKET_PRIVATE), bei local Dateien unter var/uploads bzw. public/pub.
     - Keine Passwörter, keine Geheimnisse in der Ausgabe.

   Umgebung:
     DATABASE_URL          Pflicht
     FW_KEEP_ACCOUNTS       kommagetrennte Liste von E-Mail-Adressen, die
                             unangetastet bleiben
     STORAGE_PROVIDER       local (Standard) | s3 — wie in server/env.ts
     S3_ENDPOINT/_REGION/_BUCKET_PRIVATE/_BUCKET_PUBLIC/
     _ACCESS_KEY_ID/_SECRET_ACCESS_KEY/_FORCE_PATH_STYLE   nur bei s3, wie in server/env.ts

   Läuft ohne den "@/"-Alias und ohne server-only — reines Skript.
   ============================================================ */
import postgres from "postgres";
import { existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bereichVon } from "../lib/speicherschluessel.ts";

const HIER = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HIER, "..");

const argv = process.argv.slice(2);
const ECHT = argv.includes("--ja");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a)"); process.exit(2); }
const sql = postgres(DATABASE_URL, { max: 4, onnotice: () => {} });

const KEEP = new Set(
  (process.env.FW_KEEP_ACCOUNTS || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
);

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || "local";

/* ---------- Objektspeicher: dieselbe Präfixregel wie services/storage.ts,
   hier eigenständig (kein Laufzeit-Import aus services/, das server-only trägt) ---------- */
function localPfadVon(storageKey) {
  if (bereichVon(storageKey) === "privat") {
    return join(APP_ROOT, "var", "uploads", storageKey.replace(/^(orig|upload)\//, ""));
  }
  return join(APP_ROOT, "public", storageKey.replace(/^demo\//, "media/"));
}
function localLoeschen(storageKey) {
  const pfad = localPfadVon(storageKey);
  if (!existsSync(pfad)) return false;
  rmSync(pfad, { force: true });
  return true;
}

let s3ClientInstanz = null;
async function s3Client() {
  if (s3ClientInstanz) return s3ClientInstanz;
  const { S3Client } = await import("@aws-sdk/client-s3");
  s3ClientInstanz = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "ch-gva-2",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "ja",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    }
  });
  return s3ClientInstanz;
}
async function s3Loeschen(storageKey) {
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const bucket = bereichVon(storageKey) === "privat" ? process.env.S3_BUCKET_PRIVATE : process.env.S3_BUCKET_PUBLIC;
  if (!bucket) throw new Error(`Kein Behälter für ${storageKey} (S3_BUCKET_PRIVATE/S3_BUCKET_PUBLIC gesetzt?)`);
  const client = await s3Client();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
}
async function objektLoeschen(storageKey) {
  return STORAGE_PROVIDER === "s3" ? s3Loeschen(storageKey) : localLoeschen(storageKey);
}

/* ---------- Kleine Tabellenausgabe ---------- */
function tabelle(titel, zeilen, spalten) {
  console.log(`\n${titel}`);
  if (!zeilen.length) { console.log("  (keine)"); return; }
  const breiten = spalten.map(s => Math.max(s.titel.length, ...zeilen.map(z => String(z[s.feld] ?? "").length)));
  const zeile = werte => werte.map((w, i) => String(w).padEnd(breiten[i])).join("  ");
  console.log("  " + zeile(spalten.map(s => s.titel)));
  console.log("  " + breiten.map(b => "-".repeat(b)).join("  "));
  for (const z of zeilen) console.log("  " + zeile(spalten.map(s => z[s.feld] ?? "")));
}

console.log(`Staging-Reset — ${ECHT ? "ECHTE LÖSCHUNG (--ja)" : "TROCKENLAUF (Standard — mit --ja wirklich löschen)"}`);
console.log(`Speicher: ${STORAGE_PROVIDER}`);
console.log(`Behalten (FW_KEEP_ACCOUNTS): ${KEEP.size ? [...KEEP].join(", ") : "(keine Angabe — kein Konto ist bewusst ausgenommen)"}`);

/* ---------- Kandidaten: Konten mit auth_account, nicht in FW_KEEP_ACCOUNTS ---------- */
const alleKonten = await sql`
  SELECT DISTINCT u.id, u.email, u.platform_role
    FROM app_user u
    JOIN auth_account aa ON aa.user_id = u.id
   WHERE u.deleted_at IS NULL
   ORDER BY u.email`;

const zuBearbeiten = alleKonten.filter(k => !KEEP.has(String(k.email).toLowerCase()));
const behalten = alleKonten.filter(k => KEEP.has(String(k.email).toLowerCase()));

if (behalten.length) {
  console.log(`\nUnangetastet wegen FW_KEEP_ACCOUNTS (${behalten.length}):`);
  for (const k of behalten) console.log(`  ${k.email}`);
}

if (!zuBearbeiten.length) {
  console.log("\nKeine Konten zum Aufräumen gefunden.");
  await sql.end();
  process.exit(0);
}

/* ---------- Konten, die im Prüfpfad referenziert sind: Konto bleibt, nur Inhalt weg ---------- */
const referenzZeilen = await sql`
  SELECT DISTINCT actor_user_id AS id FROM audit_log
   WHERE actor_user_id = ANY(${zuBearbeiten.map(k => k.id)})`;
const referenzierteIds = new Set(referenzZeilen.map(r => String(r.id)));

/* ---------- Je Konto sammeln: Inserate (nie Demo) und hochgeladene Medien ---------- */
const konten = [];
for (const konto of zuBearbeiten) {
  const listings = await sql`
    SELECT id, public_ref, status, is_demo FROM listing
     WHERE published_by_user_id = ${konto.id} AND is_demo = false`;

  const medien = await sql`
    SELECT id, storage_key FROM media_asset WHERE uploaded_by = ${konto.id}`;
  const varianten = medien.length
    ? await sql`SELECT storage_key FROM media_variant WHERE asset_id = ANY(${medien.map(m => m.id)})`
    : [];

  const storageKeys = new Set([...medien.map(m => m.storage_key), ...varianten.map(v => v.storage_key)]);

  konten.push({
    id: konto.id,
    email: konto.email,
    rolle: konto.platform_role,
    listings,
    medienAnzahl: medien.length,
    storageKeys,
    bleibtWegenPruefspur: referenzierteIds.has(String(konto.id))
  });
}

/* ---------- Bericht ---------- */
for (const k of konten) k._inserateAnzahl = k.listings.length;
tabelle("Konten", konten, [
  { titel: "E-Mail", feld: "email" },
  { titel: "Rolle", feld: "rolle" },
  { titel: "Inserate", feld: "_inserateAnzahl" },
  { titel: "Medien", feld: "medienAnzahl" },
  { titel: "Konto bleibt (Prüfspur)", feld: "bleibtWegenPruefspur" }
]);

const alleListings = konten.flatMap(k => k.listings.map(l => ({ konto: k.email, publicRef: l.public_ref, status: l.status })));
tabelle("Inserate", alleListings, [
  { titel: "Konto", feld: "konto" },
  { titel: "Referenz", feld: "publicRef" },
  { titel: "Status", feld: "status" }
]);

const alleStorageKeys = new Set(konten.flatMap(k => [...k.storageKeys]));
console.log(`\nSpeicherobjekte (Original + Ableitungen): ${alleStorageKeys.size}`);
for (const s of [...alleStorageKeys].sort()) console.log(`  ${s}`);

if (!ECHT) {
  console.log("\nTrockenlauf — nichts wurde gelöscht. Mit --ja ausführen, um wirklich zu löschen.");
  await sql.end();
  process.exit(0);
}

/* ============================================================
   ECHTE LÖSCHUNG — je Konto in einer eigenen Transaktion, damit ein
   Fremdschlüsselfehler bei einem Konto die anderen nicht blockiert.
   ============================================================ */
console.log("\nLösche jetzt …");
let fehlerAnzahl = 0;

for (const k of konten) {
  try {
    await sql.begin(async tx => {
      /* Inserate (nie Demo) löschen — kaskadiert listing_image, floorplan,
         listing_document, viewing (siehe db/migrations 0004/0005/0006). */
      await tx`DELETE FROM listing WHERE published_by_user_id = ${k.id} AND is_demo = false`;

      /* Medien dieses Kontos löschen — media_variant kaskadiert mit. */
      await tx`DELETE FROM media_asset WHERE uploaded_by = ${k.id}`;

      if (!k.bleibtWegenPruefspur) {
        /* Anfragen, die dieses Konto gesendet oder empfangen hat — sonst
           blockiert die Fremdschlüsselprüfung das Löschen des Kontos. */
        await tx`DELETE FROM inquiry WHERE sender_user_id = ${k.id} OR recipient_user_id = ${k.id}`;
        /* auth_account, auth_session, document_grant u. a. kaskadieren mit
           (ON DELETE CASCADE, siehe db/migrations 0011/0005/0006). */
        await tx`DELETE FROM app_user WHERE id = ${k.id}`;
      }
    });

    /* Objekte im Speicher erst nach erfolgreicher DB-Löschung entfernen. */
    for (const storageKey of k.storageKeys) {
      try { await objektLoeschen(storageKey); }
      catch (e) { console.log(`    Speicherobjekt nicht gelöscht: ${storageKey} — ${e.message}`); }
    }

    console.log(`  OK      ${k.email}${k.bleibtWegenPruefspur ? " (Konto bleibt — Prüfspur)" : " (Konto entfernt)"} — ${k.listings.length} Inserat(e), ${k.medienAnzahl} Medienobjekt(e)`);
  } catch (e) {
    fehlerAnzahl++;
    console.log(`  FEHLER  ${k.email} — ${e.message}`);
  }
}

console.log(`\n${konten.length} Konten bearbeitet, ${fehlerAnzahl} FEHLER, ${konten.length - fehlerAnzahl} OK`);

await sql.end();
process.exit(fehlerAnzahl > 0 ? 1 : 0);
