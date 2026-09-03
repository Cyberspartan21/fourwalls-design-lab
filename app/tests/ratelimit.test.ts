import { test } from "node:test";
import assert from "node:assert/strict";
import { speicherLimiter, herkunftHash } from "../lib/ratelimit.ts";

test("Ratenlimit: n erlaubt, n+1 verweigert, nach Fenster wieder frei", async () => {
  const l = speicherLimiter(3, 50);
  assert.equal(await l.erlaubt("a"), true); assert.equal(await l.erlaubt("a"), true); assert.equal(await l.erlaubt("a"), true);
  assert.equal(await l.erlaubt("a"), false);
  assert.equal(await l.erlaubt("b"), true, "andere Herkunft unabhängig");
  await new Promise(r => setTimeout(r, 60));
  assert.equal(await l.erlaubt("a"), true);
});
test("Herkunfts-Hash: stabil, gesalzen, keine IP im Ergebnis", async () => {
  const a = await herkunftHash("192.0.2.1", "salz"), b = await herkunftHash("192.0.2.1", "salz"), c = await herkunftHash("192.0.2.1", "anders");
  assert.equal(a, b); assert.notEqual(a, c); assert.equal(a.length, 24); assert.ok(!a.includes("192"));
});
