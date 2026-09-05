"use client";
import { useEffect, useRef } from "react";

/* Fortschritt, Schrittnavigation und Fehlerliste für die Anliegen-Formulare —
   dieselbe visuelle Sprache wie der Inserats-Assistent (.fort, .schrittz),
   ergänzt um zwei Dinge, die dort fehlen:

   1. Fokus wandert nach jedem Schrittwechsel auf die Schrittüberschrift
      (tabIndex={-1}), damit Screenreader- und Tastaturnutzung den neuen
      Inhalt sofort ankündigen, statt stumm am alten Ort zu bleiben.
   2. Eine Fehlerliste (role="alert") verlinkt direkt auf die betroffenen
      Felder — per Anker-ID, die jeder Block selbst vergibt. */

export interface Fehlerhinweis { anker: string; text: string }

export function Stepper({ schritte, aktiv, titel, hinweis }:
  { schritte: string[]; aktiv: number; titel: string; hinweis?: { titel: string; eintraege: Fehlerhinweis[] } | undefined }) {
  const ueberschrift = useRef<HTMLHeadingElement>(null);

  useEffect(() => { ueberschrift.current?.focus(); }, [aktiv]);

  return (
    <>
      <div className="fort" aria-hidden="true">{schritte.map((_, n) => <i key={n} className={n <= aktiv ? "voll" : ""} />)}</div>
      <nav aria-label="Schritte" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {schritte.map((s, n) => (
          <span key={s} aria-current={n === aktiv ? "step" : undefined}
            className="schrittz" style={{ color: n === aktiv ? "var(--licht)" : "var(--leise)" }}>{s}</span>
        ))}
      </nav>
      <h2 ref={ueberschrift} tabIndex={-1} style={{ outline: "none" }}>{titel}</h2>

      {hinweis && hinweis.eintraege.length > 0 && (
        <div className="hinweisbox" role="alert" style={{ marginTop: 14, borderColor: "var(--warn)" }}>
          <b>{hinweis.titel}</b>
          <ul style={{ margin: "8px 0 0", paddingLeft: "1.1em" }}>
            {hinweis.eintraege.map((e, i) => <li key={e.anker + i}><a href={`#${e.anker}`}>{e.text}</a></li>)}
          </ul>
        </div>
      )}
    </>
  );
}
