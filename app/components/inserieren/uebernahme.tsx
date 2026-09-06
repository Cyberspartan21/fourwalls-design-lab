"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n";
import { vorabHolen, vorabLoeschen } from "./assistent";

/* Nach der Anmeldung: den vorab eingegebenen Stand in einen echten Entwurf
   überführen und dorthin weiterleiten. Läuft einmal, im Browser, weil nur
   dort der sessionStorage liegt (§23). */
export function VorabUebernahme({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [fehler, setFehler] = useState<string | null>(null);
  const lief = useRef(false);

  useEffect(() => {
    if (lief.current) return;
    lief.current = true;
    (async () => {
      const vorab = vorabHolen();
      const r = await fetch("/api/entwuerfe", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(vorab ? { daten: vorab } : {})
      });
      const a = await r.json().catch(() => ({}));
      if (!r.ok) { setFehler(a?.message ?? "—"); return; }
      vorabLoeschen();
      router.replace(`/${locale}/inserieren/${String(a.publicRef).toLowerCase()}`);
    })();
  }, [locale, router]);

  return (
    <main id="inhalt" className="wiz an">
      <p aria-live="polite" style={{ color: "var(--leise)" }}>{fehler ?? "…"}</p>
    </main>
  );
}
