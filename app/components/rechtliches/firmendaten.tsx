import type { T } from "@/i18n";
import { firma, type Stand } from "@/config/company";

/* Firmenangaben im Impressum — direkt aus config/company.ts gerendert, nie
   aus einer Textdatei kopiert: eine Änderung an der einen Stelle reicht,
   und kein Feld kann durch veraltetes Markdown eine falsche Sicherheit
   vortäuschen. Jedes Feld zeigt seinen eigenen Stand (P5.9 Entscheid 21). */

function StandBadge({ stand, t }: { stand: Stand; t: T }) {
  if (stand === "bestaetigt") return null;
  const text = stand === "offen" ? t("re_feld_offen") : t("re_feld_platzhalter");
  return <span className="leise" style={{ marginLeft: 8, fontSize: ".72rem", letterSpacing: ".04em" }}>({text})</span>;
}

function Zeile({ label, wert, stand, t }: { label: string; wert: string | null; stand: Stand; t: T }) {
  return (
    <p style={{ marginTop: 10, color: "var(--leise)" }}>
      <span style={{ color: "var(--ink)" }}>{label}:</span> {wert ?? "—"}
      <StandBadge stand={stand} t={t} />
    </p>
  );
}

export function Firmendaten({ t }: { t: T }) {
  const adresse = [firma.strasse.wert, firma.plzOrt.wert].filter(Boolean).join(", ") || null;
  /* Schlechtester (am wenigsten sicherer) Stand von Strasse/Ort für die Adresszeile. */
  const adresseStand: Stand = firma.strasse.stand === "bestaetigt" && firma.plzOrt.stand === "bestaetigt" ? "bestaetigt"
    : firma.strasse.stand === "offen" || firma.plzOrt.stand === "offen" ? "offen" : "platzhalter";

  return (
    <div style={{ marginTop: 8 }}>
      <Zeile label={t("re_feld_firma")} wert={firma.firmierung.wert} stand={firma.firmierung.stand} t={t} />
      <Zeile label={t("re_feld_rechtsform")} wert={firma.rechtsform.wert} stand={firma.rechtsform.stand} t={t} />
      <Zeile label={t("re_feld_uid")} wert={firma.uid.wert} stand={firma.uid.stand} t={t} />
      <Zeile label={t("re_feld_adresse")} wert={adresse} stand={adresseStand} t={t} />
      <Zeile label={t("re_feld_telefon")} wert={firma.telefon.wert} stand={firma.telefon.stand} t={t} />
      <Zeile label={t("re_feld_email")} wert={firma.email.wert} stand={firma.email.stand} t={t} />
    </div>
  );
}
