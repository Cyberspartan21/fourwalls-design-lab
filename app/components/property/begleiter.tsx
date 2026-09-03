"use client";
import { useEffect, useRef, useState } from "react";
import type { Publisher } from "@/domain/listing";

/* Kontaktkarte mit Anfrageformular. Der Erfolg heisst genau das, was er ist:
   «Anfrage angenommen» — die Anwendung hat sie gespeichert und dem Versand
   übergeben. Scheitert das, sagt die Karte es. */
type Antwort = { angenommen: true; publicRef: string } | { error: { code: string; message: string; fields?: Record<string, string[]> } };

export function Begleiter({ publicRef, quelle, quelleLabel, schritte, suffix, tx }:
  { publicRef: string; quelle: Publisher; quelleLabel: string; schritte: string[]; suffix: "" | "M"; tx: Record<string, string> }) {
  const [offen, setOffen] = useState(false);
  const [art, setArt] = useState<"viewing_request" | "listing_question">("viewing_request");
  const [name, setName] = useState(""); const [mail, setMail] = useState("");
  const [text, setText] = useState(tx.o_nachrichtStandard ?? "");
  const [abo, setAbo] = useState(true);
  const [status, setStatus] = useState<"bereit" | "sendet" | "ok" | "fehler">("bereit");
  const [fehler, setFehler] = useState<string | null>(null);
  const [gemeldet, setGemeldet] = useState(false);
  const form = useRef<HTMLDivElement>(null);
  const wir = quelle.representedByFourwalls;
  /* Ansprechperson mit Funktion — so, wie sie im Prototyp vorgestellt wurde */
  const person = quelle.personName ? quelle.personName + (quelle.personTitle ? ", " + quelle.personTitle : "") : (quelle.orgName ?? "?");

  useEffect(() => {
    const h = (e: Event) => {
      const mobil = matchMedia("(max-width:960px)").matches;
      if ((suffix === "M") !== mobil) return;
      const frage = (e as CustomEvent<{ frage: boolean }>).detail.frage;
      setOffen(true); setArt(frage ? "listing_question" : "viewing_request");
      if (frage) setText(tx.o_nachrichtFrage ?? "");
      requestAnimationFrame(() => { form.current?.scrollIntoView({ behavior: "smooth", block: "center" }); form.current?.querySelector("input")?.focus(); });
    };
    addEventListener("fw:anfrage", h); return () => removeEventListener("fw:anfrage", h);
  }, [suffix, tx]);

  async function senden() {
    setFehler(null);
    if (name.trim().length < 2) { setFehler(tx.fehlerName ?? "Bitte Namen angeben."); return; }
    if (!mail.includes("@")) { setFehler(tx.fehlerMail ?? "Bitte eine gültige E-Mail-Adresse angeben."); return; }
    setStatus("sendet");
    try {
      const r = await fetch("/api/inquiries", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicRef, art, name, email: mail, nachricht: text, suchabo: abo, firma: (form.current?.querySelector<HTMLInputElement>("input[name=firma]")?.value ?? "") }) });
      const a = (await r.json()) as Antwort;
      if (r.ok && "angenommen" in a) { setStatus("ok"); return; }
      setStatus("fehler"); setFehler("error" in a ? a.error.message : (tx.fehlerAllgemein ?? "Die Anfrage konnte nicht angenommen werden."));
    } catch { setStatus("fehler"); setFehler(tx.fehlerNetz ?? "Keine Verbindung — die Anfrage wurde nicht angenommen."); }
  }

  return (
    <div className="begleiter">
      <div className="wer">{wir ? <span className="mark"></span> : <span className="av">{(quelle.personName ?? quelle.orgName ?? "?").split(" ").map(x => x[0]).join("").slice(0, 2)}</span>}
        <div><b>{person}</b><span>{quelle.orgName && quelle.personName ? quelle.orgName : quelleLabel}{quelle.orgVerified ? " · " + tx.geprueft : ""}</span></div></div>
      <div className="vertrauen">{wir
        ? <><b>{tx.o_wirVertreten}</b> {tx.o_anfrageGehtAn} {quelle.personName ? person : tx.o_unserTeam}, {tx.o_nichtAnDritte}</>
        : <>{tx.o_inseriertVon} <b>{quelleLabel}</b>. {tx.o_anfrageDirekt} {tx.o_vertrittNicht}{quelle.orgVerified ? tx.o_hatGeprueft : ""}.</>}</div>
      <div className="cta">
        <button className="knopf voll" onClick={() => { setOffen(true); setArt("viewing_request"); }}>{tx.anfrage}</button>
        <button className="knopf" onClick={() => { setOffen(true); setArt("listing_question"); setText(tx.o_nachrichtFrage ?? ""); }}>{tx.o_frageStellen}</button>
        {quelle.phone && <a className="knopf leise" href={`tel:${quelle.phone.replace(/\s/g, "")}`}>{quelle.phone}</a>}
      </div>
      <ul className="schritte">{schritte.map((s, i) => <li key={i}>{s}</li>)}</ul>
      <div className={`dform ${offen ? "an" : ""}`} id={`dForm${suffix}`} ref={form}>
        <div className="paar">
          <input type="text" placeholder={tx.o_name} id={`dfName${suffix}`} aria-label={tx.o_name} value={name} onChange={e => setName(e.target.value)} maxLength={120} />
          <input type="email" placeholder="E-Mail" id={`dfMail${suffix}`} aria-label="E-Mail" value={mail} onChange={e => setMail(e.target.value)} maxLength={200} />
        </div>
        <input className="ht" type="text" name="firma" tabIndex={-1} autoComplete="off" aria-hidden="true" defaultValue="" />
        <textarea aria-label={tx.nachricht ?? "Nachricht"} id={`dfText${suffix}`} value={text} onChange={e => setText(e.target.value)} maxLength={2000} />
        <label className="ab"><input type="checkbox" checked={abo} onChange={e => setAbo(e.target.checked)} /> {tx.o_aehnlicheSuchabo}</label>
        <button className="knopf voll" id={`dfSenden${suffix}`} style={{ width: "100%", opacity: status === "ok" || status === "sendet" ? .5 : 1 }} disabled={status === "ok" || status === "sendet"} onClick={senden}>{status === "sendet" ? "…" : tx.o_anfrageSenden}</button>
        {fehler && <p className="fehler" role="alert">{fehler}</p>}
        <p className={`ok ${status === "ok" ? "an" : ""}`} id={`dfOk${suffix}`}>{tx.o_angenommenPrefix} {person} {tx.o_gesendetAn}</p>
      </div>
      <div className="dmelde"><button onClick={() => setGemeldet(true)} disabled={gemeldet}>{gemeldet ? tx.o_gemeldetDanke : tx.melden}</button></div>
    </div>
  );
}
