"use client";
import { useSyncExternalStore } from "react";
import type { Locale } from "@/i18n";
import { PFAD } from "@/i18n";
import type { Treffer } from "@/domain/marktplatz";
import type { Woerter } from "@/components/marktplatz/labels";
import { Karte, objektPfad } from "@/components/marktplatz/karte";
import { favorites } from "@/components/favorites";

/* Meine Merkliste: normale Ergebniskarten für alles, was noch öffentlich ist;
   für Referenzen, die es nicht (mehr) gibt, eine schlichte, deaktivierte
   Kachel mit Entfernen-Knopf. Die angezeigte Liste folgt dem Repository
   (favorites().alle()) statt starr der Serverliste — Entfernen wirkt sofort. */
const abo = (cb: () => void) => { addEventListener("fw:merkliste", cb); return () => removeEventListener("fw:merkliste", cb); };

export function FavoritenListe({ refs, treffer, locale, w, tx }: {
  refs: string[];
  treffer: Treffer[];
  locale: Locale;
  w: Woerter;
  tx: { leer: string; leerLink: string; leerLinkHref: string; nichtVerfuegbar: string; entfernen: string };
}) {
  const live = useSyncExternalStore(abo, () => favorites().alle(), () => refs);
  const nachRef = new Map(treffer.map(t => [t.id, t]));

  if (live.length === 0) {
    return <p style={{ color: "var(--leise)", marginTop: 16 }}>{tx.leer} <a href={tx.leerLinkHref}>{tx.leerLink}</a></p>;
  }

  return (
    <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
      {live.map(ref => {
        const t = nachRef.get(ref);
        if (t) return <li key={ref}><Karte l={t} w={w} locale={locale} href={objektPfad(locale, PFAD[locale], t)} /></li>;
        return (
          <li key={ref} style={{ border: "1px solid var(--linie)", borderRadius: 8, padding: 16, opacity: .65 }}>
            <p style={{ margin: 0 }}>{tx.nichtVerfuegbar}</p>
            <button className="knopf leise" style={{ marginTop: 10 }} onClick={() => favorites().kippen(ref)}>{tx.entfernen}</button>
          </li>
        );
      })}
    </ul>
  );
}
