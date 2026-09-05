import "server-only";
import { createHash } from "node:crypto";
import { sql } from "./db";
import { storage } from "@/services/storage";
import { ableiten } from "@/services/bilder";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/log";
import { erkenne, ohneMetadaten, hatMetadaten, type Bildart } from "@/lib/bild";
import { darf, type Person } from "@/domain/rechte";

/* Medien — hochladen, ableiten, ausliefern, entfernen.

   Der Upload traut dem Browser nichts: nicht der Endung, nicht dem
   MIME-Typ, nicht dem Dateinamen. Entschieden wird nach den ersten Bytes,
   gespeichert unter einer selbst vergebenen Kennung, und Metadaten (EXIF mit
   GPS) werden entfernt, bevor irgendetwas auf die Platte kommt (§33/§34).

   Aus jedem Upload entstehen zwei Dinge:
     - ein privates ORIGINAL (orig/<uuid>.<ext>) — bleibt unverändert erhalten,
       auch nach der Veröffentlichung. Es ist das Beweismittel für die
       Moderation (gestohlene Fotos, Vergleich mit anderen Inseraten) und
       verlässt den Speicher nie öffentlich (§20).
     - private ABLEITUNGEN (abl/<uuid>/<breite>.<webp|jpg>) — feste Breiten,
       ohne Metadaten. Erst die Veröffentlichung des Inserats macht sie über
       pub/<uuid>/<breite>.<fmt> öffentlich (medienVeroeffentlichen unten);
       vorher sehen sie nur die Eigentümerin und, während der Prüfung, die
       Moderation (§36). */

const MAX_BYTES = 8 * 1024 * 1024;
const ERLAUBT: Bildart[] = ["image/jpeg", "image/png", "image/webp"];
/* Ein Konto darf nicht unbegrenzt Platz belegen. */
const MAX_JE_PERSON = 60;

export interface HochgeladenesBild { id: string; url: string; breite: number | null; hoehe: number | null; bytes: number }
export interface MeinBild extends HochgeladenesBild { vorschauUrl: string }

const EXT_ORIG: Record<Bildart, "jpg" | "png" | "webp"> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const EXT_VARIANTE: Record<"jpeg" | "webp", "jpg" | "webp"> = { jpeg: "jpg", webp: "webp" };
const MIME_VARIANTE: Record<"jpeg" | "webp", string> = { jpeg: "image/jpeg", webp: "image/webp" };

type Tx = typeof sql;

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

  let abgeleitet;
  try {
    abgeleitet = await ableiten(bytes);
  } catch {
    throw new AppError("VALIDATION", "Das Bild kann nicht verarbeitet werden");
  }

  /* Das Original wird — wie bisher — ohne Metadaten gespeichert, bevor
     irgendetwas den Server verlässt. */
  const sauberesOriginal = ohneMetadaten(bytes, befund.art);
  const nochMetadaten = hatMetadaten(sauberesOriginal);
  const sha256 = createHash("sha256").update(sauberesOriginal).digest("hex");

  const id = crypto.randomUUID();
  const origKey = `orig/${id}.${EXT_ORIG[befund.art]}`;

  /* Alles speichern, was zu diesem Bild gehört — und bei jedem Fehler danach
     (Speicher oder Datenbank) wieder wegräumen, damit nichts verwaist. */
  const gespeicherteKeys: string[] = [];
  try {
    await storage().speichern(origKey, sauberesOriginal, befund.art);
    gespeicherteKeys.push(origKey);
    for (const v of abgeleitet.varianten) {
      const key = `abl/${id}/${v.breite}.${EXT_VARIANTE[v.format]}`;
      await storage().speichern(key, v.bytes, MIME_VARIANTE[v.format]);
      gespeicherteKeys.push(key);
    }
  } catch (e) {
    await Promise.all(gespeicherteKeys.map(k => storage().loeschen(k)));
    throw e;
  }

  try {
    await sql.begin(async tx => {
      await tx`INSERT INTO media_asset (id, storage_key, mime_type, byte_size, width, height, sha256, exif_stripped, uploaded_by)
               VALUES (${id}, ${origKey}, ${befund.art}, ${sauberesOriginal.byteLength}, ${abgeleitet.breite}, ${abgeleitet.hoehe}, ${sha256}, ${!nochMetadaten}, ${person.id})`;
      for (const v of abgeleitet.varianten) {
        const key = `abl/${id}/${v.breite}.${EXT_VARIANTE[v.format]}`;
        await tx`INSERT INTO media_variant (asset_id, storage_key, width, format, byte_size)
                 VALUES (${id}, ${key}, ${v.breite}, ${v.format}, ${v.bytes.byteLength})`;
      }
    });
  } catch (e) {
    await Promise.all(gespeicherteKeys.map(k => storage().loeschen(k)));
    throw e;
  }

  if (nochMetadaten) log.warn("medien.metadatenReste", { asset: id });
  log.info("medien.hochgeladen", { asset: id, actor: person.id, bytes: sauberesOriginal.byteLength, art: befund.art, varianten: abgeleitet.varianten.length });
  return { id, url: `/api/medien/${id}`, breite: abgeleitet.breite, hoehe: abgeleitet.hoehe, bytes: sauberesOriginal.byteLength };
}

/* ---------- Veröffentlichen / Zurückziehen ----------
   Die Ableitungen eines Bildes liegen privat unter abl/. Erst wenn ein
   Inserat veröffentlicht wird, werden seine Ableitungen unter pub/ sichtbar
   (§20/§36) — der Aufruf erfolgt aus der Moderation, in derselben
   Transaktion wie der Statuswechsel. */

/* Ein Organisationslogo (P5.7 §44) hängt an keinem Inserat, sondern an
   organization.logo_asset_id. Es wird öffentlich, sobald es als Logo gesetzt
   ist — dieselbe abl/ → pub/-Bewegung wie bei der Veröffentlichung, nur je
   Bild statt je Inserat. Idempotent. */
export async function medienLogoVeroeffentlichen(tx: Tx, assetId: string): Promise<void> {
  const varianten = await tx`SELECT id, storage_key FROM media_variant WHERE asset_id = ${assetId} AND storage_key LIKE 'abl/%'`;
  for (const v of varianten) {
    const von = String(v.storage_key);
    const nach = von.replace(/^abl\//, "pub/");
    await storage().kopieren(von, nach);
    await tx`UPDATE media_variant SET storage_key = ${nach} WHERE id = ${v.id}`;
  }
}

export async function medienVeroeffentlichen(tx: Tx, listingId: string): Promise<void> {
  const varianten = await tx`
    SELECT v.id, v.storage_key
      FROM media_variant v
      JOIN listing_image li ON li.asset_id = v.asset_id
     WHERE li.listing_id = ${listingId} AND v.storage_key LIKE 'abl/%'`;
  for (const v of varianten) {
    const von = String(v.storage_key);
    const nach = von.replace(/^abl\//, "pub/");
    await storage().kopieren(von, nach);
    await tx`UPDATE media_variant SET storage_key = ${nach} WHERE id = ${v.id}`;
  }
}

/* Umkehrung — für Pause/Archivierung. Öffentliche Ableitungen verschwinden
   sofort (pub/ wird gelöscht); eine private Kopie bleibt unter abl/ übrig,
   falls das Inserat später erneut veröffentlicht wird. */
export async function medienZurueckziehen(tx: Tx, listingId: string): Promise<void> {
  const varianten = await tx`
    SELECT v.id, v.storage_key
      FROM media_variant v
      JOIN listing_image li ON li.asset_id = v.asset_id
     WHERE li.listing_id = ${listingId} AND v.storage_key LIKE 'pub/%'`;
  for (const v of varianten) {
    const von = String(v.storage_key);
    const nach = von.replace(/^pub\//, "abl/");
    await storage().kopieren(von, nach);
    await storage().loeschen(von);
    await tx`UPDATE media_variant SET storage_key = ${nach} WHERE id = ${v.id}`;
  }
}

/* ---------- Ausliefern ----------
   Öffentlich ist ein Bild, sobald sein Inserat veröffentlicht ist. Vorher
   sehen es nur die Eigentümerin und, während der Prüfung, die Moderation.

   Ohne `breite` liefert diese Funktion das Original; mit `breite` die
   nächstkleinere-oder-gleiche Variante im gewünschten Format (Standard:
   JPEG). Zeigt die gefundene Variante bereits auf eine öffentliche Adresse
   (pub/), gibt es keine Bytes, sondern eine Umleitung dorthin — die
   öffentliche Adresse ist dauerhaft und zwischenspeicherbar, die geprüfte
   Route muss sie nicht mehr ausliefern. */
export type AusgeliefertesBild = { bytes: Uint8Array; typ: string } | { umleitung: string };

export async function bildAusliefern(person: Person | null, assetId: string, breite?: number, format?: "webp" | "jpeg"): Promise<AusgeliefertesBild | null> {
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) return null;
  const z = await sql`
    SELECT a.storage_key, a.mime_type, a.uploaded_by,
           (EXISTS (SELECT 1 FROM listing_image li JOIN listing l ON l.id = li.listing_id
                     WHERE li.asset_id = a.id AND l.status IN ('published','reserved'))
            OR EXISTS (SELECT 1 FROM organization o WHERE o.logo_asset_id = a.id AND o.is_active AND o.archived_at IS NULL)) AS oeffentlich,
           EXISTS (SELECT 1 FROM listing_image li JOIN listing l ON l.id = li.listing_id
                    WHERE li.asset_id = a.id AND l.status IN ('submitted','in_review','approved')) AS in_pruefung
      FROM media_asset a WHERE a.id = ${assetId} LIMIT 1`;
  const a = z[0];
  if (!a) return null;
  const eigen = person && String(a.uploaded_by) === person.id;
  const moderation = person && darf(person.rolle, "REVIEW_LISTING") && (a.in_pruefung || a.oeffentlich);
  if (!a.oeffentlich && !eigen && !moderation) return null;

  if (breite == null) {
    const bytes = await storage().lesen(String(a.storage_key));
    return bytes ? { bytes, typ: String(a.mime_type) } : null;
  }

  const fmt: "webp" | "jpeg" = format === "webp" ? "webp" : "jpeg";
  /* Die passendste Variante: zuerst die grösste, die noch <= breite ist;
     gibt es keine (angefragte Breite kleiner als jede vorhandene Variante),
     die kleinste vorhandene. */
  const v = await sql`
    SELECT storage_key FROM media_variant
     WHERE asset_id = ${assetId} AND format = ${fmt}
     ORDER BY (width <= ${breite}) DESC, (CASE WHEN width <= ${breite} THEN -width ELSE width END) ASC
     LIMIT 1`;
  const treffer = v[0];
  if (!treffer) return null;
  const key = String(treffer.storage_key);
  if (key.startsWith("pub/")) return { umleitung: storage().publicUrl(key) };
  const bytes = await storage().lesen(key);
  return bytes ? { bytes, typ: MIME_VARIANTE[fmt] } : null;
}

/* ---------- Entfernen ----------
   Nur eigene Bilder, und nur solange sie an keinem veröffentlichten Inserat
   hängen (§35/§60). Original UND alle Varianten verlassen den Speicher. */
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

  const varianten = await sql`SELECT storage_key FROM media_variant WHERE asset_id = ${assetId}`;
  await sql`DELETE FROM media_asset WHERE id = ${assetId}`;
  await storage().loeschen(String(a.storage_key));
  await Promise.all(varianten.map(v => storage().loeschen(String(v.storage_key))));
  log.info("medien.entfernt", { asset: assetId, actor: person.id });
}

/* Die Bilder einer Person — für die Auswahl im Assistenten. */
export async function meineBilder(person: Person): Promise<MeinBild[]> {
  const z = await sql`SELECT id, width, height, byte_size FROM media_asset WHERE uploaded_by = ${person.id} ORDER BY created_at DESC LIMIT 60`;
  return z.map(r => ({
    id: String(r.id), url: `/api/medien/${r.id}`, vorschauUrl: `/api/medien/${r.id}?w=480`,
    breite: r.width, hoehe: r.height, bytes: Number(r.byte_size)
  }));
}
