"use client";
import { useState, useSyncExternalStore } from "react";
import { favorites } from "@/components/favorites";
import { vergleich } from "@/components/vergleich";

const vergleichAbo = (cb: () => void) => { addEventListener("fw:vergleich", cb); return () => removeEventListener("fw:vergleich", cb); };

/* Kompakte Symbole für sehr schmale Bildschirme (≤600px): dort wird aus dem
   Text ein Symbol, damit drei Knöpfe plus Sprachwahl plus Schliessen ohne
   horizontales Verschieben Platz finden (P5.6-Befund: mit vollem Text lief
   die Kopfleiste bei 390px über den Bildschirmrand hinaus). Auf breiteren
   Bildschirmen bleibt der Text wie bisher — die Symbole sind dort per CSS
   verborgen, das Erscheinungsbild ändert sich dort nicht. */
const HERZ_S = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 20s-7-4.6-9.2-8.8C1.2 8 3 5 6.2 5c2 0 3.3 1 4.3 2.4h3c1-1.4 2.3-2.4 4.3-2.4 3.2 0 5 3 3.4 6.2C19 15.4 12 20 12 20Z" /></svg>;
const WAAGE_S = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v18M7 21h10M4 8l3-4 3 4M14 8l3-4 3 4M4 8a3 3 0 0 0 6 0M14 8a3 3 0 0 0 6 0" /></svg>;
const TEILEN_S = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 4v11M8 8l4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>;

/* Die Kopfleiste: merken, vergleichen, teilen, schliessen. Merken läuft über
   das FavoriteRepository, Vergleichen über das VergleichRepository — die
   Leiste weiss nicht, wo gemerkt oder verglichen wird. */
export function Kopf({ publicRef, quelle, titel, exklusiv, wirVertreten, zurueck, tx, sprachLinks, locale }:
  { publicRef: string; quelle: string; titel: string; exklusiv: boolean; wirVertreten: boolean; zurueck: string; sprachLinks: Record<string, string>; locale: string;
    tx: { merken: string; gemerkt: string; teilen: string; kopiert: string; schliessen: string; vergleichen: string; imVergleich: string; vergleichVoll: string } }) {
  /* Auf dem Server ist nichts gemerkt; im Browser entscheidet das Repository. */
  const fav = useSyncExternalStore(
    cb => { addEventListener("fw:merkliste", cb); addEventListener("storage", cb); return () => { removeEventListener("fw:merkliste", cb); removeEventListener("storage", cb); }; },
    () => favorites().hat(publicRef), () => false);
  const imVergleich = useSyncExternalStore(vergleichAbo, () => vergleich().hat(publicRef), () => false);
  const [kopiert, setKopiert] = useState(false);
  const [voll, setVoll] = useState(false);
  return (
    <div className="dkopf">
      <span className="z">{wirVertreten && <span className="mark"></span>}<b>{quelle}</b><span className="tt">{titel}</span></span>
      <div className="aktionen">
        {/* Sprachwahl: dieselbe Immobilie in der anderen Sprache (P5.3 §88) — im Prototyp lag sie im Seitenkopf hinter dem Overlay */}
        <div className="sprache" role="group" aria-label="Sprache">{Object.entries(sprachLinks).map(([l, h]) => <a key={l} href={h} data-l={l} hrefLang={l} aria-current={l === locale ? "true" : undefined}>{l.toUpperCase()}</a>)}</div>
        <button className="knopf ksym" id="dMerken" aria-pressed={fav} aria-label={fav ? tx.gemerkt : tx.merken} onClick={() => favorites().kippen(publicRef)}>
          <span className="txt">{fav ? tx.gemerkt : tx.merken}</span><span className="ic">{HERZ_S}</span>
        </button>
        <button className="knopf ksym" id="dVergleichen" aria-pressed={imVergleich} aria-label={imVergleich ? tx.imVergleich : tx.vergleichen} onClick={() => {
          if (imVergleich) { vergleich().entfernen(publicRef); return; }
          const ok = vergleich().hinzufuegen(publicRef);
          if (!ok) { setVoll(true); setTimeout(() => setVoll(false), 4000); }
        }}>
          <span className="txt">{imVergleich ? tx.imVergleich : tx.vergleichen}</span><span className="ic">{WAAGE_S}</span>
        </button>
        <button className="knopf ksym" id="dTeilen" aria-label={kopiert ? tx.kopiert : tx.teilen} onClick={() => { try { navigator.clipboard.writeText(location.href); } catch { /* ohne Zwischenablage */ } setKopiert(true); }}>
          <span className="txt">{kopiert ? tx.kopiert : tx.teilen}</span><span className="ic">{TEILEN_S}</span>
        </button>
        <a className="knopf" id="dZu" href={zurueck} data-exklusiv={exklusiv ? "1" : undefined}>{tx.schliessen} ×</a>
      </div>
      {voll && <p role="alert" style={{ fontSize: ".72rem", color: "var(--leise)", padding: "6px var(--pad) 0", margin: 0 }}>{tx.vergleichVoll}</p>}
    </div>
  );
}
