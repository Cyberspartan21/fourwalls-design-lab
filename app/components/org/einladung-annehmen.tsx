"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n";

/* Einladung annehmen (P5.7 §9) — POST /api/einladungen/<token>. Welche
   Adresse eingeladen wurde, entscheidet ausschliesslich der Server anhand
   der Kontoadresse (server/einladungen.ts:annehmen); diese Seite schickt
   nichts als den Token. */
export function EinladungAnnehmenKnopf({ locale, token, label, weiterHin }: { locale: Locale; token: string; label: string; weiterHin: string }) {
  const router = useRouter();
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [angenommen, setAngenommen] = useState(false);

  async function annehmen() {
    setLaeuft(true); setFehler(null);
    try {
      const res = await fetch(`/api/einladungen/${token}`, { method: "POST" });
      const a = await res.json().catch(() => ({}));
      if (!res.ok) { setFehler(a?.message ?? "—"); return; }
      setAngenommen(true);
      router.push(`/${locale}/konto/org/${a.orgSlug}`);
      router.refresh();
    } finally { setLaeuft(false); }
  }

  if (angenommen) return <p role="status" style={{ color: "var(--leise)" }}>{weiterHin}</p>;

  return (
    <div>
      <button type="button" className="knopf voll gross" disabled={laeuft} onClick={annehmen}>{laeuft ? "…" : label}</button>
      {fehler && <p role="alert" style={{ color: "var(--warn)", fontSize: ".82rem", marginTop: 10 }}>{fehler}</p>}
    </div>
  );
}
