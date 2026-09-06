import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { LOCALES, PFAD, istLocale, uebersetzer, type Locale } from "@/i18n";
import { sql } from "@/server/db";
import { seoMeta } from "@/lib/seo";
import { suche, anfrageAusParams, paramsAusAnfrage } from "@/server/search";
import { getPlace } from "@/server/geo";
import { sitzung } from "@/server/sitzung";
import type { Suchanfrage } from "@/domain/marktplatz";
import { woerter, mitMerkmalen, trefferLabel, typLabel, chfText } from "@/components/marktplatz/labels";
import { Karte, objektPfad } from "@/components/marktplatz/karte";
import { Wasserlinie } from "@/components/marktplatz/wasserlinie";
import { Chips, ResultKopf, MehrLaden, AboZeile } from "@/components/marktplatz/steuerung";
import { Leer, wegeBauen } from "@/components/marktplatz/leer";
import { KartenAnsicht } from "@/components/marktplatz/karten-ansicht";
import { Kopf } from "@/components/site/kopf";

/* /de/immobilien/kaufen?ort=ort-zuerich&um=10&typ=wohnung&pmax=1500000&seite=2
   /de/immobilien/mieten · /fr/immobilier/acheter · …?ansicht=karte

   Die Suche lebt in der Adresse; der Server rendert die Treffer. Filter sind
   Client-Inseln, die navigieren. Karte nur im Kartenmodus (faul geladen).
   SEO-Grenze: die Bereichsseiten (kaufen/mieten je Sprache, mit Ort) sind
   indexierbar; alles mit weiteren Filtern trägt noindex + Canonical auf die
   Bereichsseite mit Ort. */
export const dynamic = "force-dynamic";
type Params = { locale: string; bereich: string; art: string };
type Query = Record<string, string | string[] | undefined>;

function bereichPruefen(locale: Locale, bereich: string, art: string): "buy" | "rent" | null {
  const p = PFAD[locale];
  if (bereich !== p.immobilien) return null;
  return art === p.kaufen ? "buy" : art === p.mieten ? "rent" : null;
}
const basisPfad = (l: Locale, trans: "buy" | "rent") => `/${l}/${PFAD[l].immobilien}/${trans === "rent" ? PFAD[l].mieten : PFAD[l].kaufen}`;
const nurOrt = (q: Suchanfrage) => { const p = new URLSearchParams(); if (q.ort) p.set("ort", q.ort); return p.toString() ? "?" + p.toString() : ""; };
const hatFilter = (q: Suchanfrage) => !!(q.typ || q.pMin != null || q.pMax != null || q.ziMin != null || q.ziMax != null || q.flMin != null || q.flMax != null || q.grMin != null || q.bjVon != null || q.bjBis != null || q.etage || q.verf || q.feat.length || q.quelle || q.umkreisKm > 0 || !q.nurFrei || q.bounds || q.sort !== "neu" || q.seite > 1 || q.modus === "map");

export async function generateMetadata({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Query> }): Promise<Metadata> {
  const { locale, bereich, art } = await params; if (!istLocale(locale)) return {};
  const trans = bereichPruefen(locale, bereich, art); if (!trans) return {};
  const q = anfrageAusParams(await searchParams, trans);
  const t = uebersetzer(locale);
  const ort = q.ort ? await getPlace(q.ort, locale) : null;
  const art_ = t(trans === "rent" ? "mieten" : "kaufen");
  const titel = ort ? t("seo_titelMitOrt").replace("{art}", art_).replace("{ort}", ort.label) : t("seo_titelOhneOrt").replace("{art}", art_);
  const beschreibung = t(trans === "rent" ? "seo_mieten_beschreibung" : "seo_kaufen_beschreibung");
  const pfade = Object.fromEntries(LOCALES.map(l => [l, basisPfad(l, trans) + nurOrt(q)])) as Record<Locale, string>;
  return seoMeta({ locale, pfade, titel, beschreibung, robots: hatFilter(q) ? { index: false, follow: true } : undefined });
}

export default async function Suche({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Query> }) {
  const { locale, bereich, art } = await params;
  if (!istLocale(locale)) notFound();
  const trans = bereichPruefen(locale, bereich, art);
  if (!trans) {
    /* Bereich stimmt, Art nicht: auf «kaufen» in dieser Sprache — sonst 404 */
    if (bereich === PFAD[locale].immobilien) permanentRedirect(basisPfad(locale, "buy"));
    notFound();
  }
  const sp = await searchParams;
  const q = anfrageAusParams(sp, trans);
  const t = uebersetzer(locale);
  const merkmale = await sql`SELECT key, coalesce(${sql("name_" + locale)}, name_de) AS name FROM feature ORDER BY sort_order`;
  const w = mitMerkmalen(woerter(t), merkmale.map(m => ({ key: String(m.key), name: String(m.name) })));
  const basis = basisPfad(locale, trans);
  const pfad = PFAD[locale];
  const ort = q.ort ? await getPlace(q.ort, locale) : null;
  const antwort = await suche(q, locale);
  const s = await sitzung();
  const titel = (trans === "rent" ? w.mieten : w.kaufen) + (antwort.geo.label ? " · " + antwort.geo.label + (q.umkreisKm ? ` + ${q.umkreisKm} ${w.km}` : "") : "");
  const zusammenfassung = [ort?.label, trans === "rent" ? w.mieten : w.kaufen, q.typ ? typLabel(w, q.typ) : "", q.ziMin ? `${q.ziMin}+ ${w.o_ziKurz}` : "", q.pMax ? "≤ " + chfText(q.pMax) : ""].filter(Boolean).join(" · ");
  /* Sprachlinks folgen derselben Regel wie Canonical/hreflang (generateMetadata
     oben): mit weiteren Filtern nur der Ort, sonst die volle Suche. */
  const sprachLinks = Object.fromEntries(LOCALES.map(l => {
    if (hatFilter(q)) return [l, basisPfad(l, trans) + nurOrt(q)];
    const p = paramsAusAnfrage({ ...q, seite: 1 });
    return [l, basisPfad(l, trans) + (p.toString() ? "?" + p.toString() : "")];
  })) as Record<Locale, string>;

  /* Nullzustand: Wege mit echten Zahlen — dieselbe Suche, gezählt */
  let wege: ReturnType<typeof wegeBauen> = [];
  if (antwort.total === 0 && q.modus !== "map") {
    const zaehle = async (aend: Partial<Suchanfrage>) => (await suche({ ...q, ...aend, seite: 1, proSeite: 1, modus: "list" }, locale)).total;
    let umkreis: [number, number] | null = null;
    if (ort && (ort.typ === "ort" || ort.typ === "plz")) for (const km of [10, 20, 50]) { const n = await zaehle({ umkreisKm: km }); if (n > 0) { umkreis = [km, n]; break; } }
    const hoch = q.pMax != null ? Math.round(q.pMax * 1.25 / 10000) * 10000 : null;
    const budget = hoch != null ? [hoch, await zaehle({ pMax: hoch })] as [number, number] : null;
    const zimmer = q.ziMin != null ? await zaehle({ ziMin: Math.max(1, q.ziMin - 1) }) : null;
    const flaeche = q.flMin != null ? await zaehle({ flMin: null }) : null;
    const baujahr = q.bjVon != null || q.bjBis != null ? await zaehle({ bjVon: null, bjBis: null }) : null;
    const typ = q.typ ? await zaehle({ typ: "" }) : null;
    const feat = q.feat.length ? await zaehle({ feat: [] }) : null;
    const etageVerf = q.etage || q.verf ? await zaehle({ etage: "", verf: "" }) : null;
    let kanton: [string, string, number] | null = null;
    if (ort?.typ === "ort" && ort.kt) { const kt = await getPlace("kt-" + ort.kt, locale); if (kt) { const n = await zaehle({ ort: kt.id, umkreisKm: 0 }); if (n > 0) kanton = [kt.id, kt.label, n]; } }
    const alles = await zaehle({ ort: null, umkreisKm: 0, typ: "", pMin: null, pMax: null, ziMin: null, ziMax: null, flMin: null, flMax: null, grMin: null, bjVon: null, bjBis: null, etage: "", verf: "", nurFrei: true, feat: [], quelle: "" });
    wege = wegeBauen(q, w, ort, { umkreis, budget: budget && budget[1] > 0 ? budget : null, zimmer: zimmer && zimmer > 0 ? zimmer : null, flaeche: flaeche && flaeche > 0 ? flaeche : null, baujahr: baujahr && baujahr > 0 ? baujahr : null, typ: typ && typ > 0 ? typ : null, feat: feat && feat > 0 ? feat : null, etageVerf: etageVerf && etageVerf > 0 ? etageVerf : null, kanton, alles });
  }

  return (
    <>
      <Kopf locale={locale} aktuell="immobilien" sprachLinks={sprachLinks} bereich={trans === "rent" ? "mieten" : "kaufen"} />
      <main id="inhalt" className="portal">
        {q.modus === "map" ? (
          <section className="ansicht an" id="a-karte">
            <KartenAnsicht q={q} initial={antwort} w={w} locale={locale} pfad={pfad} basis={basis} />
          </section>
        ) : (
          <section className="ansicht an" id="a-suche">
            <Wasserlinie key={"filter:" + JSON.stringify(q)} q={q} ort={ort ? { id: ort.id, label: ort.label, typ: ort.typ } : null} w={w} locale={locale} basis={{ kaufen: basisPfad(locale, "buy"), mieten: basisPfad(locale, "rent") }} seiteVon="" ansichtKarte={false} total={antwort.total} />
            <Chips q={q} ortLabel={ort?.label ?? null} w={w} basis={basis} />
            <ResultKopf q={q} titel={titel} total={antwort.total} w={w} basis={basis} />
            {antwort.total > 0 && <div className="gitter" id="gitter">{antwort.treffer.map(l => <Karte key={l.id} l={l} w={w} locale={locale} href={objektPfad(locale, pfad, l)} />)}</div>}
            <MehrLaden key={"mehr:" + JSON.stringify(q)} q={q} total={antwort.total} geladen={antwort.treffer.length} w={w} locale={locale} pfad={pfad} basis={basis} />
            {antwort.total === 0 && <Leer q={q} wege={wege} w={w} basis={basis} />}
            <AboZeile q={q} zusammenfassung={zusammenfassung || (trans === "rent" ? w.mieten! : w.kaufen!)} total={antwort.total} w={w} locale={locale} angemeldet={!!s} />
          </section>
        )}
      </main>
    </>
  );
}
