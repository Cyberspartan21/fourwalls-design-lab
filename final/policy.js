/* ============================================================
   FOURWALLS — Geschäftsaussagen, an einem Ort.

   Der Prototyp behauptet an mehreren Stellen etwas über das Geschäft:
   dass die Bewertung nichts kostet, dass das Honorar nur bei Erfolg anfällt,
   dass es eine gepflegte Käuferliste gibt, dass niemand sich in der Suche
   nach vorne kaufen kann. Jede dieser Aussagen kann stimmen. Keine davon ist
   bisher von der Auftraggeberschaft bestätigt worden.

   Diese Datei trennt darum drei Dinge, die im Prototyp bisher gleich aussahen:

     bestaetigt  — die Firma hat es schriftlich bestätigt. Darf produktiv stehen.
     geplant     — ist so vorgesehen, aber noch nicht entschieden oder umgesetzt.
     demo        — existiert nur, damit der Prototyp vollständig wirkt.

   Solange `umgebung` nicht "produktion" ist, wird nichts ausgeblendet: der
   Prototyp soll vollständig bleiben. In der Produktion darf `sichtbar()` nur
   für bestätigte Aussagen wahr werden — so kann eine unbestätigte Behauptung
   nicht versehentlich live gehen, nur weil sie im Prototyp einmal dastand.

   NICHTS hier wird von der Entwicklung entschieden. Der Stand ändert sich
   ausschliesslich, wenn die Firma eine Aussage bestätigt.
   ============================================================ */
window.FWPOLICY = (function () {

  const umgebung = "demo";          // demo | staging | produktion

  /* quelle: wo die Aussage im Auftritt steht — damit man beim Bestätigen
     weiss, welche Texte betroffen sind. */
  const AUSSAGEN = {
    bewertungKostenlos: {
      stand: "unbestaetigt",
      frage: "Ist die hedonische Bewertung für Eigentümerschaft tatsächlich kostenlos und unverbindlich?",
      quelle: ["ufer/index.html (Dienste-Paar)", "ufer/verkaufen.html (Held, Hub, Bewertungsformular)", "ufer/portal.html (Assistent, Preisschritt)", "Navigation «Kostenlose Bewertung»"]
    },
    honorarNurBeiErfolg: {
      stand: "unbestaetigt",
      frage: "Fällt das Verkaufshonorar wirklich ausschliesslich bei erfolgreichem Verkauf an, ohne Vorauszahlung? Und wie hoch ist es (Satz oder Spanne)?",
      quelle: ["ufer/index.html (Dienste, Vertrauensleiste)", "ufer/verkaufen.html (Held, Hub, Zahlenleiste, FAQ)", "ufer/portal.html (Verkaufsweiche)"]
    },
    mandatLaufzeit: {
      stand: "unbestaetigt",
      frage: "Läuft das Verkaufsmandat sechs Monate und ist danach monatlich kündbar? Ist es kein Alleinverkaufsrecht gegenüber der Eigentümerschaft selbst?",
      quelle: ["ufer/verkaufen.html (FAQ «Bin ich an eine Laufzeit gebunden?», «Kann ich gleichzeitig selbst inserieren?»)"]
    },
    kaeuferliste: {
      stand: "unbestaetigt",
      frage: "Gibt es eine gepflegte Käuferliste für den stillen Verkauf? Wenn ja: wie entsteht sie datenschutzkonform?",
      quelle: ["ufer/verkaufen.html (Etappe II Strategie, Etappe V Vermarktung)", "ufer/index.html (Dienste-Paar)"]
    },
    inserierenKostenlos: {
      stand: "unbestaetigt",
      frage: "Bleibt das Inserieren für Privatpersonen dauerhaft kostenlos — auch nach einer späteren Monetarisierung?",
      quelle: ["Navigation «Gratis inserieren»", "ufer/index.html (Wege)", "ufer/portal.html (Verkaufsweiche, Assistent)", "ufer/verkaufen.html (Hub)"]
    },
    keinBezahltesRanking: {
      stand: "unbestaetigt",
      frage: "Bleibt es dabei, dass sich niemand in der Suchreihenfolge nach vorne kaufen kann? Diese Aussage schliesst ein späteres Geschäftsmodell mit bezahlter Sichtbarkeit aus.",
      quelle: ["ufer/index.html (Vertrauensleiste «Keine Rangkäufe»)", "core.js (Sortierlogik, Kommentar)"]
    },
    verwaltungLeistungen: {
      stand: "unbestaetigt",
      frage: "Werden alle acht aufgeführten Bewirtschaftungsleistungen tatsächlich angeboten (Mietzinsinkasso, Nebenkostenabrechnung, Erst- und Wiedervermietung, Mieterkommunikation, Handwerkerkoordination, Übergabe/Abnahme, Leerstandsmanagement, Werterhalt/Sanierung)?",
      quelle: ["ufer/verwalten.html (#leistungen)", "ufer/index.html (Dienste-Paar)"]
    },
    verwaltungPreismodell: {
      stand: "unbestaetigt",
      frage: "Stimmen die drei Preismodelle (Renditeliegenschaften nach Aufwand, Stockwerkeigentum als Jahrespauschale, Erstvermietung als Anteil einer Monatsmiete)?",
      quelle: ["ufer/verwalten.html (#erstvermietung/Preise)", "ufer/index.html (Dienste-Paar)"]
    },
    eigentuemerReport: {
      stand: "unbestaetigt",
      frage: "Gibt es den monatlichen Eigentümer-Report mit Belegen online in der gezeigten Form?",
      quelle: ["ufer/verwalten.html (#report)", "Navigation «Eigentümer-Report»"]
    },
    finanzierungspartner: {
      stand: "unbestaetigt",
      frage: "Gibt es eine Finanzierungspartnerschaft, über die verbindlich gerechnet werden kann? Mit wem?",
      quelle: ["ufer/wissen.html (Tragbarkeitsrechner, Kleingedrucktes)"]
    },
    verkaufsablauf: {
      stand: "unbestaetigt",
      frage: "Entspricht der Zehn-Etappen-Ablauf dem tatsächlichen Vorgehen? Sind die Wochenangaben als typischer Verlauf vertretbar?",
      quelle: ["ufer/verkaufen.html (#ablauf)"]
    },
    exclusivePraesentation: {
      stand: "unbestaetigt",
      frage: "Erhält jedes Mandat die vollständige Exclusive-Präsentation (Fotografie, Film, Grundrisse, Dossier) ohne Zusatzkosten?",
      quelle: ["ufer/verkaufen.html (#exclusive)", "ufer/index.html (Premiere)", "ufer/portal.html (Verkaufsweiche)"]
    },
    neubauAngebot: {
      stand: "unbestaetigt",
      frage: "Werden Neubauprojekte von Bauträgern tatsächlich als eigene Kategorie vermarktet?",
      quelle: ["Navigation «Neubauprojekte»", "ufer/index.html (Entdeckungskarten)"]
    },
    vierSprachenService: {
      stand: "teilweise",
      frage: "«Vier Sprachen» steht als Vertrauensmerkmal. Die Oberfläche ist viersprachig; Beratung und Korrespondenz auf Französisch, Italienisch und Englisch sind nicht bestätigt.",
      quelle: ["ufer/index.html (Vertrauensleiste)", "ufer/verkaufen.html (Zahlenleiste)"]
    },
    dokumentFreigabe: {
      stand: "unbestaetigt",
      frage: "Werden Dokumente wirklich stufenweise freigegeben (nach Anfrage, nach Besichtigung, nach Einigung) — und wer entscheidet das operativ?",
      quelle: ["ufer/objekt.js (Dokumentstufen)", "ufer/verkaufen.html (FAQ Datenschutz)"]
    },
    ohneKonto: {
      stand: "bestaetigt-technisch",
      frage: "Suchen, Merken und Suchabo ohne Konto — technisch im Prototyp umgesetzt und als Produktentscheid in P1–P4 getragen. Bestätigt bleibt zu klären, ob das auch nach Einführung echter Konten gilt.",
      quelle: ["ufer/index.html (Vertrauensleiste)", "ufer/portal.html (Konto-Bereich)"]
    },
    identitaetGeprueft: {
      stand: "unbestaetigt",
      frage: "Was genau bedeutet «geprüftes Inserat» — welche Prüfung findet statt, durch wen?",
      quelle: ["ufer/objekt.js (Quellband, Kontaktkarte)", "ufer/portal.html (Kartenzeile)"]
    }
  };

  const STUFEN = { bestaetigt:3, "bestaetigt-technisch":2, teilweise:1, geplant:1, unbestaetigt:0, demo:0 };

  /* Darf diese Aussage angezeigt werden?
     Ausserhalb der Produktion: ja — der Prototyp soll vollständig bleiben.
     In der Produktion: nur, was bestätigt ist. */
  function sichtbar(schluessel) {
    const a = AUSSAGEN[schluessel];
    if (!a) return umgebung !== "produktion";
    if (umgebung !== "produktion") return true;
    return (STUFEN[a.stand] || 0) >= 3;
  }

  function offeneFragen() {
    return Object.entries(AUSSAGEN)
      .filter(([, a]) => (STUFEN[a.stand] || 0) < 3)
      .map(([k, a]) => ({ schluessel:k, stand:a.stand, frage:a.frage, quelle:a.quelle }));
  }

  return { umgebung, AUSSAGEN, sichtbar, offeneFragen,
    zahl: () => Object.keys(AUSSAGEN).length,
    offen: () => offeneFragen().length };
})();
