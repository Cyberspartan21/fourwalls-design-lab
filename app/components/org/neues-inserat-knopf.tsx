"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n";

/* «Neues Inserat» — legt sofort einen Entwurf unter der Organisation an
   (POST /api/org/<slug>/inserate) und führt in den bestehenden Assistenten
   (P5.7 §4). Dieselbe Handlung auf Übersicht und Inseratsliste. */
export function NeuesInseratKnopf({ locale, slug, label, voll = false }: { locale: Locale; slug: string; label: string; voll?: boolean }) {
  const router = useRouter();
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function anlegen() {
    setLaeuft(true);
    setFehler(null);
    try {
      const res = await fetch(`/api/org/${slug}/inserate`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const a = await res.json().catch(() => ({}));
      if (!res.ok) { setFehler(a?.message ?? "—"); setLaeuft(false); return; }
      router.push(`/${locale}/inserieren/${String(a.publicRef).toLowerCase()}`);
    } catch {
      setFehler("—");
      setLaeuft(false);
    }
  }

  return (
    <span>
      <button type="button" className={`knopf${voll ? " voll" : ""}`} disabled={laeuft} onClick={anlegen}>{laeuft ? "…" : label}</button>
      {fehler && <span role="alert" style={{ color: "var(--warn)", fontSize: ".78rem", marginLeft: 10 }}>{fehler}</span>}
    </span>
  );
}
