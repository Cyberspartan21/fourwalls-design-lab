import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { firma } from "./company";

/* Das Start-Tor (P5.9 Phase B) — die eine Stelle, die entscheidet, ob die
   Produktion öffentlich erscheinen darf: nur, wenn die Firmenangaben, die
   in strukturierten Daten und im Auftritt als Tatsache stehen, bestätigt
   sind UND jede Rechtsseite freigegeben ist (nicht nur angelegt).

   Rechtsseiten: WP4 legt content/rechtliches/de/<key>.md mit Frontmatter
   `stand: LEGAL_REVIEW_REQUIRED` an; erst ein Wechsel auf `stand:
   FREIGEGEBEN` (Geschäftsentscheid, kein Code-Flag — siehe config/policy.ts
   zusage()) zählt hier als vorhanden. Fehlt die Datei ganz (WP4 noch nicht
   fertig, oder ein anderer Umgebungspfad), gilt sie als fehlend — diese
   Datei liest tolerant, sie bricht nie.

   Verwendung: app/robots.ts (Disallow: / in Produktion, solange nicht
   bereit) und app/api/ready/route.ts (meldet die fehlenden Punkte, ohne den
   Health-Check selbst zu brechen). Server-only wegen fs — nie im
   Client-Bündel. */

const RECHTSSEITEN_KEYS = ["impressum", "datenschutz", "agb", "inseratsbedingungen", "anbieterbedingungen"] as const;
const FIRMENFELDER = ["markenname", "firmierung", "strasse", "plzOrt", "telefon", "email"] as const;

/* Liest `stand: …` aus dem YAML-Frontmatter einer Markdown-Datei — bewusst
   ohne YAML-Bibliothek, das Frontmatter dieser Dateien ist eine flache
   Schlüssel-Wert-Liste (siehe content/wissen/de/*.md als Vorbild). */
function frontmatterStand(pfad: string): string | null {
  let text: string;
  try {
    text = readFileSync(pfad, "utf8");
  } catch {
    return null;
  }
  const block = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/.exec(text);
  if (!block) return null;
  const zeile = /^stand:\s*(\S+)\s*$/m.exec(block[1]!);
  return zeile ? zeile[1]! : null;
}

export function startTor(): { bereit: boolean; fehlend: string[] } {
  const fehlend: string[] = [];

  for (const feld of FIRMENFELDER) {
    if (firma[feld].stand !== "bestaetigt") fehlend.push(`company.${feld}`);
  }

  for (const key of RECHTSSEITEN_KEYS) {
    const pfad = join(process.cwd(), "content", "rechtliches", "de", `${key}.md`);
    if (frontmatterStand(pfad) !== "FREIGEGEBEN") fehlend.push(`rechtliches.${key}`);
  }

  return { bereit: fehlend.length === 0, fehlend };
}

/* Ist ein Rechtstext freigegeben? Die Sitemap nimmt Rechtsseiten erst auf,
   wenn sie nicht mehr noindex sind — sonst widerspräche die Sitemap dem
   robots-Meta der Seite. */
export function rechtsseiteFreigegeben(key: (typeof RECHTSSEITEN_KEYS)[number]): boolean {
  return frontmatterStand(join(process.cwd(), "content", "rechtliches", "de", `${key}.md`)) === "FREIGEGEBEN";
}
