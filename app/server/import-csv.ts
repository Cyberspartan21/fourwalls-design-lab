import "server-only";
import { sql } from "./db";
import { AppError, asAppError } from "@/lib/errors";
import { log } from "@/lib/log";
import { EntwurfSchema } from "@/domain/entwurf";
import type { Person } from "@/domain/rechte";
import type { OrgKontext } from "./org-kontext";
import { entwurfAnlegen } from "./entwuerfe";

/* Der CSV-Import — eine bewusst kleine, dokumentierte Grenze (P5.7 §29–§31,
   §75). Was hier NICHT entsteht, steht in docs/IMPORT-ADAPTER.md: kein
   Feed, keine API, kein XML — eine Datei, einmal hochgeladen, Zeile für
   Zeile durch dieselbe Prüfung wie der Assistent (`EntwurfSchema`).

   Jede Zeile bleibt ein Entwurf (§30) — der Moderationsweg ist derselbe wie
   überall, es gibt keine zweite Inserats-Engine (§22). Ein Import ist
   wiederholbar: dieselbe (Organisation, external_ref) erzeugt beim zweiten
   Lauf keine zweite Zeile, sondern wird übersprungen. */

const KOPFZEILE = ["external_ref", "trans", "typ", "ortId", "zimmer", "flaeche", "preis", "titel", "beschreibung", "sprache"] as const;
const MAX_BYTES = 1024 * 1024;
const MAX_ZEILEN = 200;
function externalRefGueltig(v: string): boolean {
  if (v.length < 1 || v.length > 80) return false;
  for (let i = 0; i < v.length; i++) {
    const code = v.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return false;
  }
  return true;
}

export interface CsvZeilenErgebnis {
  zeile: number;
  externalRef: string | null;
  status: "angelegt" | "uebersprungen" | "abgelehnt";
  grund?: string;
}

/* ---------- Ein kleiner CSV-Parser, ohne Paket ----------
   Unterstützt Anführungszeichen (mit verdoppeltem Escape), Kommas und
   Zeilenumbrüche in Feldern, sowie CRLF- und LF-Zeilenenden. */
function csvParsen(text: string): string[][] {
  const zeilen: string[][] = [];
  let zeile: string[] = [];
  let feld = "";
  let inAnfuehrung = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inAnfuehrung) {
      if (c === '"') {
        if (text[i + 1] === '"') { feld += '"'; i++; continue; }
        inAnfuehrung = false; continue;
      }
      feld += c; continue;
    }
    if (c === '"') { inAnfuehrung = true; continue; }
    if (c === ',') { zeile.push(feld); feld = ""; continue; }
    if (c === '\r') continue;
    if (c === '\n') { zeile.push(feld); zeilen.push(zeile); zeile = []; feld = ""; continue; }
    feld += c;
  }
  if (feld.length > 0 || zeile.length > 0) { zeile.push(feld); zeilen.push(zeile); }
  return zeilen.filter(z => !(z.length === 1 && z[0] === ""));
}

/* Leerer Zellinhalt wird zu `undefined` — sonst würde z.B. `z.coerce.number()`
   aus einer leeren Zeichenkette die Zahl 0 machen (§ falsche Nullen). */
const leer = (v: string | undefined): string | undefined => (v === undefined || v.trim() === "" ? undefined : v.trim());

export async function csvImportieren(person: Person, kontext: OrgKontext, text: string): Promise<CsvZeilenErgebnis[]> {
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) throw new AppError("VALIDATION", "Die Datei ist grösser als 1 MB", { datei: "zu gross" });

  const zeilen = csvParsen(text);
  const kopf = zeilen[0]?.map(s => s.trim()) ?? [];
  const kopfOk = kopf.length === KOPFZEILE.length && KOPFZEILE.every((h, i) => kopf[i] === h);
  if (!kopfOk) {
    throw new AppError("VALIDATION", `Die Kopfzeile muss genau lauten: ${KOPFZEILE.join(",")}`, { kopfzeile: "ungültig" });
  }
  const datenzeilen = zeilen.slice(1);
  if (datenzeilen.length > MAX_ZEILEN) {
    throw new AppError("VALIDATION", `Ein Import umfasst höchstens ${MAX_ZEILEN} Zeilen`, { zeilen: "zu viele" });
  }

  const ergebnisse: CsvZeilenErgebnis[] = [];
  for (const [i, felder] of datenzeilen.entries()) {
    const zeileNr = i + 2; // 1 = Kopfzeile
    let externalRef: string | null = null;
    try {
      if (felder.length !== KOPFZEILE.length) throw new AppError("VALIDATION", "Die Zeile hat nicht die erwartete Anzahl Spalten");
      const roh = Object.fromEntries(KOPFZEILE.map((h, idx) => [h, felder[idx]])) as Record<(typeof KOPFZEILE)[number], string | undefined>;

      externalRef = (roh.external_ref ?? "").trim();
      if (!externalRefGueltig(externalRef)) throw new AppError("VALIDATION", "external_ref fehlt oder ist ungültig (1–80 Zeichen, keine Steuerzeichen)");

      const daten = EntwurfSchema.parse({
        trans: leer(roh.trans), typ: leer(roh.typ), ortId: leer(roh.ortId),
        zimmer: leer(roh.zimmer), flaeche: leer(roh.flaeche), preis: leer(roh.preis),
        titel: leer(roh.titel), beschreibung: leer(roh.beschreibung), sprache: leer(roh.sprache) ?? "de"
      });

      /* Wiederholbar: vorher prüfen, nicht auf den Unique-Index warten
         (0017: listing_org_external_ref). */
      const vorhanden = await sql`SELECT 1 FROM listing WHERE published_by_org_id = ${kontext.org.id} AND external_ref = ${externalRef} LIMIT 1`;
      if (vorhanden[0]) { ergebnisse.push({ zeile: zeileNr, externalRef, status: "uebersprungen" }); continue; }

      /* Jede Zeile bleibt ein Entwurf — kein Statuswechsel, keine
         Veröffentlichung durch den Import (§30). */
      const angelegt = await entwurfAnlegen(person, daten, { kontext });
      await sql`UPDATE listing SET external_ref = ${externalRef} WHERE public_ref = ${angelegt.publicRef}`;
      ergebnisse.push({ zeile: zeileNr, externalRef, status: "angelegt" });
    } catch (err) {
      const ae = asAppError(err);
      ergebnisse.push({ zeile: zeileNr, externalRef, status: "abgelehnt", grund: ae.message });
    }
  }

  log.info("import.csv", { org: kontext.org.id, actor: person.id, zeilen: ergebnisse.length,
    angelegt: ergebnisse.filter(e => e.status === "angelegt").length,
    uebersprungen: ergebnisse.filter(e => e.status === "uebersprungen").length,
    abgelehnt: ergebnisse.filter(e => e.status === "abgelehnt").length });
  return ergebnisse;
}
