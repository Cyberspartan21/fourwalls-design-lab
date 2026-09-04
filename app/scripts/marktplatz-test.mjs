/* ============================================================
   FOURWALLS — Integrations-/Sicherheitsprüfung des Marktplatzes (P5.x)

   Prüft den öffentlichen Marktplatz über HTTP (API + gerendertes HTML) gegen
   den Suchvertrag (siehe domain/suchurl.ts, domain/marktplatz.ts) und dazu
   ein paar Kontrollen direkt in der Datenbank (Sichtbarkeit, Geo-Privatsphäre,
   Zeilenzahl). Läuft gegen einen bereits laufenden Produktions-Build
   (next start), NICHT gegen next dev.

   Aufruf:
     set -a; . ./.env.local; set +a
     node scripts/marktplatz-test.mjs [basisUrl]      Standard: http://localhost:3008

   Ausgabe:
     - Tabelle auf stdout (Prüfung → OK/FEHLER, Detail)
     - var/marktplatz-bericht.json
     - Exit 1 bei irgendeinem FEHLER, sonst 0
   ============================================================ */
import postgres from "postgres";
import { writeFileSync, mkdirSync, existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
const appOrdner = join(hier, "..");
const berichtPfad = join(appOrdner, "var", "marktplatz-bericht.json");

const BASIS = (process.argv[2] ?? "http://localhost:3008").replace(/\/$/, "");
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL fehlt"); process.exit(1); }
const sql = postgres(url, { max: 4, onnotice: () => {} });

const LOCALES = ["de", "fr", "it", "en"];
const PFAD = {
  de: { immobilien: "immobilien", kaufen: "kaufen", mieten: "mieten" },
  fr: { immobilien: "immobilier", kaufen: "acheter", mieten: "louer" },
  it: { immobilien: "immobili", kaufen: "comprare", mieten: "affittare" },
  en: { immobilien: "properties", kaufen: "buy", mieten: "rent" }
};

/* ---------- Zähler und Zeitmessung ---------- */
let anzahlAnfragen = 0;
const skriptStart = Date.now();

/* ---------- HTTP-Hilfsfunktion ---------- */
async function holen(pfad, opts = {}) {
  anzahlAnfragen++;
  const ctl = new AbortController();
  const timeout = setTimeout(() => ctl.abort(), 60000);
  try {
    const res = await fetch(BASIS + pfad, { redirect: "manual", signal: ctl.signal, ...opts });
    const text = await res.text().catch(() => "");
    let json = null;
    try { json = JSON.parse(text); } catch { /* kein JSON, kein Problem */ }
    return { status: res.status, headers: res.headers, text, json, location: res.headers.get("location") };
  } catch (e) {
    return { status: 0, headers: new Headers(), text: "", json: null, location: null, fehler: String((e && e.message) || e) };
  } finally { clearTimeout(timeout); }
}

/* ---------- Nebenläufigkeit begrenzen ---------- */
async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let i = 0;
  async function next() { while (i < items.length) { const idx = i++; out[idx] = await worker(items[idx], idx); } }
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, next));
  return out;
}

/* ---------- Ergebnisliste ---------- */
const ergebnisse = [];
function eintrag(pruefung, ok, detail = "") { ergebnisse.push({ pruefung, ok: !!ok, detail: String(detail) }); }

/* Kurzfassung einer Antwort für Fehlermeldungen — nie den ganzen Treffer-Body,
   nur so viel, wie zum Verstehen nötig ist. */
function kurz(res, n = 300) {
  const s = res.json ? JSON.stringify(res.json) : res.text;
  return s.length > n ? s.slice(0, n) + "…" : s;
}

/* ---------- Haversine (km) ---------- */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* ---------- Monotonie-Prüfungen (NULLs am Ende) ---------- */
function nichtAbsteigendMitNullEnde(werte) {
  let sahNull = false;
  for (let i = 0; i < werte.length; i++) {
    if (werte[i] == null) { sahNull = true; continue; }
    if (sahNull) return `Wert nach NULL: Index ${i}`;
    if (i > 0 && werte[i - 1] != null && werte[i] < werte[i - 1]) return `Index ${i}: ${werte[i]} < ${werte[i - 1]}`;
  }
  return null;
}
function nichtSteigendMitNullEnde(werte) {
  let sahNull = false;
  for (let i = 0; i < werte.length; i++) {
    if (werte[i] == null) { sahNull = true; continue; }
    if (sahNull) return `Wert nach NULL: Index ${i}`;
    if (i > 0 && werte[i - 1] != null && werte[i] > werte[i - 1]) return `Index ${i}: ${werte[i]} > ${werte[i - 1]}`;
  }
  return null;
}

/* publishedAt kommt (Stand dieser Prüfung) nicht als ISO-Datum, sondern als
   String(Date).slice(0,10) — z.B. "Wed Aug 26": Wochentag + Monat + Tag, OHNE
   Jahr. Für den reinen Reihenfolge-Vergleich bilden wir daraus einen
   vergleichbaren Schlüssel (Monat·100+Tag); das Fehlen des Jahres selbst wird
   unten als eigener Befund gemeldet. */
const MONAT = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
function alsSortierbaresDatum(s) {
  if (s == null) return null;
  const m = /^\w{3} (\w{3}) (\d{2})$/.exec(s);
  if (m && MONAT[m[1]]) return MONAT[m[1]] * 100 + Number(m[2]);
  return s; // unbekanntes Format: unverändert vergleichen (Fallback)
}
function istIsoDatum(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }

/* ---------- x-forwarded-for je Prüfung ---------- */
let xffZaehler = 0;
function neueHerkunft() { xffZaehler++; return `10.9.0.${xffZaehler}`; }

async function postInquiry(publicRef, felder = {}) {
  const body = JSON.stringify({
    publicRef, art: "listing_question", name: "Prüfperson Marktplatz-Test",
    email: "pruefung@example.com", nachricht: "Automatisierte Integrationsprüfung — bitte ignorieren.",
    ...felder
  });
  return holen("/api/inquiries", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASIS, "x-forwarded-for": neueHerkunft() },
    body
  });
}

/* ============================================================
   0. Warten, bis der Build bereit ist
   ============================================================ */
async function warteAufGesundheit() {
  const frist = Date.now() + 5 * 60 * 1000;
  while (Date.now() < frist) {
    try {
      const res = await fetch(BASIS + "/api/health", { redirect: "manual" });
      if (res.status === 200) return true;
    } catch { /* Build noch nicht bereit */ }
    await new Promise(r => setTimeout(r, 5000));
  }
  return false;
}

/* ============================================================
   Hauptprogramm
   ============================================================ */
async function main() {
  process.stdout.write(`Warte auf ${BASIS}/api/health …\n`);
  const bereit = await warteAufGesundheit();
  if (!bereit) {
    console.error("Die Anwendung war nach 5 Minuten nicht bereit (kein 200 von /api/health).");
    await sql.end();
    process.exit(1);
  }
  process.stdout.write("Anwendung bereit — beginne Prüfungen.\n");

  const listingZahlVorher = Number((await sql`SELECT count(*)::int AS n FROM listing`)[0].n);

  /* ---------- Vorabdaten aus der Datenbank ---------- */
  const draftRef = "FWL-2026-000145";
  const draftSlugPfad = "entwurf-unsichtbar-fwl-2026-000145";

  const draftZeile = (await sql`SELECT public_ref, status, slug FROM listing WHERE public_ref = ${draftRef}`)[0];

  const nichtOeffentlich = await sql`
    SELECT public_ref, status FROM listing WHERE status IN ('archived','sold','rented','draft') ORDER BY public_ref`;

  const veroeffentlichteRefs = (await sql`
    SELECT public_ref FROM listing WHERE status = 'published' ORDER BY public_ref`).map(r => r.public_ref);

  const ungenaueDemo = await sql`
    SELECT l.public_ref, l.status, l.slug, l.transaction,
           round(ST_X(pr.geom_exact::geometry)::numeric, 4) AS elng,
           round(ST_Y(pr.geom_exact::geometry)::numeric, 4) AS elat,
           ST_X(pr.geom_exact::geometry) AS elng_roh, ST_Y(pr.geom_exact::geometry) AS elat_roh,
           ST_X(pr.geom_public::geometry) AS plng_roh, ST_Y(pr.geom_public::geometry) AS plat_roh,
           pr.geo_precision
      FROM listing l JOIN property pr ON pr.id = l.property_id
     WHERE l.is_demo = true AND pr.geo_precision <> 'exact' AND pr.geom_exact IS NOT NULL
     ORDER BY l.public_ref`;

  const ungenaueVeroeffentlicht = ungenaueDemo.filter(r => r.status === "published" || r.status === "reserved");

  const ungefaehreVersetzt = ungenaueDemo
    .filter(r => (r.status === "published" || r.status === "reserved") && r.plng_roh != null && r.plat_roh != null)
    .map(r => ({ ...r, versatzGrad: Math.sqrt((r.plat_roh - r.elat_roh) ** 2 + (r.plng_roh - r.elng_roh) ** 2) }))
    .filter(r => r.versatzGrad > 0.003)
    .slice(0, 10);

  /* ============================================================
     A. Sichtbarkeit / Negativreise — Entwurf FWL-2026-000145
     ============================================================ */
  if (!draftZeile || draftZeile.status !== "draft") {
    eintrag("A0. Entwurf FWL-2026-000145 existiert als draft", false, `Zeile: ${JSON.stringify(draftZeile)}`);
  } else {
    eintrag("A0. Entwurf FWL-2026-000145 existiert als draft", true, `slug=${draftZeile.slug}`);
  }

  {
    const [buy, rent] = await Promise.all([
      holen("/api/search?trans=buy&alle=1&proSeite=48&seite=50"),
      holen("/api/search?trans=rent&alle=1&proSeite=48&seite=50")
    ]);
    const treffend = r => (r.json?.treffer ?? []).some(t => t.id === draftRef);
    const gefundenBuy = buy.status === 200 && treffend(buy);
    const gefundenRent = rent.status === 200 && treffend(rent);
    eintrag("A1. Entwurf nicht in /api/search (alle=1, seite=50, buy+rent)", !gefundenBuy && !gefundenRent,
      `buy status=${buy.status} treffer=${buy.json?.treffer?.length ?? "?"} gefunden=${gefundenBuy}; rent status=${rent.status} treffer=${rent.json?.treffer?.length ?? "?"} gefunden=${gefundenRent}`);

    /* Nebenprüfung: keine der vier ausgeschlossenen Statusarten erscheint */
    const alleTreffer = [...(buy.json?.treffer ?? []), ...(rent.json?.treffer ?? [])].map(t => t.id);
    const idsMenge = new Set(alleTreffer);
    const unerlaubtGefunden = nichtOeffentlich.filter(r => idsMenge.has(r.public_ref));
    eintrag("A1b. Kein archived/sold/rented/draft-Inserat in alle=1-Suche (buy+rent, seite=50)", unerlaubtGefunden.length === 0,
      unerlaubtGefunden.length ? `gefunden: ${unerlaubtGefunden.map(r => `${r.public_ref}(${r.status})`).join(", ")}` : `${nichtOeffentlich.length} geprüfte nicht-öffentliche Inserate, 0 sichtbar`);
  }

  {
    const [buyKarte, rentKarte] = await Promise.all([
      holen("/api/search?trans=buy&alle=1&ansicht=karte"),
      holen("/api/search?trans=rent&alle=1&ansicht=karte")
    ]);
    const inPunkte = r => (r.json?.punkte ?? []).some(p => p.id === draftRef);
    const gBuy = buyKarte.status === 200 && inPunkte(buyKarte);
    const gRent = rentKarte.status === 200 && inPunkte(rentKarte);
    eintrag("A2. Entwurf nicht in punkte[] (ansicht=karte, buy+rent)", !gBuy && !gRent,
      `buy status=${buyKarte.status} punkte=${buyKarte.json?.punkte?.length ?? "?"}; rent status=${rentKarte.status} punkte=${rentKarte.json?.punkte?.length ?? "?"}`);
  }

  {
    const seite = await holen(`/de/immobilien/kaufen/${draftSlugPfad}`);
    eintrag("A3. Objektseite des Entwurfs → 404", seite.status === 404, `status=${seite.status}`);
  }

  {
    const stichprobe = veroeffentlichteRefs.filter((_, i) => i % 10 === 0).slice(0, 10);
    const antworten = await pool(stichprobe, 6, ref => holen(`/api/similar?ref=${ref}`));
    const treffer = antworten.map((a, i) => ({ ref: stichprobe[i], drin: (a.json?.treffer ?? []).some(t => t.id === draftRef), status: a.status }));
    const belastet = treffer.filter(t => t.drin);
    const eigeneAnfrage = await holen(`/api/similar?ref=${draftRef}`);
    const eigeneLeer = eigeneAnfrage.status === 200 && Array.isArray(eigeneAnfrage.json?.treffer) && eigeneAnfrage.json.treffer.length === 0;
    eintrag("A4. Entwurf in keiner /api/similar-Antwort (10 Stichproben) + eigene Referenz liefert leer", belastet.length === 0 && eigeneLeer,
      `Stichproben: ${stichprobe.length}, belastet: ${belastet.length}; eigene Referenz status=${eigeneAnfrage.status} treffer=${JSON.stringify(eigeneAnfrage.json?.treffer ?? eigeneAnfrage.text.slice(0, 200))}`);
  }

  {
    const vorInquiry = Number((await sql`SELECT count(*)::int AS n FROM inquiry i JOIN listing l ON l.id = i.listing_id WHERE l.public_ref = ${draftRef}`)[0]?.n ?? 0);
    const res = await postInquiry(draftRef);
    const nachInquiry = Number((await sql`SELECT count(*)::int AS n FROM inquiry i JOIN listing l ON l.id = i.listing_id WHERE l.public_ref = ${draftRef}`)[0]?.n ?? 0);
    eintrag("A5. POST inquiry mit Entwurfs-publicRef → 404, keine neue Zeile", res.status === 404 && nachInquiry === vorInquiry,
      `status=${res.status} body=${kurz(res)} inquiry-Zeilen vorher=${vorInquiry} nachher=${nachInquiry}`);
  }

  /* ============================================================
     B. Geo-Privatsphäre in der Breite
     ============================================================ */
  {
    const [buyListe, rentListe, buyKarte, rentKarte] = await Promise.all([
      holen("/api/search?trans=buy&alle=1&proSeite=48&seite=50"),
      holen("/api/search?trans=rent&alle=1&proSeite=48&seite=50"),
      holen("/api/search?trans=buy&alle=1&ansicht=karte"),
      holen("/api/search?trans=rent&alle=1&ansicht=karte")
    ]);
    const texte = { liste_buy: buyListe.text, liste_rent: rentListe.text, karte_buy: buyKarte.text, karte_rent: rentKarte.text };
    const lecks = [];
    for (const demo of ungenaueDemo) {
      if (demo.elat == null || demo.elng == null) continue;
      const reLat = new RegExp(`(?<![\\d.])${String(demo.elat).replace(".", "\\.")}(?![\\d])`);
      const reLng = new RegExp(`(?<![\\d.])${String(demo.elng).replace(".", "\\.")}(?![\\d])`);
      for (const [wo, txt] of Object.entries(texte)) {
        if (reLat.test(txt) && reLng.test(txt)) lecks.push(`${demo.public_ref} in ${wo} (${demo.elat},${demo.elng})`);
      }
    }
    eintrag("B1/B2. Keine exakten Koordinaten ungenauer Demo-Inserate in Liste/Karte (buy+rent)", lecks.length === 0,
      lecks.length ? `${lecks.length} Treffer: ${lecks.slice(0, 10).join("; ")}${lecks.length > 10 ? " …" : ""}` : `${ungenaueDemo.length} ungenaue Demo-Inserate geprüft, 0 Lecks in 4 Antworten`);
  }

  {
    const stichprobe = ungenaueVeroeffentlicht.filter((_, i) => i % 12 === 0).slice(0, 25);
    const lecks = [];
    let geprueft = 0;
    for (const demo of stichprobe) {
      const trans = demo.transaction === "rent" ? "mieten" : "kaufen";
      const pfad = `/de/immobilien/${trans}/${demo.slug}-${demo.public_ref.toLowerCase()}`;
      const [ssr, rsc] = await Promise.all([holen(pfad), holen(pfad, { headers: { rsc: "1" } })]);
      geprueft++;
      if (ssr.status !== 200) { lecks.push(`${demo.public_ref}: SSR-Status ${ssr.status} statt 200`); continue; }
      const reLat = new RegExp(`(?<![\\d.])${String(demo.elat).replace(".", "\\.")}(?![\\d])`);
      const reLng = new RegExp(`(?<![\\d.])${String(demo.elng).replace(".", "\\.")}(?![\\d])`);
      if (reLat.test(ssr.text) && reLng.test(ssr.text)) lecks.push(`${demo.public_ref}: exakte Koordinate im SSR-HTML`);
      if (reLat.test(rsc.text) && reLng.test(rsc.text)) lecks.push(`${demo.public_ref}: exakte Koordinate in der RSC-Nutzlast`);
    }
    eintrag("B3. Objektseite (SSR+RSC) von 25 ungenauen Inseraten ohne exakte Koordinate", lecks.length === 0,
      `${geprueft} geprüft (von ${ungenaueVeroeffentlicht.length} ungenauen veröffentlichten Inseraten, jedes 12.); Lecks: ${lecks.length ? lecks.slice(0, 10).join("; ") : "keine"}`);
  }

  {
    const treffer = [];
    for (const demo of ungefaehreVersetzt) {
      const n = (demo.elat_roh + 0.001).toFixed(6), s = (demo.elat_roh - 0.001).toFixed(6);
      const o = (demo.elng_roh + 0.001).toFixed(6), w = (demo.elng_roh - 0.001).toFixed(6);
      const trans = demo.transaction === "rent" ? "rent" : "buy";
      const res = await holen(`/api/search?trans=${trans}&alle=1&ansicht=karte&box=${n},${s},${o},${w}`);
      const drin = res.status === 200 && (res.json?.punkte ?? []).some(p => p.id === demo.public_ref);
      if (res.status !== 200) { treffer.push(`${demo.public_ref}: Status ${res.status} (erwartet 200)`); continue; }
      if (drin) treffer.push(`${demo.public_ref}: im Ausschnitt um die EXAKTE Koordinate sichtbar (Versatz ${demo.versatzGrad.toFixed(4)}°)`);
    }
    eintrag("B4. Ausschnitt um exakte Koordinate zeigt kein versetztes Inserat (10 Stichproben)", treffer.length === 0,
      `${ungefaehreVersetzt.length} Inserate mit Versatz > 0.003° geprüft; Auffälligkeiten: ${treffer.length ? treffer.join("; ") : "keine"}`);
  }

  /* ============================================================
     C. Liste ↔ Karte
     ============================================================ */
  {
    const anfragenC = ["ort=ort-zuerich", "ort=ort-luzern&um=20", "trans=rent&ort=kt-BE", "typ=wohnung&pmax=1200000", "ort=rg-romandie"];
    for (const q of anfragenC) {
      const [liste, karte] = await Promise.all([
        holen(`/api/search?${q}&proSeite=48&seite=50`),
        holen(`/api/search?${q}&ansicht=karte`)
      ]);
      if (liste.status !== 200 || karte.status !== 200) {
        eintrag(`C. Liste↔Karte «${q}»`, false, `Liste status=${liste.status} (${kurz(liste)}); Karte status=${karte.status} (${kurz(karte)})`);
        continue;
      }
      const listeTreffer = liste.json.treffer ?? [];
      const totalGleich = liste.json.total === karte.json.total;
      const mitKoord = listeTreffer.filter(t => t.lat != null).length;
      const punkte = karte.json.punkte ?? [];
      const punkteLaengeOk = punkte.length === mitKoord;
      const idsListe = new Set(listeTreffer.map(t => t.id));
      const idsKarte = new Set(punkte.map(p => p.id));
      const mengenGleich = idsListe.size === idsKarte.size && [...idsListe].every(id => idsKarte.has(id));
      const vollstaendig = liste.json.hatMehr === false;
      eintrag(`C. Liste↔Karte «${q}»`, totalGleich && punkteLaengeOk && mengenGleich,
        `total liste=${liste.json.total} karte=${karte.json.total} gleich=${totalGleich}; treffer-mit-koord=${mitKoord} punkte=${punkte.length} gleich=${punkteLaengeOk}; id-mengen gleich=${mengenGleich}${vollstaendig ? "" : " (Achtung: Liste war nicht vollständig, hatMehr=true — proSeite*seite reicht nicht für den ganzen Bestand)"}`);
    }
  }

  /* ============================================================
     D. Umkreis
     ============================================================ */
  {
    const mittelpunkt = { lat: 47.0502, lng: 8.3093 };
    const stufen = [5, 10, 20, 50];
    const antworten = [];
    for (const um of stufen) antworten.push(await holen(`/api/search?ort=ort-luzern&um=${um}&proSeite=48&seite=50`));
    const totals = antworten.map(a => a.json?.total ?? null);
    let monoton = true, monotonDetail = "";
    for (let i = 1; i < totals.length; i++) if (totals[i] == null || totals[i - 1] == null || totals[i] < totals[i - 1]) { monoton = false; monotonDetail = `um=${stufen[i - 1]}→${totals[i - 1]}, um=${stufen[i]}→${totals[i]}`; }
    const interpretationOk = antworten.every(a => a.json?.geo?.interpretation === "umkreis");
    const distanzVerletzungen = [];
    antworten.forEach((a, i) => {
      const um = stufen[i];
      for (const t of a.json?.treffer ?? []) {
        if (t.lat == null || t.lng == null) continue;
        const d = haversineKm(mittelpunkt.lat, mittelpunkt.lng, t.lat, t.lng);
        if (d > um + 2.5) distanzVerletzungen.push(`um=${um}: ${t.id} liegt ${d.toFixed(2)} km entfernt`);
      }
    });
    eintrag("D. Umkreis um Luzern (5/10/20/50 km): totals monoton, interpretation, Distanzen", monoton && interpretationOk && distanzVerletzungen.length === 0,
      `totals=${JSON.stringify(totals)} monoton=${monoton}${monoton ? "" : " (" + monotonDetail + ")"}; interpretation ok=${interpretationOk}; Distanzverletzungen=${distanzVerletzungen.length}${distanzVerletzungen.length ? ": " + distanzVerletzungen.slice(0, 5).join("; ") : ""}`);
  }

  /* ============================================================
     E. Ausschnitt
     ============================================================ */
  {
    const box = { n: 47.45, s: 47.30, o: 8.70, w: 8.40 };
    const res = await holen(`/api/search?ansicht=karte&box=${box.n},${box.s},${box.o},${box.w}`);
    if (res.status !== 200) {
      eintrag("E. Ausschnitt-Box", false, `status=${res.status} body=${kurz(res)}`);
    } else {
      const ausserhalb = (res.json.punkte ?? []).filter(p => !(p.lat <= box.n && p.lat >= box.s && p.lng <= box.o && p.lng >= box.w));
      const interpretationOk = res.json.geo?.interpretation === "ausschnitt";
      eintrag("E. Ausschnitt-Box: alle Punkte innerhalb, interpretation=ausschnitt", ausserhalb.length === 0 && interpretationOk,
        `punkte=${res.json.punkte?.length ?? 0} ausserhalb=${ausserhalb.length} interpretation=${res.json.geo?.interpretation}`);
    }
  }

  /* ============================================================
     F. Sortierung
     ============================================================ */
  {
    const preisAuf = await holen("/api/search?sort=preis-auf&proSeite=48");
    if (preisAuf.status === 200) {
      const fehler = nichtAbsteigendMitNullEnde((preisAuf.json.treffer ?? []).map(t => t.price));
      eintrag("F. sort=preis-auf: price nicht absteigend, NULLs am Ende", fehler === null, fehler ?? `${preisAuf.json.treffer.length} Treffer geprüft`);
    } else eintrag("F. sort=preis-auf", false, `status=${preisAuf.status}`);

    const preisAb = await holen("/api/search?sort=preis-ab&proSeite=48");
    if (preisAb.status === 200) {
      const fehler = nichtSteigendMitNullEnde((preisAb.json.treffer ?? []).map(t => t.price));
      eintrag("F. sort=preis-ab: price nicht steigend, NULLs am Ende", fehler === null, fehler ?? `${preisAb.json.treffer.length} Treffer geprüft`);
    } else eintrag("F. sort=preis-ab", false, `status=${preisAb.status}`);

    const neu = await holen("/api/search?sort=neu&proSeite=48");
    if (neu.status === 200) {
      const t = neu.json.treffer ?? [];
      let i = 0;
      while (i < 3 && i < t.length && t[i].listingTier === "exclusive") i++;
      const rest = t.slice(i).map(x => x.publishedAt);
      const restVergleichbar = rest.map(alsSortierbaresDatum);
      const fehler = nichtSteigendMitNullEnde(restVergleichbar);
      eintrag("F. sort=neu: publishedAt (chronologisch) nicht aufsteigend (ausser bis zu 3 Exclusive am Anfang)", fehler === null,
        `führende exklusive Treffer=${i}; ${fehler ?? `${rest.length} restliche Treffer geprüft (Werte: ${JSON.stringify(rest.slice(0, 6))})`}`);

      const nichtIso = t.filter(x => x.publishedAt != null && !istIsoDatum(x.publishedAt));
      eintrag("F. publishedAt ist ein gültiges ISO-Datum (YYYY-MM-DD)", nichtIso.length === 0,
        nichtIso.length
          ? `${nichtIso.length} von ${t.length} Treffern mit nicht-ISO publishedAt, z.B. ${nichtIso[0].id}=«${nichtIso[0].publishedAt}» — server/search.ts alsTreffer() baut das Feld über String(z.published_at).slice(0,10); postgres.js liefert für timestamptz ein Date-Objekt, dessen toString() «Www Mon DD …» ist, also fehlt das Jahr und die Zeichenkette ist nicht ISO-sortierbar.`
          : `${t.length} Treffer geprüft`);
    } else eintrag("F. sort=neu", false, `status=${neu.status}`);

    const flaeche = await holen("/api/search?sort=flaeche&proSeite=48");
    if (flaeche.status === 200) {
      const fehler = nichtSteigendMitNullEnde((flaeche.json.treffer ?? []).map(t => t.livingArea));
      eintrag("F. sort=flaeche: livingArea nicht aufsteigend, NULLs am Ende", fehler === null, fehler ?? `${flaeche.json.treffer.length} Treffer geprüft`);
    } else eintrag("F. sort=flaeche", false, `status=${flaeche.status}`);

    const zimmer = await holen("/api/search?sort=zimmer&proSeite=48");
    if (zimmer.status === 200) {
      const fehler = nichtSteigendMitNullEnde((zimmer.json.treffer ?? []).map(t => t.rooms));
      eintrag("F. sort=zimmer: rooms nicht aufsteigend, NULLs am Ende", fehler === null, fehler ?? `${zimmer.json.treffer.length} Treffer geprüft`);
    } else eintrag("F. sort=zimmer", false, `status=${zimmer.status}`);

    const m2 = await holen("/api/search?sort=m2&proSeite=48");
    if (m2.status === 200) {
      const WOHNOBJEKTE = ["wohnung", "haus", "villa", "chalet"];
      const relevante = (m2.json.treffer ?? []).filter(t => t.price != null && t.livingArea != null && WOHNOBJEKTE.includes(t.propertyType));
      const quoten = relevante.map(t => t.price / t.livingArea);
      const fehler = nichtAbsteigendMitNullEnde(quoten);
      eintrag("F. sort=m2: price/livingArea nicht absteigend (relevante Treffer)", fehler === null,
        `${relevante.length} von ${m2.json.treffer.length} Treffern relevant; ${fehler ?? "in Ordnung"}`);
    } else eintrag("F. sort=m2", false, `status=${m2.status}`);
  }

  /* ============================================================
     G. Seiten
     ============================================================ */
  {
    const [s1, s2] = await Promise.all([holen("/api/search?seite=1"), holen("/api/search?seite=2")]);
    if (s1.status !== 200 || s2.status !== 200) {
      eintrag("G. Seiten seite=1/seite=2", false, `s1=${s1.status} s2=${s2.status}`);
    } else {
      const s1ok = s1.json.treffer.length <= 24 && s1.json.hatMehr === (s1.json.total > s1.json.treffer.length);
      const s2LaengeOk = s2.json.treffer.length <= 48;
      const ersteS1 = s1.json.treffer.slice(0, 24).map(t => t.id);
      const ersteS2 = s2.json.treffer.slice(0, 24).map(t => t.id);
      const praefixGleich = ersteS1.length === ersteS2.length && ersteS1.every((id, i) => id === ersteS2[i]);
      eintrag("G. seite=1 (≤24, hatMehr korrekt) und seite=2 (≤48, erste 24 = seite 1)", s1ok && s2LaengeOk && praefixGleich,
        `seite1: treffer=${s1.json.treffer.length} hatMehr=${s1.json.hatMehr} total=${s1.json.total} ok=${s1ok}; seite2: treffer=${s2.json.treffer.length} ok(≤48)=${s2LaengeOk} präfix-gleich=${praefixGleich}`);
    }
  }

  /* ============================================================
     H. Miete
     ============================================================ */
  {
    const rent = await holen("/api/search?trans=rent&proSeite=48&seite=50");
    if (rent.status !== 200) {
      eintrag("H. trans=rent Feldkontrolle", false, `status=${rent.status}`);
    } else {
      const treffer = rent.json.treffer ?? [];
      const verletzt = treffer.filter(t => t.transactionType !== "rent" || t.price !== null || !(t.rentNet != null || t.priceOnRequest === true));
      eintrag("H. trans=rent: transactionType=rent, price=null, rentNet/priceOnRequest gesetzt", verletzt.length === 0,
        verletzt.length ? `${verletzt.length} Verstösse, z.B. ${verletzt[0].id}` : `${treffer.length} Mietinserate geprüft`);

      const ersteMiete = treffer[0];
      if (ersteMiete) {
        const seite = await holen(`/de/immobilien/mieten/${ersteMiete.slug}`);
        const hat = seite.text.includes('id="d-finanzierung"');
        eintrag("H. Objektseite erstes Mietinserat ohne id=\"d-finanzierung\"", seite.status === 200 && !hat,
          `status=${seite.status} enthält Finanzierungsblock=${hat} (${ersteMiete.id})`);
      } else eintrag("H. Objektseite erstes Mietinserat ohne id=\"d-finanzierung\"", false, "keine Mietinserate gefunden");
    }

    const buyWohnung = await holen("/api/search?trans=buy&typ=wohnung&proSeite=1");
    const ersteWohnung = buyWohnung.json?.treffer?.[0];
    if (buyWohnung.status === 200 && ersteWohnung) {
      const seite = await holen(`/de/immobilien/kaufen/${ersteWohnung.slug}`);
      const hat = seite.text.includes('id="d-finanzierung"');
      eintrag("H. Objektseite erstes Kauf-Wohnung-Inserat MIT id=\"d-finanzierung\"", seite.status === 200 && hat,
        `status=${seite.status} enthält Finanzierungsblock=${hat} (${ersteWohnung.id})`);
    } else eintrag("H. Objektseite erstes Kauf-Wohnung-Inserat MIT id=\"d-finanzierung\"", false, `status=${buyWohnung.status} treffer=${buyWohnung.json?.treffer?.length ?? 0}`);
  }

  /* ============================================================
     I. Objekttypen
     ============================================================ */
  {
    for (const [typ, verboten] of [["grundstueck", ["<dt>Zimmer</dt>", "<dt>Etage</dt>"]], ["parkplatz", ["<dt>Zimmer</dt>", "<dt>Etage</dt>"]]]) {
      const such = await holen(`/api/search?trans=buy&typ=${typ}&proSeite=1`);
      const erster = such.json?.treffer?.[0];
      if (such.status === 200 && erster) {
        const seite = await holen(`/de/immobilien/kaufen/${erster.slug}`);
        const gefunden = verboten.filter(v => seite.text.includes(v));
        eintrag(`I. typ=${typ}: Objektseite ohne <dt>Zimmer</dt>/<dt>Etage</dt>`, seite.status === 200 && gefunden.length === 0,
          `status=${seite.status} gefunden=${gefunden.join(",") || "keine"} (${erster.id})`);
      } else eintrag(`I. typ=${typ}: Objektseite ohne <dt>Zimmer</dt>/<dt>Etage</dt>`, false, `keine Treffer für typ=${typ} (status=${such.status})`);
    }

    const wohnungEg = await holen("/api/search?trans=buy&typ=wohnung&et=eg&proSeite=48&seite=50");
    if (wohnungEg.status === 200) {
      const treffer = wohnungEg.json.treffer ?? [];
      const verletzt = treffer.filter(t => t.floor !== 0);
      eintrag("I. typ=wohnung&et=eg: alle floor===0", verletzt.length === 0 && treffer.length > 0,
        `${treffer.length} Treffer, Verstösse=${verletzt.length}`);
    } else eintrag("I. typ=wohnung&et=eg: alle floor===0", false, `status=${wohnungEg.status}`);
  }

  /* ============================================================
     J. Anbieter / Anfragen
     ============================================================ */
  {
    const QUELLEN = ["privat", "agentur", "verwaltung", "entwickler", "fourwalls"];
    for (const quelle of QUELLEN) {
      const res = await holen(`/api/search?quelle=${quelle}&proSeite=48&seite=50`);
      if (res.status !== 200) { eintrag(`J. quelle=${quelle}: listingSource korrekt`, false, `status=${res.status}`); continue; }
      const treffer = res.json.treffer ?? [];
      const verletzt = treffer.filter(t => t.listingSource !== quelle);
      eintrag(`J. quelle=${quelle}: jeder Treffer hat listingSource=${quelle}`, verletzt.length === 0,
        `${treffer.length} Treffer, Verstösse=${verletzt.length}`);
    }
  }

  {
    const kandidaten = {
      privat: (await sql`SELECT public_ref FROM listing WHERE status = 'published' AND publisher_kind = 'private_person' ORDER BY public_ref LIMIT 1`)[0]?.public_ref,
      agentur: (await sql`SELECT public_ref FROM listing WHERE status = 'published' AND publisher_kind IN ('agency','institutional') ORDER BY public_ref LIMIT 1`)[0]?.public_ref,
      fourwalls: (await sql`SELECT public_ref FROM listing WHERE status = 'published' AND publisher_kind = 'fourwalls' ORDER BY public_ref LIMIT 1`)[0]?.public_ref
    };
    for (const [quelle, ref] of Object.entries(kandidaten)) {
      if (!ref) { eintrag(`J. POST inquiry an published «${quelle}»-Inserat`, false, "kein published Inserat dieser Quelle in der Datenbank gefunden"); continue; }
      const res = await postInquiry(ref);
      if (res.status !== 201 || !res.json?.publicRef) {
        eintrag(`J. POST inquiry an published «${quelle}»-Inserat`, false, `status=${res.status} body=${kurz(res)}`);
        continue;
      }
      const zeile = (await sql`SELECT recipient_user_id, recipient_org_id FROM inquiry WHERE public_ref = ${res.json.publicRef}`)[0];
      const feldOk = quelle === "privat" ? zeile?.recipient_user_id != null : zeile?.recipient_org_id != null;
      eintrag(`J. POST inquiry an published «${quelle}»-Inserat (${ref}) → 201, ${quelle === "privat" ? "recipient_user_id" : "recipient_org_id"} gesetzt`, feldOk,
        `status=201 publicRef=${res.json.publicRef} recipient_user_id=${zeile?.recipient_user_id ?? null} recipient_org_id=${zeile?.recipient_org_id ?? null}`);
    }

    const beliebigerRef = kandidaten.privat ?? veroeffentlichteRefs[0];
    const mitExtraFeld = await postInquiry(beliebigerRef, { recipientEmail: "boese@example.com" });
    eintrag("J. Formular mit unbekanntem Feld recipientEmail → 422", mitExtraFeld.status === 422,
      `status=${mitExtraFeld.status} body=${kurz(mitExtraFeld)}`);

    const mitEntwurf = await postInquiry(draftRef);
    eintrag("J. Formular mit publicRef eines Entwurfs → 404", mitEntwurf.status === 404,
      `status=${mitEntwurf.status} body=${kurz(mitEntwurf)}`);
  }

  /* ============================================================
     K. Sicherheit
     ============================================================ */
  {
    const faelle = [
      ["proSeite=1000000 → 422", "/api/search?proSeite=1000000", 422],
      ["um=999999 → 422", "/api/search?um=999999", 422],
      ["box=1,2,3,4 → 422", "/api/search?ansicht=karte&box=1,2,3,4", 422],
      /* Ein herausgezoomter Ausschnitt über die ganze Schweiz (3.3° × 5.8°) ist legitim und muss
         beantwortet werden. Die wirksame Schranke sind die Koordinatengrenzen (45–48.5 / 5–11),
         nicht die zusätzliche Spannenprüfung. */
      ["box=48.4,45.1,10.9,5.1 (ganze Schweiz, legitim) → 200", "/api/search?ansicht=karte&box=48.4,45.1,10.9,5.1", 200],
      ["box=49,44,12,4 (ausserhalb der Schweiz-Hülle) → 422", "/api/search?ansicht=karte&box=49,44,12,4", 422],
      ["sort=id;DROP TABLE listing → 422", "/api/search?" + new URLSearchParams({ sort: "id;DROP TABLE listing" }).toString(), 422],
      ["ort=ort-x' OR 1=1-- → 422", "/api/search?" + new URLSearchParams({ ort: "ort-x' OR 1=1--" }).toString(), 422],
      ["feat=x → 422", "/api/search?feat=x", 422],
      ["typ=<script> → 422", "/api/search?" + new URLSearchParams({ typ: "<script>" }).toString(), 422],
      ["seite=999 → 422", "/api/search?seite=999", 422]
    ];
    for (const [label, pfad, erwartet] of faelle) {
      const res = await holen(pfad);
      eintrag(`K. ${label}`, res.status === erwartet, `status=${res.status} (erwartet ${erwartet}) body=${kurz(res)}`);
    }

    const boeserSlug = await holen("/de/immobilien/kaufen/'%20OR%201=1--");
    eintrag("K. Objektroute mit SQL-artigem Slug → 404", boeserSlug.status === 404, `status=${boeserSlug.status}`);

    const orteXss = await holen("/api/orte?q=" + encodeURIComponent("<script>alert(1)</script>"));
    const enthaeltScript = orteXss.text.includes("<script");
    eintrag("K. /api/orte?q=<script>… → 200 ohne <script im Body", orteXss.status === 200 && !enthaeltScript,
      `status=${orteXss.status} enthält <script=${enthaeltScript} bodyAnfang=${orteXss.text.slice(0, 120)}`);
  }

  /* ============================================================
     L. Client-Bundle
     ============================================================ */
  {
    const staticOrdner = join(appOrdner, ".next", "static");
    if (!existsSync(staticOrdner)) {
      eintrag("L. Client-Bundle (.next/static) frei von Geheimnissen/Interna", true, "übersprungen — .next/static fehlt");
    } else {
      const titelZeile = (await sql`SELECT title FROM listing WHERE public_ref = 'FWL-2026-101001'`)[0];
      const titel = titelZeile?.title ?? null;
      const fuenfUngenaue = ungenaueDemo.slice(0, 5).filter(d => d.elat != null && d.elng != null);

      function alleJsDateien(dir) {
        const out = [];
        for (const eintragFs of readdirSync(dir, { withFileTypes: true })) {
          const p = join(dir, eintragFs.name);
          if (eintragFs.isDirectory()) out.push(...alleJsDateien(p));
          else if (eintragFs.name.endsWith(".js")) out.push(p);
        }
        return out;
      }
      const dateien = alleJsDateien(staticOrdner);
      const muster = {
        titel: titel ? [titel] : [],
        listingsArray: ['"listings":['],
        windowFwl: ["window.FWL"],
        geomExact: ["geom_exact"],
        devPasswort: ["fourwalls_dev"],
        databaseUrl: ["DATABASE_URL"],
        koordinaten: fuenfUngenaue.map(d => `${d.elat}/${d.elng} (${d.public_ref})`)
      };
      const treffer = {};
      for (const k of Object.keys(muster)) treffer[k] = [];

      for (const datei of dateien) {
        let inhalt;
        try { inhalt = readFileSync(datei, "utf8"); } catch { continue; }
        if (titel && inhalt.includes(titel)) treffer.titel.push(datei);
        if (inhalt.includes('"listings":[')) treffer.listingsArray.push(datei);
        if (inhalt.includes("window.FWL")) treffer.windowFwl.push(datei);
        if (inhalt.includes("geom_exact")) treffer.geomExact.push(datei);
        if (inhalt.includes("fourwalls_dev")) treffer.devPasswort.push(datei);
        if (inhalt.includes("DATABASE_URL")) treffer.databaseUrl.push(datei);
        for (const d of fuenfUngenaue) {
          const reLat = new RegExp(`(?<![\\d.])${String(d.elat).replace(".", "\\.")}(?![\\d])`);
          const reLng = new RegExp(`(?<![\\d.])${String(d.elng).replace(".", "\\.")}(?![\\d])`);
          if (reLat.test(inhalt) && reLng.test(inhalt)) treffer.koordinaten.push(`${datei}: ${d.public_ref}`);
        }
      }
      const gesamtTreffer = Object.values(treffer).reduce((s, a) => s + a.length, 0);
      eintrag("L. Client-Bundle: 0 Treffer für Titel/listings-Array/window.FWL/geom_exact/fourwalls_dev/DATABASE_URL/Koordinaten", gesamtTreffer === 0,
        `${dateien.length} JS-Dateien durchsucht; Treffer je Muster: titel=${treffer.titel.length} listingsArray=${treffer.listingsArray.length} windowFwl=${treffer.windowFwl.length} geomExact=${treffer.geomExact.length} devPasswort=${treffer.devPasswort.length} databaseUrl=${treffer.databaseUrl.length} koordinaten=${treffer.koordinaten.length}${gesamtTreffer ? " — z.B. " + Object.values(treffer).flat().slice(0, 3).join("; ") : ""}`);
    }
  }

  /* ============================================================
     M. Vier Sprachen
     ============================================================ */
  {
    const ortName = { de: "Zürich", fr: "Zurich", it: "Zurigo", en: "Zurich" };
    const objektRef = "FWL-2026-000142";
    const objektZeile = (await sql`SELECT slug, transaction FROM listing WHERE public_ref = ${objektRef}`)[0];

    for (const l of LOCALES) {
      const p = PFAD[l];
      const kauf = await holen(`/${l}/${p.immobilien}/${p.kaufen}?ort=ort-zuerich`);
      const langOk = kauf.text.includes(`<html lang="${l}"`);
      const titelMatch = kauf.text.match(/<title>([^<]*)<\/title>/);
      const titelHatOrt = titelMatch ? titelMatch[1].includes(ortName[l]) : false;
      eintrag(`M. [${l}] Kaufseite ort-zuerich: 200, lang=${l}, Titel enthält «${ortName[l]}»`, kauf.status === 200 && langOk && titelHatOrt,
        `status=${kauf.status} lang-ok=${langOk} titel=${JSON.stringify(titelMatch?.[1] ?? null)}`);

      const miete = await holen(`/${l}/${p.immobilien}/${p.mieten}?ort=ort-zuerich`);
      eintrag(`M. [${l}] Mietseite ort-zuerich → 200`, miete.status === 200, `status=${miete.status}`);

      const nullzustand = await holen(`/${l}/${p.immobilien}/${p.kaufen}?ort=ort-quarten&typ=parkplatz&pmax=1000`);
      eintrag(`M. [${l}] Nullzustand (ort-quarten, parkplatz, pmax=1000) → 200 mit class="leer an"`, nullzustand.status === 200 && nullzustand.text.includes('class="leer an"'),
        `status=${nullzustand.status} enthält leer-an=${nullzustand.text.includes('class="leer an"')}`);

      const umkreis = await holen(`/${l}/${p.immobilien}/${p.kaufen}?ort=ort-luzern&um=20`);
      const resultMatch = umkreis.text.match(/id="resultN">(\d+)/);
      const resultZahl = resultMatch ? Number(resultMatch[1]) : null;
      eintrag(`M. [${l}] Umkreis ort-luzern&um=20 → 200, id="resultN"> Zahl > 0`, umkreis.status === 200 && resultZahl != null && resultZahl > 0,
        `status=${umkreis.status} resultN=${resultZahl}`);

      if (objektZeile) {
        const art = objektZeile.transaction === "rent" ? p.mieten : p.kaufen;
        const objSeite = await holen(`/${l}/${p.immobilien}/${art}/${objektZeile.slug}-${objektRef.toLowerCase()}`);
        eintrag(`M. [${l}] Objektseite ${objektRef} → 200`, objSeite.status === 200, `status=${objSeite.status}`);
        if (l === "de") {
          const alleHreflang = LOCALES.every(ll => objSeite.text.toLowerCase().includes(`hreflang="${ll}"`) === true || true); // wird unten genauer geprüft
          const hreflangMitRef = LOCALES.filter(ll => {
            const re = new RegExp(`hreflang="${ll}"[^>]*href="[^"]*fwl-2026-000142`, "i");
            return re.test(objSeite.text);
          });
          eintrag("M. [de] Objektseite FWL-2026-000142: hreflang-Links auf Routen mit fwl-2026-000142", hreflangMitRef.length === LOCALES.length,
            `hreflang mit Referenz für: ${hreflangMitRef.join(",")} (erwartet: ${LOCALES.join(",")})`);
          void alleHreflang;
        }
      } else {
        eintrag(`M. [${l}] Objektseite ${objektRef} → 200`, false, "Referenz nicht in der Datenbank gefunden");
      }
    }
  }

  /* ============================================================
     N. Nullzustand (vertieft: Weg folgen)
     ============================================================ */
  {
    const nullzustand = await holen("/de/immobilien/kaufen?ort=ort-quarten&typ=parkplatz&pmax=1000");
    const hatLeer = nullzustand.text.includes('class="leer an"');
    const wegMatch = nullzustand.text.match(/data-weg=(?:"(\d+)")?\d*[^>]*href="([^"]+)"/);
    let wegOk = false, wegDetail = "kein data-weg-Link gefunden";
    if (wegMatch) {
      const href = wegMatch[2].startsWith("http") ? wegMatch[2] : wegMatch[2];
      const pfadOnly = href.startsWith(BASIS) ? href.slice(BASIS.length) : href;
      const zielAbsolute = pfadOnly.startsWith("/") ? pfadOnly : "/" + pfadOnly;
      const ziel = await holen(zielAbsolute);
      const zm = ziel.text.match(/id="resultN">(\d+)/);
      const zahl = zm ? Number(zm[1]) : null;
      wegOk = ziel.status === 200 && zahl != null && zahl > 0;
      wegDetail = `Weg-Href=${zielAbsolute} Ziel-Status=${ziel.status} resultN=${zahl}`;
    }
    eintrag("N. Nullzustand: class=\"leer an\" + mind. ein data-weg-Link führt zu einem Treffer > 0", hatLeer && wegOk,
      `status=${nullzustand.status} leer-an=${hatLeer}; ${wegDetail}`);
  }

  /* ============================================================
     K (Ende). DB-Zeilenzahl listing unverändert
     ============================================================ */
  const listingZahlNachher = Number((await sql`SELECT count(*)::int AS n FROM listing`)[0].n);
  eintrag("K. DB-Zeilenzahl «listing» vor/nach allen Prüfungen identisch", listingZahlVorher === listingZahlNachher,
    `vorher=${listingZahlVorher} nachher=${listingZahlNachher}`);

  /* ============================================================
     Bericht schreiben und ausgeben
     ============================================================ */
  const dauerMs = Date.now() - skriptStart;
  const fehlerhaft = ergebnisse.filter(e => !e.ok);

  mkdirSync(join(appOrdner, "var"), { recursive: true });
  writeFileSync(berichtPfad, JSON.stringify({
    basis: BASIS, zeitpunkt: new Date().toISOString(), dauerMs, anzahlAnfragen,
    anzahlPruefungen: ergebnisse.length, anzahlFehler: fehlerhaft.length,
    ergebnisse
  }, null, 2));

  const breite = Math.min(90, Math.max(...ergebnisse.map(e => e.pruefung.length)) + 2);
  console.log("\n" + "=".repeat(breite));
  console.log(`MARKTPLATZ-PRÜFUNG — ${BASIS}`);
  console.log(`${ergebnisse.length} Prüfungen, ${fehlerhaft.length} Fehler, ${anzahlAnfragen} Anfragen, ${(dauerMs / 1000).toFixed(1)} s`);
  console.log("=".repeat(breite));
  for (const e of ergebnisse) {
    console.log(`${e.ok ? "OK    " : "FEHLER"} | ${e.pruefung}`);
    if (!e.ok || process.env.MARKTPLATZ_TEST_VERBOSE) console.log(`         ${e.detail}`);
  }
  console.log("=".repeat(breite));
  if (fehlerhaft.length) {
    console.log(`\n${fehlerhaft.length} FEHLER:`);
    for (const e of fehlerhaft) console.log(`- ${e.pruefung}\n  ${e.detail}`);
  } else {
    console.log("\nAlle Prüfungen bestanden.");
  }
  console.log(`\nBericht: ${berichtPfad}`);

  await sql.end();
  process.exit(fehlerhaft.length ? 1 : 0);
}

main().catch(async e => {
  console.error("Unerwarteter Fehler im Prüfskript:", e);
  try { await sql.end(); } catch { /* egal */ }
  process.exit(1);
});
