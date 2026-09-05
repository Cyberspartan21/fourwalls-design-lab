"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n";
import { LEER, SORTS, type Suchanfrage, type Sort, type Treffer } from "@/domain/marktplatz";
import { paramsAusAnfrage } from "@/domain/suchurl";
import { typLabel, quelleFilterLabel, featLabel, chfText, trefferLabel, type Woerter } from "./labels";
import { Karte, objektPfad } from "./karte";

/* Chips, Ergebniskopf (Sortierung, Liste/Karte), «Weitere anzeigen» und die
   Suchabo-Zeile — Client-Inseln über dem Server-Markup der Trefferliste. */

function navigiere(router: ReturnType<typeof useRouter>, basis: string, q: Suchanfrage, start: (f: () => void) => void, ersetzen = false) {
  const p = paramsAusAnfrage(q); if (q.seite <= 1) p.delete("seite");
  const url = basis + (p.toString() ? "?" + p.toString() : "");
  start(() => { if (ersetzen) router.replace(url, { scroll: false }); else router.push(url, { scroll: false }); });
}

export function Chips({ q, ortLabel, w, basis }: { q: Suchanfrage; ortLabel: string | null; w: Woerter; basis: string }) {
  const router = useRouter(); const [, start] = useTransition();
  const c: [string, string][] = [];
  if (q.ort && ortLabel) c.push(["ort", ortLabel + (q.umkreisKm ? ` + ${q.umkreisKm} ${w.km}` : "")]);
  if (q.typ) c.push(["typ", typLabel(w, q.typ)]);
  if (q.pMin != null) c.push(["pMin", "≥ " + chfText(q.pMin)]); if (q.pMax != null) c.push(["pMax", "≤ " + chfText(q.pMax)]);
  if (q.ziMin != null) c.push(["ziMin", q.ziMin + "+ Zi."]); if (q.ziMax != null) c.push(["ziMax", "≤ " + q.ziMax + " Zi."]);
  if (q.flMin != null) c.push(["flMin", "≥ " + q.flMin + " m²"]); if (q.flMax != null) c.push(["flMax", "≤ " + q.flMax + " m²"]);
  if (q.grMin != null) c.push(["grMin", `${w.grundVon} ${q.grMin} m²`]);
  if (q.bjVon != null) c.push(["bjVon", `${w.baujahrVon} ${q.bjVon}`]); if (q.bjBis != null) c.push(["bjBis", `${w.baujahrBis} ${q.bjBis}`]);
  if (q.etage) c.push(["etage", w[{ eg: "eg", nichteg: "nichtEg", ab2: "ab2", dach: "dachgeschoss" }[q.etage]] ?? q.etage]);
  if (q.verf) c.push(["verf", q.verf === "sofort" ? w.sofort! : w.in3Mt!]);
  if (!q.nurFrei) c.push(["nurFrei", w.statusZeigen!]);
  if (q.quelle) c.push(["quelle", quelleFilterLabel(w, q.quelle)]);
  q.feat.forEach(f => c.push(["feat:" + f, featLabel(w, f)]));
  const weg = (k: string) => {
    const n: Suchanfrage = { ...q, seite: 1, bounds: null };
    if (k.startsWith("feat:")) n.feat = q.feat.filter(x => x !== k.slice(5));
    else if (k === "ort") { n.ort = null; n.umkreisKm = 0; }
    else if (k === "typ" || k === "quelle" || k === "etage" || k === "verf") (n as unknown as Record<string, string>)[k] = "";
    else if (k === "nurFrei") n.nurFrei = true;
    else (n as unknown as Record<string, null>)[k] = null;
    navigiere(router, basis, n, start);
  };
  return <div className="chips" id="chips">{c.map(([k, v]) => <button key={k} data-chip={k} aria-label={`Filter entfernen: ${v}`} onClick={() => weg(k)}><b>{v}</b></button>)}</div>;
}

export function ResultKopf({ q, titel, total, w, basis }: { q: Suchanfrage; titel: string; total: number; w: Woerter; basis: string }) {
  const router = useRouter(); const [, start] = useTransition();
  return (
    <div className="resultkopf">
      <h1 id="resultTitel">{titel}</h1><span className="n zahl" id="resultN">{trefferLabel(w, total)}</span>
      <div className="rechtsw">
        <select className="feld" id="sortSel" aria-label="Sortierung" value={q.sort} onChange={e => navigiere(router, basis, { ...q, sort: e.target.value as Sort, seite: 1 }, start)}>
          {SORTS.map(s => <option key={s} value={s}>{w[{ empfohlen: "sortEmpfohlen", neu: "neuste", "preis-auf": "preisAuf", "preis-ab": "preisAb", m2: "sortM2", flaeche: "flaeche", zimmer: "zimmer" }[s]]}</option>)}
        </select>
        <div className="karte-liste" role="group">
          <button aria-pressed={q.modus !== "map"} id="wlListe" onClick={() => navigiere(router, basis, { ...q, modus: "list" }, start)}>{w.liste}</button>
          <button aria-pressed={q.modus === "map"} id="wlKarte" onClick={() => navigiere(router, basis, { ...q, modus: "map", seite: 1 }, start)}>{w.karte}</button>
        </div>
      </div>
    </div>
  );
}

/* «Weitere anzeigen»: die nächsten 24 kommen aus der API und werden angehängt;
   die Adresse merkt sich die geladene Seitenzahl (?seite=n), damit Zurück
   nicht wieder bei 24 beginnt. */
export function MehrLaden({ q, total, geladen, w, locale, pfad, basis }:
  { q: Suchanfrage; total: number; geladen: number; w: Woerter; locale: Locale; pfad: { immobilien: string; kaufen: string; mieten: string }; basis: string }) {
  const [extra, setExtra] = useState<Treffer[]>([]);
  const [seite, setSeite] = useState(q.seite);
  const [laedt, setLaedt] = useState(false);
  const n = geladen + extra.length;
  if (total <= n) return null;
  const mehr = async () => {
    setLaedt(true);
    try {
      const p = paramsAusAnfrage({ ...q, seite: seite + 1 }); p.set("locale", locale);
      const a = await fetch(`/api/search?${p.toString()}`).then(r => r.json());
      const neu: Treffer[] = (a.treffer ?? []).slice(n);
      setExtra(x => [...x, ...neu]); setSeite(s => s + 1);
      const u = paramsAusAnfrage({ ...q, seite: seite + 1 });
      history.replaceState(history.state, "", basis + "?" + u.toString());
    } finally { setLaedt(false); }
  };
  return (
    <>
      {extra.length > 0 && <div className="gitter" aria-label="weitere Treffer">{extra.map(l => <Karte key={l.id} l={l} w={w} locale={locale} href={objektPfad(locale, pfad, l)} />)}</div>}
      <button className="knopf mehrknopf" id="mehrKnopf" style={{ display: "flex" }} disabled={laedt} onClick={mehr}>{w.weitere} ({total - n})</button>
    </>
  );
}

/* Suchabo-Zeile: dieselbe normalisierte Anfrage geht per POST an /api/suchabo.
   Angemeldet ist das Abo sofort aktiv (Kontoadresse ist schon bestätigt);
   ohne Konto verschickt der Server eine echte Bestätigungsmail (Double-Opt-in) —
   erst danach wird je etwas zugestellt. */
export function AboZeile({ q, zusammenfassung, total, w, locale, angemeldet = false }: { q: Suchanfrage; zusammenfassung: string; total: number; w: Woerter; locale: Locale; angemeldet?: boolean }) {
  const [offen, setOffen] = useState(false); const [mail, setMail] = useState(""); const [wie, setWie] = useState<"sofort" | "taeglich" | "woechentlich">("taeglich");
  const [fertig, setFertig] = useState(false); const [fehler, setFehler] = useState(false); const [fehlerArt, setFehlerArt] = useState<"mail" | "allgemein">("mail");
  const [laeuft, setLaeuft] = useState(false);
  const hinweis = angemeldet ? w.aboHinweisKonto : w.aboHinweisAnon;
  const speichern = async () => {
    if (!mail.includes("@")) { setFehlerArt("mail"); setFehler(true); return; }
    setLaeuft(true); setFehler(false);
    try {
      const { seite: _s, modus: _m, bounds: _b, proSeite: _p, ...anfrage } = { ...LEER, ...q };
      const wie2 = wie === "sofort" ? "immediately" : wie === "taeglich" ? "daily" : "weekly";
      const res = await fetch("/api/suchabo", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: anfrage, label: zusammenfassung, email: mail, frequency: wie2, locale })
      });
      if (!res.ok) throw new Error("suchabo-fehlgeschlagen");
      setFertig(true);
    } catch {
      setFehlerArt("allgemein"); setFehler(true);
    } finally {
      setLaeuft(false);
    }
  };
  return (
    <>
      <div className="abozeile" id="abo"><span><b>{w.p_aboZeileB}</b> {w.p_aboZeileSpan}</span><button className="knopf" id="sucheSpeichern" style={{ marginLeft: "auto" }} onClick={() => { setOffen(true); setFertig(false); }}>{w.sucheSpeichern}</button></div>
      {offen && (
        <div className="abo-hg" id="aboHg" onClick={e => { if (e.target === e.currentTarget) setOffen(false); }}>
          <div className="abo-blatt" role="dialog" aria-modal="true" aria-labelledby="aboH">
            <div className="abo-kopf"><h2 id="aboH">{w.suchaboTitel}</h2><button className="knopf" id="aboZu" onClick={() => setOffen(false)}>{w.schliessen}</button></div>
            {!fertig ? (
              <div id="aboKoerper">
                <p className="abo-summe" id="aboSumme">{zusammenfassung} · {trefferLabel(w, total)}</p>
                <label className="et" htmlFor="aboMail">{w.suchaboMail}</label>
                <input className="feld" type="email" id="aboMail" placeholder="name@beispiel.ch" autoComplete="email" value={mail} onChange={e => { setMail(e.target.value); setFehler(false); }} />
                <p className="abo-fehler" id="aboFehler" hidden={!fehler}>{fehlerArt === "mail" ? w.mailFehler : w.suchaboFehler}</p>
                <label className="et" style={{ marginTop: 14 }}>{w.suchaboWie}</label>
                <div className="chipwahl" id="aboWie">{(["sofort", "taeglich", "woechentlich"] as const).map(v => <button key={v} data-wie={v} aria-pressed={wie === v} onClick={() => setWie(v)}>{w[{ sofort: "wieSofort", taeglich: "wieTaeglich", woechentlich: "wieWoechentlich" }[v]]}</button>)}</div>
                <p className="abo-fein" id="aboFein">{hinweis}</p>
                <div className="abo-aktionen"><button className="knopf" id="aboAbbruch" onClick={() => setOffen(false)}>{w.abbrechen}</button><button className="knopf voll" id="aboSpeichern" disabled={laeuft} onClick={speichern}>{w.speichern}</button></div>
              </div>
            ) : (
              <div id="aboFertig">
                <p className="abo-ok"><b>{w.suchaboOk}</b></p>
                <p className="abo-summe" id="aboSumme2">{zusammenfassung}</p>
                <p className="abo-fein" id="aboFein2">{hinweis}</p>
                <div className="abo-aktionen"><button className="knopf voll" id="aboFertigZu" onClick={() => setOffen(false)}>{w.schliessen}</button></div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
