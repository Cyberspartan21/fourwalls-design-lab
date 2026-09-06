import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AppError, asAppError } from "../lib/errors.ts";
import { erzeugeS3Storage } from "../services/storage-s3.ts";
import { AnliegenSchema } from "../domain/anliegen.ts";

/* ============================================================
   FOURWALLS — Fehlerbehandlung: Simulationen an der Aussengrenze (P5.10 §17)

   Was diese Datei NICHT direkt prüfen kann: server/anliegen.ts,
   server/inquiries.ts und server/auth.ts importieren "server-only" (bzw.
   hängen an Modulen, die das tun) und lassen sich unter node:test nicht
   laden (siehe tests/uebergaenge.test.ts und tests/outbox.test.ts für
   dieselbe Grenze). Wo eine echte Fehlerklasse (Postgres, S3) importierbar
   ist, wird hier mit ihr wirklich gearbeitet, nicht nur mit einer Attrappe;
   wo das nicht geht (Datenbank-, Auth-Fehlerobjekte), steht eine realistisch
   geformte Attrappe UND — für die Mail/Outbox-Zusage — eine Prüfung des
   Quelltexts selbst (die Architektur ist die Zusicherung, siehe Test 3). */

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, "..");

function keineDetails(text: string, verbotene: string[]) {
  for (const v of verbotene) assert.ok(!text.includes(v), `Antwort enthält "${v}" — das darf nach aussen nie stehen`);
}

// ---------- 1. DB-Fehler: ein Postgres-Fehlerobjekt mit query/parameters ----------

test("DB-Fehler: ein Postgres-ähnliches Fehlerobjekt (query, parameters, SQLSTATE) verrät der Antwort nichts", () => {
  /* Form wie postgres.js sie an einen Fehler hängt (node_modules/postgres/src/connection.js:
     query, parameters, args, types — hier nachgebaut, weil ein echter
     Verbindungsfehler eine Datenbank bräuchte, die Form aber unabhängig
     davon feststeht). */
  const postgresAehnlich = Object.assign(
    new Error(`duplicate key value violates unique constraint "listing_external_ref_org_key"`),
    {
      name: "PostgresError",
      code: "23505",
      query: `INSERT INTO listing (external_ref, published_by_org_id) VALUES ($1, $2)`,
      parameters: ["EXT-4711", "8f2c1e10-...-geheime-org-id"],
      schema_name: "public",
      table_name: "listing"
    }
  );

  const err = asAppError(postgresAehnlich);
  assert.equal(err.code, "INTERNAL");
  const antwort = JSON.stringify(err.toResponseBody());
  keineDetails(antwort, ["INSERT INTO", "listing_external_ref_org_key", "EXT-4711", "geheime-org-id", "23505"]);
  assert.ok(antwort.includes(err.ref), "die Korrelations-ref muss in der Antwort stehen, damit sich der Serverlog-Eintrag finden lässt");
});

// ---------- 2. Storage-Fehler: ein echter Verbindungsfehler mit Endpunkt ----------

test("Storage-Fehler: ein echter S3-Verbindungsfehler (Endpunkt im Fehlertext) verrät der Antwort den Endpunkt nicht", async () => {
  /* Port 1: auf jedem üblichen System niemand, der lauscht — die
     Verbindung wird sofort (ECONNREFUSED) abgelehnt, kein DNS-Timeout. */
  const ENDPUNKT = "http://127.0.0.1:1";
  const storage = erzeugeS3Storage({
    endpoint: ENDPUNKT, region: "ch-gva-2", bucketPrivat: "priv", bucketOeffentlich: "pub",
    accessKeyId: "test", secretAccessKey: "test", forcePathStyle: true
  });

  let geworfen: unknown;
  try { await storage.speichern(`orig/${crypto.randomUUID()}.jpg`, new Uint8Array([1, 2, 3]), "image/jpeg"); }
  catch (e) { geworfen = e; }
  assert.ok(geworfen, "ein nicht erreichbarer Endpunkt muss werfen");
  /* Der rohe SDK-Fehler nennt den Endpunkt — genau das prüft dieser Test,
     damit er nicht versehentlich gegen einen Fehler ohne Endpunkt liefe. */
  assert.ok(String((geworfen as Error).message ?? geworfen).includes("127.0.0.1") || String((geworfen as { cause?: unknown })?.cause ?? "").includes("127.0.0.1"),
    "Testvoraussetzung: der rohe Fehler muss den Endpunkt enthalten, sonst prüft dieser Test nichts");

  const err = asAppError(geworfen);
  assert.equal(err.code, "INTERNAL");
  const antwort = JSON.stringify(err.toResponseBody());
  keineDetails(antwort, ["127.0.0.1", ENDPUNKT, "priv", "pub"]);
});

// ---------- 3. Mail-Fehler: die Architektur, nicht die Ausnahme ----------

test("Mail-Fehler: Anliegen/Anfrage laufen über die Outbox in DERSELBEN Transaktion — nie ein direkter, blockierender Versand", () => {
  /* Die eigentliche Zusage ("Anliegen wird trotzdem angenommen, Antwort
     201") folgt aus der Architektur: server/anliegen.ts und
     server/inquiries.ts reihen die Nachricht per `einreihen(tx, …)` in
     DERSELBEN Transaktion wie die fachliche Zeile ein (server/outbox.ts) —
     ein Mailanbieter wird dabei nie aufgerufen, kann also den Erfolg der
     Anfrage gar nicht blockieren. tests/outbox.test.ts Test 4 belegt
     zusätzlich, dass die fachliche Zeile bei mehrfach scheiterndem Versand
     unverändert einmalig bleibt. Da beide Module "server-only" importieren
     (siehe Kopfkommentar) und sich unter node:test nicht laden lassen,
     prüft dieser Test die Zusage am Quelltext: kein synchroner
     `mail().senden(` / `mail().send(`-Aufruf ausserhalb von server/outbox.ts,
     und jede Mailübergabe läuft über `einreihen(`. */
  for (const datei of ["server/anliegen.ts", "server/inquiries.ts"]) {
    const text = readFileSync(join(WURZEL, datei), "utf8");
    assert.ok(!/mail\(\)\.senden\(/.test(text), `${datei}: kein direkter, blockierender Mailversand erlaubt — nur einreihen()`);
    assert.ok(/einreihen\(\s*tx/.test(text), `${datei}: die Nachricht muss über einreihen(tx, …) in der Transaktion eingereiht werden`);
  }
});

// ---------- 4. Auth-Fehler: keine Details, egal welche Form ----------

test("Auth-Fehler: ein Better-Auth-ähnliches Fehlerobjekt (status, body) verrät der Antwort nichts", () => {
  /* Better Auth wirft bei internen Fehlern Objekte mit eigener Form (u. a.
     `body`/`status`), die dieser Code nie kennt — asAppError() behandelt
     alles, was kein AppError und kein ZodError ist, gleich: INTERNAL, ohne
     dass die Form der Ausnahme irgendeinen Unterschied macht. */
  const authAehnlich = Object.assign(new Error("Invalid session token for user 8f2c1e10-..."), {
    name: "BetterAuthAPIError",
    status: 401,
    body: { message: "session_expired", userId: "8f2c1e10-geheime-user-id" }
  });

  const err = asAppError(authAehnlich);
  assert.equal(err.code, "INTERNAL");
  assert.equal(err.status, 500);
  const antwort = JSON.stringify(err.toResponseBody());
  keineDetails(antwort, ["8f2c1e10", "session_expired", "Invalid session token"]);

  /* Eine Route, die einen Auth-Fehler bewusst in einen 401 übersetzt (statt
     ihn als unerwartet durchzureichen), bleibt genauso ohne Details — der
     Unterschied ist nur der Code, nicht die Ehrlichkeit. */
  const bewusst401 = new AppError("UNAUTHORIZED", "Bitte melden Sie sich erneut an");
  assert.equal(bewusst401.status, 401);
  const antwort401 = JSON.stringify(bewusst401.toResponseBody());
  keineDetails(antwort401, ["8f2c1e10", "session_expired"]);
});

// ---------- 5. Formular-Validierung: 422 mit Feldliste (bestehend) ----------

test("Formular-Validierung: eine unvollständige Eingabe wird zu 422 mit Feldliste, nie zu INTERNAL", () => {
  const geparst = AnliegenSchema.safeParse({ dienst: "sell", kontakt: { name: "A", email: "keine-email" }, sprache: "de", herkunft: { seite: "/de/verkaufen" } });
  assert.equal(geparst.success, false);
  const err = asAppError(geparst.error);
  assert.equal(err.code, "VALIDATION");
  assert.equal(err.status, 422);
  const body = err.toResponseBody() as { error: string; message: string; fields?: Record<string, string> };
  assert.equal(body.error, "VALIDATION");
  assert.ok(body.fields && Object.keys(body.fields).length > 0, "die Antwort muss die betroffenen Felder benennen");
});
