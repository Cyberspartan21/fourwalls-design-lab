import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DATENKLASSEN,
  alleinigeEigentuemerschaften,
  kontoLoeschungBlockiertDurchEigentum,
  klassifiziereInserat,
  type OrgMitgliedschaftFuerLoeschung
} from "../domain/kontoloeschung.ts";

/* ---------- DATENKLASSEN: die Datenkarte selbst ---------- */

test("DATENKLASSEN: jeder Schlüssel ist eindeutig", () => {
  const schluessel = DATENKLASSEN.map(d => d.schluessel);
  assert.equal(new Set(schluessel).size, schluessel.length);
});

test("DATENKLASSEN: jede Zeile trägt eine Begründung und eine gültige Behandlung", () => {
  const GUELTIG = new Set(["LOESCHEN", "ANONYMISIEREN", "BLEIBT_FREMDES_EIGENTUM", "ZURUECKGESTELLT_RECHTSENTSCHEID", "BLEIBT"]);
  for (const d of DATENKLASSEN) {
    assert.ok(GUELTIG.has(d.behandlung), `${d.schluessel}: unbekannte Behandlung ${d.behandlung}`);
    assert.ok(d.begruendung.length > 10, `${d.schluessel}: Begründung fehlt oder ist zu kurz`);
    assert.ok(["Person", "Organisation", "Fourwalls"].includes(d.eigentuemer), `${d.schluessel}: unbekannter Eigentümer`);
  }
});

test("DATENKLASSEN: app_user wird anonymisiert, nie gelöscht (Tombstone, §9)", () => {
  const appUser = DATENKLASSEN.find(d => d.schluessel === "app_user");
  assert.ok(appUser);
  assert.equal(appUser!.behandlung, "ANONYMISIEREN");
});

test("DATENKLASSEN: kein Eintrag behauptet eine Frist (Aufbewahrung bleibt unentschieden)", () => {
  for (const d of DATENKLASSEN) {
    assert.doesNotMatch(d.begruendung, /\b\d+\s*(Tage|Monate|Jahre|days|months|years)\b/i, `${d.schluessel}: Begründung nennt eine Frist`);
  }
});

/* ---------- Sole-Owner-Erkennung (§10) ---------- */

const mitgliedschaft = (teil: Partial<OrgMitgliedschaftFuerLoeschung>): OrgMitgliedschaftFuerLoeschung => ({
  orgId: "org-1", orgName: "Alpha AG", rolle: "owner", organisationAktiv: true, weitereAktiveEigentuemerinVorhanden: false, ...teil
});

test("Alleinige Besitzerin einer aktiven Organisation blockiert die Löschung", () => {
  const m = [mitgliedschaft({})];
  assert.equal(kontoLoeschungBlockiertDurchEigentum(m), true);
  assert.equal(alleinigeEigentuemerschaften(m).length, 1);
});

test("Eine weitere aktive Besitzerin hebt die Blockade auf", () => {
  const m = [mitgliedschaft({ weitereAktiveEigentuemerinVorhanden: true })];
  assert.equal(kontoLoeschungBlockiertDurchEigentum(m), false);
});

test("Eine stillgelegte Organisation blockiert nicht mehr, auch als einzige Besitzerin", () => {
  const m = [mitgliedschaft({ organisationAktiv: false })];
  assert.equal(kontoLoeschungBlockiertDurchEigentum(m), false);
});

test("Admin/Agent/Viewer blockieren nie, unabhängig von weiteren Besitzerinnen", () => {
  for (const rolle of ["admin", "agent", "viewer"] as const) {
    const m = [mitgliedschaft({ rolle })];
    assert.equal(kontoLoeschungBlockiertDurchEigentum(m), false, `Rolle ${rolle} sollte nicht blockieren`);
  }
});

test("Mehrere Organisationen: nur die tatsächlich alleinigen werden gemeldet", () => {
  const m = [
    mitgliedschaft({ orgId: "org-1", orgName: "Alpha AG" }),                                    // alleinige Besitzerin
    mitgliedschaft({ orgId: "org-2", orgName: "Beta AG", weitereAktiveEigentuemerinVorhanden: true }), // nicht alleinig
    mitgliedschaft({ orgId: "org-3", orgName: "Gamma AG", rolle: "admin" })                       // keine Besitzerin
  ];
  const blockierend = alleinigeEigentuemerschaften(m);
  assert.equal(blockierend.length, 1);
  assert.equal(blockierend[0]!.orgId, "org-1");
});

test("Keine Mitgliedschaften: keine Blockade", () => {
  assert.equal(kontoLoeschungBlockiertDurchEigentum([]), false);
});

/* ---------- Klassifikation eines Inserats (§9) ---------- */

test("Organisationsinserate sind immer fremdes Eigentum, unabhängig vom Status", () => {
  for (const status of ["draft", "published", "archived"] as const) {
    assert.equal(klassifiziereInserat({ orgId: "org-1", status }), "fremdes_eigentum");
  }
});

test("Private Entwürfe/Prüfstand werden gelöscht", () => {
  for (const status of ["draft", "submitted", "in_review", "changes_required", "rejected"] as const) {
    assert.equal(klassifiziereInserat({ orgId: null, status }), "loeschen", `Status ${status}`);
  }
});

test("Private, öffentlich (gewesene) Inserate werden zurückgestellt (archiviert)", () => {
  for (const status of ["published", "reserved", "paused", "expired", "sold", "rented", "archived"] as const) {
    assert.equal(klassifiziereInserat({ orgId: null, status }), "zurueckstellen", `Status ${status}`);
  }
});
