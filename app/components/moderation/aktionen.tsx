"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n";

/* Die Entscheide der Moderation. Jeder Knopf schickt eine Absicht, nie einen
   Zustand (§42). Ändern und Ablehnen verlangen eine Begründung — das Formular
   erzwingt sie, der Server prüft sie noch einmal (§45/§46). */
export function ModerationsAktionen({ publicRef, status, gruende, locale, t }:
  { publicRef: string; status: string; gruende: { wert: string; label: string }[]; locale: Locale; t: Record<string, string> }) {
  const router = useRouter();
  const [modus, setModus] = useState<"" | "aenderung" | "ablehnen">("");
  const [nachricht, setNachricht] = useState("");
  const [grund, setGrund] = useState(gruende[0]?.wert ?? "other");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const inPruefung = status === "submitted" || status === "in_review";
  const freigegeben = status === "approved";

  async function senden(absicht: string) {
    setLaeuft(true); setFehler(null);
    try {
      const r = await fetch(`/api/moderation/${publicRef}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ absicht, nachricht, grund })
      });
      const a = await r.json().catch(() => ({}));
      if (!r.ok) { setFehler(a?.message ?? t.w_speicherFehler!); return; }
      setModus(""); setNachricht("");
      router.refresh();
      if (absicht.includes("veroeffentlichen")) router.push(`/${locale}/moderation`);
    } catch { setFehler(t.w_speicherFehler!); }
    finally { setLaeuft(false); }
  }

  return (
    <div style={{ marginTop: 26, borderTop: "1px solid var(--linie)", paddingTop: 20 }}>
      {modus === "" && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {inPruefung && <button className="knopf voll gross" disabled={laeuft} onClick={() => senden("freigeben-und-veroeffentlichen")}>{t.m_freigebenUndVeroeffentlichen}</button>}
          {inPruefung && <button className="knopf" disabled={laeuft} onClick={() => senden("freigeben")}>{t.m_freigeben}</button>}
          {freigegeben && <button className="knopf voll gross" disabled={laeuft} onClick={() => senden("veroeffentlichen")}>{t.m_veroeffentlichen}</button>}
          {inPruefung && <button className="knopf" onClick={() => setModus("aenderung")}>{t.m_aenderung}</button>}
          {inPruefung && <button className="knopf leise" onClick={() => setModus("ablehnen")}>{t.m_ablehnen}</button>}
        </div>
      )}

      {modus !== "" && (
        <div className="fld">
          <label htmlFor="mGrund">{t.m_grund}</label>
          <select className="feld" id="mGrund" value={grund} onChange={e => setGrund(e.target.value)} style={{ width: "100%", maxWidth: 380 }}>
            {gruende.map(g => <option key={g.wert} value={g.wert}>{g.label}</option>)}
          </select>
          <label htmlFor="mNachricht" style={{ marginTop: 14, display: "block" }}>{t.m_nachrichtAnPerson}</label>
          <textarea className="feld" id="mNachricht" value={nachricht} onChange={e => setNachricht(e.target.value)}
            style={{ width: "100%", minHeight: 110 }} maxLength={2000} aria-describedby="mHin" />
          <p className="hin" id="mHin" style={{ color: "var(--leise)", fontSize: ".8rem", marginTop: 6 }}>{t.m_nachrichtHin}</p>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button className="knopf voll" disabled={laeuft || nachricht.trim().length < 10} onClick={() => senden(modus)}>
              {modus === "aenderung" ? t.m_aenderung : t.m_ablehnen}
            </button>
            <button className="knopf leise" onClick={() => { setModus(""); setFehler(null); }}>×</button>
          </div>
        </div>
      )}
      {fehler && <p className="fehler" role="alert" style={{ color: "var(--warn)", marginTop: 10 }}>{fehler}</p>}
    </div>
  );
}
