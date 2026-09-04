#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Prüfung der gemeinsamen Mailquelle (P5.5 §53/§54/§63)

   Beweist unabhängig von einem laufenden Anwendungsserver, dass
   scripts/lib/mailquelle.mjs für jede Quelle das Richtige tut:

     dev      schreibt eine Mail-Datei direkt in einen Testordner
              (FW_TEST_MAIL_DIR) und lässt mailquelle() sie finden.
     mailpit  schickt über nodemailer eine echte SMTP-Mail an die lokale
              Mail-Attrappe (localhost:58025, STARTTLS) und lässt
              mailquelle() sie über die HTTP-API wiederfinden.
     imap     ohne erreichbaren Server: nur die Konfigurationsprüfung —
               fehlende FW_TEST_IMAP_*-Variablen müssen zu einer klaren
               Fehlermeldung führen, nicht zu einem Absturz ohne Kontext.

   Aufruf:
     node scripts/mailquelle-test.mjs

   Exit 0, wenn alle drei Prüfungen bestehen, sonst 1.
   ============================================================ */
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
import { mailquelle } from "./lib/mailquelle.mjs";

const HIER = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HIER, "..");
const TS = Date.now();

const ergebnisse = [];
async function pruef(titel, fn) {
  try {
    const detail = (await fn()) || "ok";
    ergebnisse.push({ titel, status: "OK", detail });
    console.log(`OK      ${titel} — ${detail}`);
  } catch (e) {
    ergebnisse.push({ titel, status: "FEHLER", detail: e.message });
    console.log(`FEHLER  ${titel} — ${e.message}`);
  }
}

/* ---------- dev ---------- */
await pruef("dev: Mail in Testordner ablegen und mit mailquelle() finden", async () => {
  const testOrdner = join(APP_ROOT, "var", "mailquelle-test-dev");
  rmSync(testOrdner, { recursive: true, force: true });
  mkdirSync(testOrdner, { recursive: true });
  const empfaenger = `dev-probe+${TS}@example.com`;
  writeFileSync(join(testOrdner, "probe.json"), JSON.stringify({
    kennung: "probe", zeit: new Date().toISOString(), von: "noreply@fourwalls.example",
    an: empfaenger, betreff: "Probe dev", text: `Probetext dev ${TS} https://example.com/bestaetigen/${TS}`
  }));

  process.env.FW_TEST_MAIL_QUELLE = "dev";
  process.env.FW_TEST_MAIL_DIR = testOrdner;
  const quelle = mailquelle();
  if (quelle.name !== "dev") throw new Error(`erwartet Quelle "dev", erhalten "${quelle.name}"`);
  const fund = await quelle.warte(empfaenger, null, 5000, 250);
  rmSync(testOrdner, { recursive: true, force: true });
  delete process.env.FW_TEST_MAIL_DIR;
  if (!fund) throw new Error("keine Mail gefunden");
  if (!fund.text.includes(String(TS))) throw new Error(`unerwarteter Text: ${fund.text}`);
  return `gefunden, betreff="${fund.betreff}"`;
});

/* ---------- mailpit ---------- */
await pruef("mailpit: echte SMTP-Mail senden und mit mailquelle() wiederfinden", async () => {
  const empfaenger = `probe+${TS}@example.com`;
  const transport = nodemailer.createTransport({
    host: "localhost", port: 58025, secure: false, requireTLS: true,
    auth: { user: "fwdev", pass: "fwdev-nur-lokal" },
    tls: { rejectUnauthorized: false }
  });
  await transport.sendMail({
    from: "noreply@fourwalls.example", to: empfaenger,
    subject: `Probe mailpit ${TS}`, text: `Probetext mailpit ${TS}`
  });

  process.env.FW_TEST_MAIL_QUELLE = "mailpit";
  const quelle = mailquelle();
  if (quelle.name !== "mailpit") throw new Error(`erwartet Quelle "mailpit", erhalten "${quelle.name}"`);
  const fund = await quelle.warte(empfaenger, null, 10_000, 500);
  if (!fund) throw new Error("keine Mail über die Mailpit-API gefunden");
  if (!fund.text.includes(String(TS))) throw new Error(`unerwarteter Text: ${fund.text}`);
  return `gefunden, betreff="${fund.betreff}"`;
});

/* ---------- imap (ohne Server: nur Konfigurationsprüfung) ---------- */
await pruef("imap: fehlende Zugangsdaten → klare Fehlermeldung, kein Absturz ohne Kontext", async () => {
  delete process.env.FW_TEST_IMAP_HOST;
  delete process.env.FW_TEST_IMAP_USER;
  delete process.env.FW_TEST_IMAP_PASSWORD;
  process.env.FW_TEST_MAIL_QUELLE = "imap";
  let fehler = null;
  try { mailquelle(); } catch (e) { fehler = e; }
  if (!fehler) throw new Error("mailquelle() hat trotz fehlender IMAP-Variablen nicht geworfen");
  for (const name of ["FW_TEST_IMAP_HOST", "FW_TEST_IMAP_USER", "FW_TEST_IMAP_PASSWORD"]) {
    if (!fehler.message.includes(name)) throw new Error(`Fehlermeldung nennt ${name} nicht: ${fehler.message}`);
  }
  return `Fehlermeldung: "${fehler.message}"`;
});

delete process.env.FW_TEST_MAIL_QUELLE;

const fehlerAnzahl = ergebnisse.filter(e => e.status === "FEHLER").length;
console.log(`\n${ergebnisse.length} Prüfungen, ${fehlerAnzahl} FEHLER, ${ergebnisse.length - fehlerAnzahl} OK`);
process.exit(fehlerAnzahl > 0 ? 1 : 0);
