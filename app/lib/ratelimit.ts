/* Ratenbegrenzung hinter einer Schnittstelle.

   Die Entwicklungsfassung zählt im Speicher eines Prozesses. Das genügt für
   eine Instanz und ist ehrlich als solche gekennzeichnet: Sobald mehrere
   Instanzen laufen, braucht es einen gemeinsamen Speicher (Postgres-Tabelle
   oder Redis) hinter derselben Schnittstelle — siehe docs/BETRIEB-GRENZEN.md,
   Abschnitt „Ratenbegrenzung“, für den Entwurf eines Postgres-Speichers
   (P5.10 §22). Bewusst NICHT hier eingebaut: ein Speicher, der eine
   Datenbank berührt, ändert das Verhalten unter Last (Latenz, zusätzliche
   Verbindungen) — das ist eine Entscheidung für den Produktions-Anlauf,
   nicht etwas, das diese Härtungsrunde nebenbei mitentscheidet. Die
   Schnittstelle unten trennt genau an dieser Stelle: `RatenSpeicher` ist
   der austauschbare Teil (Zählung + Fälligkeit), `speicherLimiter()` bleibt
   die einzige heute verkabelte Fassung davon. */

/* Der Adapter-Ausschnitt: alles, was ein Speicher für die Ratenbegrenzung
   braucht — lesen, erhöhen, mit eigener Fälligkeit (TTL) je Schlüssel. Eine
   Postgres- oder Redis-Fassung müsste nur DIESE zwei Methoden erfüllen. */
export interface RatenSpeicher {
  get(schluessel: string): Promise<{ zaehler: number; bis: number } | undefined>;
  /* Setzt bei abgelaufenem/fehlendem Eintrag auf {zaehler:1, bis: jetzt+fensterMs}
     zurück, sonst zählt sie hoch — und liefert den Stand danach. */
  increment(schluessel: string, fensterMs: number): Promise<{ zaehler: number; bis: number }>;
}

export interface RateLimiter {
  /* true = erlaubt. Verbraucht ein Kontingent, wenn erlaubt. */
  erlaubt(schluessel: string): Promise<boolean>;
}

/* Die heutige, einzige Fassung von RatenSpeicher: eine Map im Prozess. */
function speicherRatenSpeicher(): RatenSpeicher {
  const eimer = new Map<string, { zaehler: number; bis: number }>();
  return {
    async get(schluessel) {
      const e = eimer.get(schluessel);
      return e && e.bis >= Date.now() ? e : undefined;
    },
    async increment(schluessel, fensterMs) {
      const jetzt = Date.now();
      const e = eimer.get(schluessel);
      if (!e || e.bis < jetzt) { const neu = { zaehler: 1, bis: jetzt + fensterMs }; eimer.set(schluessel, neu); return neu; }
      e.zaehler++;
      return e;
    }
  };
}

/* Ein RateLimiter über einem beliebigen RatenSpeicher — für einen künftigen
   Postgres-/Redis-Adapter reicht es, hier einen anderen Speicher zu
   übergeben; die Zählregel selbst (max pro Fenster) bleibt unverändert. */
export function limiterAufSpeicher(speicher: RatenSpeicher, maxProFenster: number, fensterMs: number): RateLimiter {
  return {
    async erlaubt(schluessel) {
      const stand = await speicher.increment(schluessel, fensterMs);
      return stand.zaehler <= maxProFenster;
    }
  };
}

export function speicherLimiter(maxProFenster: number, fensterMs: number): RateLimiter {
  return limiterAufSpeicher(speicherRatenSpeicher(), maxProFenster, fensterMs);
}

/* Herkunft ohne Speicherung der IP: ein gesalzener Hash reicht zum Zählen. */
export async function herkunftHash(ip: string, salz: string): Promise<string> {
  const daten = new TextEncoder().encode(salz + "|" + ip);
  const digest = await crypto.subtle.digest("SHA-256", daten);
  return Array.from(new Uint8Array(digest)).slice(0, 12).map(b => b.toString(16).padStart(2, "0")).join("");
}
