/* Geschäftsaussagen — Übernahme von final/policy.js.

   P5.9 Phase B (2026-09-06): der Inhaber hat zu jeder Aussage einen
   Geschäftsentscheid getroffen (Feld `entscheid`). Vier Entscheidungen sind
   möglich:
     CONFIRM          — die Aussage stimmt unverändert; darf produktiv stehen
     CONFIRM_REWORDED — die Sache stimmt, aber nur in einer vorsichtigeren
                        Formulierung (kein „immer/garantiert/alles“)
     KEEP_PLANNED     — noch nicht entschieden; öffentlich höchstens ein
                        neutraler Satz (Feld `neutral`), nie das Original
     REMOVE           — die Aussage verschwindet aus dem Auftritt; der
                        Datenbankzustand bleibt unberührt

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
   gibt ihn nur heraus, wenn `stand === "bestaetigt"` ist. `neutral` ist der
   Satz, der schon VOR Bestätigung öffentlich stehen darf, weil er nichts
   zusagt — `neutral()` gibt ihn unabhängig vom Stand heraus. Bestätigung ist
   ein Geschäftsentscheid, nicht ein Code-Flag. */

export type AussageStand = "bestaetigt" | "bestaetigt-technisch" | "teilweise" | "geplant" | "unbestaetigt" | "demo";
export type EntscheidWahl = "CONFIRM" | "CONFIRM_REWORDED" | "KEEP_PLANNED" | "REMOVE";
export type Entscheid = { datum: string; wahl: EntscheidWahl; notiz: string };

type AussageEintrag = {
  stand: AussageStand;
  satz: string | null;
  frage: string;
  quelle: string[];
  entscheid: Entscheid;
  /* Optionale Zusatzfelder — nicht jede Aussage braucht sie. */
  neutral?: string;
  zusatz?: string;
  schritte?: string[];
  leistungsbereiche?: string[];
};

export const AUSSAGEN = {
  /* Sortierung «Neuste»: bis zu drei Fourwalls-Exclusive-Objekte hervorgehoben —
     jetzt als Geschäftsregel bestätigt, siehe docs/marktplatz-reihenfolge.md. */
  exclusivePlatzierung: {
    stand: "bestaetigt",
    satz: "Bei «Neuste» können bis zu drei Fourwalls-Exclusive-Objekte hervorgehoben stehen. Sie sind als Fourwalls Exclusive gekennzeichnet; die Reihenfolge ist nicht käuflich.",
    frage: "Dürfen bei Sortierung «Neuste» bis zu drei Fourwalls-Exclusive-Mandate zuoberst stehen? (Prototyp-Verhalten, kein bezahltes Ranking; Geschäftsregel offen)",
    quelle: ["server/search.ts (Sortierung „neu“)", "i18n/messages/*/navigation.json (nav.exclusive)"],
    entscheid: { datum: "2026-09-06", wahl: "CONFIRM_REWORDED", notiz: "Bestätigt, aber vorsichtiger formuliert: Kennzeichnung und Nicht-Käuflichkeit der regulären Reihenfolge werden explizit genannt." }
  },
  bewertungKostenlos: {
    stand: "bestaetigt",
    satz: "Unverbindliche Immobilien-Einschätzung anfragen.",
    zusatz: "Die Anfrage ist ohne Gebühr und ohne Verpflichtung zu einem Mandat.",
    frage: "Ist die hedonische Bewertung tatsächlich kostenlos und unverbindlich?",
    quelle: ["i18n/messages/*/navigation.json (nav.bewertung)", "app/[locale]/verkaufen/page.tsx (Abgrenzung „Lieber selbst inserieren?“)", "app/[locale]/bewertung (Formular, anderer Auftrag)"],
    entscheid: { datum: "2026-09-06", wahl: "CONFIRM_REWORDED", notiz: "Bestätigt als unverbindliche Einschätzung im Gespräch — nie als Gutachten oder CHF-Zahl bezeichnen." }
  },
  honorarNurBeiErfolg: {
    stand: "geplant",
    satz: null,
    neutral: "Honorar und Mandatsbedingungen werden transparent im persönlichen Gespräch vereinbart.",
    frage: "Fällt das Verkaufshonorar ausschliesslich bei Erfolg an — und wie hoch ist es?",
    quelle: ["app/[locale]/verkaufen/page.tsx (Abschnitt „Was Sie erwarten können“)", "i18n/messages/*/service.json (sv_ Verkaufen-Texte)"],
    entscheid: { datum: "2026-09-06", wahl: "KEEP_PLANNED", notiz: "Honorarmodell noch nicht entschieden. Öffentlich nur der neutrale Satz, kein Erfolgshonorar-Versprechen." }
  },
  mandatLaufzeit: {
    stand: "unbestaetigt",
    satz: null,
    frage: "Sechs Monate, danach monatlich kündbar? Kein Alleinverkaufsrecht gegenüber der Eigentümerschaft?",
    quelle: ["app/[locale]/verkaufen/page.tsx (Prozess/Abgrenzung)"],
    entscheid: { datum: "2026-09-06", wahl: "KEEP_PLANNED", notiz: "Keine Laufzeit nennen — weder Dauer noch Kündigungsfrist noch Alleinverkaufsrecht." }
  },
  kaeuferliste: {
    stand: "unbestaetigt",
    satz: null,
    frage: "Gibt es die gepflegte Käuferliste — und wie entsteht sie datenschutzkonform?",
    quelle: ["app/[locale]/verkaufen/page.tsx (Was Fourwalls tut)"],
    entscheid: { datum: "2026-09-06", wahl: "REMOVE", notiz: "Aus dem Auftritt entfernt. Nichts über Käuferlisten, Käuferdatenbanken oder vorgemerkte Käufer erwähnen." }
  },
  inserierenKostenlos: {
    stand: "bestaetigt",
    satz: "Standard-Inserat ohne Inseratsgebühr.",
    frage: "Bleibt das Inserieren für Privatpersonen dauerhaft kostenlos?",
    quelle: ["i18n/messages/*/navigation.json (nav.inserieren, nav.wegInser)", "i18n/messages/*/common.json (veroeffentlichen)", "i18n/messages/*/account.json (k_jetztKostenlosPunkt)"],
    entscheid: { datum: "2026-09-06", wahl: "CONFIRM_REWORDED", notiz: "Bestätigt für das Standard-Inserat, aber nie als „immer/komplett/garantiert kostenlos“ formulieren — nur „ohne Inseratsgebühr“." }
  },
  keinBezahltesRanking: {
    stand: "bestaetigt",
    satz: "Die reguläre Reihenfolge der Suchergebnisse ist nicht käuflich.",
    frage: "Bleibt es dabei, dass sich niemand in der Suche nach vorne kaufen kann?",
    quelle: ["server/search.ts (Sortierlogik)"],
    entscheid: { datum: "2026-09-06", wahl: "CONFIRM", notiz: "Bestätigt unverändert." }
  },
  verwaltungLeistungen: {
    stand: "bestaetigt",
    satz: "Mögliche Leistungen werden passend zur Liegenschaft und zum Mandat vereinbart.",
    leistungsbereiche: ["Bewirtschaftung", "Vermietung", "Mieterbetreuung", "Abrechnung", "Unterhalt/Koordination", "Eigentümerberatung"],
    frage: "Werden alle aufgeführten Bewirtschaftungsleistungen angeboten?",
    quelle: ["app/[locale]/verwalten/page.tsx (Themenliste)"],
    entscheid: { datum: "2026-09-06", wahl: "CONFIRM_REWORDED", notiz: "Bestätigt als Leistungsbereiche, nicht als fixer Leistungskatalog — der tatsächliche Umfang wird je Mandat vereinbart." }
  },
  verwaltungPreismodell: {
    stand: "geplant",
    satz: null,
    neutral: "Auf Basis der Liegenschaft und des gewünschten Leistungsumfangs erstellen wir ein individuelles Angebot.",
    frage: "Stimmen die aufgeführten Preismodelle?",
    quelle: ["app/[locale]/verwalten/page.tsx"],
    entscheid: { datum: "2026-09-06", wahl: "KEEP_PLANNED", notiz: "Kein Preismodell nennen — nur der neutrale Satz zum individuellen Angebot." }
  },
  eigentuemerReport: {
    stand: "geplant",
    satz: null,
    frage: "Gibt es den Eigentümer-Report in der gezeigten Form — und in welcher Frequenz?",
    quelle: ["components/site/kopf.tsx (nReport-Beschreibung)", "i18n/messages/*/navigation.json (nav.report)"],
    entscheid: { datum: "2026-09-06", wahl: "REMOVE", notiz: "Eintrag aus der Navigation entfernt, bis Form und Frequenz feststehen." }
  },
  finanzierungspartner: {
    stand: "unbestaetigt",
    satz: null,
    frage: "Gibt es eine Finanzierungspartnerschaft — mit wem?",
    quelle: ["— kein Vorkommen im aktuellen Auftritt —"],
    entscheid: { datum: "2026-09-06", wahl: "KEEP_PLANNED", notiz: "Kein Partner. Der Tragbarkeitsrechner bleibt neutral (eigene Richtwerte, keine Partnerbank)." }
  },
  verkaufsablauf: {
    stand: "bestaetigt",
    satz: null,
    schritte: ["Anfrage", "Persönliches Gespräch", "Einschätzung und Vorgehen", "Vermarktung", "Begleitung bis zum Abschluss"],
    frage: "Entspricht der Fünf-Schritte-Ablauf dem tatsächlichen Vorgehen?",
    quelle: ["app/[locale]/verkaufen/page.tsx (Prozess in 5 Schritten)"],
    entscheid: { datum: "2026-09-06", wahl: "CONFIRM_REWORDED", notiz: "Bestätigt in dieser Reihenfolge, ausdrücklich ohne Fristen oder Antwortzeiten." }
  },
  exclusivePraesentation: {
    stand: "unbestaetigt",
    satz: null,
    neutral: "Ausgewählte Immobilien, die Fourwalls selbst vermarktet, können als Fourwalls Exclusive präsentiert werden.",
    frage: "Erhält jedes Mandat Fotografie, Film und Dossier ohne Zusatzkosten?",
    quelle: ["components/site/kopf.tsx (nav.exclusive-Beschreibung)"],
    entscheid: { datum: "2026-09-06", wahl: "KEEP_PLANNED", notiz: "Kein Foto-/Film-/Dossier-Versprechen — nur der neutrale Satz." }
  },
  vertrittVerkaeuferschaft: {
    stand: "unbestaetigt",
    satz: null,
    neutral: "Verkaufen mit Fourwalls",
    frage: "Tritt Fourwalls als Maklerin mit Mandat auf?",
    quelle: ["i18n/messages/*/property.json (o_wirVertreten)", "components/property/seite.tsx"],
    entscheid: { datum: "2026-09-06", wahl: "KEEP_PLANNED", notiz: "Firmenidentität und Mandatsrolle sind unbestätigt. Öffentlich nur die neutrale Formulierung, nie „Fourwalls vertritt die Verkäuferschaft“." }
  },
  neubauAngebot: {
    stand: "bestaetigt",
    satz: "Neubau & Projekte",
    zusatz: "Projekte von Bauträgern",
    frage: "Werden Neubauprojekte als eigene Kategorie vermarktet?",
    quelle: ["components/site/kopf.tsx (nav.neubau)", "i18n/messages/*/navigation.json (nav.neubau)"],
    entscheid: { datum: "2026-09-06", wahl: "CONFIRM_REWORDED", notiz: "Der Menüpunkt erscheint nur, wenn tatsächlich öffentliche Bauträger-Inserate vorliegen — sonst nicht." }
  },
  vierSprachenService: {
    stand: "bestaetigt",
    satz: "Website in Deutsch, Französisch, Italienisch und Englisch.",
    frage: "Oberfläche ja — auch Beratung und Korrespondenz?",
    quelle: ["components/marktplatz/labels.ts"],
    entscheid: { datum: "2026-09-06", wahl: "CONFIRM_REWORDED", notiz: "Bestätigt für die Website. Beratungssprache je nach Verfügbarkeit — kein Versprechen dazu." }
  },
  dokumentFreigabe: {
    stand: "unbestaetigt",
    satz: null,
    frage: "Wer entscheidet operativ über die Freigabestufen?",
    quelle: ["— kein Vorkommen im aktuellen Auftritt —"],
    entscheid: { datum: "2026-09-06", wahl: "KEEP_PLANNED", notiz: "Intern, keine öffentliche Aussage." }
  },
  ohneKonto: {
    stand: "bestaetigt",
    satz: "Immobilien suchen und entdecken ohne Konto.",
    frage: "Gilt «ohne Konto» auch nach Einführung echter Konten?",
    quelle: ["app/[locale]/konto (Ihr Bereich ohne Konto)", "i18n/messages/*/account.json (k_ihrBereichHin)"],
    entscheid: { datum: "2026-09-06", wahl: "CONFIRM", notiz: "Bestätigt für Suchen/Entdecken — nicht als „alles ohne Konto“ formulieren, denn Merkliste/Suchabos/eigene Inserate sind geräte-, nicht kontogebunden." }
  },
  identitaetGeprueft: {
    stand: "unbestaetigt",
    satz: null,
    frage: "Was bedeutet «geprüftes Inserat» — welche Prüfung, durch wen?",
    quelle: ["components/property/seite.tsx", "components/marktplatz/karte.tsx", "app/[locale]/_anbieter/gemeinsam.tsx"],
    entscheid: { datum: "2026-09-06", wahl: "REMOVE", notiz: "Kein öffentliches «geprüft/verifiziert»-Kennzeichen mehr. Der Datenbankzustand (verification_state) bleibt unberührt und im Konto-/Org-Bereich weiter sichtbar." }
  },
  erstvermietungMarktmiete: {
    stand: "geplant",
    satz: "Erstvermietung nach Fertigstellung oder Sanierung",
    frage: "Wird die Erstvermietung tatsächlich zur Marktmiete durchgeführt — nach welcher Methode ermittelt?",
    quelle: ["components/site/kopf.tsx (nErst-Beschreibung)", "i18n/messages/*/navigation.json (nav.erstvermietung)", "app/[locale]/vermieten/page.tsx"],
    entscheid: { datum: "2026-09-06", wahl: "CONFIRM_REWORDED", notiz: "Erstvermietung als Leistungsrichtung bestätigt. Der Begriff «Marktmiete» wird entfernt (stand „geplant“) — keine Zusage zu Ermittlungsmethode oder Höhe." }
  }
} as const satisfies Record<string, AussageEintrag>;

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

/* Liefert den neutralen Satz einer Geschäftsaussage — unabhängig vom Stand,
   weil er per Definition nichts zusagt, was noch nicht entschieden ist.
   null, wenn keiner hinterlegt ist. */
export function neutral(aussage: Aussage): string | null {
  const a = AUSSAGEN[aussage] as { neutral?: string };
  return a.neutral ?? null;
}

export const offeneAussagen = () =>
  (Object.entries(AUSSAGEN) as [Aussage, { stand: AussageStand; frage: string }][])
    .filter(([, a]) => STUFE[a.stand] < 3)
    .map(([schluessel, a]) => ({ schluessel, ...a }));
