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
