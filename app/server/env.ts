import "server-only";
import { EnvSchema, type Env } from "@/domain/env";

/* Alle Umgebungsvariablen an einer Stelle, beim Start geprüft.
   Kein process.env.X irgendwo sonst in der Anwendung.

   Die eigentliche Prüflogik (Schema + Regeln) steht in domain/env.ts — rein,
   ohne „server-only“, damit tests/env.test.ts sie mit einem selbstgebauten
   Objekt aufrufen kann, ohne process.env zu mutieren und ohne unter
   node --test an „server-only“ zu scheitern (das hier importierte Modul ist
   unter node --test nicht importierbar, siehe Kommentar dort). Diese Datei
   trägt nur noch: process.env lesen, einmal je Prozess zwischenspeichern,
   beim ersten Fehlschlag laut scheitern. */

export type { Env };

let geprueft: Env | null = null;

export function env(): Env {
  if (geprueft) return geprueft;
  const ergebnis = EnvSchema.safeParse(process.env);
  if (!ergebnis.success) {
    const zeilen = ergebnis.error.issues.map(i => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    /* Absichtlich ohne die Werte selbst — die Meldung landet im Protokoll. */
    throw new Error(`Umgebung unvollständig oder ungültig:\n${zeilen}`);
  }
  geprueft = ergebnis.data;
  return geprueft;
}

export const istProduktion = () => env().APP_ENV === "production";
export const istStaging = () => env().APP_ENV === "staging";
/* Demo-Bestand: Entwicklung und Staging ja, Produktion nie (P5.5 §12/§42). */
/* Demo-Inhalte-Tor (P5.10 §34/§35): die eine Stelle, die entscheidet, ob
   Demo-Inserate und Demo-Organisationen ausgeliefert werden. Ausserhalb der
   Produktion ohne Angabe „an“ (siehe domain/env.ts-Default-Verhalten); in
   Produktion ist die Variable Pflicht und wird nie stillschweigend ersetzt. */
export const demoSichtbar = () => (env().DEMO_INHALTE ?? "an") === "an";
