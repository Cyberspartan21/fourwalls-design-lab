import type { Locale } from "@/i18n";
import { LOCALES, PFAD, uebersetzer } from "@/i18n";
import { MerkZahl } from "@/components/marktplatz/merk-knopf";
import { KopfClient } from "./kopf-client";

/* Kopfleiste — Markup wie kopfHTML() in ufer.js. Die Sprachwahl sind Links
   auf dieselbe Seite in der anderen Sprache (dieselbe Entität, dieselbe
   Suche): der Aufrufer liefert sie. Untermenüs und Modus: kopf-client.tsx. */
const NAV: { key: string; items: [string, (l: Locale) => string, string, string][] }[] = [
  { key: "immobilien", items: [
    ["kaufen", l => `/${l}/${PFAD[l].immobilien}/${PFAD[l].kaufen}`, "sSuche", "nKaufen"],
    ["mieten", l => `/${l}/${PFAD[l].immobilien}/${PFAD[l].mieten}`, "sSuche", "nMieten"],
    ["karte", l => `/${l}/${PFAD[l].immobilien}/${PFAD[l].kaufen}?ansicht=karte`, "", "nKarte"],
    ["exclusive", l => `/${l}/${PFAD[l].immobilien}/${PFAD[l].kaufen}?quelle=fourwalls`, "sMandate", "nExclusive"],
    ["neubau", l => `/${l}/${PFAD[l].immobilien}/${PFAD[l].kaufen}?quelle=entwickler`, "", "nNeubau"],
    ["suchabo", l => `/${l}/${PFAD[l].immobilien}/${PFAD[l].kaufen}#abo`, "", "nSuchabo"]] },
  { key: "verkaufen", items: [["bewertung", l => `/${l}`, "sKostenlos", "nBewertung"], ["mitFW", l => `/${l}`, "sMandat", "nMitFW"], ["selbst", l => `/${l}`, "sKostenlos", "nSelbst"], ["vermieten", l => `/${l}`, "", "nVermieten"]] },
  { key: "verwalten", items: [["bewirtschaftung", l => `/${l}`, "", "nBewirt"], ["report", l => `/${l}`, "", "nReport"], ["erstvermietung", l => `/${l}`, "", "nErst"], ["offerte", l => `/${l}`, "", "nOfferte"]] },
  { key: "wissen", items: [["ratgeber", l => `/${l}`, "", "nRatgeber"], ["tragbarkeit", l => `/${l}`, "sRechner", "nTragbar"], ["nebenkosten", l => `/${l}`, "sRechner", "nNeben"], ["markt", l => `/${l}`, "", "nMarkt"]] }
];
const BESCHR: Record<string, Record<Locale, string>> = {
  nKaufen: { de: "Eigentum in der ganzen Schweiz", fr: "Propriétés dans toute la Suisse", it: "Proprietà in tutta la Svizzera", en: "Property across Switzerland" },
  nMieten: { de: "Wohnungen und Häuser zur Miete", fr: "Appartements et maisons à louer", it: "Appartamenti e case in affitto", en: "Homes to rent" },
  nKarte: { de: "Suchen, wo Sie wohnen wollen", fr: "Chercher là où vous voulez vivre", it: "Cercare dove volete vivere", en: "Search where you want to live" },
  nExclusive: { de: "Objekte, die wir selbst vertreten", fr: "Biens que nous représentons", it: "Oggetti che rappresentiamo noi", en: "Properties we represent ourselves" },
  nNeubau: { de: "Projekte von Bauträgern", fr: "Projets de promoteurs", it: "Progetti di costruttori", en: "Developer projects" },
  nSuchabo: { de: "Neue Treffer zuerst sehen", fr: "Voir les nouveautés en premier", it: "Vedere prima le novità", en: "See new matches first" },
  nBewertung: { de: "Was ist mein Objekt wert?", fr: "Quelle est la valeur de mon bien ?", it: "Quanto vale il mio immobile?", en: "What is my property worth?" },
  nMitFW: { de: "Wir übernehmen den ganzen Verkauf", fr: "Nous gérons toute la vente", it: "Gestiamo l'intera vendita", en: "We handle the entire sale" },
  nSelbst: { de: "Sie inserieren und betreuen selbst", fr: "Vous publiez et gérez vous-même", it: "Pubblicate e gestite voi stessi", en: "You publish and manage it yourself" },
  nVermieten: { de: "Mieterschaft finden und prüfen", fr: "Trouver et vérifier les locataires", it: "Trovare e verificare gli inquilini", en: "Find and vet tenants" },
  nBewirt: { de: "Laufende Betreuung Ihrer Liegenschaft", fr: "Gestion courante de votre immeuble", it: "Gestione corrente del vostro stabile", en: "Ongoing care for your property" },
  nReport: { de: "Ihr Haus in einer Seite, monatlich", fr: "Votre bien en une page, chaque mois", it: "Il vostro immobile in una pagina, ogni mese", en: "Your property on one page, monthly" },
  nErst: { de: "Erstvermietung mit Marktmiete", fr: "Première location au prix du marché", it: "Prima locazione a prezzo di mercato", en: "First letting at market rent" },
  nOfferte: { de: "Schriftlich, mit Leistungsumfang", fr: "Par écrit, avec le détail", it: "Per iscritto, con i dettagli", en: "In writing, with full scope" },
  nRatgeber: { de: "Kurz, geprüft, ohne Verkaufsdruck", fr: "Bref, vérifié, sans pression", it: "Breve, verificato, senza pressione", en: "Short, checked, no sales pressure" },
  nTragbar: { de: "Was darf mein Objekt kosten?", fr: "Quel prix puis-je me permettre ?", it: "Quanto posso permettermi?", en: "What can I afford?" },
  nNeben: { de: "Was neben dem Preis anfällt", fr: "Ce qui s'ajoute au prix", it: "Cosa si aggiunge al prezzo", en: "What comes on top of the price" },
  nMarkt: { de: "Preise und Tempo nach Region", fr: "Prix et rythme par région", it: "Prezzi e ritmo per regione", en: "Prices and pace by region" }
};
const SUB: Record<string, Record<Locale, string>> = {
  sSuche: { de: "Suche", fr: "Recherche", it: "Ricerca", en: "Search" }, sMandate: { de: "Mandate", fr: "Mandats", it: "Mandati", en: "Mandates" },
  sMandat: { de: "Mandat", fr: "Mandat", it: "Mandato", en: "Mandate" }, sKostenlos: { de: "kostenlos", fr: "gratuit", it: "gratuito", en: "free" }, sRechner: { de: "Rechner", fr: "Calculateur", it: "Calcolatore", en: "Calculator" }
};

export function Kopf({ locale, aktuell, sprachLinks, schwebt = false }: { locale: Locale; aktuell?: string; sprachLinks: Record<Locale, string>; schwebt?: boolean }) {
  const t = uebersetzer(locale);
  const u = (k: string) => t("nav." + k);
  const nav = NAV.map(g => (
    <div key={g.key}>
      <a href={g.items[0]![1](locale)} data-grp={g.key} aria-haspopup="true" aria-expanded="false" aria-current={aktuell === g.key ? "true" : undefined}>{u(g.key)}</a>
      <div className="tafel" id={`tafel-${g.key}`}><div className="tk">{u(g.key)}</div>
        {g.items.map(([k, h, s, b]) => <a key={k} href={h(locale)}><span className="wa"><b>{u(k)}</b>{b && <em>{BESCHR[b]?.[locale]}</em>}</span>{s && <small>{SUB[s]?.[locale]}</small>}</a>)}
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
          <a className="knopf voll" href={`/${locale}`}>{u("inserieren")}</a>
          <div className="gt" role="group" aria-label="Erscheinung"><button id="gtHell" aria-pressed="false" title={u("tag")}>T</button><button id="gtDunkel" aria-pressed="true" title={u("nacht")}>N</button></div>
          <button className="burger" id="burger" aria-label={u("menue")} aria-expanded="false"><i></i></button>
        </div>
      </header>
      <div className="blatt" id="blatt">
        <div className="bk"><span className="fw"><i className="k"></i><i className="s"></i></span><button className="knopf" id="blattZu">{u("schliessen")} ×</button></div>
        {NAV.map(g => <div className="gruppe" key={g.key}><div className="tk">{u(g.key)}</div>{g.items.map(([k, h, s, b]) => <a key={k} href={h(locale)}><span className="wa"><b>{u(k)}</b>{b && <em>{BESCHR[b]?.[locale]}</em>}</span>{s && <small>{SUB[s]?.[locale]}</small>}</a>)}</div>)}
        <div className="unten"><a className="knopf voll" href={`/${locale}`}>{u("inserieren")}</a><a className="knopf" href={`/${locale}/konto/favoriten`}>{u("gemerkt")}</a><div style={{ display: "flex", marginLeft: "auto" }}>{sprache}</div></div>
      </div>
      <KopfClient />
    </>
  );
}
