/* Detailkarte — Port von UKARTE.detail() aus dem P3-Prototyp.

   MapLibre wird erst geladen, wenn die Karte gebraucht wird (nicht Teil des
   kritischen Pfads); Kacheln von swisstopo, Rückfall OpenFreeMap; kein
   Schlüssel im Browser. Der Abendmodus ist ein umgerechneter Stil. Gezeigt
   wird ausschliesslich, was hereingegeben wird: die öffentliche Lage. */

const CDN_JS  = "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/5.6.0/maplibre-gl.js";
const CDN_CSS = "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/5.6.0/maplibre-gl.css";
const STILE = {
  swisstopo: "https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json",
  offen: "https://tiles.openfreemap.org/styles/positron"
};

/* Minimaler Typausschnitt — die Bibliothek kommt zur Laufzeit von der CDN. */
interface GlMap {
  addSource(id: string, s: unknown): void; addLayer(l: unknown, before?: string): void; addControl(c: unknown, pos?: string): void;
  once(ev: string, cb: () => void): void; loaded(): boolean; resize(): void; remove(): void;
  touchZoomRotate: { disableRotation(): void }; scrollZoom: { disable(): void };
}
interface Gl { Map: new (o: unknown) => GlMap; AttributionControl: new (o: unknown) => unknown; NavigationControl: new (o: unknown) => unknown }
declare global { interface Window { maplibregl?: Gl } }

let ladeVersprechen: Promise<Gl> | null = null;
function laden(): Promise<Gl> {
  if (ladeVersprechen) return ladeVersprechen;
  ladeVersprechen = new Promise((ok, nein) => {
    if (window.maplibregl) return ok(window.maplibregl);
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = CDN_CSS; document.head.appendChild(css);
    const js = document.createElement("script"); js.src = CDN_JS; js.async = true;
    js.onload = () => window.maplibregl ? ok(window.maplibregl) : nein(new Error("MapLibre fehlt"));
    js.onerror = () => nein(new Error("MapLibre konnte nicht geladen werden"));
    document.head.appendChild(js);
  });
  return ladeVersprechen;
}

type Rgb = { r: number; g: number; b: number; a: number };
function zuRgb(c: string): Rgb | null {
  if (c.startsWith("#")) {
    const h = c.slice(1);
    const v = h.length === 3 ? h.split("").map(x => parseInt(x + x, 16)) : [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16));
    return v.length === 3 && v.every(x => !isNaN(x)) ? { r: v[0]!, g: v[1]!, b: v[2]!, a: 1 } : null;
  }
  const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null;
  const p = m[1]!.split(",").map(x => parseFloat(x));
  return { r: p[0]!, g: p[1]!, b: p[2]!, a: p[3] == null ? 1 : p[3] };
}
function nachts(c: string) {
  const p = zuRgb(c); if (!p) return c;
  const l = (0.299 * p.r + 0.587 * p.g + 0.114 * p.b) / 255, n = 0.055 + (1 - l) * 0.30;
  return `rgba(${Math.round(255 * n * 0.62)},${Math.round(255 * n * 0.74)},${Math.round(255 * n * 0.95)},${p.a})`;
}
function textNachts(c: string) {
  const p = zuRgb(c); if (!p) return c;
  const l = (0.299 * p.r + 0.587 * p.g + 0.114 * p.b) / 255, h = Math.round(150 + (1 - l) * 95);
  return `rgba(${h},${Math.round(h * 1.03)},${Math.round(h * 1.08)},${p.a})`;
}
function wandle(wert: unknown, fn: (s: string) => string): unknown {
  if (typeof wert === "string") return fn(wert);
  if (Array.isArray(wert)) return wert.map(x => typeof x === "string" && (x.startsWith("#") || x.startsWith("rgb")) ? fn(x) : (Array.isArray(x) ? wandle(x, fn) : x));
  if (wert && typeof wert === "object" && "stops" in wert) { const w = wert as { stops: [unknown, unknown][] }; return { ...w, stops: w.stops.map(([z, c]) => [z, typeof c === "string" ? fn(c) : c]) }; }
  return wert;
}
type Stil = { layers?: { type?: string; paint?: Record<string, unknown> }[] };
function stilFuerAbend(stil: Stil): Stil {
  const s = JSON.parse(JSON.stringify(stil)) as Stil;
  for (const l of s.layers ?? []) {
    const p = l.paint ?? {};
    if (l.type === "background" && p["background-color"]) p["background-color"] = "#0B121B";
    for (const k of ["fill-color", "fill-outline-color", "line-color", "fill-extrusion-color"]) if (p[k]) p[k] = wandle(p[k], nachts);
    if (p["text-color"]) p["text-color"] = wandle(p["text-color"], textNachts);
    if (p["text-halo-color"]) p["text-halo-color"] = "rgba(11,18,27,.9)";
    if (p["icon-color"]) p["icon-color"] = wandle(p["icon-color"], textNachts);
    l.paint = p;
  }
  return s;
}

export async function detailKarte(behaelter: HTMLElement, opt: { lat: number; lng: number; genauigkeitM: number; dunkel: boolean }): Promise<GlMap> {
  const gl = await laden();
  let stil: Stil;
  try { const r = await fetch(STILE.swisstopo); if (!r.ok) throw new Error(String(r.status)); stil = await r.json(); }
  catch { stil = await (await fetch(STILE.offen)).json(); }
  if (opt.dunkel) stil = stilFuerAbend(stil);

  const genau = opt.genauigkeitM;
  const k = new gl.Map({ container: behaelter, style: stil, center: [opt.lng, opt.lat],
    zoom: genau > 1200 ? 12.2 : genau > 400 ? 13.6 : 15.2, minZoom: 8, maxZoom: 17,
    attributionControl: false, dragRotate: false, pitchWithRotate: false });
  k.touchZoomRotate.disableRotation();
  k.scrollZoom.disable();
  k.addControl(new gl.AttributionControl({ compact: true }), "bottom-right");
  k.addControl(new gl.NavigationControl({ showCompass: false, visualizePitch: false }), "top-right");
  await new Promise<void>(ok => { let f = false; const los = () => { if (!f) { f = true; ok(); } }; k.once("style.load", los); k.once("load", los); setTimeout(los, 8000); });
  k.resize();
  await new Promise<void>(ok => { if (k.loaded()) return ok(); let f = false; const los = () => { if (!f) { f = true; ok(); } }; k.once("load", los); k.once("idle", los); setTimeout(los, 4000); });

  const cs = getComputedStyle(document.body);
  const licht = cs.getPropertyValue("--licht").trim() || "#A8702F", grund = cs.getPropertyValue("--gr").trim() || "#F5F8F9";
  const kreis = (r: number) => { const ring: [number, number][] = [];
    for (let i = 0; i <= 96; i++) { const a = i / 96 * 2 * Math.PI;
      ring.push([opt.lng + (r / (111 * Math.cos(opt.lat * Math.PI / 180))) * Math.cos(a), opt.lat + (r / 111) * Math.sin(a)]); }
    return { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: {} }; };

  if (genau > 0) {
    k.addSource("lage", { type: "geojson", data: { type: "FeatureCollection", features: [kreis(genau / 1000)] } });
    k.addLayer({ id: "lage-flaeche", type: "fill", source: "lage", paint: { "fill-color": licht, "fill-opacity": 0.10 } });
    k.addLayer({ id: "lage-linie", type: "line", source: "lage", paint: { "line-color": licht, "line-width": 1.4, "line-opacity": 0.65, "line-dasharray": [3, 3] } });
  } else {
    k.addSource("lage", { type: "geojson", data: { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [opt.lng, opt.lat] }, properties: {} }] } });
    k.addLayer({ id: "lage-punkt", type: "circle", source: "lage", paint: { "circle-radius": 8, "circle-color": licht, "circle-stroke-width": 3, "circle-stroke-color": grund } });
  }
  if (genau <= 600) {
    k.addSource("ringe", { type: "geojson", data: { type: "FeatureCollection", features: [kreis(0.5), kreis(1), kreis(3)] } });
    k.addLayer({ id: "ringe-linie", type: "line", source: "ringe", paint: { "line-color": licht, "line-width": 1, "line-opacity": 0.28, "line-dasharray": [2, 6] } }, genau > 0 ? "lage-flaeche" : "lage-punkt");
  }
  return k;
}
