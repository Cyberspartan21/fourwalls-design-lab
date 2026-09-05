/* Merkliste hinter einer Grenze.

   Heute: localStorage im Browser, ohne Konto — wie im Prototyp. Sobald es
   Konten gibt, tritt ein Server-Repository an dieselbe Schnittstelle; die
   Komponenten ändern sich nicht. Der Schlüssel ist die öffentliche Referenz,
   nie die interne ID.

   `kippen()` löst in BEIDEN Implementierungen selbst das Ereignis
   "fw:merkliste" aus — an einer Stelle, statt an jeder Aufrufstelle dupliziert
   (Karten, Objektkopf, Merkliste). Aufrufer lösen es nicht mehr selbst aus. */

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
  kippen(ref: string) {
    const l = this.lesen(); const i = l.indexOf(ref);
    if (i >= 0) l.splice(i, 1); else l.push(ref);
    this.schreiben(l);
    dispatchEvent(new Event("fw:merkliste"));
    return i < 0;
  }
  alle() { return this.lesen(); }
}

/* Serverseitige Merkliste einer angemeldeten Person. Kann nicht synchron aus
   der Datenbank lesen — deshalb ein In-Memory-Zwischenspeicher, der beim
   Laden der Seite einmal mit dem Serverstand vorgefüllt wird
   (initialisiereServerFavoriten). `kippen()` schaltet optimistisch im Speicher
   um und gleicht im Hintergrund mit dem Server ab; scheitert der Aufruf,
   macht es die Änderung rückgängig und meldet den echten Stand erneut. */
export class ServerFavorites implements FavoriteRepository {
  private menge: Set<string>;
  constructor(refs: string[]) { this.menge = new Set(refs); }

  hat(ref: string) { return this.menge.has(ref); }

  kippen(ref: string): boolean {
    const warGemerkt = this.menge.has(ref);
    if (warGemerkt) this.menge.delete(ref); else this.menge.add(ref);
    dispatchEvent(new Event("fw:merkliste"));

    fetch("/api/favoriten", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ publicRef: ref })
    }).then(async res => {
      if (!res.ok) throw new Error("favoriten.kippen fehlgeschlagen");
      const daten = (await res.json()) as { gemerkt: boolean };
      /* Der Server ist die Wahrheit: weicht der optimistische Stand ab, korrigieren. */
      if (daten.gemerkt !== this.menge.has(ref)) {
        if (daten.gemerkt) this.menge.add(ref); else this.menge.delete(ref);
        dispatchEvent(new Event("fw:merkliste"));
      }
    }).catch(() => {
      /* Netzwerkfehler, Ratenlimit, abgelaufene Sitzung: rückgängig machen. */
      if (warGemerkt) this.menge.add(ref); else this.menge.delete(ref);
      dispatchEvent(new Event("fw:merkliste"));
    });

    return !warGemerkt;
  }

  alle() { return [...this.menge]; }
}

let instanz: FavoriteRepository | null = null;
export function favorites(): FavoriteRepository { return (instanz ??= new LocalStorageFavorites()); }

/* Von einer Seite aufzurufen, die weiss, dass eine Sitzung besteht — ersetzt
   die anonyme Singleton-Instanz durch den Serverstand. */
export function initialisiereServerFavoriten(refs: string[]): void {
  instanz = new ServerFavorites(refs);
}

/* Im Anmelde-/Registrieren-Moment: die noch anonyme Merkliste einmalig ins
   Konto übernehmen. War sie leer, entfällt der Aufruf ganz. */
export async function migriereZuServer(): Promise<void> {
  const aktuelle = favorites().alle();
  if (!aktuelle.length) return;
  await fetch("/api/favoriten/merge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refs: aktuelle })
  });
  try { localStorage.removeItem(SCHLUESSEL); } catch { /* privater Modus o. ä. */ }
}
