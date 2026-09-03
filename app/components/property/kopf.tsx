"use client";
import { useState, useSyncExternalStore } from "react";
import { favorites } from "@/components/favorites";

/* Die Kopfleiste: merken, teilen, schliessen. Merken läuft über das
   FavoriteRepository — die Leiste weiss nicht, wo gemerkt wird. */
export function Kopf({ publicRef, quelle, titel, exklusiv, wirVertreten, zurueck, tx, sprachLinks, locale }:
  { publicRef: string; quelle: string; titel: string; exklusiv: boolean; wirVertreten: boolean; zurueck: string; sprachLinks: Record<string, string>; locale: string;
    tx: { merken: string; gemerkt: string; teilen: string; kopiert: string; schliessen: string } }) {
  /* Auf dem Server ist nichts gemerkt; im Browser entscheidet das Repository. */
  const fav = useSyncExternalStore(
    cb => { addEventListener("fw:merkliste", cb); addEventListener("storage", cb); return () => { removeEventListener("fw:merkliste", cb); removeEventListener("storage", cb); }; },
    () => favorites().hat(publicRef), () => false);
  const [kopiert, setKopiert] = useState(false);
  return (
    <div className="dkopf">
      <span className="z">{wirVertreten && <span className="mark"></span>}<b>{quelle}</b><span className="tt">{titel}</span></span>
      <div className="aktionen">
        {/* Sprachwahl: dieselbe Immobilie in der anderen Sprache (P5.3 §88) — im Prototyp lag sie im Seitenkopf hinter dem Overlay */}
        <div className="sprache" role="group" aria-label="Sprache">{Object.entries(sprachLinks).map(([l, h]) => <a key={l} href={h} data-l={l} hrefLang={l} aria-current={l === locale ? "true" : undefined}>{l.toUpperCase()}</a>)}</div>
        <button className="knopf" id="dMerken" aria-pressed={fav} onClick={() => { favorites().kippen(publicRef); dispatchEvent(new Event("fw:merkliste")); }}>{fav ? tx.gemerkt : tx.merken}</button>
        <button className="knopf" id="dTeilen" onClick={() => { try { navigator.clipboard.writeText(location.href); } catch { /* ohne Zwischenablage */ } setKopiert(true); }}>{kopiert ? tx.kopiert : tx.teilen}</button>
        <a className="knopf" id="dZu" href={zurueck} data-exklusiv={exklusiv ? "1" : undefined}>{tx.schliessen} ×</a>
      </div>
    </div>
  );
}
