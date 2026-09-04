import { test } from "node:test";
import assert from "node:assert/strict";
import { darf, darfEntwurfBearbeiten, darfEinreichen, darfEntwurfSehen, darfFreigeben, darfVeroeffentlichen,
  darfVorschauSehen, ROLLE_RECHTE, type Person, type Inserat } from "../domain/rechte.ts";

const anna: Person = { id: "u-anna", rolle: "user", emailBestaetigt: true };
const bruno: Person = { id: "u-bruno", rolle: "user", emailBestaetigt: true };
const mod: Person = { id: "u-mod", rolle: "moderator", emailBestaetigt: true };
const entwurfVonAnna: Inserat = { ownerId: "u-anna", status: "draft" };

test("Rollen bündeln Rechte — niemand hat einen Generalschlüssel ausser admin", () => {
  assert.equal(darf("user", "CREATE_OWN_LISTING"), true);
  assert.equal(darf("user", "APPROVE_LISTING"), false);
  assert.equal(darf("staff", "VIEW_MODERATION_QUEUE"), false);
  assert.equal(darf("moderator", "APPROVE_LISTING"), true);
  /* admin und moderator tragen in P5.4 dieselben Rechte: Rollenvergabe läuft
     nicht über die Anwendung, sondern über die Konsole (scripts/rolle.mjs).
     Sobald es Verwaltungsrechte in der Oberfläche gibt, trennen sie sich hier. */
  assert.equal(ROLLE_RECHTE.moderator.every(r => ROLLE_RECHTE.admin.includes(r)), true);
  assert.equal(darf(null, "CREATE_OWN_LISTING"), false);
});

test("Fremde Entwürfe sind unsichtbar — auch für die Moderation, solange sie Entwurf sind", () => {
  assert.equal(darfEntwurfSehen(anna, entwurfVonAnna).erlaubt, true);
  assert.equal(darfEntwurfSehen(bruno, entwurfVonAnna).erlaubt, false);
  assert.equal(darfEntwurfSehen(mod, entwurfVonAnna).erlaubt, false, "Entwurf ist noch nicht eingereicht");
  assert.equal(darfEntwurfSehen(mod, { ownerId: "u-anna", status: "submitted" }).erlaubt, true);
});

test("Bearbeiten nur im eigenen Entwurf und nur im richtigen Zustand", () => {
  assert.equal(darfEntwurfBearbeiten(anna, entwurfVonAnna).erlaubt, true);
  assert.equal(darfEntwurfBearbeiten(bruno, entwurfVonAnna).erlaubt, false);
  const e = darfEntwurfBearbeiten(anna, { ownerId: "u-anna", status: "submitted" });
  assert.equal(e.erlaubt, false);
  assert.equal(e.erlaubt === false && e.grund, "falscher-zustand");
  assert.equal(darfEntwurfBearbeiten(anna, { ownerId: "u-anna", status: "changes_required" }).erlaubt, true);
});

test("Einreichen verlangt eine bestätigte E-Mail", () => {
  const unbestaetigt: Person = { ...anna, emailBestaetigt: false };
  const e = darfEinreichen(unbestaetigt, entwurfVonAnna);
  assert.equal(e.erlaubt, false);
  assert.equal(e.erlaubt === false && e.grund, "email-unbestaetigt");
  assert.equal(darfEinreichen(anna, entwurfVonAnna).erlaubt, true);
});

test("Eine Moderatorin gibt ihr eigenes Inserat nicht frei", () => {
  const eigenes: Inserat = { ownerId: "u-mod", status: "submitted" };
  const e = darfFreigeben(mod, eigenes);
  assert.equal(e.erlaubt, false);
  assert.equal(e.erlaubt === false && e.grund, "eigenes-inserat");
  assert.equal(darfFreigeben(mod, { ownerId: "u-anna", status: "submitted" }).erlaubt, true);
});

test("Veröffentlichen nur aus «freigegeben», und nie durch die Eigentümerin", () => {
  assert.equal(darfVeroeffentlichen(mod, { ownerId: "u-anna", status: "approved" }).erlaubt, true);
  assert.equal(darfVeroeffentlichen(mod, { ownerId: "u-anna", status: "submitted" }).erlaubt, false);
  assert.equal(darfVeroeffentlichen(anna, { ownerId: "u-anna", status: "approved" }).erlaubt, false);
});

test("Vorschau: ohne Sitzung nichts", () => {
  const e = darfVorschauSehen(null, entwurfVonAnna);
  assert.equal(e.erlaubt, false);
  assert.equal(e.erlaubt === false && e.grund, "keine-sitzung");
  assert.equal(darfVorschauSehen(anna, entwurfVonAnna).erlaubt, true);
  assert.equal(darfVorschauSehen(bruno, entwurfVonAnna).erlaubt, false);
});
