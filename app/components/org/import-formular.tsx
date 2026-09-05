"use client";
import { useRef, useState } from "react";

/* Der CSV-Import (P5.7 §5, docs/IMPORT-ADAPTER.md) — eine Datei ODER
   eingefügter Text, einmal hochgeladen. Das Ergebnis ist ehrlich: jede
   Zeile bekommt ihren tatsächlichen Stand, nichts wird stillschweigend
   übersprungen (§30). */

type Texte = Record<string, string>;
export interface ImportZeilenErgebnis { zeile: number; externalRef: string | null; status: "angelegt" | "uebersprungen" | "abgelehnt"; grund?: string }

export function ImportFormular({ slug, t }: { slug: string; t: Texte }) {
  const dateiRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnisse, setErgebnisse] = useState<ImportZeilenErgebnis[] | null>(null);

  async function csvAusFormular(): Promise<string> {
    const datei = dateiRef.current?.files?.[0];
    if (datei) return datei.text();
    return text;
  }

  async function senden(e: React.FormEvent) {
    e.preventDefault();
    setFehler(null);
    setErgebnisse(null);
    setLaeuft(true);
    try {
      const csv = await csvAusFormular();
      const res = await fetch(`/api/org/${slug}/import`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ csv })
      });
      const a = await res.json().catch(() => ({}));
      if (!res.ok) { setFehler(a?.message ?? "—"); setLaeuft(false); return; }
      setErgebnisse(a.ergebnisse as ImportZeilenErgebnis[]);
    } catch {
      setFehler("—");
    } finally {
      setLaeuft(false);
    }
  }

  const statusLabel: Record<ImportZeilenErgebnis["status"], string> = {
    angelegt: t.og_importStatusAngelegt!, uebersprungen: t.og_importStatusUebersprungen!, abgelehnt: t.og_importStatusAbgelehnt!
  };

  return (
    <div>
      <form className="fld" onSubmit={senden} noValidate>
        <div className="fld">
          <label htmlFor="impDatei">{t.og_importDatei}</label>
          <input className="feld" id="impDatei" ref={dateiRef} type="file" accept=".csv,text/csv" />
        </div>
        <div className="fld">
          <label htmlFor="impText">{t.og_importText}</label>
          <textarea className="feld" id="impText" value={text} onChange={e => setText(e.target.value)} />
        </div>
        {fehler && <p role="alert" style={{ color: "var(--warn)", fontSize: ".82rem", marginTop: 10 }}>{fehler}</p>}
        <div style={{ marginTop: 16 }}>
          <button className="knopf voll" type="submit" disabled={laeuft}>{laeuft ? "…" : t.og_importKnopf}</button>
        </div>
      </form>

      {ergebnisse && (
        <div style={{ marginTop: 26 }}>
          <h3 style={{ fontSize: ".95rem" }}>{t.og_importErgebnisTitel}</h3>
          <div className="org-tabelle-wrap">
            <table className="org-tabelle">
              <thead>
                <tr>
                  <th scope="col">{t.og_importThZeile}</th>
                  <th scope="col">{t.og_importThRef}</th>
                  <th scope="col">{t.og_importThStatus}</th>
                  <th scope="col">{t.og_importThGrund}</th>
                </tr>
              </thead>
              <tbody>
                {ergebnisse.map(z => (
                  <tr key={z.zeile}>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{z.zeile}</td>
                    <td>{z.externalRef ?? "—"}</td>
                    <td>{statusLabel[z.status]}</td>
                    <td style={{ color: "var(--leise)" }}>{z.grund ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="org-karten">
            {ergebnisse.map(z => (
              <li key={z.zeile} className="org-karte">
                <b>{t.og_importThZeile} {z.zeile}</b> — {statusLabel[z.status]}
                <div style={{ color: "var(--leise)", fontSize: ".82rem", marginTop: 4 }}>{z.externalRef ?? "—"}{z.grund ? ` · ${z.grund}` : ""}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
