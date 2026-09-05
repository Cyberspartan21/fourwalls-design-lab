"use client";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n";
import { PFAD } from "@/i18n";
import type { Treffer } from "@/domain/marktplatz";
import type { Woerter } from "@/components/marktplatz/labels";
import { Karte, objektPfad } from "@/components/marktplatz/karte";
import { favorites } from "@/components/favorites";

/* Meine Merkliste: normale Ergebniskarten für alles, was noch öffentlich ist;
   für Referenzen, die es nicht (mehr) gibt, eine schlichte, deaktivierte
   Kachel mit Entfernen-Knopf. Die angezeigte Liste folgt dem Repository
   (favorites().alle()) statt starr der Serverliste — Entfernen wirkt sofort.

   Bewusst KEIN useSyncExternalStore für die Liste selbst: favorites().alle()
   gibt bei jedem Aufruf ein neues Array zurück (JSON.parse), was
   useSyncExternalStore als "jedes Mal ein anderer Snapshot" liest und in eine
   Render-Schleife treibt ("Maximum update depth exceeded", browsergeprüft).
   Ein einfacher State, der nur beim Ereignis "fw:merkliste" neu gesetzt wird,
   hat dieses Problem nicht.

   `anonymApi`: ohne Sitzung kennt der Server die lokale Merkliste nicht (sie
   lebt in localStorage) — die Komponente löst die Referenzen dann selbst über
   GET /api/favoriten/aufloesen auf, statt die vom Server mitgegebene (leere)
   `treffer`-Liste zu verwenden. */
export function FavoritenListe({ refs, treffer, locale, w, tx, anonymApi = false }: {
  refs: string[];
  treffer: Treffer[];
  locale: Locale;
  w: Woerter;
  tx: { leer: string; leerLink: string; leerLinkHref: string; nichtVerfuegbar: string; entfernen: string };
  anonymApi?: boolean;
}) {
  const [live, setLive] = useState<string[]>(refs);
  useEffect(() => {
    const aktualisieren = () => setLive(favorites().alle());
    aktualisieren();
    addEventListener("fw:merkliste", aktualisieren);
    return () => removeEventListener("fw:merkliste", aktualisieren);
  }, []);
  const [anonTreffer, setAnonTreffer] = useState<Treffer[]>([]);
  useEffect(() => {
    if (!anonymApi || live.length === 0) return;
    let abgebrochen = false;
    fetch(`/api/favoriten/aufloesen?refs=${encodeURIComponent(live.join(","))}`)
      .then(r => (r.ok ? r.json() : { treffer: [] }))
      .then((d: { treffer?: Treffer[] }) => { if (!abgebrochen) setAnonTreffer(d.treffer ?? []); })
      .catch(() => { if (!abgebrochen) setAnonTreffer([]); });
    return () => { abgebrochen = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anonymApi, live.join(",")]);
  const nachRef = new Map((anonymApi ? anonTreffer : treffer).map(t => [t.id, t]));

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
