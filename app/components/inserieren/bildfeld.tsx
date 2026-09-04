"use client";
import { useEffect, useState } from "react";
import type { Entwurf } from "@/domain/entwurf";

/* Bilder — auswählen, hochladen, sortieren.

   Vor dem Hochladen rechnet der Browser das Bild auf Anzeigegrösse herunter
   (Canvas, längste Kante 1600). Das spart Übertragung und entfernt nebenbei
   alle Kameradaten, weil ein neu gezeichnetes Bild keine EXIF-Abschnitte hat.
   Verlassen tun wir uns darauf nicht: der Server prüft Format und Grösse
   selbst und schneidet Metadaten heraus (§33/§34).

   Das erste Bild ist das Titelbild — so, wie die Ergebniskarte es zeigt. */

interface Bild { id: string; url: string; breite: number | null; hoehe: number | null }

export function BildFeld({ daten, aendern, t, angemeldet, fehlt }:
  { daten: Entwurf; aendern: (t: Partial<Entwurf>) => void; t: Record<string, string>; angemeldet: boolean; fehlt: boolean }) {
  const [meine, setMeine] = useState<Bild[]>([]);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!angemeldet) return;
    fetch("/api/medien").then(r => r.json()).then(a => setMeine(a.bilder ?? [])).catch(() => { /* leer */ });
  }, [angemeldet]);

  async function hochladen(dateien: FileList | null) {
    if (!dateien?.length) return;
    setFehler(null); setLaedt(true);
    try {
      for (const datei of Array.from(dateien).slice(0, 8)) {
        const klein = await verkleinern(datei);
        const form = new FormData();
        form.append("datei", klein, datei.name.replace(/[^\w.-]/g, "_"));
        const r = await fetch("/api/medien", { method: "POST", body: form });
        const a = await r.json().catch(() => ({}));
        if (!r.ok) { setFehler(a?.message ?? t.w_speicherFehler!); continue; }
        setMeine(m => [a, ...m]);
        aendern({ bilder: [...daten.bilder, a.id].slice(0, 20) });
      }
    } finally { setLaedt(false); }
  }

  const gewaehlt = daten.bilder;
  return (
    <>
      <div className="fld">
        <label htmlFor="wBild">{t.w_bildHochladen}</label>
        <input id="wBild" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!angemeldet || laedt}
          onChange={e => hochladen(e.target.files)}
          style={{ display: "block", fontSize: ".85rem", color: "var(--leise)" }} />
        <p className="hin" style={{ color: "var(--leise)", fontSize: ".78rem", marginTop: 6 }}>{t.w_bilderHin}</p>
        {!angemeldet && <p className="hin" style={{ color: "var(--leise)", fontSize: ".8rem" }}>{t.w_anmeldenNoetigText}</p>}
        {laedt && <p className="hin" aria-live="polite" style={{ fontSize: ".8rem" }}>{t.w_speichert}</p>}
        {fehler && <p className="fehler" role="alert">{fehler}</p>}
        {fehlt && <p className="fehler" role="alert">{t.w_bildFehler}</p>}
      </div>

      {gewaehlt.length > 0 && (
        <div className="fld">
          <label>{t.w_gewaehlteBilder}</label>
          <div className="bildwahl">
            {gewaehlt.map((id, n) => {
              const b = meine.find(x => x.id === id);
              return (
                <div key={id} style={{ position: "relative" }}>
                  <button type="button" aria-pressed="true" style={{ padding: 0, overflow: "hidden" }}
                    onClick={() => aendern({ bilder: gewaehlt.filter(x => x !== id) })}
                    aria-label={`${t.w_bildEntfernen}: ${n + 1}`}>
                    {b && <img src={b.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
                  </button>
                  {n === 0 && <span style={{ position: "absolute", left: 6, top: 6, fontSize: ".55rem", letterSpacing: ".12em", textTransform: "uppercase", background: "var(--licht)", color: "#0B121B", padding: "2px 6px", borderRadius: "var(--r)" }}>{t.w_titelbild}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {meine.filter(b => !gewaehlt.includes(b.id)).length > 0 && (
        <div className="fld">
          <label>{t.w_meineBilder}</label>
          <div className="bildwahl">
            {meine.filter(b => !gewaehlt.includes(b.id)).map(b => (
              <button key={b.id} type="button" aria-pressed="false" style={{ padding: 0, overflow: "hidden" }}
                onClick={() => aendern({ bilder: [...gewaehlt, b.id].slice(0, 20) })}>
                <img src={b.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* Auf Anzeigegrösse rechnen. Schlägt das fehl (sehr grosse oder kaputte
   Datei), geht das Original an den Server — der prüft ohnehin selbst. */
async function verkleinern(datei: File, maxKante = 1600): Promise<Blob> {
  try {
    const bild = await createImageBitmap(datei);
    const faktor = Math.min(1, maxKante / Math.max(bild.width, bild.height));
    if (faktor >= 1 && datei.size < 1_500_000) { bild.close(); return datei; }
    const b = Math.round(bild.width * faktor), h = Math.round(bild.height * faktor);
    const leinwand = document.createElement("canvas");
    leinwand.width = b; leinwand.height = h;
    const ctx = leinwand.getContext("2d");
    if (!ctx) { bild.close(); return datei; }
    ctx.drawImage(bild, 0, 0, b, h);
    bild.close();
    const blob = await new Promise<Blob | null>(ok => leinwand.toBlob(ok, "image/jpeg", 0.86));
    return blob ?? datei;
  } catch { return datei; }
}
