#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Barrierefreiheits-Audit (P5.10 §29)

   Prüft Tastaturbedienbarkeit, sichtbaren Fokus, Dialoge, Formularfehler,
   Knopfnamen, aria-pressed, Überschriftenstruktur, lang-Attribut und
   prefers-reduced-motion auf sieben Seiten (Start, Kaufen-Suche,
   Objektseite Exclusive, /de/bewertung, /de/konto/anmelden,
   /de/wissen/immobilien-einschaetzung, /de/datenschutz), je nach Prüfung bei
   1280 und/oder 390 Pixeln Breite.

   Eine eigene, kurzlebige Chrome-Instanz (CDP), kein Puppeteer nötig.
   Ändert an der Anwendung nichts (reine Leseprüfung + harmlose Klicks in
   Formularen/Dialogen, deren Zustand nur clientseitig lebt).

   Aufruf:
     set -a; . ./.env.local; set +a
     node scripts/a11y-test.mjs [Basis-URL]

   Elf nummerierte Prüfungen (siehe Kommentare unten), jede als eigener
   Schritt — nicht eine Zeile je Seite, sondern eine Zeile je Prüfung; findet
   eine Prüfung auf irgendeiner der betroffenen Seiten/Breiten einen Verstoss,
   wird der Schritt FEHLER mit den ersten Fundstellen. */
import postgres from "postgres";
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";

/* CHROME_BIN erlaubt einen anderen Chrome-Pfad als den macOS-Standard —
   in CI z. B. das auf ubuntu-latest vorinstallierte google-chrome (siehe
   tools/baseline.mjs für dasselbe Muster). */
const CHROME = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASIS = (process.argv[2] || "http://localhost:3007").replace(/\/$/, "");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a)"); process.exit(2); }

const schlaf = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Seiten ---------- */
const PFAD = { immobilien: "immobilien", kaufen: "kaufen", mieten: "mieten" };
const START = "/de";
const KAUFEN = `/de/${PFAD.immobilien}/${PFAD.kaufen}`;
const BEWERTUNG = "/de/bewertung";
const ANMELDEN = "/de/konto/anmelden";
const WISSEN = "/de/wissen/immobilien-einschaetzung";
const DATENSCHUTZ = "/de/datenschutz";

/* Eine echte, öffentliche Fourwalls-Exclusive-Objektseite aus dem Bestand
   (listing_public, publisher_kind = 'fourwalls' — dieselbe Spalte, die auch
   den Nav-Filter ?quelle=fourwalls speist, domain/marktplatz.ts
   QUELLE_ZU_KIND). Unter den jüngsten Treffern wird die erste genommen, die
   tatsächlich eine sichtbare Galerie hat (id="galGitter") — nicht jedes
   Inserat führt den Abschnitt «Bilder» (domain/dossier.ts entscheidet das),
   und ohne ihn liesse sich die Lichtbox (Prüfung 4a) nicht öffnen. */
async function exclusiveObjektPfad() {
  const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    const zeilen = await sql`
      SELECT public_ref, slug, transaction FROM listing_public
      WHERE publisher_kind = 'fourwalls'
      ORDER BY published_at DESC NULLS LAST LIMIT 50`;
    let ruecksatz = null, hatGalerie = false;
    for (const z of zeilen) {
      const pfad = `/de/${PFAD.immobilien}/${z.transaction === "rent" ? PFAD.mieten : PFAD.kaufen}/${z.slug}-${String(z.public_ref).toLowerCase()}`;
      if (!ruecksatz) ruecksatz = pfad;
      const html = await fetch(BASIS + pfad).then(r => r.text()).catch(() => "");
      if (html.includes('id="galGitter"')) return { pfad, hatGalerie: true };
    }
    return { pfad: ruecksatz, hatGalerie };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/* ---------- Chrome/CDP (Muster wie scripts/intern-mobil-test.mjs) ---------- */
async function seite(port) {
  for (let i = 0; i < 80; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const p = l.find(x => x.type === "page");
      if (p) return p.webSocketDebuggerUrl;
    } catch { /* Chrome noch nicht bereit */ }
    await schlaf(250);
  }
  throw new Error("Chrome antwortet nicht");
}

async function mitSeiteArbeiten(fn) {
  const port = 9850 + Math.floor(Math.random() * 400);
  const profil = `/tmp/fw-h8b-${port}`;
  const kind = spawn(CHROME, ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=1280,1000",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profil}`, "about:blank"], { stdio: "ignore" });
  try {
    const ws = new WebSocket(await seite(port));
    await new Promise(ok => { ws.onopen = ok; });
    let nr = 0; const offen = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && offen.has(m.id)) { offen.get(m.id)(m); offen.delete(m.id); } };
    const cmd = (method, params) => new Promise(ok => { const id = ++nr; offen.set(id, ok); ws.send(JSON.stringify({ id, method, params })); });
    const js = async expr => {
      const r = await cmd("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      return r.result && r.result.result ? r.result.result.value : null;
    };
    await cmd("Page.enable"); await cmd("Runtime.enable"); await cmd("Network.enable");
    await cmd("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    await fn({ cmd, js });
    ws.close();
  } finally {
    kind.kill();
    await schlaf(500);
    try { rmSync(profil, { recursive: true, force: true }); } catch { /* schon weg */ }
  }
}

async function setzeViewport(cmd, breite) {
  const mobil = breite <= 480;
  await cmd("Emulation.setDeviceMetricsOverride", { width: breite, height: mobil ? 844 : 1000, deviceScaleFactor: mobil ? 2 : 1, mobile: mobil });
}
async function geheZu(cmd, pfad) {
  await cmd("Page.navigate", { url: BASIS + pfad });
  await schlaf(1600);
}

/* Tastendruck über das Input-Domain — nur so löst Chrome die native
   Standardaktion aus (Tab bewegt den Fokus, Enter aktiviert einen Knopf),
   ein per JS ausgelöstes KeyboardEvent täte das nicht. */
const TASTEN = {
  Tab: { code: "Tab", key: "Tab", windowsVirtualKeyCode: 9 },
  /* Enter braucht ein `text`, sonst löst Chrome auf einem fokussierten
     <button> kein "click" aus (keine Standardaktion ohne synthetisiertes
     keypress) — geprüft gegen ein Minimalbeispiel, siehe Scratchpad-Debug. */
  Enter: { code: "Enter", key: "Enter", windowsVirtualKeyCode: 13, text: "\r" },
  Escape: { code: "Escape", key: "Escape", windowsVirtualKeyCode: 27 }
};
async function taste(cmd, name, { shift = false } = {}) {
  const k = TASTEN[name]; const modifiers = shift ? 8 : 0;
  const basis = { modifiers, windowsVirtualKeyCode: k.windowsVirtualKeyCode, code: k.code, key: k.key };
  const mitText = k.text ? { ...basis, text: k.text, unmodifiedText: k.text } : basis;
  await cmd("Input.dispatchKeyEvent", { type: "keyDown", ...mitText });
  await cmd("Input.dispatchKeyEvent", { type: "keyUp", ...basis });
  await schlaf(70);
}

/* Ein Tab-Stopp: Element, sichtbarer Name, Zone (skip/kopf/inhalt/sonst) und
   ob der Fokus sichtbar ist (outline ≠ none ODER box-shadow ≠ none ODER der
   Rahmen ändert sich gegenüber unfokussiert — Prüfung 2). */
const TAB_STOPP_JS = `(() => {
  const e = document.activeElement;
  if (!e || e === document.body) return { tag: null };
  const cs = getComputedStyle(e);
  const vorOutline = cs.outlineStyle, vorShadow = cs.boxShadow, vorBorder = cs.borderColor;
  e.blur();
  const rahmenOhne = getComputedStyle(e).borderColor;
  e.focus();
  const zone = e.closest(".skip") ? "skip" : e.closest("header.kopf, nav.haupt, .rechts, .gt, #burger") ? "kopf" : e.closest("#inhalt") ? "inhalt" : "sonst";
  const label = e.getAttribute("aria-label") || e.getAttribute("title") || (e.textContent || "").trim().slice(0, 50) || e.getAttribute("placeholder") || "";
  return { tag: e.tagName.toLowerCase(), id: e.id || null, href: e.getAttribute("href") || null, label, zone,
    sichtbar: vorOutline !== "none" || vorShadow !== "none" || vorBorder !== rahmenOhne };
})()`;
async function tabStopp(js) { return js(TAB_STOPP_JS); }
async function tabDurchlauf(cmd, js, anzahl) {
  const ergebnis = [];
  for (let i = 0; i < anzahl; i++) { await taste(cmd, "Tab"); ergebnis.push(await tabStopp(js)); }
  return ergebnis;
}
function kurz(z) { return `${z?.tag ?? "?"}${z?.id ? "#" + z.id : ""} "${(z?.label || "").slice(0, 30)}"`; }

/* ---------- Berichts-Sammlung ---------- */
const ergebnisse = [];
function assertTrue(bedingung, meldung) { if (!bedingung) throw new Error(meldung); }
async function schritt(nr, titel, fn) {
  try {
    const detail = (await fn()) || "ok";
    ergebnisse.push({ nr, titel, status: "OK", detail });
    console.log(`OK      ${nr}. ${titel}`);
  } catch (e) {
    const detail = e && e.message ? e.message : String(e);
    ergebnisse.push({ nr, titel, status: "FEHLER", detail });
    console.log(`FEHLER  ${nr}. ${titel} — ${detail}`);
  }
}

/* Seiten/Breiten für die allgemeinen Prüfungen (2 Fokus sichtbar, 7 Knopfnamen, 9 Überschriften) */
const ALLE_SEITEN = [
  ["Start", START], ["Kaufen-Suche", KAUFEN], ["Objektseite Exclusive", null /* wird unten gesetzt */],
  ["Bewertung", BEWERTUNG], ["Konto/Anmelden", ANMELDEN], ["Wissen/Einschätzung", WISSEN], ["Datenschutz", DATENSCHUTZ]
];
const BREITEN = [1280, 390];

const START_ZEIT = Date.now();
console.log(`Basis: ${BASIS}  —  Barrierefreiheits-Audit (P5.10 §29)`);

const { pfad: EXCLUSIVE_PFAD, hatGalerie: EXCLUSIVE_HAT_GALERIE } = await exclusiveObjektPfad();
if (!EXCLUSIVE_PFAD) { console.error("Keine Fourwalls-Exclusive-Objektseite in listing_public gefunden — Seed/Import fehlt."); process.exit(2); }
ALLE_SEITEN[2][1] = EXCLUSIVE_PFAD;
console.log(`Exclusive-Objektseite: ${EXCLUSIVE_PFAD} (Galerie ${EXCLUSIVE_HAT_GALERIE ? "vorhanden" : "NICHT im Testbestand gefunden"})`);

await mitSeiteArbeiten(async ({ cmd, js }) => {
  /* ---------- 1. Tastatur: Tab-Reihenfolge auf der Startseite ---------- */
  await schritt(1, "Tastatur: Tab-Reihenfolge Startseite (erste 15 Stopps, Skip-Link zuerst)", async () => {
    await setzeViewport(cmd, 1280);
    await geheZu(cmd, START);
    const stopps = await tabDurchlauf(cmd, js, 15);
    const liste = stopps.map((s, i) => `${i + 1}.${kurz(s)}`).join(" | ");
    assertTrue(stopps[0]?.tag === "a" && stopps[0]?.href === "#inhalt", `erster Stopp ist nicht der Skip-Link: ${kurz(stopps[0])}`);
    const RANG = { skip: 0, kopf: 1, inhalt: 2 };
    let hoechsterRang = -1;
    for (const s of stopps) {
      if (s.zone === "sonst") continue;
      const r = RANG[s.zone];
      assertTrue(r >= hoechsterRang, `Reihenfolge verletzt bei ${kurz(s)} (Zone «${s.zone}» nach höherer Zone)`);
      hoechsterRang = Math.max(hoechsterRang, r);
    }
    return liste;
  });

  await schritt("1b", "Tastatur: Skip-Link (Enter → #inhalt im Viewport)", async () => {
    await geheZu(cmd, START);
    await taste(cmd, "Tab"); await taste(cmd, "Enter"); await schlaf(200);
    const hash = await js("location.hash");
    const imViewport = await js(`(() => { const el = document.getElementById("inhalt"); if (!el) return false; const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; })()`);
    assertTrue(hash === "#inhalt", `location.hash=${hash}`);
    assertTrue(imViewport === true, "#inhalt nicht im Viewport nach dem Skip-Link");
    return `hash=${hash}, im Viewport`;
  });

  /* ---------- 2. Fokus sichtbar (über alle Seiten/Breiten) ---------- */
  await schritt(2, "Fokus sichtbar nach jedem Tab-Stopp (12 Stopps je Seite/Breite)", async () => {
    const unsichtbar = [];
    for (const [name, pfad] of ALLE_SEITEN) for (const breite of BREITEN) {
      await setzeViewport(cmd, breite); await geheZu(cmd, pfad);
      const stopps = await tabDurchlauf(cmd, js, 12);
      for (const s of stopps) if (s.tag && s.sichtbar === false) unsichtbar.push(`${name}@${breite}: ${kurz(s)}`);
    }
    assertTrue(unsichtbar.length === 0, `${unsichtbar.length} Element(e) ohne sichtbaren Fokus: ${unsichtbar.slice(0, 8).join("; ")}`);
    return `0 ohne sichtbaren Fokus über ${ALLE_SEITEN.length * BREITEN.length} Seite/Breite-Kombinationen`;
  });

  /* ---------- 3. Mobiles Menü (390) ---------- */
  await schritt(3, "Mobiles Menü (390): Enter öffnet, Tab bleibt drin, Escape schliesst und gibt Fokus zurück", async () => {
    await setzeViewport(cmd, 390); await geheZu(cmd, START);
    await js("document.getElementById('burger').focus()");
    await taste(cmd, "Enter"); await schlaf(200);
    assertTrue(await js("document.getElementById('blatt').classList.contains('an')"), "Blatt nach Enter auf #burger nicht offen");
    assertTrue(await js("document.getElementById('blatt').contains(document.activeElement)"), "Fokus nach Öffnen nicht im Blatt");
    await taste(cmd, "Tab");
    assertTrue(await js("document.getElementById('blatt').contains(document.activeElement)"), "Fokus verlässt das Blatt nach einem Tab");
    await taste(cmd, "Escape"); await schlaf(200);
    assertTrue(!(await js("document.getElementById('blatt').classList.contains('an')")), "Blatt nach Escape nicht geschlossen");
    assertTrue(await js("document.activeElement && document.activeElement.id === 'burger'"), "Fokus nach Escape nicht zurück auf #burger");
    return "Enter öffnet, Tab bleibt drin, Escape schliesst + Fokus zurück";
  });

  /* ---------- 4a. Dialog: Galerie-Lichtbox (Objektseite Exclusive) ---------- */
  await schritt("4a", "Dialog Galerie-Lichtbox: role/aria-modal, Fokus rein, Fokusfalle, Escape + Fokus zurück", async () => {
    if (!EXCLUSIVE_HAT_GALERIE) return "übersprungen — keine Objektseite mit sichtbarer Galerie im Testbestand (dokumentiert)";
    await setzeViewport(cmd, 1280); await geheZu(cmd, EXCLUSIVE_PFAD);
    /* Geöffnet über den echten, per Tastatur erreichbaren Knopf «Alle Bilder»
       (#alleBilder) — nicht über die Bildkacheln selbst: die sind <figure>
       mit onClick, ohne Tastaturzugang (Befund, siehe BARRIEREFREIHEIT.md). */
    assertTrue(await js("!!document.getElementById('alleBilder')"), "#alleBilder nicht gefunden");
    await js("document.getElementById('alleBilder').focus()");
    await taste(cmd, "Enter"); await schlaf(250);
    assertTrue(await js("document.getElementById('licht').classList.contains('an')"), "Dialog nicht offen");
    assertTrue((await js("document.getElementById('licht').getAttribute('role')")) === "dialog", "role=dialog fehlt");
    assertTrue((await js("document.getElementById('licht').getAttribute('aria-modal')")) === "true", "aria-modal=true fehlt");
    assertTrue(await js("document.getElementById('licht').contains(document.activeElement)"), "Fokus nach Öffnen nicht im Dialog");
    for (let i = 0; i < 30; i++) await taste(cmd, "Tab");
    assertTrue(await js("document.getElementById('licht').contains(document.activeElement)"), "Fokusfalle durchbrochen (nach 30 Tabs ausserhalb)");
    await taste(cmd, "Escape"); await schlaf(250);
    assertTrue(!(await js("document.getElementById('licht').classList.contains('an')")), "Dialog nach Escape nicht geschlossen");
    assertTrue(await js("document.activeElement && document.activeElement.id === 'alleBilder'"), "Fokus nach Escape nicht zurück auf #alleBilder");
    return "role=dialog, aria-modal=true, Fokusfalle hält, Escape + Fokus zurück";
  });

  /* ---------- 4b. Dialog: Suchabo (Kaufen-Suche) ---------- */
  await schritt("4b", "Dialog Suchabo (#sucheSpeichern): role/aria-modal, Fokus rein, Fokusfalle, Escape + Fokus zurück", async () => {
    await setzeViewport(cmd, 1280); await geheZu(cmd, KAUFEN);
    assertTrue(await js("!!document.getElementById('sucheSpeichern')"), "#sucheSpeichern nicht gefunden");
    await js("document.getElementById('sucheSpeichern').focus()");
    await taste(cmd, "Enter"); await schlaf(250);
    assertTrue((await js("document.querySelector('.abo-blatt')?.getAttribute('role')")) === "dialog", "role=dialog fehlt");
    assertTrue((await js("document.querySelector('.abo-blatt')?.getAttribute('aria-modal')")) === "true", "aria-modal=true fehlt");
    assertTrue(await js("document.querySelector('.abo-blatt') && document.querySelector('.abo-blatt').contains(document.activeElement)"), "Fokus nach Öffnen nicht im Dialog");
    for (let i = 0; i < 30; i++) await taste(cmd, "Tab");
    assertTrue(await js("document.querySelector('.abo-blatt') && document.querySelector('.abo-blatt').contains(document.activeElement)"), "Fokusfalle durchbrochen (nach 30 Tabs ausserhalb)");
    await taste(cmd, "Escape"); await schlaf(250);
    assertTrue(!(await js("!!document.querySelector('.abo-blatt')")), "Dialog nach Escape nicht geschlossen");
    assertTrue(await js("document.activeElement && document.activeElement.id === 'sucheSpeichern'"), "Fokus nach Escape nicht zurück auf #sucheSpeichern");
    return "role=dialog, aria-modal=true, Fokusfalle hält, Escape + Fokus zurück";
  });

  /* ---------- 5. Formular mit Fehlern (/de/bewertung) ---------- */
  await schritt(5, "Formular /de/bewertung: Fehlerhinweis (role=alert) + aria-invalid/aria-describedby auf betroffenen Feldern", async () => {
    await setzeViewport(cmd, 1280); await geheZu(cmd, BEWERTUNG);
    await js("document.querySelector('.knopf.voll.gross')?.click()"); await schlaf(200);
    assertTrue(await js("!!document.querySelector('[role=alert]') || !!document.querySelector('[aria-live]')"), "kein role=alert/aria-live nach ungültigem «Weiter»");
    const ort = await js("(() => { const e = document.getElementById('al-ort'); return e && { invalid: e.getAttribute('aria-invalid'), describedby: e.getAttribute('aria-describedby') }; })()");
    assertTrue(ort?.invalid === "true", `al-ort aria-invalid=${ort?.invalid}`);
    assertTrue(!!ort?.describedby && (await js(`!!document.getElementById(${JSON.stringify((ort.describedby || "").split(" ")[0])})`)), `al-ort aria-describedby=${ort?.describedby} zeigt auf nichts`);
    return `al-ort aria-invalid=${ort.invalid}, aria-describedby="${ort.describedby}"`;
  });

  /* ---------- 6. Karten-Alternative (Kaufen-Suche, ?ansicht=karte) ---------- */
  await schritt(6, "Kartenseite: Umschalter mit sichtbarem Namen + Liste per Tastatur erreichbar (nicht nur Marker)", async () => {
    await setzeViewport(cmd, 1280); await geheZu(cmd, KAUFEN + "?ansicht=karte");
    const name = (await js("document.getElementById('zurListe')?.textContent"))?.trim();
    assertTrue(!!name, "#zurListe ohne sichtbaren Namen");
    const anzahl = await js("document.querySelectorAll('#karteListe .karte').length");
    assertTrue(anzahl > 0, "keine Liste neben der Karte (#karteListe .karte)");
    return `Umschalter «${name}», ${anzahl} Objekte in der Liste neben der Karte`;
  });

  /* ---------- 7. Knopfnamen (über alle Seiten/Breiten) ---------- */
  await schritt(7, "Knopfnamen: <button>/<a> ohne Text und ohne aria-label/aria-labelledby/title", async () => {
    const JS_OHNE_NAME = `Array.from(document.querySelectorAll("button, a")).filter(e => {
      if (e.closest('[aria-hidden="true"]')) return false;
      if (e.offsetParent === null && getComputedStyle(e).position !== "fixed") return false;
      const text = (e.textContent || "").trim();
      return !text && !e.getAttribute("aria-label") && !e.getAttribute("aria-labelledby") && !e.getAttribute("title");
    }).map(e => e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (e.className ? "." + String(e.className).split(" ")[0] : ""))`;
    const ohneName = [];
    for (const [name, pfad] of ALLE_SEITEN) for (const breite of BREITEN) {
      await setzeViewport(cmd, breite); await geheZu(cmd, pfad);
      const treffer = await js(JS_OHNE_NAME);
      for (const t of treffer ?? []) ohneName.push(`${name}@${breite}: ${t}`);
    }
    assertTrue(ohneName.length === 0, `${ohneName.length} Knopf/Link ohne Namen: ${ohneName.slice(0, 8).join("; ")}`);
    return "0 Knöpfe/Links ohne Namen";
  });

  /* ---------- 8. aria-pressed (Filterchips, Tag/Abend, Kaufen/Mieten) ---------- */
  await schritt(8, "aria-pressed: Filterchips, Tag/Abend (#gtHell/#gtDunkel) wechseln den Wert beim Klick", async () => {
    await setzeViewport(cmd, 1280); await geheZu(cmd, KAUFEN);
    const vorGt = await js("document.getElementById('gtDunkel')?.getAttribute('aria-pressed')");
    assertTrue(vorGt === "true" || vorGt === "false", "#gtDunkel ohne aria-pressed");
    const zielId = vorGt === "true" ? "gtHell" : "gtDunkel";
    await js(`document.getElementById(${JSON.stringify(zielId)}).click()`);
    const nachGt = await js("document.getElementById('gtDunkel')?.getAttribute('aria-pressed')");
    assertTrue(nachGt !== vorGt, `#gtDunkel aria-pressed wechselt nicht (${vorGt} → ${nachGt})`);
    const vorChip = await js("document.querySelector('#fVerf button')?.getAttribute('aria-pressed')");
    assertTrue(vorChip === "true" || vorChip === "false", ".chipwahl#fVerf button ohne aria-pressed");
    await js("document.querySelector('#fVerf button')?.click()");
    const nachChip = await js("document.querySelector('#fVerf button')?.getAttribute('aria-pressed')");
    assertTrue(nachChip !== vorChip, `.chipwahl#fVerf aria-pressed wechselt nicht (${vorChip} → ${nachChip})`);
    return `gtDunkel ${vorGt}→${nachGt}, fVerf ${vorChip}→${nachChip}`;
  });

  /* ---------- 9. Überschriften je Seite (genau ein h1, keine Ebenensprünge) ---------- */
  await schritt(9, "Überschriften: genau ein h1 je Seite, keine Ebenensprünge", async () => {
    const befunde = [];
    for (const [name, pfad] of ALLE_SEITEN) {
      await setzeViewport(cmd, 1280); await geheZu(cmd, pfad);
      const ueberschriften = await js("Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(h => h.tagName)");
      const h1 = ueberschriften.filter(h => h === "H1").length;
      if (h1 !== 1) befunde.push(`${name}: ${h1} h1 statt 1`);
      let vorher = 1;
      for (const h of ueberschriften) { const lvl = Number(h[1]); if (lvl > vorher + 1) befunde.push(`${name}: Ebenensprung h${vorher}→h${lvl}`); vorher = lvl; }
    }
    assertTrue(befunde.length === 0, befunde.join("; "));
    return `genau 1 h1 je Seite, keine Ebenensprünge — Seiten: ${ALLE_SEITEN.map(s => s[0]).join(", ")}`;
  });

  /* ---------- 11. prefers-reduced-motion (Start) ---------- */
  await schritt(11, "prefers-reduced-motion: keine laufenden Animationen, Transition ≤ 0.01s auf .kopf/.blatt", async () => {
    await cmd("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await setzeViewport(cmd, 1280); await geheZu(cmd, START); await schlaf(500);
    const anzahl = await js("document.getAnimations().length");
    const transKopf = await js("parseFloat(getComputedStyle(document.querySelector('.kopf')).transitionDuration || '0')");
    const transBlatt = await js("parseFloat(getComputedStyle(document.getElementById('blatt')).transitionDuration || '0')");
    await cmd("Emulation.setEmulatedMedia", { features: [] });
    assertTrue(anzahl === 0, `document.getAnimations().length=${anzahl}`);
    assertTrue(transKopf <= 0.01, `.kopf transition-duration=${transKopf}s`);
    assertTrue(transBlatt <= 0.01, `#blatt transition-duration=${transBlatt}s`);
    return `0 Animationen, .kopf ${transKopf}s, #blatt ${transBlatt}s`;
  });
});

/* ---------- 10. lang je Sprache (Start, Stichprobe) — reines fetch, kein Browser nötig ---------- */
await schritt(10, "html lang stimmt je Sprache (Stichprobe Start: de/fr/it/en)", async () => {
  const treffer = [];
  for (const l of ["de", "fr", "it", "en"]) {
    const html = await fetch(`${BASIS}/${l}`).then(r => r.text());
    const m = html.match(/<html[^>]*\slang="([^"]+)"/);
    assertTrue(m?.[1] === l, `/${l}: lang="${m?.[1]}"`);
    treffer.push(`${l}:${m[1]}`);
  }
  return treffer.join(", ");
});

const dauerMs = Date.now() - START_ZEIT;
console.log(`\n${ergebnisse.length} Prüfungen, ${ergebnisse.filter(e => e.status === "FEHLER").length} FEHLER — Dauer ${(dauerMs / 1000).toFixed(1)}s`);
process.exit(ergebnisse.some(e => e.status === "FEHLER") ? 1 : 0);
