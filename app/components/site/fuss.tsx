import type { Locale } from "@/i18n";
import { uebersetzer, PFAD } from "@/i18n";
import { feld } from "@/config/company";

/* Fusszeile — dieselben Klassen wie im Prototyp (ufer.css .fuss).
   P5.8: Verweise zeigen auf dieselben echten Ziele wie die Kopfleiste
   (components/site/kopf.tsx) — keine Sackgassen zur Startseite mehr.

   P5.9 Phase B (Entscheid 24, 2026-09-06): Die Gruppe «Wissen» ist wieder da
   (vgl. kopf.tsx) — eine Fuss-Spalte mit «Alle Beiträge» (/wissen) und drei
   Links auf die drei Beiträge, die im Kopf-Menü keinen Platz haben (mieten,
   verwalten, wissen/Datenschutz). Texte lokal, nicht aus navigation.json
   (dasselbe Muster wie kopf.tsx LABEL) — dieser Auftrag berührt
   navigation.json nicht. */
const WISSEN_SPALTE: Record<Locale, { alle: string; mieten: string; verwalten: string; datenschutz: string }> = {
  de: { alle: "Alle Beiträge", mieten: "Wohnung mieten", verwalten: "Verwaltung", datenschutz: "Datenschutz und Anfragen" },
  fr: { alle: "Tous les articles", mieten: "Louer un logement", verwalten: "Gérance", datenschutz: "Protection des données" },
  it: { alle: "Tutti gli articoli", mieten: "Affittare un appartamento", verwalten: "Amministrazione", datenschutz: "Protezione dei dati" },
  en: { alle: "All articles", mieten: "Renting a flat", verwalten: "Management", datenschutz: "Privacy and enquiries" }
};

export function Fuss({ locale }: { locale: Locale }) {
  const t = uebersetzer(locale);
  const p = PFAD[locale];
  const start = `/${locale}`;
  const kaufen = `${start}/${p.immobilien}/${p.kaufen}`;
  const mieten = `${start}/${p.immobilien}/${p.mieten}`;
  const staedte = feld("staedte", []) as string[];
  const w = WISSEN_SPALTE[locale];
  return (
    <footer className="fuss">
      <span className="fw band" aria-label="Fourwalls"><i className="k"></i><i className="s"></i></span>
      <div className="spalten">
        <div><b>{t("nav.immobilien")}</b><a href={kaufen}>{t("nav.kaufen")}</a><a href={mieten}>{t("nav.mieten")}</a><a href={`${kaufen}?quelle=fourwalls`}>{t("nav.exclusive")}</a><a href={`${kaufen}#abo`}>{t("nav.suchabo")}</a></div>
        <div><b>{t("nav.verkaufen")}</b><a href={`${start}/bewertung`}>{t("nav.bewertung")}</a><a href={`${start}/verkaufen`}>{t("nav.mitFW")}</a><a href={`${start}/inserieren`}>{t("nav.selbst")}</a></div>
        <div><b>{t("nav.verwalten")}</b><a href={`${start}/verwalten`}>{t("nav.bewirtschaftung")}</a><a href={`${start}/verwalten/anfrage`}>{t("nav.offerte")}</a><a href={`${start}/vermieten`}>{t("nav.vermieten")}</a><a href={`${start}/beratung`}>{t("kontakt")}</a></div>
        <div><b>{t("nav.wissen")}</b><a href={`${start}/wissen`}>{w.alle}</a><a href={`${start}/wissen/wohnung-mieten-bewerbung`}>{w.mieten}</a><a href={`${start}/wissen/immobilienverwaltung-leistungen`}>{w.verwalten}</a><a href={`${start}/wissen/datenschutz-und-anfragen`}>{w.datenschutz}</a></div>
        <div><b>{feld("firmierung", "Fourwalls AG")}</b><span>{feld("strasse", "")} · {feld("plzOrt", "")}</span><span>{feld("telefon", "")}</span><span>{feld("email", "")}</span><span>{staedte.join(" · ")}</span></div>
      </div>
      <div className="fein"><a href={`${start}/impressum`}>{t("fuss_impressum")}</a> · <a href={`${start}/datenschutz`}>{t("fuss_datenschutz")}</a> · <a href={`${start}/agb`}>{t("fuss_agb")}</a> · <a href={`${start}/ueber-fourwalls`}>{t("fuss_ueberFourwalls")}</a></div>
      <div className="fein"><span>Entwicklungsstand mit fiktiven Objekt- und Firmendaten · © 2026 Fourwalls</span><span>Kontaktangaben sind Platzhalter</span></div>
    </footer>
  );
}
