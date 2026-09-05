"use client";
import { useState, useSyncExternalStore } from "react";
import { favorites } from "@/components/favorites";
import { vergleich } from "@/components/vergleich";

const HERZ = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 20s-7-4.6-9.2-8.8C1.2 8 3 5 6.2 5c2 0 3.3 1 4.3 2.4h3c1-1.4 2.3-2.4 4.3-2.4 3.2 0 5 3 3.4 6.2C19 15.4 12 20 12 20Z" /></svg>;
const WAAGE = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 3v18M7 21h10M4 8l3-4 3 4M14 8l3-4 3 4M4 8a3 3 0 0 0 6 0M14 8a3 3 0 0 0 6 0" /></svg>;

const abo = (cb: () => void) => { addEventListener("fw:merkliste", cb); addEventListener("storage", cb); return () => { removeEventListener("fw:merkliste", cb); removeEventListener("storage", cb); }; };
const vergleichAbo = (cb: () => void) => { addEventListener("fw:vergleich", cb); return () => removeEventListener("fw:vergleich", cb); };

/* Merken auf der Ergebniskarte — Schlüssel ist die öffentliche Referenz, wie auf der Objektseite */
export function MerkKnopf({ publicRef, label }: { publicRef: string; label: string }) {
  const an = useSyncExternalStore(abo, () => favorites().hat(publicRef), () => false);
  return <button className="merk" data-fav={publicRef} aria-pressed={an} aria-label={label} onClick={e => { e.preventDefault(); e.stopPropagation(); favorites().kippen(publicRef); }}>{HERZ}</button>;
}

/* Vergleichen auf der Ergebniskarte — dasselbe Muster wie MerkKnopf, daneben
   platziert (Modifikator "vgl", siehe styles/portal.css). Bei voller Liste
   (höchstens vier, components/vergleich.ts) kein Modal: nur title (Tooltip)
   und ein unsichtbarer aria-live-Hinweis für Screenreader — keine sichtbare
   Änderung an der Karte. */
export function VergleichKnopf({ publicRef, label, labelAktiv, labelVoll }: { publicRef: string; label: string; labelAktiv: string; labelVoll: string }) {
  const an = useSyncExternalStore(vergleichAbo, () => vergleich().hat(publicRef), () => false);
  const [voll, setVoll] = useState(false);
  return (
    <button
      className="merk vgl"
      data-vgl={publicRef}
      aria-pressed={an}
      aria-label={an ? labelAktiv : label}
      title={voll ? labelVoll : undefined}
      onClick={e => {
        e.preventDefault();
        e.stopPropagation();
        if (an) { vergleich().entfernen(publicRef); return; }
        const ok = vergleich().hinzufuegen(publicRef);
        if (!ok) { setVoll(true); setTimeout(() => setVoll(false), 4000); }
      }}
    >
      {WAAGE}
      <span aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{voll ? labelVoll : ""}</span>
    </button>
  );
}

/* Zähler im Kopf */
export function MerkZahl() {
  const n = useSyncExternalStore(abo, () => favorites().alle().length, () => 0);
  return <span className="zaehl" id="favZahl">{n}</span>;
}
