"use client";
import { useState } from "react";

/* Beschreibung: lang → gekürzt mit «ganze Beschreibung», wie im Prototyp. */
export function Beschreibung({ absaetze, lang, mehrLabel }: { absaetze: string[]; lang: boolean; mehrLabel: string }) {
  const [kurz, setKurz] = useState(lang);
  return (
    <>
      <div className={`dtext ${kurz ? "kurz" : ""}`} id="dText">{absaetze.map((p, i) => <p key={i}>{p}</p>)}</div>
      {kurz && <button className="mehrtext" id="mehrText" onClick={() => setKurz(false)}>{mehrLabel}</button>}
    </>
  );
}
