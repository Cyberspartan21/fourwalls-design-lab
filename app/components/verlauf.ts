/* Zuletzt angesehen, anonym — reine Browser-Ablage, wie components/favorites.ts.

   Angemeldete Personen bekommen ihren Verlauf server-seitig (server/verlauf.ts,
   Tabelle recently_viewed) — dieses Repository ist nur für Besuche ohne
   Konto. Neuestes zuerst, höchstens 24 Einträge, keine Duplikate: wer eine
   Immobilie erneut ansieht, bekommt keinen zweiten Eintrag, sondern einen
   neuen Zeitstempel ganz vorne. */

export interface VerlaufEintrag { ref: string; zeit: number }

export interface VerlaufRepository {
  hinzufuegen(ref: string): void;
  alle(): VerlaufEintrag[];
}

const SCHLUESSEL = "fw-verlauf";
const HOECHSTZAHL = 24;

export class LocalStorageVerlauf implements VerlaufRepository {
  private lesen(): VerlaufEintrag[] {
    try {
      const v = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? "[]");
      return Array.isArray(v) ? v.filter((x): x is VerlaufEintrag => x && typeof x.ref === "string" && typeof x.zeit === "number") : [];
    } catch { return []; }
  }
  private schreiben(l: VerlaufEintrag[]) { try { localStorage.setItem(SCHLUESSEL, JSON.stringify(l)); } catch { /* privater Modus o. ä. */ } }

  hinzufuegen(ref: string): void {
    const ohne = this.lesen().filter(e => e.ref !== ref);
    const l = [{ ref, zeit: Date.now() }, ...ohne].slice(0, HOECHSTZAHL);
    this.schreiben(l);
  }

  alle(): VerlaufEintrag[] {
    return this.lesen().sort((a, b) => b.zeit - a.zeit);
  }
}

let instanz: VerlaufRepository | null = null;
export function verlauf(): VerlaufRepository { return (instanz ??= new LocalStorageVerlauf()); }
