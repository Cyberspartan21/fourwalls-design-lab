"use client";
import { useEffect, useRef } from "react";

/* Exclusive-Premiere: das Fenster öffnet die Wand. Titel und Preis stehen
   von Anfang an — die Animation ist Zugabe, nie Voraussetzung. */
export function Blende({ children }: { children: React.ReactNode }) {
  const wand = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const w = wand.current; if (!w) return;
    const fen = w.querySelector<HTMLElement>(".fenster"); if (!fen) return;
    if (matchMedia("(prefers-reduced-motion:reduce)").matches) { w.classList.add("aus"); return; }
    let start: number | null = null, raf = 0;
    const ease = (x: number) => x < .5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
    const auf = (ts: number) => {
      if (start === null) start = ts;
      const k = Math.min(1, (ts - start) / 900), e = ease(k);
      fen.style.setProperty("--ms", (100 + e * 2400) + "%");
      w.style.opacity = String(1 - Math.max(0, (k - .6) / .4));
      if (k < 1) raf = requestAnimationFrame(auf); else w.classList.add("aus");
    };
    const t1 = setTimeout(() => { raf = requestAnimationFrame(auf); }, 700);
    /* Sicherheitsnetz: die Wand darf unter keinen Umständen stehen bleiben */
    const t2 = setTimeout(() => w.classList.add("aus"), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); cancelAnimationFrame(raf); };
  }, []);
  return <div className="wand" ref={wand}>{children}</div>;
}
