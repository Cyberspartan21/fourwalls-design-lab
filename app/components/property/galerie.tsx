"use client";
import { useCallback, useEffect, useState } from "react";
import type { Media } from "@/domain/listing";
import { Bild } from "./bild";
import type { LichtWunsch } from "./ereignisse";

type Medien = { video?: { titel?: string; dauer?: string; hinweis?: string }; tour360?: { titel?: string; hinweis?: string }; modell3d?: { titel?: string; hinweis?: string }; sonne?: { ausrichtung: string; hauptraeume: string; sonnenstunden: string; grundlage: string } };

/* Bildgitter mit Kategorien und die Lichtbox — eine Insel, die auch auf
   Auslöser aus dem Server-Markup hört (fw:licht). */
export function Galerie({ bilder, kategorien, katLabel, titel, medien, tx, zeigeGitter }:
  { bilder: Media[]; kategorien: string[]; katLabel: Record<string, string>; titel: string; medien: Medien; zeigeGitter: boolean;
    tx: Record<string, string> }) {
  const [kat, setKat] = useState("alle");
  const [licht, setLicht] = useState<LichtWunsch | null>(null);
  const [lkat, setLkat] = useState("alle");

  useEffect(() => {
    const h = (e: Event) => { const w = (e as CustomEvent<LichtWunsch>).detail; setLkat("alle"); setLicht(w); };
    addEventListener("fw:licht", h); return () => removeEventListener("fw:licht", h);
  }, []);

  const liste = bilder.map((b, i) => i).filter(i => lkat === "alle" || bilder[i]?.category === lkat);
  const aktIndex = licht && "index" in licht ? licht.index : 0;
  const sprung = useCallback((d: number) => {
    if (!licht || !("index" in licht) || !liste.length) return;
    const p = Math.max(0, liste.indexOf(licht.index));
    setLicht({ index: liste[(p + d + liste.length) % liste.length] ?? 0 });
  }, [licht, liste]);

  useEffect(() => {
    if (!licht) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setLicht(null); if (e.key === "ArrowRight") sprung(1); if (e.key === "ArrowLeft") sprung(-1); };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [licht, sprung]);

  const teil = bilder.map((b, i) => ({ b, i })).filter(x => kat === "alle" || x.b.category === kat);
  /* .gal .g0..g5 haben je eigenes aspect-ratio (styles/objekt.css) — dieselbe
     Reihenfolge hier, damit das <img> selbst das Verhältnis kennt (P5.9
     Entscheid 23 §4), auch wenn die Zellenklasse es schon absichert. */
  const G_RATIO = ["16 / 10", "4 / 5", "1 / 1", "16 / 9", "3 / 2", "3 / 2"];
  const gross = (m: Media) => m.sources.jpeg.find(s => s.width === 1600)?.url ?? m.sources.jpeg[m.sources.jpeg.length - 1]?.url;
  const klein = (m: Media) => m.sources.jpeg.find(s => s.width === 480)?.url ?? m.sources.jpeg[0]?.url;

  const medium = licht && "medium" in licht ? licht.medium : null;
  const M: Record<string, [string, string, string]> = {
    video: [tx.o_objektfilm ?? "", medien.video ? `${medien.video.hinweis ?? ""}. ${tx.laenge ?? "Länge"} ${medien.video.dauer ?? ""}.` : "", tx.o_videoProd ?? ""],
    "360": [tx.o_rundgang ?? "", medien.tour360 ? (medien.tour360.hinweis ?? "") + "." : "", tx.o_rundgangProd ?? ""],
    "3d": [tx.o_modell3d ?? "", medien.modell3d ? (medien.modell3d.hinweis ?? "") + "." : "", tx.o_modell3dHinweis ?? ""],
    sonne: [tx.o_ausrichtungWort ?? "", medien.sonne ? `${medien.sonne.hauptraeume}. ${medien.sonne.sonnenstunden}.` : "", medien.sonne ? medien.sonne.grundlage + "." : ""]
  };
  const b = bilder[aktIndex];

  return (
    <>
      {zeigeGitter && (
        <>
          {kategorien.length > 2 && (
            <div className="katfilter" role="group" aria-label={tx.bildkategorien ?? "Bildkategorien"}>
              {kategorien.map(k => <button key={k} data-kat={k} aria-pressed={k === kat} onClick={() => setKat(k)}>{katLabel[k] ?? k}</button>)}
            </div>
          )}
          <div className="gal" id="galGitter">
            {teil.map((x, n) => (
              <figure key={x.i} className={`g${n % 6}`} data-li={x.i} onClick={() => { setLkat("alle"); setLicht({ index: x.i }); }}>
                <Bild m={x.b} sizes="(max-width:960px) 100vw, 50vw" alt={x.b.alt || titel} aspectRatio={G_RATIO[n % 6]} />
                {x.b.alt && <figcaption>{x.b.alt}</figcaption>}
              </figure>
            ))}
          </div>
          <div className="medienknoepfe">
            <button className="knopf" id="alleBilder" onClick={() => { setLkat("alle"); setLicht({ index: 0 }); }}>{tx.zeigeAlle} · {tx.bildLabel}</button>
            {medien.video && <button className="knopf" onClick={() => setLicht({ medium: "video" })}>{medien.video.titel || tx.o_video}{medien.video.dauer ? " · " + medien.video.dauer : ""}</button>}
            {medien.tour360 && <button className="knopf" onClick={() => setLicht({ medium: "360" })}>{medien.tour360.titel || "360°-Rundgang"}</button>}
            {medien.modell3d && <button className="knopf" onClick={() => setLicht({ medium: "3d" })}>{medien.modell3d.titel || "3D-Modell"}</button>}
          </div>
        </>
      )}

      <div className={`licht ${licht ? "an" : ""}`} id="licht" role="dialog" aria-modal="true" aria-label={tx.medienLabel ?? "Medien"}>
        {licht && medium && (
          <>
            <div className="lk"><span>{M[medium]?.[0]} · {titel}</span><button className="knopf" id="lichtZu" onClick={() => setLicht(null)} autoFocus>{tx.schliessen} ×</button></div>
            <div className="lb"><div className="buehne"><div><b>{M[medium]?.[0]}</b>{M[medium]?.[1]}<div className="fein">{M[medium]?.[2]}</div></div></div></div>
          </>
        )}
        {licht && !medium && b && (
          <>
            <div className="lk">
              <span id="lichtZ">{liste.indexOf(aktIndex) + 1} / {liste.length}</span>
              <div className="mitte">{kategorien.map(k => <button key={k} data-lkat={k} aria-pressed={k === lkat} onClick={() => { setLkat(k); const l = bilder.map((_, i) => i).filter(i => k === "alle" || bilder[i]?.category === k); if (!l.includes(aktIndex)) setLicht({ index: l[0] ?? 0 }); }}>{katLabel[k] ?? k}</button>)}</div>
              <button className="knopf" id="lichtZu" onClick={() => setLicht(null)} autoFocus>{tx.schliessen} ×</button>
            </div>
            <div className="lb">
              <button className="pf l" id="lichtL" aria-label={tx.o_vorherigesBild} onClick={() => sprung(-1)}>‹</button>
              <img id="lichtImg" src={gross(b)} alt={b.alt || titel} style={{ aspectRatio: "3 / 2" }} />
              <button className="pf r" id="lichtR" aria-label={tx.o_naechstesBild} onClick={() => sprung(1)}>›</button>
            </div>
            <div className="bu" id="lichtBu">{b.alt}</div>
            <div className="lf" id="lichtF">
              {liste.map(n => <button key={n} data-j={n} aria-current={n === aktIndex} aria-label={`${tx.o_bildWort} ${n + 1}`} onClick={() => setLicht({ index: n })}><img src={klein(bilder[n]!)} alt="" loading="lazy" style={{ aspectRatio: "3 / 2" }} /></button>)}
            </div>
          </>
        )}
      </div>
    </>
  );
}
