import type { Locale } from "@/i18n";
import { uebersetzer, PFAD } from "@/i18n";
import { feld } from "@/config/company";

/* Fusszeile — dieselben Klassen wie im Prototyp (ufer.css .fuss).
   P5.8: Verweise zeigen auf dieselben echten Ziele wie die Kopfleiste
   (components/site/kopf.tsx) — keine Sackgassen zur Startseite mehr. Die
   Gruppe «Wissen» hat keine eigene Seite und wurde darum gestrichen
   (§71 keine Filler, siehe Kommentar in kopf.tsx). */
export function Fuss({ locale }: { locale: Locale }) {
  const t = uebersetzer(locale);
  const p = PFAD[locale];
  const start = `/${locale}`;
  const kaufen = `${start}/${p.immobilien}/${p.kaufen}`;
  const mieten = `${start}/${p.immobilien}/${p.mieten}`;
  const staedte = feld("staedte", []) as string[];
  return (
    <footer className="fuss">
      <span className="fw band" aria-label="Fourwalls"><i className="k"></i><i className="s"></i></span>
      <div className="spalten">
        <div><b>{t("nav.immobilien")}</b><a href={kaufen}>{t("nav.kaufen")}</a><a href={mieten}>{t("nav.mieten")}</a><a href={`${kaufen}?quelle=fourwalls`}>{t("nav.exclusive")}</a><a href={`${kaufen}#abo`}>{t("nav.suchabo")}</a></div>
        <div><b>{t("nav.verkaufen")}</b><a href={`${start}/bewertung`}>{t("nav.bewertung")}</a><a href={`${start}/verkaufen`}>{t("nav.mitFW")}</a><a href={`${start}/inserieren`}>{t("nav.selbst")}</a></div>
        <div><b>{t("nav.verwalten")}</b><a href={`${start}/verwalten`}>{t("nav.bewirtschaftung")}</a><a href={`${start}/verwalten/anfrage`}>{t("nav.offerte")}</a><a href={`${start}/vermieten`}>{t("nav.vermieten")}</a><a href={`${start}/beratung`}>{t("kontakt")}</a></div>
        <div><b>{feld("firmierung", "Fourwalls AG")}</b><span>{feld("strasse", "")} · {feld("plzOrt", "")}</span><span>{feld("telefon", "")}</span><span>{feld("email", "")}</span><span>{staedte.join(" · ")}</span></div>
      </div>
      <div className="fein"><span>Entwicklungsstand mit fiktiven Objekt- und Firmendaten · © 2026 Fourwalls</span><span>Kontaktangaben sind Platzhalter</span></div>
    </footer>
  );
}
