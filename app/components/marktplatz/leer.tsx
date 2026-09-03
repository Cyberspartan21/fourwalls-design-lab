import type { Suchanfrage } from "@/domain/marktplatz";
import { paramsAusAnfrage } from "@/domain/suchurl";
import { chfText, trefferLabel, typLabel, type Woerter } from "./labels";

/* Nullzustand — wie malLeer() im Prototyp: die Seite kennt die aktiven
   Filter und bietet Wege mit echten Trefferzahlen an. Die Zahlen rechnet der
   Server (Abschnitt «Wege» in page.tsx) über dieselbe Suche; nichts wird
   stillschweigend geändert — jeder Weg ist ein Link mit sichtbarer Anfrage. */
export interface Weg { label: string; q: Partial<Suchanfrage> }

export function wegeBauen(q: Suchanfrage, w: Woerter, ort: { typ: string; label: string; kt?: string | undefined } | null, zahlen: { umkreis: [number, number] | null; budget: [number, number] | null; zimmer: number | null; flaeche: number | null; baujahr: number | null; typ: number | null; feat: number | null; etageVerf: number | null; kanton: [string, string, number] | null; alles: number }): Weg[] {
  const wege: Weg[] = [];
  if (zahlen.umkreis) wege.push({ label: `${w.radiusMehr} · +${zahlen.umkreis[0]} ${w.km} · ${trefferLabel(w, zahlen.umkreis[1])}`, q: { umkreisKm: zahlen.umkreis[0] } });
  if (zahlen.budget) wege.push({ label: `${w.budgetMehr} · ≤ ${chfText(zahlen.budget[0])} · ${trefferLabel(w, zahlen.budget[1])}`, q: { pMax: zahlen.budget[0] } });
  if (zahlen.zimmer != null && q.ziMin != null) wege.push({ label: `${q.ziMin - 1}+ Zi. · ${trefferLabel(w, zahlen.zimmer)}`, q: { ziMin: Math.max(1, q.ziMin - 1) } });
  if (zahlen.flaeche != null) wege.push({ label: `${w.filterWeg}: ${w.wohnflaeche} · ${trefferLabel(w, zahlen.flaeche)}`, q: { flMin: null } });
  if (zahlen.baujahr != null) wege.push({ label: `${w.filterWeg}: ${w.baujahr} · ${trefferLabel(w, zahlen.baujahr)}`, q: { bjVon: null, bjBis: null } });
  if (zahlen.typ != null && q.typ) wege.push({ label: `${w.filterWeg}: ${typLabel(w, q.typ)} · ${trefferLabel(w, zahlen.typ)}`, q: { typ: "" } });
  if (zahlen.feat != null) wege.push({ label: `${w.filterWeg}: ${w.ausstattung} · ${trefferLabel(w, zahlen.feat)}`, q: { feat: [] } });
  if (zahlen.etageVerf != null) wege.push({ label: `${w.filterWeg}: ${q.etage ? w.etage : w.verfuegbar} · ${trefferLabel(w, zahlen.etageVerf)}`, q: { etage: "", verf: "" } });
  if (zahlen.kanton) wege.push({ label: `${zahlen.kanton[1]} · ${trefferLabel(w, zahlen.kanton[2])}`, q: { ort: zahlen.kanton[0], umkreisKm: 0 } });
  wege.push({ label: `${w.zuruecksetzen} · ${trefferLabel(w, zahlen.alles)}`, q: { ort: null, umkreisKm: 0, typ: "", pMin: null, pMax: null, ziMin: null, ziMax: null, flMin: null, flMax: null, grMin: null, bjVon: null, bjBis: null, etage: "", verf: "", nurFrei: true, feat: [], quelle: "" } });
  void ort;
  return wege.slice(0, 4);
}

export function Leer({ q, wege, w, basis }: { q: Suchanfrage; wege: Weg[]; w: Woerter; basis: string }) {
  return (
    <div className="leer an" id="leer">
      <span className="mark"></span><h2>{w.p_leerH2}</h2>
      <p id="leerText">{w.keineTreffer}</p>
      <div className="vorschl" id="leerWege">
        {wege.map((x, i) => { const p = paramsAusAnfrage({ ...q, ...x.q, seite: 1, bounds: null }); return <a key={i} className="knopf" data-weg={i} href={basis + (p.toString() ? "?" + p.toString() : "")}>{x.label}</a>; })}
      </div>
      <div className="vorschl" style={{ marginTop: 10 }}><a className="knopf voll" id="leerAbo" href="#abo">{w.suchaboSpeichern}</a></div>
    </div>
  );
}
