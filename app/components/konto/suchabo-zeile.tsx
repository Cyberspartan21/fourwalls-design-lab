"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export interface SuchaboZeileTexte {
  k_zuletztGeaendert: string;
  sa_unbestaetigt: string;
  wieSofort: string;
  wieTaeglich: string;
  wieWoechentlich: string;
  sa_pausieren: string;
  sa_aktivieren: string;
  sa_oeffnen: string;
  sa_loeschen: string;
  sa_loeschenBestaetigen: string;
}

/* Eine Zeile der Kontoseite «Meine Suchabos» — Häufigkeit ändern, pausieren/
   aktivieren, öffnen, löschen. Jede Änderung geht sofort an
   /api/suchabo/[id] (PATCH/DELETE); die Eigentümerschaft prüft der Server. */
export function SuchaboZeile({ id, titel, href, createdAt, frequency, isPaused, confirmedAt, t }:
  { id: string; titel: string; href: string; createdAt: string; frequency: "immediately" | "daily" | "weekly"; isPaused: boolean; confirmedAt: string | null; t: SuchaboZeileTexte }) {
  const router = useRouter();
  const [laeuft, setLaeuft] = useState(false);
  const [freq, setFreq] = useState(frequency);
  const [pausiert, setPausiert] = useState(isPaused);
  const [entfernt, setEntfernt] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setLaeuft(true);
    try {
      const res = await fetch(`/api/suchabo/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) router.refresh();
    } finally { setLaeuft(false); }
  }

  async function entfernen() {
    if (typeof window !== "undefined" && !window.confirm(t.sa_loeschenBestaetigen)) return;
    setLaeuft(true);
    try {
      const res = await fetch(`/api/suchabo/${id}`, { method: "DELETE" });
      if (res.ok) { setEntfernt(true); router.refresh(); }
    } finally { setLaeuft(false); }
  }

  if (entfernt) return null;

  return (
    <li style={{ borderTop: "1px solid var(--linie)", padding: "16px 0" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <b style={{ fontSize: "1.02rem", fontWeight: 500 }}>{titel}</b>
        {!confirmedAt && <span style={{ fontSize: ".62rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--warn)" }}>{t.sa_unbestaetigt}</span>}
        <span style={{ color: "var(--leise)", fontSize: ".78rem" }}>{t.k_zuletztGeaendert}: {createdAt.slice(0, 10)}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
        <select className="feld" value={freq} disabled={laeuft} onChange={e => { const v = e.target.value as typeof freq; setFreq(v); void patch({ frequency: v }); }}>
          <option value="immediately">{t.wieSofort}</option>
          <option value="daily">{t.wieTaeglich}</option>
          <option value="weekly">{t.wieWoechentlich}</option>
        </select>
        <button className="knopf" disabled={laeuft} onClick={() => { const v = !pausiert; setPausiert(v); void patch({ isPaused: v }); }}>{pausiert ? t.sa_aktivieren : t.sa_pausieren}</button>
        <a className="knopf leise" href={href}>{t.sa_oeffnen}</a>
        <button className="knopf leise" disabled={laeuft} onClick={entfernen}>{t.sa_loeschen}</button>
      </div>
    </li>
  );
}
