import "server-only";
import { sql } from "./db";
import { storage } from "@/services/storage";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/log";
import { erkenne, ohneMetadaten, hatMetadaten, dateiname, type Bildart } from "@/lib/bild";
import { darf, type Person } from "@/domain/rechte";

/* Medien — hochladen, ausliefern, entfernen.

   Der Upload traut dem Browser nichts: nicht der Endung, nicht dem
   MIME-Typ, nicht dem Dateinamen. Entschieden wird nach den ersten Bytes,
   gespeichert unter einer selbst vergebenen Kennung, und Metadaten (EXIF mit
   GPS) werden entfernt, bevor irgendetwas auf die Platte kommt (§33/§34).

   Ausgeliefert wird über eine geprüfte Route: Bilder eines Entwurfs sehen nur
   die Eigentümerin und die Moderation. Öffentlich werden sie mit der
   Veröffentlichung des Inserats — nicht vorher (§36). */

const MAX_BYTES = 8 * 1024 * 1024;
const ERLAUBT: Bildart[] = ["image/jpeg", "image/png", "image/webp"];
/* Ein Konto darf nicht unbegrenzt Platz belegen. */
const MAX_JE_PERSON = 60;

export interface HochgeladenesBild { id: string; url: string; breite: number | null; hoehe: number | null; bytes: number }

export async function bildHochladen(person: Person, roh: ArrayBuffer, gemeldeterTyp: string): Promise<HochgeladenesBild> {
  if (roh.byteLength === 0) throw new AppError("VALIDATION", "Die Datei ist leer");
  if (roh.byteLength > MAX_BYTES) throw new AppError("VALIDATION", `Das Bild ist zu gross (höchstens ${MAX_BYTES / 1024 / 1024} MB)`);

  const bytes = new Uint8Array(roh);
  const befund = erkenne(bytes);
  if (!befund.art || !ERLAUBT.includes(befund.art)) {
    /* Der gemeldete Typ steht nur im Protokoll — entschieden hat der Inhalt. */
    log.warn("medien.abgelehnt", { grund: befund.grund ?? "unbekannt", gemeldet: String(gemeldeterTyp).slice(0, 40), actor: person.id });
    throw new AppError("VALIDATION", "Nur JPEG-, PNG- und WebP-Bilder sind möglich");
  }
  if ((befund.breite ?? 0) < 400 || (befund.hoehe ?? 0) < 300) {
    throw new AppError("VALIDATION", "Das Bild ist zu klein (mindestens 400 × 300 Punkte)");
  }

  const anzahl = await sql`SELECT count(*)::int AS n FROM media_asset WHERE uploaded_by = ${person.id}`;
  if (Number(anzahl[0]?.n ?? 0) >= MAX_JE_PERSON) throw new AppError("RATE_LIMIT", "Sie haben die Höchstzahl an Bildern erreicht");

  const sauber = ohneMetadaten(bytes, befund.art);
  const nochMetadaten = hatMetadaten(sauber);

  const id = crypto.randomUUID();
  const key = "upload/" + dateiname(id, befund.art);
  await storage().speichern(key, sauber, befund.art);

  await sql.begin(async tx => {
    await tx`INSERT INTO media_asset (id, storage_key, mime_type, byte_size, width, height, exif_stripped, uploaded_by)
             VALUES (${id}, ${key}, ${befund.art}, ${sauber.byteLength}, ${befund.breite}, ${befund.hoehe}, ${!nochMetadaten}, ${person.id})`;
    /* Der Browser hat vor dem Hochladen auf Anzeigegrösse gerechnet; eine
       eigene Ableitungskette entsteht erst mit dem Speicheranbieter in P5.5.
       Die eine Variante zeigt darum auf dieselbe Datei — ehrlich verbucht. */
    await tx`INSERT INTO media_variant (asset_id, storage_key, width, format, byte_size)
             VALUES (${id}, ${key}, ${befund.breite ?? 960}, ${befund.art === "image/png" ? "webp" : befund.art === "image/webp" ? "webp" : "jpeg"}, ${sauber.byteLength})`;
  });

  if (nochMetadaten) log.warn("medien.metadatenReste", { asset: id });
  log.info("medien.hochgeladen", { asset: id, actor: person.id, bytes: sauber.byteLength, art: befund.art });
  return { id, url: `/api/medien/${id}`, breite: befund.breite, hoehe: befund.hoehe, bytes: sauber.byteLength };
}

/* ---------- Ausliefern ----------
   Öffentlich ist ein Bild, sobald sein Inserat veröffentlicht ist. Vorher
   sehen es nur die Eigentümerin und, während der Prüfung, die Moderation. */
export async function bildAusliefern(person: Person | null, assetId: string): Promise<{ bytes: Uint8Array; typ: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) return null;
  const z = await sql`
    SELECT a.storage_key, a.mime_type, a.uploaded_by,
           EXISTS (SELECT 1 FROM listing_image li JOIN listing l ON l.id = li.listing_id
                    WHERE li.asset_id = a.id AND l.status IN ('published','reserved')) AS oeffentlich,
           EXISTS (SELECT 1 FROM listing_image li JOIN listing l ON l.id = li.listing_id
                    WHERE li.asset_id = a.id AND l.status IN ('submitted','in_review','approved')) AS in_pruefung
      FROM media_asset a WHERE a.id = ${assetId} LIMIT 1`;
  const a = z[0];
  if (!a) return null;
  const eigen = person && String(a.uploaded_by) === person.id;
  const moderation = person && darf(person.rolle, "REVIEW_LISTING") && (a.in_pruefung || a.oeffentlich);
  if (!a.oeffentlich && !eigen && !moderation) return null;
  const bytes = await storage().lesen(String(a.storage_key));
  return bytes ? { bytes, typ: String(a.mime_type) } : null;
}

/* ---------- Entfernen ----------
   Nur eigene Bilder, und nur solange sie an keinem veröffentlichten Inserat
   hängen (§35/§60). */
export async function bildEntfernen(person: Person, assetId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) throw new AppError("NOT_FOUND", "Dieses Bild gibt es nicht");
  const z = await sql`
    SELECT a.storage_key, a.uploaded_by,
           EXISTS (SELECT 1 FROM listing_image li JOIN listing l ON l.id = li.listing_id
                    WHERE li.asset_id = a.id AND l.status NOT IN ('draft','archived','rejected')) AS gebunden
      FROM media_asset a WHERE a.id = ${assetId} LIMIT 1`;
  const a = z[0];
  if (!a) throw new AppError("NOT_FOUND", "Dieses Bild gibt es nicht");
  /* Fremdes Bild: dieselbe Antwort wie ein nicht vorhandenes. */
  if (String(a.uploaded_by) !== person.id) throw new AppError("NOT_FOUND", "Dieses Bild gibt es nicht");
  if (a.gebunden) throw new AppError("CONFLICT", "Dieses Bild gehört zu einem eingereichten Inserat");
  await sql`DELETE FROM media_asset WHERE id = ${assetId}`;
  await storage().loeschen(String(a.storage_key));
  log.info("medien.entfernt", { asset: assetId, actor: person.id });
}

/* Die Bilder einer Person — für die Auswahl im Assistenten. */
export async function meineBilder(person: Person): Promise<HochgeladenesBild[]> {
  const z = await sql`SELECT id, width, height, byte_size FROM media_asset WHERE uploaded_by = ${person.id} ORDER BY created_at DESC LIMIT 60`;
  return z.map(r => ({ id: String(r.id), url: `/api/medien/${r.id}`, breite: r.width, hoehe: r.height, bytes: Number(r.byte_size) }));
}
