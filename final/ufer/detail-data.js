/* FOURWALLS — Tiefen-Dossiers für drei Referenz-Inserate (Ufer-Detailseite).
   FIKTIVE DEMO-DATEN. Drei Tiefenstufen: exclusive (Fourwalls-Mandat), agentur (Makler-Inserat),
   privat (Privatinserat, absichtlich sparsam befüllt). Nicht sinnvolle Blöcke fehlen bewusst,
   statt mit leeren Arrays/Objekten aufgefüllt zu werden. */
window.FWD = {

  /* ======================================================================
     STUFE: EXCLUSIVE — Fourwalls-Mandat, maximale Tiefe
     ====================================================================== */
  "seehaus-walensee": {
    stufe: "exclusive",

    quelle: {
      art: "fourwalls",
      name: "Fourwalls AG",
      person: "Lena Furrer, Leitung Verkauf Zürich",
      telefon: "+41 44 555 01 01",
      email: "lena.furrer@fourwalls.example",
      verifiziert: true,
      hinweis: "Fourwalls vertritt die Verkäuferschaft exklusiv"
    },

    story: {
      titel: "Ein Haus, das dem Licht folgt",
      absaetze: [
        "Das Seehaus wurde 2019 von einem Zürcher Architekturbüro als privater Rückzugsort über dem Walensee realisiert. Zwei auskragende Geschosse aus Sichtbeton schieben sich über den Hang, raumhohes Glas öffnet den Wohnbereich nach Süden zum Wasser. Die Bauherrschaft legte Wert auf reduzierte Materialität: Beton, Eiche und Naturstein, ohne zusätzliche Dekoration. Entstanden ist ein Haus, das sich der Landschaft unterordnet, statt sie zu dominieren.",
        "Der Grundriss folgt der Tagesroutine der Bewohner: Küche und Essbereich liegen im Osten und fangen die Morgensonne, der Wohnraum mit freistehendem Cheminéeofen orientiert sich zum See, das Hauptschlafzimmer mit Ankleide besetzt das gesamte südliche Ende des Obergeschosses. Drei weitere Zimmer und zwei Bäder ergänzen das Raumprogramm. Ein Arbeitszimmer im Erdgeschoss lässt sich bei Bedarf als Gästezimmer nutzen.",
        "Die Umgebung bleibt bewusst zurückhaltend: Wiese, acht Obstbäume, ein öffentlicher Badeplatz drei Gehminuten entfernt. Technisch ist das Haus auf Langfristigkeit ausgelegt – Erdsonden-Wärmepumpe, 12 kWp Photovoltaik mit Speicher und KNX-Gebäudesteuerung sorgen trotz grosszügiger Verglasung für tiefe Betriebskosten. Seit dem Bezug 2019 wurde das Haus durchgehend gepflegt, nie vermietet und nie umgebaut."
      ]
    },

    highlights: [
      "Unverbaubarer Seeblick auf den Walensee",
      "Architektur 2019 von Zürcher Büro, Minergie-zertifiziert",
      "1'120 m² Umschwung mit acht Obstbäumen",
      "3 Gehminuten zum öffentlichen Badeplatz",
      "Erdsonden-Wärmepumpe, 12 kWp Photovoltaik mit Speicher",
      "KNX-Smarthome für Licht, Storen und Heizung",
      "Doppelgarage mit zwei Wallboxen"
    ],

    fakten: {
      wohnflaeche: 289,
      nutzflaeche: 331,
      grundstueck: 1120,
      zimmer: 5.5,
      schlafzimmer: 4,
      badezimmer: 3,
      baujahr: 2019,
      geschosse: 2,
      raumhoehe: 2.6,
      verfuegbar: "Nach Vereinbarung",
      kubatur: 1240,
      preis: 5480000,
      preisM2: 18960
    },

    gebaeude: {
      bauweise: "Kompaktbau in Sichtbeton und Stahl, zweigeschossig zum See auskragend",
      dach: "Flachdach, extensiv begrünt, Attika-Aufbau für Haustechnik",
      fenster: "Pfosten-Riegel-Verglasung, 3-fach isolierverglast, Sonnenschutzglas Süd",
      zustand: "Neuwertig, durchgehend gepflegt seit Bezug 2019",
      ausrichtung: "Hauptfassade Süd-West zum See, Schlafräume Ost",
      volumen: 1240
    },

    ausstattung: {
      kueche: "Offene Design-Küche, Fronten Nussbaum, Arbeitsplatte Kalkstein, Gaggenau-Geräte",
      baeder: "3 Bäder in Naturstein (Kalkstein/Travertin), bodenebene Duschen, Doppellavabo im Hauptbad",
      boeden: "Eichenparkett in den Hauptgeschossen, Feinsteinzeug in Nassräumen, Sichtbeton im Eingang",
      geraete: "Gaggenau-Kochfeld und -Ofen, Miele-Geschirrspüler, integrierter Weinklimaschrank",
      waschen: "Separater Waschraum mit Miele-Waschturm, Ablufttrockner",
      cheminee: "Raumhoher Cheminéeofen im Wohnbereich, verkleidet mit Speckstein",
      lift: "Kein Personenlift (kompakter zweigeschossiger Baukörper)",
      smarthome: "KNX-Gebäudesteuerung für Licht, Storen und Heizung, App-Zugriff",
      stauraum: "Eingebaute Schrankwände in der Ankleide, Kellerabteil, separater Technikraum"
    },

    energie: {
      heizung: "Wärmepumpe mit Erdsonde, Fussbodenheizung in allen Geschossen",
      energietraeger: "Erdwärme, ergänzt durch Photovoltaik-Eigenverbrauch",
      verteilung: "Bodenheizung, raumweise geregelt über KNX",
      photovoltaik: "12 kWp auf dem Flachdach, Batteriespeicher 10 kWh",
      geak: "A",
      geakKlasse: "A (sehr tiefer Bedarf)",
      minergie: true
    },

    aussen: {
      balkon: "Keine Balkone (Terrassen übernehmen diese Funktion)",
      terrasse: "68 m² gedeckte Seeterrasse plus 40 m² Sonnendeck",
      garten: "1'120 m² Umschwung, Wiese, acht Obstbäume, Badeplatz 3 Gehminuten entfernt",
      pool: "Kein eigener Pool (öffentlicher Seezugang fussläufig)",
      aussicht: "Freie Sicht auf Walensee und Churfirsten",
      privatsphaere: "Keine direkte Einsicht von Nachbargrundstücken, Bepflanzung als natürlicher Sichtschutz"
    },

    parkieren: {
      garage: "Doppelgarage direkt im Haus integriert",
      tiefgarage: "Keine (ebenerdige Garage genügt der Hanglage)",
      aussenplaetze: "1 Besucherparkplatz vor dem Haus",
      ladestation: "2× Wallbox 11 kW in der Garage"
    },

    medien: {
      bilder: [
        { key: "lakeside-villa-1", text: "Südfassade mit auskragendem Obergeschoss über dem See" },
        { key: "lakeside-villa-2", text: "Terrasse und Sonnendeck am Abend" },
        { key: "aerial-lake-1", text: "Luftaufnahme: Lage am Walensee mit den Churfirsten im Hintergrund" },
        { key: "interior-bright-1", text: "Wohnbereich mit raumhoher Verglasung zum See" },
        { key: "interior-bright-2", text: "Hauptschlafzimmer mit Ankleide" },
        { key: "kitchen-1", text: "Offene Küche mit Nussbaum-Fronten und Kalkstein-Arbeitsplatte" },
        { key: "penthouse-2", text: "Blick vom Sonnendeck auf den See" },
        { key: "mat-beton", text: "Materialdetail: geschliffener Sichtbeton" },
        { key: "mat-eiche", text: "Materialdetail: Eichenparkett im Wohnbereich" },
        { key: "mat-kalkstein", text: "Materialdetail: Kalkstein im Hauptbad" },
        { key: "mat-laerche", text: "Materialdetail: Lärchenholz-Fassadenelemente" },
        { key: "mat-messing", text: "Materialdetail: Messing-Armaturen in den Bädern" },
        { key: "mat-nussbaum", text: "Materialdetail: Nussbaum-Küchenfronten" }
      ],
      video: true,
      tour360: true,
      modell3d: true,
      sonnenverlauf: true
    },

    grundrisse: [
      {
        geschoss: "Erdgeschoss",
        datei: "plan-eg.svg",
        flaeche: 123,
        raeume: [
          { name: "Eingang", m2: 8 },
          { name: "Garderobe", m2: 6 },
          { name: "Küche", m2: 24 },
          { name: "Wohnen/Essen", m2: 58 },
          { name: "Gäste-WC", m2: 4 },
          { name: "Büro", m2: 14 }
        ]
      },
      {
        geschoss: "Obergeschoss",
        datei: "plan-og.svg",
        flaeche: 130,
        raeume: [
          { name: "Hauptschlafzimmer", m2: 32 },
          { name: "Schlafzimmer 2", m2: 18 },
          { name: "Schlafzimmer 3", m2: 16 },
          { name: "Bad 1", m2: 12 },
          { name: "Bad 2", m2: 9 },
          { name: "Ankleide", m2: 10 },
          { name: "Galerie", m2: 15 }
        ]
      }
    ],

    lage: {
      beschreibung: "Quarten liegt am Nordufer des Walensees, eingebettet zwischen Churfirsten und See. Das Grundstück befindet sich in ruhiger Hanglage, zehn Autominuten vom Dorfzentrum und der Autobahnauffahrt A3. Nachbarn sind auf Sichtdistanz, aber durch Bepflanzung getrennt. Der See prägt das Mikroklima: milde Abende, wenig Wind, lange Sonnenscheindauer bis in den Herbst.",
      gemeinde: "Quarten",
      kanton: "SG",
      quartier: "Seeuferzone Unterterzen",
      oev: [
        { name: "Bus Quarten Dorf–Walenstadt", distanz: "600 m", zeit: "4 Min. zu Fuss" },
        { name: "Bahnhof Unterterzen (S-Bahn)", distanz: "3.1 km", zeit: "6 Min. mit Auto" }
      ],
      schulen: [
        { name: "Primarschule Quarten", distanz: "1.8 km", zeit: "4 Min. mit Auto" },
        { name: "Oberstufe Walenstadt", distanz: "6 km", zeit: "9 Min. mit Auto" }
      ],
      einkauf: [
        { name: "Volg Quarten", distanz: "1.5 km", zeit: "3 Min. mit Auto" },
        { name: "Coop Walenstadt", distanz: "6.5 km", zeit: "10 Min. mit Auto" }
      ],
      freizeit: [
        { name: "Öffentlicher Badeplatz", distanz: "250 m", zeit: "3 Min. zu Fuss" },
        { name: "Walensee-Höhenweg", distanz: "400 m", zeit: "5 Min. zu Fuss" }
      ],
      fahrzeiten: [
        { ziel: "Zürich HB", zeit: "55 Min." },
        { ziel: "Flughafen Zürich", zeit: "65 Min." },
        { ziel: "Chur", zeit: "35 Min." }
      ],
      steuerfuss: "Gemeinde Quarten, einfache Steuer 2026: 122% (Kanton + Gemeinde, ohne Kirchensteuer)",
      sonne: "Süd-West-Ausrichtung, Sommersonne ca. 10–20 Uhr, Wintersonne hangbedingt ab ca. 11 Uhr",
      charakter: "Ruhiges Wohngebiet mit Einzel- und Ferienhäusern, wenig Durchgangsverkehr, hoher Anteil an Zweitwohnungen in der Nachbarschaft"
    },

    finanzen: {
      kaufpreis: 5480000,
      nebenkosten: "Notariat, Grundbuch und Handänderungssteuer im Kanton St. Gallen: ca. 1.5–2% des Kaufpreises, üblicherweise hälftig zwischen Käufer- und Verkäuferschaft verhandelbar",
      eigenmittel20: 1096000,
      hypothekBeispiel: {
        betrag: 4384000,
        zins: 1.9,
        zinsProMonat: 6940,
        amortisationProMonat: 680,
        unterhaltProMonat: 4570,
        totalProMonat: 12190
      },
      tragbarkeitEinkommen: 855210,
      preisM2Kontext: "Regionaler Median Seegemeinden Walensee ca. 13'500 CHF/m² – Lage und Architektur begründen den Aufschlag"
    },

    dokumente: [
      { name: "Verkaufsdokumentation", typ: "pdf", groesse: "8.2 MB", zugang: "oeffentlich", hinweis: "Übersicht, Lage, Ausstattung" },
      { name: "Grundrisse (EG/OG, bemasst)", typ: "pdf", groesse: "2.1 MB", zugang: "oeffentlich" },
      { name: "Energieausweis (GEAK)", typ: "pdf", groesse: "1.4 MB", zugang: "konto" },
      { name: "Baubeschrieb / Materialisierung", typ: "pdf", groesse: "3.8 MB", zugang: "konto" },
      { name: "Grundbuchauszug", typ: "pdf", groesse: "0.6 MB", zugang: "anfrage", hinweis: "Nach Identifikation" },
      { name: "Katasterplan / Vermessung", typ: "pdf", groesse: "1.1 MB", zugang: "anfrage" },
      { name: "Kaufvertragsentwurf", typ: "pdf", groesse: "0.9 MB", zugang: "besichtigung", hinweis: "Wird nach der Erstbesichtigung ausgehändigt" },
      { name: "Finanzierungsbestätigung Musterbank", typ: "pdf", groesse: "0.3 MB", zugang: "gesperrt", hinweis: "Nur für vorqualifizierte Käuferschaft" }
    ],

    faq: [
      { frage: "Ist der Seezugang privat?", antwort: "Nein, der öffentliche Badeplatz liegt rund drei Gehminuten entfernt; ein eigener Bootssteg besteht nicht." },
      { frage: "Wie ist die Erschliessung im Winter?", antwort: "Die Zufahrtsstrasse wird kommunal geräumt, das Grundstück liegt hangseitig ohne Steigung ab der Strasse." },
      { frage: "Gibt es eine Gästewohnung oder ein separates Studio?", antwort: "Nein, das Raumprogramm ist auf eine Familie ausgelegt; das Arbeitszimmer im Erdgeschoss lässt sich bei Bedarf als Gästezimmer nutzen." },
      { frage: "Sind Anpassungen am Grundriss möglich?", antwort: "Nichttragende Wände im Obergeschoss können versetzt werden; die Statik wurde entsprechend ausgelegt, Details im Baubeschrieb." },
      { frage: "Wie hoch sind die Nebenkosten pro Jahr?", antwort: "Betriebskosten inklusive Heizung und PV-Unterhalt liegen erfahrungsgemäss bei rund CHF 8'400 pro Jahr, ohne Gebäudeversicherung." },
      { frage: "Ist ein Verkauf an ausländische Käuferschaft möglich?", antwort: "Ja, da es sich um einen ständig bewohnten Hauptwohnsitz ohne Lex-Koller-Beschränkung handelt (Prüfung im Einzelfall empfohlen)." }
    ],

    naechsteSchritte: ["Besichtigung anfragen", "Frage stellen", "Finanzierung prüfen", "Dossier anfordern"],

    aehnliche: ["villa-rapperswil-1", "chalet-stgallen-1", "wohnung-rapperswil-2"]
  },

  /* ======================================================================
     STUFE: AGENTUR — Makler-Inserat, gute Tiefe
     ====================================================================== */
  "haus-zrich-2": {
    stufe: "agentur",

    quelle: {
      art: "agentur",
      name: "Bergwelt Real Estate AG",
      person: "Nadja Steiner, Verkaufsberaterin",
      telefon: "+41 44 500 22 10",
      email: "n.steiner@bergwelt-realestate.example",
      verifiziert: true,
      hinweis: "Exklusiver Verkaufsauftrag der Maklerin"
    },

    story: {
      titel: "Solides Zuhause am Zürichberghang",
      absaetze: [
        "Das Einfamilienhaus wurde 1926 erbaut und 2018 umfassend saniert: neues Dach, neue Fenster, erneuerte Küche und Bäder. Die Bausubstanz blieb erhalten – Sockelgeschoss aus Naturstein, hohe Kellerräume, solide Mauerwerkskonstruktion. Von aussen wirkt das Haus zurückhaltend, im Innern zeigt sich der grosszügige Charakter der Bauzeit mit hohen Räumen und breiten Fensterfronten.",
        "Sechs Zimmer verteilen sich auf zwei Wohngeschosse: Wohn- und Esszimmer sowie eine offene Küche im Erdgeschoss, vier Zimmer und zwei Bäder im Obergeschoss. Der Garten ist eingewachsen und pflegeleicht, mit gepflastertem Sitzplatz und einzelnen Altbäumen. Von den oberen Zimmern reicht der Blick bei klarer Sicht teilweise bis zum Zürichsee.",
        "Die Lage am Zürichberg gilt seit Jahrzehnten als gefragt: ruhig, grün, mit kurzen Wegen zu Tram, Schulen und Innenstadt. Für die Käuferschaft eignet sich das Haus sowohl als langfristiger Familienwohnsitz wie auch als Kapitalanlage in etablierter Lage mit begrenztem Angebot an vergleichbaren Grundstücken. Der Verkauf erfolgt aus Altersgründen der Eigentümerschaft, das Haus ist unterhaltsarm und bezugsbereit."
      ]
    },

    highlights: [
      "Kernsanierung 2018 (Dach, Fenster, Küche, Bäder)",
      "920 m² Grundstück mit Altbaumbestand",
      "6 Zimmer auf zwei Wohngeschossen",
      "Ruhige, grüne Lage am Zürichberg",
      "Tram Nr. 3 in 3 Gehminuten"
    ],

    fakten: {
      wohnflaeche: 185,
      nutzflaeche: 210,
      grundstueck: 920,
      zimmer: 6,
      schlafzimmer: 4,
      badezimmer: 2,
      baujahr: 1926,
      renovation: 2018,
      geschosse: 2,
      raumhoehe: 2.4,
      verfuegbar: "Nach Vereinbarung",
      kubatur: 780,
      preis: 2670000,
      preisM2: 14430
    },

    gebaeude: {
      bauweise: "Massivbau, verputztes Backstein-Mauerwerk, unterkellert",
      dach: "Ziegeldach, 2018 neu eingedeckt, für Photovoltaik vorbereitet",
      fenster: "Holz-Metall-Fenster, 2018 ersetzt, 2-fach isolierverglast",
      zustand: "Kernsaniert 2018, seither durchgehend gepflegt",
      ausrichtung: "Wohnräume Süd-West, Schlafzimmer Ost",
      volumen: 980
    },

    ausstattung: {
      kueche: "Offene Küche, Fronten Eiche, Granit-Arbeitsplatte, V-Zug-Geräte (2018)",
      baeder: "2 Bäder, davon eines en-suite, Feinsteinzeug, 2018 teilweise erneuert",
      boeden: "Eichenparkett in den Wohngeschossen, Plättli in Nassräumen und Eingang",
      geraete: "V-Zug Kochfeld/Ofen, Geschirrspüler, Kühl-Gefrierkombination",
      waschen: "Waschküche im Keller, eigene Waschmaschine (Miele)",
      cheminee: "Cheminée im Wohnzimmer, Kaminfeger-Protokoll vorhanden",
      lift: "Kein Lift",
      smarthome: "Keine Smart-Home-Steuerung",
      stauraum: "Dachbodenausbau als Reduit, grosser Kellerraum"
    },

    energie: {
      heizung: "Gasheizung, Baujahr 2016, jährlich gewartet",
      energietraeger: "Erdgas",
      verteilung: "Radiatoren",
      photovoltaik: "Keine PV-Anlage installiert (Dach seit 2018 vorbereitet)",
      geak: "C",
      geakKlasse: "C (mittlerer Bedarf)",
      minergie: false
    },

    aussen: {
      balkon: "Balkon 8 m² Richtung Garten",
      terrasse: "Gepflasterter Gartensitzplatz, 22 m²",
      garten: "920 m² Grundstück, Rasenfläche und Hecke als Einfriedung",
      pool: "Kein Pool",
      aussicht: "Seeblick vom Obergeschoss, teilweise durch Bäume verbaut",
      privatsphaere: "Einsicht von Nachbarparzelle im Erdgeschoss stellenweise möglich"
    },

    parkieren: {
      garage: "Freistehende Einzelgarage",
      tiefgarage: "Keine",
      aussenplaetze: "2 Aussenparkplätze auf der Parzelle",
      ladestation: "Keine, Nachrüstung möglich (Zuleitung vorhanden)"
    },

    medien: {
      bilder: [
        { key: "zurich-altbau-1", text: "Strassenansicht des Einfamilienhauses" },
        { key: "zurich-altbau-2", text: "Gartenansicht mit Sitzplatz" },
        { key: "interior-bright-1", text: "Wohnzimmer mit Cheminée" },
        { key: "interior-bright-2", text: "Esszimmer, Blick zur Küche" },
        { key: "kitchen-1", text: "Küche, saniert 2018" },
        { key: "mat-eiche", text: "Eichenparkett im Obergeschoss" },
        { key: "family-house-1", text: "Blick über den Garten Richtung Haus" },
        { key: "family-house-2", text: "Gartensitzplatz, gepflastert" }
      ],
      video: true,
      tour360: false,
      modell3d: false,
      sonnenverlauf: false
    },

    grundrisse: [
      {
        geschoss: "Erdgeschoss",
        datei: "plan-eg-haus-zrich-2.pdf",
        flaeche: 92,
        raeume: [
          { name: "Eingang", m2: 6 },
          { name: "Wohnzimmer", m2: 28 },
          { name: "Esszimmer", m2: 18 },
          { name: "Küche", m2: 16 },
          { name: "Gäste-WC", m2: 3 },
          { name: "Keller", m2: 21 }
        ]
      },
      {
        geschoss: "Obergeschoss",
        datei: "plan-og-haus-zrich-2.pdf",
        flaeche: 93,
        raeume: [
          { name: "Zimmer 1", m2: 20 },
          { name: "Zimmer 2", m2: 16 },
          { name: "Zimmer 3", m2: 14 },
          { name: "Zimmer 4", m2: 12 },
          { name: "Bad 1", m2: 8 },
          { name: "Bad 2", m2: 6 },
          { name: "Flur", m2: 17 }
        ]
      }
    ],

    lage: {
      beschreibung: "Das Haus liegt in ruhiger Wohnlage am Zürichberghang, umgeben von Einfamilienhäusern ähnlicher Bauzeit. Die Quartierinfrastruktur ist etabliert: Tramhaltestelle, Volksschule und Einkaufsmöglichkeiten liegen fussläufig. Die Innenstadt ist in wenigen Minuten mit dem Tram erreichbar, was die Lage für Familien wie auch für Pendler attraktiv macht.",
      gemeinde: "Zürich",
      kanton: "ZH",
      quartier: "Hottingen / Zürichberg",
      oev: [
        { name: "Tram Nr. 3", distanz: "250 m", zeit: "3 Min. zu Fuss" },
        { name: "Bahnhof Stadelhofen", distanz: "1.8 km", zeit: "7 Min. mit Tram" }
      ],
      schulen: [
        { name: "Primarschule Hottingen", distanz: "400 m", zeit: "5 Min. zu Fuss" },
        { name: "Gymnasium Rämibühl", distanz: "1.5 km", zeit: "6 Min. mit Tram" }
      ],
      einkauf: [
        { name: "Coop Hottingerplatz", distanz: "500 m", zeit: "6 Min. zu Fuss" },
        { name: "Migros Klusplatz", distanz: "900 m", zeit: "10 Min. zu Fuss" }
      ],
      freizeit: [
        { name: "Zürichbergwald", distanz: "600 m", zeit: "7 Min. zu Fuss" },
        { name: "Kunsthaus Zürich", distanz: "2.2 km", zeit: "8 Min. mit Tram" }
      ],
      fahrzeiten: [
        { ziel: "Zürich HB", zeit: "12 Min." },
        { ziel: "Flughafen Zürich", zeit: "25 Min." },
        { ziel: "Zug", zeit: "35 Min." }
      ],
      steuerfuss: "Stadt Zürich, einfache Steuer 2026: 119% (Kanton + Stadt, ohne Kirchensteuer)",
      sonne: "Süd-West-Garten, Nachmittags- und Abendsonne, Vormittagssonne teils durch Nachbarbebauung reduziert",
      charakter: "Etabliertes, ruhiges Wohnquartier mit Einfamilienhäusern der 1920er- bis 1950er-Jahre, gute Durchmischung von Familien und älteren Eigentümern"
    },

    finanzen: {
      kaufpreis: 2670000,
      nebenkosten: "Im Kanton Zürich keine Handänderungssteuer; Notariats- und Grundbuchkosten ca. 0.5–1% des Kaufpreises, in der Regel zulasten der Käuferschaft",
      eigenmittel20: 534000,
      hypothekBeispiel: {
        betrag: 2136000,
        zins: 1.9,
        zinsProMonat: 3380,
        amortisationProMonat: 330,
        unterhaltProMonat: 2220,
        totalProMonat: 5930
      },
      tragbarkeitEinkommen: 416680,
      preisM2Kontext: "Quartier-Median Einfamilienhäuser Zürich ca. 15'800 CHF/m² – Zustand und Baujahr erklären die Differenz"
    },

    dokumente: [
      { name: "Verkaufsdokumentation", typ: "pdf", groesse: "4.5 MB", zugang: "oeffentlich" },
      { name: "Grundrisse (PDF)", typ: "pdf", groesse: "1.2 MB", zugang: "oeffentlich" },
      { name: "Energieausweis (GEAK)", typ: "pdf", groesse: "0.8 MB", zugang: "anfrage" },
      { name: "Katasterplan", typ: "pdf", groesse: "0.5 MB", zugang: "anfrage" }
    ],

    faq: [
      { frage: "Warum wurde das Haus verkauft?", antwort: "Die Eigentümerschaft verkleinert sich; das Haus ist seit 2018 kernsaniert und unterhaltsarm." },
      { frage: "Gibt es Mieterträge oder eine Einliegerwohnung?", antwort: "Nein, das Haus wird als Einfamilienhaus ohne separate Einheit genutzt." },
      { frage: "Wie ist der Zustand des Dachs?", antwort: "Neu eingedeckt 2018 im Rahmen der Kernsanierung, Garantieunterlagen liegen vor." },
      { frage: "Ist eine Besichtigung kurzfristig möglich?", antwort: "Ja, die Maklerin koordiniert Besichtigungstermine in der Regel innert 3 Werktagen." }
    ],

    naechsteSchritte: ["Besichtigung anfragen", "Frage stellen", "Finanzierung prüfen", "Dossier anfordern"],

    aehnliche: ["haus-zrich-1", "haus-zrich-3", "haus-winterthur-1"]
  },

  /* ======================================================================
     STUFE: PRIVAT — Privatinserat, bewusst sparsame Basis-Tiefe
     ====================================================================== */
  "wohnung-zrich-1": {
    stufe: "privat",

    quelle: {
      art: "privat",
      name: "Privatverkauf",
      person: "M. Huber",
      telefon: null,
      email: "m.huber.privat@example.ch",
      verifiziert: false,
      hinweis: "Verkauf ohne Maklerbeteiligung, Verkäufer antwortet persönlich"
    },

    story: {
      titel: "2.5-Zimmer-Wohnung mit Bergsicht in Wiedikon",
      absaetze: [
        "Die Wohnung im ersten Obergeschoss wurde kürzlich saniert und wird direkt vom Eigentümer verkauft. Sie eignet sich für Singles oder Paare, die eine ruhige, gut angebundene Lage in Zürich suchen. Balkon, Cheminée und Bodenheizung sorgen für Komfort im Alltag."
      ]
    },

    highlights: [
      "Balkon mit Bergsicht",
      "Cheminée im Wohnzimmer",
      "Bodenheizung",
      "Erstbezug nach Sanierung",
      "Autobahnanschluss in 5 Minuten"
    ],

    fakten: {
      wohnflaeche: 75,
      zimmer: 2.5,
      schlafzimmer: 1,
      badezimmer: 1,
      baujahr: 1940,
      geschosse: 1,
      verfuegbar: "Nach Vereinbarung",
      preis: 1430000,
      preisM2: 19070
    },

    medien: {
      bilder: ["zurich-altbau-1", "interior-bright-1", "kitchen-1"],
      video: false,
      tour360: false,
      modell3d: false,
      sonnenverlauf: false
    },

    lage: {
      beschreibung: "Die Wohnung liegt in Zürich-Wiedikon, einem lebendigen Quartier mit guter Anbindung an die Innenstadt und rasch erreichbarem Autobahnanschluss. Einkaufsmöglichkeiten, Schulen und ÖV sind in wenigen Gehminuten erreichbar.",
      gemeinde: "Zürich",
      kanton: "ZH"
    },

    finanzen: {
      kaufpreis: 1430000,
      nebenkosten: "Im Kanton Zürich keine Handänderungssteuer; Notariats- und Grundbuchkosten ca. 0.5–1% des Kaufpreises, in der Regel zulasten der Käuferschaft",
      eigenmittel20: 286000,
      hypothekBeispiel: {
        betrag: 1144000,
        zins: 1.9,
        zinsProMonat: 1810,
        amortisationProMonat: 180,
        unterhaltProMonat: 1190,
        totalProMonat: 3180
      },
      tragbarkeitEinkommen: 223170,
      preisM2Kontext: "Quartier-Median Eigentumswohnungen Wiedikon ca. 17'900 CHF/m²"
    },

    dokumente: [
      { name: "Grundriss (Skizze)", typ: "pdf", groesse: "0.4 MB", zugang: "anfrage", hinweis: "Direkt beim Verkäufer erhältlich" }
    ],

    naechsteSchritte: ["Besichtigung anfragen", "Frage stellen"],

    aehnliche: ["wohnung-zrich-2", "wohnung-zrich-3", "wohnung-ksnacht-1"]
  }
};
