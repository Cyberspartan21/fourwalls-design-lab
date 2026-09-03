import "server-only";
import { env } from "@/server/env";
import type { Media, MediaSource } from "@/domain/listing";

/* Objektspeicher hinter einer Schnittstelle.

   Die Datenbank kennt nur Speicherschlüssel (media_asset.storage_key). Eine
   Adresse entsteht erst hier — und nur hier. Öffentliche Ableitungen bekommen
   eine dauerhafte Adresse; Geschütztes bekäme eine signierte mit kurzer
   Gültigkeit. Wechselt der Anbieter, wechselt diese Datei, nicht die Anwendung.

   Entwicklung: `local` liest Fixtures aus public/media. Das ist ausdrücklich
   KEIN Produktionsspeicher — env.ts verweigert ihn ausserhalb der Entwicklung. */

export interface StorageProvider {
  readonly name: string;
  /* Dauerhafte Adresse einer öffentlichen Ableitung. */
  publicUrl(storageKey: string): string;
  /* Kurzlebige Adresse für ein geschütztes Objekt — erst nach erfolgter
     Berechtigungsprüfung aufzurufen. */
  signedUrl(storageKey: string, ttlSeconds: number): Promise<string>;
}

class LocalDevStorage implements StorageProvider {
  readonly name = "local";
  publicUrl(storageKey: string) {
    /* Fixtures liegen flach unter public/media; der Präfix `demo/` aus der
       Datenbank wird abgestreift. Nur Dateinamen ohne Pfadanteile. */
    const datei = storageKey.replace(/^demo\//, "");
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(datei)) throw new Error("Unzulässiger Speicherschlüssel");
    return `/media/${datei}`;
  }
  async signedUrl(storageKey: string, ttlSeconds: number) {
    /* Entwicklung: ein sichtbar gekennzeichneter Platzhalter statt einer
       echten Signatur — damit niemand glaubt, hier sei etwas geschützt. */
    return `${this.publicUrl(storageKey)}?dev-signed=1&ttl=${ttlSeconds}`;
  }
}

let instanz: StorageProvider | null = null;
export function storage(): StorageProvider {
  if (instanz) return instanz;
  const e = env();
  if (e.STORAGE_PROVIDER === "local") instanz = new LocalDevStorage();
  else throw new Error("S3-Speicher ist in P5.2 noch nicht angebunden");
  return instanz;
}

/* Aus Varianten-Zeilen ein Medienobjekt für die Oberfläche bauen. */
export function alsMedia(
  key: string, alt: string, category: Media["category"],
  varianten: { storage_key: string; width: number; format: "jpeg" | "webp" | "avif" }[]
): Media {
  const s = storage();
  const nach = (f: "webp" | "jpeg"): MediaSource[] =>
    varianten.filter(v => v.format === f).sort((a, b) => a.width - b.width)
      .map(v => ({ width: v.width, url: s.publicUrl(v.storage_key) }));
  return { key, alt, category, sources: { webp: nach("webp"), jpeg: nach("jpeg") } };
}
