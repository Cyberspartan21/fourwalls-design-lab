"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n";
import type { Entwurf } from "@/domain/entwurf";

/* Der Ortsschritt — strukturiert, nicht als freier Text (§28).

   Die Person sucht im selben Ortsindex, den auch die Suche benutzt; gespeichert
   wird die Kennung (`ort-winterthur`), nicht der getippte Name. Nur so findet
   das Inserat später eine Umkreissuche.

   Strasse und Nummer bleiben privat und unbestätigt: es gibt keinen
   Adressdienst, der sie prüfen könnte. Darum steht die Wahl «genaue Lage
   veröffentlichen» in P5.4 nicht zur Verfügung — wir würden Genauigkeit
   behaupten, die wir nicht haben (§29/§30). */

interface Vorschlag { typ: string; id: string; label: string; sub: string }

export function OrtFeld({ daten, aendern, t, locale, fehlt }:
  { daten: Entwurf; aendern: (t: Partial<Entwurf>) => void; t: Record<string, string>; locale: Locale; fehlt: boolean }) {
  const [text, setText] = useState("");
  const [gewaehlt, setGewaehlt] = useState<Vorschlag | null>(null);
  const [liste, setListe] = useState<Vorschlag[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /* Bereits gewählten Ort beim Öffnen anzeigen. */
  useEffect(() => {
    if (!daten.ortId || gewaehlt) return;
    let weg = false;
    fetch(`/api/orte?q=${encodeURIComponent(daten.ortId.replace(/^ort-/, ""))}&locale=${locale}`)
      .then(r => r.json())
      .then((v: Vorschlag[]) => { if (!weg) { const g = v.find(x => x.id === daten.ortId); if (g) { setGewaehlt(g); setText(g.label); } } })
      .catch(() => { /* ohne Vorschau weiter */ });
    return () => { weg = true; };
  }, [daten.ortId, gewaehlt, locale]);

  function suchen(v: string) {
    setText(v); clearTimeout(timer.current);
    if (!v.trim()) { setListe([]); return; }
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/orte?q=${encodeURIComponent(v)}&locale=${locale}`);
        const alle: Vorschlag[] = await r.json();
        /* Nur Gemeinden: ein Inserat liegt an einem Ort, nicht in einem Kanton. */
        setListe(alle.filter(x => x.typ === "ort" || x.typ === "plz").slice(0, 8));
      } catch { setListe([]); }
    }, 160);
  }

  return (
    <>
      <div className="fld ortfeld" style={{ position: "relative" }}>
        <label htmlFor="wOrt">{t.w_ortLabel}</label>
        <input className="feld" id="wOrt" type="text" autoComplete="off" value={text} style={{ width: "100%" }}
          onChange={e => suchen(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && liste[0]) { e.preventDefault(); waehle(liste[0]); } }}
          aria-describedby="wOrtStatus" />
        {liste.length > 0 && (
          <div className="vorschlaege an" style={{ position: "absolute", left: 0, right: 0, zIndex: 60 }}>
            {liste.map(v => (
              <button key={v.id} type="button" onClick={() => waehle(v)}>
                <span>{v.label}</span><small>{v.sub}</small>
              </button>
            ))}
          </div>
        )}
        <p className="hin" id="wOrtStatus" style={{ color: gewaehlt ? "var(--licht)" : "var(--leise)", fontSize: ".8rem", marginTop: 6 }}>
          {gewaehlt ? `${t.w_erkannt} ${gewaehlt.label} · ${gewaehlt.sub}` : t.w_ortSuchen}
        </p>
        {fehlt && <p className="fehler" role="alert">{t.w_ortFehler}</p>}
      </div>

      <div className="fld" style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 10 }}>
        <div>
          <label htmlFor="wStrasse">{t.w_strasse}</label>
          <input className="feld" id="wStrasse" type="text" value={daten.strasse ?? ""} style={{ width: "100%" }}
            onChange={e => aendern({ strasse: e.target.value })} />
        </div>
        <div>
          <label htmlFor="wNr">{t.w_hausnummer}</label>
          <input className="feld" id="wNr" type="text" value={daten.hausnummer ?? ""} style={{ width: "100%" }}
            onChange={e => aendern({ hausnummer: e.target.value })} />
        </div>
      </div>
      <p className="hin" style={{ color: "var(--leise)", fontSize: ".8rem", marginTop: -6 }}>{t.w_strassePrivat}</p>

      <div className="fld" style={{ marginTop: 22 }}>
        <label>{t.w_lageFrage}</label>
        <div className="grosswahl">
          <button type="button" aria-pressed={daten.genauigkeit === "ungefaehr"} onClick={() => aendern({ genauigkeit: "ungefaehr" })}>
            <b>{t.w_lageUngefaehr}</b><span>{t.w_lageUngefaehrHin}</span>
          </button>
          <button type="button" aria-pressed={daten.genauigkeit === "gemeinde"} onClick={() => aendern({ genauigkeit: "gemeinde" })}>
            <b>{t.w_lageGemeinde}</b><span>{t.w_lageGemeindeHin}</span>
          </button>
        </div>
        <p className="hin" style={{ color: "var(--leise)", fontSize: ".8rem", marginTop: 8 }}>{t.w_exaktGesperrt}</p>
      </div>
    </>
  );

  function waehle(v: Vorschlag) {
    setGewaehlt(v); setText(v.label); setListe([]);
    /* Postleitzahl-Treffer zeigen auf eine Gemeinde; gespeichert wird die
       Gemeindekennung, weil daran die Suche hängt. */
    const ortId = v.typ === "ort" ? v.id : null;
    if (ortId) aendern({ ortId });
  }
}
