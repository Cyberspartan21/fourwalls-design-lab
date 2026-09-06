import "server-only";
import { bereitschaft } from "./bereitschaft";
import type { Punkt } from "@/domain/bereitschaft";

/* Die Startbereitschafts-Checkliste (P5.10 §39) — dieselben vier Tore aus
   config/bereitschaft.ts, aufbereitet als flache Liste je Bereich, damit
   scripts/launch-checkliste.mjs daraus eine Markdown-Tabelle und ein JSON
   schreiben kann. Keine eigene Logik: reine Umformung. */

export type ChecklistBereich = "TECH" | "BUSINESS" | "LEGAL" | "INFRA";
export type ChecklistEintrag = Punkt & { bereich: ChecklistBereich };

export type LaunchChecklist = {
  erstelltAm: string;
  launchReady: boolean;
  bereiche: { bereich: ChecklistBereich; ready: boolean; punkte: Punkt[] }[];
  eintraege: ChecklistEintrag[];
};

export async function launchChecklist(): Promise<LaunchChecklist> {
  const b = await bereitschaft();
  const bereiche: { bereich: ChecklistBereich; ready: boolean; punkte: Punkt[] }[] = [
    { bereich: "TECH", ready: b.techReady, punkte: b.tore.tech },
    { bereich: "BUSINESS", ready: b.businessReady, punkte: b.tore.business },
    { bereich: "LEGAL", ready: b.legalReady, punkte: b.tore.legal },
    { bereich: "INFRA", ready: b.infraReady, punkte: b.tore.infra }
  ];
  const eintraege: ChecklistEintrag[] = bereiche.flatMap(g => g.punkte.map(p => ({ ...p, bereich: g.bereich })));
  return { erstelltAm: new Date().toISOString(), launchReady: b.launchReady, bereiche, eintraege };
}
