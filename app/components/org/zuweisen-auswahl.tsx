"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/* Zuweisung eines Inserats an ein Teammitglied — nur sichtbar, wenn die
   aufrufende Seite ASSIGN_LISTING geprüft hat (P5.7 §24). Der Server prüft
   das Recht erneut (POST /api/org/<slug>/inserate/<ref>/zuweisen). */
export function ZuweisenAuswahl({ slug, publicRef, aktuell, mitglieder, label, unzugewiesenLabel }:
  { slug: string; publicRef: string; aktuell: string | null;
    mitglieder: { userId: string; name: string }[]; label: string; unzugewiesenLabel: string }) {
  const router = useRouter();
  const [wert, setWert] = useState(aktuell ?? "");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function aendern(neu: string) {
    setWert(neu);
    setLaeuft(true);
    setFehler(null);
    try {
      const res = await fetch(`/api/org/${slug}/inserate/${publicRef}/zuweisen`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: neu || null })
      });
      const a = await res.json().catch(() => ({}));
      if (!res.ok) { setFehler(a?.message ?? "—"); setWert(aktuell ?? ""); setLaeuft(false); return; }
      router.refresh();
    } catch {
      setFehler("—");
      setWert(aktuell ?? "");
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <span>
      <select className="feld" aria-label={label} value={wert} disabled={laeuft} onChange={e => void aendern(e.target.value)}>
        <option value="">{unzugewiesenLabel}</option>
        {mitglieder.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
      </select>
      {fehler && <span role="alert" style={{ color: "var(--warn)", fontSize: ".76rem", marginLeft: 8 }}>{fehler}</span>}
    </span>
  );
}
