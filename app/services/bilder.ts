import sharp from "sharp";

/* Bildableitung — reine Bildverarbeitung, ohne Datenbank und ohne
   Speicherzugriff. Aus rohen Bytes entsteht ein rotationsrichtiges,
   höchstens 2400 Pixel breites/hohes Basisbild sowie je eine WebP- und eine
   JPEG-Variante für jede passende Breite aus BREITEN. Metadaten (EXIF, ICC,
   XMP) werden NICHT übernommen — kein `.withMetadata()` in dieser Datei.

   Bewusst OHNE `import "server-only"`: diese Datei muss auch direkt aus
   node:test ladbar sein (tests/bilder.test.ts) — siehe der ausführliche
   Kommentar dazu in services/storage-s3.ts. sharp selbst hat keine
   Next-Abhängigkeit, ein Laufzeit-Import ausserhalb von Next ist also
   unproblematisch. */

export const BREITEN = [480, 960, 1600, 2400] as const;

export interface AbleitungsErgebnis {
  breite: number;
  hoehe: number;
  originalFormat: "jpeg" | "png" | "webp";
  varianten: { breite: number; format: "webp" | "jpeg"; bytes: Uint8Array }[];
}

const ERLAUBTE_FORMATE = new Set(["jpeg", "png", "webp"]);

export async function ableiten(roh: Uint8Array): Promise<AbleitungsErgebnis> {
  try {
    const quelle = sharp(roh, { limitInputPixels: 40_000_000, failOn: "error" });
    const meta = await quelle.metadata();
    if (!meta.format || !ERLAUBTE_FORMATE.has(meta.format)) throw new Error("Bild nicht dekodierbar");

    /* Abmessungen nach Anwendung der EXIF-Orientierung: bei den Werten 5–8
       vertauscht die Kamera-Orientierung Breite und Höhe. */
    const orientierung = meta.orientation ?? 1;
    const vertauscht = orientierung >= 5 && orientierung <= 8;
    const rohBreite = vertauscht ? (meta.height ?? 0) : (meta.width ?? 0);
    const rohHoehe = vertauscht ? (meta.width ?? 0) : (meta.height ?? 0);
    if (!rohBreite || !rohHoehe) throw new Error("Bild nicht dekodierbar");

    /* Längste Kante höchstens 2400 px, ohne zu vergrössern. */
    const skala = Math.min(1, 2400 / rohBreite, 2400 / rohHoehe);
    const zielBreite = Math.max(1, Math.round(rohBreite * skala));
    const zielHoehe = Math.max(1, Math.round(rohHoehe * skala));

    const basis = sharp(roh, { limitInputPixels: 40_000_000, failOn: "error" })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true });

    /* Jede Breite aus BREITEN, die höchstens so breit wie das Basisbild ist —
       mindestens aber 480, auch wenn das ein kleines Original leicht vergrössert. */
    let zielBreiten = BREITEN.filter(b => b <= zielBreite);
    if (!zielBreiten.length) zielBreiten = [480];

    const varianten: AbleitungsErgebnis["varianten"] = [];
    for (const b of zielBreiten) {
      const enlarge = b > zielBreite;
      const webp = await basis.clone().resize({ width: b, withoutEnlargement: !enlarge }).webp({ quality: 80 }).toBuffer();
      varianten.push({ breite: b, format: "webp", bytes: new Uint8Array(webp) });
      const jpeg = await basis.clone().resize({ width: b, withoutEnlargement: !enlarge }).jpeg({ quality: 82, mozjpeg: true, progressive: true }).toBuffer();
      varianten.push({ breite: b, format: "jpeg", bytes: new Uint8Array(jpeg) });
    }

    return { breite: zielBreite, hoehe: zielHoehe, originalFormat: meta.format as "jpeg" | "png" | "webp", varianten };
  } catch (e) {
    if (e instanceof Error && e.message === "Bild nicht dekodierbar") throw e;
    throw new Error("Bild nicht dekodierbar");
  }
}
