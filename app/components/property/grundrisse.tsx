"use client";
import { useEffect, useRef, useState } from "react";
import type { Floorplan } from "@/domain/listing";

/* Grundrisse: Reiter, Zoom, Vollbild. Die Zeichnungen sind eigene SVG-Dateien
   aus public/plans (erstautorisiert, kein Upload — die Datenbank lässt für
   hochgeladene Pläne nur Rasterbilder und PDF zu). Sie werden über DOMParser
   eingesetzt: kein innerHTML, keine Skriptausführung, <script> wird entfernt. */
export function Grundrisse({ plaene, tx }: { plaene: Floorplan[]; tx: Record<string, string> }) {
  const [i, setI] = useState(0);
  const [z, setZ] = useState(1);
  const [voll, setVoll] = useState(false);
  const blatt = useRef<HTMLDivElement>(null);
  const vollRef = useRef<HTMLDivElement>(null);
  const g = plaene[i];

  useEffect(() => {
    let weg = false;
    const ziel = blatt.current; if (!ziel || !g) return;
    ziel.replaceChildren();
    if (!g.file) { const d = document.createElement("div"); d.className = "pdfplan"; d.textContent = `${g.level}. ${tx.o_planPdf1}. ${tx.o_planPdf2}`; ziel.appendChild(d); return; }
    fetch(g.file).then(r => r.ok ? r.text() : Promise.reject(new Error(String(r.status)))).then(txt => {
      if (weg) return;
      const doc = new DOMParser().parseFromString(txt, "image/svg+xml");
      doc.querySelectorAll("script, foreignObject").forEach(n => n.remove());
      const svg = doc.documentElement;
      if (svg.nodeName.toLowerCase() !== "svg") throw new Error("kein SVG");
      ziel.replaceChildren(document.importNode(svg, true));
    }).catch(() => { if (weg) return; const d = document.createElement("div"); d.className = "pdfplan"; d.textContent = tx.o_planNichtGeladen ?? ""; ziel.replaceChildren(d); });
    return () => { weg = true; };
  }, [g, tx]);

  useEffect(() => {
    if (!voll) return;
    const q = vollRef.current, s = blatt.current?.querySelector("svg");
    if (q && s) q.replaceChildren(s.cloneNode(true));
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setVoll(false); };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [voll]);

  if (!g) return null;
  return (
    <div className="plaene">
      <div className="tabs">
        {plaene.map((p, n) => <button key={n} data-plan={n} aria-pressed={n === i} onClick={() => { setI(n); setZ(1); }}>{p.level}{p.areaM2 ? ` · ${p.areaM2} m²` : ""}</button>)}
        <div className="rechts">
          <button data-zoom="-" aria-label={tx.o_verkleinern} onClick={() => setZ(v => Math.max(1, v / 1.4))}>−</button>
          <button data-zoom="+" aria-label={tx.o_vergroessern} onClick={() => setZ(v => Math.min(3, v * 1.4))}>+</button>
          <button data-zoom="v" aria-label={tx.o_vollbild} onClick={() => setVoll(true)}>⛶</button>
          {g.file && <a className="knopf leise" id="planLaden" href={g.file} download>SVG</a>}
        </div>
      </div>
      <div className="planblatt" id="planBlatt"><div className="zeichnung" id="planZ" ref={blatt} style={{ transform: z === 1 ? "" : `scale(${z})` }}></div></div>
      <div className="raeume" id="planRaeume">{g.rooms.map((r, n) => <span key={n}><b>{r.name}</b> {r.m2 ? r.m2 + " m²" : ""}</span>)}</div>
      {voll && (
        <div className="licht an" role="dialog" aria-modal="true">
          <div className="lk"><span>{tx.o_grundrissPrefix} {g.level}</span><button className="knopf" onClick={() => setVoll(false)} autoFocus>{tx.schliessen} ×</button></div>
          <div className="lb"><div style={{ width: "min(1100px,92vw)", color: "#EEF1F2" }} ref={vollRef}></div></div>
        </div>
      )}
    </div>
  );
}
