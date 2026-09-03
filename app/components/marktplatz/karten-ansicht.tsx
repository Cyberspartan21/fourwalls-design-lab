"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n";
import type { Suchanfrage, Suchergebnis, Treffer } from "@/domain/marktplatz";
import { paramsAusAnfrage } from "@/domain/suchurl";
import { trefferLabel, type Woerter } from "./labels";
import { Karte, objektPfad } from "./karte";

/* Kartenansicht — Markup wie #a-karte in portal.html, Verhalten wie dort:
   Karte (karte.js, wörtlich) und Seitenliste über denselben Suchvertrag;
   «In diesem Kartenausschnitt suchen» ist ein Server-Aufruf mit Rechteck;
   Auswahl markiert die Liste (Desktop) oder zeigt eine Vorschau (Mobil).
   Die Karte lädt erst hier — nicht auf der Listenseite. */
type UK = typeof import("@/components/map/ukarte")["UKARTE"];

export function KartenAnsicht({ q, initial, w, locale, pfad, basis }:
  { q: Suchanfrage; initial: Suchergebnis; w: Woerter; locale: Locale; pfad: { immobilien: string; kaufen: string; mieten: string }; basis: string }) {
  const router = useRouter();
  const [antwort, setAntwort] = useState<Suchergebnis>(initial);
  const [liste, setListe] = useState<Treffer[]>(initial.treffer);
  const [bereit, setBereit] = useState(false); const [fehler, setFehler] = useState(false);
  const [hierSuchen, setHierSuchen] = useState(false); const [ausschnitt, setAusschnitt] = useState(!!q.bounds);
  const [auto, setAuto] = useState(false); const autoRef = useRef(false);
  const [aktiv, setAktiv] = useState<string | null>(null); const [vorschau, setVorschau] = useState<Treffer | null>(null);
  const uk = useRef<UK | null>(null);
  const listeEl = useRef<HTMLDivElement>(null);
  useEffect(() => { autoRef.current = auto; }, [auto]);

  /* Karte starten — einmal */
  useEffect(() => {
    let weg = false;
    (async () => {
      try {
        const { UKARTE } = await import("@/components/map/ukarte");
        if (weg) return;
        uk.current = UKARTE;
        await UKARTE.starte("kmap", {
          bewegt: () => { if (autoRef.current) suchenHier(); else setHierSuchen(true); },
          gewaehlt: slug => waehlt(slug)
        });
        if (weg) return;
        setBereit(true);
        UKARTE.zeige(fuerKarte(initial) as never);
      } catch (e) { setFehler(true); console.error("Karte konnte nicht starten:", e); }
    })();
    return () => { weg = true; uk.current?.zerstoere(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* Neue Serverantwort (Filteränderung) → Zustand während des Renderns nachziehen, Karte im Effekt */
  const [vorher, setVorher] = useState(initial);
  if (vorher !== initial) { setVorher(initial); setAntwort(initial); setListe(initial.treffer); setAusschnitt(!!q.bounds); }
  useEffect(() => { if (bereit) uk.current?.zeige(fuerKarte(initial) as never, { behalteAusschnitt: !!q.bounds }); }, [initial, q.bounds, bereit]);
  /* Tag/Abend */
  useEffect(() => {
    const mo = new MutationObserver(() => { if (bereit) uk.current?.setzeModus(document.body.dataset.mode === "dunkel"); });
    mo.observe(document.body, { attributes: true, attributeFilter: ["data-mode"] }); return () => mo.disconnect();
  }, [bereit]);

  async function suchenHier() {
    const b = uk.current?.bounds(); if (!b) return;
    const p = paramsAusAnfrage({ ...q, bounds: b, seite: 1, modus: "map" }); p.set("locale", locale);
    try {
      const a: Suchergebnis = await fetch(`/api/search?${p.toString()}`).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
      setAntwort(a); setListe(a.treffer); setAusschnitt(true); setHierSuchen(false); uk.current?.setzeBewegt(false);
      uk.current?.zeige(fuerKarte(a) as never, { behalteAusschnitt: true });
      /* Adresse folgt dem Ausschnitt (teilbar, Zurück-tauglich) — ohne Server-Neuaufbau der Karte */
      const u = paramsAusAnfrage({ ...q, bounds: b, seite: 1, modus: "map" });
      history.replaceState(history.state, "", basis + "?" + u.toString());
    } catch (e) { console.error("Ausschnittsuche fehlgeschlagen:", e); }
  }
  async function alles() {
    const p = paramsAusAnfrage({ ...q, bounds: null, seite: 1, modus: "map" }); p.set("locale", locale);
    const a: Suchergebnis = await fetch(`/api/search?${p.toString()}`).then(r => r.json());
    setAntwort(a); setListe(a.treffer); setAusschnitt(false); setHierSuchen(false); uk.current?.zeige(fuerKarte(a) as never);
    const u = paramsAusAnfrage({ ...q, bounds: null, seite: 1, modus: "map" });
    history.replaceState(history.state, "", basis + "?" + u.toString());
  }
  async function waehlt(slug: string) {
    setAktiv(slug);
    const el = listeEl.current?.querySelector<HTMLElement>(`.karte[data-slug="${CSS.escape(slug)}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth" });
    if (matchMedia("(max-width:960px)").matches) {
      let t = antwort.treffer.find(x => x.slug === slug) ?? null;
      /* Punkt ausserhalb der Seitenliste: die Zusammenfassung kommt vom Server */
      if (!t) { const ref = antwort.punkte?.find(x => x.slug === slug)?.id; if (ref) { try { const a = await fetch(`/api/search?ref=${encodeURIComponent(ref)}&locale=${locale}`).then(r => r.json()); t = a.treffer?.[0] ?? null; } catch { t = null; } } }
      setVorschau(t);
    }
  }
  const zurListe = () => router.push(basis + (() => { const p = paramsAusAnfrage({ ...q, modus: "list", bounds: null }); return p.toString() ? "?" + p.toString() : ""; })(), { scroll: false });

  return (
    <>
      <div className="wasserlinie">
        <div className="tab2" role="group"><button id="tKaufK" aria-pressed={q.trans === "buy"} onClick={() => router.push(pfadFuer(basis, pfad, "buy") + kurz(q))}>{w.kaufen}</button><button id="tMieteK" aria-pressed={q.trans === "rent"} onClick={() => router.push(pfadFuer(basis, pfad, "rent") + kurz(q))}>{w.mieten}</button></div>
        <span className="n zahl" id="karteN">{trefferLabel(w, antwort.total)}</span>
        <label className="nurfw autosuche" id="autoSuchLabel"><input type="checkbox" id="autoSuche" checked={auto} onChange={e => { setAuto(e.target.checked); if (e.target.checked && uk.current?.istBewegt()) suchenHier(); }} /> <span>{w.autoSuchen}</span></label>
        <button className="knopf" id="zurListe" style={{ marginLeft: "auto" }} onClick={zurListe}>{w.liste}</button>
      </div>
      <div className="kartenraum">
        <div className="kartenliste" id="karteListe" ref={listeEl}>
          {liste.map(l => (
            <Karte key={l.id} l={l} w={w} locale={locale} href={objektPfad(locale, pfad, l)} aktiv={aktiv === l.slug}
              onMouseEnter={() => uk.current?.waehle(l.slug, true)} onMouseLeave={() => uk.current?.waehle(aktiv, true)} onClick={() => { setAktiv(l.slug); uk.current?.waehle(l.slug); }} />
          ))}
        </div>
        <div className="karto">
          <div id="kmap" role="application" aria-label="Karte der Suchergebnisse — die Liste daneben enthält dieselben Objekte"></div>
          <button className="knopf hierSuchen" id="hierSuchen" hidden={!hierSuchen} onClick={suchenHier}>{w.hierSuchen}</button>
          <div className="kartenhinweis" id="kartenHinweis" hidden={!ausschnitt}>{w.imAusschnitt}</div>
          <div className="kartenleer" id="kartenLeer" hidden={antwort.total > 0}>
            <p>{w.karteLeerText}</p>
            <div className="wege" id="karteLeerWege"><button className="knopf" id="klZoom" onClick={() => { uk.current?.karte()?.zoomOut(2); setTimeout(suchenHier, 400); }}>{w.radiusMehr}</button><button className="knopf" id="klAlle" onClick={alles}>{w.zuruecksetzen}</button></div>
          </div>
          <div className="kartenfehler" id="kartenFehler" hidden={!fehler}>
            <p>{w.karteFehler}</p>
            <button className="knopf" id="zurListe2" onClick={zurListe}>{w.liste}</button>
          </div>
        </div>
      </div>
      <div className="mobilvorschau" id="mobilVorschau" hidden={!vorschau}>
        {vorschau && <><button className="zu" id="mvZu" aria-label={w.schliessen} onClick={() => { setVorschau(null); setAktiv(null); uk.current?.waehle(null); }}>×</button><Karte l={vorschau} w={w} locale={locale} href={objektPfad(locale, pfad, vorschau)} /></>}
      </div>
    </>
  );
}
/* karte.js liest die Punkte aus `treffer`: im Kartenmodus sind das alle Punkte, nicht die 60 Karten der Seitenliste */
const fuerKarte = (a: Suchergebnis) => ({ ...a, treffer: a.punkte ?? a.treffer });
const pfadFuer = (basis: string, pfad: { kaufen: string; mieten: string }, t: "buy" | "rent") => basis.replace(/\/[^/]+$/, "/" + (t === "rent" ? pfad.mieten : pfad.kaufen));
const kurz = (q: Suchanfrage) => { const p = paramsAusAnfrage({ ...q, pMin: null, pMax: null, seite: 1, bounds: null, modus: "map" }); return p.toString() ? "?" + p.toString() : ""; };
