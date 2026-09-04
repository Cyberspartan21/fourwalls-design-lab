import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  type S3ClientConfig
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider } from "./storage";
import { bereichVon, SCHLUESSEL_FORM, type Bereich } from "../lib/speicherschluessel.ts";

/* S3-kompatibler Objektspeicher — zwei Behälter (privat/öffentlich), die
   Grenze entscheidet allein der Schlüsselpräfix (siehe storage.ts). Der
   Anbieter selbst (Endpunkt, Zugangsdaten) steckt nur in der Umgebung —
   hier steht kein Anbietername (P5.5 §5).

   Bewusst OHNE Laufzeit-Importe aus storage.ts und OHNE eigenen Zugriff auf
   @/server/env: storage.ts trägt unbedingt `import "server-only"` an seiner
   Spitze, jeder Laufzeit-Import von dort (oder von env.ts, das ebenfalls
   `server-only` importiert) bricht deshalb sofort, sobald diese Datei
   ausserhalb von Next — z. B. direkt aus einem node:test — geladen wird,
   unabhängig davon, welcher Export tatsächlich benutzt wird (ESM lädt beim
   Import immer das gesamte Modul). Darum: die Präfixregel ist hier bewusst
   dupliziert (muss deckungsgleich mit storage.ts bleiben, siehe dort) und
   `s3Storage()` nimmt die Konfiguration als Parameter — die Umgebung liest
   ausschliesslich der Aufrufer in storage.ts, der env() schon besitzt. */


export interface S3Konfig {
  endpoint: string;
  region: string;
  bucketPrivat: string;
  bucketOeffentlich: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  publicBaseUrl?: string;
}

function contentTypeVonSchluessel(storageKey: string): string {
  const ext = storageKey.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg": return "image/jpeg";
    case "webp": return "image/webp";
    case "avif": return "image/avif";
    case "png": return "image/png";
    default: throw new Error("Unbekannte Dateierweiterung");
  }
}

function cacheControlVonBereich(bereich: Bereich): string {
  return bereich === "oeffentlich" ? "public, max-age=31536000, immutable" : "private, no-store";
}

function pruefeSchluessel(storageKey: string): void {
  if (!SCHLUESSEL_FORM.test(storageKey)) throw new Error("Unzulässiger Speicherschlüssel");
}

async function liesGanzenStream(body: unknown): Promise<Uint8Array> {
  /* Der SDK-Response-Body ist je nach Laufzeit ein Web-Stream, ein
     Node-Stream oder liefert bereits eine Hilfsmethode — hier reicht das
     universelle Byte-Array. */
  const b = body as { transformToByteArray?: () => Promise<Uint8Array> };
  if (typeof b.transformToByteArray === "function") return b.transformToByteArray();
  throw new Error("Unerwarteter Antworttyp beim Lesen");
}

export class S3Storage implements StorageProvider {
  readonly name = "s3";
  private readonly client: S3Client;
  private readonly konfig: S3Konfig;

  constructor(konfig: S3Konfig) {
    this.konfig = konfig;
    const config: S3ClientConfig = {
      endpoint: konfig.endpoint,
      region: konfig.region,
      forcePathStyle: konfig.forcePathStyle,
      credentials: {
        accessKeyId: konfig.accessKeyId,
        secretAccessKey: konfig.secretAccessKey
      }
    };
    this.client = new S3Client(config);
  }

  private behaelter(storageKey: string): string {
    pruefeSchluessel(storageKey);
    return bereichVon(storageKey) === "privat" ? this.konfig.bucketPrivat : this.konfig.bucketOeffentlich;
  }

  async speichern(storageKey: string, daten: Uint8Array, mimeType: string): Promise<void> {
    const bereich = bereichVon(storageKey);
    const bucket = this.behaelter(storageKey);
    await this.client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: daten,
      ContentType: mimeType,
      CacheControl: cacheControlVonBereich(bereich)
    }));
  }

  async lesen(storageKey: string): Promise<Uint8Array | null> {
    const bucket = this.behaelter(storageKey);
    try {
      const antwort = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
      return await liesGanzenStream(antwort.Body);
    } catch (fehler: unknown) {
      const name = (fehler as { name?: string })?.name;
      if (name === "NoSuchKey") return null;
      throw fehler;
    }
  }

  async loeschen(storageKey: string): Promise<void> {
    const bucket = this.behaelter(storageKey);
    /* DeleteObject ist bei S3-kompatiblen Speichern auch für ein fehlendes
       Objekt erfolgreich — kein gesonderter Fehlerfall nötig. */
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
  }

  async kopieren(vonKey: string, nachKey: string): Promise<void> {
    const vonBucket = this.behaelter(vonKey);
    const nachBucket = this.behaelter(nachKey);
    const nachBereich = bereichVon(nachKey);
    const copySource = `${vonBucket}/${encodeURIComponent(vonKey).replace(/%2F/g, "/")}`;
    await this.client.send(new CopyObjectCommand({
      Bucket: nachBucket,
      Key: nachKey,
      CopySource: copySource,
      MetadataDirective: "REPLACE",
      ContentType: contentTypeVonSchluessel(nachKey),
      CacheControl: cacheControlVonBereich(nachBereich)
    }));
  }

  publicUrl(storageKey: string): string {
    pruefeSchluessel(storageKey);
    if (bereichVon(storageKey) !== "oeffentlich") throw new Error("Ein privates Objekt hat keine dauerhafte Adresse");
    const basis = this.oeffentlicheBasisAdresse();
    return `${basis}/${storageKey}`;
  }

  private oeffentlicheBasisAdresse(): string {
    if (this.konfig.publicBaseUrl) return this.konfig.publicBaseUrl.replace(/\/$/, "");
    if (this.konfig.forcePathStyle) return `${this.konfig.endpoint.replace(/\/$/, "")}/${this.konfig.bucketOeffentlich}`;
    const host = new URL(this.konfig.endpoint).host;
    const protokoll = new URL(this.konfig.endpoint).protocol;
    return `${protokoll}//${this.konfig.bucketOeffentlich}.${host}`;
  }

  async signedUrl(storageKey: string, ttlSeconds: number): Promise<string> {
    pruefeSchluessel(storageKey);
    if (bereichVon(storageKey) !== "privat") throw new Error("Eine dauerhafte Adresse braucht keine Signatur");
    const bucket = this.behaelter(storageKey);
    const ttl = Math.min(ttlSeconds, 900);
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: bucket, Key: storageKey }), { expiresIn: ttl });
  }
}

/* Reine Fabrik ohne Umgebungszugriff — für Tests, die ohne @/server/env und
   ohne server-only auskommen sollen. */
export function erzeugeS3Storage(konfig: S3Konfig): S3Storage {
  return new S3Storage(konfig);
}

/* Die produktive Fabrik: storage.ts liest env() (dort bereits unter dem
   server-only-Schutz vorhanden) und reicht die Werte hier durch. */
export function s3Storage(konfig: S3Konfig): StorageProvider {
  return erzeugeS3Storage(konfig);
}
