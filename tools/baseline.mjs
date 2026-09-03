/* ============================================================
   FOURWALLS — Referenzaufnahmen (Design-Regression)

   Nimmt die entscheidenden UFER-Zustände in fester Reihenfolge auf, damit nach
   der Framework-Migration Bild für Bild verglichen werden kann. Die Aufnahmen
   sind der Massstab: Sieht die neue Anwendung anders aus, ist das ein Fehler,
   bis das Gegenteil dokumentiert ist.

   Aufruf:  node tools/baseline.mjs <basis-url> <zielordner> [nurName]
   Beispiel: node tools/baseline.mjs http://localhost:8738/ufer baseline/p4

   Braucht Chrome und Node ≥ 22 (globales WebSocket). Echte Zeit über CDP —
   --virtual-time-budget liefert bei Karten und WebGL unbrauchbare Ergebnisse.
   ============================================================ */
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [basis, ziel, nur] = process.argv.slice(2);
if (!basis || !ziel) { console.error("Aufruf: node tools/baseline.mjs <basis-url> <zielordner> [nurName]"); process.exit(1); }

/* Ruhigstellen, was sich von selbst bewegt: Intro, Wasser-Shader und
   Einblend-Animationen. Sonst vergleicht man Zufall mit Zufall. */
const RUHIG = "intro=0&wasser=0";

const ZUSTAENDE = [
  { name:"start-tag",        pfad:`index.html?${RUHIG}`,                    breite:1440, hoehe:900,  voll:true },
  { name:"start-abend",      pfad:`index.html?${RUHIG}`,                    breite:1440, hoehe:900,  voll:true, modus:"dunkel" },
  { name:"suche",            pfad:`portal.html?cb=b#suche`,                 breite:1440, hoehe:1000 },
  { name:"suche-abend",      pfad:`portal.html?cb=b#suche`,                 breite:1440, hoehe:1000, modus:"dunkel" },
  { name:"karte",            pfad:`portal.html?cb=b#karte`,                 breite:1440, hoehe:900,  warten:12000, karte:true },
  { name:"karte-abend",      pfad:`portal.html?cb=b#karte`,                 breite:1440, hoehe:900,  warten:12000, karte:true, modus:"dunkel" },
  { name:"objekt-exclusive", pfad:`portal.html?cb=b#exclusive/seehaus-walensee`, breite:1440, hoehe:1200, warten:7000 },
  { name:"objekt-standard",  pfad:`portal.html?cb=b#objekt/haus-luzern-1`,  breite:1440, hoehe:1200, warten:7000 },
  { name:"verkaufen",        pfad:`verkaufen.html?${RUHIG}`,                breite:1440, hoehe:1000, voll:true },
  { name:"verwalten",        pfad:`verwalten.html?${RUHIG}`,                breite:1440, hoehe:1000, voll:true },
  { name:"wissen",           pfad:`wissen.html?${RUHIG}`,                   breite:1440, hoehe:1000, voll:true },
  { name:"assistent",        pfad:`portal.html?cb=b#neu`,                   breite:1440, hoehe:1000 },
  { name:"konto",            pfad:`portal.html?cb=b#konto`,                 breite:1440, hoehe:900 },
  /* Vier Sprachen an der Stelle, an der P4 am meisten geändert hat */
  { name:"objekt-fr",        pfad:`portal.html?cb=b#objekt/haus-luzern-1`,  breite:1440, hoehe:1200, warten:7000, sprache:"fr" },
  { name:"objekt-it",        pfad:`portal.html?cb=b#objekt/haus-luzern-1`,  breite:1440, hoehe:1200, warten:7000, sprache:"it" },
  { name:"objekt-en",        pfad:`portal.html?cb=b#objekt/haus-luzern-1`,  breite:1440, hoehe:1200, warten:7000, sprache:"en" },
  /* 390 px */
  { name:"m-start",          pfad:`index.html?${RUHIG}`,                    breite:390, hoehe:844, mobil:true },
  { name:"m-suche",          pfad:`portal.html?cb=b#suche`,                 breite:390, hoehe:844, mobil:true },
  { name:"m-karte",          pfad:`portal.html?cb=b#karte`,                 breite:390, hoehe:844, mobil:true, warten:12000, karte:true },
  { name:"m-objekt",         pfad:`portal.html?cb=b#objekt/haus-luzern-1`,  breite:390, hoehe:844, mobil:true, warten:7000 },
  { name:"m-assistent",      pfad:`portal.html?cb=b#neu`,                   breite:390, hoehe:844, mobil:true },
  { name:"m-verkaufen",      pfad:`verkaufen.html?${RUHIG}`,                breite:390, hoehe:844, mobil:true },
  { name:"m-menue",          pfad:`index.html?${RUHIG}`,                    breite:390, hoehe:844, mobil:true, menue:true }
];

const schlaf = ms => new Promise(r => setTimeout(r, ms));

async function seite(port) {
  for (let i = 0; i < 80; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const p = l.find(x => x.type === "page");
      if (p) return p.webSocketDebuggerUrl;
    } catch (e) {}
    await schlaf(250);
  }
  throw new Error("Chrome antwortet nicht");
}

async function aufnehmen(z) {
  const port = 9500 + Math.floor(Math.random() * 400);
  const profil = `/tmp/fw-baseline-${port}`;
  const kind = spawn(CHROME, ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--hide-scrollbars", "--force-device-scale-factor=1", `--window-size=${z.breite},${z.hoehe}`,
    `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, "about:blank"], { stdio:"ignore" });

  const ws = new WebSocket(await seite(port));
  await new Promise(ok => ws.onopen = ok);
  let nr = 0; const offen = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && offen.has(m.id)) { offen.get(m.id)(m); offen.delete(m.id); } };
  const cmd = (method, params) => new Promise(ok => { const id = ++nr; offen.set(id, ok); ws.send(JSON.stringify({ id, method, params })); });
  const js = async expr => {
    const r = await cmd("Runtime.evaluate", { expression:expr, awaitPromise:true, returnByValue:true });
    return r.result && r.result.result ? r.result.result.value : null;
  };

  await cmd("Page.enable"); await cmd("Runtime.enable");
  await cmd("Emulation.setDeviceMetricsOverride", { width:z.breite, height:z.hoehe, deviceScaleFactor:z.mobil ? 2 : 1, mobile:!!z.mobil });
  if (z.mobil) await cmd("Emulation.setTouchEmulationEnabled", { enabled:true });
  await cmd("Page.navigate", { url:`${basis}/${z.pfad}` });
  await schlaf(z.warten || 3500);

  if (z.sprache) {
    await js(`(async()=>{ FWP.sprache("${z.sprache}");
      document.querySelectorAll('.sprache button[data-l="${z.sprache}"]').forEach(b=>b.click());
      await new Promise(r=>setTimeout(r,1500)); })()`);
  }
  if (z.modus) {
    await js(`(async()=>{ UFER.setzModus("${z.modus}", false); await new Promise(r=>setTimeout(r,${z.karte ? 6000 : 1200})); })()`);
  }
  if (z.menue) {
    await js(`(async()=>{ document.getElementById("burger").click(); await new Promise(r=>setTimeout(r,700)); })()`);
  }
  /* Alles einblenden, was sonst erst beim Scrollen erscheint — sonst ist der
     Vergleich vom Zufall des Beobachters abhängig. */
  await js(`document.querySelectorAll(".auf,.blende,.blende-v,.bild-hinter").forEach(e=>e.classList.add("in")); true`);
  await schlaf(600);

  let clip = null;
  if (z.voll) {
    const h = await js("document.body.scrollHeight");
    /* Viewport-Höhe bewusst nicht ändern: sonst dehnen sich vh/svh-Abschnitte
       (der Held) auf die ganze Dokumenthöhe. */
    clip = { x:0, y:0, width:z.breite, height:Math.min(h || z.hoehe, 14000), scale:1 };
  }
  const shot = await cmd("Page.captureScreenshot", clip ? { format:"png", captureBeyondViewport:true, clip } : { format:"png" });
  writeFileSync(join(ziel, z.name + ".png"), Buffer.from(shot.result.data, "base64"));

  ws.close(); kind.kill();
  return `${z.name}.png`;
}

mkdirSync(ziel, { recursive:true });
const liste = nur ? ZUSTAENDE.filter(z => z.name === nur) : ZUSTAENDE;
for (const z of liste) {
  try { console.log("✓ " + await aufnehmen(z)); }
  catch (e) { console.log("✗ " + z.name + " — " + e.message); }
}
console.log(`\n${liste.length} Zustände nach ${ziel}`);
