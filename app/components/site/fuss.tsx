import type { Locale } from "@/i18n";
import { uebersetzer, PFAD } from "@/i18n";
import { feld } from "@/config/company";

/* Fusszeile — dieselben Klassen wie im Prototyp (ufer.css .fuss).
   Verweise zeigen auf Wege, die es in P5.2 noch nicht gibt; sie führen auf
   die Sprachstartseite, bis die Bereiche gebaut sind. */
export function Fuss({ locale }: { locale: Locale }) {
  const t = uebersetzer(locale);
  const p = PFAD[locale];
  const start = `/${locale}`;
  const staedte = feld("staedte", []) as string[];
  return (
    <footer className="fuss">
      <span className="fw band" aria-label="Fourwalls"><i className="k"></i><i className="s"></i></span>
      <div className="spalten">
        <div><b>{t("nav.immobilien")}</b><a href={`${start}/${p.immobilien}/${p.kaufen}`}>{t("nav.kaufen")}</a><a href={`${start}/${p.immobilien}/${p.mieten}`}>{t("nav.mieten")}</a><a href={start}>{t("nav.exclusive")}</a><a href={start}>{t("nav.suchabo")}</a></div>
        <div><b>{t("nav.verkaufen")}</b><a href={start}>{t("nav.bewertung")}</a><a href={start}>{t("nav.mitFW")}</a><a href={start}>{t("nav.selbst")}</a></div>
        <div><b>{t("nav.verwalten")} · {t("nav.wissen")}</b><a href={start}>{t("nav.bewirtschaftung")}</a><a href={start}>{t("nav.report")}</a><a href={start}>{t("nav.ratgeber")}</a><a href={start}>{t("nav.tragbarkeit")}</a></div>
        <div><b>{feld("firmierung", "Fourwalls AG")}</b><span>{feld("strasse", "")} · {feld("plzOrt", "")}</span><span>{feld("telefon", "")}</span><span>{feld("email", "")}</span><span>{staedte.join(" · ")}</span></div>
      </div>
      <div className="fein"><span>Entwicklungsstand mit fiktiven Objekt- und Firmendaten · © 2026 Fourwalls</span><span>Kontaktangaben sind Platzhalter</span></div>
    </footer>
  );
}
