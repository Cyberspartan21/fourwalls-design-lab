import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter, renderMarkdown } from "../lib/markdown.ts";

test("Frontmatter: liest die vier Rechtstext-Felder, null bleibt null", () => {
  const quelltext = [
    "---",
    'titel: "Impressum"',
    "stand: LEGAL_REVIEW_REQUIRED",
    "zuletztGeprueft: null",
    'quelle: "Entwurf Fourwalls, nicht rechtlich geprüft"',
    "---",
    "",
    "Erster Absatz."
  ].join("\n");
  const { frontmatter, body } = parseFrontmatter(quelltext);
  assert.equal(frontmatter.titel, "Impressum");
  assert.equal(frontmatter.stand, "LEGAL_REVIEW_REQUIRED");
  assert.equal(frontmatter.zuletztGeprueft, null);
  assert.equal(frontmatter.quelle, "Entwurf Fourwalls, nicht rechtlich geprüft");
  assert.equal(body, "Erster Absatz.");
});

test("Frontmatter: ohne führende --- bleibt der ganze Text der Körper", () => {
  const { frontmatter, body } = parseFrontmatter("Kein Frontmatter hier.");
  assert.deepEqual(frontmatter, {});
  assert.equal(body, "Kein Frontmatter hier.");
});

/* Findet in einem verschachtelten renderMarkdown()-Ergebnis (React-Element-
   Bäume aus createElement, siehe lib/markdown.ts) jeden Text-Kindknoten. */
function alleTexte(knoten: unknown): string[] {
  if (typeof knoten === "string") return [knoten];
  if (Array.isArray(knoten)) return knoten.flatMap(alleTexte);
  if (knoten && typeof knoten === "object" && "props" in knoten) {
    const props = (knoten as { props?: { children?: unknown } }).props;
    return alleTexte(props?.children);
  }
  return [];
}
function alleTypen(knoten: unknown): string[] {
  if (Array.isArray(knoten)) return knoten.flatMap(alleTypen);
  if (knoten && typeof knoten === "object" && "type" in knoten) {
    const eigen = [(knoten as { type: unknown }).type];
    const props = (knoten as { props?: { children?: unknown } }).props;
    return [...eigen, ...alleTypen(props?.children)].filter((t): t is string => typeof t === "string");
  }
  return [];
}

test("renderMarkdown: Überschriften, Absatz, Liste, fett und Link entstehen als eigene Elemente", () => {
  const bloecke = renderMarkdown([
    "## Titel",
    "",
    "Ein Absatz mit **fett** und einem [Link](/de/datenschutz).",
    "",
    "- Erster Punkt",
    "- Zweiter Punkt"
  ].join("\n"));

  const typen = alleTypen(bloecke);
  assert.ok(typen.includes("h2"), "Überschrift fehlt");
  assert.ok(typen.includes("p"), "Absatz fehlt");
  assert.ok(typen.includes("ul") && typen.includes("li"), "Liste fehlt");
  assert.ok(typen.includes("strong"), "Fett fehlt");
  assert.ok(typen.includes("a"), "Link fehlt");

  const listenPunkte = alleTexte(bloecke).join(" ");
  assert.match(listenPunkte, /Erster Punkt/);
  assert.match(listenPunkte, /Zweiter Punkt/);
});

test("renderMarkdown: eine <script>-Eingabe wird als reiner Text übergeben, nie als Element", () => {
  const bloecke = renderMarkdown("Ein <script>alert(1)</script> Test.");
  const typen = alleTypen(bloecke);
  assert.ok(!typen.includes("script"), "es darf kein <script>-Element entstehen");

  const texte = alleTexte(bloecke).join(" ");
  assert.match(texte, /<script>alert\(1\)<\/script>/, "der Text muss unverändert als Zeichenkette erscheinen");
});

test("renderMarkdown: Links werden auf relative Pfade oder https beschränkt", () => {
  const bloecke = renderMarkdown([
    "[gut relativ](/de/datenschutz)",
    "",
    "[gut https](https://example.com)",
    "",
    "[schlecht javascript](javascript:alert(1))",
    "",
    "[schlecht doppelSlash](//böse.example)"
  ].join("\n"));

  const gefundeneLinks: string[] = [];
  function sammleHrefs(knoten: unknown): void {
    if (Array.isArray(knoten)) { knoten.forEach(sammleHrefs); return; }
    if (knoten && typeof knoten === "object" && "type" in knoten) {
      const n = knoten as { type: unknown; props?: { href?: string; children?: unknown } };
      if (n.type === "a" && typeof n.props?.href === "string") gefundeneLinks.push(n.props.href);
      sammleHrefs(n.props?.children);
    }
  }
  sammleHrefs(bloecke);

  assert.deepEqual(gefundeneLinks.sort(), ["/de/datenschutz", "https://example.com"].sort());
  const texte = alleTexte(bloecke).join(" ");
  assert.match(texte, /schlecht javascript/, "unsichere Ziele bleiben als Text, nicht als Link");
  assert.match(texte, /schlecht doppelSlash/);
});
