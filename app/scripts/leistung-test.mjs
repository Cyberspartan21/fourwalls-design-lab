#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Produktions-Leistungsmessung (P5.10 §26)

   Misst acht Seiten (Start, Kaufen-Suche, Objekt Exclusive, Objekt Standard,
   Karte, Verkaufen, Wissen-Beitrag, Anbieterseite) je Desktop (1280×860) und
   Mobil (390×844) gegen eine laufende Instanz (Standard: http://localhost:3008,
   der PRODUKTIONS-BUILD über `.next/standalone/server.js`, NICHT der
   Dev-Server auf :3007).

   Werkzeug: eigener Chrome (Google Chrome, headless) über das Chrome
   DevTools Protocol (CDP) — kein Puppeteer/Playwright in den Abhängigkeiten
   dieses Projekts, daher eine schlanke eigene CDP-Anbindung über das
   eingebaute WebSocket (Node ≥ 22) und die HTTP-Steuerungsendpunkte von
   Chrome (`/json/new`, `/json/close`).

   Erfasst je Seite: Anzahl Requests, Bytes gesamt, Bytes je Kategorie
   (JS/CSS/Fonts/Bilder/HTML/Sonstiges; bei Bildern zusätzlich Formate),
   TTFB (Navigation-Timing responseStart), DOMContentLoaded, Load, LCP
   (PerformanceObserver largest-contentful-paint, mit Element-Bezeichnung),
   CLS (PerformanceObserver layout-shift, Summe ohne recent-input), die 5
   grössten Ressourcen. Content-Encoding wird je Antwort geprüft — sendet der
   Server (wie der lokale standalone-Server) unkomprimiert, wird die
   Rohgrösse ausgewiesen UND für JS/CSS eine geschätzte gzip-Grösse per
   node:zlib auf den tatsächlich abgerufenen Antwortkörper gerechnet.

   Zusätzlich: Server-Antwortverhalten der Suchseite — 20 sequentielle
   HTTP-Aufrufe (Median/Max TTFB per fetch()) und 10 parallele Aufrufe.

   Aufruf:
     node scripts/leistung-test.mjs [basis-url]      Standard: http://localhost:3008
   Umgebung:
     FW_CHROME_PORT   Debug-Port des eigenen Chrome (Standard: 9700+zufällig)
   Ausgabe:
     - Tabellen auf stdout
     - var/leistung-bericht.json
   Ändert an der Anwendung nichts — reines Messwerkzeug.
   ============================================================ */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { setTimeout as delay } from "node:timers/promises";

const HIER = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HIER, "..");
const BERICHT_PFAD = join(APP_ROOT, "var", "leistung-bericht.json");

const BASIS = (process.argv[2] || "http://localhost:3008").replace(/\/$/, "");
const CHROME_PORT = Number(process.env.FW_CHROME_PORT) || (9700 + Math.floor(Math.random() * 200));
const PROFIL_DIR = `/tmp/fw-h7-${CHROME_PORT}`;

const CHROME_KANDIDATEN = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

const SEITEN = [
  { label: "Start", pfad: "/de" },
  { label: "Kaufen-Suche", pfad: "/de/immobilien/kaufen" },
  { label: "Objekt Exclusive", pfad: "/de/immobilien/kaufen/seehaus-walensee-fwl-2026-000142" },
  { label: "Objekt Standard", pfad: "/de/immobilien/mieten/chalet-bern-1-fwl-2026-101000" },
  { label: "Karte", pfad: "/de/immobilien/kaufen?ansicht=karte" },
  { label: "Verkaufen", pfad: "/de/verkaufen" },
  { label: "Wissen-Beitrag", pfad: "/de/wissen/immobilienverkauf-ablauf" },
  { label: "Anbieterseite", pfad: "/de/anbieter/demo-bergwelt-real-estate-ag" },
];

const GERAETE = {
  desktop: { breite: 1280, hoehe: 860, mobil: false, ua: null },
  mobil: { breite: 390, hoehe: 844, mobil: true,
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1" },
};

function median(werte) {
  if (!werte.length) return null;
  const s = [...werte].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/* ---------- Chrome starten ---------- */
function chromeFinden() {
  for (const p of CHROME_KANDIDATEN) if (existsSync(p)) return p;
  throw new Error("Kein Chrome/Chromium gefunden unter den bekannten Pfaden — bitte FW_CHROME_BIN prüfen.");
}

async function chromeStarten() {
  const bin = process.env.FW_CHROME_BIN || chromeFinden();
  rmSync(PROFIL_DIR, { recursive: true, force: true });
  mkdirSync(PROFIL_DIR, { recursive: true });
  const proc = spawn(bin, [
    `--remote-debugging-port=${CHROME_PORT}`,
    `--user-data-dir=${PROFIL_DIR}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--hide-scrollbars",
    "--mute-audio",
  ], { stdio: ["ignore", "ignore", "ignore"] });
  proc.unref();
  // auf den Debug-Port warten
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${CHROME_PORT}/json/version`);
      if (r.ok) return proc;
    } catch { /* noch nicht bereit */ }
    await delay(100);
  }
  throw new Error("Chrome-Debug-Port kam nicht hoch");
}

async function chromeBeenden(proc) {
  try { await fetch(`http://127.0.0.1:${CHROME_PORT}/json/close`); } catch { /* ignorieren */ }
  try { proc.kill("SIGTERM"); } catch { /* ignorieren */ }
  await delay(300);
  try { proc.kill("SIGKILL"); } catch { /* ignorieren */ }
  rmSync(PROFIL_DIR, { recursive: true, force: true });
}

/* ---------- Eine schlanke CDP-Session über das native WebSocket ---------- */
class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.wartend = new Map();
    this.ereignisse = new Map(); // methodenname -> [handler]
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null && this.wartend.has(msg.id)) {
        const { resolve, reject } = this.wartend.get(msg.id);
        this.wartend.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const h of this.ereignisse.get(msg.method) ?? []) h(msg.params);
      }
    });
  }
  static async verbinden(wsUrl) {
    const c = new CDP(wsUrl);
    await new Promise((resolve, reject) => {
      c.ws.addEventListener("open", () => resolve());
      c.ws.addEventListener("error", (e) => reject(e));
    });
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.wartend.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, handler) {
    if (!this.ereignisse.has(method)) this.ereignisse.set(method, []);
    this.ereignisse.get(method).push(handler);
  }
  schliessen() { try { this.ws.close(); } catch { /* ignorieren */ } }
}

/* ---------- Eine Seite messen ---------- */
async function seiteMessen(basisPort, url, geraet) {
  const neu = await fetch(`http://127.0.0.1:${basisPort}/json/new?about:blank`, { method: "PUT" });
  const target = await neu.json();
  const cdp = await CDP.verbinden(target.webSocketDebuggerUrl);

  await cdp.send("Page.enable");
  await cdp.send("Network.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: geraet.breite, height: geraet.hoehe, deviceScaleFactor: geraet.mobil ? 2 : 1, mobile: geraet.mobil,
  });
  if (geraet.ua) await cdp.send("Emulation.setUserAgentOverride", { userAgent: geraet.ua, platform: "iPhone" });

  // LCP/CLS-Beobachter, der vor jedem Dokument im Ziel-Tab läuft
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      window.__fwPerf = { lcp: null, lcpElement: null, cls: 0 };
      try {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) {
            window.__fwPerf.lcp = last.renderTime || last.loadTime || last.startTime;
            const el = last.element;
            window.__fwPerf.lcpElement = el ? (el.tagName + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').join('.') : '')) : (last.url || null);
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (e) { /* Browser ohne LCP */ }
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) window.__fwPerf.cls += entry.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      } catch (e) { /* Browser ohne CLS */ }
    `,
  });

  const requests = new Map(); // requestId -> { url, typ, status, headers, encodedLength, mimeType }
  const bodies = new Map(); // requestId -> braucht Body? (nur JS/CSS für gzip-Schätzung)

  cdp.on("Network.requestWillBeSent", (p) => {
    requests.set(p.requestId, {
      url: p.request.url, typ: p.type ?? "Other", status: null, mimeType: null,
      headers: {}, encodedLength: 0, timing: p.timestamp, istDokument: p.type === "Document" && !requests.has("__doc__"),
    });
    if (p.type === "Document" && !requests.get("__doc__")) requests.set("__doc__", p.requestId);
  });
  cdp.on("Network.responseReceived", (p) => {
    const r = requests.get(p.requestId);
    if (!r) return;
    r.status = p.response.status;
    r.mimeType = p.response.mimeType;
    r.headers = p.response.headers || {};
    r.protokoll = p.response.protocol;
  });
  cdp.on("Network.loadingFinished", (p) => {
    const r = requests.get(p.requestId);
    if (r) r.encodedLength = p.encodedDataLength;
  });

  const t0 = Date.now();
  await cdp.send("Page.navigate", { url });
  await new Promise((resolve) => {
    const h = () => { cdp.ereignisse.delete("Page.loadEventFired"); resolve(); };
    cdp.on("Page.loadEventFired", h);
  });
  // Netzwerk-Ruhe + LCP/CLS-Finalisierung abwarten
  await delay(1500);
  const navHttpMs = Date.now() - t0;

  const perfEval = await cdp.send("Runtime.evaluate", {
    expression: `JSON.stringify({
      perf: window.__fwPerf,
      nav: (() => { const n = performance.getEntriesByType('navigation')[0]; return n ? {
        ttfb: n.responseStart, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, transferSize: n.transferSize
      } : null; })()
    })`,
    returnByValue: true,
  });
  const perfDaten = JSON.parse(perfEval.result.value);

  // Body für JS/CSS holen (gzip-Schätzung) — nur wenn keine Content-Encoding-Kompression aktiv war
  const KATEGORIE = (r) => {
    const m = (r.mimeType || "").toLowerCase();
    if (r.typ === "Document" || m.includes("html")) return "html";
    if (r.typ === "Script" || m.includes("javascript") || m.includes("ecmascript")) return "js";
    if (r.typ === "Stylesheet" || m.includes("css")) return "css";
    if (r.typ === "Font" || m.includes("font")) return "font";
    if (r.typ === "Image" || m.startsWith("image/")) return "image";
    return "sonstige";
  };

  const ressourcen = [];
  let maplibreGeladen = false;
  for (const [rid, r] of requests) {
    if (rid === "__doc__" || !r.url || r.status == null) continue;
    const kat = KATEGORIE(r);
    /* «bytes» = encodedDataLength von CDP, also das, was TATSÄCHLICH über die
       Leitung ging — Chrome verhandelt selbst Accept-Encoding: gzip, br, und
       der Next-Standalone-Server komprimiert HTML/JS/CSS (nicht aber die
       JSON-API-Routen, siehe Bericht) automatisch, wenn der Client das
       anbietet. «bytes» ist deshalb bereits die komprimierte Wire-Grösse,
       WENN der Server komprimiert hat (contentEncoding gesetzt) — sonst die
       unkomprimierte Grösse. Für JS/CSS wird zusätzlich Network.getResponseBody
       geholt (liefert IMMER den entschlüsselten Klartext, unabhängig von der
       Kompression) — daraus: die wahre unkomprimierte Grösse (decodedBytes)
       und, NUR wenn der Server nicht selbst komprimiert hat, eine
       node:zlib-gzip-Schätzung als Anhaltspunkt, was Kompression bringen
       würde. */
    const contentEncoding = (r.headers["content-encoding"] || r.headers["Content-Encoding"] || "").toLowerCase();
    let decodedBytes = null, gzipSchaetzung = null;
    if (kat === "js" || kat === "css") {
      try {
        const body = await cdp.send("Network.getResponseBody", { requestId: rid });
        const buf = Buffer.from(body.body, body.base64Encoded ? "base64" : "utf8");
        decodedBytes = buf.length;
        if (!contentEncoding) gzipSchaetzung = gzipSync(buf).length;
        /* Webpack vergibt in der Produktion hashbasierte Chunk-Namen ohne
           lesbaren Bibliotheksnamen — «lädt diese Seite MapLibre?» lässt sich
           daher nicht an der URL ablesen, sondern nur am tatsächlichen
           Skriptinhalt (die Zeichenkette "maplibre" übersteht die
           Minifizierung, z. B. in Attributionstexten/internen Modulpfaden). */
        if (kat === "js" && buf.toString("utf8", 0, Math.min(buf.length, 3_000_000)).toLowerCase().includes("maplibre")) maplibreGeladen = true;
      } catch { /* Body evtl. nicht mehr verfügbar — kein Beinbruch */ }
    }
    ressourcen.push({
      url: r.url, kategorie: kat, mimeType: r.mimeType, status: r.status,
      bytes: r.encodedLength, decodedBytes, contentEncoding: contentEncoding || null, gzipSchaetzungBytes: gzipSchaetzung,
    });
  }

  await cdp.send("Page.close").catch(() => {});
  cdp.schliessen();
  await fetch(`http://127.0.0.1:${basisPort}/json/close/${target.id}`).catch(() => {});

  const bytesGesamt = ressourcen.reduce((s, r) => s + (r.bytes || 0), 0);
  const proKategorie = {};
  for (const kat of ["html", "js", "css", "font", "image", "sonstige"]) {
    const teil = ressourcen.filter((r) => r.kategorie === kat);
    const jaKomprimiert = teil.filter((r) => r.contentEncoding);
    const nichtKomprimiert = teil.filter((r) => !r.contentEncoding);
    proKategorie[kat] = {
      anzahl: teil.length,
      /* wireBytes: was tatsächlich über die Leitung ging (komprimiert, wo der Server es tut) */
      bytes: teil.reduce((s, r) => s + (r.bytes || 0), 0),
      /* decodedBytesGesamt: wahre unkomprimierte Grösse (nur für js/css ermittelt) */
      decodedBytesGesamt: teil.some((r) => r.decodedBytes != null) ? teil.reduce((s, r) => s + (r.decodedBytes ?? r.bytes ?? 0), 0) : null,
      anzahlServerKomprimiert: jaKomprimiert.length,
      /* gzipSchaetzungBytes: nur für die NICHT vom Server komprimierten Antworten dieser Kategorie — echte Schätzung, kein Mix mit bereits komprimierten Wire-Bytes */
      gzipSchaetzungBytes: nichtKomprimiert.some((r) => r.gzipSchaetzungBytes != null)
        ? nichtKomprimiert.reduce((s, r) => s + (r.gzipSchaetzungBytes ?? r.bytes ?? 0), 0) + jaKomprimiert.reduce((s, r) => s + (r.bytes || 0), 0)
        : null,
    };
  }
  const bildFormate = {};
  for (const r of ressourcen.filter((r) => r.kategorie === "image")) {
    const fmt = (r.url.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1] || r.mimeType || "unbekannt").toLowerCase();
    bildFormate[fmt] = (bildFormate[fmt] ?? 0) + 1;
  }
  const top5 = [...ressourcen].sort((a, b) => (b.bytes || 0) - (a.bytes || 0)).slice(0, 5)
    .map((r) => ({ url: r.url, kategorie: r.kategorie, bytes: r.bytes }));

  return {
    requestsGesamt: ressourcen.length,
    bytesGesamt,
    proKategorie,
    bildFormate,
    top5,
    ttfbMs: perfDaten.nav?.ttfb ?? null,
    dclMs: perfDaten.nav?.dcl ?? null,
    loadMs: perfDaten.nav?.load ?? null,
    lcpMs: perfDaten.perf?.lcp ?? null,
    lcpElement: perfDaten.perf?.lcpElement ?? null,
    cls: perfDaten.perf?.cls ?? null,
    navigationHttpMs: navHttpMs,
    maplibreGeladen,
  };
}

/* ---------- Server-Antwortverhalten (Suchseite, reines HTTP) ---------- */
async function serverAntwortverhalten(basis) {
  const url = `${basis}/de/immobilien/kaufen`;
  const sequentiell = [];
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    const r = await fetch(url, { cache: "no-store" });
    await r.arrayBuffer();
    sequentiell.push(performance.now() - t0);
  }
  const t0p = performance.now();
  const parallel = await Promise.all(Array.from({ length: 10 }, async () => {
    const t0 = performance.now();
    const r = await fetch(url, { cache: "no-store" });
    await r.arrayBuffer();
    return performance.now() - t0;
  }));
  const parallelGesamtMs = performance.now() - t0p;
  return {
    sequentiell: { n: 20, medianMs: median(sequentiell), maxMs: Math.max(...sequentiell), alleMs: sequentiell },
    parallel: { n: 10, medianMs: median(parallel), maxMs: Math.max(...parallel), gesamtMs: parallelGesamtMs, alleMs: parallel },
  };
}

/* ---------- Ablauf ---------- */
async function main() {
  console.log(`Basis-URL: ${BASIS}`);
  const chromeVersion = await (async () => { try { const r = await fetch(`http://127.0.0.1:1`); return null; } catch { return null; } })();
  void chromeVersion;

  const proc = await chromeStarten();
  console.log(`Chrome bereit auf Port ${CHROME_PORT} (Profil ${PROFIL_DIR})`);

  const bericht = { generated_at: new Date().toISOString(), basis: BASIS, chrome_port: CHROME_PORT, seiten: [] };

  try {
    for (const seite of SEITEN) {
      const url = BASIS + seite.pfad;
      const eintrag = { label: seite.label, pfad: seite.pfad, geraete: {} };
      for (const [geraetName, geraet] of Object.entries(GERAETE)) {
        console.log(`Messe: ${seite.label} (${geraetName}) — ${url}`);
        try {
          eintrag.geraete[geraetName] = await seiteMessen(CHROME_PORT, url, geraet);
        } catch (e) {
          eintrag.geraete[geraetName] = { fehler: String(e.message ?? e) };
          console.error(`  Fehler: ${e.message ?? e}`);
        }
      }
      bericht.seiten.push(eintrag);
    }

    console.log("\nMesse Server-Antwortverhalten der Suchseite (20 sequentiell, 10 parallel) …");
    bericht.serverAntwortverhalten = await serverAntwortverhalten(BASIS);
  } finally {
    await chromeBeenden(proc);
  }

  // ---------- Tabelle ----------
  console.log("\n\n=== Ergebnistabelle ===");
  for (const s of bericht.seiten) {
    for (const [g, d] of Object.entries(s.geraete)) {
      if (d.fehler) { console.log(`${s.label} (${g}): FEHLER ${d.fehler}`); continue; }
      console.log(`\n${s.label} (${g}): Requests=${d.requestsGesamt}  Bytes=${(d.bytesGesamt / 1024).toFixed(1)}KB  TTFB=${d.ttfbMs?.toFixed(0)}ms  DCL=${d.dclMs?.toFixed(0)}ms  Load=${d.loadMs?.toFixed(0)}ms  LCP=${d.lcpMs?.toFixed(0)}ms (${d.lcpElement})  CLS=${d.cls?.toFixed(4)}  MapLibre=${d.maplibreGeladen ? "ja" : "nein"}`);
    }
  }
  console.log("\nServer-Antwortverhalten Suchseite:");
  console.log(`  20 sequentiell: Median ${bericht.serverAntwortverhalten.sequentiell.medianMs.toFixed(1)}ms, Max ${bericht.serverAntwortverhalten.sequentiell.maxMs.toFixed(1)}ms`);
  console.log(`  10 parallel:    Median ${bericht.serverAntwortverhalten.parallel.medianMs.toFixed(1)}ms, Max ${bericht.serverAntwortverhalten.parallel.maxMs.toFixed(1)}ms, Gesamtdauer ${bericht.serverAntwortverhalten.parallel.gesamtMs.toFixed(1)}ms`);

  mkdirSync(join(APP_ROOT, "var"), { recursive: true });
  writeFileSync(BERICHT_PFAD, JSON.stringify(bericht, null, 2));
  console.log(`\nBericht geschrieben: ${BERICHT_PFAD}`);
}

await main();
