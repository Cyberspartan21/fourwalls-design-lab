import { test } from "node:test";
import assert from "node:assert/strict";
import { AppError, asAppError } from "../lib/errors.ts";

test("Fehlermodell: Codes tragen Status, INTERNAL verrät nichts", () => {
  assert.equal(new AppError("NOT_FOUND", "x").status, 404);
  assert.equal(new AppError("RATE_LIMIT", "x").status, 429);
  const innen = asAppError(new Error("relation \"listing\" does not exist at line 3"));
  assert.equal(innen.code, "INTERNAL");
  const body = JSON.stringify(innen.toResponseBody());
  assert.ok(!body.includes("relation"), "SQL-Text darf nicht nach aussen"); assert.ok(!body.includes("line 3"));
});

test("Fehlermodell: INTERNAL trägt eine Korrelations-ref, verschachtelt, ohne Details", () => {
  const innen = asAppError(new Error("password=geheim endpoint=https://s3.example.com/eimer"));
  const rumpf = innen.toResponseBody() as { error: { code: string; message: string; ref: string } };
  assert.equal(rumpf.error.code, "INTERNAL");
  assert.equal(rumpf.error.message, "Interner Fehler");
  assert.ok(rumpf.error.ref.length >= 6, "ref soll kurz, aber eindeutig genug sein");
  const text = JSON.stringify(rumpf);
  assert.ok(!text.includes("geheim") && !text.includes("s3.example.com"), "keine Details in der Antwort");
  /* Zwei Fehler bekommen unterschiedliche ref — sonst taugt sie nicht zur Korrelation. */
  const zweite = asAppError(new Error("x")).toResponseBody() as { error: { ref: string } };
  assert.notEqual(rumpf.error.ref, zweite.error.ref);
});

test("Fehlermodell: Fachfehler (nicht INTERNAL) bleiben flach — bestehende Verträge unverändert", () => {
  const val = new AppError("VALIDATION", "Bitte prüfen", { email: "ungültig" });
  const rumpf = val.toResponseBody() as { error: string; message: string; fields?: Record<string, string> };
  assert.equal(rumpf.error, "VALIDATION");
  assert.equal(rumpf.message, "Bitte prüfen");
  assert.deepEqual(rumpf.fields, { email: "ungültig" });
});
