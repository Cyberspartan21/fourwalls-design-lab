/* Merkliste hinter einer Grenze.

   Heute: localStorage im Browser, ohne Konto — wie im Prototyp. Sobald es
   Konten gibt, tritt ein Server-Repository an dieselbe Schnittstelle; die
   Komponenten ändern sich nicht. Der Schlüssel ist die öffentliche Referenz,
   nie die interne ID. */

export interface FavoriteRepository {
  hat(publicRef: string): boolean;
  kippen(publicRef: string): boolean;
  alle(): string[];
}

const SCHLUESSEL = "fw-merkliste";

export class LocalStorageFavorites implements FavoriteRepository {
  private lesen(): string[] {
    try { const v = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? "[]"); return Array.isArray(v) ? v.filter(x => typeof x === "string") : []; }
    catch { return []; }
  }
  private schreiben(l: string[]) { try { localStorage.setItem(SCHLUESSEL, JSON.stringify(l)); } catch { /* privater Modus o. ä. */ } }
  hat(ref: string) { return this.lesen().includes(ref); }
  kippen(ref: string) { const l = this.lesen(); const i = l.indexOf(ref); if (i >= 0) l.splice(i, 1); else l.push(ref); this.schreiben(l); return i < 0; }
  alle() { return this.lesen(); }
}

let instanz: FavoriteRepository | null = null;
export function favorites(): FavoriteRepository { return (instanz ??= new LocalStorageFavorites()); }
