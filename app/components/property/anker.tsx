"use client";
import { useEffect, useState } from "react";
import type { Abschnitt } from "@/domain/dossier";
import { zumAnker } from "./ereignisse";

/* Ankernavigation mit Scroll-Beobachtung — im Dokument, nicht im Overlay. */
export function Anker({ abschnitte, label }: { abschnitte: Abschnitt[]; label: string }) {
  const [akt, setAkt] = useState(0);
  useEffect(() => {
    const auf = () => {
      let a = 0;
      abschnitte.forEach((s, i) => { const el = document.getElementById("d-" + s.id); if (el && el.getBoundingClientRect().top < 170) a = i; });
      setAkt(a);
    };
    addEventListener("scroll", auf, { passive: true }); auf();
    return () => removeEventListener("scroll", auf);
  }, [abschnitte]);
  return (
    <nav className="anker" aria-label={label}>
      {abschnitte.map((s, i) => <a key={s.id} href={`#d-${s.id}`} data-anker={s.id} aria-current={i === akt} onClick={e => { e.preventDefault(); zumAnker(s.id); }}>{s.titel}</a>)}
    </nav>
  );
}
