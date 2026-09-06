import type { Dossier, Abschnitt } from "@/domain/dossier";
import type { Locale, T } from "@/i18n";
import { PFAD, LOCALES } from "@/i18n";
import type { Treffer } from "@/domain/marktplatz";
import { Karte as Ergebniskarte, objektPfad } from "@/components/marktplatz/karte";
import type { Woerter } from "@/components/marktplatz/labels";
import { Bild } from "./bild";
import { Kopf } from "./kopf";
import { Blende } from "./blende";
import { Anker } from "./anker";
import { Beschreibung } from "./uebersicht";
import { Galerie } from "./galerie";
import { Grundrisse } from "./grundrisse";
import { LageKarte } from "./lage-karte";
import { Finanzierung } from "./finanzierung";
import { Begleiter } from "./begleiter";
import { LichtKnopf, AnfrageKnopf, AnkerLink } from "./knoepfe";
import { VerlaufEintragen } from "./verlauf-eintragen";
import { VerlaufListe } from "@/components/verlauf-liste";
import { AUSSAGEN } from "@/config/policy";

/* Die Objektseite — Server-Markup mit denselben Klassen wie objekt.js.
   Übersicht zuerst, Tiefe auf Abruf. Abschnitte ohne Inhalt entstehen nicht
   (das entscheidet domain/dossier.ts, nicht diese Datei). */

const KANTON: Record<string, string> = { ZH: "Zürich", BE: "Bern", LU: "Luzern", ZG: "Zug", BS: "Basel-Stadt", BL: "Basel-Landschaft", GE: "Genf", VD: "Waadt", VS: "Wallis", TI: "Tessin", SG: "St. Gallen", GR: "Graubünden", AG: "Aargau", SO: "Solothurn", FR: "Freiburg", NE: "Neuenburg", SH: "Schaffhausen", SZ: "Schwyz", UR: "Uri", OW: "Obwalden", NW: "Nidwalden", TG: "Thurgau", GL: "Glarus", AR: "Appenzell AR", AI: "Appenzell IR", JU: "Jura" };

/* Abschnitt nur, wenn das Dossier ihn führt — sonst nichts. */
function Abs({ id, abschnitte, children }: { id: string; abschnitte: Abschnitt[]; children: React.ReactNode }) {
  const a = abschnitte.find(x => x.id === id); if (!a) return null;
  return <section className="dabs" id={`d-${id}`}><h2>{a.titel}{a.klein && <small>{a.klein}</small>}</h2>{children}</section>;
}

void LOCALES;
const keys = (t: T, ks: string[]) => Object.fromEntries(ks.map(k => [k, t(k)]));

function Kompass({ ausrichtung, locale, label }: { ausrichtung: string; locale: Locale; label: string }) {
  const G: Record<string, number> = { "Nord": 0, "Nord-Ost": 45, "Ost": 90, "Süd-Ost": 135, "Süd": 180, "Süd-West": 225, "West": 270, "Nord-West": 315 };
  const a = G[ausrichtung] ?? 180, rad = (a - 90) * Math.PI / 180, x = (59 + Math.cos(rad) * 38).toFixed(1), y = (59 + Math.sin(rad) * 38).toFixed(1);
  const ACHSEN: Record<Locale, string[]> = { de: ["N", "S", "O", "W"], fr: ["N", "S", "E", "O"], it: ["N", "S", "E", "O"], en: ["N", "S", "E", "W"] };
  const [aN, aS, aO, aW] = ACHSEN[locale];
  const tx = { fontSize: 9, fill: "currentColor", opacity: .55, fontFamily: "Manrope,sans-serif" } as const;
  return (
    <svg viewBox="0 0 118 118" role="img" aria-label={`${label} ${ausrichtung}`}>
      <circle cx="59" cy="59" r="46" fill="none" stroke="currentColor" strokeOpacity=".18" /><circle cx="59" cy="59" r="30" fill="none" stroke="currentColor" strokeOpacity=".1" />
      <path d={`M59 59 L${x} ${y}`} stroke="var(--licht)" strokeWidth="2.5" strokeLinecap="round" /><circle cx={x} cy={y} r="5.5" fill="var(--licht)" /><circle cx="59" cy="59" r="3" fill="currentColor" />
      <text x="59" y="16" textAnchor="middle" {...tx}>{aN}</text><text x="59" y="110" textAnchor="middle" {...tx}>{aS}</text>
      <text x="108" y="63" textAnchor="middle" {...tx}>{aO}</text><text x="10" y="63" textAnchor="middle" {...tx}>{aW}</text>
    </svg>
  );
}

export function ObjektSeite({ d, t, locale, aehnliche, w, sprachLinks, angemeldet, zuletzt }:
  { d: Dossier; t: T; locale: Locale; aehnliche: Treffer[]; w: Woerter; sprachLinks: Record<Locale, string>; angemeldet: boolean; zuletzt: Treffer[] }) {
  const L = d.detail, p = L.property, s = L.sections, med = s.medien ?? {};
  const istEx = L.isExclusive, wir = L.publisher.representedByFourwalls;
  const ort = `${p.postalCode} ${p.city}`;
  const bilder = L.images, b0 = bilder[0];
  const quelleLabel = istEx ? t("exclusive") : (L.publisher.kind === "fourwalls" ? t("fourwalls") : L.publisher.kind === "agency" ? t("agentur") : t("privat"));
  const da = (id: string) => d.abschnitte.some(a => a.id === id);
  const KAT = keys(t, ["o_katAlle", "o_katAussen", "o_katWohnen", "o_katKueche", "o_katSchlafen", "o_katBad", "o_katLage", "o_katPlan"]);
  const katLabel: Record<string, string> = { alle: KAT.o_katAlle!, aussen: KAT.o_katAussen!, wohnen: KAT.o_katWohnen!, kueche: KAT.o_katKueche!, schlafen: KAT.o_katSchlafen!, bad: KAT.o_katBad!, lage: KAT.o_katLage!, plan: KAT.o_katPlan! };
  const ZUG: Record<string, string> = { public: t("o_zugHerunterladen"), authenticated: t("o_zugMitKonto"), on_request: t("o_zugNachAnfrage"), after_viewing: t("o_zugNachBesichtigung"), internal: t("o_zugNachEinigung") };
  const POI: [string, string][] = [["oev", t("o_poiOev")], ["schulen", t("o_poiSchulen")], ["einkauf", t("o_poiEinkauf")], ["gesundheit", t("o_poiGesundheit")], ["freizeit", t("o_poiFreizeit")], ["verkehr", t("o_poiVerkehr")]];
  const lage = s.lage;
  const poiListen = Object.fromEntries(POI.map(([k]) => [k, (lage?.[k as "oev"] ?? [])]));
  const poiDa = POI.filter(([k]) => (poiListen[k]?.length ?? 0) > 0);
  const story = s.story;
  const absaetze = story?.absaetze ?? (L.description ? [L.description] : []);
  const lang = absaetze.join(" ").length > 420;
  const hl = (s.highlights ?? []).slice(0, 6);
  const schritte = s.naechsteSchritte ?? [t("o_naechsteBesichtigung"), t("o_naechsteFrage"), t("o_naechsteFinanzierung")];
  const bildLabel = d.abschnitte.find(a => a.id === "bilder")?.klein ?? `${bilder.length} ${bilder.length === 1 ? t("bild1") : t("bildN")}`;
  const zurueck = `/${locale}/${PFAD[locale].immobilien}/${L.transaction === "rent" ? PFAD[locale].mieten : PFAD[locale].kaufen}`;
  const begleiterTx = keys(t, ["geprueft", "o_wirVertreten", "o_anfrageGehtAn", "o_unserTeam", "o_nichtAnDritte", "o_inseriertVon", "o_anfrageDirekt", "o_vertrittNicht", "o_hatGeprueft", "anfrage", "o_frageStellen", "o_name", "o_nachrichtStandard", "o_nachrichtFrage", "o_aehnlicheSuchabo", "o_anfrageSenden", "o_angenommenPrefix", "o_gesendetAn", "melden", "o_gemeldetDanke", "o_datenschutzHin", "o_datenschutzLink"]);
  const begleiter = (suffix: "" | "M") => <Begleiter publicRef={L.publicRef} quelle={L.publisher} quelleLabel={quelleLabel} schritte={schritte} suffix={suffix} tx={begleiterTx} locale={locale} />;


  return (
    <div className="detail seite an" id="inhalt">
      {!angemeldet && <VerlaufEintragen publicRef={L.publicRef} />}
      <Kopf publicRef={L.publicRef} quelle={quelleLabel} titel={L.title} exklusiv={istEx} wirVertreten={wir} zurueck={zurueck} sprachLinks={sprachLinks} locale={locale}
        tx={{ merken: t("merken"), gemerkt: t("gemerktOk"), teilen: t("teilen"), kopiert: t("o_linkKopiert"), schliessen: t("schliessen"), vergleichen: t("vg_vergleichen"), imVergleich: t("vg_imVergleich"), vergleichVoll: t("vg_voll") }} />

      {istEx && b0 ? (
        <div className="dheld premiere" id="premiere">
          <div className="voll"><Bild m={b0} sizes="100vw" eager alt={b0.alt || L.title} aspectRatio="3 / 2" /></div>
          <div className="flor"></div>
          <Blende><div className="fenster" id="exFenster"><div className="medien"><img src={b0.sources.jpeg.find(x => x.width === 960)?.url} alt="" style={{ aspectRatio: "432 / 317" }} /></div><div className="lichtzug"></div></div></Blende>
          <div className="txt">
            <div className="kick">{t("exclusive")} · {ort}</div>
            <h1>{L.title}</h1>
            {L.tagline && <p className="tag">{L.tagline}</p>}
          </div>
        </div>
      ) : (
        <div className="dheld">
          <div className={`mosaik ${bilder.length === 1 ? "einzel" : bilder.length === 2 ? "zwei" : ""}`}>
            {bilder.slice(0, 3).map((b, i) => <LichtKnopf key={b.key} tag="figure" wunsch={{ index: i }}><Bild m={b} sizes="(max-width:960px) 100vw, 60vw" eager={i === 0} alt={b.alt || `${L.title} ${i + 1}`} aspectRatio="3 / 2" /></LichtKnopf>)}
          </div>
          <div className="medienleiste">
            <LichtKnopf wunsch={{ index: 0 }}>{bildLabel}</LichtKnopf>
            {med.video && <LichtKnopf wunsch={{ medium: "video" }}>{t("o_video")}</LichtKnopf>}
            {med.tour360 && <LichtKnopf wunsch={{ medium: "360" }}>360°</LichtKnopf>}
            {L.floorplans.length > 0 && <AnkerLink id="grundrisse" className="knopf-anker">{t("o_grundrisseBtn")}</AnkerLink>}
          </div>
          {(AUSSAGEN.identitaetGeprueft.stand as string) === "bestaetigt" && L.publisher.orgVerified && !wir && <span className="quellband">{t("o_geprueft2")}</span>}
        </div>
      )}

      <div className={`dtitel${istEx ? " kompakt" : ""}`}>
        {!istEx && <div className="kick">{d.typ} · {ort}</div>}
        <div className="oben">
          <div>
            {!istEx && <h1>{L.title}</h1>}
            <div className="ort">{p.city} · {KANTON[p.canton] ?? p.canton} · {t("o_genaueAdresse")}</div>
          </div>
          <div className="preisblock">
            <div className="preis">{d.preis}</div>
            {d.preisNebenzeile && <div className="prosub">{d.preisNebenzeile}</div>}
            {d.monatlich && <div className="monat">ab {d.monatlich.total} / Monat<br /><AnkerLink id="finanzierung">{t("o_tragbarkeitRechnen")}</AnkerLink></div>}
          </div>
        </div>
        <div className="eck">
          {d.eck.map((e, i) => <div key={i}><b>{e.wert}</b> <span>{e.label}</span></div>)}
          <span className={`quelle ${istEx ? "exkl" : ""}`}>{quelleLabel}</span>
        </div>
      </div>

      <Anker abschnitte={d.abschnitte} label={t("o_aufDieserSeite")} />

      <div className="dkoerper">
        <div className="dhaupt">
          <Abs id="uebersicht" abschnitte={d.abschnitte}>
            {hl.length > 0 && <ul className="hl">{hl.map((h, i) => <li key={i}>{h}</li>)}</ul>}
            {story && <h3 style={{ fontFamily: "var(--d)", fontWeight: 300, fontSize: "1.25rem", marginBottom: 10 }}>{story.titel}</h3>}
            <Beschreibung absaetze={absaetze} lang={lang} mehrLabel={t("o_ganzeBeschreibung")} />
          </Abs>

          <Abs id="bilder" abschnitte={d.abschnitte}>
            <Galerie bilder={bilder} kategorien={d.kategorien} katLabel={katLabel} titel={L.title} medien={med} zeigeGitter
              tx={{ ...keys(t, ["zeigeAlle", "o_video", "schliessen", "o_vorherigesBild", "o_naechstesBild", "o_bildWort", "o_objektfilm", "o_videoProd", "o_rundgang", "o_rundgangProd", "o_modell3d", "o_modell3dHinweis", "o_ausrichtungWort"]), bildLabel }} />
          </Abs>
          {!da("bilder") && <Galerie bilder={bilder} kategorien={d.kategorien} katLabel={katLabel} titel={L.title} medien={med} zeigeGitter={false}
              tx={{ ...keys(t, ["zeigeAlle", "o_video", "schliessen", "o_vorherigesBild", "o_naechstesBild", "o_bildWort", "o_objektfilm", "o_videoProd", "o_rundgang", "o_rundgangProd", "o_modell3d", "o_modell3dHinweis", "o_ausrichtungWort"]), bildLabel }} />}

          <Abs id="eckdaten" abschnitte={d.abschnitte}>
            <dl className="fakten">{d.fakten.map((f, i) => <div key={i}><dt>{f.label}</dt><dd>{f.wert}</dd></div>)}</dl>
            {d.gruppen.length > 0 && <div className="gruppen">{d.gruppen.map((g, i) => <div className="gruppe" key={i}><h3>{g.titel}</h3><dl>{g.zeilen.map((z, j) => <span key={j} style={{ display: "contents" }}><dt>{z.label}</dt><dd>{z.wert}</dd></span>)}</dl></div>)}</div>}
            {d.geakKlasse && <div className="geak"><b>{d.geakKlasse}</b><span>{t("o_geakSatz")}</span></div>}
            {L.features.length > 0 && <div className="dfeat">{L.features.map(f => <span key={f.key}>{f.label}</span>)}</div>}
          </Abs>

          <Abs id="grundrisse" abschnitte={d.abschnitte}>
            <Grundrisse plaene={L.floorplans} tx={keys(t, ["o_verkleinern", "o_vergroessern", "o_vollbild", "o_planNichtGeladen", "o_planPdf1", "o_planPdf2", "o_grundrissPrefix", "schliessen"])} />
          </Abs>

          <Abs id="lage" abschnitte={d.abschnitte}>
            <LageKarte geo={L.geo} ort={ort} pois={poiListen} poiLabel={Object.fromEntries(POI)}
              tx={keys(t, ["o_karteSwisstopo", "o_lageExakt", "o_lageGemeinde", "o_lageUngefaehr", "o_imUmkreisVon", "o_genaueAdresse2", "o_vergroessern", "o_verkleinern", "o_ungefaehreLageCanvas"])} />
            {lage ? (
              <>
                <p className="dtext">{lage.beschreibung}</p>
                {lage.charakter && <p className="dtext" style={{ marginTop: 12 }}><i>{lage.charakter}</i></p>}
                <div className="poispalten">{poiDa.map(([k, n]) => <div className="poi" data-liste={k} key={k}><h4>{n}</h4><ul>{poiListen[k]!.map((pp, i) => <li key={i}>{pp.name}<span>{pp.distanz ?? ""}{pp.zeit ? " · " + pp.zeit : ""}</span></li>)}</ul></div>)}</div>
                {lage.fahrzeiten && <div className="poi" style={{ marginTop: 6 }}><h4>{t("o_fahrzeitenAuto")}</h4><ul style={{ columns: 2, columnGap: 36 }}>{lage.fahrzeiten.map((f, i) => <li key={i}>{f.ziel}<span>{f.zeit}</span></li>)}</ul></div>}
                <div className="lagefakt">{lage.gemeinde && <span>{t("o_gemeindeWort")} <b>{lage.gemeinde}</b></span>}{lage.quartier && <span>{t("o_quartierWort")} <b>{lage.quartier}</b></span>}{lage.steuerfuss && <span>{t("o_steuerfussWort")} <b>{String(lage.steuerfuss)}</b></span>}</div>
              </>
            ) : <p className="dtext">{ort}, {t("o_kantonWort")} {KANTON[p.canton] ?? p.canton}. {t("o_genAdresseNachKontaktSatz")}</p>}
            {med.sonne && <div className="sonne"><Kompass ausrichtung={med.sonne.ausrichtung} locale={locale} label={t("o_ausrichtungWort")} /><div className="txt"><b>{t("o_ausrichtungWort")} {med.sonne.ausrichtung}</b><p>{med.sonne.hauptraeume}. {med.sonne.sonnenstunden}.</p><p className="fein">{med.sonne.grundlage}.</p></div></div>}
          </Abs>

          {d.monatlich && L.priceChf && (
            <Abs id="finanzierung" abschnitte={d.abschnitte}>
              <Finanzierung preisRappen={L.priceChf} preisText={d.preis}
                fein={[s.finanzen?.nebenkosten, s.finanzen?.preisM2Kontext, t("o_finanzFein")].filter(Boolean).join(" ")}
                tx={keys(t, ["o_kaufpreis", "o_objektpreis", "o_eigenmittel", "o_zinsmodell", "o_saron", "o_fest5", "o_fest10", "o_belehnung", "o_hypothek", "o_zinsMonat", "o_amortMonat", "o_unterhMonat", "o_totalMonat", "o_noetHaushalt", "o_proJahr"])} />
            </Abs>
          )}

          <Abs id="dokumente" abschnitte={d.abschnitte}>
            <div className="doks">{L.documents.map((dk, i) => <div className="dok" key={i}><div><b>{dk.name}</b><small>{dk.type.toUpperCase()}{dk.pages ? ` · ${dk.pages} ${t("o_seitenAbk")}` : ""}</small></div><span className={`z ${dk.access === "public" ? "frei" : ""}`}>{ZUG[dk.access] ?? ZUG.on_request}</span></div>)}</div>
            <p className="dokfein">{t("o_zugText")}</p>
          </Abs>

          <Abs id="fragen" abschnitte={d.abschnitte}>
            <div className="faq">{(s.faq ?? []).map((f, i) => <details key={i}><summary>{f.frage}</summary><p>{f.antwort}</p></details>)}</div>
          </Abs>

          <Abs id="kontakt" abschnitte={d.abschnitte}><div className="nurmobil">{begleiter("M")}</div></Abs>

          <Abs id="aehnliche" abschnitte={d.abschnitte}>
            <div className="aehnlich">{aehnliche.map(a => <Ergebniskarte key={a.id} l={a} w={w} locale={locale} href={objektPfad(locale, PFAD[locale], a)} />)}</div>
          </Abs>

          {zuletzt.length > 0 && (
            <section className="dabs" id="d-zuletzt">
              <h2>{t("vl_titel")}</h2>
              <VerlaufListe treffer={zuletzt} w={w} locale={locale} />
            </section>
          )}

          {/* Ruhiger Hinweis am Ende des Inhalts, für Eigentümerinnen und
              Eigentümer ähnlicher Objekte (P5.9 Phase B, Entscheid 24,
              Punkt 5) — kein neues CSS, dieselbe .hinweisbox wie auf den
              Rechtsseiten. */}
          <div className="hinweisbox" style={{ marginTop: 24 }}>
            <p><b>{t("o_eigentuemer_titel")}</b></p>
            <p style={{ marginTop: 6 }}><a href={`/${locale}/verkaufen`}>{t("o_eigentuemer_verkaufen")}</a></p>
            <p style={{ marginTop: 6 }}><a href={`/${locale}/bewertung`}>{t("o_eigentuemer_bewertung")}</a></p>
          </div>
        </div>
        <aside className="dseite">{begleiter("")}</aside>
      </div>

      <div className="mobilcta">
        <div className="p">{d.preis}<small>{(p.rooms ? `${p.rooms} ${t("o_ziKurz")} · ` : "") + (p.livingAreaM2 ? `${p.livingAreaM2} m² · ` : "") + p.city}</small></div>
        <AnfrageKnopf className="knopf voll">{t("anfrage")}</AnfrageKnopf>
      </div>
    </div>
  );
}
