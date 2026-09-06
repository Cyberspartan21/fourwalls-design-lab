"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n";
import { LEERER_ENTWURF, SCHRITTE, fehlend, type Entwurf, type Schritt } from "@/domain/entwurf";
import { TYPEN, FEATURES, type Typ } from "@/domain/marktplatz";
import { BildFeld } from "./bildfeld";
import { OrtFeld } from "./ortfeld";

/* Der Inserats-Assistent — neun Schritte wie in P4, unterlegt mit echtem
   Server-Zustand.

   Drei Eigenschaften, die zählen:

   1. AUTOSAVE. Nach kurzer Ruhe (900 ms) geht der Stand an den Server. Die
      Anzeige sagt die Wahrheit: «Speichert», «Gespeichert», und bei einem
      Fehler «Nicht gespeichert» mit der Bitte, es erneut zu versuchen — nie
      «Gespeichert», wenn nichts ankam (§25/§75).
   2. NEBENLÄUFIGKEIT. Jede Antwort bringt eine neue Version. Wer in einem
      zweiten Fenster speichert, bekommt hier einen Hinweis statt eines stillen
      Überschreibens (§26).
   3. ANONYMER ANFANG. Ohne Konto laufen die ersten Schritte im Browser; beim
      ersten echten Speichern führt der Weg zur Anmeldung und die Eingaben
      wandern mit (§22/§23). Gehalten wird das im sessionStorage — es endet
      mit dem Fenster und enthält nur, was die Person selbst eingetippt hat. */

export type Texte = Record<string, string>;
type SpeicherZustand = "ruhe" | "speichert" | "gespeichert" | "fehler" | "konflikt";
const ENTWURF_SCHLUESSEL = "fw-entwurf-vorab";

export interface AssistentProps {
  locale: Locale;
  t: Texte;
  /* Vorhandener Entwurf vom Server — oder null für den anonymen Anfang. */
  start: { publicRef: string; version: number; daten: Entwurf; status: string; rueckmeldung: { nachricht: string; grund: string | null } | null } | null;
  anmeldenHref: string;
  kontoHref: string;
}

export function Assistent({ locale, t, start, anmeldenHref, kontoHref }: AssistentProps) {
  const router = useRouter();
  const [daten, setDaten] = useState<Entwurf>(() => start?.daten ?? vorabLesen() ?? LEERER_ENTWURF);
  const [version, setVersion] = useState(start?.version ?? 0);
  const [i, setI] = useState(0);
  const [zustand, setZustand] = useState<SpeicherZustand>("ruhe");
  const [fehlerText, setFehlerText] = useState<string | null>(null);
  const [zeigeMaengel, setZeigeMaengel] = useState(false);
  const [eingereicht, setEingereicht] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const offen = useRef(false);   // eine Speicherung zur Zeit

  const angemeldet = start !== null;
  const S = SCHRITTE[i]!;
  const maengel = fehlend(daten);
  const fehltHier = maengel.filter(m => m.schritt === S);

  /* ---------- Speichern ---------- */
  const speichern = useCallback(async (neu: Entwurf) => {
    if (!start) { vorabSchreiben(neu); return; }
    if (offen.current) return;
    offen.current = true; setZustand("speichert"); setFehlerText(null);
    try {
      const r = await fetch(`/api/entwuerfe/${start.publicRef}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ version, daten: neu })
      });
      const a = await r.json().catch(() => ({}));
      if (r.status === 409) { setZustand("konflikt"); return; }
      if (!r.ok) { setZustand("fehler"); setFehlerText(a?.message ?? t.w_speicherFehler!); return; }
      setVersion(a.version); setZustand("gespeichert");
    } catch {
      setZustand("fehler"); setFehlerText(t.w_speicherFehler!);
    } finally { offen.current = false; }
  }, [start, version, t]);

  /* Änderung übernehmen und nach kurzer Ruhe sichern. */
  const aendern = useCallback((teil: Partial<Entwurf>) => {
    setDaten(d => {
      const neu = { ...d, ...teil };
      clearTimeout(timer.current);
      timer.current = setTimeout(() => { void speichern(neu); }, 900);
      if (!start) vorabSchreiben(neu);
      return neu;
    });
  }, [speichern, start]);

  /* Beim Verlassen eines Schritts sofort sichern, nicht erst nach der Ruhezeit. */
  const jetztSichern = useCallback(async () => { clearTimeout(timer.current); await speichern(daten); }, [speichern, daten]);

  useEffect(() => () => clearTimeout(timer.current), []);

  /* ---------- Anmeldung erforderlich ---------- */
  async function weiterOhneKonto() {
    vorabSchreiben(daten);
    router.push(anmeldenHref);
  }

  /* ---------- Einreichen ---------- */
  async function einreichen() {
    if (!start) return weiterOhneKonto();
    await jetztSichern();
    const r = await fetch(`/api/entwuerfe/${start.publicRef}/aktion`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ absicht: "einreichen" })
    });
    const a = await r.json().catch(() => ({}));
    if (r.ok) { setEingereicht(true); router.refresh(); return; }
    if (r.status === 422 && a?.fields) {
      /* Der Server nennt Feld und Schritt — wir springen dorthin. */
      const ersterSchritt = Object.values(a.fields)[0] as Schritt | undefined;
      const idx = ersterSchritt ? SCHRITTE.indexOf(ersterSchritt) : -1;
      setZeigeMaengel(true);
      if (idx >= 0) setI(idx);
      setFehlerText(a.message ?? null);
      return;
    }
    setFehlerText(a?.message ?? t.w_speicherFehler!);
  }

  if (eingereicht) return (
    <div className="hinweisbox" role="status">
      <b>{t.w_eingereichtTitel}</b>
      <p style={{ marginTop: 6 }}>{t.w_eingereichtText}</p>
      <a className="knopf voll" style={{ marginTop: 12 }} href={kontoHref}>{t.k_meineInserate}</a>
    </div>
  );

  return (
    <>
      {/* Fortschritt und Zustand */}
      <div className="fort" aria-hidden="true">{SCHRITTE.map((_, n) => <i key={n} className={n <= i ? "voll" : ""} />)}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span className="schrittz">{t.w_schritt} {i + 1} {t.w_von} {SCHRITTE.length}</span>
        <SpeicherAnzeige zustand={zustand} t={t} angemeldet={angemeldet} />
      </div>
      <h2>{t["w_schritt_" + S]}</h2>

      {start?.rueckmeldung && i === 0 && (
        <div className="hinweisbox" style={{ marginTop: 14 }} role="status">
          <b>{t.w_rueckmeldung}</b>
          <p style={{ marginTop: 4 }}>{start.rueckmeldung.nachricht}</p>
        </div>
      )}

      {zustand === "konflikt" && (
        <div className="hinweisbox" role="alert" style={{ marginTop: 14, borderColor: "var(--warn)" }}>
          <b>{t.w_konflikt}</b>
          <button className="knopf" style={{ marginTop: 10 }} onClick={() => location.reload()}>{t.w_neuLaden}</button>
        </div>
      )}
      {zustand === "fehler" && fehlerText && (
        <div className="hinweisbox" role="alert" style={{ marginTop: 14, borderColor: "var(--warn)" }}>
          <b>{t.w_nichtGespeichert}</b>
          <p style={{ marginTop: 4 }}>{fehlerText}</p>
          <button className="knopf" style={{ marginTop: 10 }} onClick={() => void speichern(daten)}>{t.w_speichern}</button>
        </div>
      )}

      <SchrittInhalt schritt={S} daten={daten} aendern={aendern} t={t} locale={locale}
        maengel={zeigeMaengel ? fehltHier.map(m => m.feld) : []} angemeldet={angemeldet} alleMaengel={maengel} />

      {S === "pruefen" && (
        <p className="hin" style={{ color: "var(--leise)", fontSize: ".82rem", marginTop: 18 }}>
          {t.w_inseratsbedingungenHin} <a href={`/${locale}/inseratsbedingungen`}>{t.w_inseratsbedingungenLink}</a>
        </p>
      )}

      {/* Steuerung */}
      <div style={{ display: "flex", gap: 10, marginTop: 28, alignItems: "center", flexWrap: "wrap" }}>
        <button className="knopf" style={{ visibility: i === 0 ? "hidden" : "visible" }} onClick={() => setI(n => Math.max(0, n - 1))}>{t.w_zurueck}</button>
        {S === "pruefen" ? (
          <button className="knopf voll gross" onClick={einreichen} disabled={!angemeldet && true}>{angemeldet ? t.w_einreichen : t.w_anmeldenNoetig}</button>
        ) : (
          <button className="knopf voll gross" onClick={async () => {
            if (!angemeldet && i >= 2) { await weiterOhneKonto(); return; }
            await jetztSichern();
            setZeigeMaengel(false);
            setI(n => Math.min(SCHRITTE.length - 1, n + 1));
          }}>{t.w_weiter}</button>
        )}
        {!angemeldet && i >= 2 && <span style={{ color: "var(--leise)", fontSize: ".82rem" }}>{t.w_anmeldenNoetigText}</span>}
      </div>
    </>
  );
}

function SpeicherAnzeige({ zustand, t, angemeldet }: { zustand: SpeicherZustand; t: Texte; angemeldet: boolean }) {
  if (!angemeldet) return <span style={{ fontSize: ".72rem", color: "var(--leise)" }}>{t.w_anmeldenNoetig}</span>;
  const [text, farbe] = zustand === "speichert" ? [t.w_speichert, "var(--leise)"]
    : zustand === "gespeichert" ? [t.w_gespeichert, "var(--leise)"]
    : zustand === "fehler" || zustand === "konflikt" ? [t.w_nichtGespeichert, "var(--warn)"]
    : ["", "var(--leise)"];
  return <span aria-live="polite" style={{ fontSize: ".72rem", letterSpacing: ".1em", textTransform: "uppercase", color: farbe }}>{text}</span>;
}

/* ---------- Die neun Schritte ---------- */
function SchrittInhalt({ schritt, daten, aendern, t, locale, maengel, angemeldet, alleMaengel }:
  { schritt: Schritt; daten: Entwurf; aendern: (t: Partial<Entwurf>) => void; t: Texte; locale: Locale;
    maengel: string[]; angemeldet: boolean; alleMaengel: { feld: string; schritt: Schritt }[] }) {
  const fehlt = (f: string) => maengel.includes(f);
  const miete = daten.trans === "rent";
  const typ = daten.typ as Typ | null;
  const ohneZimmer = !typ || ["grundstueck", "parkplatz", "gewerbe", "mfh"].includes(typ);
  const ohneFlaeche = typ === "grundstueck" || typ === "parkplatz";
  const mitEtage = typ === "wohnung" || typ === "gewerbe";

  if (schritt === "absicht") return (
    <div className="fld">
      <div className="grosswahl">
        {(["sale", "rent"] as const).map(v => (
          <button key={v} aria-pressed={daten.trans === v} onClick={() => aendern({ trans: v })}>
            <b>{v === "sale" ? t.w_verkaufen : t.w_vermieten}</b><span>{v === "sale" ? t.w_verkaufenHin : t.w_vermietenHin}</span>
          </button>
        ))}
      </div>
      {fehlt("trans") && <p className="fehler" role="alert">{t.w_bitteWaehlen}</p>}
    </div>
  );

  if (schritt === "typ") return (
    <div className="fld">
      <div className="grosswahl dreier">
        {TYPEN.map(k => (
          <button key={k} aria-pressed={daten.typ === k} onClick={() => aendern({ typ: k })}>
            <b style={{ fontFamily: "var(--t)", fontSize: ".95rem" }}>{t["w_typ_" + k]}</b>
          </button>
        ))}
      </div>
      {fehlt("typ") && <p className="fehler" role="alert">{t.w_bitteWaehlen}</p>}
    </div>
  );

  if (schritt === "ort") return (
    <OrtFeld daten={daten} aendern={aendern} t={t} locale={locale} fehlt={fehlt("ortId")} />
  );

  if (schritt === "fakten") return (
    <>
      {!ohneZimmer && (
        <div className="fld">
          <label htmlFor="fZi">{t.w_zimmer}</label>
          <select className="feld" id="fZi" value={daten.zimmer ?? ""} onChange={e => aendern({ zimmer: e.target.value ? Number(e.target.value) : null })} style={{ width: "100%" }}>
            <option value="">—</option>
            {["1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5", "5.5", "6", "6.5", "7", "7.5", "8"].map(z => <option key={z} value={z}>{z}</option>)}
          </select>
          {fehlt("zimmer") && <p className="fehler" role="alert">{t.w_bitteAngeben}</p>}
        </div>
      )}
      {!ohneFlaeche && (
        <div className="fld">
          <label htmlFor="fFl">{t.w_wohnflaeche}</label>
          <input className="feld" id="fFl" type="number" inputMode="numeric" min={8} value={daten.flaeche ?? ""} onChange={e => aendern({ flaeche: e.target.value ? Number(e.target.value) : null })} style={{ width: "100%" }} />
          {fehlt("flaeche") && <p className="fehler" role="alert">{t.w_flaecheFehler}</p>}
        </div>
      )}
      {typ !== "wohnung" && typ !== "parkplatz" && (
        <div className="fld">
          <label htmlFor="fGr">{t.w_grundstueck}</label>
          <input className="feld" id="fGr" type="number" inputMode="numeric" min={1} value={daten.grundstueck ?? ""} onChange={e => aendern({ grundstueck: e.target.value ? Number(e.target.value) : null })} style={{ width: "100%" }} />
          {fehlt("grundstueck") && <p className="fehler" role="alert">{t.w_bitteAngeben}</p>}
        </div>
      )}
      <div className="fld">
        <label htmlFor="fBj">{t.w_baujahr}</label>
        <input className="feld" id="fBj" type="number" inputMode="numeric" min={1000} max={2100} value={daten.baujahr ?? ""} onChange={e => aendern({ baujahr: e.target.value ? Number(e.target.value) : null })} style={{ width: "100%" }} />
      </div>
      {mitEtage && (
        <div className="fld">
          <label htmlFor="fEt">{t.w_etage}</label>
          <input className="feld" id="fEt" type="number" inputMode="numeric" min={-3} max={60} value={daten.etage ?? ""} onChange={e => aendern({ etage: e.target.value ? Number(e.target.value) : null })} style={{ width: "100%" }} />
        </div>
      )}
    </>
  );

  if (schritt === "preis") return (
    <>
      <div className="fld">
        <label htmlFor="fPreis">{miete ? t.w_nettomiete : t.w_kaufpreis}</label>
        <input className="feld" id="fPreis" type="number" inputMode="numeric" min={0} disabled={daten.preisAufAnfrage}
          value={daten.preis ?? ""} onChange={e => aendern({ preis: e.target.value ? Number(e.target.value) : null })} style={{ width: "100%" }} />
        {fehlt("preis") && <p className="fehler" role="alert">{t.w_preisFehler}</p>}
      </div>
      <label className="fschalter" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <input type="checkbox" checked={daten.preisAufAnfrage} onChange={e => aendern({ preisAufAnfrage: e.target.checked })} />
        <span>{t.w_aufAnfrage}</span>
      </label>
      {miete && (
        <div className="fld">
          <label htmlFor="fNk">{t.w_nebenkosten}</label>
          <input className="feld" id="fNk" type="number" inputMode="numeric" min={0} value={daten.nebenkosten ?? ""} onChange={e => aendern({ nebenkosten: e.target.value ? Number(e.target.value) : null })} style={{ width: "100%" }} />
        </div>
      )}
      <div className="fld">
        <label>{t.verfuegbar}</label>
        <label className="fschalter" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={daten.sofortVerfuegbar} onChange={e => aendern({ sofortVerfuegbar: e.target.checked, verfuegbarAb: e.target.checked ? null : daten.verfuegbarAb })} />
          <span>{t.sofort}</span>
        </label>
        {!daten.sofortVerfuegbar && (
          <input className="feld" type="date" value={daten.verfuegbarAb ?? ""} onChange={e => aendern({ verfuegbarAb: e.target.value || null })} style={{ width: "100%", marginTop: 8 }} aria-label={t.abDatum!} />
        )}
      </div>
    </>
  );

  if (schritt === "text") return (
    <>
      <div className="fld">
        <label htmlFor="fTitel">{t.w_titel}</label>
        <input className="feld" id="fTitel" type="text" maxLength={70} value={daten.titel ?? ""} onChange={e => aendern({ titel: e.target.value })} style={{ width: "100%" }} />
        {fehlt("titel") && <p className="fehler" role="alert">{t.w_titelFehler}</p>}
      </div>
      <div className="fld">
        <label htmlFor="fBesch">{t.w_beschreibung}</label>
        <textarea className="feld" id="fBesch" maxLength={4000} value={daten.beschreibung ?? ""} onChange={e => aendern({ beschreibung: e.target.value })} style={{ width: "100%", minHeight: 140 }} />
        {fehlt("beschreibung") && <p className="fehler" role="alert">{t.w_beschreibungFehler}</p>}
      </div>
      <div className="fld">
        <label htmlFor="fSprache">{t.w_sprache}</label>
        <select className="feld" id="fSprache" value={daten.sprache} onChange={e => aendern({ sprache: e.target.value as Locale })} style={{ width: "100%" }}>
          <option value="de">Deutsch</option><option value="fr">Français</option><option value="it">Italiano</option><option value="en">English</option>
        </select>
        <p className="hin" style={{ color: "var(--leise)", fontSize: ".78rem", marginTop: 6 }}>{t.w_spracheHin}</p>
      </div>
    </>
  );

  if (schritt === "bilder") return (
    <>
      <BildFeld daten={daten} aendern={aendern} t={t} angemeldet={angemeldet} fehlt={fehlt("bilder")} />
      <div className="fld" style={{ marginTop: 24 }}>
        <label>{t.ausstattung}</label>
        <div className="chipwahl">
          {FEATURES.map(f => (
            <button key={f} aria-pressed={daten.merkmale.includes(f)}
              onClick={() => aendern({ merkmale: daten.merkmale.includes(f) ? daten.merkmale.filter(x => x !== f) : [...daten.merkmale, f] })}>
              {t["feat_" + f] ?? f}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  if (schritt === "kontakt") return (
    <>
      <div className="fld">
        <label htmlFor="fName">{t.w_name}</label>
        <input className="feld" id="fName" type="text" autoComplete="name" value={daten.name ?? ""} onChange={e => aendern({ name: e.target.value })} style={{ width: "100%" }} />
        {fehlt("name") && <p className="fehler" role="alert">{t.w_bitteAngeben}</p>}
      </div>
      <div className="fld">
        <label htmlFor="fEmail">{t.k_email}</label>
        <input className="feld" id="fEmail" type="email" autoComplete="email" value={daten.email ?? ""} onChange={e => aendern({ email: e.target.value })} style={{ width: "100%" }} />
        {fehlt("email") && <p className="fehler" role="alert">{t.w_emailFehler}</p>}
      </div>
      <div className="fld">
        <label htmlFor="fTel">{t.w_telefon}</label>
        <input className="feld" id="fTel" type="tel" autoComplete="tel" value={daten.telefon ?? ""} onChange={e => aendern({ telefon: e.target.value })} style={{ width: "100%" }} />
      </div>
      <p className="hin" style={{ color: "var(--leise)", fontSize: ".8rem", marginTop: 10 }}>{t.w_kontaktHin}</p>
    </>
  );

  /* Prüfen */
  return (
    <>
      {alleMaengel.length > 0 ? (
        <div className="hinweisbox" role="status">
          <b>{t.w_fehltNoch}</b>
          <ul style={{ margin: "8px 0 0", paddingLeft: "1.1em" }}>
            {alleMaengel.map(m => <li key={m.feld}>{t["w_feld_" + m.feld] ?? m.feld}</li>)}
          </ul>
        </div>
      ) : (
        <div className="hinweisbox" role="status"><b>{t.w_bereit}</b><p style={{ marginTop: 4 }}>{t.w_bereitText}</p></div>
      )}
      <dl className="fakten" style={{ marginTop: 20 }}>
        {([["w_titel", daten.titel], ["w_typ", daten.typ ? t["w_typ_" + daten.typ] : null],
          ["w_absicht", daten.trans ? (daten.trans === "rent" ? t.w_vermieten : t.w_verkaufen) : null],
          ["w_preis", daten.preisAufAnfrage ? t.aufAnfrage : (daten.preis != null ? "CHF " + daten.preis.toLocaleString("de-CH") : null)],
          ["w_wohnflaeche", daten.flaeche ? daten.flaeche + " m²" : null],
          ["w_zimmer", daten.zimmer ?? null],
          ["w_bilderZahl", daten.bilder.length || null]] as [string, unknown][])
          .filter(([, v]) => v != null && v !== "")
          .map(([k, v]) => <div key={k}><dt>{t[k]}</dt><dd>{String(v)}</dd></div>)}
      </dl>
    </>
  );
}

/* ---------- Vorab-Stand ohne Konto ---------- */
function vorabLesen(): Entwurf | null {
  if (typeof window === "undefined") return null;
  try {
    const roh = sessionStorage.getItem(ENTWURF_SCHLUESSEL);
    return roh ? { ...LEERER_ENTWURF, ...JSON.parse(roh) } : null;
  } catch { return null; }
}
function vorabSchreiben(d: Entwurf) {
  try { sessionStorage.setItem(ENTWURF_SCHLUESSEL, JSON.stringify(d)); } catch { /* privater Modus */ }
}
export function vorabLoeschen() {
  try { sessionStorage.removeItem(ENTWURF_SCHLUESSEL); } catch { /* egal */ }
}
export function vorabHolen(): Entwurf | null { return vorabLesen(); }
