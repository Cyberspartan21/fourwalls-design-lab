"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/* Statuswechsel eines Anliegens — nur die erlaubten Übergänge als Knöpfe
   (P5.8 §26). Der Server prüft den Übergang erneut (server/anliegen.ts,
   UEBERGAENGE) — dieser Client weiss nur, welche Knöpfe zu zeigen sind. */
export function LeadAktionen({ publicRef, erlaubt, labels, speichertLabel, fehlerLabel }:
  { publicRef: string; erlaubt: string[]; labels: Record<string, string>; speichertLabel: string; fehlerLabel: string }) {
  const router = useRouter();
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function setzen(status: string) {
    setLaeuft(true); setFehler(null);
    try {
      const r = await fetch(`/api/intern/anliegen/${publicRef}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status })
      });
      const a = await r.json().catch(() => ({}));
      if (!r.ok) { setFehler(a?.message ?? fehlerLabel); return; }
      router.refresh();
    } catch { setFehler(fehlerLabel); }
    finally { setLaeuft(false); }
  }

  if (erlaubt.length === 0) return null;

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {erlaubt.map(s => (
          <button key={s} className="knopf" disabled={laeuft} onClick={() => void setzen(s)}>
            {laeuft ? speichertLabel : labels[s] ?? s}
          </button>
        ))}
      </div>
      {fehler && <p className="fehler" role="alert" style={{ color: "var(--warn)", marginTop: 10 }}>{fehler}</p>}
    </div>
  );
}
