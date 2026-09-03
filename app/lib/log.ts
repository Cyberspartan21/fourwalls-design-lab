/* Strukturiertes Protokoll: eine JSON-Zeile pro Ereignis auf stdout.
   Was NIE hineingehört: Geheimnisse, vollständige Formularinhalte, Dokumente.
   Die Aufrufstellen übergeben bewusst nur Kennungen und Klassifikationen. */

type Level = "info" | "warn" | "error";
type Felder = Record<string, string | number | boolean | null | undefined>;

const VERBOTEN = /secret|password|passwort|token|authorization|cookie|database_url/i;

function bereinigt(felder: Felder): Felder {
  const aus: Felder = {};
  for (const [k, v] of Object.entries(felder)) {
    aus[k] = VERBOTEN.test(k) ? "[entfernt]" : v;
  }
  return aus;
}

function schreibe(level: Level, ereignis: string, felder: Felder = {}): void {
  const zeile = JSON.stringify({ t: new Date().toISOString(), level, ereignis, ...bereinigt(felder) });
  if (level === "error") process.stderr.write(zeile + "\n");
  else process.stdout.write(zeile + "\n");
}

export const log = {
  info: (ereignis: string, felder?: Felder) => schreibe("info", ereignis, felder),
  warn: (ereignis: string, felder?: Felder) => schreibe("warn", ereignis, felder),
  /* Fehlerobjekte: Meldung und Name ja, Stack nur ausserhalb der Produktion. */
  error: (ereignis: string, fehler: unknown, felder?: Felder) => {
    const e = fehler instanceof Error ? fehler : new Error(String(fehler));
    schreibe("error", ereignis, {
      ...felder, fehlerName: e.name, fehlerMeldung: e.message,
      ...(process.env.APP_ENV === "production" ? {} : { stack: (e.stack ?? "").split("\n").slice(0, 6).join(" | ") })
    });
  }
};
