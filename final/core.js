/* FOURWALLS Grand Final — geteilter Produktkern (Logik, keine Gestalt).
   Wird von beiden Finalisten (Spiegel, Vorhang) identisch geladen.
   Voraussetzungen: listings.js (window.FWL) und properties.js (window.FW) vorher geladen. */
window.FWP = (function () {
  /* ---------- Sprache ---------- */
  const I18N = {
    de: { immobilien:"Immobilien", karte:"Karte", verkaufen:"Verkaufen", verwalten:"Verwalten", inserieren:"Gratis inserieren",
      gemerkt:"Gemerkt", kaufen:"Kaufen", mieten:"Mieten", ort:"Ort, PLZ, Kanton oder Region", typ:"Alle Objekttypen",
      preisBis:"Preis bis", preisVon:"Preis von", zimmerAb:"Zimmer ab", mehrFilter:"Mehr Filter", filter:"Filter", sucheSpeichern:"Suche speichern",
      treffer:"Treffer", inserate:"Inserate", neuste:"Neuste zuerst", preisAuf:"Preis aufsteigend", preisAb:"Preis absteigend",
      flaeche:"Grösste Fläche", zimmer:"Meiste Zimmer", liste:"Liste", weitere:"Weitere anzeigen", zuruecksetzen:"Zurücksetzen",
      anwenden:"Anwenden", wohnflaeche:"Wohnfläche ab (m²)", anbieter:"Anbieter", ausstattung:"Ausstattung", preisChf:"Preis (CHF)",
      merken:"Merken", gemerktOk:"Gemerkt ✓", schliessen:"Schliessen", anfrage:"Besichtigung anfragen", melden:"Inserat melden",
      teilen:"Teilen", dokumente:"Dokumente", lage:"Lage", beschreibung:"Beschreibung", fakten:"Fakten", kontakt:"Kontakt",
      konto:"Ihr Bereich", merkliste:"Gemerkte Objekte", suchabos:"Suchabos", meine:"Meine Inserate", weiter:"Weiter", zurueck:"Zurück",
      veroeffentlichen:"Kostenlos veröffentlichen", exclusive:"Fourwalls Exclusive", privat:"Privatinserat", makler:"Makler",
      verwaltung:"Verwaltung", bautraeger:"Bauträger", neu:"Neu", geprueft:"geprüft", proM2:"CHF/m²", aufAnfrage:"Preis auf Anfrage",
      proMonat:"/ Mt.", nk:"+ NK", keineTreffer:"Für diese Kombination gibt es zurzeit kein Inserat.", suchabo:"Suchabo anlegen",
      selbst:"Selbst inserieren", mitFW:"Mit Fourwalls verkaufen", zeilen:"Zeilen", kacheln:"Kacheln", buehne:"Bühne",
      verfuegbar:"Verfügbar", sofort:"Sofort", abDatum:"Ab", nachVereinbarung:"Nach Vereinbarung", reserviert:"Reserviert", verkauft:"Verkauft", vermietet:"Vermietet", etage:"Etage", eg:"Erdgeschoss", ug:"Untergeschoss", og:". Obergeschoss", dachgeschoss:"Dachgeschoss", baujahrVon:"Baujahr von", baujahrBis:"Baujahr bis", flaecheVon:"Wohnfläche von", flaecheBis:"Wohnfläche bis", grundVon:"Grundstück ab", umkreis:"Umkreis", keinUmkreis:"Genau dieser Ort", km:"km", treffer1:"Immobilie", trefferN:"Immobilien", sortEmpfohlen:"Empfohlen", sortM2:"Preis pro m²", statusZeigen:"Auch reservierte und verkaufte zeigen", nurVerfuegbar:"Nur verfügbare", suchaboSpeichern:"Suchabo speichern", suchaboTitel:"Neue Treffer zuerst sehen", suchaboMail:"E-Mail für die Benachrichtigung", suchaboWie:"Wie oft?", wieSofort:"Sofort", wieTaeglich:"Täglich", wieWoechentlich:"Wöchentlich", suchaboOk:"Suchabo gespeichert", suchaboKonto:"Optional: mit Konto auf allen Geräten verwalten", abbrechen:"Abbrechen", speichern:"Speichern", lockern:"Suche lockern", radiusMehr:"Umkreis vergrössern", budgetMehr:"Budget erhöhen", filterWeg:"Filter entfernen", ergebnisse:"Ergebnisse", kaution:"Kaution (max.)", bruttomiete:"Bruttomiete", nettomiete:"Nettomiete", nebenkosten:"Nebenkosten", zeigeAlle:"Alle anzeigen", ergebnisseProSeite:"pro Seite",
      zimmerBis:"Zimmer bis", baujahr:"Baujahr", nichtEg:"Nicht Erdgeschoss", ab2:"Ab 2. Stock", in3Mt:"In 3 Monaten", mailFehler:"Bitte eine gültige E-Mail-Adresse eingeben.", aboPrototyp:"Prototyp: Das Suchabo wird auf diesem Gerät gespeichert. Es werden keine E-Mails versendet — die Zustellung entsteht mit dem Backend.",
      zimmerFilter:"Zimmer", grundFilter:"Grundstück ab (m²)",
      flaecheFilter:"Wohnfläche (m²)",
      bild1:"Bild", bildN:"Bilder",
      bilderMedien:"Bilder und Medien",
      artOrt:"Ort", artPlz:"PLZ", artKanton:"Kanton", artRegion:"Region",
      autoSuchen:"Beim Verschieben automatisch suchen", hierSuchen:"In diesem Kartenausschnitt suchen", imAusschnitt:"Kartenausschnitt", karteLeerText:"In diesem Ausschnitt liegt kein Inserat.", karteFehler:"Die Karte lässt sich gerade nicht laden. Die Liste zeigt alle Treffer." , o_katAlle:"Alle", o_katAussen:"Aussen", o_katWohnen:"Wohnen", o_katKueche:"Küche", o_katSchlafen:"Schlafen", o_katBad:"Bad", o_katLage:"Lage", o_katPlan:"Grundriss", o_zugHerunterladen:"Herunterladen", o_zugMitKonto:"Mit Konto", o_zugNachAnfrage:"Nach Anfrage", o_zugNachBesichtigung:"Nach Besichtigung", o_zugNachEinigung:"Nach Einigung", o_zugText:"Was hier «Nach Anfrage» oder «Nach Besichtigung» heisst, ist nicht öffentlich abrufbar — auch nicht über Umwege. Wir schalten es frei, sobald der jeweilige Schritt getan ist.", o_lgBauweise:"Bauweise", o_lgDach:"Dach", o_lgFenster:"Fenster", o_lgZustand:"Zustand", o_lgAusrichtung:"Ausrichtung", o_lgVolumen:"Volumen", o_lgQualitaet:"Qualität", o_laKueche:"Küche", o_laBaeder:"Bäder", o_laBoeden:"Böden", o_laGeraete:"Geräte", o_laWaschen:"Waschen", o_laCheminee:"Cheminée", o_laLift:"Lift", o_laSmarthome:"Smart Home", o_laStauraum:"Stauraum", o_leHeizung:"Heizung", o_leEnergietraeger:"Energieträger", o_leVerteilung:"Wärmeverteilung", o_lePhotovoltaik:"Photovoltaik", o_leGeak:"GEAK", o_leMinergie:"Minergie", o_loBalkon:"Balkon", o_loTerrasse:"Terrasse", o_loGarten:"Garten", o_loPool:"Pool", o_loAussicht:"Aussicht", o_loPrivatsphaere:"Privatsphäre", o_lpGarage:"Garage", o_lpTiefgarage:"Tiefgarage", o_lpAussenplaetze:"Aussenplätze", o_lpLadestation:"Ladestation", o_fZimmer:"Zimmer", o_fWohnflaeche:"Wohnfläche", o_fNutzflaeche:"Nutzfläche", o_fGrundstueck:"Grundstück", o_fSchlafzimmer:"Schlafzimmer", o_fBadezimmer:"Badezimmer", o_fBaujahr:"Baujahr", o_fRenovation:"Renovation", o_fGeschosse:"Geschosse", o_fRaumhoehe:"Raumhöhe", o_fKubatur:"Kubatur", o_fEtage:"Etage", o_fReferenz:"Referenz", o_fPreis:"Preis", o_egKurz:"EG", o_secUebersicht:"Übersicht", o_secEckdaten:"Eckdaten", o_secGrundrisse:"Grundrisse", o_secLage:"Lage", o_secFinanzierung:"Finanzierung", o_secRichtwerte:"Richtwerte", o_secDokumente:"Dokumente", o_secFragen:"Häufige Fragen", o_secKontakt:"Kontakt", o_secAehnliche:"Ähnliche Objekte", o_video:"Video", o_grundrisseBtn:"Grundrisse", o_geprueft2:"Geprüftes Inserat", o_genaueAdresse:"Genaue Adresse nach Kontakt", o_tragbarkeitRechnen:"Tragbarkeit rechnen", o_ganzeBeschreibung:"Ganze Beschreibung", o_kaufpreis:"Kaufpreis", o_objektpreis:"Objektpreis", o_eigenmittel:"Eigenmittel", o_zinsmodell:"Zinsmodell", o_saron:"SARON · 1.6 %", o_fest5:"Festhypothek 5 Jahre · 1.9 %", o_fest10:"Festhypothek 10 Jahre · 2.2 %", o_belehnung:"Belehnung", o_hypothek:"Hypothek", o_zinsMonat:"Zins / Monat", o_amortMonat:"Amortisation / Monat", o_unterhMonat:"Unterhalt und Nebenkosten / Monat", o_totalMonat:"Total / Monat", o_noetHaushalt:"Nötiges Haushaltseinkommen", o_proJahr:"/ Jahr", o_finanzFein:"Richtwerte nach Bankenpraxis: Belehnung 80 %, zweite Hypothek in 15 Jahren amortisiert, Unterhalt 1 % pro Jahr, Tragbarkeit mit 5 % kalkulatorischem Zins bis höchstens einem Drittel des Einkommens. Das ist eine Orientierung und keine Finanzierungszusage — verbindlich rechnet Ihre Bank.", o_seitenAbk:"S.", o_wirVertreten:"Fourwalls vertritt die Verkäuferschaft.", o_anfrageGehtAn:"Ihre Anfrage geht an", o_nichtAnDritte:"nicht an Dritte.", o_unserTeam:"unser Team", o_inseriertVon:"Inseriert von", o_anfrageDirekt:"Ihre Anfrage geht direkt an diese Anbieterin oder diesen Anbieter.", o_vertrittNicht:"Fourwalls vertritt dieses Objekt nicht", o_hatGeprueft:", hat aber Identität und Inserat geprüft", o_frageStellen:"Frage stellen", o_nachrichtStandard:"Guten Tag\nIch interessiere mich für dieses Objekt und würde es gerne besichtigen.", o_nachrichtFrage:"Guten Tag\nIch habe eine Frage zu diesem Objekt:\n", o_aehnlicheSuchabo:"Ähnliche Objekte per Suchabo erhalten", o_anfrageSenden:"Anfrage senden", o_gesendetAn:"meldet sich bei Ihnen.", o_gesendetPrefix:"Gesendet —", o_linkKopiert:"Link kopiert ✓", o_gemeldetDanke:"Gemeldet — danke, wir prüfen das.", o_vorherigesBild:"Vorheriges Bild", o_naechstesBild:"Nächstes Bild", o_bildWort:"Bild", o_objektfilm:"Objektfilm", o_videoProd:"In Produktion läuft hier der Film als HLS-Stream, ohne Ton-Autoplay.", o_rundgang:"360°-Rundgang", o_rundgangProd:"In Produktion wird hier der Rundgang eingebettet, mit Raumwahl an der Seite.", o_modell3d:"3D-Modell", o_modell3dHinweis:"Erscheint nur bei Objekten, die digital vermessen wurden — kein nachgebautes Volumen.", o_ausrichtungWort:"Ausrichtung", o_grundrissPrefix:"Grundriss ·", o_planNichtGeladen:"Plan konnte nicht geladen werden.", o_planPdf1:"Plan liegt als PDF vor", o_planPdf2:"In Produktion wird die erste Seite als Vorschau gerendert.", o_verkleinern:"Verkleinern", o_vergroessern:"Vergrössern", o_vollbild:"Vollbild", o_lageExakt:"Genaue Lage vom Anbieter freigegeben", o_lageGemeinde:"Lage auf Gemeindeebene", o_lageUngefaehr:"Ungefähre Lage", o_imUmkreisVon:"im Umkreis von", o_genaueAdresse2:"genaue Adresse nach Kontakt", o_karteSwisstopo:"Karte: swisstopo", o_ungefaehreLageCanvas:"UNGEFÄHRE LAGE · GENAUE ADRESSE NACH KONTAKT", o_gemeindeWort:"Gemeinde", o_quartierWort:"Quartier", o_steuerfussWort:"Steuerfuss", o_fahrzeitenAuto:"Fahrzeiten mit dem Auto", o_kantonWort:"Kanton", o_genAdresseNachKontaktSatz:"Die genaue Adresse erhalten Sie nach Kontakt mit der Anbieterin oder dem Anbieter.", o_poiOev:"Öffentlicher Verkehr", o_poiSchulen:"Schulen", o_poiEinkauf:"Einkauf", o_poiGesundheit:"Gesundheit", o_poiFreizeit:"Freizeit", o_poiVerkehr:"Verkehr", o_ziKurz:"Zi.", o_naechsteBesichtigung:"Besichtigung anfragen", o_naechsteFrage:"Frage stellen", o_naechsteFinanzierung:"Finanzierung prüfen", w_schrittWort:"Schritt", w_vonWort:"von", w_vermieten:"Vermieten", w_ichVerkaufen:"Verkaufen", w_verkaufenHin:"Sie möchten Ihr Objekt verkaufen.", w_vermietenHin:"Sie suchen Mieterinnen oder Mieter.", w_inseriereAls:"Ich inseriere als", w_privatperson:"Privatperson", w_maklerAgentur:"Makler / Agentur", w_verwaltungWort:"Verwaltung", w_bautraegerWort:"Bauträger", w_strasseLabel:"Strasse und Nr. (optional — wird erst nach Kontakt sichtbar)", w_plzLabel:"PLZ", w_ortLabel:"Ort", w_geoStatusLeer:"Geben Sie die PLZ ein — Gemeinde, Kanton und Region ergänzen wir aus dem Ortsverzeichnis.", w_geoStatusUnbekannt:"Diesen Ort führen wir noch nicht im Verzeichnis. Das Inserat lässt sich trotzdem einreichen; wir ordnen die Gemeinde von Hand zu.", w_erkannt:"Erkannt:", w_lageGenauFrage:"Wie genau darf die Lage öffentlich erscheinen?", w_lageExaktTitel:"Genaue Lage", w_lageExaktHin:"Ein Punkt auf der Karte. Sinnvoll bei Neubauten und Gewerbe.", w_lageUngefaehrTitel:"Ungefähr", w_lageUngefaehrHin:"Ein Feld von rund 450 m. Das Quartier ist erkennbar, das Haus nicht.", w_lageGemeindeTitel:"Nur Gemeinde", w_lageGemeindeHin:"Ein Feld von rund 2 km. Grösstmögliche Zurückhaltung.", w_strasseBleibtPrivat:"Die Strasse bleibt in jedem Fall privat, bis Sie sie einer Anfrage gegenüber freigeben.", w_kartenVorschauLeer:"Sobald der Ort feststeht, sehen Sie hier, wie Ihre Lage öffentlich erscheint.", w_kartenVorschauFehler:"Die Vorschau lässt sich gerade nicht laden. Ihre Auswahl ist gespeichert.", w_zimmerLabel:"Zimmer", w_grundstuecksflaeche:"Grundstücksfläche", w_wohnflaeche:"Wohnfläche", w_baujahrOpt:"Baujahr (optional)", w_nettomieteMonat:"Nettomiete pro Monat (CHF)", w_kaufpreisLabel:"Kaufpreis (CHF)", w_preisAufAnfrage:"Preis auf Anfrage", w_bewertungHinweis:"Unsicher beim Preis? Fourwalls erstellt Ihnen kostenlos eine hedonische Bewertung — als Richtwert, unverbindlich, auch wenn Sie selbst inserieren.", w_titelLabel:"Titel", w_titelPlaceholder:"z.B. Helle 3.5-Zi.-Wohnung mit Balkon", w_beschreibungLabel:"Beschreibung", w_beschreibungPlaceholder:"Lage, Zustand, Besonderheiten …", w_bilderHinweis:"Wählen Sie Beispielbilder aus der Vorschau — das erste Bild wird zum Titelbild.", w_bildWort2:"Bild", w_nameLabel:"Name", w_emailLabel:"E-Mail", w_telefonOpt:"Telefon (optional)", w_vorschauTitel:"Vorschau Ihres Inserats", w_veroeffentlichenHinweis:"Mit dem Veröffentlichen bestätigen Sie, dass Sie zur Vermarktung dieses Objekts berechtigt sind. Wir prüfen jedes Inserat, bevor es erscheint.", w_typWohnung:"Wohnung", w_typHaus:"Einfamilienhaus", w_typVilla:"Villa", w_typChalet:"Chalet", w_typMfh:"Mehrfamilienhaus", w_typGewerbe:"Gewerbe / Büro", w_typGrundstueck:"Bauland", w_typParkplatz:"Parkplatz / Garage", w_quellFourwalls:"Fourwalls", w_quellPrivat:"Privat", w_quellMakler:"Makler", w_quellVerwaltung:"Verwaltung", w_quellEntwickler:"Bauträger", k_sucheFallback:"Suche", k_angelegtBenachrichtigung:"Benachrichtigung bei neuen Treffern", k_angelegtWort:"angelegt", k_oeffnenBtn:"Öffnen", k_loeschenBtn:"Löschen", k_objektBtn:"Objekt", k_ohneTitel:"(ohne Titel)", k_eingereichtWort:"eingereicht", k_aufrufeAnfragen:"0 Aufrufe · 0 Anfragen", k_entwurfFallback:"Entwurf", k_nochNichtEingereicht:"Noch nicht eingereicht", k_weiterbearbeiten:"Weiterbearbeiten", w_fertigTitel:"Ihr Inserat ist eingereicht.", w_fertigText:"Wir prüfen jedes Inserat kurz, bevor es erscheint. Sie finden es unter «Meine Inserate».", w_zuMeinenInseraten:"Zu meinen Inseraten", p_leerH2:"Hier liegt noch nichts am Ufer.", p_aboZeileB:"Neue Treffer zuerst sehen.", p_aboZeileSpan:"Wir melden uns nur, wenn etwas Passendes erscheint — kein Konto nötig.", w_fuerEigentuemer:"Für Eigentümerinnen und Eigentümer", w_zweiWege:"Zwei Wege zum Verkauf. Sie wählen.", w_selbstKostenlos:"Selbst inserieren · kostenlos", w_ichErstelleSelbst:"Ich erstelle und betreue das Inserat selbst.", w_selbstBeschreibung:"Sie schreiben den Text, wählen die Bilder, beantworten Anfragen und führen Besichtigungen. Fourwalls stellt Reichweite und Werkzeug.", w_selbstListe1:"Kostenlos, ohne Konto zum Start", w_selbstListe2:"9 kurze Schritte, jederzeit unterbrechbar", w_selbstListe3:"Anfragen gehen direkt an Sie", w_jetztKostenlos:"Jetzt kostenlos inserieren", w_mitFwMandat:"Mit Fourwalls verkaufen · Mandat", w_fwUebernimmt:"Fourwalls übernimmt den Verkauf professionell.", w_fwUebernimmtBeschreibung:"Bewertung, Strategie, Fotografie, Käuferqualifikation, Besichtigungen, Verhandlung, Notariat — eine Ansprechperson bis zur Übergabe.", w_mitFwListe1:"Kostenlose hedonische Bewertung", w_mitFwListe2:"Honorar nur bei Erfolg", w_mitFwListe3:"Fourwalls-Exclusive-Präsentation", w_verkaufKennenlernen:"Verkauf mit Fourwalls kennenlernen", w_beidesEhrlich:"Beides ist ehrlich gemeint: Wer selbst inserieren will, bekommt das beste Werkzeug. Wer es abgeben will, den besten Service. Sie können jederzeit wechseln.", w_entwurfAutosave:"Ihr Entwurf wird automatisch gespeichert — Sie können jederzeit unterbrechen und später weiterfahren. Inserieren ist kostenlos.", k_ihrBereichHin:"Merkliste, Suchabos und eigene Inserate — ohne Konto auf diesem Gerät gespeichert. Ein Konto brauchen Sie erst, wenn Sie das auf mehreren Geräten oder mit Ihrem Team teilen wollen.", k_anfragenTab:"Anfragen", k_nichtsGemerkt:"Noch nichts gemerkt. Tippen Sie auf das Herz in einem Inserat.", k_keinSuchabo:"Noch kein Suchabo. Speichern Sie eine Suche — wir benachrichtigen Sie bei neuen Treffern.", k_keineAnfrage:"Noch keine Anfrage. Besichtigungsanfragen und Fragen an Anbietende erscheinen hier mit Status.", k_keinEigenesInserat:"Noch kein eigenes Inserat.", k_jetztKostenlosPunkt:"Jetzt kostenlos inserieren.", k_landWort:"Land", o_secGebaeude:"Gebäude", o_secAussen:"Aussen", o_secParkieren:"Parkieren", o_secEnergie:"Energie", o_gesendetStatus:"Gesendet", o_name:"Name" },
    fr: { immobilien:"Immobilier", karte:"Carte", verkaufen:"Vendre", verwalten:"Gérance", inserieren:"Publier gratuitement",
      gemerkt:"Favoris", kaufen:"Acheter", mieten:"Louer", ort:"Lieu, NPA, canton ou région", typ:"Tous les types",
      preisBis:"Prix jusqu'à", preisVon:"Prix dès", zimmerAb:"Pièces dès", mehrFilter:"Plus de filtres", filter:"Filtres", sucheSpeichern:"Enregistrer la recherche",
      treffer:"résultats", inserate:"annonces", neuste:"Plus récentes", preisAuf:"Prix croissant", preisAb:"Prix décroissant",
      flaeche:"Plus grande surface", zimmer:"Plus de pièces", liste:"Liste", weitere:"Afficher plus", zuruecksetzen:"Réinitialiser",
      anwenden:"Appliquer", wohnflaeche:"Surface habitable dès (m²)", anbieter:"Annonceur", ausstattung:"Équipement", preisChf:"Prix (CHF)",
      merken:"Enregistrer", gemerktOk:"Enregistré ✓", schliessen:"Fermer", anfrage:"Demander une visite", melden:"Signaler l'annonce",
      teilen:"Partager", dokumente:"Documents", lage:"Situation", beschreibung:"Description", fakten:"Caractéristiques", kontakt:"Contact",
      konto:"Votre espace", merkliste:"Objets enregistrés", suchabos:"Alertes", meine:"Mes annonces", weiter:"Continuer", zurueck:"Retour",
      veroeffentlichen:"Publier gratuitement", exclusive:"Fourwalls Exclusive", privat:"Annonce privée", makler:"Courtier",
      verwaltung:"Gérance", bautraeger:"Promoteur", neu:"Nouveau", geprueft:"vérifié", proM2:"CHF/m²", aufAnfrage:"Prix sur demande",
      proMonat:"/ mois", nk:"+ charges", keineTreffer:"Aucune annonce ne correspond actuellement à cette combinaison.", suchabo:"Créer une alerte",
      selbst:"Publier moi-même", mitFW:"Vendre avec Fourwalls", zeilen:"Lignes", kacheln:"Vignettes", buehne:"Scène",
      verfuegbar:"Disponible", sofort:"Immédiatement", abDatum:"Dès le", nachVereinbarung:"À convenir", reserviert:"Réservé", verkauft:"Vendu", vermietet:"Loué", etage:"Étage", eg:"Rez-de-chaussée", ug:"Sous-sol", og:"e étage", dachgeschoss:"Combles", baujahrVon:"Année dès", baujahrBis:"Année jusqu\u2019à", flaecheVon:"Surface dès", flaecheBis:"Surface jusqu\u2019à", grundVon:"Terrain dès", umkreis:"Rayon", keinUmkreis:"Ce lieu exactement", km:"km", treffer1:"bien", trefferN:"biens", sortEmpfohlen:"Recommandé", sortM2:"Prix au m²", statusZeigen:"Afficher aussi réservés et vendus", nurVerfuegbar:"Disponibles uniquement", suchaboSpeichern:"Créer une alerte", suchaboTitel:"Voir les nouveautés en premier", suchaboMail:"E-mail pour l\u2019alerte", suchaboWie:"À quelle fréquence ?", wieSofort:"Immédiatement", wieTaeglich:"Quotidien", wieWoechentlich:"Hebdomadaire", suchaboOk:"Alerte enregistrée", suchaboKonto:"Facultatif : gérer avec un compte sur tous vos appareils", abbrechen:"Annuler", speichern:"Enregistrer", lockern:"Élargir la recherche", radiusMehr:"Agrandir le rayon", budgetMehr:"Augmenter le budget", filterWeg:"Retirer un filtre", ergebnisse:"résultats", kaution:"Garantie (max.)", bruttomiete:"Loyer brut", nettomiete:"Loyer net", nebenkosten:"Charges", zeigeAlle:"Tout afficher", ergebnisseProSeite:"par page",
      zimmerBis:"Pièces jusqu\u2019à", baujahr:"Année de construction", nichtEg:"Pas au rez", ab2:"Dès le 2e étage", in3Mt:"Dans 3 mois", mailFehler:"Merci d\u2019indiquer une adresse e-mail valide.", aboPrototyp:"Prototype : l\u2019alerte est enregistrée sur cet appareil. Aucun e-mail n\u2019est envoyé — la distribution viendra avec le backend.",
      zimmerFilter:"Pièces", grundFilter:"Terrain dès (m²)",
      flaecheFilter:"Surface habitable (m²)",
      bild1:"photo", bildN:"photos",
      bilderMedien:"Photos et médias",
      artOrt:"Localité", artPlz:"NPA", artKanton:"Canton", artRegion:"Région",
      autoSuchen:"Rechercher automatiquement en déplaçant", hierSuchen:"Rechercher dans cette zone", imAusschnitt:"Zone de la carte", karteLeerText:"Aucune annonce dans cette zone.", karteFehler:"La carte ne se charge pas pour le moment. La liste affiche tous les résultats." , o_katAlle:"Tous", o_katAussen:"Extérieur", o_katWohnen:"Séjour", o_katKueche:"Cuisine", o_katSchlafen:"Chambre", o_katBad:"Salle de bain", o_katLage:"Situation", o_katPlan:"Plan", o_zugHerunterladen:"Télécharger", o_zugMitKonto:"Avec compte", o_zugNachAnfrage:"Sur demande", o_zugNachBesichtigung:"Après visite", o_zugNachEinigung:"Après accord", o_zugText:"Les mentions « Sur demande » ou « Après visite » signifient que le document n'est pas accessible publiquement, même par détour. Nous le débloquons dès que l'étape correspondante a eu lieu.", o_lgBauweise:"Construction", o_lgDach:"Toit", o_lgFenster:"Fenêtres", o_lgZustand:"État", o_lgAusrichtung:"Orientation", o_lgVolumen:"Volume", o_lgQualitaet:"Qualité", o_laKueche:"Cuisine", o_laBaeder:"Salles de bain", o_laBoeden:"Sols", o_laGeraete:"Appareils", o_laWaschen:"Buanderie", o_laCheminee:"Cheminée", o_laLift:"Ascenseur", o_laSmarthome:"Domotique", o_laStauraum:"Rangements", o_leHeizung:"Chauffage", o_leEnergietraeger:"Source d'énergie", o_leVerteilung:"Distribution de chaleur", o_lePhotovoltaik:"Photovoltaïque", o_leGeak:"CECB", o_leMinergie:"Minergie", o_loBalkon:"Balcon", o_loTerrasse:"Terrasse", o_loGarten:"Jardin", o_loPool:"Piscine", o_loAussicht:"Vue", o_loPrivatsphaere:"Intimité", o_lpGarage:"Garage", o_lpTiefgarage:"Parking souterrain", o_lpAussenplaetze:"Places extérieures", o_lpLadestation:"Borne de recharge", o_fZimmer:"Pièces", o_fWohnflaeche:"Surface habitable", o_fNutzflaeche:"Surface utile", o_fGrundstueck:"Terrain", o_fSchlafzimmer:"Chambres", o_fBadezimmer:"Salles de bain", o_fBaujahr:"Année de construction", o_fRenovation:"Rénovation", o_fGeschosse:"Étages", o_fRaumhoehe:"Hauteur sous plafond", o_fKubatur:"Volume bâti", o_fEtage:"Étage", o_fReferenz:"Référence", o_fPreis:"Prix", o_egKurz:"RDC", o_secUebersicht:"Aperçu", o_secEckdaten:"Caractéristiques", o_secGrundrisse:"Plans", o_secLage:"Situation", o_secFinanzierung:"Financement", o_secRichtwerte:"Valeurs indicatives", o_secDokumente:"Documents", o_secFragen:"Questions fréquentes", o_secKontakt:"Contact", o_secAehnliche:"Biens similaires", o_video:"Vidéo", o_grundrisseBtn:"Plans", o_geprueft2:"Annonce vérifiée", o_genaueAdresse:"Adresse exacte après contact", o_tragbarkeitRechnen:"Calculer la capacité financière", o_ganzeBeschreibung:"Description complète", o_kaufpreis:"Prix d'achat", o_objektpreis:"Prix du bien", o_eigenmittel:"Fonds propres", o_zinsmodell:"Modèle de taux", o_saron:"SARON · 1,6 %", o_fest5:"Hypothèque fixe 5 ans · 1,9 %", o_fest10:"Hypothèque fixe 10 ans · 2,2 %", o_belehnung:"Taux d'endettement", o_hypothek:"Hypothèque", o_zinsMonat:"Intérêts / mois", o_amortMonat:"Amortissement / mois", o_unterhMonat:"Entretien et charges / mois", o_totalMonat:"Total / mois", o_noetHaushalt:"Revenu du ménage nécessaire", o_proJahr:"/ an", o_finanzFein:"Valeurs indicatives selon la pratique bancaire : financement à 80 %, deuxième hypothèque amortie en 15 ans, entretien 1 % par an, capacité financière calculée à un taux théorique de 5 % jusqu'à un tiers du revenu au maximum. Ceci est une orientation et non un engagement de financement — le calcul déterminant est celui de votre banque.", o_seitenAbk:"p.", o_wirVertreten:"Fourwalls représente la partie venderesse.", o_anfrageGehtAn:"Votre demande est transmise à", o_nichtAnDritte:"et non à des tiers.", o_unserTeam:"notre équipe", o_inseriertVon:"Publié par", o_anfrageDirekt:"Votre demande est transmise directement à cette personne.", o_vertrittNicht:"Fourwalls ne représente pas ce bien", o_hatGeprueft:", mais a vérifié l'identité et l'annonce", o_frageStellen:"Poser une question", o_nachrichtStandard:"Bonjour\nCe bien m'intéresse et j'aimerais le visiter.", o_nachrichtFrage:"Bonjour\nJ'ai une question au sujet de ce bien :\n", o_aehnlicheSuchabo:"Recevoir des biens similaires par alerte", o_anfrageSenden:"Envoyer la demande", o_gesendetAn:"vous recontactera.", o_gesendetPrefix:"Envoyé —", o_linkKopiert:"Lien copié ✓", o_gemeldetDanke:"Signalé — merci, nous vérifions.", o_vorherigesBild:"Image précédente", o_naechstesBild:"Image suivante", o_bildWort:"Image", o_objektfilm:"Film du bien", o_videoProd:"En production, le film sera diffusé ici en flux HLS, sans lecture automatique du son.", o_rundgang:"Visite virtuelle 360°", o_rundgangProd:"En production, la visite sera intégrée ici, avec sélection des pièces sur le côté.", o_modell3d:"Modèle 3D", o_modell3dHinweis:"N'apparaît que pour les biens relevés numériquement — pas de volume reconstitué.", o_ausrichtungWort:"Orientation", o_grundrissPrefix:"Plan ·", o_planNichtGeladen:"Le plan n'a pas pu être chargé.", o_planPdf1:"Le plan est disponible en PDF", o_planPdf2:"En production, la première page s'affichera en aperçu.", o_verkleinern:"Réduire", o_vergroessern:"Agrandir", o_vollbild:"Plein écran", o_lageExakt:"Position exacte communiquée par l'annonceur", o_lageGemeinde:"Position au niveau communal", o_lageUngefaehr:"Position approximative", o_imUmkreisVon:"dans un rayon de", o_genaueAdresse2:"adresse exacte après contact", o_karteSwisstopo:"Carte : swisstopo", o_ungefaehreLageCanvas:"POSITION APPROXIMATIVE · ADRESSE EXACTE APRÈS CONTACT", o_gemeindeWort:"Commune", o_quartierWort:"Quartier", o_steuerfussWort:"Taux d'imposition", o_fahrzeitenAuto:"Temps de trajet en voiture", o_kantonWort:"canton", o_genAdresseNachKontaktSatz:"Vous recevrez l'adresse exacte après avoir pris contact avec l'annonceur.", o_poiOev:"Transports publics", o_poiSchulen:"Écoles", o_poiEinkauf:"Commerces", o_poiGesundheit:"Santé", o_poiFreizeit:"Loisirs", o_poiVerkehr:"Circulation", o_ziKurz:"p.", o_naechsteBesichtigung:"Demander une visite", o_naechsteFrage:"Poser une question", o_naechsteFinanzierung:"Vérifier le financement", w_schrittWort:"Étape", w_vonWort:"sur", w_vermieten:"Mettre en location", w_ichVerkaufen:"Vendre", w_verkaufenHin:"Vous souhaitez vendre votre bien.", w_vermietenHin:"Vous cherchez des locataires.", w_inseriereAls:"Je publie en tant que", w_privatperson:"Particulier", w_maklerAgentur:"Courtier / Agence", w_verwaltungWort:"Gérance", w_bautraegerWort:"Promoteur", w_strasseLabel:"Rue et numéro (facultatif — visible uniquement après contact)", w_plzLabel:"NPA", w_ortLabel:"Lieu", w_geoStatusLeer:"Saisissez le NPA — nous complétons la commune, le canton et la région à partir du répertoire.", w_geoStatusUnbekannt:"Ce lieu ne figure pas encore dans notre répertoire. L'annonce peut tout de même être soumise ; nous attribuerons la commune manuellement.", w_erkannt:"Reconnu :", w_lageGenauFrage:"Avec quelle précision la position peut-elle apparaître publiquement ?", w_lageExaktTitel:"Position exacte", w_lageExaktHin:"Un point sur la carte. Utile pour les constructions neuves et le commercial.", w_lageUngefaehrTitel:"Approximative", w_lageUngefaehrHin:"Un cercle d'environ 450 m. Le quartier est identifiable, pas la maison.", w_lageGemeindeTitel:"Commune uniquement", w_lageGemeindeHin:"Un cercle d'environ 2 km. La plus grande discrétion possible.", w_strasseBleibtPrivat:"L'adresse reste dans tous les cas privée jusqu'à ce que vous la communiquiez à une personne intéressée.", w_kartenVorschauLeer:"Dès que le lieu est déterminé, vous voyez ici comment votre position apparaîtra publiquement.", w_kartenVorschauFehler:"L'aperçu ne peut pas être chargé pour le moment. Votre choix est enregistré.", w_zimmerLabel:"Pièces", w_grundstuecksflaeche:"Surface du terrain", w_wohnflaeche:"Surface habitable", w_baujahrOpt:"Année de construction (facultatif)", w_nettomieteMonat:"Loyer net par mois (CHF)", w_kaufpreisLabel:"Prix d'achat (CHF)", w_preisAufAnfrage:"Prix sur demande", w_bewertungHinweis:"Vous hésitez sur le prix ? Fourwalls établit gratuitement une estimation hédonique — à titre indicatif, sans engagement, même si vous publiez vous-même.", w_titelLabel:"Titre", w_titelPlaceholder:"p.ex. Appartement lumineux de 3,5 pièces avec balcon", w_beschreibungLabel:"Description", w_beschreibungPlaceholder:"Situation, état, particularités …", w_bilderHinweis:"Choisissez des photos d'exemple dans l'aperçu — la première devient l'image de titre.", w_bildWort2:"Image", w_nameLabel:"Nom", w_emailLabel:"E-mail", w_telefonOpt:"Téléphone (facultatif)", w_vorschauTitel:"Aperçu de votre annonce", w_veroeffentlichenHinweis:"En publiant, vous confirmez être autorisé à commercialiser ce bien. Nous vérifions chaque annonce avant sa mise en ligne.", w_typWohnung:"Appartement", w_typHaus:"Maison individuelle", w_typVilla:"Villa", w_typChalet:"Chalet", w_typMfh:"Immeuble locatif", w_typGewerbe:"Commerce / Bureaux", w_typGrundstueck:"Terrain à bâtir", w_typParkplatz:"Place de parc / Garage", w_quellFourwalls:"Fourwalls", w_quellPrivat:"Privé", w_quellMakler:"Courtier", w_quellVerwaltung:"Gérance", w_quellEntwickler:"Promoteur", k_sucheFallback:"Recherche", k_angelegtBenachrichtigung:"notification en cas de nouveaux résultats", k_angelegtWort:"créée le", k_oeffnenBtn:"Ouvrir", k_loeschenBtn:"Supprimer", k_objektBtn:"Bien", k_ohneTitel:"(sans titre)", k_eingereichtWort:"soumis le", k_aufrufeAnfragen:"0 vue · 0 demande", k_entwurfFallback:"Brouillon", k_nochNichtEingereicht:"Pas encore soumis", k_weiterbearbeiten:"Continuer", w_fertigTitel:"Votre annonce a été soumise.", w_fertigText:"Nous vérifions chaque annonce brièvement avant sa publication. Vous la trouverez sous « Mes annonces ».", w_zuMeinenInseraten:"Voir mes annonces", p_leerH2:"Ici, il n'y a encore rien au bord de l'eau.", p_aboZeileB:"Voir les nouveautés en premier.", p_aboZeileSpan:"Nous ne vous contactons que si quelque chose de pertinent apparaît — aucun compte requis.", w_fuerEigentuemer:"Pour les propriétaires", w_zweiWege:"Deux façons de vendre. À vous de choisir.", w_selbstKostenlos:"Publier soi-même · gratuit", w_ichErstelleSelbst:"Je crée et gère l'annonce moi-même.", w_selbstBeschreibung:"Vous rédigez le texte, choisissez les photos, répondez aux demandes et menez les visites. Fourwalls fournit la portée et l'outil.", w_selbstListe1:"Gratuit, sans compte pour démarrer", w_selbstListe2:"9 courtes étapes, interruptibles à tout moment", w_selbstListe3:"Les demandes vous parviennent directement", w_jetztKostenlos:"Publier gratuitement maintenant", w_mitFwMandat:"Vendre avec Fourwalls · Mandat", w_fwUebernimmt:"Fourwalls prend en charge la vente de façon professionnelle.", w_fwUebernimmtBeschreibung:"Estimation, stratégie, photographie, qualification des acheteurs, visites, négociation, notariat — un seul interlocuteur jusqu'à la remise des clés.", w_mitFwListe1:"Estimation hédonique gratuite", w_mitFwListe2:"Honoraires uniquement en cas de succès", w_mitFwListe3:"Présentation Fourwalls Exclusive", w_verkaufKennenlernen:"Découvrir la vente avec Fourwalls", w_beidesEhrlich:"Les deux options sont sincères : qui veut publier seul reçoit le meilleur outil, qui veut déléguer, le meilleur service. Vous pouvez changer à tout moment.", w_entwurfAutosave:"Votre brouillon est enregistré automatiquement — vous pouvez interrompre à tout moment et continuer plus tard. Publier est gratuit.", k_ihrBereichHin:"Favoris, alertes et vos propres annonces — enregistrés sur cet appareil sans compte. Un compte n'est nécessaire que si vous voulez partager cela sur plusieurs appareils ou avec votre équipe.", k_anfragenTab:"Demandes", k_nichtsGemerkt:"Rien d'enregistré pour l'instant. Touchez le cœur sur une annonce.", k_keinSuchabo:"Aucune alerte pour l'instant. Enregistrez une recherche — nous vous informons des nouveaux résultats.", k_keineAnfrage:"Aucune demande pour l'instant. Les demandes de visite et questions aux annonceurs apparaissent ici avec leur statut.", k_keinEigenesInserat:"Aucune annonce personnelle pour l'instant.", k_jetztKostenlosPunkt:"Publier gratuitement maintenant.", k_landWort:"terrain", o_secGebaeude:"Bâtiment", o_secAussen:"Extérieur", o_secParkieren:"Stationnement", o_secEnergie:"Énergie", o_gesendetStatus:"Envoyé", o_name:"Nom" },
    it: { immobilien:"Immobili", karte:"Mappa", verkaufen:"Vendere", verwalten:"Amministrazione", inserieren:"Pubblica gratis",
      gemerkt:"Preferiti", kaufen:"Comprare", mieten:"Affittare", ort:"Località, NPA, cantone o regione", typ:"Tutti i tipi",
      preisBis:"Prezzo fino a", preisVon:"Prezzo da", zimmerAb:"Locali da", mehrFilter:"Altri filtri", filter:"Filtri", sucheSpeichern:"Salva ricerca",
      treffer:"risultati", inserate:"annunci", neuste:"Più recenti", preisAuf:"Prezzo crescente", preisAb:"Prezzo decrescente",
      flaeche:"Superficie maggiore", zimmer:"Più locali", liste:"Elenco", weitere:"Mostra altri", zuruecksetzen:"Reimposta",
      anwenden:"Applica", wohnflaeche:"Superficie abitabile da (m²)", anbieter:"Inserzionista", ausstattung:"Dotazione", preisChf:"Prezzo (CHF)",
      merken:"Salva", gemerktOk:"Salvato ✓", schliessen:"Chiudi", anfrage:"Richiedi visita", melden:"Segnala annuncio",
      teilen:"Condividi", dokumente:"Documenti", lage:"Posizione", beschreibung:"Descrizione", fakten:"Dati", kontakt:"Contatto",
      konto:"La sua area", merkliste:"Oggetti salvati", suchabos:"Avvisi di ricerca", meine:"I miei annunci", weiter:"Avanti", zurueck:"Indietro",
      veroeffentlichen:"Pubblica gratuitamente", exclusive:"Fourwalls Exclusive", privat:"Annuncio privato", makler:"Agenzia",
      verwaltung:"Amministrazione", bautraeger:"Costruttore", neu:"Nuovo", geprueft:"verificato", proM2:"CHF/m²", aufAnfrage:"Prezzo su richiesta",
      proMonat:"/ mese", nk:"+ spese", keineTreffer:"Al momento nessun annuncio corrisponde a questa combinazione.", suchabo:"Crea avviso",
      selbst:"Pubblicare da solo", mitFW:"Vendere con Fourwalls", zeilen:"Righe", kacheln:"Schede", buehne:"Scena",
      verfuegbar:"Disponibile", sofort:"Subito", abDatum:"Dal", nachVereinbarung:"Da convenire", reserviert:"Riservato", verkauft:"Venduto", vermietet:"Affittato", etage:"Piano", eg:"Pianterreno", ug:"Seminterrato", og:"° piano", dachgeschoss:"Mansarda", baujahrVon:"Anno da", baujahrBis:"Anno fino a", flaecheVon:"Superficie da", flaecheBis:"Superficie fino a", grundVon:"Terreno da", umkreis:"Raggio", keinUmkreis:"Esattamente questa località", km:"km", treffer1:"immobile", trefferN:"immobili", sortEmpfohlen:"Consigliati", sortM2:"Prezzo al m²", statusZeigen:"Mostrare anche riservati e venduti", nurVerfuegbar:"Solo disponibili", suchaboSpeichern:"Salva avviso", suchaboTitel:"Vedere prima le novità", suchaboMail:"E-mail per l\u2019avviso", suchaboWie:"Con che frequenza?", wieSofort:"Subito", wieTaeglich:"Giornaliero", wieWoechentlich:"Settimanale", suchaboOk:"Avviso salvato", suchaboKonto:"Facoltativo: gestire con un conto su tutti i dispositivi", abbrechen:"Annulla", speichern:"Salva", lockern:"Allargare la ricerca", radiusMehr:"Aumentare il raggio", budgetMehr:"Aumentare il budget", filterWeg:"Togliere un filtro", ergebnisse:"risultati", kaution:"Garanzia (max.)", bruttomiete:"Pigione lorda", nettomiete:"Pigione netta", nebenkosten:"Spese accessorie", zeigeAlle:"Mostra tutti", ergebnisseProSeite:"per pagina",
      zimmerBis:"Locali fino a", baujahr:"Anno di costruzione", nichtEg:"Non pianterreno", ab2:"Dal 2° piano", in3Mt:"Entro 3 mesi", mailFehler:"Inserire un indirizzo e-mail valido.", aboPrototyp:"Prototipo: l\u2019avviso è salvato su questo dispositivo. Non vengono inviate e-mail — la consegna arriverà con il backend.",
      zimmerFilter:"Locali", grundFilter:"Terreno da (m²)",
      flaecheFilter:"Superficie abitabile (m²)",
      bild1:"foto", bildN:"foto",
      bilderMedien:"Foto e media",
      artOrt:"Località", artPlz:"NPA", artKanton:"Cantone", artRegion:"Regione",
      autoSuchen:"Cercare automaticamente spostando", hierSuchen:"Cercare in questa area", imAusschnitt:"Area della mappa", karteLeerText:"Nessun annuncio in questa area.", karteFehler:"La mappa non si carica al momento. L\u2019elenco mostra tutti i risultati." , o_katAlle:"Tutti", o_katAussen:"Esterno", o_katWohnen:"Soggiorno", o_katKueche:"Cucina", o_katSchlafen:"Camera", o_katBad:"Bagno", o_katLage:"Posizione", o_katPlan:"Planimetria", o_zugHerunterladen:"Scaricare", o_zugMitKonto:"Con account", o_zugNachAnfrage:"Su richiesta", o_zugNachBesichtigung:"Dopo la visita", o_zugNachEinigung:"Dopo accordo", o_zugText:"Le diciture «Su richiesta» o «Dopo la visita» significano che il documento non è accessibile pubblicamente, nemmeno con espedienti. Lo sblocchiamo non appena il relativo passo è avvenuto.", o_lgBauweise:"Costruzione", o_lgDach:"Tetto", o_lgFenster:"Finestre", o_lgZustand:"Stato", o_lgAusrichtung:"Orientamento", o_lgVolumen:"Volume", o_lgQualitaet:"Qualità", o_laKueche:"Cucina", o_laBaeder:"Bagni", o_laBoeden:"Pavimenti", o_laGeraete:"Elettrodomestici", o_laWaschen:"Lavanderia", o_laCheminee:"Camino", o_laLift:"Ascensore", o_laSmarthome:"Domotica", o_laStauraum:"Ripostigli", o_leHeizung:"Riscaldamento", o_leEnergietraeger:"Fonte energetica", o_leVerteilung:"Distribuzione del calore", o_lePhotovoltaik:"Fotovoltaico", o_leGeak:"CECE", o_leMinergie:"Minergie", o_loBalkon:"Balcone", o_loTerrasse:"Terrazza", o_loGarten:"Giardino", o_loPool:"Piscina", o_loAussicht:"Vista", o_loPrivatsphaere:"Privacy", o_lpGarage:"Garage", o_lpTiefgarage:"Autorimessa", o_lpAussenplaetze:"Posti esterni", o_lpLadestation:"Colonnina di ricarica", o_fZimmer:"Locali", o_fWohnflaeche:"Superficie abitativa", o_fNutzflaeche:"Superficie utile", o_fGrundstueck:"Terreno", o_fSchlafzimmer:"Camere da letto", o_fBadezimmer:"Bagni", o_fBaujahr:"Anno di costruzione", o_fRenovation:"Ristrutturazione", o_fGeschosse:"Piani", o_fRaumhoehe:"Altezza dei locali", o_fKubatur:"Cubatura", o_fEtage:"Piano", o_fReferenz:"Riferimento", o_fPreis:"Prezzo", o_egKurz:"PT", o_secUebersicht:"Panoramica", o_secEckdaten:"Dati principali", o_secGrundrisse:"Planimetrie", o_secLage:"Posizione", o_secFinanzierung:"Finanziamento", o_secRichtwerte:"Valori indicativi", o_secDokumente:"Documenti", o_secFragen:"Domande frequenti", o_secKontakt:"Contatto", o_secAehnliche:"Immobili simili", o_video:"Video", o_grundrisseBtn:"Planimetrie", o_geprueft2:"Annuncio verificato", o_genaueAdresse:"Indirizzo esatto dopo il contatto", o_tragbarkeitRechnen:"Calcolare la sostenibilità", o_ganzeBeschreibung:"Descrizione completa", o_kaufpreis:"Prezzo d'acquisto", o_objektpreis:"Prezzo dell'immobile", o_eigenmittel:"Mezzi propri", o_zinsmodell:"Modello di tasso", o_saron:"SARON · 1,6%", o_fest5:"Ipoteca fissa 5 anni · 1,9%", o_fest10:"Ipoteca fissa 10 anni · 2,2%", o_belehnung:"Rapporto di finanziamento", o_hypothek:"Ipoteca", o_zinsMonat:"Interessi / mese", o_amortMonat:"Ammortamento / mese", o_unterhMonat:"Manutenzione e spese accessorie / mese", o_totalMonat:"Totale / mese", o_noetHaushalt:"Reddito familiare necessario", o_proJahr:"/ anno", o_finanzFein:"Valori indicativi secondo la prassi bancaria: finanziamento all'80%, seconda ipoteca ammortizzata in 15 anni, manutenzione 1% all'anno, sostenibilità calcolata con un tasso teorico del 5% fino a un massimo di un terzo del reddito. Si tratta di un orientamento e non di un impegno di finanziamento — il calcolo vincolante spetta alla vostra banca.", o_seitenAbk:"pag.", o_wirVertreten:"Fourwalls rappresenta la parte venditrice.", o_anfrageGehtAn:"La vostra richiesta viene inoltrata a", o_nichtAnDritte:"non a terzi.", o_unserTeam:"il nostro team", o_inseriertVon:"Pubblicato da", o_anfrageDirekt:"La vostra richiesta viene inoltrata direttamente a questo inserzionista.", o_vertrittNicht:"Fourwalls non rappresenta questo immobile", o_hatGeprueft:", ma ne ha verificato l'identità e l'annuncio", o_frageStellen:"Fare una domanda", o_nachrichtStandard:"Buongiorno\nSono interessato/a a questo immobile e vorrei visitarlo.", o_nachrichtFrage:"Buongiorno\nHo una domanda su questo immobile:\n", o_aehnlicheSuchabo:"Ricevere immobili simili tramite avviso di ricerca", o_anfrageSenden:"Invia la richiesta", o_gesendetAn:"vi ricontatterà.", o_gesendetPrefix:"Inviato —", o_linkKopiert:"Link copiato ✓", o_gemeldetDanke:"Segnalato — grazie, verifichiamo.", o_vorherigesBild:"Immagine precedente", o_naechstesBild:"Immagine successiva", o_bildWort:"Immagine", o_objektfilm:"Video dell'immobile", o_videoProd:"In produzione qui verrà riprodotto il video come stream HLS, senza autoplay audio.", o_rundgang:"Tour virtuale 360°", o_rundgangProd:"In produzione qui verrà integrato il tour, con selezione degli ambienti a lato.", o_modell3d:"Modello 3D", o_modell3dHinweis:"Appare solo per immobili rilevati digitalmente — nessun volume ricostruito.", o_ausrichtungWort:"Orientamento", o_grundrissPrefix:"Planimetria ·", o_planNichtGeladen:"Non è stato possibile caricare la planimetria.", o_planPdf1:"La planimetria è disponibile in PDF", o_planPdf2:"In produzione la prima pagina verrà mostrata in anteprima.", o_verkleinern:"Rimpicciolire", o_vergroessern:"Ingrandire", o_vollbild:"Schermo intero", o_lageExakt:"Posizione esatta comunicata dall'inserzionista", o_lageGemeinde:"Posizione a livello comunale", o_lageUngefaehr:"Posizione approssimativa", o_imUmkreisVon:"in un raggio di", o_genaueAdresse2:"indirizzo esatto dopo il contatto", o_karteSwisstopo:"Mappa: swisstopo", o_ungefaehreLageCanvas:"POSIZIONE APPROSSIMATIVA · INDIRIZZO ESATTO DOPO IL CONTATTO", o_gemeindeWort:"Comune", o_quartierWort:"Quartiere", o_steuerfussWort:"Aliquota fiscale", o_fahrzeitenAuto:"Tempi di percorrenza in auto", o_kantonWort:"Cantone", o_genAdresseNachKontaktSatz:"Riceverete l'indirizzo esatto dopo aver contattato l'inserzionista.", o_poiOev:"Trasporti pubblici", o_poiSchulen:"Scuole", o_poiEinkauf:"Negozi", o_poiGesundheit:"Salute", o_poiFreizeit:"Tempo libero", o_poiVerkehr:"Traffico", o_ziKurz:"loc.", o_naechsteBesichtigung:"Richiedere una visita", o_naechsteFrage:"Fare una domanda", o_naechsteFinanzierung:"Verificare il finanziamento", w_schrittWort:"Passo", w_vonWort:"di", w_vermieten:"Affittare", w_ichVerkaufen:"Vendere", w_verkaufenHin:"Desidera vendere il suo immobile.", w_vermietenHin:"Sta cercando inquilini.", w_inseriereAls:"Pubblico come", w_privatperson:"Privato", w_maklerAgentur:"Agente / Agenzia", w_verwaltungWort:"Amministrazione", w_bautraegerWort:"Costruttore", w_strasseLabel:"Via e numero (facoltativo — visibile solo dopo il contatto)", w_plzLabel:"NPA", w_ortLabel:"Località", w_geoStatusLeer:"Inserisca il NPA — completiamo comune, cantone e regione dal registro.", w_geoStatusUnbekannt:"Questa località non è ancora nel nostro registro. È comunque possibile inviare l'annuncio; assegneremo il comune manualmente.", w_erkannt:"Riconosciuto:", w_lageGenauFrage:"Con quale precisione può apparire pubblicamente la posizione?", w_lageExaktTitel:"Posizione esatta", w_lageExaktHin:"Un punto sulla mappa. Utile per nuove costruzioni e immobili commerciali.", w_lageUngefaehrTitel:"Approssimativa", w_lageUngefaehrHin:"Un'area di circa 450 m. Il quartiere è riconoscibile, la casa no.", w_lageGemeindeTitel:"Solo comune", w_lageGemeindeHin:"Un'area di circa 2 km. La massima discrezione possibile.", w_strasseBleibtPrivat:"L'indirizzo resta comunque privato finché non lo comunica a chi ha inviato una richiesta.", w_kartenVorschauLeer:"Non appena la località è definita, qui vedrà come apparirà pubblicamente la sua posizione.", w_kartenVorschauFehler:"L'anteprima non può essere caricata al momento. La sua scelta è salvata.", w_zimmerLabel:"Locali", w_grundstuecksflaeche:"Superficie del terreno", w_wohnflaeche:"Superficie abitativa", w_baujahrOpt:"Anno di costruzione (facoltativo)", w_nettomieteMonat:"Affitto netto mensile (CHF)", w_kaufpreisLabel:"Prezzo d'acquisto (CHF)", w_preisAufAnfrage:"Prezzo su richiesta", w_bewertungHinweis:"Non è sicuro del prezzo? Fourwalls le prepara gratuitamente una valutazione edonica — come valore indicativo, senza impegno, anche se pubblica da solo.", w_titelLabel:"Titolo", w_titelPlaceholder:"es. Appartamento luminoso di 3,5 locali con balcone", w_beschreibungLabel:"Descrizione", w_beschreibungPlaceholder:"Posizione, stato, particolarità …", w_bilderHinweis:"Scelga foto di esempio dall'anteprima — la prima diventa l'immagine principale.", w_bildWort2:"Immagine", w_nameLabel:"Nome", w_emailLabel:"E-mail", w_telefonOpt:"Telefono (facoltativo)", w_vorschauTitel:"Anteprima del suo annuncio", w_veroeffentlichenHinweis:"Pubblicando conferma di essere autorizzato a commercializzare questo immobile. Verifichiamo ogni annuncio prima che venga pubblicato.", w_typWohnung:"Appartamento", w_typHaus:"Casa unifamiliare", w_typVilla:"Villa", w_typChalet:"Chalet", w_typMfh:"Stabile plurifamiliare", w_typGewerbe:"Commerciale / Uffici", w_typGrundstueck:"Terreno edificabile", w_typParkplatz:"Posto auto / Garage", w_quellFourwalls:"Fourwalls", w_quellPrivat:"Privato", w_quellMakler:"Agenzia", w_quellVerwaltung:"Amministrazione", w_quellEntwickler:"Costruttore", k_sucheFallback:"Ricerca", k_angelegtBenachrichtigung:"notifica per nuovi risultati", k_angelegtWort:"creata il", k_oeffnenBtn:"Apri", k_loeschenBtn:"Elimina", k_objektBtn:"Immobile", k_ohneTitel:"(senza titolo)", k_eingereichtWort:"inviato il", k_aufrufeAnfragen:"0 visualizzazioni · 0 richieste", k_entwurfFallback:"Bozza", k_nochNichtEingereicht:"Non ancora inviato", k_weiterbearbeiten:"Continua", w_fertigTitel:"Il suo annuncio è stato inviato.", w_fertigText:"Verifichiamo brevemente ogni annuncio prima della pubblicazione. Lo trova sotto «I miei annunci».", w_zuMeinenInseraten:"Vai ai miei annunci", p_leerH2:"Qui non c'è ancora nulla in riva al lago.", p_aboZeileB:"Vedere prima le novità.", p_aboZeileSpan:"Vi contattiamo solo se appare qualcosa di adatto — nessun account necessario.", w_fuerEigentuemer:"Per proprietarie e proprietari", w_zweiWege:"Due strade per vendere. Sceglie lei.", w_selbstKostenlos:"Pubblicare da soli · gratis", w_ichErstelleSelbst:"Creo e gestisco l'annuncio da solo/a.", w_selbstBeschreibung:"Scrive il testo, sceglie le foto, risponde alle richieste e conduce le visite. Fourwalls mette a disposizione visibilità e strumento.", w_selbstListe1:"Gratuito, senza account per iniziare", w_selbstListe2:"9 brevi passaggi, interrompibili in qualsiasi momento", w_selbstListe3:"Le richieste arrivano direttamente a lei", w_jetztKostenlos:"Pubblica ora gratis", w_mitFwMandat:"Vendere con Fourwalls · Mandato", w_fwUebernimmt:"Fourwalls si occupa della vendita in modo professionale.", w_fwUebernimmtBeschreibung:"Valutazione, strategia, fotografia, qualificazione degli acquirenti, visite, trattativa, notariato — un'unica persona di riferimento fino alla consegna.", w_mitFwListe1:"Valutazione edonica gratuita", w_mitFwListe2:"Onorario solo in caso di successo", w_mitFwListe3:"Presentazione Fourwalls Exclusive", w_verkaufKennenlernen:"Scoprire la vendita con Fourwalls", w_beidesEhrlich:"Entrambe le opzioni sono sincere: chi vuole pubblicare da solo riceve lo strumento migliore, chi vuole delegare, il miglior servizio. Può cambiare in qualsiasi momento.", w_entwurfAutosave:"La bozza viene salvata automaticamente — può interrompere in qualsiasi momento e continuare più tardi. Pubblicare è gratuito.", k_ihrBereichHin:"Preferiti, avvisi di ricerca e annunci propri — salvati su questo dispositivo senza account. Un account serve solo per condividerli su più dispositivi o con il proprio team.", k_anfragenTab:"Richieste", k_nichtsGemerkt:"Ancora nulla nei preferiti. Tocchi il cuore su un annuncio.", k_keinSuchabo:"Ancora nessun avviso di ricerca. Salvi una ricerca — la avviseremo di nuovi risultati.", k_keineAnfrage:"Ancora nessuna richiesta. Le richieste di visita e le domande agli inserzionisti appaiono qui con il relativo stato.", k_keinEigenesInserat:"Ancora nessun annuncio proprio.", k_jetztKostenlosPunkt:"Pubblica ora gratis.", k_landWort:"terreno", o_secGebaeude:"Edificio", o_secAussen:"Esterno", o_secParkieren:"Parcheggio", o_secEnergie:"Energia", o_gesendetStatus:"Inviato", o_name:"Nome" },
    en: { immobilien:"Properties", karte:"Map", verkaufen:"Sell", verwalten:"Management", inserieren:"List for free",
      gemerkt:"Saved", kaufen:"Buy", mieten:"Rent", ort:"Place, postcode, canton or region", typ:"All property types",
      preisBis:"Price up to", preisVon:"Price from", zimmerAb:"Rooms from", mehrFilter:"More filters", filter:"Filters", sucheSpeichern:"Save search",
      treffer:"results", inserate:"listings", neuste:"Newest first", preisAuf:"Price ascending", preisAb:"Price descending",
      flaeche:"Largest area", zimmer:"Most rooms", liste:"List", weitere:"Show more", zuruecksetzen:"Reset",
      anwenden:"Apply", wohnflaeche:"Living area from (m²)", anbieter:"Publisher", ausstattung:"Features", preisChf:"Price (CHF)",
      merken:"Save", gemerktOk:"Saved ✓", schliessen:"Close", anfrage:"Request a viewing", melden:"Report listing",
      teilen:"Share", dokumente:"Documents", lage:"Location", beschreibung:"Description", fakten:"Facts", kontakt:"Contact",
      konto:"Your area", merkliste:"Saved properties", suchabos:"Search alerts", meine:"My listings", weiter:"Continue", zurueck:"Back",
      veroeffentlichen:"Publish for free", exclusive:"Fourwalls Exclusive", privat:"Private listing", makler:"Agency",
      verwaltung:"Management", bautraeger:"Developer", neu:"New", geprueft:"verified", proM2:"CHF/m²", aufAnfrage:"Price on request",
      proMonat:"/ month", nk:"+ charges", keineTreffer:"No listing currently matches this combination.", suchabo:"Create alert",
      selbst:"List it myself", mitFW:"Sell with Fourwalls", zeilen:"Rows", kacheln:"Cards", buehne:"Stage",
      verfuegbar:"Available", sofort:"Immediately", abDatum:"From", nachVereinbarung:"By arrangement", reserviert:"Reserved", verkauft:"Sold", vermietet:"Let", etage:"Floor", eg:"Ground floor", ug:"Lower ground", og:"th floor", dachgeschoss:"Top floor", baujahrVon:"Built from", baujahrBis:"Built until", flaecheVon:"Living area from", flaecheBis:"Living area up to", grundVon:"Plot from", umkreis:"Radius", keinUmkreis:"This place exactly", km:"km", treffer1:"property", trefferN:"properties", sortEmpfohlen:"Recommended", sortM2:"Price per m²", statusZeigen:"Also show reserved and sold", nurVerfuegbar:"Available only", suchaboSpeichern:"Save search alert", suchaboTitel:"See new matches first", suchaboMail:"Email for the alert", suchaboWie:"How often?", wieSofort:"Immediately", wieTaeglich:"Daily", wieWoechentlich:"Weekly", suchaboOk:"Search alert saved", suchaboKonto:"Optional: manage it with an account on all devices", abbrechen:"Cancel", speichern:"Save", lockern:"Widen the search", radiusMehr:"Increase radius", budgetMehr:"Increase budget", filterWeg:"Remove a filter", ergebnisse:"results", kaution:"Deposit (max.)", bruttomiete:"Gross rent", nettomiete:"Net rent", nebenkosten:"Service charges", zeigeAlle:"Show all", ergebnisseProSeite:"per page",
      zimmerBis:"Rooms up to", baujahr:"Construction year", nichtEg:"Not ground floor", ab2:"2nd floor and up", in3Mt:"Within 3 months", mailFehler:"Please enter a valid email address.", aboPrototyp:"Prototype: the alert is stored on this device. No emails are sent — delivery comes with the backend.",
      zimmerFilter:"Rooms", grundFilter:"Plot from (m²)",
      flaecheFilter:"Living area (m²)",
      bild1:"photo", bildN:"photos",
      bilderMedien:"Photos and media",
      artOrt:"Place", artPlz:"Postcode", artKanton:"Canton", artRegion:"Region",
      autoSuchen:"Search automatically while moving", hierSuchen:"Search this area", imAusschnitt:"Map area", karteLeerText:"No listing in this area.", karteFehler:"The map cannot load right now. The list shows every result.", o_katAlle:"All", o_katAussen:"Exterior", o_katWohnen:"Living", o_katKueche:"Kitchen", o_katSchlafen:"Bedroom", o_katBad:"Bathroom", o_katLage:"Location", o_katPlan:"Floor plan", o_zugHerunterladen:"Download", o_zugMitKonto:"With account", o_zugNachAnfrage:"On request", o_zugNachBesichtigung:"After viewing", o_zugNachEinigung:"After agreement", o_zugText:"“On request” or “After viewing” means the document is not publicly accessible, not even by workaround. We unlock it as soon as that step has taken place.", o_lgBauweise:"Construction", o_lgDach:"Roof", o_lgFenster:"Windows", o_lgZustand:"Condition", o_lgAusrichtung:"Orientation", o_lgVolumen:"Volume", o_lgQualitaet:"Quality", o_laKueche:"Kitchen", o_laBaeder:"Bathrooms", o_laBoeden:"Floors", o_laGeraete:"Appliances", o_laWaschen:"Laundry", o_laCheminee:"Fireplace", o_laLift:"Lift", o_laSmarthome:"Smart home", o_laStauraum:"Storage", o_leHeizung:"Heating", o_leEnergietraeger:"Energy source", o_leVerteilung:"Heat distribution", o_lePhotovoltaik:"Photovoltaic", o_leGeak:"Energy label", o_leMinergie:"Minergie", o_loBalkon:"Balcony", o_loTerrasse:"Terrace", o_loGarten:"Garden", o_loPool:"Pool", o_loAussicht:"View", o_loPrivatsphaere:"Privacy", o_lpGarage:"Garage", o_lpTiefgarage:"Underground parking", o_lpAussenplaetze:"Outdoor spaces", o_lpLadestation:"Charging station", o_fZimmer:"Rooms", o_fWohnflaeche:"Living area", o_fNutzflaeche:"Usable area", o_fGrundstueck:"Plot", o_fSchlafzimmer:"Bedrooms", o_fBadezimmer:"Bathrooms", o_fBaujahr:"Year built", o_fRenovation:"Renovation", o_fGeschosse:"Floors", o_fRaumhoehe:"Ceiling height", o_fKubatur:"Building volume", o_fEtage:"Floor", o_fReferenz:"Reference", o_fPreis:"Price", o_egKurz:"Ground floor", o_secUebersicht:"Overview", o_secEckdaten:"Key facts", o_secGrundrisse:"Floor plans", o_secLage:"Location", o_secFinanzierung:"Financing", o_secRichtwerte:"Guide values", o_secDokumente:"Documents", o_secFragen:"Frequently asked questions", o_secKontakt:"Contact", o_secAehnliche:"Similar properties", o_video:"Video", o_grundrisseBtn:"Floor plans", o_geprueft2:"Verified listing", o_genaueAdresse:"Exact address after contact", o_tragbarkeitRechnen:"Calculate affordability", o_ganzeBeschreibung:"Full description", o_kaufpreis:"Purchase price", o_objektpreis:"Property price", o_eigenmittel:"Equity", o_zinsmodell:"Interest rate model", o_saron:"SARON · 1.6%", o_fest5:"Fixed-rate mortgage 5 years · 1.9%", o_fest10:"Fixed-rate mortgage 10 years · 2.2%", o_belehnung:"Loan-to-value", o_hypothek:"Mortgage", o_zinsMonat:"Interest / month", o_amortMonat:"Amortization / month", o_unterhMonat:"Maintenance and running costs / month", o_totalMonat:"Total / month", o_noetHaushalt:"Required household income", o_proJahr:"/ year", o_finanzFein:"Guide values based on standard banking practice: 80% loan-to-value, second mortgage amortized over 15 years, maintenance 1% per year, affordability calculated at a 5% notional rate up to at most one third of income. This is guidance, not a financing commitment — your bank's calculation is the binding one.", o_seitenAbk:"p.", o_wirVertreten:"Fourwalls represents the seller.", o_anfrageGehtAn:"Your inquiry goes to", o_nichtAnDritte:"not to third parties.", o_unserTeam:"our team", o_inseriertVon:"Listed by", o_anfrageDirekt:"Your inquiry goes directly to this provider.", o_vertrittNicht:"Fourwalls does not represent this property", o_hatGeprueft:", but has verified identity and listing", o_frageStellen:"Ask a question", o_nachrichtStandard:"Hello\nI'm interested in this property and would like to view it.", o_nachrichtFrage:"Hello\nI have a question about this property:\n", o_aehnlicheSuchabo:"Receive similar properties via search alert", o_anfrageSenden:"Send inquiry", o_gesendetAn:"will get back to you.", o_gesendetPrefix:"Sent —", o_linkKopiert:"Link copied ✓", o_gemeldetDanke:"Reported — thanks, we'll review it.", o_vorherigesBild:"Previous image", o_naechstesBild:"Next image", o_bildWort:"Image", o_objektfilm:"Property film", o_videoProd:"In production, the film streams here via HLS, with no autoplaying sound.", o_rundgang:"360° virtual tour", o_rundgangProd:"In production, the tour is embedded here, with room selection on the side.", o_modell3d:"3D model", o_modell3dHinweis:"Only appears for properties that were digitally surveyed — no reconstructed volume.", o_ausrichtungWort:"Orientation", o_grundrissPrefix:"Floor plan ·", o_planNichtGeladen:"The plan could not be loaded.", o_planPdf1:"The plan is available as a PDF", o_planPdf2:"In production, the first page renders here as a preview.", o_verkleinern:"Zoom out", o_vergroessern:"Zoom in", o_vollbild:"Fullscreen", o_lageExakt:"Exact location released by the provider", o_lageGemeinde:"Location at municipality level", o_lageUngefaehr:"Approximate location", o_imUmkreisVon:"within", o_genaueAdresse2:"exact address after contact", o_karteSwisstopo:"Map: swisstopo", o_ungefaehreLageCanvas:"APPROXIMATE LOCATION · EXACT ADDRESS AFTER CONTACT", o_gemeindeWort:"Municipality", o_quartierWort:"Neighbourhood", o_steuerfussWort:"Tax rate", o_fahrzeitenAuto:"Driving times", o_kantonWort:"canton", o_genAdresseNachKontaktSatz:"You will receive the exact address after contacting the provider.", o_poiOev:"Public transport", o_poiSchulen:"Schools", o_poiEinkauf:"Shopping", o_poiGesundheit:"Healthcare", o_poiFreizeit:"Leisure", o_poiVerkehr:"Traffic", o_ziKurz:"rm", o_naechsteBesichtigung:"Request a viewing", o_naechsteFrage:"Ask a question", o_naechsteFinanzierung:"Check financing", w_schrittWort:"Step", w_vonWort:"of", w_vermieten:"Let", w_ichVerkaufen:"Sell", w_verkaufenHin:"You want to sell your property.", w_vermietenHin:"You're looking for tenants.", w_inseriereAls:"I'm listing as", w_privatperson:"Private individual", w_maklerAgentur:"Agent / Agency", w_verwaltungWort:"Management", w_bautraegerWort:"Developer", w_strasseLabel:"Street and number (optional — only visible after contact)", w_plzLabel:"Postcode", w_ortLabel:"Place", w_geoStatusLeer:"Enter the postcode — we'll fill in the municipality, canton and region from the directory.", w_geoStatusUnbekannt:"This place isn't in our directory yet. You can still submit the listing; we'll assign the municipality by hand.", w_erkannt:"Recognized:", w_lageGenauFrage:"How precisely may the location appear publicly?", w_lageExaktTitel:"Exact location", w_lageExaktHin:"A pin on the map. Useful for new builds and commercial property.", w_lageUngefaehrTitel:"Approximate", w_lageUngefaehrHin:"A field of about 450 m. The neighbourhood is identifiable, the house is not.", w_lageGemeindeTitel:"Municipality only", w_lageGemeindeHin:"A field of about 2 km. Maximum discretion.", w_strasseBleibtPrivat:"The street address always stays private until you release it to an inquiry.", w_kartenVorschauLeer:"Once the place is set, you'll see here how your location will appear publicly.", w_kartenVorschauFehler:"The preview cannot load right now. Your selection is saved.", w_zimmerLabel:"Rooms", w_grundstuecksflaeche:"Plot area", w_wohnflaeche:"Living area", w_baujahrOpt:"Year built (optional)", w_nettomieteMonat:"Net rent per month (CHF)", w_kaufpreisLabel:"Purchase price (CHF)", w_preisAufAnfrage:"Price on request", w_bewertungHinweis:"Not sure about the price? Fourwalls will prepare a free hedonic valuation for you — as a guide value, no obligation, even if you list it yourself.", w_titelLabel:"Title", w_titelPlaceholder:"e.g. Bright 3.5-room apartment with balcony", w_beschreibungLabel:"Description", w_beschreibungPlaceholder:"Location, condition, special features …", w_bilderHinweis:"Choose sample photos from the preview — the first one becomes the cover image.", w_bildWort2:"Image", w_nameLabel:"Name", w_emailLabel:"Email", w_telefonOpt:"Phone (optional)", w_vorschauTitel:"Preview of your listing", w_veroeffentlichenHinweis:"By publishing, you confirm you are authorized to market this property. We review every listing before it goes live.", w_typWohnung:"Apartment", w_typHaus:"House", w_typVilla:"Villa", w_typChalet:"Chalet", w_typMfh:"Apartment building", w_typGewerbe:"Commercial / Office", w_typGrundstueck:"Building land", w_typParkplatz:"Parking / Garage", w_quellFourwalls:"Fourwalls", w_quellPrivat:"Private", w_quellMakler:"Agency", w_quellVerwaltung:"Management", w_quellEntwickler:"Developer", k_sucheFallback:"Search", k_angelegtBenachrichtigung:"notification for new matches", k_angelegtWort:"created", k_oeffnenBtn:"Open", k_loeschenBtn:"Delete", k_objektBtn:"Property", k_ohneTitel:"(untitled)", k_eingereichtWort:"submitted", k_aufrufeAnfragen:"0 views · 0 inquiries", k_entwurfFallback:"Draft", k_nochNichtEingereicht:"Not yet submitted", k_weiterbearbeiten:"Continue editing", w_fertigTitel:"Your listing has been submitted.", w_fertigText:"We briefly review every listing before it goes live. You'll find it under “My listings”.", w_zuMeinenInseraten:"Go to my listings", p_leerH2:"There's nothing here on the shore yet.", p_aboZeileB:"See new matches first.", p_aboZeileSpan:"We only reach out when something matching appears — no account needed.", w_fuerEigentuemer:"For property owners", w_zweiWege:"Two ways to sell. You choose.", w_selbstKostenlos:"List it yourself · free", w_ichErstelleSelbst:"I'll create and manage the listing myself.", w_selbstBeschreibung:"You write the text, choose the photos, answer inquiries and conduct viewings. Fourwalls provides the reach and the tool.", w_selbstListe1:"Free, no account needed to start", w_selbstListe2:"9 short steps, pause anytime", w_selbstListe3:"Inquiries go straight to you", w_jetztKostenlos:"List for free now", w_mitFwMandat:"Sell with Fourwalls · Mandate", w_fwUebernimmt:"Fourwalls handles the sale professionally.", w_fwUebernimmtBeschreibung:"Valuation, strategy, photography, buyer qualification, viewings, negotiation, notarization — one point of contact through to handover.", w_mitFwListe1:"Free hedonic valuation", w_mitFwListe2:"Fee only on success", w_mitFwListe3:"Fourwalls Exclusive presentation", w_verkaufKennenlernen:"Discover selling with Fourwalls", w_beidesEhrlich:"Both options are meant sincerely: list it yourself and get the best tool, hand it off and get the best service. You can switch at any time.", w_entwurfAutosave:"Your draft saves automatically — you can pause anytime and continue later. Listing is free.", k_ihrBereichHin:"Favorites, search alerts and your own listings — saved on this device without an account. You only need an account to share this across devices or with your team.", k_anfragenTab:"Inquiries", k_nichtsGemerkt:"Nothing saved yet. Tap the heart on a listing.", k_keinSuchabo:"No search alert yet. Save a search — we'll notify you of new matches.", k_keineAnfrage:"No inquiries yet. Viewing requests and questions to providers appear here with their status.", k_keinEigenesInserat:"No listing of your own yet.", k_jetztKostenlosPunkt:"List for free now.", k_landWort:"land", o_secGebaeude:"Building", o_secAussen:"Exterior", o_secParkieren:"Parking", o_secEnergie:"Energy", o_gesendetStatus:"Sent", o_name:"Name" }
  };
  let LANG = "de";
  function sprache(l) { if (I18N[l]) LANG = l; try { localStorage.setItem("fw-lang", LANG); } catch (e) {} return LANG; }
  try { const v = localStorage.getItem("fw-lang"); if (v && I18N[v]) LANG = v; } catch (e) {}
  const t = k => (I18N[LANG] && I18N[LANG][k]) || I18N.de[k] || k;

  /* ---------- Datensatz: Marktplatz + Fourwalls-Mandate zusammenführen ---------- */
  const TYP_MAP = { apartment:"wohnung", house:"haus", villa:"villa", chalet:"chalet", multifamily:"mfh", "multi-family":"mfh", commercial:"gewerbe", land:"grundstueck" };
  function mandate() {
    if (mandate._c) return mandate._c;
    const FWp = (window.FW && window.FW.properties) || [];
    mandate._c = FWp.map(p => ({
      id: p.id, slug: p.slug, fw: true,
      transactionType: p.transactionType, propertyType: TYP_MAP[p.propertyType] || (p.rooms == null ? "mfh" : "wohnung"),
      title: p.title.de, city: p.city, postalCode: p.postalCode, canton: p.canton, lat: p.lat, lng: p.lng,
      price: p.price ?? null, priceOnRequest: !!p.priceOnRequest, rentNet: p.rentNet ?? null, rentNK: p.rentNK ?? null,
      rooms: p.rooms ?? null, livingArea: p.livingArea ?? null, plotArea: p.plotArea ?? null, yearBuilt: p.yearBuilt ?? null,
      floor: p.floor ?? null, features: p.features || [], img: p.heroMedia, bilder: p.images || [p.heroMedia],
      beschreibung: p.blurb.de, text: p.description.de, highlights: p.highlights.de, raeume: p.roomsBreakdown || null,
      tagline: p.tagline.de, listingSource: "fourwalls", sellerType: "fourwalls", listingTier: p.featured ? "exclusive" : "verified",
      verificationStatus: "verified", publicationStatus: "publiziert", availability: { art:"vereinbarung", datum:null }, publishedAt: p.createdAt, neu: false,
      views: 900 + Math.floor((p.livingArea || 100) * 7), favoritesCount: 40, inquiryCount: 9,
      publisher: "Fourwalls AG", contactOptions: ["form","call"], broker: p.broker, demo: true
    }));
    return mandate._c;
  }
  function alle() {
    if (alle._c) return alle._c;
    const synth = window.FWL.listings.filter(l => l.listingTier !== "exclusive" || l.listingSource !== "fourwalls")
      .map(l => Object.assign({}, l, { bilder: [l.img] }));
    /* synthetische «exclusive» durch echte Mandate ersetzen; Rest der FW-Inserate bleibt «verified» */
    alle._c = mandate().concat(synth);
    return alle._c;
  }
  const finde = slug => alle().find(l => l.slug === slug);

  /* ---------- Bilder (responsiv, extern) ---------- */
  const IMG_BASE = (window.FW_IMG_BASE || "../img/");
  function pic(key, opt) {
    opt = opt || {};
    const sizes = opt.sizes || "(max-width: 700px) 100vw, 33vw";
    const set = f => [480, 960, 1600].map(w => `${IMG_BASE}${key}-${w}.${f} ${w}w`).join(", ");
    const lazy = opt.eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy" decoding="async"';
    return `<picture><source type="image/webp" srcset="${set("webp")}" sizes="${sizes}">` +
      `<img src="${IMG_BASE}${key}-960.jpg" srcset="${set("jpg")}" sizes="${sizes}" alt="${(opt.alt || "").replace(/"/g, "&quot;")}" ${lazy}${opt.cls ? ` class="${opt.cls}"` : ""}></picture>`;
  }

  /* ---------- Formatierung ---------- */
  function chf(n) { return "CHF " + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "’"); }
  function preis(l) {
    if (l.transactionType === "rent") return chf(l.rentNet) + ".– " + t("proMonat");
    if (l.priceOnRequest || l.price == null) return t("aufAnfrage");
    return chf(l.price) + ".–";
  }
  function preisKurz(l) {
    if (l.transactionType === "rent") return chf(l.rentNet).replace("CHF ", "") + ".–";
    if (l.priceOnRequest || l.price == null) return "a. A.";
    if (l.price >= 1e6) return (l.price / 1e6).toFixed(2).replace(/\.?0+$/, "") + " Mio.";
    return chf(l.price).replace("CHF ", "");
  }
  /* CHF/m² nur wo aussagekräftig: Kauf + Wohnfläche + Wohnobjekt. Miete/Land/Parkplatz/Gewerbe: null. */
  function proM2(l) {
    if (l.transactionType !== "buy" || l.priceOnRequest || !l.price || !l.livingArea) return null;
    if (!["wohnung","haus","villa","chalet"].includes(l.propertyType)) return null;
    return Math.round(l.price / l.livingArea / 100) * 100;
  }

  /* ---------- Orte, Kantone, Regionen ---------- */
  const KANTON_NAME = { ZH:"Zürich", BE:"Bern", LU:"Luzern", ZG:"Zug", BS:"Basel-Stadt", BL:"Basel-Landschaft", GE:"Genf", VD:"Waadt", VS:"Wallis", TI:"Tessin", SG:"St. Gallen", GR:"Graubünden", AG:"Aargau", SO:"Solothurn", FR:"Freiburg", NE:"Neuenburg", SH:"Schaffhausen", SZ:"Schwyz", UR:"Uri", OW:"Obwalden", NW:"Nidwalden", TG:"Thurgau", GL:"Glarus", AR:"Appenzell AR", AI:"Appenzell IR", JU:"Jura" };
  const REGIONEN = {
    zentralschweiz: { name:"Zentralschweiz", kantone:["LU","ZG","SZ","UR","OW","NW"] },
    zuerich:        { name:"Region Zürich", kantone:["ZH"] },
    ostschweiz:     { name:"Ostschweiz", kantone:["SG","TG","AR","AI","GL","SH"] },
    nordwestschweiz:{ name:"Nordwestschweiz", kantone:["BS","BL","AG","SO"] },
    mittelland:     { name:"Bern & Mittelland", kantone:["BE"] },
    romandie:       { name:"Romandie", kantone:["GE","VD","NE","JU","FR"] },
    wallis:         { name:"Wallis", kantone:["VS"] },
    tessin:         { name:"Tessin", kantone:["TI"] },
    graubuenden:    { name:"Graubünden", kantone:["GR"] }
  };
  function ortIndex() {
    if (ortIndex._c) return ortIndex._c;
    const st = new Map(), kt = new Map();
    for (const l of alle()) {
      if (!st.has(l.city)) st.set(l.city, { name:l.city, kanton:l.canton, plz:new Set(), n:0 });
      const s = st.get(l.city); s.n++; s.plz.add(l.postalCode);
      kt.set(l.canton, (kt.get(l.canton) || 0) + 1);
    }
    ortIndex._c = { staedte:[...st.values()], kantone:[...kt.entries()] };
    return ortIndex._c;
  }
  function ortLabel(wert) {
    if (!wert) return "";
    if (wert.startsWith("kt:")) return "Kanton " + (KANTON_NAME[wert.slice(3)] || wert.slice(3));
    if (wert.startsWith("rg:")) return (REGIONEN[wert.slice(3)] || {}).name || wert;
    return wert;
  }
  function vorschlaege(q) {
    q = (q || "").trim().toLowerCase();
    if (!q) return [];
    const idx = ortIndex(), out = [];
    for (const [k, r] of Object.entries(REGIONEN))
      if (r.name.toLowerCase().includes(q) || k.startsWith(q))
        out.push({ label:r.name, sub:"Region · " + r.kantone.join(", "), wert:"rg:" + k, art:"region" });
    for (const [kt, n] of idx.kantone) {
      const nm = KANTON_NAME[kt] || kt;
      if (nm.toLowerCase().startsWith(q) || kt.toLowerCase() === q)
        out.push({ label:"Kanton " + nm, sub:n + " " + t("inserate"), wert:"kt:" + kt, art:"kanton" });
    }
    for (const s of idx.staedte) {
      if (s.name.toLowerCase().startsWith(q)) out.push({ label:s.name, sub:(KANTON_NAME[s.kanton] || s.kanton) + " · " + s.n + " " + t("inserate"), wert:s.name, art:"ort" });
      else if ([...s.plz].some(p => p.startsWith(q))) out.push({ label:[...s.plz].find(p => p.startsWith(q)) + " " + s.name, sub:"PLZ", wert:s.name, art:"plz" });
    }
    return out.slice(0, 8);
  }

  /* ---------- Abgeleitete Anzeige: eine Regel, eine Umsetzung ---------- */
  function verfuegbarLabel(l) {
    const a = l.availability || { art:"vereinbarung" };
    if (a.art === "sofort") return t("sofort");
    if (a.art === "datum" && a.datum) { const d = new Date(a.datum); return t("abDatum") + " " + d.toLocaleDateString(LANG === "en" ? "en-GB" : LANG + "-CH", { day:"2-digit", month:"2-digit", year:"numeric" }); }
    if (a.art === "reserviert") return t("reserviert");
    if (a.art === "verkauft") return t("verkauft");
    if (a.art === "vermietet") return t("vermietet");
    return t("nachVereinbarung");
  }
  const verfuegbarFrei = l => !["reserviert","verkauft","vermietet"].includes((l.availability || {}).art);
  function etageLabel(f) {
    if (f == null) return null;
    if (f < 0) return t("ug");
    if (f === 0) return t("eg");
    if (f >= 6) return t("dachgeschoss");
    return LANG === "en" ? f + t("og") : f + t("og");
  }
  /* Etage ist nur bei Objekten mit Geschosslage sinnvoll */
  const hatEtage = typ => ["wohnung","gewerbe"].includes(typ);
  function trefferLabel(n) { return n + " " + (n === 1 ? t("treffer1") : t("trefferN")); }
  function bildLabel(n) { return n + " " + (n === 1 ? t("bild1") : t("bildN")); }
  /* Monatliche Kostenschätzung nur bei Kauf mit Preis und Wohnfläche eines Wohnobjekts */
  function monatlichMoeglich(l) {
    return l.transactionType === "buy" && !l.priceOnRequest && !!l.price && ["wohnung","haus","villa","chalet","mfh"].includes(l.propertyType);
  }
  /* Ähnlichkeit, deterministisch und erklärbar: gleiche Transaktion und Objektart,
     dann Nähe in Kanton, Preisband (±35 %), Zimmerzahl und Fläche. */
  function aehnliche(l, anzahl) {
    const w = x => x.transactionType === "rent" ? x.rentNet : x.price;
    const basis = w(l);
    const punkte = x => {
      if (x.slug === l.slug) return -1;
      if (x.transactionType !== l.transactionType) return -1;
      if (!verfuegbarFrei(x)) return -1;
      let p = 0;
      if (x.propertyType === l.propertyType) p += 40; else return -1;
      if (x.canton === l.canton) p += 20;
      if (x.city === l.city) p += 15;
      const wx = w(x);
      if (basis && wx) { const ab = Math.abs(wx - basis) / basis; if (ab <= .35) p += Math.round(20 * (1 - ab / .35)); else return -1; }
      if (l.rooms && x.rooms) p += Math.max(0, 10 - Math.abs(x.rooms - l.rooms) * 4);
      if (l.livingArea && x.livingArea) p += Math.max(0, 10 - Math.abs(x.livingArea - l.livingArea) / 12);
      return p;
    };
    return alle().map(x => ({ x, p:punkte(x) })).filter(o => o.p > 0)
      .sort((a, b) => b.p - a.p || a.x.id.localeCompare(b.x.id)).slice(0, anzahl || 3).map(o => o.x);
  }
  /* Luftlinie in Kilometern (Haversine) — für die Umkreissuche */
  function distanzKm(a, b) {
    const R = 6371, r = Math.PI / 180;
    const dLa = (b.lat - a.lat) * r, dLo = (b.lng - a.lng) * r;
    const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  /* Mittelpunkt eines Ortsbegriffs aus den Inseraten dieses Ortes */
  function ortMitte(wert) {
    if (!wert) return null;
    let treffer;
    if (wert.startsWith("kt:")) treffer = alle().filter(l => l.canton === wert.slice(3));
    else if (wert.startsWith("rg:")) { const ks = (REGIONEN[wert.slice(3)] || { kantone:[] }).kantone; treffer = alle().filter(l => ks.includes(l.canton)); }
    else { const o = wert.toLowerCase(); treffer = alle().filter(l => l.city.toLowerCase() === o || l.postalCode.startsWith(o)); }
    if (!treffer.length) return null;
    return { lat: treffer.reduce((s, l) => s + l.lat, 0) / treffer.length, lng: treffer.reduce((s, l) => s + l.lng, 0) / treffer.length };
  }

  /* ---------- Filtern & Sortieren ---------- */
  const LEER = { trans:"buy", ort:"", umkreis:0, typ:"", pMin:null, pMax:null, ziMin:null, ziMax:null, flMin:null, flMax:null, grMin:null,
    bjVon:null, bjBis:null, etage:"", verf:"", nurFrei:true, feat:[], quelle:"", sort:"neu" };
  function filtern(f) {
    const q = Object.assign({}, LEER, f || {});
    let res = alle().filter(l => l.publicationStatus !== "archiviert" && l.transactionType === q.trans);
    if (q.nurFrei) res = res.filter(verfuegbarFrei);
    if (q.ort) {
      const mitte = q.umkreis > 0 ? ortMitte(q.ort) : null;
      if (mitte) res = res.filter(l => distanzKm(mitte, l) <= q.umkreis);
      else if (q.ort.startsWith("kt:")) { const kt = q.ort.slice(3); res = res.filter(l => l.canton === kt); }
      else if (q.ort.startsWith("rg:")) { const ks = (REGIONEN[q.ort.slice(3)] || { kantone:[] }).kantone; res = res.filter(l => ks.includes(l.canton)); }
      else { const o = q.ort.toLowerCase(); res = res.filter(l => l.city.toLowerCase() === o || l.postalCode.startsWith(o)); }
    }
    if (q.typ) res = res.filter(l => l.propertyType === q.typ);
    if (q.quelle) res = res.filter(l => q.quelle === "fourwalls" ? l.listingSource === "fourwalls" : l.listingSource === q.quelle);
    const w = l => l.transactionType === "rent" ? l.rentNet : l.price;
    if (q.pMin != null) res = res.filter(l => w(l) != null && w(l) >= q.pMin);
    if (q.pMax != null) res = res.filter(l => w(l) != null && w(l) <= q.pMax);
    if (q.ziMin != null) res = res.filter(l => l.rooms != null && l.rooms >= q.ziMin);
    if (q.ziMax != null) res = res.filter(l => l.rooms != null && l.rooms <= q.ziMax);
    if (q.flMin != null) res = res.filter(l => l.livingArea != null && l.livingArea >= q.flMin);
    if (q.flMax != null) res = res.filter(l => l.livingArea != null && l.livingArea <= q.flMax);
    if (q.grMin != null) res = res.filter(l => l.plotArea != null && l.plotArea >= q.grMin);
    if (q.bjVon != null) res = res.filter(l => l.yearBuilt != null && l.yearBuilt >= q.bjVon);
    if (q.bjBis != null) res = res.filter(l => l.yearBuilt != null && l.yearBuilt <= q.bjBis);
    if (q.etage) res = res.filter(l => { if (l.floor == null) return false;
      if (q.etage === "eg") return l.floor === 0;
      if (q.etage === "nichteg") return l.floor > 0;
      if (q.etage === "ab2") return l.floor >= 2;
      if (q.etage === "dach") return l.floor >= 6; return true; });
    if (q.verf) res = res.filter(l => { const a = (l.availability || {}).art;
      if (q.verf === "sofort") return a === "sofort";
      if (q.verf === "3mt") { if (a === "sofort") return true; if (a !== "datum") return false;
        return (new Date(l.availability.datum) - new Date()) / 86400000 <= 92; }
      return true; });
    for (const ft of q.feat) res = res.filter(l => l.features.includes(ft));
    return sortieren(res, q.sort);
  }
  function sortieren(arr, art) {
    const w = l => (l.transactionType === "rent" ? l.rentNet : l.price) ?? Infinity;
    const a = arr.slice();
    if (art === "preis-auf") a.sort((x, y) => w(x) - w(y));
    else if (art === "preis-ab") a.sort((x, y) => (w(y) === Infinity ? -1 : w(y)) - (w(x) === Infinity ? -1 : w(x)));
    else if (art === "flaeche") a.sort((x, y) => (y.livingArea || 0) - (x.livingArea || 0));
    else if (art === "zimmer") a.sort((x, y) => (y.rooms || 0) - (x.rooms || 0));
    else if (art === "m2") {
      const m = l => proM2(l) || Infinity;
      a.sort((x, y) => m(x) - m(y));
    }
    else if (art === "empfohlen") {
      /* Nachvollziehbar: vollständigere Inserate zuerst, danach das Datum.
         Kein bezahltes Ranking — Exclusive erhält keinen Bonus in dieser Sortierung. */
      const g = l => (l.bilder && l.bilder.length > 3 ? 3 : 0) + (l.livingArea ? 2 : 0) + (l.rooms != null ? 1 : 0) +
                     (l.yearBuilt ? 1 : 0) + ((l.features || []).length ? 1 : 0) + (l.verificationStatus === "verified" ? 2 : 0);
      a.sort((x, y) => g(y) - g(x) || y.publishedAt.localeCompare(x.publishedAt) || x.id.localeCompare(y.id));
    }
    else {
      a.sort((x, y) => y.publishedAt.localeCompare(x.publishedAt) || y.id.localeCompare(x.id));
      /* Höchstens drei Exclusive-Mandate oben, und nur bei «Neuste» — sichtbar begrenzt */
      const ex = a.filter(l => l.listingTier === "exclusive").slice(0, 3);
      return ex.concat(a.filter(l => !ex.includes(l)));
    }
    return a;
  }
  function aktiveFilterZahl(f) {
    const q = Object.assign({}, LEER, f || {});
    return [q.typ, q.pMin != null, q.pMax != null, q.ziMin != null, q.ziMax != null, q.flMin != null, q.flMax != null,
      q.grMin != null, q.bjVon != null, q.bjBis != null, q.etage, q.verf, q.quelle, q.umkreis > 0, !q.nurFrei].filter(Boolean).length + q.feat.length;
  }
  function ausURL() {
    const p = new URLSearchParams(location.search), f = {};
    if (p.get("trans")) f.trans = p.get("trans");
    if (p.get("ort")) f.ort = p.get("ort");
    if (p.get("typ")) f.typ = p.get("typ");
    if (p.get("quelle")) f.quelle = p.get("quelle");
    if (p.get("pmin")) f.pMin = +p.get("pmin");
    if (p.get("pmax")) f.pMax = +p.get("pmax");
    if (p.get("zi")) f.ziMin = +p.get("zi");
    if (p.get("fl")) f.flMin = +p.get("fl");
    if (p.get("flmax")) f.flMax = +p.get("flmax");
    if (p.get("zimax")) f.ziMax = +p.get("zimax");
    if (p.get("gr")) f.grMin = +p.get("gr");
    if (p.get("bjv")) f.bjVon = +p.get("bjv");
    if (p.get("bjb")) f.bjBis = +p.get("bjb");
    if (p.get("et")) f.etage = p.get("et");
    if (p.get("vf")) f.verf = p.get("vf");
    if (p.get("um")) f.umkreis = +p.get("um");
    if (p.get("alle") === "1") f.nurFrei = false;
    if (p.get("feat")) f.feat = p.get("feat").split(",").filter(Boolean);
    if (p.get("sort")) f.sort = p.get("sort");
    return f;
  }
  function inURL(f) {
    const p = new URLSearchParams(location.search);
    ["trans","ort","typ","quelle","pmin","pmax","zi","zimax","fl","flmax","gr","bjv","bjb","et","vf","um","alle","feat","sort"].forEach(k => p.delete(k));
    const q = Object.assign({}, LEER, f || {});
    if (q.trans !== "buy") p.set("trans", q.trans);
    if (q.ort) p.set("ort", q.ort); if (q.typ) p.set("typ", q.typ); if (q.quelle) p.set("quelle", q.quelle);
    if (q.pMin != null) p.set("pmin", q.pMin); if (q.pMax != null) p.set("pmax", q.pMax);
    if (q.ziMin != null) p.set("zi", q.ziMin); if (q.flMin != null) p.set("fl", q.flMin);
    if (q.flMax != null) p.set("flmax", q.flMax);
    if (q.ziMax != null) p.set("zimax", q.ziMax);
    if (q.grMin != null) p.set("gr", q.grMin);
    if (q.bjVon != null) p.set("bjv", q.bjVon);
    if (q.bjBis != null) p.set("bjb", q.bjBis);
    if (q.etage) p.set("et", q.etage);
    if (q.verf) p.set("vf", q.verf);
    if (q.umkreis > 0) p.set("um", q.umkreis);
    if (!q.nurFrei) p.set("alle", "1");
    if (q.feat.length) p.set("feat", q.feat.join(",")); if (q.sort !== "neu") p.set("sort", q.sort);
    const s = p.toString();
    history.replaceState(null, "", location.pathname + (s ? "?" + s : "") + location.hash);
  }
  /* Objekttyp- und Anbieter-Bezeichnungen: FWL.typen/FWL.quellen liefern nur
     die deutschen Schlüsselwerte (Rohdaten); die Übersetzung sitzt hier, an
     einer Stelle, statt an jeder Verwendung erneut. */
  const TYP_KEY = { wohnung:"w_typWohnung", haus:"w_typHaus", villa:"w_typVilla", chalet:"w_typChalet", mfh:"w_typMfh", gewerbe:"w_typGewerbe", grundstueck:"w_typGrundstueck", parkplatz:"w_typParkplatz" };
  const QUELLE_KEY = { fourwalls:"w_quellFourwalls", privat:"w_quellPrivat", agentur:"w_quellMakler", verwaltung:"w_quellVerwaltung", entwickler:"w_quellEntwickler" };
  const typLabel = k => TYP_KEY[k] ? t(TYP_KEY[k]) : (k || "");
  const quelleFilterLabel = k => QUELLE_KEY[k] ? t(QUELLE_KEY[k]) : (k || "");
  function beschreibeSuche(f) {
    const q = Object.assign({}, LEER, f || {});
    return [ortLabel(q.ort), q.trans === "rent" ? t("mieten") : t("kaufen"), q.typ ? typLabel(q.typ) : "",
      q.ziMin ? q.ziMin + "+ " + t("o_ziKurz") : "", q.pMax ? "≤ " + chf(q.pMax) : ""].filter(Boolean).join(" · ");
  }

  /* ---------- Persistenz (Prototyp: localStorage; Produktion: Konto-Backend) ---------- */
  const lsGet = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const favs = { alle:() => lsGet("fw-favoriten", []), hat:id => favs.alle().includes(id),
    kippen(id) { const a = favs.alle(); const i = a.indexOf(id); if (i >= 0) a.splice(i, 1); else a.push(id); lsSet("fw-favoriten", a); return i < 0; } };
  const suchen = { alle:() => lsGet("fw-suchabos", []),
    speichern(f, name, zustellung) { const a = suchen.alle(); a.push({ id:Date.now().toString(36), name, filter:f, erstellt:new Date().toISOString().slice(0, 10), zustellung: zustellung || null }); lsSet("fw-suchabos", a); },
    loeschen(id) { lsSet("fw-suchabos", suchen.alle().filter(s => s.id !== id)); } };
  const entwurf = { laden:() => lsGet("fw-inserat-entwurf", null), speichern:d => lsSet("fw-inserat-entwurf", d), verwerfen:() => lsSet("fw-inserat-entwurf", null),
    veroeffentlichte:() => lsGet("fw-inserate", []),
    veroeffentlichen(d) { const a = entwurf.veroeffentlichte(); a.push(Object.assign({}, d, { id:"MEIN-" + Date.now().toString(36), publiziert:new Date().toISOString().slice(0, 10), status:"In Prüfung" })); lsSet("fw-inserate", a); entwurf.verwerfen(); } };

  /* ---------- Karte: Projektion + Clustering (Prototyp-Renderer; Produktion: MapLibre) ---------- */
  const BOX = { latMin:45.7, latMax:47.95, lngMin:5.9, lngMax:10.6 };
  function projekt(lat, lng, w, h) {
    const kx = Math.cos(46.8 * Math.PI / 180), spanX = (BOX.lngMax - BOX.lngMin) * kx, spanY = BOX.latMax - BOX.latMin;
    const s = Math.min(w / spanX, h / spanY), ox = (w - spanX * s) / 2, oy = (h - spanY * s) / 2;
    return { x: ox + (lng - BOX.lngMin) * kx * s, y: oy + (BOX.latMax - lat) * s };
  }
  function cluster(items, w, h, radius, zoom, cx, cy) {
    const z = zoom || 1, grp = [];
    for (const l of items) {
      const p = projekt(l.lat, l.lng, w, h);
      const x = (p.x - (cx || w / 2)) * z + w / 2, y = (p.y - (cy || h / 2)) * z + h / 2;
      if (x < -40 || x > w + 40 || y < -40 || y > h + 40) continue;
      let ziel = null;
      for (const g of grp) { const dx = g.x - x, dy = g.y - y; if (dx * dx + dy * dy < radius * radius) { ziel = g; break; } }
      if (ziel) { const n = ziel.punkte.length; ziel.punkte.push({ l, x, y }); ziel.x = (ziel.x * n + x) / (n + 1); ziel.y = (ziel.y * n + y) / (n + 1); }
      else grp.push({ x, y, punkte:[{ l, x, y }] });
    }
    return grp;
  }

  /* ---------- Inserats-Wizard ---------- */
  const WIZARD_T = {
    de: ["Was möchten Sie inserieren?","Um welche Art Objekt handelt es sich?","Wo befindet sich das Objekt?","Die wichtigsten Fakten","Preisvorstellung","Titel und Beschreibung","Fotos","Wie erreichen Interessenten Sie?","Prüfen und veröffentlichen"],
    fr: ["Que souhaitez-vous publier ?","De quel type de bien s'agit-il ?","Où se situe le bien ?","Les faits essentiels","Prix souhaité","Titre et description","Photos","Comment les intéressés vous joignent-ils ?","Vérifier et publier"],
    it: ["Cosa desidera pubblicare?","Di che tipo di immobile si tratta?","Dove si trova l'immobile?","I dati principali","Prezzo desiderato","Titolo e descrizione","Foto","Come possono raggiungerla gli interessati?","Verificare e pubblicare"],
    en: ["What would you like to list?","What type of property is it?","Where is the property located?","The key facts","Asking price","Title and description","Photos","How can interested parties reach you?","Review and publish"]
  };
  const WIZARD_KEYS = ["absicht","typ","ort","fakten","preis","text","bilder","kontakt","pruefen"];
  const WIZARD = () => { const tt = WIZARD_T[LANG] || WIZARD_T.de; return WIZARD_KEYS.map((key, i) => ({ key, titel:tt[i] })); };
  const WIZ_FEHLER = {
    de: { trans:"Bitte wählen Sie Verkaufen oder Vermieten.", typ:"Bitte wählen Sie einen Objekttyp.", plz:"Vierstellige PLZ.", stadt:"Ort fehlt.",
      flaeche:"Fläche in m².", preis:"Preis angeben oder «auf Anfrage» wählen.", titel:"Mindestens 8 Zeichen.",
      beschreibung:"Mindestens 30 Zeichen — Lage und Zustand beschreiben.", name:"Name fehlt.", email:"Gültige E-Mail-Adresse." },
    fr: { trans:"Veuillez choisir Vendre ou Louer.", typ:"Veuillez choisir un type de bien.", plz:"NPA à quatre chiffres.", stadt:"Lieu manquant.",
      flaeche:"Surface en m².", preis:"Indiquez un prix ou choisissez « sur demande ».", titel:"8 caractères minimum.",
      beschreibung:"30 caractères minimum — décrivez la situation et l'état.", name:"Nom manquant.", email:"Adresse e-mail valide." },
    it: { trans:"Scegliere Vendere o Affittare.", typ:"Scegliere un tipo di immobile.", plz:"NPA di quattro cifre.", stadt:"Località mancante.",
      flaeche:"Superficie in m².", preis:"Indicare un prezzo o scegliere «su richiesta».", titel:"Almeno 8 caratteri.",
      beschreibung:"Almeno 30 caratteri — descrivere posizione e stato.", name:"Nome mancante.", email:"Indirizzo e-mail valido." },
    en: { trans:"Please choose Sell or Rent.", typ:"Please choose a property type.", plz:"Four-digit postcode.", stadt:"Place missing.",
      flaeche:"Area in m².", preis:"Enter a price or choose “on request”.", titel:"At least 8 characters.",
      beschreibung:"At least 30 characters — describe the location and condition.", name:"Name missing.", email:"Valid email address." }
  };
  function wizardPruefen(k, d) {
    const f = {}; d = d || {}; const m = WIZ_FEHLER[LANG] || WIZ_FEHLER.de;
    if (k === "absicht" && !d.trans) f.trans = m.trans;
    if (k === "typ" && !d.typ) f.typ = m.typ;
    if (k === "ort") { if (!d.plz || !/^\d{4}$/.test(d.plz)) f.plz = m.plz; if (!d.stadt) f.stadt = m.stadt; }
    if (k === "fakten" && d.typ !== "grundstueck" && d.typ !== "parkplatz" && (!d.flaeche || +d.flaeche < 8)) f.flaeche = m.flaeche;
    if (k === "preis" && !d.preisAufAnfrage && (!d.preis || +d.preis <= 0)) f.preis = m.preis;
    if (k === "text") { if (!d.titel || d.titel.length < 8) f.titel = m.titel; if (!d.beschreibung || d.beschreibung.length < 30) f.beschreibung = m.beschreibung; }
    if (k === "kontakt") { if (!d.name) f.name = m.name; if (!d.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) f.email = m.email; }
    return f;
  }
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
  const FEAT_T = {
    de:{ balcony:"Balkon", terrace:"Terrasse", garden:"Garten", parking:"Parkplatz", garage:"Garage", lift:"Lift", lakeview:"Seeblick", mountainview:"Bergsicht", fireplace:"Cheminée", parquet:"Parkett", floorheating:"Bodenheizung", minergie:"Minergie", cellar:"Keller", washtower:"Waschturm", pool:"Pool", sauna:"Sauna", evcharging:"E-Ladestation", concierge:"Concierge" },
    fr:{ balcony:"Balcon", terrace:"Terrasse", garden:"Jardin", parking:"Place de parc", garage:"Garage", lift:"Ascenseur", lakeview:"Vue sur le lac", mountainview:"Vue sur les montagnes", fireplace:"Cheminée", parquet:"Parquet", floorheating:"Chauffage au sol", minergie:"Minergie", cellar:"Cave", washtower:"Colonne de lavage", pool:"Piscine", sauna:"Sauna", evcharging:"Borne de recharge", concierge:"Conciergerie" },
    it:{ balcony:"Balcone", terrace:"Terrazza", garden:"Giardino", parking:"Posto auto", garage:"Garage", lift:"Ascensore", lakeview:"Vista lago", mountainview:"Vista montagna", fireplace:"Camino", parquet:"Parquet", floorheating:"Riscaldamento a pavimento", minergie:"Minergie", cellar:"Cantina", washtower:"Torre di lavaggio", pool:"Piscina", sauna:"Sauna", evcharging:"Colonnina di ricarica", concierge:"Portineria" },
    en:{ balcony:"Balcony", terrace:"Terrace", garden:"Garden", parking:"Parking space", garage:"Garage", lift:"Lift", lakeview:"Lake view", mountainview:"Mountain view", fireplace:"Fireplace", parquet:"Parquet flooring", floorheating:"Underfloor heating", minergie:"Minergie", cellar:"Cellar", washtower:"Washer-dryer tower", pool:"Pool", sauna:"Sauna", evcharging:"EV charging", concierge:"Concierge" }
  };
  const FEAT_DE = FEAT_T.de;
  const featLabel = k => (FEAT_T[LANG] || FEAT_T.de)[k] || k;
  const QUELLE = { fourwalls:"exclusive", privat:"privat", agentur:"makler", verwaltung:"verwaltung", entwickler:"bautraeger" };
  const quelleLabel = l => l.listingTier === "exclusive" ? t("exclusive") : t(QUELLE[l.listingSource] || "privat");

  return { I18N, sprache, t, get lang() { return LANG; }, alle, mandate, finde, pic, chf, preis, preisKurz, proM2,
    KANTON_NAME, REGIONEN, ortLabel, vorschlaege, filtern, sortieren, aktiveFilterZahl, ausURL, inURL, beschreibeSuche,
    favs, suchen, entwurf, projekt, cluster, WIZARD, wizardPruefen, esc, FEAT_DE, featLabel, typLabel, quelleFilterLabel, quelleLabel,
    verfuegbarLabel, verfuegbarFrei, etageLabel, hatEtage, trefferLabel, bildLabel, monatlichMoeglich, aehnliche, distanzKm, ortMitte };
})();
