"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/* Zuweisung eines Anliegens an ein Teammitglied (P5.8 §28) — nur sichtbar,
   wenn die aufrufende Seite ASSIGN_SERVICE_LEAD geprüft hat. Der Server
   prüft das Recht erneut (PATCH /api/intern/anliegen/<ref>). */
export function ZuweisenAuswahl({ publicRef, aktuell, personal, label, unzugewiesenLabel, fehlerLabel }:
  { publicRef: string; aktuell: string | null; personal: { id: string; name: string }[];
    label: string; unzugewiesenLabel: string; fehlerLabel: string }) {
  const router = useRouter();
  const [wert, setWert] = useState(aktuell ?? "");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function aendern(neu: string) {
    setWert(neu);
    setLaeuft(true);
    setFehler(null);
    try {
      const res = await fetch(`/api/intern/anliegen/${publicRef}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignedStaffId: neu || null })
      });
      const a = await res.json().catch(() => ({}));
      if (!res.ok) { setFehler(a?.message ?? fehlerLabel); setWert(aktuell ?? ""); return; }
      router.refresh();
    } catch {
      setFehler(fehlerLabel);
      setWert(aktuell ?? "");
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <span>
      <select className="feld" aria-label={label} value={wert} disabled={laeuft} onChange={e => void aendern(e.target.value)}>
        <option value="">{unzugewiesenLabel}</option>
        {personal.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {fehler && <span role="alert" style={{ color: "var(--warn)", fontSize: ".76rem", marginLeft: 8 }}>{fehler}</span>}
    </span>
  );
}
