/* ============================================================
   FOURWALLS — Bildvergleich für die Design-Regression

   Vergleicht zwei Aufnahmereihen (z. B. baseline/p4 gegen baseline/p5) und
   meldet, wo sich etwas verändert hat. Der Massstab aus dem Auftrag: Die neue
   Anwendung soll gleich aussehen. Eine Abweichung ist ein Fehler, bis jemand
   sie ausdrücklich als Verbesserung dokumentiert.

   Aufruf: node tools/vergleich.mjs baseline/p4 baseline/p5 [schwelle]

   Reines Node, keine Abhängigkeiten: PNG wird über Chrome dekodiert, weil das
   ohnehin auf dem Rechner ist und keine Bibliothek installiert werden muss.
   ============================================================ */
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { readdirSync, existsSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [altOrdner, neuOrdner, schwelleArg] = process.argv.slice(2);
const SCHWELLE = Number(schwelleArg ?? 0.2);   // Prozent abweichender Bildpunkte
if (!altOrdner || !neuOrdner) { console.error("Aufruf: node tools/vergleich.mjs <alt> <neu> [schwelle%]"); process.exit(1); }

const schlaf = ms => new Promise(r => setTimeout(r, ms));
const port = 9700 + Math.floor(Math.random() * 200);
const kind = spawn(CHROME, ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--allow-file-access-from-files", `--remote-debugging-port=${port}`,
  `--user-data-dir=/tmp/fw-vergleich-${port}`, "about:blank"], { stdio:"ignore" });

async function seite() {
  for (let i = 0; i < 80; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const p = l.find(x => x.type === "page"); if (p) return p.webSocketDebuggerUrl; } catch (e) {}
    await schlaf(250);
  }
  throw new Error("Chrome antwortet nicht");
}

const ws = new WebSocket(await seite());
await new Promise(ok => ws.onopen = ok);
let nr = 0; const offen = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && offen.has(m.id)) { offen.get(m.id)(m); offen.delete(m.id); } };
const cmd = (method, params) => new Promise(ok => { const id = ++nr; offen.set(id, ok); ws.send(JSON.stringify({ id, method, params })); });

/* Ein about:blank-Dokument darf keine file://-Bilder lesen. Also erst auf eine
   echte Datei navigieren — dann gilt der Dateiursprung. */
const arbeitsordner = mkdtempSync(join(tmpdir(), "fw-vergleich-"));
writeFileSync(join(arbeitsordner, "start.html"), "<!doctype html><title>vergleich</title>");
await cmd("Page.enable");
await cmd("Page.navigate", { url:"file://" + join(arbeitsordner, "start.html") });
await schlaf(700);
const js = async expr => {
  const id = ++nr;
  const r = await new Promise(ok => { offen.set(id, ok); ws.send(JSON.stringify({ id, method:"Runtime.evaluate", params:{ expression:expr, awaitPromise:true, returnByValue:true } })); });
  const v = r.result && r.result.result;
  if (r.result && r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text || "Fehler im Browser");
  return v ? v.value : null;
};

const dateien = readdirSync(altOrdner).filter(f => f.endsWith(".png")).sort();
const bericht = [];
let schlimmste = 0;

for (const datei of dateien) {
  const a = resolve(altOrdner, datei), b = resolve(neuOrdner, datei);
  if (!existsSync(b)) { bericht.push({ datei, zustand:"fehlt", wert:null }); continue; }
  const erg = await js(`(async () => {
    const laden = src => new Promise((ok, nein) => { const i = new Image(); i.onload = () => ok(i); i.onerror = nein; i.src = "file://" + src; });
    const [x, y] = await Promise.all([laden(${JSON.stringify(a)}), laden(${JSON.stringify(b)})]);
    if (x.width !== y.width || x.height !== y.height)
      return { masse: x.width + "x" + x.height + " vs " + y.width + "x" + y.height };
    const c1 = new OffscreenCanvas(x.width, x.height).getContext("2d", { willReadFrequently:true });
    const c2 = new OffscreenCanvas(y.width, y.height).getContext("2d", { willReadFrequently:true });
    c1.drawImage(x, 0, 0); c2.drawImage(y, 0, 0);
    const d1 = c1.getImageData(0, 0, x.width, x.height).data;
    const d2 = c2.getImageData(0, 0, y.width, y.height).data;
    let anders = 0;
    /* Toleranz gegen Kantenglättung und Farbprofil-Rundung: erst ab einem
       spürbaren Unterschied gilt ein Bildpunkt als verändert. */
    for (let i = 0; i < d1.length; i += 4) {
      if (Math.abs(d1[i]-d2[i]) + Math.abs(d1[i+1]-d2[i+1]) + Math.abs(d1[i+2]-d2[i+2]) > 24) anders++;
    }
    return { anteil: (anders / (d1.length / 4)) * 100 };
  })()`);
  if (erg.masse) { bericht.push({ datei, zustand:"andere Masse", wert:erg.masse }); continue; }
  const p = Math.round(erg.anteil * 100) / 100;
  schlimmste = Math.max(schlimmste, p);
  bericht.push({ datei, zustand: p <= SCHWELLE ? "gleich" : "abweichend", wert:p });
}

/* Zustände, die es nur im neuen Ordner gibt (z. B. frisch ergänzte
   Regressionszustände), sind kein Fehler — es gibt schlicht noch nichts zum
   Vergleichen. Getrennt von "fehlt" (ein Zustand ist verschwunden), das
   weiterhin als Abweichung zählt. */
const dateienNeu = readdirSync(neuOrdner).filter(f => f.endsWith(".png")).sort();
for (const datei of dateienNeu) {
  if (!dateien.includes(datei)) bericht.push({ datei, zustand:"neu", wert:null });
}

ws.close(); kind.kill();
setTimeout(() => { try { rmSync(`/tmp/fw-vergleich-${port}`, { recursive:true, force:true }); rmSync(arbeitsordner, { recursive:true, force:true }); } catch (e) {} }, 500);

const breit = Math.max(...bericht.map(b => b.datei.length), 10);
for (const b of bericht) {
  const zeichen = b.zustand === "gleich" ? "✓" : b.zustand === "neu" ? "＋" : b.zustand === "fehlt" ? "?" : "✗";
  const wert = b.wert === null ? "" : (typeof b.wert === "number" ? b.wert.toFixed(2) + " %" : b.wert);
  console.log(`${zeichen} ${b.datei.padEnd(breit)}  ${b.zustand.padEnd(13)} ${wert}`);
}
const abweichend = bericht.filter(b => b.zustand !== "gleich" && b.zustand !== "neu");
const neu = bericht.filter(b => b.zustand === "neu");
console.log(`\n${bericht.length - neu.length} verglichen · ${abweichend.length} abweichend · ${neu.length} neu (kein Vergleich) · grösste Abweichung ${schlimmste.toFixed(2)} % · Schwelle ${SCHWELLE} %`);
writeFileSync(join(neuOrdner, "vergleich.json"), JSON.stringify({ alt:altOrdner, neu:neuOrdner, schwelle:SCHWELLE, bericht }, null, 2));
process.exit(abweichend.length ? 1 : 0);
