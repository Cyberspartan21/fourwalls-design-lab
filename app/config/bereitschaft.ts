import "server-only";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { sql } from "@/server/db";
import { env } from "@/server/env";
import { firma } from "./company";
import { offeneAussagen } from "./policy";
import { bereitschaftAus, type BereitschaftsErgebnis, type BereitschaftsEingaben } from "@/domain/bereitschaft";

export type { Punkt, BereitschaftStatus, BereitschaftsErgebnis } from "@/domain/bereitschaft";

/* Die Bereitschaftsprüfung (P5.10 §3/§4) — sammelt Tatsachen aus Datenbank,
   Umgebung und Dateisystem und übergibt sie an die reine Ableitung
   `bereitschaftAus()` (domain/bereitschaft.ts). Vier Tore — TECH, BUSINESS,
   LEGAL, INFRA — die NIE zu einem einzigen Boolean verschmelzen; erst
   `launchReady` fasst sie zusammen, und auch das nur als „alle vier wahr",
   nie als eigene Regel.

   Server-only: liest die Datenbank (Migrationsstand) und das Dateisystem
   (Rechtstexte, Backup-Nachweis, CI-Skripte). Keine Geheimnisse, keine
   Konfigurationswerte in den Belegen — nur neutrale, technische Aussagen
   („Mailversand: Entwicklungssenke" statt „MAIL_PROVIDER=dev"). */

const RECHTSSEITEN: { key: "impressum" | "datenschutz" | "agb" | "inseratsbedingungen" | "anbieterbedingungen"; titel: string }[] = [
  { key: "impressum", titel: "Impressum" },
  { key: "datenschutz", titel: "Datenschutzerklärung" },
  { key: "agb", titel: "Allgemeine Geschäftsbedingungen" },
  { key: "inseratsbedingungen", titel: "Inseratsbedingungen" },
  { key: "anbieterbedingungen", titel: "Anbieterbedingungen" }
];

const FIRMENFELDER: { feld: keyof typeof firma; titel: string }[] = [
  { feld: "markenname", titel: "Markenname" },
  { feld: "firmierung", titel: "Firmierung" },
  { feld: "rechtsform", titel: "Rechtsform" },
  { feld: "uid", titel: "UID / Handelsregister-Nummer" },
  { feld: "strasse", titel: "Strasse" },
  { feld: "plzOrt", titel: "PLZ/Ort" },
  { feld: "telefon", titel: "Telefon" },
  { feld: "email", titel: "E-Mail" }
];

function frontmatterStand(pfad: string): string | null {
  let text: string;
  try { text = readFileSync(pfad, "utf8"); } catch { return null; }
  const block = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/.exec(text);
  if (!block) return null;
  const zeile = /^stand:\s*(\S+)\s*$/m.exec(block[1]!);
  return zeile ? zeile[1]! : null;
}

async function migrationenTatsachen(): Promise<{ aktuell: boolean; beleg: string }> {
  try {
    /* Lokal liegt db/ neben app/ (../db), im Abbild unter /app/db (Dockerfile). */
    const kandidaten = [join(process.cwd(), "..", "db", "migrations"), join(process.cwd(), "db", "migrations")];
    const ordner = kandidaten.find(k => existsSync(k));
    if (!ordner) return { aktuell: false, beleg: "Migrationsverzeichnis nicht gefunden (db/migrations fehlt im Arbeitsverzeichnis)" };
    const dateien = readdirSync(ordner).filter(f => /^\d{4}_.*\.sql$/.test(f));
    const zeilen = await sql`SELECT name FROM schema_migration`;
    const angewandt = new Set(zeilen.map(z => String(z.name)));
    const fehlend = dateien.filter(f => !angewandt.has(f));
    return fehlend.length === 0
      ? { aktuell: true, beleg: `${dateien.length}/${dateien.length} Migrationen angewendet` }
      : { aktuell: false, beleg: `${dateien.length - fehlend.length}/${dateien.length} Migrationen angewendet` };
  } catch {
    return { aktuell: false, beleg: "Migrationsstand nicht ermittelbar (Datenbankabfrage fehlgeschlagen)" };
  }
}

function instrumentationAktiv(): { aktiv: boolean; beleg: string } {
  try {
    const text = readFileSync(join(process.cwd(), "instrumentation.ts"), "utf8");
    const aktiv = /register/.test(text) && /verarbeiten/.test(text);
    return { aktiv, beleg: aktiv ? "instrumentation.ts registriert den Outbox-Arbeiter" : "instrumentation.ts registriert keinen Outbox-Arbeiter" };
  } catch { return { aktiv: false, beleg: "instrumentation.ts nicht gefunden" }; }
}

function sitemapRobotsVorhanden(): { vorhanden: boolean; beleg: string } {
  const robots = existsSync(join(process.cwd(), "app", "robots.ts"));
  const sitemap = existsSync(join(process.cwd(), "app", "sitemap.ts"));
  return { vorhanden: robots && sitemap, beleg: robots && sitemap ? "robots.ts und sitemap.ts vorhanden" : "robots.ts oder sitemap.ts fehlt" };
}

function ciSuitesVorhanden(): { vorhanden: boolean; beleg: string } {
  try {
    const skripte = readdirSync(join(process.cwd(), "scripts")).filter(f => /-test\.mjs$/.test(f));
    const unitTests = readdirSync(join(process.cwd(), "tests")).filter(f => /\.test\.ts$/.test(f));
    const vorhanden = skripte.length > 0 && unitTests.length > 0;
    return { vorhanden, beleg: `${skripte.length} Integrationsskripte, ${unitTests.length} Unit-Testdateien` };
  } catch { return { vorhanden: false, beleg: "Testverzeichnisse nicht lesbar" }; }
}

function backupNachweis(): { vorhanden: boolean; beleg: string } {
  /* Dokumentation liegt im Repo-Root (../docs neben app/); im Container fehlt
     sie — dann gilt «fehlt», bis Produktion einen eigenen Nachweis liefert. */
  const kandidaten = [join(process.cwd(), "..", "docs", "backup-nachweis.json"), join(process.cwd(), "docs", "backup-nachweis.json")];
  const pfad = kandidaten.find(k => existsSync(k)) ?? kandidaten[0]!;
  if (!existsSync(pfad)) return { vorhanden: false, beleg: "Kein Backup-Nachweis vorhanden." };
  try {
    const daten = JSON.parse(readFileSync(pfad, "utf8")) as Record<string, unknown>;
    const rohdatum = (daten.datum ?? daten.date ?? daten.zeitpunkt) as string | undefined;
    const zeit = rohdatum ? new Date(rohdatum).getTime() : NaN;
    if (Number.isNaN(zeit)) return { vorhanden: false, beleg: "Backup-Nachweis ohne lesbares Datum." };
    const tageAlt = (Date.now() - zeit) / 86_400_000;
    return tageAlt < 30
      ? { vorhanden: true, beleg: "Backup-Nachweis vorhanden und aktuell (<30 Tage)." }
      : { vorhanden: false, beleg: "Backup-Nachweis ist älter als 30 Tage." };
  } catch { return { vorhanden: false, beleg: "Backup-Nachweis nicht lesbar." }; }
}

const S3_LOKALE_ENDPUNKTE = /localhost|127\.0\.0\.1|minio/i;

export async function bereitschaft(): Promise<BereitschaftsErgebnis> {
  let envGueltig = true, envBeleg = "Umgebungsschema gültig";
  let infra: BereitschaftsEingaben["infra"] = {
    appEnvProduktion: false, siteUrlOk: false, mailOk: false, storageOk: false, datenbankOk: false,
    backupNachweisVorhanden: false, backupNachweisBeleg: "Umgebung ungültig — nicht ermittelbar"
  };
  let speicherKonfiguriert = false, speicherBeleg = "Umgebung ungültig — nicht ermittelbar";

  try {
    const e = env();
    const backup = backupNachweis();
    infra = {
      appEnvProduktion: e.APP_ENV === "production",
      siteUrlOk: e.NEXT_PUBLIC_SITE_URL.startsWith("https://") && !/localhost|127\.0\.0\.1/.test(e.NEXT_PUBLIC_SITE_URL),
      mailOk: e.MAIL_PROVIDER !== "dev",
      storageOk: e.STORAGE_PROVIDER === "s3" && !!e.S3_ENDPOINT && !S3_LOKALE_ENDPUNKTE.test(e.S3_ENDPOINT),
      datenbankOk: !/localhost|127\.0\.0\.1/.test(e.DATABASE_URL),
      backupNachweisVorhanden: backup.vorhanden, backupNachweisBeleg: backup.beleg
    };
    speicherKonfiguriert = true;
    speicherBeleg = e.STORAGE_PROVIDER === "s3" ? "Objektspeicher: S3 konfiguriert" : "Objektspeicher: lokal (Entwicklung)";
  } catch (fehler) {
    envGueltig = false;
    envBeleg = fehler instanceof Error ? "Umgebungsschema ungültig" : "Umgebungsschema ungültig (unbekannter Fehler)";
  }

  const migrationen = await migrationenTatsachen();
  const instrumentation = instrumentationAktiv();
  const sitemapRobots = sitemapRobotsVorhanden();
  const ciSuites = ciSuitesVorhanden();

  const eingaben: BereitschaftsEingaben = {
    tech: {
      migrationenAktuell: migrationen.aktuell, migrationenBeleg: migrationen.beleg,
      envGueltig, envBeleg,
      outboxAktiv: instrumentation.aktiv, outboxBeleg: instrumentation.beleg,
      speicherKonfiguriert, speicherBeleg,
      sitemapRobotsVorhanden: sitemapRobots.vorhanden, sitemapRobotsBeleg: sitemapRobots.beleg,
      ciSuitesVorhanden: ciSuites.vorhanden, ciSuitesBeleg: ciSuites.beleg
    },
    business: {
      firmenfelder: FIRMENFELDER.map(({ feld, titel }) => ({ feld, titel, stand: firma[feld].stand === "bestaetigt" ? "bestaetigt" : firma[feld].stand === "platzhalter" ? "platzhalter" : "offen" })),
      offeneAussagen: offeneAussagen().map(a => ({ schluessel: a.schluessel, hatEntscheid: Boolean((a as unknown as { entscheid?: unknown }).entscheid) }))
    },
    legal: {
      rechtsseiten: RECHTSSEITEN.map(({ key, titel }) => ({
        key, titel,
        freigegeben: frontmatterStand(join(process.cwd(), "content", "rechtliches", "de", `${key}.md`)) === "FREIGEGEBEN"
      }))
    },
    infra
  };

  return bereitschaftAus(eingaben);
}

/* Rechtsseite freigegeben? Für die Sitemap (P5.9 Phase B) — sie nimmt
   Rechtsseiten erst auf, wenn sie nicht mehr noindex sind. */
export function rechtsseiteFreigegeben(key: (typeof RECHTSSEITEN)[number]["key"]): boolean {
  return frontmatterStand(join(process.cwd(), "content", "rechtliches", "de", `${key}.md`)) === "FREIGEGEBEN";
}
