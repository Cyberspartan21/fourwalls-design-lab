/* Geschäftsaussagen — Übernahme von final/policy.js.

   Drei Stände, die im Prototyp gleich aussahen:
     bestaetigt  — die Firma hat es schriftlich bestätigt; darf produktiv stehen
     geplant     — vorgesehen, nicht entschieden
     demo        — nur damit der Prototyp vollständig wirkt

   `sichtbar()` ist die einzige Stelle, die entscheidet. Ausserhalb der
   Produktion bleibt alles sichtbar; in der Produktion nur Bestätigtes. Die
   Umgebung kommt von aussen, damit diese Datei auch im Browser laufen kann. */

export type AussageStand = "bestaetigt" | "bestaetigt-technisch" | "teilweise" | "geplant" | "unbestaetigt" | "demo";

export const AUSSAGEN = {
  bewertungKostenlos:   { stand: "unbestaetigt", frage: "Ist die hedonische Bewertung tatsächlich kostenlos und unverbindlich?" },
  honorarNurBeiErfolg:  { stand: "unbestaetigt", frage: "Fällt das Verkaufshonorar ausschliesslich bei Erfolg an — und wie hoch ist es?" },
  mandatLaufzeit:       { stand: "unbestaetigt", frage: "Sechs Monate, danach monatlich kündbar? Kein Alleinverkaufsrecht gegenüber der Eigentümerschaft?" },
  kaeuferliste:         { stand: "unbestaetigt", frage: "Gibt es die gepflegte Käuferliste — und wie entsteht sie datenschutzkonform?" },
  inserierenKostenlos:  { stand: "unbestaetigt", frage: "Bleibt das Inserieren für Privatpersonen dauerhaft kostenlos?" },
  keinBezahltesRanking: { stand: "unbestaetigt", frage: "Bleibt es dabei, dass sich niemand in der Suche nach vorne kaufen kann?" },
  verwaltungLeistungen: { stand: "unbestaetigt", frage: "Werden alle acht aufgeführten Bewirtschaftungsleistungen angeboten?" },
  verwaltungPreismodell:{ stand: "unbestaetigt", frage: "Stimmen die drei Preismodelle?" },
  eigentuemerReport:    { stand: "unbestaetigt", frage: "Gibt es den monatlichen Eigentümer-Report in der gezeigten Form?" },
  finanzierungspartner: { stand: "unbestaetigt", frage: "Gibt es eine Finanzierungspartnerschaft — mit wem?" },
  verkaufsablauf:       { stand: "unbestaetigt", frage: "Entspricht der Zehn-Etappen-Ablauf dem tatsächlichen Vorgehen?" },
  exclusivePraesentation:{ stand: "unbestaetigt", frage: "Erhält jedes Mandat Fotografie, Film und Dossier ohne Zusatzkosten?" },
  neubauAngebot:        { stand: "unbestaetigt", frage: "Werden Neubauprojekte als eigene Kategorie vermarktet?" },
  vierSprachenService:  { stand: "teilweise",    frage: "Oberfläche ja — auch Beratung und Korrespondenz?" },
  dokumentFreigabe:     { stand: "unbestaetigt", frage: "Wer entscheidet operativ über die Freigabestufen?" },
  ohneKonto:            { stand: "bestaetigt-technisch", frage: "Gilt «ohne Konto» auch nach Einführung echter Konten?" },
  identitaetGeprueft:   { stand: "unbestaetigt", frage: "Was bedeutet «geprüftes Inserat» — welche Prüfung, durch wen?" }
} as const satisfies Record<string, { stand: AussageStand; frage: string }>;

export type Aussage = keyof typeof AUSSAGEN;

const STUFE: Record<AussageStand, number> = { bestaetigt: 3, "bestaetigt-technisch": 2, teilweise: 1, geplant: 1, unbestaetigt: 0, demo: 0 };

export function sichtbar(aussage: Aussage, umgebung: string): boolean {
  if (umgebung !== "production") return true;
  return STUFE[AUSSAGEN[aussage].stand] >= 3;
}

export const offeneAussagen = () =>
  (Object.entries(AUSSAGEN) as [Aussage, { stand: AussageStand; frage: string }][])
    .filter(([, a]) => STUFE[a.stand] < 3)
    .map(([schluessel, a]) => ({ schluessel, ...a }));
