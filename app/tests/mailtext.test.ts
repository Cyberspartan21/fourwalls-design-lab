import { test } from "node:test";
import assert from "node:assert/strict";
import { mailtext } from "../lib/mailtext.ts";
import type { MailArt } from "../services/mail.ts";

const LOCALES = ["de", "fr", "it", "en"] as const;
const ARTEN: MailArt[] = ["verification", "password_reset", "listing_submitted", "changes_requested", "listing_published", "inquiry"];

const WERTE = { name: "Test Person", url: "https://fourwalls.example/x", titel: "Schöne Wohnung", nachricht: "Bitte ein Foto ergänzen.", referenz: "FWL-2026-000123" };

test("Für alle vier Sprachen und sechs Mailarten gibt es Betreff und Text ohne unersetzte Platzhalter", () => {
  for (const locale of LOCALES) {
    for (const art of ARTEN) {
      const { betreff, text } = mailtext(art, locale, WERTE);
      assert.ok(betreff.length > 0, `${locale}/${art}: Betreff ist leer`);
      assert.ok(text.length > 0, `${locale}/${art}: Text ist leer`);
      assert.doesNotMatch(betreff, /\{[a-z]+\}/, `${locale}/${art}: unersetzter Platzhalter im Betreff: ${betreff}`);
      assert.doesNotMatch(text, /\{[a-z]+\}/, `${locale}/${art}: unersetzter Platzhalter im Text: ${text}`);
    }
  }
});

test("Unbekannte Sprache fällt auf Deutsch zurück", () => {
  const de = mailtext("verification", "de", WERTE);
  const unbekannt = mailtext("verification", "xx", WERTE);
  assert.deepEqual(unbekannt, de);
});
