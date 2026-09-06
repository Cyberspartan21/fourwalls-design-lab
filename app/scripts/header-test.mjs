#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Kopfzeilen-Inventar und -Prüfung (P5.10 §15/§16)

   Prüft die Sicherheitsköpfe (next.config.ts + proxy.ts/lib/sicherheitskoepfe.ts)
   auf fünf Stellen: Startseite, Gesundheitsprüfung, eine echte Objektseite,
   die Kartenseite (Marktplatz im Kartenmodus) und ein statisches Asset
   (selbst gehostete Schrift).

   node scripts/header-test.mjs [Basis-URL]   Standard: http://localhost:3007
   DATABASE_URL muss gesetzt sein (für die Objektseite — siehe scripts/migrate.mjs).

   Bei einer https-Basis wird zusätzlich Strict-Transport-Security verlangt
   (siehe lib/sicherheitskoepfe.ts — hsts() liefert nur bei APP_ENV
   staging/production einen Wert; ob der SERVER das auf https gesetzt hat,
   prüft dieses Skript anhand des Protokolls, nicht anhand von APP_ENV, weil
   die Basis-URL das einzige ist, was dieses Skript über die Umgebung weiss).

   Schreibt eine Tabelle auf stdout. Exit 1, sobald irgendeine Prüfung
   FEHLER meldet. Ändert an der Anwendung nichts. */
import postgres from "postgres";

const BASIS = (process.argv[2] ?? "http://localhost:3007").replace(/\/$/, "");
const IST_HTTPS = BASIS.startsWith("https://");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a)"); process.exit(2); }

const ergebnisse = [];
let fehlerZaehler = 0;

function pruefe(seite, feld, bedingung, detail) {
  ergebnisse.push({ seite, feld, status: bedingung ? "OK" : "FEHLER", detail: detail ?? "" });
  if (!bedingung) fehlerZaehler++;
}

async function holen(pfad) {
  const ctl = new AbortController();
  const timeout = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(BASIS + pfad, { redirect: "manual", signal: ctl.signal, headers: { "user-agent": "fw-header-test" } });
    // Body verwerfen, aber die Verbindung sauber schliessen.
    await res.arrayBuffer().catch(() => {});
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

/* Eine echte, öffentliche Objektseite aus dem Bestand — kein hartcodierter
   Slug, der irgendwann nicht mehr existiert. */
async function objektPfad() {
  const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} });
  try {
    const PFAD = { buy: "kaufen", rent: "mieten" };
    const z = await sql`
      SELECT public_ref, slug, transaction FROM listing
      WHERE status IN ('published','reserved')
      ORDER BY published_at DESC NULLS LAST LIMIT 1`;
    if (!z[0]) return null;
    const r = z[0];
    return `/de/immobilien/${PFAD[r.transaction]}/${r.slug}-${String(r.public_ref).toLowerCase()}`;
  } finally {
    await sql.end();
  }
}

/* ---------- Erwartete Köpfe je nach Art der Seite ---------- */
function pruefeGemeinsam(seite, res) {
  const h = res.headers;
  pruefe(seite, "x-content-type-options", h.get("x-content-type-options") === "nosniff", h.get("x-content-type-options"));
  pruefe(seite, "referrer-policy", h.get("referrer-policy") === "strict-origin-when-cross-origin", h.get("referrer-policy"));
  const pp = h.get("permissions-policy") ?? "";
  pruefe(seite, "permissions-policy", ["camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()"].every(d => pp.includes(d)), pp);
  pruefe(seite, "cross-origin-opener-policy", h.get("cross-origin-opener-policy") === "same-origin", h.get("cross-origin-opener-policy"));
  /* frame-ancestors 'none' per CSP + X-Frame-Options DENY als Rückfall für
     Browser, die frame-ancestors nicht kennen (§15). */
  const csp = h.get("content-security-policy") ?? "";
  pruefe(seite, "x-frame-options (Rückfall)", h.get("x-frame-options") === "DENY", h.get("x-frame-options"));
  pruefe(seite, "csp: frame-ancestors 'none'", csp.includes("frame-ancestors 'none'"));
  pruefe(seite, "csp: default-src 'self'", csp.includes("default-src 'self'"));
  pruefe(seite, "csp: object-src 'none'", csp.includes("object-src 'none'"));
  pruefe(seite, "csp: base-uri 'self'", csp.includes("base-uri 'self'"));
  pruefe(seite, "csp: form-action 'self'", csp.includes("form-action 'self'"));
  pruefe(seite, "csp: font-src 'self'", csp.includes("font-src 'self'"));
  pruefe(seite, "csp: worker-src 'self' blob:", csp.includes("worker-src 'self' blob:"));
  pruefe(seite, "csp: img-src erlaubt swisstopo+openfreemap", csp.includes("*.geo.admin.ch") && csp.includes("tiles.openfreemap.org"));
  pruefe(seite, "csp: script-src vorhanden", /script-src [^;]+/.test(csp));
  pruefe(seite, "csp: style-src vorhanden", /style-src [^;]+/.test(csp));
  if (IST_HTTPS) {
    pruefe(seite, "strict-transport-security (https-Basis)", (h.get("strict-transport-security") ?? "").includes("max-age="), h.get("strict-transport-security"));
    pruefe(seite, "csp: upgrade-insecure-requests (https-Basis)", csp.includes("upgrade-insecure-requests"));
  }
  return csp;
}

async function main() {
  const objekt = await objektPfad();
  const seiten = [
    { name: "/de", pfad: "/de" },
    { name: "/api/health", pfad: "/api/health" },
    { name: "Objektseite", pfad: objekt },
    { name: "Kartenseite", pfad: "/de/immobilien/kaufen?ansicht=karte" },
    { name: "Statisches Asset (Schrift)", pfad: "/fonts/petrona-latin-wght-normal.woff2" }
  ];

  for (const s of seiten) {
    if (!s.pfad) { pruefe(s.name, "erreichbar", false, "kein Bestand für eine Objektseite gefunden"); continue; }
    let res;
    try { res = await holen(s.pfad); }
    catch (e) { pruefe(s.name, "erreichbar", false, String(e?.message ?? e)); continue; }
    pruefe(s.name, "erreichbar", res.status > 0 && res.status < 500, String(res.status));
    pruefeGemeinsam(s.name, res);
  }

  /* ---------- Tabelle ---------- */
  const breiteSeite = Math.max(6, ...ergebnisse.map(r => r.seite.length));
  const breiteFeld = Math.max(4, ...ergebnisse.map(r => r.feld.length));
  console.log("Seite".padEnd(breiteSeite), "Feld".padEnd(breiteFeld), "Status", "Detail");
  for (const r of ergebnisse) {
    console.log(r.seite.padEnd(breiteSeite), r.feld.padEnd(breiteFeld), r.status.padEnd(6), (r.detail ?? "").slice(0, 80));
  }
  console.log(`\n${ergebnisse.length - fehlerZaehler}/${ergebnisse.length} Prüfungen OK` + (fehlerZaehler ? `, ${fehlerZaehler} FEHLER` : ""));
  if (fehlerZaehler) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(2); });
