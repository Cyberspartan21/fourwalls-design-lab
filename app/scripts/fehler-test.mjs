#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Fehlerbehandlung an der HTTP-Aussengrenze (P5.10 §17/§18)

   Prüft, dass die Anwendung unter absichtlich falscher, überlanger oder
   unbekannter Eingabe NIE einen unbehandelten 500 mit Interna zeigt, und
   dass unbekannte API-Pfade JSON statt einer HTML-Seite liefern.

   node scripts/fehler-test.mjs [Basis-URL]   Standard: http://localhost:3007

   Schreibt eine Tabelle auf stdout. Exit 1, sobald irgendeine Prüfung
   FEHLER meldet. Die Datei ändert an der Anwendung nichts. */

const BASIS = (process.argv[2] ?? "http://localhost:3007").replace(/\/$/, "");

/* /api/inquiries begrenzt Anfragen je Herkunft (5/10 Minuten, siehe
   app/api/inquiries/route.ts) — das ist gewollter Spam-Schutz, aber ein
   wiederholter Lauf DIESES Skripts innerhalb von 10 Minuten würde sonst
   selbst in den eigenen Rate-Limit-Zähler laufen und 429 statt 400/422/201
   melden. Ein eigener, je Lauf zufälliger x-forwarded-for-Wert gibt jedem
   Lauf seinen eigenen Zähler-Eimer — realistisch, weil verschiedene echte
   Anruferinnen ohnehin verschiedene Herkünfte hätten. */
const HERKUNFT_KENNUNG = `203.0.113.${Math.floor(Math.random() * 254) + 1}`;

const ergebnisse = [];
let fehlerZaehler = 0;
function pruefe(fall, feld, bedingung, detail) {
  ergebnisse.push({ fall, feld, status: bedingung ? "OK" : "FEHLER", detail: detail ?? "" });
  if (!bedingung) fehlerZaehler++;
}

/* Nirgends darf eines dieser Worte in einem Antworttext stehen — das wären
   Pfade, Bibliotheksnamen oder Datenbankinterna, die niemals nach aussen
   dürfen (§17). */
const VERBOTENE_MUSTER = [/\/Users\//i, /node_modules/i, /postgres/i, /\bSELECT\b/i, /\bINSERT INTO\b/i, / at [A-Za-z]+\.[A-Za-z]+ \(/, /\.ts:\d+:\d+/];

async function anfrage(pfad, init = {}) {
  const ctl = new AbortController();
  const timeout = setTimeout(() => ctl.abort(), 20000);
  try {
    const kopf = { "x-forwarded-for": HERKUNFT_KENNUNG, ...(init.headers ?? {}) };
    const res = await fetch(BASIS + pfad, { redirect: "manual", signal: ctl.signal, ...init, headers: kopf });
    const text = await res.text().catch(() => "");
    return { status: res.status, text, istJson: (res.headers.get("content-type") ?? "").includes("application/json") };
  } catch (e) {
    return { status: 0, text: "", istJson: false, fehler: String(e?.message ?? e) };
  } finally {
    clearTimeout(timeout);
  }
}

/* NUR für JSON-Antworten (unsere eigenen Fehlerkörper aus lib/errors.ts):
   die dürfen nie Pfade, SQL oder einen Stack enthalten (§17). Volle
   HTML-Seiten (z. B. app/global-not-found.tsx bei einem gänzlich unbekannten
   Pfad) werden hier NICHT auf dieselbe Weise geprüft — der Next-Entwicklungs-
   server bettet in JEDE Seite eigene, harmlose Verweise auf sein Bündel ein
   (u. a. "[project]/node_modules/next/…" für die React-Devtools-Anbindung),
   das ist Next-Rahmenwerk, keine Anwendungs-Interna, und verschwindet im
   Produktionsbau ohnehin. Für HTML-Antworten zählt hier nur: kein 500. */
function keineInterna(fall, antwort) {
  if (!antwort.istJson) return;
  for (const muster of VERBOTENE_MUSTER) {
    pruefe(fall, `kein Interna-Muster ${muster}`, !muster.test(antwort.text));
  }
}

async function main() {
  // 1. Fehlerhaftes JSON an eine bestehende POST-Route → 400/422, ohne Stack.
  {
    const r = await anfrage("/api/inquiries", { method: "POST", headers: { "content-type": "application/json" }, body: "{nicht: json" });
    pruefe("fehlerhaftes JSON", "status 400 oder 422", r.status === 400 || r.status === 422, String(r.status));
    keineInterna("fehlerhaftes JSON", r);
    let json = null; try { json = JSON.parse(r.text); } catch { /* geprüft unten */ }
    pruefe("fehlerhaftes JSON", "Antwort ist JSON", json !== null, r.text.slice(0, 120));
  }

  // 2. Unbekannte API-Route → 404 JSON (app/api/[...pfad]/route.ts)
  {
    const r = await anfrage("/api/diese-route-gibt-es-nicht-" + Date.now());
    pruefe("unbekannte API-Route", "status 404", r.status === 404, String(r.status));
    let json = null; try { json = JSON.parse(r.text); } catch { /* geprüft unten */ }
    pruefe("unbekannte API-Route", "Antwort ist JSON, keine HTML-Seite", json !== null && !r.text.startsWith("<"), r.text.slice(0, 120));
    keineInterna("unbekannte API-Route", r);
  }

  // 3. OPTIONS und HEAD auf einer bestehenden Route → nie 500
  {
    const rOptions = await anfrage("/api/inquiries", { method: "OPTIONS" });
    pruefe("OPTIONS auf bestehender Route", "kein 500", rOptions.status !== 500 && rOptions.status !== 0, String(rOptions.status));
    const rHead = await anfrage("/api/health", { method: "HEAD" });
    pruefe("HEAD auf bestehender Route", "kein 500", rHead.status !== 500 && rHead.status !== 0, String(rHead.status));
    const rHeadUnknown = await anfrage("/api/diese-route-gibt-es-nicht-" + Date.now(), { method: "HEAD" });
    pruefe("HEAD auf unbekannter Route", "kein 500 (404 erwartet)", rHeadUnknown.status === 404, String(rHeadUnknown.status));
  }

  // 4. Sehr langer Pfad → nie 500
  {
    const lang = "a".repeat(4000);
    const r = await anfrage("/de/" + lang);
    pruefe("sehr langer Pfad", "kein 500", r.status !== 500 && r.status !== 0, String(r.status));
    keineInterna("sehr langer Pfad", r);
  }

  // 5. Ungültige Sprache im Pfad → proxy.ts rewritet auf Deutsch, echte 404-Seite, nie 500
  {
    const r = await anfrage("/xx/irgendwas-" + Date.now());
    pruefe("ungültige Sprache", "status 404", r.status === 404, String(r.status));
    keineInterna("ungültige Sprache", r);
  }

  // 6. Ungültige Ref-Formate → 422 (Validierung), nie 500
  {
    const r1 = await anfrage("/api/similar?ref=" + encodeURIComponent("nicht-das-richtige-format"));
    pruefe("ungültiges Ref-Format (kurz)", "status 422", r1.status === 422, String(r1.status));
    keineInterna("ungültiges Ref-Format (kurz)", r1);

    const r2 = await anfrage("/api/similar?ref=" + encodeURIComponent("FWL-2026-" + "9".repeat(2000)));
    pruefe("ungültiges Ref-Format (überlang)", "kein 500", r2.status !== 500 && r2.status !== 0, String(r2.status));
    keineInterna("ungültiges Ref-Format (überlang)", r2);

    const r3 = await anfrage("/de/vorschau/" + encodeURIComponent("../../etc/passwd"));
    pruefe("ungültiges Ref-Format (Pfadmuster)", "kein 500", r3.status !== 500 && r3.status !== 0, String(r3.status));
    keineInterna("ungültiges Ref-Format (Pfadmuster)", r3);
  }

  // 7. Formular-Validierung → 422 mit Feldliste, nie 500
  {
    const r = await anfrage("/api/inquiries", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ publicRef: "FWL-2026-000001", art: "viewing_request", name: "A", email: "keine-email", nachricht: "zu kurz" })
    });
    pruefe("Formular-Validierung", "status 422", r.status === 422, String(r.status));
    let json = null; try { json = JSON.parse(r.text); } catch { /* geprüft unten */ }
    pruefe("Formular-Validierung", "Antwort nennt Felder", !!json?.fields && Object.keys(json.fields).length > 0, r.text.slice(0, 200));
    keineInterna("Formular-Validierung", r);
  }

  /* ---------- Tabelle ---------- */
  const w1 = Math.max(6, ...ergebnisse.map(r => r.fall.length));
  const w2 = Math.max(6, ...ergebnisse.map(r => r.feld.length));
  console.log("Fall".padEnd(w1), "Prüfung".padEnd(w2), "Status", "Detail");
  for (const r of ergebnisse) console.log(r.fall.padEnd(w1), r.feld.padEnd(w2), r.status.padEnd(6), (r.detail ?? "").slice(0, 80));
  console.log(`\n${ergebnisse.length - fehlerZaehler}/${ergebnisse.length} Prüfungen OK` + (fehlerZaehler ? `, ${fehlerZaehler} FEHLER` : ""));
  if (fehlerZaehler) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(2); });
