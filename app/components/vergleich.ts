/* Vergleichsliste — rein clientseitig, keine Datenbank, kein Konto nötig
   (P5.6 §30ff). Wie components/favorites.ts im Aufbau, aber mit einer
   Obergrenze: höchstens vier Immobilien gleichzeitig im Vergleich.

   `hinzufuegen()` und `entfernen()` lösen wie `kippen()` in favorites.ts
   selbst das Ereignis "fw:vergleich" aus — Aufrufer lösen es nicht mehr
   selbst aus. */

export interface VergleichRepository {
  hat(ref: string): boolean;
  hinzufuegen(ref: string): boolean;
  entfernen(ref: string): void;
  alle(): string[];
}

const SCHLUESSEL = "fw-vergleich";
const HOECHSTZAHL = 4;

export class LocalStorageVergleich implements VergleichRepository {
  private lesen(): string[] {
    try { const v = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? "[]"); return Array.isArray(v) ? v.filter(x => typeof x === "string") : []; }
    catch { return []; }
  }
  private schreiben(l: string[]) { try { localStorage.setItem(SCHLUESSEL, JSON.stringify(l)); } catch { /* privater Modus o. ä. */ } }

  hat(ref: string) { return this.lesen().includes(ref); }

  hinzufuegen(ref: string): boolean {
    const l = this.lesen();
    if (l.includes(ref)) return true;
    if (l.length >= HOECHSTZAHL) return false;
    l.push(ref);
    this.schreiben(l);
    dispatchEvent(new Event("fw:vergleich"));
    return true;
  }

  entfernen(ref: string): void {
    const l = this.lesen();
    const i = l.indexOf(ref);
    if (i < 0) return;
    l.splice(i, 1);
    this.schreiben(l);
    dispatchEvent(new Event("fw:vergleich"));
  }

  alle() { return this.lesen(); }
}

let instanz: VergleichRepository | null = null;
export function vergleich(): VergleichRepository { return (instanz ??= new LocalStorageVergleich()); }
