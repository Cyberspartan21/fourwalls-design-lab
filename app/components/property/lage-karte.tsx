"use client";
import { useEffect, useRef, useState } from "react";
import type { Poi, PublicGeo } from "@/domain/listing";

/* Lagekarte: zuerst das Schema (Canvas, sofort), dann die echte Karte —
   geladen erst, wenn der Abschnitt ins Bild kommt. Gelingt sie nicht, bleibt
   das Schema stehen. Umgebungsfilter wirken auf Schema und Listen. */
const POI_FARBE: Record<string, string> = { oev: "#5E8FB5", schulen: "#7FA97A", einkauf: "#C08A6B", gesundheit: "#B0768E", freizeit: "#8A8FB5", verkehr: "#6E8A94" };

export function LageKarte({ geo, ort, pois, poiLabel, tx }:
  { geo: PublicGeo | null; ort: string; pois: Record<string, Poi[]>; poiLabel: Record<string, string>; tx: Record<string, string> }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const [an, setAn] = useState<Record<string, boolean>>(() => Object.fromEntries(Object.keys(pois).map(k => [k, true])));
  const [gross, setGross] = useState(false);
  const [karteDa, setKarteDa] = useState(false);
  const instanz = useRef<{ remove(): void; resize(): void } | null>(null);
  const poiDa = Object.keys(POI_FARBE).filter(k => (pois[k]?.length ?? 0) > 0);

  /* Schema */
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const stil = (n: string) => getComputedStyle(document.body).getPropertyValue(n).trim();
    const mal = () => {
      const b = c.parentElement!.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      c.width = b.width * dpr; c.height = b.height * dpr;
      const x = c.getContext("2d"); if (!x) return; x.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = b.width, h = b.height, cx = w / 2, cy = h / 2;
      x.fillStyle = stil("--tief"); x.fillRect(0, 0, w, h);
      x.strokeStyle = stil("--linie"); x.lineWidth = 1;
      for (let y = 0; y < h; y += 34) { x.globalAlpha = .35 + y / h * .5; x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
      x.globalAlpha = 1;
      const skala = Math.min(w, h) / 2 / 3.4;
      ([[.5, "500 m"], [1, "1 km"], [3, "3 km"]] as [number, string][]).forEach(([km, txt]) => {
        x.beginPath(); x.arc(cx, cy, km * skala, 0, 7); x.strokeStyle = stil("--linie2"); x.setLineDash([3, 5]); x.stroke(); x.setLineDash([]);
        x.fillStyle = stil("--leise"); x.font = "9px 'Manrope',sans-serif"; x.fillText(txt, cx + km * skala - 26, cy - 5);
      });
      let winkel = -Math.PI / 2;
      Object.keys(POI_FARBE).forEach(k => {
        if (!pois[k] || !an[k]) return;
        pois[k]!.forEach(p => {
          const d = String(p.distanz ?? "");
          const km = parseFloat(d.replace(",", ".")) * (d.includes(" m") && !d.includes("km") ? .001 : 1) || .8;
          const r = Math.min(km, 3.3) * skala, px = cx + Math.cos(winkel) * r, py = cy + Math.sin(winkel) * r * .78;
          winkel += 2.399;
          x.beginPath(); x.arc(px, py, 4, 0, 7); x.fillStyle = POI_FARBE[k]!; x.fill();
          x.fillStyle = stil("--ink"); x.font = "9px 'Manrope',sans-serif";
          x.fillText(p.name.length > 22 ? p.name.slice(0, 21) + "…" : p.name, px + 7, py + 3);
        });
      });
      x.beginPath(); x.arc(cx, cy, 7, 0, 7); x.fillStyle = stil("--licht"); x.fill();
      x.beginPath(); x.arc(cx, cy, 15, 0, 7); x.strokeStyle = stil("--licht"); x.lineWidth = 1.4; x.stroke();
      x.fillStyle = stil("--ink"); x.font = "500 10px 'Manrope',sans-serif"; x.fillText(ort.toUpperCase(), cx + 22, cy + 3);
      x.fillStyle = stil("--leise"); x.font = "9px 'Manrope',sans-serif"; x.fillText(tx.o_ungefaehreLageCanvas ?? "", 12, h - 26);
    };
    mal();
    addEventListener("resize", mal);
    const mo = new MutationObserver(mal); mo.observe(document.body, { attributes: true, attributeFilter: ["data-mode"] });
    return () => { removeEventListener("resize", mal); mo.disconnect(); };
  }, [an, pois, ort, tx, gross]);

  /* Echte Karte — faul, erst bei Sichtbarkeit; bei Moduswechsel neu */
  useEffect(() => {
    const el = mapEl.current; if (!el || !geo) return;
    let weg = false;
    const bauen = async () => {
      try {
        const { detailKarte } = await import("@/components/map/detail-map");
        if (weg) return;
        const k = await detailKarte(el, { lat: geo.lat, lng: geo.lng, genauigkeitM: geo.radiusM, dunkel: document.body.dataset.mode === "dunkel" });
        if (weg) { k.remove(); return; }
        instanz.current = k; setKarteDa(true);
      } catch (e) { setKarteDa(false); console.error("Lagekarte konnte nicht laden:", e); }
    };
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); bauen(); } }, { rootMargin: "200px" });
    io.observe(el);
    const mo = new MutationObserver(() => { if (instanz.current) { instanz.current.remove(); instanz.current = null; el.replaceChildren(); setKarteDa(false); bauen(); } });
    mo.observe(document.body, { attributes: true, attributeFilter: ["data-mode"] });
    return () => { weg = true; io.disconnect(); mo.disconnect(); if (instanz.current) { instanz.current.remove(); instanz.current = null; } };
  }, [geo]);

  useEffect(() => { document.querySelectorAll<HTMLElement>("[data-liste]").forEach(li => { li.style.display = an[li.dataset.liste ?? ""] === false ? "none" : ""; }); }, [an]);

  const hinweis = (() => {
    const q = tx.o_karteSwisstopo;
    if (!geo || geo.precision === "exact") return `${tx.o_lageExakt} · ${q}`;
    if (geo.precision === "municipality") return `${tx.o_lageGemeinde} · ${tx.o_genaueAdresse2} · ${q}`;
    const m = geo.radiusM;
    return `${tx.o_lageUngefaehr}${m ? ` ${tx.o_imUmkreisVon} ${m >= 1000 ? m / 1000 + " km" : m + " m"}` : ""} · ${tx.o_genaueAdresse2} · ${q}`;
  })();

  return (
    <>
      <div className="lagekarte" style={gross ? { height: "min(78vh,760px)" } : undefined}>
        <div id="lageMap" ref={mapEl} className={karteDa ? "da" : ""}></div>
        <canvas id="lageKarte" ref={cv} style={karteDa ? { display: "none" } : undefined}></canvas>
        <button className="knopf voll" id="karteVoll" onClick={() => { setGross(g => !g); requestAnimationFrame(() => instanz.current?.resize()); }}>{gross ? tx.o_verkleinern : tx.o_vergroessern}</button>
        <div className="fein" id="lageHinweis">{hinweis}</div>
      </div>
      {poiDa.length > 0 && (
        <div className="poifilter" role="group" aria-label={tx.poiGruppe ?? "Was in der Nähe angezeigt wird"}>
          {poiDa.map(k => <button key={k} data-poi={k} aria-pressed={an[k] !== false} style={{ ["--pc" as string]: POI_FARBE[k] }} onClick={() => setAn(a => ({ ...a, [k]: a[k] === false }))}><i style={{ background: POI_FARBE[k] }}></i>{poiLabel[k]}</button>)}
        </div>
      )}
    </>
  );
}
