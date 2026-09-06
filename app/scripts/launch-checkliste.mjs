#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Launch-Checkliste (P5.10 §39)

   Holt die Bereitschaftsprüfung (config/bereitschaft.ts, vier Tore:
   TECH/BUSINESS/LEGAL/INFRA) über die bereits laufende Anwendung und schreibt
   sie als Markdown-Tabellen nach docs/LAUNCH-CHECKLIST.md; das vollständige
   JSON geht auf stdout.

   Warum über HTTP und nicht per direktem Import von config/bereitschaft.ts:
   Diese Datei trägt „server-only" (wirft ausserhalb eines Server-Bündels)
   und ihre Importe nutzen den „@/"-Alias, den nur der TypeScript-/Next.js-
   Bau versteht — ein eigenständiges Node-Skript kann beides nicht ohne
   zusätzliche Werkzeuge auflösen. scripts/seed-profis.mjs löst dieselbe
   Frage schon so: „Kontenanlage läuft über die echte HTTP-API" statt über
   einen Import. app/api/ready/route.ts liefert die Prüfung bereits fertig
   unter dem Feld `launch` — das ist hier die einzige Quelle.

   Aufruf:
     node scripts/launch-checkliste.mjs [http://localhost:3007]

   Voraussetzung: die Anwendung läuft bereits (kein eigener Start hier —
   siehe docs/PROJECT-ISOLATION-RULE.md, Entwicklungsserver nicht anfassen).
   ============================================================ */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HIER, "..");
const BASIS = (process.argv.find(a => a.startsWith("http")) || "http://localhost:3007").replace(/\/$/, "");
const ZIEL = join(APP_ROOT, "..", "docs", "LAUNCH-CHECKLIST.md");

const BEREICHE = [
  { key: "tech", titel: "TECH" },
  { key: "business", titel: "BUSINESS" },
  { key: "legal", titel: "LEGAL" },
  { key: "infra", titel: "INFRA" }
];

const STATUS_ZEICHEN = { ok: "✓ ok", fehlt: "✗ fehlt", unentschieden: "? unentschieden" };

function tabelle(punkte) {
  const kopf = "| ID | Titel | Status | Blocker | Beleg |\n|---|---|---|---|---|";
  const zeilen = punkte.map(p =>
    `| \`${p.id}\` | ${p.titel} | ${STATUS_ZEICHEN[p.status] ?? p.status} | ${p.blocker ? "ja" : "nein"} | ${p.beleg.replace(/\|/g, "\\|")} |`
  );
  return [kopf, ...zeilen].join("\n");
}

function markdown(launch) {
  const zeit = new Date(launch.erstelltAm ?? Date.now()).toISOString();
  const teile = [
    "# FOURWALLS — Launch-Checkliste",
    "",
    `Automatisch erzeugt von \`scripts/launch-checkliste.mjs\` am ${zeit}. Nicht von Hand bearbeiten —`,
    "die eine Quelle der Wahrheit ist `config/bereitschaft.ts` (P5.10 §3/§4).",
    "",
    `**launchReady: ${launch.launchReady ? "JA" : "NEIN"}** — wahr nur, wenn TECH, BUSINESS, LEGAL und INFRA alle bereit sind.`,
    ""
  ];
  for (const { key, titel } of BEREICHE) {
    const ready = launch[`${key}Ready`];
    teile.push(`## ${titel} — ${ready ? "bereit" : "nicht bereit"}`, "", tabelle(launch.tore[key]), "");
  }
  return teile.join("\n");
}

async function main() {
  let antwort;
  try {
    antwort = await fetch(`${BASIS}/api/ready`);
  } catch (e) {
    console.error(`Konnte ${BASIS}/api/ready nicht erreichen — läuft die Anwendung? (${e.message})`);
    process.exit(2);
  }
  const daten = await antwort.json();
  const launch = daten.launch;
  if (!launch || !launch.tore) {
    console.error("Antwort von /api/ready enthält kein `launch`-Feld — Format geändert?");
    process.exit(3);
  }

  mkdirSync(dirname(ZIEL), { recursive: true });
  writeFileSync(ZIEL, markdown(launch), "utf8");
  console.error(`Geschrieben: ${ZIEL}`);
  console.log(JSON.stringify(launch, null, 2));
}

main();
