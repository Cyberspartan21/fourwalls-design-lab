/* ============================================================
   FOURWALLS — Leistungsmessung einer Seite (Prototyp und Anwendung)

   Echte Zeit über CDP wie baseline.mjs. Misst: übertragene Bytes je Art,
   Anzahl Anfragen, HTML-Grösse, DOM-Knoten, LCP, CLS, und ob MapLibre vor
   dem Scrollen geladen wurde (faule Grenze).

   Aufruf: node tools/leistung.mjs <url> [name]
   ============================================================ */
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [url, name = "seite"] = process.argv.slice(2);
if (!url) { console.error("Aufruf: node tools/leistung.mjs <url> [name]"); process.exit(1); }
const schlaf = ms => new Promise(r => setTimeout(r, ms));

async function seite(port) {
  for (let i = 0; i < 80; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const p = l.find(x => x.type === "page"); if (p) return p.webSocketDebuggerUrl; } catch {}
    await schlaf(250);
  }
  throw new Error("Chrome antwortet nicht");
}

const port = 9900 + Math.floor(Math.random() * 90), profil = `/tmp/fw-leistung-${port}`;
const kind = spawn(CHROME, ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars",
  "--force-device-scale-factor=1", "--window-size=1440,1000", `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, "about:blank"], { stdio: "ignore" });
const ws = new WebSocket(await seite(port));
await new Promise(ok => ws.onopen = ok);
let nr = 0; const offen = new Map(); const anfragen = new Map(); const fertig = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && offen.has(m.id)) { offen.get(m.id)(m); offen.delete(m.id); return; }
  if (m.method === "Network.responseReceived") anfragen.set(m.params.requestId, { url: m.params.response.url, typ: m.params.type, mime: m.params.response.mimeType });
  if (m.method === "Network.loadingFinished") { const a = anfragen.get(m.params.requestId); if (a) fertig.push({ ...a, bytes: m.params.encodedDataLength, t: m.params.timestamp }); }
};
const cmd = (method, params) => new Promise(ok => { const id = ++nr; offen.set(id, ok); ws.send(JSON.stringify({ id, method, params })); });
const js = async expr => { const r = await cmd("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.result?.value ?? null; };

await cmd("Network.enable"); await cmd("Page.enable"); await cmd("Runtime.enable");
await cmd("Page.addScriptToEvaluateOnNewDocument", { source: `window.__cls=0;window.__lcp=0;
  new PerformanceObserver(l=>{for(const e of l.getEntries()) if(!e.hadRecentInput) window.__cls+=e.value;}).observe({type:"layout-shift",buffered:true});
  new PerformanceObserver(l=>{const e=l.getEntries();if(e.length) window.__lcp=e[e.length-1].startTime;}).observe({type:"largest-contentful-paint",buffered:true});` });
await cmd("Page.navigate", { url });
await schlaf(9000);
const vorScroll = fertig.length;
const vorMaplibre = fertig.some(f => /maplibre/i.test(f.url));
const nav = await js(`JSON.stringify(performance.getEntriesByType("navigation")[0]||{})`);
const lcp = await js("window.__lcp"), cls = await js("window.__cls");
const knoten = await js("document.getElementsByTagName('*').length");
const htmlBytes = await js("new TextEncoder().encode(document.documentElement.outerHTML).length");
/* Zum Lageteil scrollen: erst jetzt darf die Karte laden */
await js(`(document.getElementById("d-lage")||document.body).scrollIntoView(); true`);
await schlaf(9000);
const nachMaplibre = fertig.some(f => /maplibre/i.test(f.url));

const summe = (f) => f.reduce((s, x) => s + (x.bytes || 0), 0);
const bis = fertig.slice(0, vorScroll);
const nachArt = {};
for (const f of bis) { const k = f.typ || "?"; nachArt[k] = nachArt[k] || { n: 0, bytes: 0 }; nachArt[k].n++; nachArt[k].bytes += f.bytes || 0; }
const n = JSON.parse(nav || "{}");
const erg = { name, url, anfragenVorScroll: vorScroll, bytesVorScroll: summe(bis), nachArt,
  htmlDokumentBytes: htmlBytes, domKnoten: knoten, lcpMs: Math.round(lcp || 0), cls: Number((cls || 0).toFixed(4)),
  domContentLoadedMs: Math.round(n.domContentLoadedEventEnd || 0), loadMs: Math.round(n.loadEventEnd || 0),
  maplibreVorScroll: vorMaplibre, maplibreNachScroll: nachMaplibre,
  anfragenGesamt: fertig.length, bytesGesamt: summe(fertig) };
console.log(JSON.stringify(erg, null, 2));
ws.close(); kind.kill(); setTimeout(() => { try { rmSync(profil, { recursive: true, force: true }); } catch {} }, 500);
