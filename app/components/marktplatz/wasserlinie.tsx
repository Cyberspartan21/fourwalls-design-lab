"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n";
import { LEER, TYPEN, QUELLEN, FEATURES, UMKREISE, hatEtage, hatGrundstueck, type Suchanfrage, type Typ, type Quelle, type Feature, type Etage, type Verf } from "@/domain/marktplatz";
import { paramsAusAnfrage } from "@/domain/suchurl";
import { typLabel, quelleFilterLabel, featLabel, fmtIn, type Woerter } from "./labels";

/* Die Wasserlinie: Suchleiste und «Mehr Filter» — Markup wie in portal.html.

   Zustand lebt in der Adresszeile. Jede Änderung navigiert (Server rendert
   die Treffer neu); während des Übergangs bleiben die alten Treffer sichtbar
   (React-Transition), nichts blitzt. Zurück/Vor, Teilen, Aktualisieren
   funktionieren damit von selbst. Die Trefferzahl im Filterfeld kommt über
   die API — eine Vorschau, keine zweite Suche. */

export interface Ortwahl { id: string; label: string; typ: "ort" | "plz" | "kanton" | "region" }
export interface Vorschlag { typ: string; id: string; label: string; sub: string }

export function Wasserlinie({ q, ort, w, locale, basis, seiteVon, ansichtKarte, total }:
  { q: Suchanfrage; ort: Ortwahl | null; w: Woerter; locale: Locale; basis: { kaufen: string; mieten: string }; seiteVon: string; ansichtKarte: boolean; total: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [F, setF] = useState<Suchanfrage>(q);
  const [ortText, setOrtText] = useState(ort?.label ?? "");
  const [vorschlaege, setVorschlaege] = useState<Vorschlag[]>([]);
  const [offen, setOffen] = useState(false);
  const [vorschau, setVorschau] = useState<number | null>(null);
  const [entwurf, setEntwurf] = useState<Suchanfrage>(q);
  const ortTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const preisTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /* Neue Serverantwort → die Seite setzt einen neuen key; der Zustand beginnt frisch. */

  /* Navigieren = Zustand in die Adresse schreiben */
  const geh = (n: Partial<Suchanfrage>, opt?: { ersetzen?: boolean }) => {
    const neu: Suchanfrage = { ...F, ...n, seite: 1, bounds: null, modus: ansichtKarte ? "map" : "list" };
    setF(neu);
    const pfad = neu.trans === "rent" ? basis.mieten : basis.kaufen;
    const p = paramsAusAnfrage(neu); p.delete("seite");
    const url = pfad + (p.toString() ? "?" + p.toString() : "");
    start(() => { if (opt?.ersetzen) router.replace(url, { scroll: false }); else router.push(url, { scroll: false }); });
  };

  /* Ortsvorschläge über die API */
  const ortEingabe = (v: string) => {
    setOrtText(v); clearTimeout(ortTimer.current);
    if (v.trim() === "" && F.ort) { geh({ ort: null, umkreisKm: 0 }); setVorschlaege([]); return; }
    ortTimer.current = setTimeout(async () => {
      if (!v.trim()) { setVorschlaege([]); return; }
      try { const r = await fetch(`/api/orte?q=${encodeURIComponent(v)}&locale=${locale}`); setVorschlaege(await r.json()); } catch { setVorschlaege([]); }
    }, 140);
  };
  const ortWahl = (s: Vorschlag) => { setOrtText(s.label); setVorschlaege([]); geh({ ort: s.id, umkreisKm: ["ort", "plz", "kanton"].includes(s.typ) ? F.umkreisKm : 0 }); };

  /* Vorschau im Filterfeld */
  useEffect(() => {
    if (!offen) return;
    let weg = false;
    const p = paramsAusAnfrage({ ...entwurf, seite: 1, modus: "list" }); p.set("proSeite", "1"); p.set("locale", locale);
    fetch(`/api/search?${p.toString()}`).then(r => r.json()).then(a => { if (!weg) setVorschau(typeof a.total === "number" ? a.total : null); }).catch(() => { if (!weg) setVorschau(null); });
    return () => { weg = true; };
  }, [entwurf, offen, locale]);

  useEffect(() => {
    const zu = (e: MouseEvent) => { const t = e.target as Element; if (!t.closest(".ortfeld")) setVorschlaege([]); if (!t.closest(".mehrfilter")) setOffen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOffen(false); setVorschlaege([]); } };
    document.addEventListener("click", zu); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("click", zu); document.removeEventListener("keydown", esc); };
  }, []);

  const zahl = (s: string) => { const n = parseInt(s.replace(/[^\d]/g, ""), 10); return isNaN(n) ? null : n; };
  const aktiv = [F.typ, F.pMin != null, F.pMax != null, F.ziMin != null, F.ziMax != null, F.flMin != null, F.flMax != null, F.grMin != null, F.bjVon != null, F.bjBis != null, F.etage, F.verf, F.quelle, F.umkreisKm > 0, !F.nurFrei].filter(Boolean).length + F.feat.length;
  const ART: Record<string, string> = { ort: w.artOrt!, plz: w.artPlz!, kanton: w.artKanton!, region: w.artRegion! };
  const E = entwurf, set = (n: Partial<Suchanfrage>) => setEntwurf({ ...E, ...n });
  const zi = ["", "1.5", "2.5", "3.5", "4.5", "5.5", "6.5", "7.5"];
  const umkreisSichtbar = !!ort && ["ort", "plz", "kanton"].includes(ort.typ);

  return (
    <div className={`wasserlinie${pending ? " laedt" : ""}`} aria-busy={pending}>
      <div className="tab2" role="group">
        <button id="tKauf" aria-pressed={F.trans === "buy"} onClick={() => geh({ trans: "buy", pMin: null, pMax: null })}>{w.kaufen}</button>
        <button id="tMiete" aria-pressed={F.trans === "rent"} onClick={() => geh({ trans: "rent", pMin: null, pMax: null })}>{w.mieten}</button>
      </div>
      <div className="ortfeld">
        <input className="feld" id="ortInput" type="text" placeholder={w.ort} autoComplete="off" aria-label={w.ort} value={ortText}
          onChange={e => ortEingabe(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (vorschlaege[0]) ortWahl(vorschlaege[0]); } }} />
        <div className={`vorschlaege${vorschlaege.length ? " an" : ""}`} id="ortVor">
          {vorschlaege.map(s => <button key={s.id} data-pid={s.id} onClick={() => ortWahl(s)}><span><span className="art">{ART[s.typ] ?? s.typ}</span>{s.label}</span><small>{s.sub}</small></button>)}
        </div>
      </div>
      <select className="feld" id="umSel" aria-label="Umkreis" hidden={!umkreisSichtbar} value={String(F.umkreisKm || 0)} onChange={e => geh({ umkreisKm: Number(e.target.value) })}>
        {UMKREISE.map(u => <option key={u} value={u}>{u === 0 ? w.keinUmkreis : `+ ${u} ${w.km}`}</option>)}
      </select>
      <select className="feld" id="typSel" aria-label={w.typ} value={F.typ} onChange={e => geh({ typ: e.target.value as Typ | "" })}>
        <option value="">{w.typ}</option>{TYPEN.map(k => <option key={k} value={k}>{typLabel(w, k)}</option>)}
      </select>
      <div className="preisspanne" aria-label="Preisspanne">
        <input id="pMinIn" inputMode="numeric" placeholder={w.preisVon} aria-label={w.preisVon} defaultValue={fmtIn(F.pMin)} key={"pmin" + F.pMin}
          onChange={e => { clearTimeout(preisTimer.current); const v = zahl(e.target.value); preisTimer.current = setTimeout(() => geh({ pMin: v }, { ersetzen: true }), 350); }} />
        <span>–</span>
        <input id="pMaxIn" inputMode="numeric" placeholder={w.preisBis} aria-label={w.preisBis} defaultValue={fmtIn(F.pMax)} key={"pmax" + F.pMax}
          onChange={e => { clearTimeout(preisTimer.current); const v = zahl(e.target.value); preisTimer.current = setTimeout(() => geh({ pMax: v }, { ersetzen: true }), 350); }} />
      </div>
      <select className="feld" id="ziSel" aria-label={w.zimmerAb} value={F.ziMin != null ? String(F.ziMin) : ""} onChange={e => geh({ ziMin: e.target.value ? Number(e.target.value) : null })}>
        <option value="">{w.zimmerAb}</option>{["1.5", "2.5", "3.5", "4.5", "5.5"].map(z => <option key={z} value={z}>{z}+</option>)}
      </select>
      <button className="nurfw" id="nurFW" aria-pressed={F.quelle === "fourwalls"} onClick={() => geh({ quelle: F.quelle === "fourwalls" ? "" : "fourwalls" })}><i></i><span>{w.nurFourwalls}</span></button>
      <div className="mehrfilter">
        <button className="knopf mfilter" id="mFilterAuf" onClick={() => { setEntwurf(F); setOffen(o => !o); }}><span>{w.filter}</span> <span className="zaehl" id="filterZahlM">{aktiv}</span></button>
        <button className="knopf" id="filterAuf" onClick={() => { setEntwurf(F); setOffen(o => !o); }}><span>{w.mehrFilter}</span> <span className="zaehl" id="filterZahl">{aktiv}</span></button>
        <div className={`filterfeld${offen ? " an" : ""}`} id="filterFeld" role="dialog" aria-label={w.mehrFilter}>
          <h4>{w.preisChf}</h4>
          <div className="fzwei"><input className="feld" type="number" id="fPMin" placeholder="von" min={0} step={10000} value={E.pMin ?? ""} onChange={e => set({ pMin: e.target.value ? Number(e.target.value) : null })} /><input className="feld" type="number" id="fPMax" placeholder="bis" min={0} step={10000} value={E.pMax ?? ""} onChange={e => set({ pMax: e.target.value ? Number(e.target.value) : null })} /></div>
          <h4>{w.flaecheFilter}</h4>
          <div className="fzwei"><input className="feld" type="number" id="fFl" placeholder="von" min={0} step={10} value={E.flMin ?? ""} onChange={e => set({ flMin: e.target.value ? Number(e.target.value) : null })} /><input className="feld" type="number" id="fFlMax" placeholder="bis" min={0} step={10} value={E.flMax ?? ""} onChange={e => set({ flMax: e.target.value ? Number(e.target.value) : null })} /></div>
          <h4>{w.zimmerFilter}</h4>
          <div className="fzwei">
            <select className="feld" id="fZiMin" aria-label="Zimmer von" value={E.ziMin != null ? String(E.ziMin) : ""} onChange={e => set({ ziMin: e.target.value ? Number(e.target.value) : null })}>{zi.map(z => <option key={z} value={z}>{z ? z + "+" : w.zimmerAb}</option>)}</select>
            <select className="feld" id="fZiMax" aria-label="Zimmer bis" value={E.ziMax != null ? String(E.ziMax) : ""} onChange={e => set({ ziMax: e.target.value ? Number(e.target.value) : null })}>{zi.map(z => <option key={z} value={z}>{z ? "≤ " + z : w.zimmerBis}</option>)}</select>
          </div>
          <div id="fGrundBox" hidden={!hatGrundstueck(E.typ)}><h4>{w.grundFilter}</h4><input className="feld" type="number" id="fGr" placeholder="z.B. 500" min={0} step={50} value={E.grMin ?? ""} onChange={e => set({ grMin: e.target.value ? Number(e.target.value) : null })} /></div>
          <h4>{w.baujahr}</h4>
          <div className="fzwei"><input className="feld" type="number" id="fBjV" placeholder="von" min={1800} max={2030} value={E.bjVon ?? ""} onChange={e => set({ bjVon: e.target.value ? Number(e.target.value) : null })} /><input className="feld" type="number" id="fBjB" placeholder="bis" min={1800} max={2030} value={E.bjBis ?? ""} onChange={e => set({ bjBis: e.target.value ? Number(e.target.value) : null })} /></div>
          <div id="fEtageBox" hidden={!!E.typ && !hatEtage(E.typ)}><h4>{w.etage}</h4><div className="chipwahl" id="fEtage">{(["eg", "nichteg", "ab2", "dach"] as Etage[]).map(v => <button key={v} data-et={v} aria-pressed={E.etage === v} onClick={() => set({ etage: E.etage === v ? "" : v })}>{w[{ eg: "eg", nichteg: "nichtEg", ab2: "ab2", dach: "dachgeschoss" }[v as "eg"]]}</button>)}</div></div>
          <h4>{w.verfuegbar}</h4><div className="chipwahl" id="fVerf">{(["sofort", "3mt"] as Verf[]).map(v => <button key={v} data-vf={v} aria-pressed={E.verf === v} onClick={() => set({ verf: E.verf === v ? "" : v })}>{v === "sofort" ? w.sofort : w.in3Mt}</button>)}</div>
          <h4>{w.anbieter}</h4><div className="chipwahl" id="fQuelle">{QUELLEN.map(k => <button key={k} data-q={k} aria-pressed={E.quelle === k} onClick={() => set({ quelle: E.quelle === k ? "" : k as Quelle })}>{quelleFilterLabel(w, k)}</button>)}</div>
          <h4>{w.ausstattung}</h4><div className="chipwahl" id="fFeat">{FEATURES.map(f => <button key={f} data-f={f} aria-pressed={E.feat.includes(f)} onClick={() => set({ feat: E.feat.includes(f) ? E.feat.filter(x => x !== f) : [...E.feat, f as Feature] })}>{featLabel(w, f)}</button>)}</div>
          <label className="fschalter"><input type="checkbox" id="fAlle" checked={!E.nurFrei} onChange={e => set({ nurFrei: !e.target.checked })} /> <span>{w.statusZeigen}</span></label>
          <div className="aktionen">
            <button className="knopf" id="filterReset" onClick={() => { const r = { ...LEER, trans: F.trans, ort: F.ort, sort: F.sort }; setEntwurf(r); setOffen(false); geh(r); }}>{w.zuruecksetzen}</button>
            <button className="knopf voll" id="filterAnwenden" onClick={() => { setOffen(false); geh(E); }}><span>{w.anwenden}</span> · <span id="filterTreffer">{vorschau ?? total}</span> <span>{w.treffer}</span></button>
          </div>
        </div>
      </div>
      {seiteVon && <span hidden data-seite-von={seiteVon}></span>}
    </div>
  );
}
