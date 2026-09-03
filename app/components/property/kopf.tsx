"use client";
import { useState, useSyncExternalStore } from "react";
import { favorites } from "@/components/favorites";

/* Die Kopfleiste: merken, teilen, schliessen. Merken läuft über das
   FavoriteRepository — die Leiste weiss nicht, wo gemerkt wird. */
export function Kopf({ publicRef, quelle, titel, exklusiv, wirVertreten, zurueck, tx }:
  { publicRef: string; quelle: string; titel: string; exklusiv: boolean; wirVertreten: boolean; zurueck: string;
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
        <button className="knopf" id="dMerken" aria-pressed={fav} onClick={() => { favorites().kippen(publicRef); dispatchEvent(new Event("fw:merkliste")); }}>{fav ? tx.gemerkt : tx.merken}</button>
        <button className="knopf" id="dTeilen" onClick={() => { try { navigator.clipboard.writeText(location.href); } catch { /* ohne Zwischenablage */ } setKopiert(true); }}>{kopiert ? tx.kopiert : tx.teilen}</button>
        <a className="knopf" id="dZu" href={zurueck} data-exklusiv={exklusiv ? "1" : undefined}>{tx.schliessen} ×</a>
      </div>
    </div>
  );
}
