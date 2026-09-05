"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n";
import { Stepper, type Fehlerhinweis } from "./stepper";
import { ObjektBlock } from "./objekt-block";
import { SituationBlock } from "./situation-block";
import { KontaktBlock } from "./kontakt-block";
import { PruefenBlock } from "./pruefen-block";
import { LEERER_KONTAKT, LEERES_OBJEKT, SCHRITTE_JE_DIENST, objektPflichtig, typPflichtig,
  type Dienst, type KontaktDaten, type ObjektDaten, type Schritt } from "./typen";

/* Der Anliegen-Assistent — ein Formular, fünf Dienste (sell, let, valuation,
   property_management, owner_consultation), Schrittfolge je nach Dienst
   (SCHRITTE_JE_DIENST).

   Anders als der Inserats-Assistent gibt es hier kein Autosave: ein Anliegen
   ist ein einmaliger Versand, kein Entwurf. Der Zustand überlebt trotzdem
   einen versehentlichen Reload — im sessionStorage unter einem je Dienst
   eigenen Schlüssel, damit ein Wechsel zwischen den fünf Formularen sich
   nicht gegenseitig überschreibt.

   Client-Validierung ist reine Bequemlichkeit (springt zum fehlenden Feld,
   verhindert offensichtlich unvollständiges Absenden); die verbindliche
   Prüfung liegt beim Server. Antwortet er mit 422 und `fields`, springt der
   Assistent zum ersten betroffenen Schritt und verlinkt jedes Feld. */

type SendeZustand = "bereit" | "sendet" | "ok" | "fehler";

function schluessel(dienst: Dienst) { return `fw-anliegen-${dienst}`; }

function anfangsObjekt(dienst: Dienst): ObjektDaten {
  if (typeof window === "undefined") return LEERES_OBJEKT;
  try {
    const roh = sessionStorage.getItem(schluessel(dienst));
    if (!roh) return LEERES_OBJEKT;
    const g = JSON.parse(roh);
    return { ...LEERES_OBJEKT, ...(g.objekt ?? {}) };
  } catch { return LEERES_OBJEKT; }
}
function anfangsKontakt(dienst: Dienst): KontaktDaten {
  if (typeof window === "undefined") return LEERER_KONTAKT;
  try {
    const roh = sessionStorage.getItem(schluessel(dienst));
    if (!roh) return LEERER_KONTAKT;
    const g = JSON.parse(roh);
    return { ...LEERER_KONTAKT, ...(g.kontakt ?? {}) };
  } catch { return LEERER_KONTAKT; }
}

/* Server-Feldpfade auf Anker-IDs — reine Anzeige-Zuordnung. Die genauen
   Pfade legt der parallele Serverauftrag (domain/anliegen.ts) fest; diese
   Tabelle deckt die im Vertrag genannten Felder ab und fällt bei einem
   unbekannten Pfad auf den ersten Schritt zurück, statt zu scheitern. */
const FELD_ANKER: Record<string, string> = {
  "kontakt.name": "al-name", "kontakt.email": "al-email", "kontakt.telefon": "al-telefon",
  "kontakt.kanal": "al-kanal", "kontakt.wunschdatum": "al-wunschdatum", "kontakt.wunschfenster": "al-wunschdatum",
  "objekt.ortId": "al-ort", "objekt.typ": "al-typ", "objekt.zimmer": "al-zimmer", "objekt.flaeche": "al-flaeche",
  "objekt.grundstueck": "al-grundstueck", "objekt.baujahr": "al-baujahr", "objekt.einheiten": "al-einheiten",
  "objekt.zustand": "al-zustand", "objekt.belegung": "al-belegung", "objekt.zeitpunkt": "al-zeitpunkt",
  "objekt.bereitsInseriert": "al-bereits-inseriert", "objekt.andererMakler": "al-anderer-makler",
  "objekt.leistungen": "al-leistungen", "objekt.inseratRef": "al-inseratref", "objekt.nachricht": "al-nachricht"
};
const SITUATIONS_FELDER = new Set(["zeitpunkt", "belegung", "bereitsInseriert", "andererMakler", "einheiten", "leistungen", "inseratRef"]);

function schrittFuerFeld(dienst: Dienst, pfad: string): Schritt {
  const teil = pfad.split(".").pop() ?? pfad;
  if (pfad.startsWith("kontakt.")) return "kontakt";
  if (pfad.startsWith("objekt.")) {
    if (SITUATIONS_FELDER.has(teil)) {
      if (dienst === "valuation") return "objekt";
      if (dienst === "owner_consultation") return "kontakt";
      return "situation";
    }
    return dienst === "owner_consultation" ? "kontakt" : "objekt";
  }
  return SCHRITTE_JE_DIENST[dienst][0]!;
}

export interface AnliegenFormularProps {
  dienst: Dienst;
  angemeldet: boolean;
  locale: Locale;
  t: Record<string, string>;
}

export function AnliegenFormular({ dienst, angemeldet, locale, t }: AnliegenFormularProps) {
  const pfad = usePathname();
  const schritte = SCHRITTE_JE_DIENST[dienst];
  const [i, setI] = useState(0);
  const [objekt, setObjekt] = useState<ObjektDaten>(() => anfangsObjekt(dienst));
  const [kontakt, setKontakt] = useState<KontaktDaten>(() => anfangsKontakt(dienst));
  const [zeigeMaengel, setZeigeMaengel] = useState(false);
  const [status, setStatus] = useState<SendeZustand>("bereit");
  const [nachricht, setNachricht] = useState<string | null>(null);
  const [serverFehler, setServerFehler] = useState<Fehlerhinweis[]>([]);
  const [publicRef, setPublicRef] = useState<string | null>(null);
  const honigtopf = useRef<HTMLInputElement>(null);

  const S = schritte[i]!;

  useEffect(() => {
    try { sessionStorage.setItem(schluessel(dienst), JSON.stringify({ objekt, kontakt })); } catch { /* privater Modus */ }
  }, [dienst, objekt, kontakt]);

  const kampagne = useMemo(() => {
    if (typeof window === "undefined") return null;
    const v = new URLSearchParams(window.location.search).get("k");
    return v && /^[a-z0-9-]{1,60}$/.test(v) ? v : null;
  }, []);

  function aendernObjekt(teil: Partial<ObjektDaten>) { setObjekt(d => ({ ...d, ...teil })); }
  function aendernKontakt(teil: Partial<KontaktDaten>) { setKontakt(d => ({ ...d, ...teil })); }

  function fehltObjekt(feld: string): boolean {
    if (!zeigeMaengel) return false;
    if (feld === "ortId") return !objekt.ortId;
    if (feld === "typ") return typPflichtig(dienst) && !objekt.typ;
    return false;
  }
  function fehltKontakt(feld: string): boolean {
    if (!zeigeMaengel) return false;
    if (feld === "name") return kontakt.name.trim().length < 2;
    if (feld === "email") return !kontakt.email.includes("@");
    return false;
  }

  function schrittGueltig(schritt: Schritt): boolean {
    if (schritt === "objekt") return !fehltObjekt("ortId") && !fehltObjekt("typ");
    if (schritt === "kontakt") return !fehltKontakt("name") && !fehltKontakt("email");
    return true;
  }

  function weiter() {
    setZeigeMaengel(true);
    if (!schrittGueltig(S)) return;
    setZeigeMaengel(false);
    setI(n => Math.min(schritte.length - 1, n + 1));
  }
  function zurueck() { setI(n => Math.max(0, n - 1)); }
  function geheZu(schritt: Schritt) { const idx = schritte.indexOf(schritt); if (idx >= 0) setI(idx); }

  function baueObjektNutzlast(): Record<string, unknown> | undefined {
    if (dienst === "owner_consultation") {
      return objekt.nachricht.trim() ? { nachricht: objekt.nachricht.trim() } : undefined;
    }
    const o: Record<string, unknown> = {};
    if (objekt.ortId) o.ortId = objekt.ortId;
    if (objekt.typ) o.typ = objekt.typ;
    if (objekt.zimmer) o.zimmer = Number(objekt.zimmer);
    if (objekt.flaeche) o.flaeche = Number(objekt.flaeche);
    if (objekt.grundstueck) o.grundstueck = Number(objekt.grundstueck);
    if (objekt.baujahr) o.baujahr = Number(objekt.baujahr);
    if (objekt.zustand) o.zustand = objekt.zustand;
    if (dienst === "sell") {
      if (objekt.zeitpunkt) o.zeitpunkt = objekt.zeitpunkt;
      if (objekt.belegung) o.belegung = objekt.belegung;
      if (objekt.bereitsInseriert != null) o.bereitsInseriert = objekt.bereitsInseriert;
      if (objekt.andererMakler != null) o.andererMakler = objekt.andererMakler;
      /* Nur eine gültige Fourwalls-Referenz mitschicken (Vertrag: FWL-JJJJ-NNNNNN) — sonst lieber weglassen als einen 422 zu riskieren. */
      if (/^FWL-\d{4}-\d{6}$/.test(objekt.inseratRef.trim())) o.inseratRef = objekt.inseratRef.trim();
    }
    if (dienst === "let") {
      if (objekt.zeitpunkt) o.zeitpunkt = objekt.zeitpunkt;
      if (objekt.belegung) o.belegung = objekt.belegung;
      if (objekt.leistungen.length) o.leistungen = objekt.leistungen;
    }
    if (dienst === "property_management") {
      if (objekt.einheiten) o.einheiten = Number(objekt.einheiten);
      if (objekt.belegung) o.belegung = objekt.belegung;
      if (objekt.leistungen.length) o.leistungen = objekt.leistungen;
      if (objekt.zeitpunkt) o.zeitpunkt = objekt.zeitpunkt;
    }
    if (dienst === "valuation" && objekt.nachricht.trim()) o.nachricht = objekt.nachricht.trim();
    return Object.keys(o).length ? o : undefined;
  }

  async function senden() {
    setStatus("sendet"); setNachricht(null); setServerFehler([]);
    const objektNutzlast = baueObjektNutzlast();
    const body = {
      dienst,
      kontakt: {
        name: kontakt.name.trim(), email: kontakt.email.trim(), kanal: kontakt.kanal,
        ...(kontakt.telefon.trim() ? { telefon: kontakt.telefon.trim() } : {}),
        ...(kontakt.wunschdatum && kontakt.wunschdatum >= new Date().toISOString().slice(0, 10) ? { wunschdatum: kontakt.wunschdatum } : {}),
        ...(kontakt.wunschfenster ? { wunschfenster: kontakt.wunschfenster } : {})
      },
      ...(objektNutzlast ? { objekt: objektNutzlast } : {}),
      sprache: locale,
      herkunft: { seite: pfad, ...(kampagne ? { kampagne } : {}) },
      firma: honigtopf.current?.value ?? ""
    };
    try {
      const r = await fetch("/api/anliegen", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (r.status === 201) {
        const a = await r.json();
        setStatus("ok"); setPublicRef(a.publicRef ?? null);
        try { sessionStorage.removeItem(schluessel(dienst)); } catch { /* egal */ }
        return;
      }
      if (r.status === 429) { setStatus("fehler"); setNachricht(t.al_fehlerRate!); return; }
      if (r.status === 422) {
        const a = await r.json().catch(() => ({}));
        const felder = (a?.fields ?? {}) as Record<string, string>;
        const eintraege: Fehlerhinweis[] = Object.entries(felder).map(([feldpfad, msg]) => ({ anker: FELD_ANKER[feldpfad] ?? "al-name", text: msg }));
        setServerFehler(eintraege);
        const ersterPfad = Object.keys(felder)[0];
        if (ersterPfad) geheZu(schrittFuerFeld(dienst, ersterPfad));
        setStatus("fehler"); setNachricht(a?.message ?? t.al_fehlerAllgemein!);
        return;
      }
      const a = await r.json().catch(() => ({}));
      setStatus("fehler"); setNachricht(a?.message ?? t.al_fehlerAllgemein!);
    } catch {
      setStatus("fehler"); setNachricht(t.al_fehlerNetz!);
    }
  }

  if (status === "ok") return (
    <div className="hinweisbox" role="status">
      <b>{t.al_erfolgVor} {publicRef}</b>
      <p style={{ marginTop: 6 }}>{t.al_erfolgNach}</p>
      {angemeldet && <a className="knopf voll" style={{ marginTop: 14 }} href={`/${locale}/konto/anliegen`}>{t.al_titel}</a>}
      {quervereis(dienst, locale, t)}
    </div>
  );

  const stepperTitel: Record<Schritt, string> = { objekt: t.al_h_objekt!, situation: t.al_h_situation!, kontakt: t.al_h_kontakt!, pruefen: t.al_h_pruefen! };
  const stepperLabels = schritte.map(s => t["al_nav_" + s]!);

  return (
    <>
      <Stepper schritte={stepperLabels} aktiv={i} titel={stepperTitel[S]!}
        hinweis={serverFehler.length > 0 ? { titel: t.al_fehlerFelder!, eintraege: serverFehler } : undefined} />

      {status === "fehler" && nachricht && (
        <div className="hinweisbox" role="alert" style={{ marginTop: 14, borderColor: "var(--warn)" }}>
          <p>{nachricht}</p>
        </div>
      )}

      {S === "objekt" && (
        <>
          <ObjektBlock dienst={dienst} objekt={objekt} aendern={aendernObjekt} t={t} locale={locale} fehlt={fehltObjekt} />
          {dienst === "valuation" && <SituationBlock dienst={dienst} objekt={objekt} aendern={aendernObjekt} t={t} />}
        </>
      )}
      {S === "situation" && <SituationBlock dienst={dienst} objekt={objekt} aendern={aendernObjekt} t={t} />}
      {S === "kontakt" && (
        <>
          {dienst === "owner_consultation" && <SituationBlock dienst={dienst} objekt={objekt} aendern={aendernObjekt} t={t} />}
          <KontaktBlock kontakt={kontakt} aendern={aendernKontakt} t={t} fehlt={fehltKontakt} datenschutzHref={`/${locale}`} />
          <input ref={honigtopf} type="text" name="firma" tabIndex={-1} autoComplete="off" aria-hidden="true" defaultValue=""
            style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }} />
        </>
      )}
      {S === "pruefen" && (
        <PruefenBlock dienst={dienst} objekt={objekt} kontakt={kontakt} t={t} geheZu={geheZu}
          zeigtObjekt={objektPflichtig(dienst) && dienst !== "owner_consultation"} zeigtSituation={schritte.includes("situation")} />
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 28, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="knopf" style={{ visibility: i === 0 ? "hidden" : "visible" }} onClick={zurueck}>{t.w_zurueck}</button>
        {S === "pruefen" ? (
          <button type="button" className="knopf voll gross" disabled={status === "sendet"} onClick={senden}>{status === "sendet" ? "…" : t.al_senden}</button>
        ) : (
          <button type="button" className="knopf voll gross" onClick={weiter}>{t.w_weiter}</button>
        )}
      </div>
    </>
  );
}

function quervereis(dienst: Dienst, locale: Locale, t: Record<string, string>) {
  if (dienst === "sell") return <p style={{ marginTop: 18 }}>{t.al_quer_sell} <a href={`/${locale}/inserieren`}>{t.al_quer_sell_link}</a></p>;
  if (dienst === "let") return <p style={{ marginTop: 18 }}>{t.al_quer_let} <a href={`/${locale}/verwalten/anfrage`}>{t.al_quer_let_link}</a></p>;
  if (dienst === "valuation") return <p style={{ marginTop: 18 }}>{t.al_quer_valuation} <a href={`/${locale}/verkaufen/anfrage`}>{t.al_quer_valuation_link}</a></p>;
  return null;
}
