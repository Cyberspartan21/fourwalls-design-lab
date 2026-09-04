/* Bildprüfung und Metadaten-Entfernung — ohne Bildbibliothek.

   Was hier passiert und warum:

   · ERKENNEN am Inhalt, nicht am Namen. Ein «foto.jpg», das in Wahrheit ein
     Skript oder ein SVG ist, fällt hier durch: entschieden wird nach den
     ersten Bytes (§33).
   · ENTFERNEN von EXIF, XMP und Ortsangaben. Kameras schreiben GPS-Koordinaten
     ins Bild; ein Inserat mit ungefährer Lage würde die genaue Adresse im Foto
     mitliefern. Wir schneiden die Metadaten-Abschnitte aus dem Containerformat
     heraus — die Bilddaten bleiben unberührt (§34).

   Kein Skalieren: das übernimmt der Browser vor dem Hochladen (Canvas), und
   der spätere Speicheranbieter erzeugt in P5.5 echte Ableitungen. Diese Datei
   ist rein und ohne Abhängigkeit prüfbar (tests/bild.test.ts). */

export type Bildart = "image/jpeg" | "image/png" | "image/webp";

export interface Befund {
  art: Bildart | null;
  breite: number | null;
  hoehe: number | null;
  grund?: "unbekanntes-format" | "svg-nicht-erlaubt" | "zu-klein";
}

const gleich = (b: Uint8Array, pos: number, muster: number[]) => muster.every((m, i) => b[pos + i] === m);
const u16 = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;
const u32 = (b: Uint8Array, i: number) => ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;

/* Art und Abmessungen aus den ersten Bytes. */
export function erkenne(b: Uint8Array): Befund {
  if (b.length < 24) return { art: null, breite: null, hoehe: null, grund: "zu-klein" };
  /* SVG ist ein Dokument mit Skriptfähigkeit, kein Foto — nie als Upload (§69). */
  const kopf = new TextDecoder("utf-8", { fatal: false }).decode(b.subarray(0, 200)).trimStart().toLowerCase();
  if (kopf.startsWith("<?xml") || kopf.startsWith("<svg")) return { art: null, breite: null, hoehe: null, grund: "svg-nicht-erlaubt" };

  if (gleich(b, 0, [0xff, 0xd8, 0xff])) {
    /* JPEG: durch die Abschnitte laufen, bis der Rahmen mit den Massen kommt. */
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marke = b[i + 1]!;
      if (marke === 0xd8 || marke === 0x01 || (marke >= 0xd0 && marke <= 0xd7)) { i += 2; continue; }
      const laenge = u16(b, i + 2);
      if (marke >= 0xc0 && marke <= 0xcf && marke !== 0xc4 && marke !== 0xc8 && marke !== 0xcc)
        return { art: "image/jpeg", hoehe: u16(b, i + 5), breite: u16(b, i + 7) };
      i += 2 + laenge;
    }
    return { art: "image/jpeg", breite: null, hoehe: null };
  }
  if (gleich(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { art: "image/png", breite: u32(b, 16), hoehe: u32(b, 20) };
  if (gleich(b, 0, [0x52, 0x49, 0x46, 0x46]) && gleich(b, 8, [0x57, 0x45, 0x42, 0x50])) {
    /* WebP: VP8 (verlustbehaftet), VP8L (verlustfrei), VP8X (erweitert) */
    const typ = new TextDecoder().decode(b.subarray(12, 16));
    if (typ === "VP8 ") return { art: "image/webp", breite: u16le(b, 26) & 0x3fff, hoehe: u16le(b, 28) & 0x3fff };
    if (typ === "VP8L") { const n = u32le(b, 21); return { art: "image/webp", breite: (n & 0x3fff) + 1, hoehe: ((n >> 14) & 0x3fff) + 1 }; }
    if (typ === "VP8X") return { art: "image/webp", breite: u24le(b, 24) + 1, hoehe: u24le(b, 27) + 1 };
    return { art: "image/webp", breite: null, hoehe: null };
  }
  return { art: null, breite: null, hoehe: null, grund: "unbekanntes-format" };
}
const u16le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8);
const u24le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);
const u32le = (b: Uint8Array, i: number) => (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;

/* ---------- Metadaten entfernen ---------- */

/* JPEG: alle APPn-Abschnitte (EXIF, XMP, IPTC, Farbprofil-Anhänge) und
   Kommentare fallen weg. Bild- und Quantisierungsdaten bleiben. */
function jpegOhneMetadaten(b: Uint8Array): Uint8Array {
  const raus: [number, number][] = [];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) break;
    const marke = b[i + 1]!;
    if (marke === 0xda) break;                       // ab hier kommen die Bilddaten
    if (marke === 0x01 || (marke >= 0xd0 && marke <= 0xd7)) { i += 2; continue; }
    const laenge = u16(b, i + 2);
    if ((marke >= 0xe0 && marke <= 0xef) || marke === 0xfe) raus.push([i, i + 2 + laenge]);
    i += 2 + laenge;
  }
  if (!raus.length) return b;
  const behalten: Uint8Array[] = []; let pos = 0;
  for (const [von, bis] of raus) { behalten.push(b.subarray(pos, von)); pos = bis; }
  behalten.push(b.subarray(pos));
  return zusammen(behalten);
}

/* PNG: alles ausser den Abschnitten, die das Bild ausmachen. */
const PNG_BEHALTEN = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "acTL", "fcTL", "fdAT"]);
function pngOhneMetadaten(b: Uint8Array): Uint8Array {
  const teile: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const laenge = u32(b, i);
    const name = new TextDecoder().decode(b.subarray(i + 4, i + 8));
    const ende = i + 12 + laenge;
    if (ende > b.length) break;
    if (PNG_BEHALTEN.has(name)) teile.push(b.subarray(i, ende));
    if (name === "IEND") break;
    i = ende;
  }
  return zusammen(teile);
}

/* WebP: die Abschnitte EXIF und XMP aus dem RIFF-Container schneiden. */
function webpOhneMetadaten(b: Uint8Array): Uint8Array {
  const teile: Uint8Array[] = []; let i = 12; let entfernt = false;
  while (i + 8 <= b.length) {
    const name = new TextDecoder().decode(b.subarray(i, i + 4));
    const laenge = u32le(b, i + 4);
    const ende = i + 8 + laenge + (laenge % 2);
    if (name === "EXIF" || name === "XMP ") entfernt = true;
    else teile.push(b.subarray(i, Math.min(ende, b.length)));
    i = ende;
  }
  if (!entfernt) return b;
  const koerper = zusammen(teile);
  const aus = new Uint8Array(12 + koerper.length);
  aus.set(b.subarray(0, 12));
  aus.set(koerper, 12);
  /* RIFF-Länge neu setzen: alles nach den ersten acht Bytes. */
  const n = aus.length - 8;
  aus[4] = n & 0xff; aus[5] = (n >> 8) & 0xff; aus[6] = (n >> 16) & 0xff; aus[7] = (n >> 24) & 0xff;
  return aus;
}

function zusammen(teile: Uint8Array[]): Uint8Array {
  const n = teile.reduce((s, t) => s + t.length, 0);
  const aus = new Uint8Array(n); let p = 0;
  for (const t of teile) { aus.set(t, p); p += t.length; }
  return aus;
}

export function ohneMetadaten(b: Uint8Array, art: Bildart): Uint8Array {
  if (art === "image/jpeg") return jpegOhneMetadaten(b);
  if (art === "image/png") return pngOhneMetadaten(b);
  return webpOhneMetadaten(b);
}

/* Gegenprobe: enthält das Bild noch Metadaten-Marken? Für den Nachweis in
   den Tests und als Netz, falls ein Format eine Abwandlung mitbringt. */
export function hatMetadaten(b: Uint8Array): boolean {
  const s = new TextDecoder("latin1").decode(b.subarray(0, Math.min(b.length, 200_000)));
  return /\bExif\0|http:\/\/ns\.adobe\.com\/xap|<x:xmpmeta|\bGPS\b.{0,20}Latitude|Photoshop 3\.0/.test(s);
}

/* Dateiname aus einer Kennung — nie aus dem, was der Browser mitschickt.
   Damit gibt es keinen Pfadwechsel und keine ausführbaren Endungen (§33). */
export const dateiname = (id: string, art: Bildart) =>
  `${id.replace(/[^a-f0-9-]/gi, "")}.${art === "image/jpeg" ? "jpg" : art === "image/png" ? "png" : "webp"}`;
