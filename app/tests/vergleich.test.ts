import { test } from "node:test";
import assert from "node:assert/strict";
import { LocalStorageVergleich } from "../components/vergleich.ts";

/* Node kennt localStorage nur experimentell (und dispatchEvent/addEventListener
   gar nicht global, das sind Browser-Funktionen) — ein einfacher In-Memory-
   Ersatz genügt für die reine Logik von LocalStorageVergleich. */
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
const speicher = new MemoryStorage();
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = speicher;
(globalThis as unknown as { dispatchEvent: (e: unknown) => void }).dispatchEvent = () => {};

test("Vergleich: Obergrenze 4 — die fünfte Referenz wird abgelehnt", () => {
  speicher.clear();
  const v = new LocalStorageVergleich();
  assert.equal(v.hinzufuegen("FWL-2026-000001"), true);
  assert.equal(v.hinzufuegen("FWL-2026-000002"), true);
  assert.equal(v.hinzufuegen("FWL-2026-000003"), true);
  assert.equal(v.hinzufuegen("FWL-2026-000004"), true);
  assert.equal(v.hinzufuegen("FWL-2026-000005"), false, "fünfte Referenz muss abgelehnt werden");
  assert.deepEqual(v.alle(), ["FWL-2026-000001", "FWL-2026-000002", "FWL-2026-000003", "FWL-2026-000004"]);
});

test("Vergleich: kein Duplikat — dieselbe Referenz erneut hinzufügen ändert nichts", () => {
  speicher.clear();
  const v = new LocalStorageVergleich();
  assert.equal(v.hinzufuegen("FWL-2026-000001"), true);
  assert.equal(v.hinzufuegen("FWL-2026-000001"), true, "schon enthalten — kein Fehler, kein zweiter Eintrag");
  assert.deepEqual(v.alle(), ["FWL-2026-000001"]);
  assert.equal(v.hat("FWL-2026-000001"), true);
  assert.equal(v.hat("FWL-2026-999999"), false);
});

test("Vergleich: entfernen macht Platz für eine neue Referenz", () => {
  speicher.clear();
  const v = new LocalStorageVergleich();
  for (const r of ["FWL-2026-000001", "FWL-2026-000002", "FWL-2026-000003", "FWL-2026-000004"]) v.hinzufuegen(r);
  assert.equal(v.hinzufuegen("FWL-2026-000005"), false, "voll");
  v.entfernen("FWL-2026-000002");
  assert.deepEqual(v.alle(), ["FWL-2026-000001", "FWL-2026-000003", "FWL-2026-000004"]);
  assert.equal(v.hinzufuegen("FWL-2026-000005"), true, "nach dem Entfernen ist wieder Platz");
  assert.deepEqual(v.alle(), ["FWL-2026-000001", "FWL-2026-000003", "FWL-2026-000004", "FWL-2026-000005"]);
});
