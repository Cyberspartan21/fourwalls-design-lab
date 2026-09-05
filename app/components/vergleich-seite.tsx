"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Locale } from "@/i18n";
import { PFAD } from "@/i18n";
import type { Treffer, Typ } from "@/domain/marktplatz";
import type { Woerter } from "@/components/marktplatz/labels";
import { preisText, proM2, quelleLabel, typLabel, verfuegbarLabel, fmtIn } from "@/components/marktplatz/labels";
import { objektPfad } from "@/components/marktplatz/karte";
import { vergleich } from "@/components/vergleich";

const abo = (cb: () => void) => { addEventListener("fw:vergleich", cb); return () => removeEventListener("fw:vergleich", cb); };
const LEER: string[] = [];

/* Dieselbe Regel wie domain/entwurf.ts (OHNE_ZIMMER/OHNE_WOHNFLAECHE) — hier
   dupliziert, weil jene Datei aus der Server-Domäne kommt (Zod-Schema) und
   dieses schlanke Client-Bundle das nicht braucht (P5.6 §33). */
const OHNE_ZIMMER: Typ[] = ["grundstueck", "parkplatz", "gewerbe", "mfh"];
const OHNE_WOHNFLAECHE: Typ[] = ["grundstueck", "parkplatz"];
const GRUNDSTUECK_TYPEN: Typ[] = ["grundstueck", "haus", "villa", "chalet"];
const ETAGE_TYPEN: Typ[] = ["wohnung", "gewerbe"];
const DASH = "—";

export interface VergleichTx {
  leer: string; leerLink: string; entfernen: string; ansehen: string;
  preis: string; proM2: string; ort: string; typ: string; verfuegbarkeit: string; anbieter: string;
  zimmer: string; wohnflaeche: string; grundstueck: string; baujahr: string; etage: string;
}

interface Zeile { label: string; zeigen(t: Treffer[]): boolean; wert(t: Treffer): string }

function zeilen(w: Woerter, tx: VergleichTx, locale: Locale): Zeile[] {
  return [
    { label: tx.preis, zeigen: () => true, wert: t => preisText(w, t) },
    { label: tx.proM2, zeigen: ts => ts.some(t => proM2(t) != null), wert: t => { const m = proM2(t); return m != null ? `${fmtIn(m)} ${w.proM2}` : DASH; } },
    { label: tx.ort, zeigen: () => true, wert: t => `${t.postalCode} ${t.city}` },
    { label: tx.typ, zeigen: () => true, wert: t => typLabel(w, t.propertyType) },
    { label: tx.verfuegbarkeit, zeigen: () => true, wert: t => verfuegbarLabel(w, locale, t.availability) },
    { label: tx.anbieter, zeigen: () => true, wert: t => quelleLabel(w, t) },
    { label: tx.zimmer, zeigen: ts => ts.some(t => !OHNE_ZIMMER.includes(t.propertyType)), wert: t => !OHNE_ZIMMER.includes(t.propertyType) && t.rooms != null ? String(t.rooms) : DASH },
    { label: tx.wohnflaeche, zeigen: ts => ts.some(t => !OHNE_WOHNFLAECHE.includes(t.propertyType)), wert: t => !OHNE_WOHNFLAECHE.includes(t.propertyType) && t.livingArea != null ? `${t.livingArea} m²` : DASH },
    { label: tx.grundstueck, zeigen: ts => ts.some(t => GRUNDSTUECK_TYPEN.includes(t.propertyType)), wert: t => GRUNDSTUECK_TYPEN.includes(t.propertyType) && t.plotArea != null ? `${t.plotArea} m²` : DASH },
    { label: tx.baujahr, zeigen: ts => ts.some(t => t.yearBuilt != null), wert: t => t.yearBuilt != null ? String(t.yearBuilt) : DASH },
    { label: tx.etage, zeigen: ts => ts.some(t => ETAGE_TYPEN.includes(t.propertyType)), wert: t => ETAGE_TYPEN.includes(t.propertyType) && t.floor != null ? String(t.floor) : DASH }
  ];
}

export function VergleichSeite({ locale, w, tx }: { locale: Locale; w: Woerter; tx: VergleichTx }) {
  /* Die Referenzliste kommt reaktiv aus dem Repository — kein eigener
     Ladeeffekt nötig, wie bei MerkKnopf/Kopf (useSyncExternalStore). */
  const refs = useSyncExternalStore(abo, () => vergleich().alle(), () => LEER);
  const [treffer, setTreffer] = useState<Treffer[]>([]);
  const [fertig, setFertig] = useState(false);

  useEffect(() => {
    let abgebrochen = false;
    fetch(`/api/vergleich?refs=${refs.map(encodeURIComponent).join(",")}`)
      .then(r => r.json())
      .then((d: { treffer: Treffer[] }) => {
        if (abgebrochen) return;
        const nach = new Map(d.treffer.map(t => [t.id, t] as const));
        setTreffer(refs.map(r => nach.get(r)).filter((t): t is Treffer => !!t));
        setFertig(true);
      })
      .catch(() => { if (!abgebrochen) { setTreffer([]); setFertig(true); } });
    return () => { abgebrochen = true; };
  }, [refs]);

  function entfernen(ref: string) {
    vergleich().entfernen(ref);
    setTreffer(prev => prev.filter(t => t.id !== ref));
  }

  if (refs.length === 0 || (fertig && treffer.length === 0)) {
    const p = PFAD[locale];
    return <p style={{ color: "var(--leise)", marginTop: 16 }}>{tx.leer} <a href={`/${locale}/${p.immobilien}/${p.kaufen}`}>{tx.leerLink}</a></p>;
  }
  if (!fertig) return null;

  const z = zeilen(w, tx, locale).filter(zeile => zeile.zeigen(treffer));

  return (
    <div style={{ overflowX: "auto", marginTop: 16 }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
        <thead>
          <tr>
            <th></th>
            {treffer.map(t => (
              <th key={t.id} style={{ padding: "0 16px 12px", textAlign: "left", minWidth: 200, verticalAlign: "top" }}>
                {t.bild && <img src={t.bild.jpeg.find(x => x.width === 480)?.url ?? t.bild.jpeg[0]?.url} alt="" style={{ width: "100%", aspectRatio: "3/2", objectFit: "cover" }} />}
                <div style={{ marginTop: 8, fontWeight: 500 }}>{t.title}</div>
                <div style={{ marginTop: 6, display: "flex", gap: 10 }}>
                  <a href={objektPfad(locale, PFAD[locale], t)}>{tx.ansehen}</a>
                  <button type="button" onClick={() => entfernen(t.id)} aria-label={tx.entfernen} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--leise)" }}>× {tx.entfernen}</button>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {z.map(zeile => (
            <tr key={zeile.label} style={{ borderTop: "1px solid var(--linie)" }}>
              <th style={{ textAlign: "left", padding: "10px 16px 10px 0", whiteSpace: "nowrap", color: "var(--leise)", fontWeight: 400 }}>{zeile.label}</th>
              {treffer.map(t => <td key={t.id} style={{ padding: "10px 16px" }}>{zeile.wert(t)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
