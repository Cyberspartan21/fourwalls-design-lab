#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Objektspeicher: Sichern, Wiederherstellen, Vergleichen
   (P5.10 §20). S3-kompatibel (Exoscale SOS, MinIO, …) über @aws-sdk/client-s3
   — der Anbieter steckt nur in Endpunkt und Zugangsdaten (P5.5 §5).

   Sowohl Bibliothek (Funktionen, von scripts/katastrophen-test.mjs
   importiert) als auch eigenständiges Betriebsskript für die Befehlszeile:

     node scripts/speicher-backup.mjs sichern <behaelter> <zielordner> [praefix]
     node scripts/speicher-backup.mjs wiederherstellen <zielordner> <ziel-behaelter> [schluessel-praefix]
     node scripts/speicher-backup.mjs vergleichen <behaelter> <zielordner> [schluessel-praefix]

   Liest die S3-Zugangsdaten direkt aus process.env (S3_ENDPOINT, S3_REGION,
   S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE) — dies ist ein
   eigenständiges Betriebsskript, kein Teil der Anwendung (dort gilt env()
   aus server/env.ts). Keine stillschweigenden Entwicklungswerte: fehlt eine
   Pflichtvariable, bricht das Skript sofort ab (fail closed, wie
   scripts/s3-buckets.mjs).

   "sichern" lädt jedes Objekt eines Behälters (optional nur unter einem
   Präfix) unverändert auf die Platte, in <zielordner>/<schluessel>, und
   schreibt <zielordner>/inventar.json (Schlüssel, Grösse, ETag, Quellbehälter
   — die Grundlage für den späteren Vergleich). "wiederherstellen" spielt
   genau das in einen (in der Regel anderen) Behälter zurück. "vergleichen"
   prüft Existenz, Grösse und ETag jedes gesicherten Objekts gegen einen
   Behälter — unabhängig vom eigentlichen Wiederherstellen nutzbar, z. B. um
   zu beweisen, dass ein einzelnes gelöschtes Objekt nach dem Zurückspielen
   wieder da ist.
   ============================================================ */
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand
} from "@aws-sdk/client-s3";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function pflicht(name) {
  const wert = process.env[name];
  if (!wert) throw new Error(`${name} fehlt`);
  return wert;
}

export function clientAusUmgebung() {
  return new S3Client({
    endpoint: pflicht("S3_ENDPOINT"),
    region: process.env.S3_REGION || "ch-gva-2",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "ja",
    credentials: {
      accessKeyId: pflicht("S3_ACCESS_KEY_ID"),
      secretAccessKey: pflicht("S3_SECRET_ACCESS_KEY")
    }
  });
}

/* Alle Objektschlüssel eines Behälters (optional unter einem Präfix), mit
   Grösse und ETag — über alle Seiten hinweg. */
export async function inventar(client, behaelter, praefix) {
  const eintraege = [];
  let token;
  do {
    const antwort = await client.send(new ListObjectsV2Command({
      Bucket: behaelter, Prefix: praefix || undefined, ContinuationToken: token
    }));
    for (const o of antwort.Contents || []) {
      eintraege.push({ schluessel: o.Key, groesse: o.Size ?? 0, etag: (o.ETag || "").replaceAll('"', "") });
    }
    token = antwort.IsTruncated ? antwort.NextContinuationToken : undefined;
  } while (token);
  return eintraege;
}

async function liesGanzenStream(body) {
  const teile = [];
  for await (const teil of body) teile.push(teil);
  return Buffer.concat(teile.map(t => (Buffer.isBuffer(t) ? t : Buffer.from(t))));
}

/* Lädt jedes Objekt aus `behaelter` (optional nur unter `praefix`) unverändert
   nach <zielordner>/<schluessel> und schreibt <zielordner>/inventar.json.
   Gibt das geschriebene Inventar zurück. */
export async function sichern(client, behaelter, zielordner, praefix) {
  const eintraege = await inventar(client, behaelter, praefix);
  for (const e of eintraege) {
    const antwort = await client.send(new GetObjectCommand({ Bucket: behaelter, Key: e.schluessel }));
    const inhalt = await liesGanzenStream(antwort.Body);
    const zielpfad = join(zielordner, e.schluessel);
    mkdirSync(dirname(zielpfad), { recursive: true });
    writeFileSync(zielpfad, inhalt);
  }
  const manifest = { behaelter, praefix: praefix || null, erzeugtAm: new Date().toISOString(), objekte: eintraege };
  mkdirSync(zielordner, { recursive: true });
  writeFileSync(join(zielordner, "inventar.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

/* Spielt ein zuvor mit sichern() erzeugtes Verzeichnis in einen (meist
   anderen) Behälter zurück. `schluesselPraefix` stellt den Objektschlüsseln
   im Zielbehälter optional ein weiteres Präfix voran (nützlich, wenn ein
   einzelner Wegwerf-Behälter mehrere gesicherte Quellbehälter aufnimmt). */
export async function wiederherstellen(client, zielBehaelter, zielordner, schluesselPraefix) {
  const manifest = JSON.parse(readFileSync(join(zielordner, "inventar.json"), "utf8"));
  const hochgeladen = [];
  for (const e of manifest.objekte) {
    const inhalt = readFileSync(join(zielordner, e.schluessel));
    const zielschluessel = schluesselPraefix ? `${schluesselPraefix}${e.schluessel}` : e.schluessel;
    await client.send(new PutObjectCommand({ Bucket: zielBehaelter, Key: zielschluessel, Body: inhalt }));
    hochgeladen.push(zielschluessel);
  }
  return hochgeladen;
}

/* Vergleicht jedes Objekt eines mit sichern() erzeugten Inventars gegen einen
   Behälter (Existenz, Grösse, ETag). `schluesselPraefix` wie bei
   wiederherstellen(). Wirft nichts — liefert eine Liste von Befunden. */
export async function vergleichen(client, behaelter, zielordner, schluesselPraefix) {
  const manifest = JSON.parse(readFileSync(join(zielordner, "inventar.json"), "utf8"));
  const befunde = [];
  for (const e of manifest.objekte) {
    const zielschluessel = schluesselPraefix ? `${schluesselPraefix}${e.schluessel}` : e.schluessel;
    try {
      const kopf = await client.send(new HeadObjectCommand({ Bucket: behaelter, Key: zielschluessel }));
      const etag = (kopf.ETag || "").replaceAll('"', "");
      const gleich = kopf.ContentLength === e.groesse && etag === e.etag;
      befunde.push({ schluessel: zielschluessel, vorhanden: true, gleich, erwarteteGroesse: e.groesse, gefundeneGroesse: kopf.ContentLength, erwartetesEtag: e.etag, gefundenesEtag: etag });
    } catch (fehler) {
      befunde.push({ schluessel: zielschluessel, vorhanden: false, gleich: false, fehler: fehler?.name ?? String(fehler) });
    }
  }
  return befunde;
}

/* ---------- Befehlszeile ---------- */
const HIER = fileURLToPath(import.meta.url);
if (process.argv[1] === HIER) {
  const [, , befehl, ...rest] = process.argv;
  try {
    const client = clientAusUmgebung();
    if (befehl === "sichern") {
      const [behaelter, zielordner, praefix] = rest;
      if (!behaelter || !zielordner) throw new Error("Aufruf: sichern <behaelter> <zielordner> [praefix]");
      const manifest = await sichern(client, behaelter, zielordner, praefix);
      console.log(`✓ ${manifest.objekte.length} Objekt(e) aus ${behaelter} gesichert nach ${zielordner}`);
    } else if (befehl === "wiederherstellen") {
      const [zielordner, zielBehaelter, schluesselPraefix] = rest;
      if (!zielordner || !zielBehaelter) throw new Error("Aufruf: wiederherstellen <zielordner> <ziel-behaelter> [schluessel-praefix]");
      const hochgeladen = await wiederherstellen(client, zielBehaelter, zielordner, schluesselPraefix);
      console.log(`✓ ${hochgeladen.length} Objekt(e) aus ${zielordner} wiederhergestellt in ${zielBehaelter}`);
    } else if (befehl === "vergleichen") {
      const [behaelter, zielordner, schluesselPraefix] = rest;
      if (!behaelter || !zielordner) throw new Error("Aufruf: vergleichen <behaelter> <zielordner> [schluessel-praefix]");
      const befunde = await vergleichen(client, behaelter, zielordner, schluesselPraefix);
      const abweichend = befunde.filter(b => !b.gleich);
      console.log(`${befunde.length - abweichend.length} von ${befunde.length} Objekt(en) stimmen überein`);
      if (abweichend.length) { console.log(JSON.stringify(abweichend, null, 2)); process.exitCode = 1; }
    } else {
      console.error("Unbekannter Befehl. sichern | wiederherstellen | vergleichen");
      process.exitCode = 2;
    }
  } catch (fehler) {
    console.error(fehler?.message ?? String(fehler));
    process.exitCode = 1;
  }
}
