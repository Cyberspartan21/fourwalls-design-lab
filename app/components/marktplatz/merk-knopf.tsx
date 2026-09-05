"use client";
import { useSyncExternalStore } from "react";
import { favorites } from "@/components/favorites";

const HERZ = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 20s-7-4.6-9.2-8.8C1.2 8 3 5 6.2 5c2 0 3.3 1 4.3 2.4h3c1-1.4 2.3-2.4 4.3-2.4 3.2 0 5 3 3.4 6.2C19 15.4 12 20 12 20Z" /></svg>;

const abo = (cb: () => void) => { addEventListener("fw:merkliste", cb); addEventListener("storage", cb); return () => { removeEventListener("fw:merkliste", cb); removeEventListener("storage", cb); }; };

/* Merken auf der Ergebniskarte — Schlüssel ist die öffentliche Referenz, wie auf der Objektseite */
export function MerkKnopf({ publicRef, label }: { publicRef: string; label: string }) {
  const an = useSyncExternalStore(abo, () => favorites().hat(publicRef), () => false);
  return <button className="merk" data-fav={publicRef} aria-pressed={an} aria-label={label} onClick={e => { e.preventDefault(); e.stopPropagation(); favorites().kippen(publicRef); }}>{HERZ}</button>;
}

/* Zähler im Kopf */
export function MerkZahl() {
  const n = useSyncExternalStore(abo, () => favorites().alle().length, () => 0);
  return <span className="zaehl" id="favZahl">{n}</span>;
}
