import type { Locale } from "@/i18n";
import { LOCALES, PFAD, uebersetzer } from "@/i18n";
import { MerkZahl } from "@/components/marktplatz/merk-knopf";
import { KopfClient } from "./kopf-client";
import { gibtEsBautraegerInserate } from "@/server/angebot";

/* Kopfleiste — Markup wie kopfHTML() in ufer.js. Die Sprachwahl sind Links
   auf dieselbe Seite in der anderen Sprache (dieselbe Entität, dieselbe
   Suche): der Aufrufer liefert sie. Untermenüs und Modus: kopf-client.tsx.

   P5.8: Die Gruppe «Wissen» war gestrichen (§71 keine Filler), solange es
   keine echten Zielseiten gab (Ratgeber, Tragbarkeit, Nebenkosten, Markt
   existierten nicht).

   P5.9 Phase B (Entscheid 24, 2026-09-06): Die Gruppe «Wissen» ist wieder
   da — jetzt mit vier echten Beiträgen unter /wissen/<slug>
   (content/wissen/*, lib/wissen.ts, app/[locale]/wissen/). Haupt-Label je
   Eintrag (`<b>`) kommt bewusst NICHT aus navigation.json (das ist nicht
   Teil dieses Auftrags), sondern aus dem lokalen `LABEL` unten — dasselbe
   Muster wie BESCHR/SUB.

   P5.9 Phase B (config/policy.ts, Entscheid 2026-09-06):
   - «Eigentümer-Report» ist entfernt (eigentuemerReport: REMOVE).
   - «Neubau» erscheint nur, wenn tatsächlich öffentliche Bauträger-Inserate
     existieren (neubauAngebot), siehe server/angebot.ts.
   - Karte/Exclusive/Neubau zeigen im Bereich «Mieten» auf die Mietsuche
     (Prop `bereich`), statt immer auf Kaufen. */
export type Bereich = "kaufen" | "mieten";
const NAV: { key: string; items: [string, (l: Locale, bereich: Bereich) => string, string, string][] }[] = [
  { key: "immobilien", items: [
    ["kaufen", l => `/${l}/${PFAD[l].immobilien}/${PFAD[l].kaufen}`, "sSuche", "nKaufen"],
    ["mieten", l => `/${l}/${PFAD[l].immobilien}/${PFAD[l].mieten}`, "sSuche", "nMieten"],
    ["karte", (l, bereich) => `/${l}/${PFAD[l].immobilien}/${PFAD[l][bereich]}?ansicht=karte`, "", "nKarte"],
    ["exclusive", (l, bereich) => `/${l}/${PFAD[l].immobilien}/${PFAD[l][bereich]}?quelle=fourwalls`, "sMandate", "nExclusive"],
    ["neubau", (l, bereich) => `/${l}/${PFAD[l].immobilien}/${PFAD[l][bereich]}?quelle=entwickler`, "", "nNeubau"],
    ["suchabo", l => `/${l}/${PFAD[l].immobilien}/${PFAD[l].kaufen}#abo`, "", "nSuchabo"]] },
  { key: "verkaufen", items: [
    ["bewertung", l => `/${l}/bewertung`, "", "nBewertung"],
    ["mitFW", l => `/${l}/verkaufen`, "sMandat", "nMitFW"],
    ["selbst", l => `/${l}/inserieren`, "", "nSelbst"],
    ["vermieten", l => `/${l}/vermieten`, "", "nVermieten"]] },
  { key: "verwalten", items: [
    ["bewirtschaftung", l => `/${l}/verwalten`, "", "nBewirt"],
    ["erstvermietung", l => `/${l}/vermieten`, "", "nErst"],
    ["offerte", l => `/${l}/verwalten/anfrage`, "", "nOfferte"]] },
  { key: "wissen", items: [
    ["wverkauf", l => `/${l}/wissen/immobilienverkauf-ablauf`, "", "nWverkauf"],
    ["wselbst", l => `/${l}/wissen/selbst-inserieren-oder-mit-fourwalls`, "", "nWselbst"],
    ["wbewertung", l => `/${l}/wissen/immobilien-einschaetzung`, "", "nWbewertung"],
    ["wvermieten", l => `/${l}/wissen/immobilie-vermieten-ablauf`, "", "nWvermieten"]] }
];

/* Haupt-Label der vier Wissen-Einträge (`<b>`) — lokal, nicht aus
   navigation.json (siehe Kommentar oben). Fällt für alle anderen Einträge
   auf u(k) (navigation.json) zurück. */
const LABEL: Record<string, Record<Locale, string>> = {
  wverkauf: { de: "Verkaufsablauf", fr: "Étapes de la vente", it: "Fasi della vendita", en: "Sale process" },
  wselbst: { de: "Selbst inserieren oder mit Fourwalls", fr: "Publier soi-même ou avec Fourwalls", it: "Pubblicare da soli o con Fourwalls", en: "List it yourself or with Fourwalls" },
  wbewertung: { de: "Einschätzung", fr: "Estimation", it: "Valutazione", en: "Valuation" },
  wvermieten: { de: "Vermieten", fr: "Mettre en location", it: "Affittare", en: "Let" }
};
const BESCHR: Record<string, Record<Locale, string>> = {
  nKaufen: { de: "Eigentum in der ganzen Schweiz", fr: "Propriétés dans toute la Suisse", it: "Proprietà in tutta la Svizzera", en: "Property across Switzerland" },
  nMieten: { de: "Wohnungen und Häuser zur Miete", fr: "Appartements et maisons à louer", it: "Appartamenti e case in affitto", en: "Homes to rent" },
  nKarte: { de: "Suchen, wo Sie wohnen wollen", fr: "Chercher là où vous voulez vivre", it: "Cercare dove volete vivere", en: "Search where you want to live" },
  nExclusive: { de: "Ausgewählte Objekte, die wir selbst vermarkten", fr: "Biens sélectionnés que nous commercialisons nous-mêmes", it: "Oggetti selezionati che commercializziamo noi stessi", en: "Selected properties we market ourselves" },
  nNeubau: { de: "Projekte von Bauträgern", fr: "Projets de promoteurs", it: "Progetti di costruttori", en: "Developer projects" },
  nSuchabo: { de: "Neue Treffer zuerst sehen", fr: "Voir les nouveautés en premier", it: "Vedere prima le novità", en: "See new matches first" },
  nBewertung: { de: "Unverbindlich anfragen", fr: "Demande sans engagement", it: "Richiesta senza impegno", en: "No-obligation request" },
  nMitFW: { de: "Begleitung durch den Verkaufsprozess", fr: "Accompagnement tout au long de la vente", it: "Accompagnamento durante la vendita", en: "Support throughout the sale" },
  nSelbst: { de: "Sie inserieren und betreuen selbst", fr: "Vous publiez et gérez vous-même", it: "Pubblicate e gestite voi stessi", en: "You publish and manage it yourself" },
  nVermieten: { de: "Mieterschaft finden", fr: "Trouver des locataires", it: "Trovare inquilini", en: "Find tenants" },
  nBewirt: { de: "Laufende Betreuung Ihrer Liegenschaft", fr: "Gestion courante de votre immeuble", it: "Gestione corrente del vostro stabile", en: "Ongoing care for your property" },
  nErst: { de: "Erstvermietung nach Fertigstellung oder Sanierung", fr: "Première location après achèvement ou rénovation", it: "Prima locazione dopo il completamento o il rinnovo", en: "First letting after completion or renovation" },
  nOfferte: { de: "Schriftlich, mit Leistungsumfang", fr: "Par écrit, avec le détail", it: "Per iscritto, con i dettagli", en: "In writing, with full scope" },
  nWverkauf: { de: "Vom Entscheid bis zum Grundbucheintrag", fr: "De la décision à l'inscription au registre foncier", it: "Dalla decisione all'iscrizione nel registro fondiario", en: "From the decision to the land register entry" },
  nWselbst: { de: "Zwei Wege, ein Marktplatz", fr: "Deux voies, un seul marché", it: "Due vie, un solo mercato", en: "Two paths, one marketplace" },
  nWbewertung: { de: "Was eine Einschätzung leistet und was nicht", fr: "Ce qu'une estimation apporte et ce qu'elle n'est pas", it: "Che cosa offre una valutazione e che cosa no", en: "What a valuation can and cannot do" },
  nWvermieten: { de: "Ablauf und wichtige Schritte", fr: "Déroulement et étapes essentielles", it: "Procedura e passaggi principali", en: "Process and key steps" }
};
const SUB: Record<string, Record<Locale, string>> = {
  sSuche: { de: "Suche", fr: "Recherche", it: "Ricerca", en: "Search" }, sMandate: { de: "Mandate", fr: "Mandats", it: "Mandati", en: "Mandates" },
  sMandat: { de: "Mandat", fr: "Mandat", it: "Mandato", en: "Mandate" }
};

export async function Kopf({ locale, aktuell, sprachLinks, schwebt = false, bereich = "kaufen" }: { locale: Locale; aktuell?: string; sprachLinks: Record<Locale, string>; schwebt?: boolean; bereich?: Bereich }) {
  const t = uebersetzer(locale);
  const u = (k: string) => t("nav." + k);
  const zeigNeubau = await gibtEsBautraegerInserate();
  const navGefiltert = NAV.map(g => g.key === "immobilien" && !zeigNeubau ? { ...g, items: g.items.filter(([k]) => k !== "neubau") } : g);
  const nav = navGefiltert.map(g => (
    <div key={g.key}>
      <a href={g.items[0]![1](locale, bereich)} data-grp={g.key} aria-haspopup="true" aria-expanded="false" aria-current={aktuell === g.key ? "true" : undefined}>{u(g.key)}</a>
      <div className="tafel" id={`tafel-${g.key}`}><div className="tk">{u(g.key)}</div>
        {g.items.map(([k, h, s, b]) => <a key={k} href={h(locale, bereich)}><span className="wa"><b>{LABEL[k]?.[locale] ?? u(k)}</b>{b && <em>{BESCHR[b]?.[locale]}</em>}</span>{s && <small>{SUB[s]?.[locale]}</small>}</a>)}
      </div>
    </div>
  ));
  const sprache = (
    <div className="sprache" role="group" aria-label="Sprache">
      {LOCALES.map(l => <a key={l} href={sprachLinks[l]} data-l={l} aria-current={l === locale ? "true" : undefined} hrefLang={l}>{l.toUpperCase()}</a>)}
    </div>
  );
  return (
    <>
      <header className={`kopf${schwebt ? " schwebt" : ""}`}>
        <a href={`/${locale}`} className="fw" aria-label="Fourwalls"><i className="k"></i><i className="s"></i></a>
        <nav className="haupt" aria-label="Hauptnavigation">{nav}</nav>
        <div className="rechts">
          {sprache}
          <a className="knopf" href={`/${locale}/konto/favoriten`}><span>{u("gemerkt")}</span> <MerkZahl /></a>
          <a className="knopf" href={`/${locale}/verkaufen`}>{u("mitFW")}</a>
          <a className="knopf voll" href={`/${locale}/inserieren`}>{u("inserieren")}</a>
          <div className="gt" role="group" aria-label="Erscheinung"><button id="gtHell" aria-pressed="false" title={u("tag")}>T</button><button id="gtDunkel" aria-pressed="true" title={u("nacht")}>N</button></div>
          <button className="burger" id="burger" aria-label={u("menue")} aria-expanded="false"><i></i></button>
        </div>
      </header>
      <div className="blatt" id="blatt">
        <div className="bk"><span className="fw"><i className="k"></i><i className="s"></i></span><button className="knopf" id="blattZu">{u("schliessen")} ×</button></div>
        {navGefiltert.map(g => <div className="gruppe" key={g.key}><div className="tk">{u(g.key)}</div>{g.items.map(([k, h, s, b]) => <a key={k} href={h(locale, bereich)}><span className="wa"><b>{LABEL[k]?.[locale] ?? u(k)}</b>{b && <em>{BESCHR[b]?.[locale]}</em>}</span>{s && <small>{SUB[s]?.[locale]}</small>}</a>)}</div>)}
        <div className="unten"><a className="knopf voll" href={`/${locale}/inserieren`}>{u("inserieren")}</a><a className="knopf" href={`/${locale}/konto/favoriten`}>{u("gemerkt")}</a><div style={{ display: "flex", marginLeft: "auto" }}>{sprache}</div></div>
      </div>
      <KopfClient />
    </>
  );
}
