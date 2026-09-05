import type { Dienst, ObjektDaten, Zeitpunkt, Belegung, Leistung } from "./typen";
import { ZEITPUNKTE, BELEGUNGEN, LEISTUNGEN_LET, LEISTUNGEN_PM } from "./typen";

/* Situationsschritt — der Inhalt hängt vom Dienst ab, nicht nur die
   Beschriftung:

   sell     Zeitpunkt, Belegung, bereits inseriert? (mit optionaler Angabe wo),
            anderer Makler?
   let      Mietbeginn (=Zeitpunkt), Belegung, gewünschte Leistungen
            (tenant_search|full_management|advice)
   property_management  Einheiten, Belegung, gewünschte Leistungen
            (full_management|accounting|maintenance|advice), Übergabe (=Zeitpunkt)
   valuation  hat keinen eigenen Schritt — nur die Nachricht dazu lebt im
            Objekt-Schritt (objekt-block.tsx), weil der Vertrag hierfür kein
            eigenes Feld über den Zustand hinaus vorsieht.
   owner_consultation  nur eine Nachricht — gerendert im Kontakt-Schritt. */

export function SituationBlock({ dienst, objekt, aendern, t }:
  { dienst: Dienst; objekt: ObjektDaten; aendern: (t: Partial<ObjektDaten>) => void; t: Record<string, string> }) {
  if (dienst === "owner_consultation") return (
    <div className="fld" id="al-nachricht">
      <label htmlFor="al-owner-nachricht">{t.al_nachrichtLabel}</label>
      <textarea className="feld" id="al-owner-nachricht" maxLength={2000}
        value={objekt.nachricht} onChange={e => aendern({ nachricht: e.target.value })} style={{ width: "100%", minHeight: 140 }} />
      <p className="hin" style={{ color: "var(--leise)", fontSize: ".78rem", marginTop: 6 }}>{t.al_nachrichtHin}</p>
    </div>
  );

  const zeitpunktLabel = dienst === "sell" ? t.al_zeitpunktLabel_sell : dienst === "let" ? t.al_zeitpunktLabel_let : t.al_zeitpunktLabel_pm;
  const leistungen = dienst === "let" ? LEISTUNGEN_LET : dienst === "property_management" ? LEISTUNGEN_PM : [];

  function leistungUmschalten(l: Leistung) {
    aendern({ leistungen: objekt.leistungen.includes(l) ? objekt.leistungen.filter(x => x !== l) : [...objekt.leistungen, l] });
  }

  return (
    <>
      {dienst === "property_management" && (
        <div className="fld" id="al-einheiten">
          <label htmlFor="al-einheiten-feld">{t.al_einheitenLabel}</label>
          <input className="feld" id="al-einheiten-feld" type="number" inputMode="numeric" min={1}
            value={objekt.einheiten} onChange={e => aendern({ einheiten: e.target.value })} style={{ width: "100%" }} />
        </div>
      )}

      <div className="fld" id="al-zeitpunkt">
        <label>{zeitpunktLabel}</label>
        <div className="chipwahl">
          {ZEITPUNKTE.map(z => (
            <button key={z} type="button" aria-pressed={objekt.zeitpunkt === z}
              onClick={() => aendern({ zeitpunkt: objekt.zeitpunkt === z ? "" : (z as Zeitpunkt) })}>
              {t["al_zeitpunkt_" + z]}
            </button>
          ))}
        </div>
      </div>

      <div className="fld" id="al-belegung" style={{ marginTop: 22 }}>
        <label>{t.al_belegungLabel}</label>
        <div className="chipwahl">
          {BELEGUNGEN.map(b => (
            <button key={b} type="button" aria-pressed={objekt.belegung === b}
              onClick={() => aendern({ belegung: objekt.belegung === b ? "" : (b as Belegung) })}>
              {t["al_belegung_" + b]}
            </button>
          ))}
        </div>
      </div>

      {dienst === "sell" && (
        <>
          <div className="fld" id="al-bereits-inseriert" style={{ marginTop: 22 }}>
            <label>{t.al_bereitsInseriertLabel}</label>
            <div className="chipwahl">
              <button type="button" aria-pressed={objekt.bereitsInseriert === true} onClick={() => aendern({ bereitsInseriert: objekt.bereitsInseriert === true ? null : true })}>{t.al_ja}</button>
              <button type="button" aria-pressed={objekt.bereitsInseriert === false} onClick={() => aendern({ bereitsInseriert: objekt.bereitsInseriert === false ? null : false, inseratRef: "" })}>{t.al_nein}</button>
            </div>
            {objekt.bereitsInseriert === true && (
              <>
                <input className="feld" id="al-inseratref" type="text" maxLength={20} style={{ width: "100%", marginTop: 10 }}
                  placeholder="FWL-2026-000000" aria-label={t.al_inseratRefLabel}
                  value={objekt.inseratRef} onChange={e => aendern({ inseratRef: e.target.value.toUpperCase() })} />
                <p className="hin" style={{ color: "var(--leise)", fontSize: ".78rem", marginTop: 6 }}>{t.al_inseratRefHin}</p>
              </>
            )}
          </div>

          <div className="fld" id="al-anderer-makler" style={{ marginTop: 22 }}>
            <label>{t.al_andererMaklerLabel}</label>
            <div className="chipwahl">
              <button type="button" aria-pressed={objekt.andererMakler === true} onClick={() => aendern({ andererMakler: objekt.andererMakler === true ? null : true })}>{t.al_ja}</button>
              <button type="button" aria-pressed={objekt.andererMakler === false} onClick={() => aendern({ andererMakler: objekt.andererMakler === false ? null : false })}>{t.al_nein}</button>
            </div>
          </div>
        </>
      )}

      {leistungen.length > 0 && (
        <div className="fld" id="al-leistungen" style={{ marginTop: 22 }}>
          <label>{t.al_leistungenLabel}</label>
          <div className="chipwahl">
            {leistungen.map(l => (
              <button key={l} type="button" aria-pressed={objekt.leistungen.includes(l)} onClick={() => leistungUmschalten(l)}>
                {t["al_leistung_" + l]}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
