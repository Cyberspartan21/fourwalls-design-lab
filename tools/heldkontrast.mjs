/* FOURWALLS — Kontrastmessung im Exclusive-Helden.
   Misst den TATSÄCHLICHEN Hintergrund hinter Kicker, Titel und Tagline:
   Der Text wird für die Aufnahme unsichtbar geschaltet (visibility:hidden),
   danach werden genau die vorher gemessenen Rechtecke aus dem Screenshot
   ausgeschnitten. So enthält die Messung keine Textpixel mehr — das war der
   Fehler einer früheren Schätzung über Perzentile.

   Aufruf: node tools/heldkontrast.mjs <basis-url> <pfad> <breite> [mobil]
   Ausgabe je Element: Textfarbe, Hintergrund (Median/p95), Kontrast. */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("/Users/spqr/Documents/06 AI & Development/fourwalls/app/node_modules/sharp");
const CHROME = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [basis, pfad, breiteA, mobilA] = process.argv.slice(2);
const breite = Number(breiteA || 1440), mobil = mobilA === "mobil";
const hoehe = mobil ? 844 : 1000, dsf = mobil ? 2 : 1;
const schlaf = ms => new Promise(r => setTimeout(r, ms));
const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = (r, g, b) => 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
const kontrast = (a, b) => { const l1 = Math.max(a, b), l2 = Math.min(a, b); return (l1 + 0.05) / (l2 + 0.05); };

const port = 9600 + Math.floor(Math.random() * 300);
const kind = spawn(CHROME, ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--hide-scrollbars", `--force-device-scale-factor=${dsf}`, `--window-size=${breite},${hoehe}`,
  `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/fw-kontrast-${port}`, "about:blank"], { stdio: "ignore" });
async function seite() {
  for (let i = 0; i < 80; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const p = l.find(x => x.type === "page"); if (p) return p.webSocketDebuggerUrl; } catch {}
    await schlaf(250);
  }
  throw new Error("Chrome antwortet nicht");
}
const ws = new WebSocket(await seite());
await new Promise(ok => ws.onopen = ok);
let nr = 0; const offen = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && offen.has(m.id)) { offen.get(m.id)(m); offen.delete(m.id); } };
const cmd = (method, params = {}) => new Promise(ok => { const id = ++nr; offen.set(id, ok); ws.send(JSON.stringify({ id, method, params })); });

await cmd("Page.enable"); await cmd("Runtime.enable");
await cmd("Emulation.setDeviceMetricsOverride", { width: breite, height: hoehe, deviceScaleFactor: dsf, mobile: mobil });
await cmd("Page.navigate", { url: `${basis}${pfad}` });
await schlaf(7000);

const mess = await cmd("Runtime.evaluate", { returnByValue: true, expression: `(() => {
  const p = document.querySelector('.premiere'); if (!p) return null;
  /* Nicht das Elementkästchen messen (es läuft über die ganze Spaltenbreite),
     sondern die tatsächliche Ausdehnung der Glyphen — sonst fliesst heller
     Hintergrund rechts neben dem Text in die Messung ein. */
  const r = e => { const rg = document.createRange(); rg.selectNodeContents(e);
    const b = rg.getBoundingClientRect(); rg.detach && rg.detach();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.max(1, Math.round(b.width)), h: Math.max(1, Math.round(b.height)) }; };
  const el = { kick: p.querySelector('.kick'), h1: p.querySelector('h1'), tag: p.querySelector('.tag') };
  const out = {};
  for (const [k, e] of Object.entries(el)) { if (!e) continue; out[k] = { rect: r(e), farbe: getComputedStyle(e).color, gross: parseFloat(getComputedStyle(e).fontSize) >= 24 }; }
  return out; })()` });
const ziele = mess.result?.result?.value;
if (!ziele) { console.error("Held nicht gefunden"); ws.close(); kind.kill(); process.exit(2); }

/* Text unsichtbar — der Verlauf (.flor) und das Bild bleiben stehen. */
await cmd("Runtime.evaluate", { expression: `document.querySelectorAll('.premiere .txt > *').forEach(e => e.style.visibility='hidden')` });
await schlaf(400);
const shot = await cmd("Page.captureScreenshot", { format: "png" });
const png = Buffer.from(shot.result.data, "base64");

console.log(`Helden-Kontrast — ${pfad}  ${breite}px${mobil ? " mobil" : ""}`);
let schlechteste = Infinity;
for (const [name, z] of Object.entries(ziele)) {
  const m = z.farbe.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  const [tr, tg, tb, ta] = [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
  const x = Math.max(0, z.rect.x * dsf), y = Math.max(0, z.rect.y * dsf);
  const w = Math.min(Math.round(z.rect.w * dsf), breite * dsf - x), h = Math.max(1, Math.round(z.rect.h * dsf));
  const { data, info } = await sharp(png).extract({ left: x, top: y, width: w, height: h }).raw().toBuffer({ resolveWithObject: true });
  const L = []; for (let i = 0; i < data.length; i += info.channels) L.push(lum(data[i], data[i + 1], data[i + 2]));
  L.sort((a, b) => a - b);
  const p = q => L[Math.min(L.length - 1, Math.floor(L.length * q))];
  /* Halbtransparenter Text (rgba …, .85) über dem Hintergrund: effektive Farbe mischen. */
  const bgP95 = p(0.95), bgMed = p(0.5);
  const misch = (t, bgL) => { const bg255 = 255 * Math.pow(bgL, 1 / 2.2); return t * ta + bg255 * (1 - ta); };
  const tl = q => lum(misch(tr, q), misch(tg, q), misch(tb, q));
  const kMed = kontrast(tl(bgMed), bgMed), kP95 = kontrast(tl(bgP95), bgP95);
  const soll = z.gross ? 3 : 4.5;
  schlechteste = Math.min(schlechteste, kP95);
  console.log(`  ${name.padEnd(5)} ${z.farbe.padEnd(24)} Hintergrund Median ${bgMed.toFixed(4)} p95 ${bgP95.toFixed(4)}  →  ${kMed.toFixed(2)}:1 / p95 ${kP95.toFixed(2)}:1  (soll ${soll}:1)  ${kP95 >= soll ? "OK" : "ZU TIEF"}`);
}
ws.close(); kind.kill();
process.exit(schlechteste === Infinity ? 2 : 0);
