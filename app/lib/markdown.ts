import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type ReactNode } from "react";

/* Ein kleiner, sicherer Renderer für die Rechtstexte und die Vertrauensseite
   (P5.9 Phase B). Bewusst ohne Bibliothek — der Bedarf ist eng: Frontmatter
   mit ein paar flachen Feldern, dazu Überschriften, Absätze, Listen, Fett
   und Links.

   Bewusst `.ts`, nicht `.tsx`: `createElement` statt JSX, damit diese Datei
   auch ohne Bundler direkt läuft — insbesondere in `node --test`
   (tests/markdown.test.ts), das TypeScript nativ entkleidet, aber kein JSX
   übersetzt.

   Bewusst OHNE `import "server-only"` (anders als server/*.ts): wie die
   übrigen Dateien unter lib/ (mailtext.ts, ratelimit.ts, …) ist das hier ein
   geteilter Helfer ohne Geheimnisse. Der `node:fs`-Zugriff schützt sich
   selbst — ein Client-Bundle kann `node:fs` gar nicht auflösen, der Build
   schlägt dann fehl, bevor irgendetwas ausgeliefert wird.

   Sicherheitsregel, verbindlich: Es gibt KEIN `dangerouslySetInnerHTML` und
   KEIN Parsen von HTML-Tags aus dem Text. Jeder Textbaustein wird als reine
   Zeichenkette an React übergeben — React escaped das selbst beim Rendern
   (`<script>` im Quelltext bleibt sichtbarer Text, wird nie ausgeführt).
   Links werden zusätzlich geprüft: nur relative Pfade (beginnend mit `/`)
   oder `https://` — kein `javascript:`, kein `data:`. */

export type Stand = string;

export interface Frontmatter {
  titel: string;
  stand: Stand;
  zuletztGeprueft: string | null;
  quelle: string;
}

export interface RechtsDokument extends Frontmatter {
  body: string;
}

/* ---------- Frontmatter ----------
   Absichtlich kein YAML-Parser: nur flache `schluessel: wert`-Zeilen
   zwischen zwei `---`-Zeilen. Werte sind eine Zahl, `null`, `true`/`false`
   oder eine Zeichenkette (optional in Anführungszeichen). Reicht für die
   Felder, die die Rechtstexte brauchen (titel, stand, zuletztGeprueft,
   quelle) — mehr ist hier nicht vorgesehen. */
function parseWert(roh: string): string | null {
  const t = roh.trim();
  if (t === "null" || t === "") return null;
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
  return t;
}

export function parseFrontmatter(quelltext: string): { frontmatter: Record<string, string | null>; body: string } {
  const zeilen = quelltext.replace(/\r\n/g, "\n").split("\n");
  if (zeilen[0]?.trim() !== "---") return { frontmatter: {}, body: quelltext.trim() };
  const frontmatter: Record<string, string | null> = {};
  let i = 1;
  for (; i < zeilen.length; i++) {
    const zeile = zeilen[i]!;
    if (zeile.trim() === "---") { i++; break; }
    const treffer = zeile.match(/^([a-zA-Z][a-zA-Z0-9]*):\s?(.*)$/);
    if (!treffer) continue;
    frontmatter[treffer[1]!] = parseWert(treffer[2]!);
  }
  const body = zeilen.slice(i).join("\n").trim();
  return { frontmatter, body };
}

/* ---------- Lesen mit Cache ----------
   Ein Prozess liest jede Datei höchstens einmal. Die Inhalte ändern sich zur
   Laufzeit nicht (Redaktion geht über eine neue Bereitstellung); ein Neustart
   des Servers genügt, um eine Änderung zu übernehmen. */
const CACHE = new Map<string, RechtsDokument>();

const RECHTLICHES_ORDNER = path.join(process.cwd(), "content", "rechtliches");

export function rechtsDokument(locale: string, schluessel: string): RechtsDokument {
  const cacheKey = `${locale}/${schluessel}`;
  const bekannt = CACHE.get(cacheKey);
  if (bekannt) return bekannt;

  const datei = path.join(RECHTLICHES_ORDNER, locale, `${schluessel}.md`);
  const roh = readFileSync(datei, "utf8");
  const { frontmatter, body } = parseFrontmatter(roh);
  const dokument: RechtsDokument = {
    titel: frontmatter.titel ?? schluessel,
    stand: frontmatter.stand ?? "LEGAL_REVIEW_REQUIRED",
    zuletztGeprueft: frontmatter.zuletztGeprueft ?? null,
    quelle: frontmatter.quelle ?? "",
    body
  };
  CACHE.set(cacheKey, dokument);
  return dokument;
}

/* ---------- Markdown → React ----------
   Unterstützt: `## `/`### ` Überschriften, Absätze, `- `-Listen, `**fett**`
   und `[text](ziel)`-Links. Alles andere bleibt einfacher Text — kein
   Fehlschlagen, kein Verschlucken von Inhalt. */

/* Nur relative Pfade oder https — nie `javascript:`, `data:` oder anderes. */
function sichereHref(ziel: string): string | null {
  const z = ziel.trim();
  if (z.startsWith("/") && !z.startsWith("//")) return z;
  if (/^https:\/\//i.test(z)) return z;
  return null;
}

/* Inline-Text einer Zeile in React-Knoten: Fett und Links, sonst reiner Text. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const knoten: ReactNode[] = [];
  const muster = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let letzte = 0;
  let n = 0;
  let treffer: RegExpExecArray | null;
  while ((treffer = muster.exec(text)) !== null) {
    if (treffer.index > letzte) knoten.push(text.slice(letzte, treffer.index));
    if (treffer[1] !== undefined) {
      knoten.push(createElement("strong", { key: `${keyPrefix}-${n++}` }, treffer[1]));
    } else {
      const linkText = treffer[2]!;
      const href = sichereHref(treffer[3]!);
      knoten.push(href ? createElement("a", { key: `${keyPrefix}-${n++}`, href }, linkText) : linkText);
    }
    letzte = muster.lastIndex;
  }
  if (letzte < text.length) knoten.push(text.slice(letzte));
  return knoten;
}

export function renderMarkdown(quelltext: string): ReactNode[] {
  const bloecke: ReactNode[] = [];
  const zeilen = quelltext.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let n = 0;
  while (i < zeilen.length) {
    const zeile = zeilen[i]!;
    if (zeile.trim() === "") { i++; continue; }

    const ueberschrift3 = zeile.match(/^###\s+(.*)$/);
    const ueberschrift2 = zeile.match(/^##\s+(.*)$/);
    if (ueberschrift3) { bloecke.push(createElement("h3", { key: `b${n++}` }, inline(ueberschrift3[1]!, `h3-${n}`))); i++; continue; }
    if (ueberschrift2) { bloecke.push(createElement("h2", { key: `b${n++}` }, inline(ueberschrift2[1]!, `h2-${n}`))); i++; continue; }

    if (/^-\s+/.test(zeile)) {
      const punkte: string[] = [];
      while (i < zeilen.length && /^-\s+/.test(zeilen[i]!)) { punkte.push(zeilen[i]!.replace(/^-\s+/, "")); i++; }
      bloecke.push(createElement("ul", { key: `b${n++}` },
        punkte.map((p, j) => createElement("li", { key: j }, inline(p, `li-${n}-${j}`)))));
      continue;
    }

    /* Ein Absatz reicht bis zur nächsten Leerzeile / Überschrift / Liste. */
    const absatzZeilen: string[] = [];
    while (i < zeilen.length && zeilen[i]!.trim() !== "" && !/^#{2,3}\s+/.test(zeilen[i]!) && !/^-\s+/.test(zeilen[i]!)) {
      absatzZeilen.push(zeilen[i]!); i++;
    }
    bloecke.push(createElement("p", { key: `b${n++}` }, inline(absatzZeilen.join(" "), `p-${n}`)));
  }
  return bloecke;
}
