import "server-only";
import { mkdir, writeFile, readFile, rm, rmdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { env } from "@/server/env";
import type { Media, MediaSource } from "@/domain/listing";
import { s3Storage } from "./storage-s3";

/* Objektspeicher hinter einer Schnittstelle.

   Die Datenbank kennt nur Speicherschlüssel (media_asset.storage_key). Eine
   Adresse entsteht erst hier — und nur hier. Wechselt der Anbieter, wechselt
   diese Datei, nicht die Anwendung (P5.5 §5).

   Der Schlüsselpräfix entscheidet, wo ein Objekt liegt und wer es sieht:

     orig/<uuid>.<ext>            Original eines Uploads        PRIVAT
     upload/<uuid>.<ext>          P5.4-Altbestand (eine Datei)  PRIVAT
     abl/<uuid>/<breite>.<fmt>    Ableitung, unveröffentlicht    PRIVAT
     pub/<uuid>/<breite>.<fmt>    Ableitung, veröffentlicht      ÖFFENTLICH
     demo/<name>                  Demo-Bestand                   ÖFFENTLICH

   Privates verlässt den Speicher nur über die geprüfte Route /api/medien
   oder eine kurzlebige signierte Adresse; Öffentliches hat eine dauerhafte,
   zwischenspeicherbare Adresse. Die Veröffentlichung eines Inserats kopiert
   abl/ → pub/ (kopieren), die Archivierung entfernt pub/ wieder.

   Anbieter: `local` (Entwicklung: var/uploads für Privates, public/pub für
   Öffentliches; env.ts verweigert ihn ausserhalb der Entwicklung) und `s3`
   (S3-kompatibel, zwei Behälter — Exoscale SOS, MinIO, …). */

export { bereichVon, SCHLUESSEL_FORM, type Bereich } from "@/lib/speicherschluessel";
import { bereichVon, SCHLUESSEL_FORM } from "@/lib/speicherschluessel";

export interface StorageProvider {
  readonly name: string;
  /* Ein Objekt ablegen. Der Schlüssel kommt aus der Anwendung, nie aus dem
     Browser — sonst wäre ein Pfadwechsel möglich (P5.4 §33). */
  speichern(storageKey: string, daten: Uint8Array, mimeType: string): Promise<void>;
  /* Die Bytes zurücklesen — für die geprüfte Auslieferung eigener Uploads. */
  lesen(storageKey: string): Promise<Uint8Array | null>;
  loeschen(storageKey: string): Promise<void>;
  /* Ein Objekt innerhalb des Speichers kopieren — auch über die Grenze
     privat → öffentlich (Veröffentlichung) und zurück. */
  kopieren(vonKey: string, nachKey: string): Promise<void>;
  /* Dauerhafte Adresse eines ÖFFENTLICHEN Objekts. Für Privates wirft sie —
     ein privates Objekt hat keine dauerhafte Adresse (P5.5 §20). */
  publicUrl(storageKey: string): string;
  /* Kurzlebige Adresse für ein geschütztes Objekt — erst nach erfolgter
     Berechtigungsprüfung aufzurufen. Höchstens 900 Sekunden. */
  signedUrl(storageKey: string, ttlSeconds: number): Promise<string>;
}

class LocalDevStorage implements StorageProvider {
  readonly name = "local";
  /* Privates liegt unter var/uploads — NICHT im öffentlichen Ordner: Bilder
     eines Entwurfs dürfen erst mit der Veröffentlichung sichtbar werden (§36).
     Öffentliche Ableitungen liegen unter public/pub, Demo-Fixtures unter
     public/media; beides liefert Next als statische Dateien aus. */
  private readonly privat = join(process.cwd(), "var", "uploads");
  private readonly oeffentlich = join(process.cwd(), "public");
  private pfad(storageKey: string) {
    if (!SCHLUESSEL_FORM.test(storageKey)) throw new Error("Unzulässiger Speicherschlüssel");
    if (bereichVon(storageKey) === "privat") return join(this.privat, storageKey.replace(/^(orig|upload)\//, "").replace(/^abl\//, "abl/"));
    return join(this.oeffentlich, storageKey.replace(/^demo\//, "media/"));
  }
  async speichern(storageKey: string, daten: Uint8Array, _mime: string) {
    void _mime;
    const ziel = this.pfad(storageKey);
    await mkdir(dirname(ziel), { recursive: true });
    await writeFile(ziel, daten);
  }
  async lesen(storageKey: string) {
    try { return new Uint8Array(await readFile(this.pfad(storageKey))); } catch { return null; }
  }
  async loeschen(storageKey: string) {
    const ziel = this.pfad(storageKey);
    try { await rm(ziel); } catch { /* schon weg */ }
    /* Ableitungen liegen je Bild in einem eigenen Ordner; ist er leer, weg damit. */
    if (/^(abl|pub)\//.test(storageKey)) { try { await rmdir(dirname(ziel)); } catch { /* nicht leer oder schon weg */ } }
  }
  async kopieren(vonKey: string, nachKey: string) {
    const daten = await this.lesen(vonKey);
    if (!daten) throw new Error("Quelle fehlt");
    await this.speichern(nachKey, daten, "");
  }
  publicUrl(storageKey: string) {
    if (!SCHLUESSEL_FORM.test(storageKey)) throw new Error("Unzulässiger Speicherschlüssel");
    if (bereichVon(storageKey) === "privat") throw new Error("Ein privates Objekt hat keine dauerhafte Adresse");
    return "/" + storageKey.replace(/^demo\//, "media/");
  }
  async signedUrl(storageKey: string, ttlSeconds: number) {
    /* Entwicklung: die geprüfte Route mit sichtbar gekennzeichnetem
       Platzhalter statt einer echten Signatur — damit niemand glaubt, hier
       sei etwas geschützt. */
    const id = storageKey.match(/[a-f0-9-]{36}/i)?.[0] ?? "";
    return `/api/medien/${id}?dev-signed=1&ttl=${Math.min(ttlSeconds, 900)}`;
  }
}

let instanz: StorageProvider | null = null;
export function storage(): StorageProvider {
  if (instanz) return instanz;
  const e = env();
  if (e.STORAGE_PROVIDER === "local") { instanz = new LocalDevStorage(); return instanz; }
  /* env.ts stellt bei STORAGE_PROVIDER=s3 bereits sicher, dass diese Werte
     gesetzt sind (superRefine) — die Prüfung hier dient nur der Typklärung. */
  if (!e.S3_ENDPOINT || !e.S3_BUCKET_PRIVATE || !e.S3_BUCKET_PUBLIC || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY) {
    throw new Error("S3-Zugangsdaten fehlen");
  }
  instanz = s3Storage({
    endpoint: e.S3_ENDPOINT,
    region: e.S3_REGION,
    bucketPrivat: e.S3_BUCKET_PRIVATE,
    bucketOeffentlich: e.S3_BUCKET_PUBLIC,
    accessKeyId: e.S3_ACCESS_KEY_ID,
    secretAccessKey: e.S3_SECRET_ACCESS_KEY,
    forcePathStyle: e.S3_FORCE_PATH_STYLE === "ja",
    ...(e.S3_PUBLIC_BASE_URL ? { publicBaseUrl: e.S3_PUBLIC_BASE_URL } : {})
  });
  return instanz;
}

/* Aus Varianten-Zeilen ein Medienobjekt für die Oberfläche bauen.

   Gelesen werden hier nur veröffentlichte Inserate (listing_public) — ihre
   Varianten liegen normalerweise unter pub/. Steht ausnahmsweise noch ein
   privater Schlüssel (abl/) in der Zeile, hat publicUrl() keine Adresse
   dafür: die Variante wird stillschweigend ausgelassen statt zu werfen. */
export function alsMedia(
  key: string, alt: string, category: Media["category"],
  varianten: { storage_key: string; width: number; format: "jpeg" | "webp" | "avif" }[]
): Media {
  const s = storage();
  const nach = (f: "webp" | "jpeg"): MediaSource[] =>
    varianten.filter(v => v.format === f).sort((a, b) => a.width - b.width)
      .flatMap(v => {
        try { return [{ width: v.width, url: s.publicUrl(v.storage_key) }]; }
        catch { return []; }
      });
  return { key, alt, category, sources: { webp: nach("webp"), jpeg: nach("jpeg") } };
}
