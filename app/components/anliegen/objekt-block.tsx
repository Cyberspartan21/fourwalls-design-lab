"use client";
import { useRef, useState } from "react";
import type { Locale } from "@/i18n";
import { TYPEN } from "@/domain/marktplatz";
import { OHNE_ZIMMER, OHNE_WOHNFLAECHE } from "@/domain/entwurf";
import type { Dienst, ObjektDaten, Zustand } from "./typen";
import { ZUSTAENDE, typPflichtig } from "./typen";

/* Objektschritt — Ortssuche (dieselbe Such-/Vorschlagslogik wie
   components/inserieren/ortfeld.tsx: derselbe Endpunkt, dieselbe
   Entprellung, dieselbe Beschränkung auf Gemeinden/PLZ), Objektart als
   Grosswahl und ein aufklappbarer «Mehr Angaben»-Bereich.

   Bewusst OHNE die Strasse/Hausnummer/Genauigkeits-Felder aus ortfeld.tsx:
   ein Anliegen ist kein Inserat, es gibt nichts zu veröffentlichen, und der
   Vertrag (domain/anliegen.ts) kennt nur `ortId`. Die Such-Erfahrung selbst
   ist identisch übernommen. */

interface Vorschlag { typ: string; id: string; label: string; sub: string }

export function ObjektBlock({ dienst, objekt, aendern, t, locale, fehlt }:
  { dienst: Dienst; objekt: ObjektDaten; aendern: (t: Partial<ObjektDaten>) => void; t: Record<string, string>;
    locale: Locale; fehlt: (feld: string) => boolean }) {
  const [text, setText] = useState(objekt.ortLabel);
  const [liste, setListe] = useState<Vorschlag[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const typ = objekt.typ;
  const ohneZimmer = !typ || OHNE_ZIMMER.includes(typ);
  const ohneFlaeche = !!typ && OHNE_WOHNFLAECHE.includes(typ);

  function suchen(v: string) {
    setText(v); clearTimeout(timer.current);
    if (!v.trim()) { setListe([]); return; }
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/orte?q=${encodeURIComponent(v)}&locale=${locale}`);
        const alle: Vorschlag[] = await r.json();
        setListe(alle.filter(x => x.typ === "ort" || x.typ === "plz").slice(0, 8));
      } catch { setListe([]); }
    }, 160);
  }

  function waehle(v: Vorschlag) {
    setText(v.label); setListe([]);
    /* Anders als beim Inserat (Ortssuche) erlaubt der Anliegen-Vertrag
       Gemeinde ODER Postleitzahl als Kennung (domain/anliegen.ts ObjektSchema:
       /^(ort|plz)-…/) — eine Postleitzahl ist für ein erstes Gespräch präzise
       genug, ohne dass daran (wie bei einem Inserat) eine Umkreissuche hinge. */
    aendern({ ortId: v.id, ortLabel: v.label });
  }

  return (
    <>
      <div className="fld ortfeld" style={{ position: "relative" }}>
        <label htmlFor="al-ort">{t.w_ortLabel}</label>
        <input className="feld" id="al-ort" type="text" autoComplete="off" value={text} style={{ width: "100%" }}
          onChange={e => suchen(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && liste[0]) { e.preventDefault(); waehle(liste[0]); } }}
          aria-invalid={fehlt("ortId") || undefined}
          aria-describedby={fehlt("ortId") ? "al-ort-status al-ort-fehler" : "al-ort-status"} />
        {liste.length > 0 && (
          <div className="vorschlaege an" style={{ position: "absolute", left: 0, right: 0, zIndex: 60 }}>
            {liste.map(v => (
              <button key={v.id} type="button" onClick={() => waehle(v)}>
                <span>{v.label}</span><small>{v.sub}</small>
              </button>
            ))}
          </div>
        )}
        <p className="hin" id="al-ort-status" style={{ color: objekt.ortId ? "var(--licht)" : "var(--leise)", fontSize: ".8rem", marginTop: 6 }}>
          {objekt.ortId ? `${t.w_erkannt} ${objekt.ortLabel}` : t.w_ortSuchen}
        </p>
        {fehlt("ortId") && <p className="fehler" role="alert" id="al-ort-fehler">{t.w_ortFehler}</p>}
      </div>

      <div className="fld" id="al-typ" style={{ marginTop: 22 }}>
        <label id="al-typ-label">{t.w_typ}</label>
        <div className="grosswahl dreier" role="group" aria-labelledby="al-typ-label"
          aria-describedby={typPflichtig(dienst) && fehlt("typ") ? "al-typ-fehler" : undefined}>
          {TYPEN.map(k => (
            <button key={k} type="button" aria-pressed={objekt.typ === k} onClick={() => aendern({ typ: k })}>
              <b style={{ fontFamily: "var(--t)", fontSize: ".95rem" }}>{t["w_typ_" + k]}</b>
            </button>
          ))}
        </div>
        {typPflichtig(dienst) && fehlt("typ") && <p className="fehler" role="alert" id="al-typ-fehler">{t.al_typFehler}</p>}
      </div>

      <details className="fld" style={{ marginTop: 22 }}>
        <summary style={{ cursor: "pointer", fontSize: ".85rem", color: "var(--leise)" }}>{t.al_mehrAngaben}</summary>
        <div style={{ marginTop: 16 }}>
          {!ohneZimmer && (
            <div className="fld">
              <label htmlFor="al-zimmer">{t.w_zimmer}</label>
              <select className="feld" id="al-zimmer" value={objekt.zimmer} onChange={e => aendern({ zimmer: e.target.value })} style={{ width: "100%" }}>
                <option value="">—</option>
                {["1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5", "5.5", "6", "6.5", "7", "7.5", "8"].map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          )}
          {!ohneFlaeche && (
            <div className="fld">
              <label htmlFor="al-flaeche">{t.w_wohnflaeche}</label>
              <input className="feld" id="al-flaeche" type="number" inputMode="numeric" min={8}
                value={objekt.flaeche} onChange={e => aendern({ flaeche: e.target.value })} style={{ width: "100%" }} />
            </div>
          )}
          {typ !== "wohnung" && typ !== "parkplatz" && (
            <div className="fld">
              <label htmlFor="al-grundstueck">{t.w_grundstueck}</label>
              <input className="feld" id="al-grundstueck" type="number" inputMode="numeric" min={1}
                value={objekt.grundstueck} onChange={e => aendern({ grundstueck: e.target.value })} style={{ width: "100%" }} />
            </div>
          )}
          <div className="fld">
            <label htmlFor="al-baujahr">{t.w_baujahr}</label>
            <input className="feld" id="al-baujahr" type="number" inputMode="numeric" min={1000} max={2100}
              value={objekt.baujahr} onChange={e => aendern({ baujahr: e.target.value })} style={{ width: "100%" }} />
          </div>
          <div className="fld" id="al-zustand">
            <label>{t.al_zustandLabel}</label>
            <div className="chipwahl">
              {ZUSTAENDE.map(z => (
                <button key={z} type="button" aria-pressed={objekt.zustand === z}
                  onClick={() => aendern({ zustand: objekt.zustand === z ? "" : (z as Zustand) })}>
                  {t["al_zustand_" + z]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </details>

      {dienst === "valuation" && (
        <div className="fld" id="al-nachricht" style={{ marginTop: 22 }}>
          <label htmlFor="al-valuation-nachricht">{t.al_valuationNachrichtLabel}</label>
          <textarea className="feld" id="al-valuation-nachricht" maxLength={2000}
            value={objekt.nachricht} onChange={e => aendern({ nachricht: e.target.value })} style={{ width: "100%", minHeight: 100 }} />
          <p className="hin" style={{ color: "var(--leise)", fontSize: ".78rem", marginTop: 6 }}>{t.al_valuationNachrichtHin}</p>
        </div>
      )}
    </>
  );
}
