/* ============================================================
   FOURWALLS — gemeinsame Mailquelle für die Prüfskripte (P5.5 §53/§54/§63)

   Dieselben Prüfskripte (lieferkette-test.mjs, sicherheit-test.mjs, …)
   sollen unverändert gegen drei Ziele laufen:

     dev      Entwicklung: var/mail/*.json (DevMailProvider)      [Standard]
     mailpit  lokale Mail-Attrappe, HTTP-API (http://localhost:58026)
     imap     echtes Postfach (Staging), IMAPS über imapflow

   Auswahl über die Umgebungsvariable FW_TEST_MAIL_QUELLE=dev|mailpit|imap.

   export function mailquelle() liefert ein Objekt:
     {
       name,
       async neueste(empfaenger, seitMs) -> {an, betreff, text, zeit} | null,
       async warte(empfaenger, seitMs, timeoutMs = 30000, intervallMs = 1000)
     }
   `seitMs` darf null/undefined sein — dann wird nicht nach Zeit gefiltert,
   sondern einfach die neueste Nachricht an die Adresse genommen (bisheriges
   Verhalten von dev).

   Weitere Umgebungsvariablen:
     FW_TEST_MAIL_DIR                dev: Ordner statt <App-Root>/var/mail
     FW_TEST_MAILPIT_URL             mailpit: Basis-URL, Standard http://localhost:58026
     FW_TEST_IMAP_HOST/_PORT         imap: Host (Pflicht) / Port (Standard 993)
     FW_TEST_IMAP_USER/_PASSWORD     imap: Zugangsdaten (Pflicht) — werden nie ausgegeben
     FW_TEST_MAIL_BASIS              Persona-Adressen (siehe testadresse()): Plus-
                                      Adressierung auf einem einzigen echten Postfach

   Dieses Modul hat KEINE Abhängigkeit auf den "@/"-Alias oder "server-only" —
   es läuft als reines ESM-Skript, unabhängig von der Next.js-Anwendung.
   ============================================================ */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
/* scripts/lib/mailquelle.mjs -> App-Root ist zwei Ebenen höher. */
const APP_ROOT = join(HIER, "..", "..");

/* ============================================================
   Persona-Adressen
   ============================================================ */

/* Standard: <kennzeichen>+<ts>@example.com — genau wie bisher fest verdrahtet
   in den Skripten. Ist FW_TEST_MAIL_BASIS gesetzt (z. B.
   staging-persona@beispiel.ch), landen alle Personas per Plus-Adressierung in
   EINEM echten Postfach: <lokalteil>+<kennzeichen>-<ts>@<domain>. */
export function testadresse(kennzeichen, ts = Date.now()) {
  const basis = process.env.FW_TEST_MAIL_BASIS;
  if (!basis) return `${kennzeichen}+${ts}@example.com`;
  const at = basis.indexOf("@");
  if (at < 0) throw new Error(`FW_TEST_MAIL_BASIS ist keine gültige Adresse (kein @): ${basis}`);
  const lokalteil = basis.slice(0, at);
  const domain = basis.slice(at + 1);
  return `${lokalteil}+${kennzeichen}-${ts}@${domain}`;
}

/* ============================================================
   Allgemeines Polling
   ============================================================ */
async function mitPolling(fn, timeoutMs, intervallMs) {
  const start = Date.now();
  for (;;) {
    const ergebnis = await fn();
    if (ergebnis) return ergebnis;
    if (Date.now() - start > timeoutMs) return null;
    await new Promise(r => setTimeout(r, intervallMs));
  }
}

/* ============================================================
   Quelle: dev — var/mail/*.json (DevMailProvider, siehe services/mail.ts)
   ============================================================ */
function quelleDev() {
  const ordner = process.env.FW_TEST_MAIL_DIR || join(APP_ROOT, "var", "mail");

  async function neueste(empfaenger, seitMs) {
    let dateien;
    try { dateien = readdirSync(ordner).filter(f => f.endsWith(".json")); }
    catch { return null; }
    let beste = null, besteZeit = -1;
    for (const f of dateien) {
      let j; try { j = JSON.parse(readFileSync(join(ordner, f), "utf8")); } catch { continue; }
      if (j.an !== empfaenger) continue;
      const z = new Date(j.zeit).getTime();
      if (seitMs != null && z < seitMs) continue;
      if (z > besteZeit) { besteZeit = z; beste = j; }
    }
    if (!beste) return null;
    return { an: beste.an, betreff: beste.betreff, text: beste.text, zeit: beste.zeit };
  }

  return {
    name: "dev",
    neueste,
    warte: (empfaenger, seitMs, timeoutMs = 30_000, intervallMs = 1000) =>
      mitPolling(() => neueste(empfaenger, seitMs), timeoutMs, intervallMs)
  };
}

/* ============================================================
   Quelle: mailpit — HTTP-API der lokalen Mail-Attrappe
   ============================================================ */
function quelleMailpit() {
  const basis = (process.env.FW_TEST_MAILPIT_URL || "http://localhost:58026").replace(/\/$/, "");

  async function neueste(empfaenger, seitMs) {
    const suchUrl = `${basis}/api/v1/search?query=${encodeURIComponent("to:" + empfaenger)}`;
    const suchRes = await fetch(suchUrl);
    if (!suchRes.ok) throw new Error(`Mailpit-Suche fehlgeschlagen: ${suchRes.status} (${suchUrl})`);
    const suchJson = await suchRes.json();
    let nachrichten = suchJson.messages ?? [];
    if (seitMs != null) nachrichten = nachrichten.filter(m => new Date(m.Created).getTime() >= seitMs);
    if (!nachrichten.length) return null;
    nachrichten = [...nachrichten].sort((a, b) => new Date(b.Created).getTime() - new Date(a.Created).getTime());
    const id = nachrichten[0].ID;
    const nachrichtRes = await fetch(`${basis}/api/v1/message/${id}`);
    if (!nachrichtRes.ok) throw new Error(`Mailpit-Nachricht fehlgeschlagen: ${nachrichtRes.status} (id=${id})`);
    const n = await nachrichtRes.json();
    return { an: empfaenger, betreff: n.Subject, text: n.Text, zeit: n.Date };
  }

  return {
    name: "mailpit",
    neueste,
    warte: (empfaenger, seitMs, timeoutMs = 30_000, intervallMs = 1000) =>
      mitPolling(() => neueste(empfaenger, seitMs), timeoutMs, intervallMs)
  };
}

/* ============================================================
   Quelle: imap — echtes Postfach (Staging)
   ============================================================ */

/* Kein MIME-Zerlegungspaket — die Mails der Anwendung sind reiner Text ohne
   Anhang (siehe services/mail-smtp.ts). Nur das Nötigste: Kopf von Körper
   trennen, Content-Transfer-Encoding lesen, quoted-printable/base64 dekodieren. */
function kopfUndKoerperTrennen(quelltext) {
  const trennerIdx = quelltext.search(/\r?\n\r?\n/);
  if (trennerIdx < 0) return { kopfText: quelltext, koerper: "" };
  const kopfText = quelltext.slice(0, trennerIdx);
  const koerper = quelltext.slice(trennerIdx).replace(/^\r?\n\r?\n/, "");
  return { kopfText, koerper };
}

function kopfFelderLesen(kopfText) {
  /* Entfaltete Kopfzeilen (fortgesetzte Zeilen beginnen mit Leerraum). */
  const roheZeilen = kopfText.split(/\r?\n/);
  const zeilen = [];
  for (const z of roheZeilen) {
    if (/^[ \t]/.test(z) && zeilen.length) zeilen[zeilen.length - 1] += " " + z.trim();
    else zeilen.push(z);
  }
  const felder = {};
  for (const z of zeilen) {
    const p = z.indexOf(":");
    if (p < 0) continue;
    felder[z.slice(0, p).trim().toLowerCase()] = z.slice(p + 1).trim();
  }
  return felder;
}

function quotedPrintableDekodieren(s) {
  const ohneWeichenUmbruch = s.replace(/=\r?\n/g, "");
  const bytes = [];
  for (let i = 0; i < ohneWeichenUmbruch.length; i++) {
    const zeichen = ohneWeichenUmbruch[i];
    if (zeichen === "=" && /^[0-9A-Fa-f]{2}$/.test(ohneWeichenUmbruch.slice(i + 1, i + 3))) {
      bytes.push(parseInt(ohneWeichenUmbruch.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(ohneWeichenUmbruch.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

function koerperTextAus(quelltext) {
  const { kopfText, koerper } = kopfUndKoerperTrennen(quelltext);
  const felder = kopfFelderLesen(kopfText);
  const cte = (felder["content-transfer-encoding"] || "").toLowerCase();
  if (cte.includes("quoted-printable")) return quotedPrintableDekodieren(koerper);
  if (cte.includes("base64")) return Buffer.from(koerper.replace(/\s+/g, ""), "base64").toString("utf8");
  return koerper;
}

function quelleImap() {
  const host = process.env.FW_TEST_IMAP_HOST;
  const port = Number(process.env.FW_TEST_IMAP_PORT || 993);
  const user = process.env.FW_TEST_IMAP_USER;
  const password = process.env.FW_TEST_IMAP_PASSWORD;
  const fehlend = [];
  if (!host) fehlend.push("FW_TEST_IMAP_HOST");
  if (!user) fehlend.push("FW_TEST_IMAP_USER");
  if (!password) fehlend.push("FW_TEST_IMAP_PASSWORD");
  if (fehlend.length) {
    throw new Error(`IMAP-Mailquelle: es fehlen ${fehlend.join(", ")} (FW_TEST_IMAP_PORT ist optional, Standard 993)`);
  }

  async function neueste(empfaenger, seitMs) {
    const { ImapFlow } = await import("imapflow");
    const client = new ImapFlow({
      host, port, secure: true, logger: false,
      auth: { user, pass: password }
    });
    await client.connect();
    try {
      const lock = await client.getMailboxLock("INBOX");
      try {
        let uids = null;
        try {
          const suchOptionen = { to: empfaenger };
          if (seitMs != null) suchOptionen.since = new Date(seitMs);
          const treffer = await client.search(suchOptionen, { uid: true });
          if (Array.isArray(treffer) && treffer.length) uids = treffer;
        } catch {
          uids = null;
        }

        if (!uids) {
          /* Fallback: die letzten 50 Nachrichten holen und nach envelope.to
             filtern — manche Server können eine to-Suche mit Plus-Adressen
             (lokalteil+kennzeichen@domain) nicht zuverlässig. */
          const status = await client.status("INBOX", { messages: true });
          const gesamt = status.messages || 0;
          if (gesamt === 0) { uids = []; }
          else {
            const von = Math.max(1, gesamt - 49);
            const gefundeneUids = [];
            for await (const msg of client.fetch(`${von}:*`, { envelope: true, uid: true })) {
              const empfaengerListe = msg.envelope?.to ?? [];
              const passt = empfaengerListe.some(a => `${a.address ?? ""}`.toLowerCase() === empfaenger.toLowerCase());
              if (!passt) continue;
              if (seitMs != null && msg.envelope?.date && new Date(msg.envelope.date).getTime() < seitMs) continue;
              gefundeneUids.push(msg.uid);
            }
            uids = gefundeneUids;
          }
        }

        if (!uids.length) return null;
        const neuesteUid = Math.max(...uids);
        const nachricht = await client.fetchOne(neuesteUid, { source: true, envelope: true }, { uid: true });
        if (!nachricht) return null;
        const quelltext = nachricht.source.toString("utf8");
        const text = koerperTextAus(quelltext);
        const betreff = nachricht.envelope?.subject ?? "";
        const zeit = nachricht.envelope?.date ? new Date(nachricht.envelope.date).toISOString() : new Date().toISOString();
        return { an: empfaenger, betreff, text, zeit };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }
  }

  return {
    name: "imap",
    neueste,
    warte: (empfaenger, seitMs, timeoutMs = 30_000, intervallMs = 1000) =>
      mitPolling(() => neueste(empfaenger, seitMs), timeoutMs, intervallMs)
  };
}

/* ============================================================
   Auswahl
   ============================================================ */
export function mailquelle() {
  const name = process.env.FW_TEST_MAIL_QUELLE || "dev";
  if (name === "dev") return quelleDev();
  if (name === "mailpit") return quelleMailpit();
  if (name === "imap") return quelleImap();
  throw new Error(`Unbekannte FW_TEST_MAIL_QUELLE: "${name}" (erlaubt: dev, mailpit, imap)`);
}
