#!/usr/bin/env node
/* ============================================================
   FOURWALLS — MEDIEN NACHZIEHEN (P5.4 → P5.5)

   Der P5.4-Stand speicherte je Upload EINE Datei unter upload/<uuid>.<ext>
   (var/uploads/<uuid>.<ext>) mit genau einer media_variant-Zeile, deren
   storage_key ebenfalls upload/… ist. P5.5 erwartet orig/<uuid>.<ext> plus
   Ableitungen abl/<uuid>/<breite>.<jpg|webp> (unveröffentlicht) bzw.
   pub/<uuid>/<breite>.<fmt> (Inserat published/reserved).

   Dieses Skript zieht jeden Altbestand (storage_key LIKE 'upload/%') nach:
   liest die Originaldatei, leitet sie wie services/bilder.ts ab (Kopie der
   Logik — das Modul selbst ist TS mit Aliassen und hier nicht importierbar),
   entscheidet anhand der Inserats-Bindung (listing.status) zwischen abl/ und
   pub/, schreibt die Ableitungen und aktualisiert media_asset/media_variant
   in einer Transaktion je Asset.

   Läuft nur gegen STORAGE_PROVIDER=local — der P5.4-Altbestand existierte nur
   lokal. Standard: Trockenlauf (nur Anzeige). --ja schreibt tatsächlich.
   Idempotent: ein zweiter Lauf findet keinen upload/%-Bestand mehr.

     node scripts/medien-nachziehen.mjs           Trockenlauf
     node scripts/medien-nachziehen.mjs --ja       schreibt
   ============================================================ */

import postgres from "postgres";
import sharp from "sharp";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

const cwd = process.cwd();
const argv = new Set(process.argv.slice(2));
const schreiben = argv.has("--ja");

const provider = process.env.STORAGE_PROVIDER ?? "local";
if (provider !== "local") {
  console.error(`STORAGE_PROVIDER=${provider} — dieses Skript zieht nur den lokalen P5.4-Altbestand nach und läuft nur bei STORAGE_PROVIDER=local.`);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL fehlt"); process.exit(1); }

const sql = postgres(url, { max: 1, onnotice: () => {} });

/* ---------- Ableitung — Kopie aus services/bilder.ts ---------- */

const BREITEN = [480, 960, 1600, 2400];
const ERLAUBTE_FORMATE = new Set(["jpeg", "png", "webp"]);
const EXT_VARIANTE = { jpeg: "jpg", webp: "webp" };

async function ableiten(roh) {
  const quelle = sharp(roh, { limitInputPixels: 40_000_000, failOn: "error" });
  const meta = await quelle.metadata();
  if (!meta.format || !ERLAUBTE_FORMATE.has(meta.format)) throw new Error("Bild nicht dekodierbar");

  const orientierung = meta.orientation ?? 1;
  const vertauscht = orientierung >= 5 && orientierung <= 8;
  const rohBreite = vertauscht ? (meta.height ?? 0) : (meta.width ?? 0);
  const rohHoehe = vertauscht ? (meta.width ?? 0) : (meta.height ?? 0);
  if (!rohBreite || !rohHoehe) throw new Error("Bild nicht dekodierbar");

  const skala = Math.min(1, 2400 / rohBreite, 2400 / rohHoehe);
  const zielBreite = Math.max(1, Math.round(rohBreite * skala));
  const zielHoehe = Math.max(1, Math.round(rohHoehe * skala));

  const basis = sharp(roh, { limitInputPixels: 40_000_000, failOn: "error" })
    .rotate()
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true });

  let zielBreiten = BREITEN.filter(b => b <= zielBreite);
  if (!zielBreiten.length) zielBreiten = [480];

  const varianten = [];
  for (const b of zielBreiten) {
    const enlarge = b > zielBreite;
    const webp = await basis.clone().resize({ width: b, withoutEnlargement: !enlarge }).webp({ quality: 80 }).toBuffer();
    varianten.push({ breite: b, format: "webp", bytes: new Uint8Array(webp) });
    const jpeg = await basis.clone().resize({ width: b, withoutEnlargement: !enlarge }).jpeg({ quality: 82, mozjpeg: true, progressive: true }).toBuffer();
    varianten.push({ breite: b, format: "jpeg", bytes: new Uint8Array(jpeg) });
  }

  return { breite: zielBreite, hoehe: zielHoehe, varianten };
}

/* ---------- Hauptlauf ---------- */

async function main() {
  const assets = await sql`SELECT id, storage_key, mime_type FROM media_asset WHERE storage_key LIKE ${"upload/%"} ORDER BY created_at`;
  if (!assets.length) {
    console.log("Nichts zu tun — kein P5.4-Altbestand (storage_key LIKE 'upload/%') gefunden.");
    return;
  }

  console.log(schreiben ? "Schreibe …" : "Trockenlauf (--ja schreibt tatsächlich):");
  console.log();

  let bearbeitet = 0;
  for (const asset of assets) {
    const id = String(asset.id);
    const alterKey = String(asset.storage_key);
    const ext = alterKey.split(".").pop();
    const dateiPfad = join(cwd, "var", "uploads", `${id}.${ext}`);

    let roh;
    try {
      roh = await readFile(dateiPfad);
    } catch {
      console.error(`${id}  Datei fehlt (${dateiPfad}) — übersprungen`);
      continue;
    }

    let abgeleitet;
    try {
      abgeleitet = await ableiten(new Uint8Array(roh));
    } catch (e) {
      console.error(`${id}  nicht ableitbar (${e.message}) — übersprungen`);
      continue;
    }

    const bindungen = await sql`
      SELECT l.id, l.status FROM listing_image li JOIN listing l ON l.id = li.listing_id
       WHERE li.asset_id = ${id}`;
    const veroeffentlicht = bindungen.some(b => b.status === "published" || b.status === "reserved");
    const praefix = veroeffentlicht ? "pub" : "abl";
    const bindungsText = bindungen.length
      ? [...new Set(bindungen.map(b => b.status))].join(", ")
      : "kein Inserat";

    const neuerOrigKey = `orig/${id}.${ext}`;
    const varianten = abgeleitet.varianten.map(v => ({
      breite: v.breite, format: v.format, bytes: v.bytes,
      key: `${praefix}/${id}/${v.breite}.${EXT_VARIANTE[v.format]}`
    }));
    const gesamtBytes = varianten.reduce((s, v) => s + v.bytes.byteLength, 0);

    console.log(`${id}  gebunden an: ${bindungsText}  →  ${praefix}/  ${varianten.length} Varianten  ${gesamtBytes} Bytes`);

    if (!schreiben) continue;

    for (const v of varianten) {
      const zielPfad = praefix === "pub"
        ? join(cwd, "public", "pub", id, `${v.breite}.${EXT_VARIANTE[v.format]}`)
        : join(cwd, "var", "uploads", "abl", id, `${v.breite}.${EXT_VARIANTE[v.format]}`);
      await mkdir(dirname(zielPfad), { recursive: true });
      await writeFile(zielPfad, v.bytes);
    }

    await sql.begin(async tx => {
      await tx`UPDATE media_asset SET storage_key = ${neuerOrigKey}, width = ${abgeleitet.breite}, height = ${abgeleitet.hoehe} WHERE id = ${id}`;
      await tx`DELETE FROM media_variant WHERE asset_id = ${id}`;
      for (const v of varianten) {
        await tx`INSERT INTO media_variant (asset_id, storage_key, width, format, byte_size)
                 VALUES (${id}, ${v.key}, ${v.breite}, ${v.format}, ${v.bytes.byteLength})`;
      }
    });

    bearbeitet++;
  }

  console.log();
  if (!schreiben) console.log(`${assets.length} Altbestände gefunden. Mit --ja schreiben.`);
  else console.log(`${bearbeitet} von ${assets.length} Assets nachgezogen.`);
}

try {
  await main();
} finally {
  await sql.end();
}
