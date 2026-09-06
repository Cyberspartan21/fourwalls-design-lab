/* Wörtlich aus final/ufer/karte.js (P3) — als ES-Modul verpackt, sonst unverändert.
   Änderungen gegenüber dem Prototyp: nur diese Kopfzeile und `export const`
   statt `window.UKARTE`. Kein Redesign, keine MapLibre-Migration, keine
   neuen Kachelquellen (P5.3 §28/§29). Typen: ukarte.d.ts. */
/* ============================================================
   UFER — Karte
   MapLibre GL über denselben Suchvertrag wie die Liste. Die Karte ist eine
   zweite Oberfläche auf dieselbe Anfrage, kein eigener Suchzustand.

   Kacheln: swisstopo Vektorkacheln (amtliche Schweizer Geodaten, offen und
   ohne Schlüssel). Rückfall: OpenFreeMap. Beide brauchen kein Geheimnis im
   Browser — es wird keines ausgeliefert.

   Der Abendmodus ist ein echt umgerechneter Stil, kein Helligkeitsfilter:
   die Farben jedes Layers werden in die UFER-Nachtpalette überführt.
   ============================================================ */
/* MapLibre GL (npm-Abhängigkeit, BSD-3-Clause, Version 5.6.0 wie zuvor über
   cdnjs) wird erst geladen, wenn die Karte gebraucht wird — dieses Modul
   selbst kommt bereits nur per dynamischem import() (karten-ansicht.tsx) in
   den Browser, das Stylesheet landet also im selben, getrennten Bündel. */
import "maplibre-gl/dist/maplibre-gl.css";
export const UKARTE = (function () {
  /* Quellenangaben stehen an der Karte, nicht im Impressum: swisstopo verlangt
     die Nennung der Quelle, OpenStreetMap die Nennung der Mitwirkenden. */
  const STILE = {
    swisstopo: { url:"https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json",
                 name:"swisstopo lightbasemap",
                 attribution:'© <a href="https://www.swisstopo.admin.ch/" target="_blank" rel="noopener">swisstopo</a>' },
    offen:     { url:"https://tiles.openfreemap.org/styles/positron",
                 name:"OpenFreeMap positron",
                 attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende · <a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a>' }
  };

  let karte = null, geladen = false, ladeVersprechen = null;
  let punkte = [], gewaehlt = null, ueberflogen = null;
  let aufHandler = {}, bewegt = false, autoSuche = false, stilName = "swisstopo";
  let letzteBounds = null, anzeigeModus = null, letzterUmkreis = null;
  /* Jeder Stilwechsel wirft alle eigenen Quellen und Schichten weg. Schwebende
     Prüfungen aus der Zeit davor dürfen danach nichts mehr anfassen. */
  let generation = 0;

  /* ---------- MapLibre erst laden, wenn die Karte gebraucht wird ---------- */
  function laden() {
    if (ladeVersprechen) return ladeVersprechen;
    ladeVersprechen = import("maplibre-gl")
      .then((mod) => { geladen = true; return mod.default || mod; })
      .catch(() => { throw new Error("MapLibre konnte nicht geladen werden"); });
    return ladeVersprechen;
  }

  /* ---------- Farbumrechnung für den Abendstil ---------- */
  function zuRgb(c) {
    if (typeof c !== "string") return null;
    if (c.startsWith("#")) {
      const h = c.slice(1);
      const v = h.length === 3 ? h.split("").map(x => parseInt(x + x, 16)) : [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16));
      return v.length === 3 && v.every(x => !isNaN(x)) ? { r:v[0], g:v[1], b:v[2], a:1 } : null;
    }
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map(x => parseFloat(x));
    return { r:p[0], g:p[1], b:p[2], a:p[3] == null ? 1 : p[3] };
  }
  /* Helligkeit umkehren und ins Nachtblau ziehen — Kontraste bleiben erhalten */
  function nachts(c) {
    const p = zuRgb(c); if (!p) return c;
    const l = (0.299 * p.r + 0.587 * p.g + 0.114 * p.b) / 255;
    const n = 0.055 + (1 - l) * 0.30;                       // hell wird dunkel, dunkel wird lesbar
    const r = Math.round(255 * n * 0.62), g = Math.round(255 * n * 0.74), b = Math.round(255 * n * 0.95);
    return `rgba(${r},${g},${b},${p.a})`;
  }
  function textNachts(c) {
    const p = zuRgb(c); if (!p) return c;
    const l = (0.299 * p.r + 0.587 * p.g + 0.114 * p.b) / 255;
    const h = Math.round(150 + (1 - l) * 95);
    return `rgba(${h},${Math.round(h * 1.03)},${Math.round(h * 1.08)},${p.a})`;
  }
  function stilFuerAbend(stil) {
    const s = JSON.parse(JSON.stringify(stil));
    for (const l of s.layers || []) {
      const p = l.paint || {};
      if (l.type === "background" && p["background-color"]) p["background-color"] = "#0B121B";
      if (p["fill-color"]) p["fill-color"] = wandle(p["fill-color"], nachts);
      if (p["fill-outline-color"]) p["fill-outline-color"] = wandle(p["fill-outline-color"], nachts);
      if (p["line-color"]) p["line-color"] = wandle(p["line-color"], nachts);
      if (p["fill-extrusion-color"]) p["fill-extrusion-color"] = wandle(p["fill-extrusion-color"], nachts);
      if (p["text-color"]) p["text-color"] = wandle(p["text-color"], textNachts);
      if (p["text-halo-color"]) p["text-halo-color"] = "rgba(11,18,27,.9)";
      if (p["icon-color"]) p["icon-color"] = wandle(p["icon-color"], textNachts);
      l.paint = p;
    }
    return s;
  }
  /* Farben können Ausdrücke sein — nur die Farbliterale darin umrechnen */
  function wandle(wert, fn) {
    if (typeof wert === "string") return fn(wert);
    if (Array.isArray(wert)) return wert.map(x => typeof x === "string" && (x.startsWith("#") || x.startsWith("rgb")) ? fn(x) : (Array.isArray(x) ? wandle(x, fn) : x));
    if (wert && typeof wert === "object" && wert.stops) return Object.assign({}, wert, { stops:wert.stops.map(([z, c]) => [z, typeof c === "string" ? fn(c) : c]) });
    return wert;
  }

  /* Beschriftungen brauchen genau den Schriftstapel, den der Kachelserver
     ausliefert. Ein erfundener oder kombinierter Stapel gibt 404 — und eine
     fehlende Glyphe lässt MapLibre die ganze Kachel verwerfen, samt Punkten.
     Darum wird die Schrift aus dem geladenen Basisstil übernommen. */
  let schrift = ["Noto Sans Regular"];
  function schriftAusStil(stil) {
    for (const l of (stil && stil.layers) || []) {
      const f = l.layout && l.layout["text-font"];
      if (Array.isArray(f) && f.length && f.every(x => typeof x === "string")) return f.slice();
    }
    return null;
  }

  /* ---------- Preisbeschriftung ---------- */
  function kurzPreis(p) {
    const w = p.transactionType === "rent" ? p.rentNet : p.price;
    if (p.priceOnRequest || w == null) return "a. A.";
    if (p.transactionType === "rent") return Math.round(w / 10) * 10 + ".–";
    if (w >= 1e6) return (w / 1e6).toFixed(w >= 1e7 ? 0 : 2).replace(/\.?0+$/, "") + " Mio.";
    return Math.round(w / 1000) + "k";
  }

  function alsGeoJSON(liste) {
    return { type:"FeatureCollection", features:liste.filter(p => p.lat && p.lng).map(p => ({
      /* Die Feature-ID muss eine Zahl sein — ein String lässt die GeoJSON-Quelle
         still scheitern (keine Kacheln, keine Cluster, kein Fehlerereignis). */
      type:"Feature", id:Number(String(p.id).replace(/\D/g, "")) || undefined,
      geometry:{ type:"Point", coordinates:[p.lng, p.lat] },
      properties:{ slug:p.slug, id:p.id, preis:kurzPreis(p), exklusiv:p.listingTier === "exclusive" ? 1 : 0,
        belegt:["reserviert","verkauft","vermietet"].includes((p.availability || {}).art) ? 1 : 0 }
    })) };
  }

  const stilQuelle = () => STILE[stilName];

  /* Bedingung, die addSource/addLayer tatsächlich prüfen */
  function stilBereit() {
    if (!karte) return false;
    try { return karte.isStyleLoaded() || !!(karte.style && karte.style._loaded); }
    catch (_) { return false; }
  }

  /* ---------- Aufbau ---------- */
  async function starte(behaelterId, handler) {
    aufHandler = handler || {};
    heilungen = 0; handlerGesetzt = false; generation++;
    const gl = await laden();
    const dunkel = document.body.dataset.mode === "dunkel";
    let stil;
    try {
      const r = await fetch(stilQuelle().url);
      if (!r.ok) throw new Error("Stil " + r.status);
      stil = await r.json();
    } catch (e) {
      stilName = "offen";
      const r = await fetch(stilQuelle().url);
      stil = await r.json();
    }
    schrift = schriftAusStil(stil) || schrift;
    if (dunkel) stil = stilFuerAbend(stil);

    karte = new gl.Map({
      container:behaelterId, style:stil,
      center:[8.23, 46.80], zoom:6.6, minZoom:5.5, maxZoom:17,
      attributionControl:false, dragRotate:false, pitchWithRotate:false, touchZoomRotate:true
    });
    karte.touchZoomRotate.disableRotation();
    karte.addControl(new gl.AttributionControl({ compact:true, customAttribution:stilQuelle().attribution }), "bottom-right");
    karte.addControl(new gl.NavigationControl({ showCompass:false, visualizePitch:false }), "top-right");

    /* Warten, bis der Stil geparst ist — nicht, bis jede Kachel da ist.
       isStyleLoaded() verlangt zusätzlich alle Quellen-Caches und wird nie
       wahr, solange der Behälter noch keine Grösse hat. Für addSource genügt
       der geparste Stil, und genau darauf feuert "style.load". */
    await new Promise(ok => {
      if (stilBereit()) return ok();
      let fertig = false;
      const los = () => { if (!fertig) { fertig = true; ok(); } };
      karte.once("style.load", los);
      karte.once("load", los);
      karte.on("styledata", () => { if (stilBereit()) los(); });
      setTimeout(los, 8000);
    });
    karte.resize();                       // der Behälter wird erst mit der Sektion sichtbar
    if (!stilBereit()) throw new Error("Kartenstil wurde nicht geladen");
    /* Zusätzlich abwarten, bis die Karte ihren ersten vollständigen Durchgang
       hinter sich hat — vorher angelegte Quellen bekommen keine Kacheln. */
    await new Promise(ok => {
      if (karte.loaded()) return ok();
      let fertig = false; const los = () => { if (!fertig) { fertig = true; ok(); } };
      karte.once("load", los); karte.once("idle", los); setTimeout(los, 5000);
    });
    /* Die Objektschichten entstehen beim ersten zeige() — mit Daten.
       Eine leer angelegte GeoJSON-Quelle nimmt später kein setData mehr an. */
    /* Eigene Bewegungen (fitBounds nach einer Suche) dürfen nicht als
       Nutzerbewegung gelten — sonst bietet die Karte sofort an, im eigenen
       Ausschnitt zu suchen. Die Marke fällt mit dem moveend, das sie erzeugt. */
    karte.on("moveend", () => {
      if (karte.__stilleBewegung) { karte.__stilleBewegung = false; bewegt = false; return; }
      bewegt = true; if (aufHandler.bewegt) aufHandler.bewegt(bounds());
    });
    return karte;
  }

  /* Wird erst gerufen, wenn es Punkte gibt: eine GeoJSON-Quelle, die leer zur
     Welt kommt, bleibt dauerhaft leer — spätere setData-Aufrufe erreichen den
     Worker nicht mehr. Darum entsteht die Quelle zusammen mit ihren Daten. */
  function schichtenAnlegen(fc) {
    if (!karte || karte.getSource("objekte")) return;
    const daten = fc || alsGeoJSON(punkte);
    karte.addSource("objekte", { type:"geojson", data:daten, cluster:true, clusterRadius:52, clusterMaxZoom:13 });

    const licht = getComputedStyle(document.body).getPropertyValue("--licht").trim() || "#A8702F";
    const grund = getComputedStyle(document.body).getPropertyValue("--gr").trim() || "#F5F8F9";
    const tinte = getComputedStyle(document.body).getPropertyValue("--ink").trim() || "#0F1B2A";

    /* Cluster: Fläche, Ring, Zahl */
    karte.addLayer({ id:"cluster", type:"circle", source:"objekte", filter:["has", "point_count"],
      paint:{ "circle-color":grund, "circle-opacity":0.94,
        "circle-radius":["interpolate", ["linear"], ["get", "point_count"], 2, 17, 25, 25, 120, 34],
        "circle-stroke-width":1.4, "circle-stroke-color":licht } });
    karte.addLayer({ id:"cluster-zahl", type:"symbol", source:"objekte", filter:["has", "point_count"],
      layout:{ "text-field":["get", "point_count_abbreviated"], "text-size":12, "text-font":schrift },
      paint:{ "text-color":tinte } });

    /* Einzelobjekte: Preisschild */
    karte.addLayer({ id:"pin", type:"symbol", source:"objekte", filter:["!", ["has", "point_count"]],
      layout:{ "text-field":["get", "preis"], "text-size":11.5, "text-allow-overlap":false, "text-padding":3,
        "text-font":schrift, "text-anchor":"bottom", "text-offset":[0, -0.35] },
      paint:{ "text-color":["case", ["==", ["get", "belegt"], 1], "#8A98A7", tinte],
        "text-halo-color":grund, "text-halo-width":2.2, "text-opacity":["case", ["==", ["get", "belegt"], 1], 0.75, 1] } });
    karte.addLayer({ id:"punkt", type:"circle", source:"objekte", filter:["!", ["has", "point_count"]],
      paint:{ "circle-radius":["case", ["==", ["get", "exklusiv"], 1], 5.5, 4],
        "circle-color":["case", ["==", ["get", "exklusiv"], 1], licht, grund],
        "circle-stroke-width":1.6, "circle-stroke-color":["case", ["==", ["get", "belegt"], 1], "#8A98A7", licht] } });
    /* Auswahl */
    karte.addLayer({ id:"punkt-aktiv", type:"circle", source:"objekte",
      filter:["all", ["!", ["has", "point_count"]], ["==", ["get", "slug"], "___"]],
      paint:{ "circle-radius":9, "circle-color":licht, "circle-stroke-width":3, "circle-stroke-color":grund } });

    handlerAnmelden();
    pruefeQuelle();
  }

  /* Die Ereignisse hängen an den Layer-Namen und dürfen nur einmal gesetzt werden,
     auch wenn die Schichten neu aufgebaut werden. */
  let handlerGesetzt = false;
  function handlerAnmelden() {
    if (handlerGesetzt) return;
    handlerGesetzt = true;
    karte.on("click", "cluster", e => {
      const f = karte.queryRenderedFeatures(e.point, { layers:["cluster"] })[0];
      karte.getSource("objekte").getClusterExpansionZoom(f.properties.cluster_id).then(z => {
        karte.__stilleBewegung = true;
        karte.easeTo({ center:f.geometry.coordinates, zoom:Math.min(z + 0.4, 16), duration:kurz() ? 0 : 600 });
        setTimeout(() => { karte.__stilleBewegung = false; bewegt = true; if (aufHandler.bewegt) aufHandler.bewegt(bounds()); }, kurz() ? 30 : 650);
      });
    });
    for (const l of ["punkt", "pin"]) {
      karte.on("click", l, e => { const p = e.features[0].properties; waehle(p.slug, true); if (aufHandler.gewaehlt) aufHandler.gewaehlt(p.slug); });
      karte.on("mouseenter", l, () => karte.getCanvas().style.cursor = "pointer");
      karte.on("mouseleave", l, () => karte.getCanvas().style.cursor = "");
    }
    karte.on("mouseenter", "cluster", () => karte.getCanvas().style.cursor = "pointer");
    karte.on("mouseleave", "cluster", () => karte.getCanvas().style.cursor = "");
  }

  /* Daten in die Objektquelle bringen.
     Zwei Eigenheiten von MapLibre sind hier zu beachten: eine GeoJSON-Quelle,
     die ohne Inhalt angelegt wird, bleibt leer, und ein setData, das eintrifft,
     bevor die Quelle fertig geladen ist, lässt sie stumm zurück. Darum entsteht
     die Quelle mit ihren Daten, und Aktualisierungen warten, bis sie bereit ist. */
  let ausstehend = null, horcht = false;
  function datenSetzen(fc) {
    if (!karte) return;
    const q = karte.getSource("objekte");
    if (!q) { if (fc.features.length) schichtenAnlegen(fc); return; }
    if (karte.isSourceLoaded("objekte")) { q.setData(fc); return; }
    ausstehend = fc;
    if (horcht) return;
    horcht = true;
    const meine = generation;
    const horch = () => {
      if (meine !== generation) { karte.off("sourcedata", horch); horcht = false; return; }
      const quelle = karte.getSource("objekte");
      if (!quelle) { karte.off("sourcedata", horch); horcht = false; return; }
      if (!karte.isSourceLoaded("objekte")) return;
      karte.off("sourcedata", horch); horcht = false;
      const offen = ausstehend; ausstehend = null;
      if (offen) datenSetzen(offen);
    };
    karte.on("sourcedata", horch);
  }

  /* MapLibre lässt die erste GeoJSON-Quelle einer Karte gelegentlich stumm: sie
     meldet sich als geladen, liefert aber keine Kacheln. Statt darauf zu hoffen,
     wird der Zustand geprüft — und nur dann geheilt, wenn wirklich Punkte im
     sichtbaren Ausschnitt liegen und trotzdem nichts gezeichnet wird. */
  const OBJEKTLAGEN = ["cluster", "cluster-zahl", "pin", "punkt", "punkt-aktiv"];
  let heilungen = 0;
  function pruefeQuelle() {
    let versuche = 0;
    const meine = generation;
    const pruef = () => {
      if (meine !== generation) return;
      if (!karte || !karte.getSource("objekte")) return;
      if (!karte.isSourceLoaded("objekte")) { if (++versuche < 15) setTimeout(pruef, 300); return; }
      const b = bounds();
      const sichtbar = b && punkte.some(p => p.lat <= b.n && p.lat >= b.s && p.lng <= b.o && p.lng >= b.w);
      if (!sichtbar) return;                                  // nichts zu zeigen: kein Defekt
      const gezeichnet = OBJEKTLAGEN.some(l => { try { return karte.queryRenderedFeatures({ layers:[l] }).length > 0; } catch (e) { return false; } });
      if (gezeichnet) return;                                 // alles in Ordnung
      if (heilungen >= 2) return;                             // niemals endlos
      heilungen++;
      neuAufbauen();
    };
    setTimeout(pruef, 500);
  }
  function neuAufbauen() {
    const fc = alsGeoJSON(punkte);
    for (const l of OBJEKTLAGEN) if (karte.getLayer(l)) karte.removeLayer(l);
    if (karte.getSource("objekte")) karte.removeSource("objekte");
    schichtenAnlegen(fc);
    waehle(gewaehlt);
  }

  const kurz = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* Falls eine eigene Bewegung gar keine ist (Ziel gleich Standort), fällt die
     Marke nach dieser Frist von selbst — sonst bliebe die Karte taub. */
  function netz(ms) { setTimeout(() => { if (karte && karte.__stilleBewegung) { karte.__stilleBewegung = false; bewegt = false; } }, ms); }
  function bounds() {
    if (!karte) return null;
    const b = karte.getBounds();
    return { n:b.getNorth(), s:b.getSouth(), o:b.getEast(), w:b.getWest() };
  }

  /* ---------- Die Antwort des Suchvertrags anzeigen ---------- */
  function zeige(antwort, opt) {
    opt = opt || {};
    punkte = antwort.treffer || [];
    if (!karte) return;
    datenSetzen(alsGeoJSON(punkte));
    zeichneUmkreis(antwort.geo);
    anzeigeModus = antwort.geo && antwort.geo.interpretation;
    if (!opt.behalteAusschnitt && antwort.geo && antwort.geo.bounds && antwort.geo.interpretation !== "ausschnitt") {
      const b = antwort.geo.bounds;
      karte.__stilleBewegung = true;
      karte.fitBounds([[b[3], b[1]], [b[2], b[0]]], { padding:{ top:60, bottom:60, left:60, right:60 }, maxZoom:14, duration:kurz() ? 0 : 700 });
      netz(kurz() ? 300 : 1500);
    }
  }
  function zeichneUmkreis(geo) {
    letzterUmkreis = geo || null;
    const vorhanden = karte.getSource("umkreis");
    const kreis = geo && geo.interpretation === "umkreis" && geo.mittelpunkt;
    if (!kreis) { if (vorhanden) vorhanden.setData({ type:"FeatureCollection", features:[] }); return; }
    const { lat, lng } = geo.mittelpunkt, r = geo.umkreisKm, ring = [];
    for (let i = 0; i <= 72; i++) {
      const a = i / 72 * 2 * Math.PI;
      ring.push([lng + (r / (111 * Math.cos(lat * Math.PI / 180))) * Math.cos(a), lat + (r / 111) * Math.sin(a)]);
    }
    const fc = { type:"FeatureCollection", features:[{ type:"Feature", geometry:{ type:"Polygon", coordinates:[ring] }, properties:{} }] };
    if (vorhanden) { vorhanden.setData(fc); return; }
    /* Auch hier: erst mit Inhalt zur Welt bringen, dann unter die Punkte legen */
    karte.addSource("umkreis", { type:"geojson", data:fc });
    const licht = getComputedStyle(document.body).getPropertyValue("--licht").trim() || "#A8702F";
    const unter = karte.getLayer("cluster") ? "cluster" : undefined;
    karte.addLayer({ id:"umkreis-flaeche", type:"fill", source:"umkreis",
      paint:{ "fill-color":licht, "fill-opacity":0.07 } }, unter);
    karte.addLayer({ id:"umkreis-linie", type:"line", source:"umkreis",
      paint:{ "line-color":licht, "line-width":1.2, "line-opacity":0.5, "line-dasharray":[3, 3] } }, unter);
  }

  function waehle(slug, vonKarte) {
    gewaehlt = slug || null;
    if (!karte || !karte.getLayer("punkt-aktiv")) return;
    karte.setFilter("punkt-aktiv", ["all", ["!", ["has", "point_count"]], ["==", ["get", "slug"], gewaehlt || "___"]]);
    if (slug && !vonKarte) {
      const p = punkte.find(x => x.slug === slug);
      if (p && !istSichtbar(p)) { karte.__stilleBewegung = true;
        karte.easeTo({ center:[p.lng, p.lat], duration:kurz() ? 0 : 500 });
        netz(kurz() ? 300 : 1200); }
    }
  }
  function istSichtbar(p) { const b = bounds(); return b && p.lat <= b.n && p.lat >= b.s && p.lng <= b.o && p.lng >= b.w; }
  function ueberfliege(slug) { ueberflogen = slug; }

  function setzeModus(dunkel) {
    if (!karte) return;
    fetch(stilQuelle().url).then(r => r.json()).then(s => {
      if (!karte) return;
      schrift = schriftAusStil(s) || schrift;
      generation++; ausstehend = null; horcht = false; heilungen = 0;
      karte.setStyle(dunkel ? stilFuerAbend(s) : s);
      const wieder = () => { try {
        if (!karte || !stilBereit()) return;
        const fc = alsGeoJSON(punkte);
        if (fc.features.length) schichtenAnlegen(fc);
        zeichneUmkreis(letzterUmkreis);
        waehle(gewaehlt);
      } catch (e) {} };
      karte.once("style.load", wieder);
      setTimeout(wieder, 3000);
    }).catch(() => {});
  }

  function passeAn(b) {
    if (!karte || !b) return;
    karte.__stilleBewegung = true;
    karte.fitBounds([[b[3], b[1]], [b[2], b[0]]], { padding:50, maxZoom:14, duration:kurz() ? 0 : 600 });
    netz(kurz() ? 300 : 1400);
  }

  /* ---------- Detailkarte einer Immobilie ----------
     Dieselbe Grundlage wie die Suchkarte: dieselben Kacheln, dieselbe
     Abendumrechnung, dieselbe Schriftermittlung. Gezeigt wird nur, was der
     Datensatz öffentlich erlaubt — bei ungenauer Freigabe ein Feld, kein Punkt.
     Eine erfundene Hausnummer auf einer echten Karte wäre eine Behauptung
     über ein reales Gebäude; das unterbleibt. */
  async function detail(behaelterId, opt) {
    opt = opt || {};
    const gl = await laden();
    const dunkel = document.body.dataset.mode === "dunkel";
    let stil;
    try {
      const r = await fetch(stilQuelle().url);
      if (!r.ok) throw new Error("Stil " + r.status);
      stil = await r.json();
    } catch (e) { stilName = "offen"; stil = await (await fetch(stilQuelle().url)).json(); }
    schrift = schriftAusStil(stil) || schrift;
    if (dunkel) stil = stilFuerAbend(stil);

    const genau = opt.genauigkeitM || 0;
    const k = new gl.Map({ container:behaelterId, style:stil, center:[opt.lng, opt.lat],
      zoom:opt.zoom || (genau > 1200 ? 12.2 : genau > 400 ? 13.6 : 15.2),
      minZoom:8, maxZoom:17, attributionControl:false, dragRotate:false, pitchWithRotate:false });
    k.touchZoomRotate.disableRotation();
    /* Eine eingebettete Karte darf das Scrollen der Seite nicht abfangen:
       gezoomt wird über die Knöpfe, den Doppelklick oder zwei Finger. */
    k.scrollZoom.disable();
    k.addControl(new gl.AttributionControl({ compact:true, customAttribution:stilQuelle().attribution }), "bottom-right");
    k.addControl(new gl.NavigationControl({ showCompass:false, visualizePitch:false }), "top-right");
    await new Promise(ok => {
      let fertig = false; const los = () => { if (!fertig) { fertig = true; ok(); } };
      k.once("style.load", los); k.once("load", los); setTimeout(los, 8000);
    });
    k.resize();
    await new Promise(ok => { if (k.loaded()) return ok();
      let f = false; const l = () => { if (!f) { f = true; ok(); } };
      k.once("load", l); k.once("idle", l); setTimeout(l, 4000); });

    const licht = getComputedStyle(document.body).getPropertyValue("--licht").trim() || "#A8702F";
    const grund = getComputedStyle(document.body).getPropertyValue("--gr").trim() || "#F5F8F9";
    const kreis = (r) => { const ring = [];
      for (let i = 0; i <= 96; i++) { const a = i / 96 * 2 * Math.PI;
        ring.push([opt.lng + (r / (111 * Math.cos(opt.lat * Math.PI / 180))) * Math.cos(a), opt.lat + (r / 111) * Math.sin(a)]); }
      return { type:"Feature", geometry:{ type:"Polygon", coordinates:[ring] }, properties:{} }; };

    if (genau > 0) {
      k.addSource("lage", { type:"geojson", data:{ type:"FeatureCollection", features:[kreis(genau / 1000)] } });
      k.addLayer({ id:"lage-flaeche", type:"fill", source:"lage", paint:{ "fill-color":licht, "fill-opacity":0.10 } });
      k.addLayer({ id:"lage-linie", type:"line", source:"lage",
        paint:{ "line-color":licht, "line-width":1.4, "line-opacity":0.65, "line-dasharray":[3, 3] } });
    } else {
      /* Freigegebene genaue Lage: Punkt statt Feld */
      k.addSource("lage", { type:"geojson", data:{ type:"FeatureCollection",
        features:[{ type:"Feature", geometry:{ type:"Point", coordinates:[opt.lng, opt.lat] }, properties:{} }] } });
      k.addLayer({ id:"lage-punkt", type:"circle", source:"lage",
        paint:{ "circle-radius":8, "circle-color":licht, "circle-stroke-width":3, "circle-stroke-color":grund } });
    }
    /* Entfernungsringe nur, wo sie etwas aussagen */
    if (genau <= 600) {
      k.addSource("ringe", { type:"geojson", data:{ type:"FeatureCollection", features:[kreis(0.5), kreis(1), kreis(3)] } });
      k.addLayer({ id:"ringe-linie", type:"line", source:"ringe",
        paint:{ "line-color":licht, "line-width":1, "line-opacity":0.28, "line-dasharray":[2, 6] } }, genau > 0 ? "lage-flaeche" : "lage-punkt");
    }
    return k;
  }

  /* Bibliothek und Stil im Voraus holen, ohne etwas zu zeichnen. */
  let vorgewaermt = false;
  function vorwaermen() {
    if (vorgewaermt) return; vorgewaermt = true;
    laden().catch(() => {});
    fetch(stilQuelle().url).catch(() => {});
  }

  return {
    starte, zeige, waehle, ueberfliege, setzeModus, bounds, passeAn, detail, vorwaermen,
    offen: () => !!karte,
    istBewegt: () => bewegt,
    setzeBewegt: v => bewegt = v,
    stil: () => stilQuelle(),
    karte: () => karte,
    groesseNeu: () => { if (karte) karte.resize(); },
    zerstoere: () => { if (karte) { karte.remove(); karte = null; punkte = []; ausstehend = null; horcht = false; handlerGesetzt = false; } }
  };
})();
