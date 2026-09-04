#!/usr/bin/env node
/* Demo-Bilder in den ÖFFENTLICHEN Behälter laden (Präfix demo/), damit der
   Demo-Bestand auch mit STORAGE_PROVIDER=s3 Bilder hat. Quelle: public/media.
   Idempotent: vorhandene Objekte gleicher Grösse werden übersprungen.
   Aufruf: S3_* gesetzt, dann  node scripts/demo-medien-hochladen.mjs */
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const e = process.env;
for (const k of ["S3_ENDPOINT", "S3_BUCKET_PUBLIC", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) if (!e[k]) { console.error(k + " fehlt"); process.exit(2); }
const client = new S3Client({ endpoint: e.S3_ENDPOINT, region: e.S3_REGION ?? "ch-gva-2", forcePathStyle: e.S3_FORCE_PATH_STYLE === "ja",
  credentials: { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY } });
const ordner = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "media");
const TYP = { jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", png: "image/png", avif: "image/avif" };
let neu = 0, gleich = 0;
for (const f of readdirSync(ordner).filter(f => /^[a-z0-9][a-z0-9._-]*\.(jpg|jpeg|webp|png|avif)$/i.test(f))) {
  const key = "demo/" + f, groesse = statSync(join(ordner, f)).size;
  try { const h = await client.send(new HeadObjectCommand({ Bucket: e.S3_BUCKET_PUBLIC, Key: key })); if (h.ContentLength === groesse) { gleich++; continue; } } catch { /* fehlt */ }
  await client.send(new PutObjectCommand({ Bucket: e.S3_BUCKET_PUBLIC, Key: key, Body: readFileSync(join(ordner, f)),
    ContentType: TYP[f.split(".").pop().toLowerCase()], CacheControl: "public, max-age=31536000, immutable" }));
  neu++;
}
console.log(`Demo-Bilder: ${neu} hochgeladen, ${gleich} bereits vorhanden`);
