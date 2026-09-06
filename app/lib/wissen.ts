import "server-only";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { renderMarkdown } from "./markdown.ts";
import type { ReactNode } from "react";

/* Wissensseiten (P5.9 Phase B, Entscheid 24): sieben kleine, nützliche
   Beiträge je Sprache unter content/wissen/<locale>/<slug>.md. Der Body wird
   mit dem bestehenden, sicheren Renderer aus lib/markdown.ts dargestellt
   (kein zweiter Renderer) — nur das Frontmatter ist hier eigens geparst, weil
   es mehr Felder und zwei Listen (quellen, verwandt) braucht, die der
   Rechtstexte-Parser (parseFrontmatter in lib/markdown.ts) nicht kennt.

   Slugs sind in allen vier Sprachen identisch (nur der Pfad /<locale>/wissen/
   <slug> unterscheidet sich) — das macht hreflang trivial und erlaubt
   `verwandt` als reine Slug-Liste ohne Sprachbezug. */

export const VEROEFFENTLICHT = "VEROEFFENTLICHT";

/* Reihenfolge der Absichten für die Übersicht («sortiert nach Absicht/Titel»,
   siehe Auftrag) — dieselbe Reihenfolge wie die CTA-Zuordnung auf der
   Detailseite: verkaufen, bewerten, mieten, vermieten, verwalten, wissen. */
const ABSICHT_REIHENFOLGE = ["verkaufen", "bewerten", "mieten", "vermieten", "verwalten", "wissen"];

export interface WissenDokument {
  slug: string;
  titel: string;
  beschreibung: string;
  stand: string;
  aktualisiert: string;
  autor: string;
  absicht: string;
  quellen: string[];
  verwandt: string[];
  body: string;
}

const WISSEN_ORDNER = path.join(process.cwd(), "content", "wissen");

/* Nur Kleinbuchstaben, Ziffern und Bindestriche — verhindert Pfadausbrüche
   über den dynamischen Routenparameter [slug] (anders als bei den
   Rechtstexten, deren Schlüssel immer ein fest verdrahteter, zur Compile-Zeit
   bekannter Wert ist, kommt dieser Slug direkt aus der URL). */
const SLUG_MUSTER = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/* ---------- Frontmatter ----------
   Flache Felder wie `schluessel: wert` sowie zwei Listen im YAML-Block-Stil:

     quellen:
       - "erster Beleg"
       - "zweiter Beleg"
     verwandt:
       - anderer-slug

   oder als leere Liste `quellen: []`. Absichtlich kein YAML-Parser — nur das
   enge Muster, das die sieben Wissenstexte tatsächlich verwenden. */
function parseSkalar(roh: string): string {
  const t = roh.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
  return t;
}

function parseWissenFrontmatter(quelltext: string): { frontmatter: Record<string, string | string[]>; body: string } {
  const zeilen = quelltext.replace(/\r\n/g, "\n").split("\n");
  const frontmatter: Record<string, string | string[]> = {};
  if (zeilen[0]?.trim() !== "---") return { frontmatter, body: quelltext.trim() };

  let i = 1;
  for (; i < zeilen.length; i++) {
    const zeile = zeilen[i]!;
    if (zeile.trim() === "---") { i++; break; }

    const treffer = zeile.match(/^([a-zA-Z][a-zA-Z0-9]*):\s?(.*)$/);
    if (!treffer) continue;
    const schluessel = treffer[1]!;
    const rest = treffer[2]!.trim();

    if (rest === "[]") { frontmatter[schluessel] = []; continue; }
    if (rest !== "") { frontmatter[schluessel] = parseSkalar(rest); continue; }

    /* Leerer Rest: eine Liste folgt in den nächsten, eingerückten
       `  - wert`-Zeilen. */
    const liste: string[] = [];
    while (i + 1 < zeilen.length && /^\s+-\s?/.test(zeilen[i + 1]!)) {
      i++;
      liste.push(parseSkalar(zeilen[i]!.replace(/^\s+-\s?/, "")));
    }
    frontmatter[schluessel] = liste;
  }

  const body = zeilen.slice(i).join("\n").trim();
  return { frontmatter, body };
}

function alsString(v: string | string[] | undefined, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function alsListe(v: string | string[] | undefined): string[] {
  return Array.isArray(v) ? v : [];
}

/* ---------- Lesen mit Cache ----------
   Wie lib/markdown.ts: ein Prozess liest jede Datei höchstens einmal. */
const DOKUMENT_CACHE = new Map<string, WissenDokument | null>();
const SLUG_CACHE = new Map<string, string[]>();

function ladeDokument(locale: string, slug: string): WissenDokument | null {
  const cacheKey = `${locale}/${slug}`;
  if (DOKUMENT_CACHE.has(cacheKey)) return DOKUMENT_CACHE.get(cacheKey)!;

  let ergebnis: WissenDokument | null;
  try {
    const datei = path.join(WISSEN_ORDNER, locale, `${slug}.md`);
    const roh = readFileSync(datei, "utf8");
    const { frontmatter, body } = parseWissenFrontmatter(roh);
    ergebnis = {
      slug,
      titel: alsString(frontmatter.titel, slug),
      beschreibung: alsString(frontmatter.beschreibung),
      stand: alsString(frontmatter.stand, "LEGAL_REVIEW_REQUIRED"),
      aktualisiert: alsString(frontmatter.aktualisiert),
      autor: alsString(frontmatter.autor),
      absicht: alsString(frontmatter.absicht),
      quellen: alsListe(frontmatter.quellen),
      verwandt: alsListe(frontmatter.verwandt),
      body
    };
  } catch {
    ergebnis = null;
  }
  DOKUMENT_CACHE.set(cacheKey, ergebnis);
  return ergebnis;
}

function ladeSlugs(locale: string): string[] {
  const bekannt = SLUG_CACHE.get(locale);
  if (bekannt) return bekannt;
  let slugs: string[];
  try {
    slugs = readdirSync(path.join(WISSEN_ORDNER, locale))
      .filter(d => d.endsWith(".md"))
      .map(d => d.slice(0, -3));
  } catch {
    slugs = [];
  }
  SLUG_CACHE.set(locale, slugs);
  return slugs;
}

/* Einzelnes Dokument — `null` bei unbekanntem oder ungültigem Slug (die
   Route ruft dann notFound()). */
export function wissen(locale: string, slug: string): WissenDokument | null {
  if (!SLUG_MUSTER.test(slug)) return null;
  return ladeDokument(locale, slug);
}

/* Alle veröffentlichten Beiträge einer Sprache, sortiert nach Absicht (fester
   Reihenfolge, siehe ABSICHT_REIHENFOLGE) und innerhalb der Absicht nach
   Titel. */
export function alleWissen(locale: string): WissenDokument[] {
  const dokumente = ladeSlugs(locale)
    .map(slug => ladeDokument(locale, slug))
    .filter((d): d is WissenDokument => d !== null && d.stand === VEROEFFENTLICHT);

  return dokumente.sort((a, b) => {
    const ra = ABSICHT_REIHENFOLGE.indexOf(a.absicht), rb = ABSICHT_REIHENFOLGE.indexOf(b.absicht);
    if (ra !== rb) return (ra === -1 ? ABSICHT_REIHENFOLGE.length : ra) - (rb === -1 ? ABSICHT_REIHENFOLGE.length : rb);
    return a.titel.localeCompare(b.titel, locale);
  });
}

/* Body als React-Knoten — dünner Wrapper um renderMarkdown (lib/markdown.ts),
   damit Aufrufer nicht zwei Module importieren müssen. */
export function wissenBody(dokument: WissenDokument): ReactNode[] {
  return renderMarkdown(dokument.body);
}
