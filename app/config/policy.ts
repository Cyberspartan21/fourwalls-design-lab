/* Geschäftsaussagen — Übernahme von final/policy.js.

   Drei Stände, die im Prototyp gleich aussahen:
     bestaetigt  — die Firma hat es schriftlich bestätigt; darf produktiv stehen
     geplant     — vorgesehen, nicht entschieden
     demo        — nur damit der Prototyp vollständig wirkt

   `sichtbar()` ist die einzige Stelle, die entscheidet. Ausserhalb der
   Produktion bleibt alles sichtbar; in der Produktion nur Bestätigtes. Die
   Umgebung kommt von aussen, damit diese Datei auch im Browser laufen kann.

   `quelle` listet je Aussage, wo im Auftritt sie auftaucht oder auftauchen
   könnte — damit beim Bestätigen klar ist, welche Texte betroffen sind.
   `satz` ist der Text, der NACH Bestätigung erscheinen dürfte; `zusage()`
   gibt ihn nur heraus, wenn `stand === "bestaetigt"` ist. Bestätigung ist
   ein Geschäftsentscheid, nicht ein Code-Flag. */

export type AussageStand = "bestaetigt" | "bestaetigt-technisch" | "teilweise" | "geplant" | "unbestaetigt" | "demo";

export const AUSSAGEN = {
  /* P5.3: Sortierung «Neuste» zeigt höchstens drei Exclusive-Mandate zuoberst — Verhalten des Prototyps,
     als Geschäftsregel NICHT bestätigt. Kein bezahltes Ranking; in «Empfohlen» kein Bonus. */
  exclusivePlatzierung: {
    stand: "demo", satz: null,
    frage: "Dürfen bei Sortierung «Neuste» bis zu drei Fourwalls-Exclusive-Mandate zuoberst stehen? (Prototyp-Verhalten, kein bezahltes Ranking; Geschäftsregel offen)",
    quelle: ["server/search.ts (Sortierung „empfohlen“)", "i18n/messages/*/navigation.json (nav.exclusive)"]
  },
  bewertungKostenlos: {
    stand: "unbestaetigt", satz: null,
    frage: "Ist die hedonische Bewertung tatsächlich kostenlos und unverbindlich?",
    quelle: ["i18n/messages/*/navigation.json (nav.bewertung)", "app/[locale]/verkaufen/page.tsx (Abgrenzung „Lieber selbst inserieren?“)", "app/[locale]/bewertung (Formular, anderer Auftrag)"]
  },
  honorarNurBeiErfolg: {
    stand: "unbestaetigt", satz: null,
    frage: "Fällt das Verkaufshonorar ausschliesslich bei Erfolg an — und wie hoch ist es?",
    quelle: ["app/[locale]/verkaufen/page.tsx (Abschnitt „Was Sie erwarten können“)", "i18n/messages/*/service.json (sv_ Verkaufen-Texte)"]
  },
  mandatLaufzeit: {
    stand: "unbestaetigt", satz: null,
    frage: "Sechs Monate, danach monatlich kündbar? Kein Alleinverkaufsrecht gegenüber der Eigentümerschaft?",
    quelle: ["app/[locale]/verkaufen/page.tsx (Prozess/Abgrenzung)"]
  },
  kaeuferliste: {
    stand: "unbestaetigt", satz: null,
    frage: "Gibt es die gepflegte Käuferliste — und wie entsteht sie datenschutzkonform?",
    quelle: ["app/[locale]/verkaufen/page.tsx (Was Fourwalls tut)"]
  },
  inserierenKostenlos: {
    stand: "unbestaetigt", satz: null,
    frage: "Bleibt das Inserieren für Privatpersonen dauerhaft kostenlos?",
    quelle: ["i18n/messages/*/navigation.json (nav.inserieren, nav.wegInser)", "i18n/messages/*/common.json (veroeffentlichen)", "i18n/messages/*/account.json (k_jetztKostenlosPunkt)"]
  },
  keinBezahltesRanking: {
    stand: "unbestaetigt", satz: null,
    frage: "Bleibt es dabei, dass sich niemand in der Suche nach vorne kaufen kann?",
    quelle: ["server/search.ts (Sortierlogik)"]
  },
  verwaltungLeistungen: {
    stand: "unbestaetigt", satz: null,
    frage: "Werden alle aufgeführten Bewirtschaftungsleistungen angeboten?",
    quelle: ["app/[locale]/verwalten/page.tsx (Themenliste)"]
  },
  verwaltungPreismodell: {
    stand: "unbestaetigt", satz: null,
    frage: "Stimmen die aufgeführten Preismodelle?",
    quelle: ["app/[locale]/verwalten/page.tsx"]
  },
  eigentuemerReport: {
    stand: "unbestaetigt", satz: null,
    frage: "Gibt es den Eigentümer-Report in der gezeigten Form — und in welcher Frequenz?",
    quelle: ["components/site/kopf.tsx (nReport-Beschreibung)", "i18n/messages/*/navigation.json (nav.report)"]
  },
  finanzierungspartner: {
    stand: "unbestaetigt", satz: null,
    frage: "Gibt es eine Finanzierungspartnerschaft — mit wem?",
    quelle: ["— kein Vorkommen im aktuellen Auftritt —"]
  },
  verkaufsablauf: {
    stand: "unbestaetigt", satz: null,
    frage: "Entspricht der Fünf-Schritte-Ablauf dem tatsächlichen Vorgehen?",
    quelle: ["app/[locale]/verkaufen/page.tsx (Prozess in 5 Schritten)"]
  },
  exclusivePraesentation: {
    stand: "unbestaetigt", satz: null,
    frage: "Erhält jedes Mandat Fotografie, Film und Dossier ohne Zusatzkosten?",
    quelle: ["components/site/kopf.tsx (nav.exclusive-Beschreibung)"]
  },
  neubauAngebot: {
    stand: "unbestaetigt", satz: null,
    frage: "Werden Neubauprojekte als eigene Kategorie vermarktet?",
    quelle: ["components/site/kopf.tsx (nav.neubau)", "i18n/messages/*/navigation.json (nav.neubau)"]
  },
  vierSprachenService: {
    stand: "teilweise", satz: null,
    frage: "Oberfläche ja — auch Beratung und Korrespondenz?",
    quelle: ["components/marktplatz/labels.ts"]
  },
  dokumentFreigabe: {
    stand: "unbestaetigt", satz: null,
    frage: "Wer entscheidet operativ über die Freigabestufen?",
    quelle: ["— kein Vorkommen im aktuellen Auftritt —"]
  },
  ohneKonto: {
    stand: "bestaetigt-technisch", satz: null,
    frage: "Gilt «ohne Konto» auch nach Einführung echter Konten?",
    quelle: ["app/[locale]/konto (Ihr Bereich ohne Konto)", "i18n/messages/*/account.json (k_ihrBereichHin)"]
  },
  identitaetGeprueft: {
    stand: "unbestaetigt", satz: null,
    frage: "Was bedeutet «geprüftes Inserat» — welche Prüfung, durch wen?",
    quelle: ["components/property/seite.tsx", "components/marktplatz/karte.tsx", "app/api/search/route.ts"]
  }
} as const satisfies Record<string, { stand: AussageStand; satz: string | null; frage: string; quelle: string[] }>;

export type Aussage = keyof typeof AUSSAGEN;

const STUFE: Record<AussageStand, number> = { bestaetigt: 3, "bestaetigt-technisch": 2, teilweise: 1, geplant: 1, unbestaetigt: 0, demo: 0 };

export function sichtbar(aussage: Aussage, umgebung: string): boolean {
  if (umgebung !== "production") return true;
  return STUFE[AUSSAGEN[aussage].stand] >= 3;
}

/* Liefert den bestätigten Satz einer Geschäftsaussage — oder null, solange
   sie nicht bestätigt ist. Bestätigung ist ein Geschäftsentscheid, nicht ein
   Code-Flag: diese Funktion ändert nichts an AUSSAGEN, sie liest nur. */
export function zusage(aussage: Aussage): string | null {
  const a = AUSSAGEN[aussage];
  return (a.stand as string) === "bestaetigt" ? a.satz : null;
}

export const offeneAussagen = () =>
  (Object.entries(AUSSAGEN) as [Aussage, { stand: AussageStand; frage: string }][])
    .filter(([, a]) => STUFE[a.stand] < 3)
    .map(([schluessel, a]) => ({ schluessel, ...a }));
