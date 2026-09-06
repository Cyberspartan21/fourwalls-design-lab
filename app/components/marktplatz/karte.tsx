import type { Locale } from "@/i18n";
import type { Treffer } from "@/domain/marktplatz";
import { verfuegbarFrei } from "@/domain/marktplatz";
import { preisText, quelleLabel, typLabel, verfuegbarLabel, proM2, fmtIn, type Woerter } from "./labels";
import { MerkKnopf, VergleichKnopf } from "./merk-knopf";
import { AUSSAGEN } from "@/config/policy";

const GEPRUEFT_SICHTBAR = (AUSSAGEN.identitaetGeprueft.stand as string) === "bestaetigt";

/* Ergebniskarte — dieselben Klassen wie kartenHTML() im Prototyp.
   Reine Komponente ohne Server-Abhängigkeit: die Seite rendert sie, «Weitere
   anzeigen» im Browser ebenso. Die Bildadressen kommen fertig aus dem
   Suchtreffer (Speicheranbieter, serverseitig). */
export function Karte({ l, w, locale, href, aktiv = false, eager = false, onMouseEnter, onMouseLeave, onClick }: { l: Treffer; w: Woerter; locale: Locale; href: string; aktiv?: boolean; eager?: boolean; onMouseEnter?: () => void; onMouseLeave?: () => void; onClick?: () => void }) {
  const belegt = !verfuegbarFrei(l.availability.art);
  const va = l.availability.art;
  const m2 = proM2(l);
  const f = [l.rooms ? `${l.rooms} ${w.o_ziKurz}` : null, l.livingArea ? `${l.livingArea} m²` : (l.plotArea ? `${l.plotArea} m² ${w.k_landWort}` : null), typLabel(w, l.propertyType)].filter(Boolean) as string[];
  const set = (s: { width: number; url: string }[]) => s.map(x => `${x.url} ${x.width}w`).join(", ");
  /* .gitter ist ein auto-fill-Raster (minmax(296px,1fr)) — die Spaltenzahl
     wechselt fliessend zwischen 1 (mobil) und rund 5 (sehr breit). Diese
     Stufen nähern die real gemessenen Spaltenbreiten an (P5.10 §27-Audit):
     ~50vw bei 2 Spalten, ~33vw bei 3 Spalten, ~20vw ab ~1700px (4–5 Spalten). */
  const sizes = "(max-width:700px) 100vw, (max-width:1100px) 50vw, (max-width:1700px) 33vw, 20vw";
  const klein = l.bild?.jpeg.find(x => x.width === 480)?.url;
  const mitte = l.bild?.jpeg.find(x => x.width === 960)?.url;
  const preis = preisText(w, l);
  return (
    <article className={`karte${belegt ? " belegt" : ""}${aktiv ? " aktiv" : ""}`} data-slug={l.slug} data-ref={l.id} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}>
      <div className="bild">
        <div className="etikett">{l.listingTier === "exclusive" ? <span className="exkl">{w.exclusive}</span> : <span>{quelleLabel(w, l)}</span>}{l.neu && <span>{w.neu}</span>}</div>
        {belegt ? <span className="status">{verfuegbarLabel(w, locale, l.availability)}</span> : va === "sofort" ? <span className="status frei">{w.sofort}</span> : null}
        <MerkKnopf publicRef={l.id} label={w.merken!} />
        <VergleichKnopf publicRef={l.id} label={w.vg_vergleichen!} labelAktiv={w.vg_imVergleich!} labelVoll={w.vg_voll!} />
        {l.bild && (
          <picture>
            <source type="image/webp" srcSet={set(l.bild.webp)} sizes={sizes} />
            <img src={mitte} srcSet={set(l.bild.jpeg)} sizes={sizes} alt={l.title} style={{ aspectRatio: "3 / 2" }}
              {...(eager ? { loading: "eager" as const, fetchPriority: "high" as const } : { loading: "lazy" as const, decoding: "async" as const })} />
          </picture>
        )}
      </div>
      {/* .karte .refl img hat width:100%/height:auto (Spiegelung, oben abgeschnitten) — dieselbe
          Aufnahme wie oben, daher dieselbe Seitenverhältnis-Angabe (P5.9 Entscheid 23 §4). */}
      <div className="refl" aria-hidden="true">{klein && <img src={klein} alt="" loading="lazy" decoding="async" style={{ aspectRatio: "3 / 2" }} />}</div>
      <a className="oeffnen" href={href} aria-label={`${l.title}, ${preis}, ${l.city}`}></a>
      <div className="lauf">
        <div className="preis">{preis}{l.transactionType === "rent" ? <small>{w.nk}</small> : m2 ? <small>{fmtIn(m2)} {w.proM2}</small> : null}</div>
        <div className="tit">{l.title}</div>
        <div className="ort">{l.postalCode} {l.city} · {l.canton}</div>
        <div className="fakten">{f.map((x, i) => <span key={i}>{x}</span>)}<span className="q">{quelleLabel(w, l)}{GEPRUEFT_SICHTBAR && l.verificationStatus === "verified" && l.listingSource !== "fourwalls" ? " · " + w.geprueft : ""}</span></div>
      </div>
    </article>
  );
}

/* Kanonische Objektadresse aus einem Treffer — die eine Identität überall */
export function objektPfad(locale: Locale, pfad: { immobilien: string; kaufen: string; mieten: string }, l: Pick<Treffer, "slug" | "transactionType">) {
  return `/${locale}/${pfad.immobilien}/${l.transactionType === "rent" ? pfad.mieten : pfad.kaufen}/${l.slug}`;
}
