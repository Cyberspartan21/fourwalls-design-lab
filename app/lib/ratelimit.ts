/* Ratenbegrenzung hinter einer Schnittstelle.

   Die Entwicklungsfassung zählt im Speicher eines Prozesses. Das genügt für
   eine Instanz und ist ehrlich als solche gekennzeichnet: Sobald mehrere
   Instanzen laufen, braucht es einen gemeinsamen Speicher (Postgres-Tabelle
   oder Redis) hinter derselben Schnittstelle. */

export interface RateLimiter {
  /* true = erlaubt. Verbraucht ein Kontingent, wenn erlaubt. */
  erlaubt(schluessel: string): Promise<boolean>;
}

export function speicherLimiter(maxProFenster: number, fensterMs: number): RateLimiter {
  const eimer = new Map<string, { zaehler: number; bis: number }>();
  return {
    async erlaubt(schluessel) {
      const jetzt = Date.now();
      const e = eimer.get(schluessel);
      if (!e || e.bis < jetzt) { eimer.set(schluessel, { zaehler: 1, bis: jetzt + fensterMs }); return true; }
      if (e.zaehler >= maxProFenster) return false;
      e.zaehler++;
      return true;
    }
  };
}

/* Herkunft ohne Speicherung der IP: ein gesalzener Hash reicht zum Zählen. */
export async function herkunftHash(ip: string, salz: string): Promise<string> {
  const daten = new TextEncoder().encode(salz + "|" + ip);
  const digest = await crypto.subtle.digest("SHA-256", daten);
  return Array.from(new Uint8Array(digest)).slice(0, 12).map(b => b.toString(16).padStart(2, "0")).join("");
}
