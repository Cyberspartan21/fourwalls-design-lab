import { test } from "node:test";
import assert from "node:assert/strict";
import { darf, darfEntwurfBearbeiten, darfEinreichen, darfEntwurfSehen, darfFreigeben, darfVeroeffentlichen, darfZuweisen,
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

/* ---------- P5.7: professionelle Inserate ---------- */
test("Ein Inserat der Organisation gehört dem Team, nicht der anlegenden Person", () => {
  const orgInserat: Inserat = { ownerId: "u-anna", orgId: "org-alpha", status: "draft" };
  const alphaAgent = { orgId: "org-alpha", rolle: "agent" as const };
  const betaOwner = { orgId: "org-beta", rolle: "owner" as const };
  /* Die Anlegerin ohne (mehr) Mitgliedschaft sieht nichts mehr (§38/§67). */
  assert.equal(darfEntwurfSehen(anna, orgInserat, null).erlaubt, false);
  assert.equal(darfEntwurfBearbeiten(bruno, orgInserat, alphaAgent).erlaubt, true);
  assert.equal(darfEinreichen(bruno, orgInserat, alphaAgent).erlaubt, true);
  /* Agentur Beta hat mit Alphas Inserat nichts zu tun — auch nicht als Besitzerin (§66). */
  assert.equal(darfEntwurfSehen(bruno, orgInserat, betaOwner).erlaubt, false);
  assert.equal(darfEntwurfBearbeiten(bruno, orgInserat, betaOwner).erlaubt, false);
  /* viewer liest, schreibt nicht. */
  assert.equal(darfEntwurfSehen(bruno, orgInserat, { orgId: "org-alpha", rolle: "viewer" }).erlaubt, true);
  assert.equal(darfEntwurfBearbeiten(bruno, orgInserat, { orgId: "org-alpha", rolle: "viewer" }).erlaubt, false);
});

test("Zuweisen braucht das Teamrecht; Moderation nie durch das eigene Büro", () => {
  const orgInserat: Inserat = { ownerId: null, orgId: "org-alpha", status: "submitted" };
  assert.equal(darfZuweisen(orgInserat, { orgId: "org-alpha", rolle: "agent" }).erlaubt, false);
  assert.equal(darfZuweisen(orgInserat, { orgId: "org-alpha", rolle: "admin" }).erlaubt, true);
  assert.equal(darfZuweisen({ ownerId: "u-anna", status: "draft" }, { orgId: "org-alpha", rolle: "owner" }).erlaubt, false, "Privatinserat kennt keine Zuweisung");
  /* Eine Moderatorin, die im Büro Alpha arbeitet, gibt Alphas Inserat nicht frei. */
  assert.equal(darfFreigeben(mod, orgInserat, { orgId: "org-alpha", rolle: "viewer" }).erlaubt, false);
  assert.equal(darfFreigeben(mod, orgInserat, null).erlaubt, true);
});

/* ---------- P5.8: Geschäftsrechte ---------- */
test("Anliegen an FOURWALLS bearbeitet das Personal, nicht die Moderation", () => {
  assert.equal(darf("staff", "VIEW_SERVICE_LEADS"), true);
  assert.equal(darf("staff", "MANAGE_SERVICE_LEADS"), true);
  assert.equal(darf("staff", "VIEW_MODERATION_QUEUE"), false);
  assert.equal(darf("moderator", "VIEW_SERVICE_LEADS"), false, "Moderation ist kein Maklergeschäft (§56)");
  assert.equal(darf("user", "VIEW_SERVICE_LEADS"), false);
  assert.equal(darf("admin", "ASSIGN_SERVICE_LEAD"), true);
});

