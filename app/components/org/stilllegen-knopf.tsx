"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n";

/* Organisation stilllegen (P5.7 §8) — kein Löschen, siehe
   server/organisationen.ts:stilllegen. Der Server meldet CONFLICT, solange
   noch Inserate veröffentlicht oder in Prüfung sind; diese Meldung erscheint
   hier unverändert. */
export function StilllegenKnopf({ locale, slug, label, bestaetigen }: { locale: Locale; slug: string; label: string; bestaetigen: string }) {
  const router = useRouter();
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function stilllegen() {
    if (typeof window !== "undefined" && !window.confirm(bestaetigen)) return;
    setLaeuft(true); setFehler(null);
    try {
      const res = await fetch(`/api/org/${slug}`, { method: "DELETE" });
      const a = await res.json().catch(() => ({}));
      if (!res.ok) { setFehler(a?.message ?? "—"); return; }
      router.push(`/${locale}/konto`);
      router.refresh();
    } finally { setLaeuft(false); }
  }

  return (
    <div>
      <button type="button" className="knopf" disabled={laeuft} onClick={stilllegen}>{laeuft ? "…" : label}</button>
      {fehler && <p role="alert" style={{ color: "var(--warn)", fontSize: ".82rem", marginTop: 10 }}>{fehler}</p>}
    </div>
  );
}
