import { test } from "node:test";
import assert from "node:assert/strict";
import { orgDarf, darfRolleVergeben, ORG_ROLLE_RECHTE, ORG_RECHTE } from "../domain/orgrechte.ts";

test("Teamrollen sind Bündel — viewer liest, agent arbeitet, admin führt, owner alles", () => {
  assert.equal(orgDarf("viewer", "VIEW_ORG_LISTINGS"), true);
  assert.equal(orgDarf("viewer", "CREATE_LISTING"), false);
  assert.equal(orgDarf("agent", "SUBMIT_ORG_LISTING"), true);
  assert.equal(orgDarf("agent", "ASSIGN_LISTING"), false);
  assert.equal(orgDarf("agent", "MANAGE_MEMBERS"), false);
  assert.equal(orgDarf("admin", "MANAGE_MEMBERS"), true);
  assert.equal(orgDarf("admin", "MANAGE_ORGANIZATION"), false, "Stilllegen und Stammdaten bleiben der Besitzerin");
  assert.equal(ORG_ROLLE_RECHTE.owner.length, ORG_RECHTE.length);
  assert.equal(orgDarf(null, "VIEW_ORG_LISTINGS"), false);
});

test("Kein Teamrecht heisst je ein Plattformrecht", async () => {
  const { RECHTE } = await import("../domain/rechte.ts");
  for (const r of ORG_RECHTE) assert.equal((RECHTE as readonly string[]).includes(r), false, r);
});

test("Rollen vergeben: nie über die eigene Stufe, owner nur durch owner", () => {
  assert.equal(darfRolleVergeben("admin", "agent"), true);
  assert.equal(darfRolleVergeben("admin", "owner"), false);
  assert.equal(darfRolleVergeben("owner", "owner"), true);
  assert.equal(darfRolleVergeben("agent", "viewer"), false);
});
