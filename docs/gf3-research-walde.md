# GF3-Recherche: WALDE Immobilien (walde.ch)

Stand: 2026-09-02. Fokus: Informationsarchitektur, Botschafts-Disziplin, Premium-Positionierung.
Nicht Gegenstand: visueller Stil.

Methode: WebFetch der DE-Seiten, ergänzt durch curl-Download von `/` und `/listing`
(Suchseite ist JS-gerendert; Karten-Felder aus eingebettetem JSON und den JS-Bundles abgeleitet).
Nicht erreichbar (404): `/suchprofil`, `/ueber-uns`, `/kaufen` (leere Hülle), `/profile` (Login-Wand),
`/premiumimmobilien`, `/verkaufen/premiumimmobilien`, `/erfolgsgeschichten/neubau-referenzen`.
Premium-Objekte werden nur als Filter-Tag («Premiumimmobilie») und Kategoriekarte gefunden, ohne eigene Landingpage.

---

## 1. Navigationsbaum

Header (4 Einträge + Suche + Login/Merkliste + DE/EN):

- Immobilienwissen → `/content-hub`
- Immobilienbewertung → `/verkaufen/wohnimmobilien/online-marktwertschaetzung`
- Verkaufen → `/verkaufen`
  - Wohnimmobilien → `/verkaufen/wohnimmobilien`
  - Anlageimmobilien → `/verkaufen/anlageimmobilien`
  - Neubauprojekte → `/verkaufen/neubau`
  - Ferienimmobilien → `/ferienimmobilien/ferienimmobilie-verkaufen`
- Kaufen und mieten → `/listing` (eine einzige Suchseite für Kauf UND Miete, Umschalter im Suchfeld)

Burger-/Footer-Menü (3 Gruppen):

- Immobilienwelt: Immobilienwissen, Kaufen und mieten, Verkaufen, Erfolgsgeschichten (`/erfolgsgeschichten`)
- Über Walde: Das Unternehmen (`/unternehmen`), Unser Team (`/team`), Soziales Engagement, Karriere und Jobs
- Gut beraten: Telefon, E-Mail, Unsere Standorte (`/offices`, 11 Büros)
- Rechtliches: Impressum, Datenschutzerklärung. Social: Facebook, LinkedIn, Instagram.

Beobachtung: Vier Top-Level-Verben/Nomen, keine Mega-Menüs. «Verkaufen» steht vor «Kaufen» –
die Seite ist auf Mandatsgewinnung (Verkäufer) optimiert, nicht auf Portal-Traffic.

## 2. Homepage

Erster Viewport (Hero):

- H1: «Wir bringen Mensch und Immobilie zusammen»
- Suchleiste: Select «Kaufen | Mieten» + Feld «Ortschaft oder PLZ eingeben…» (Label «Wo suchen Sie?»)
- Ein primärer Button: «Verkaufen» bzw. Sektion «Ihre Immobilie mit Walde verkaufen»
- Kein Slider, kein Zahlenfeuerwerk, keine Objektkarussells im ersten Viewport.

Botschaften/CTAs auf der ganzen Homepage: rund 8 Sektionen, 1–2 CTAs pro Sektion,
meist «Jetzt entdecken», «Zur Registrierung», «Zum Kontaktformular».

Belegte Headlines/Claims (jeweils walde.ch, Homepage / Unterseite):

- «Wir bringen Mensch und Immobilie zusammen» (Homepage, H1)
- «Mensch und Immobilie zusammenbringen, das ist unsere Leidenschaft.» (Homepage, Vision)
- «Die neusten Immobilien direkt in Ihr Postfach» (Homepage, Newsletter)
- «Walde – Ihr Immobilienberater mit 40 Jahren Erfahrung» (/verkaufen, Subline)
- «Persönlich für Sie da.» (/team, Intro)

Textlänge: Hero = ein Satz. Sektionen = Headline + 1–3 Sätze + ein Link. Fliesstext bleibt unter ~50 Wörtern
pro Block; nur Firmen- und FAQ-Seiten werden länger.

Service-Sichtbarkeit: Dienstleistungen werden über fünf Objektkategorien (Wohn-, Anlage-, Neubau-,
Ferien-, Premiumimmobilien) angeboten, nicht über eine «Leistungen»-Seite. Bewertung hat einen eigenen
Nav-Punkt; Kaufen/Mieten ist ein Suchfeld, kein Marketingtext. Am Ende der Homepage ein Kontaktformular
«Kontaktieren Sie uns für einen unverbindlichen Beratungstermin» (Anrede, Vor-/Nachname, E-Mail, Telefon, Nachricht).

## 3. Objektpräsentation

Suchseite `/listing` (H1 «Immobilien», ca. 150 aktive Objekte im Datenstrom):

- Filter: Kaufen/Mieten, Ort/PLZ, Region(en), Objekttyp, Preis (Spanne, CHF), Zimmer, Wohnfläche,
  Objekteigenschaften (z. B. Aussicht, Seesicht, Pool, Familienfreundlich). Sortierung: «Neuste», «Preis/Grösse».
- Ansichten: «Listenansicht», «Karte einblenden/ausblenden». Zähler «Objekte total».
- Karte (Card) pro Objekt: Hero-Bild, Titel (redaktioneller Claim, z. B. «Exklusive Oase mit traumhaftem Garten»),
  PLZ + Ort, Objekttyp, Zimmer, Wohnfläche (m²), Preis mit Preistyp (Verkaufspreis / Verkaufsrichtpreis /
  Mietzins), Status-Tag «Reserviert»/«Verkauft», Kategorie-Tags (Neubau, Premiumimmobilie, Ferienimmobilie),
  Herz-Icon (Merkliste). Keine Broker-Namen, keine «Top-Angebot»-Badges, keine Preis-Storys auf der Karte.
- Kuratierte Sammlungen als Einstieg (EN-Homepage): «mit atemberaubender Aussicht», «für Familien»,
  «nahe am See», «mit Pool».

Detailseite (Beispiel L18.955 Würenlos; L18.149 Kilchberg), Abfolge von oben nach unten:

1. Titel, PLZ Ort, Referenz-Nr. (z. B. «L18.955»)
2. Galerie (9+ Bilder, Karussell)
3. Preisblock: «Verkaufspreis CHF 3'285'000» bzw. «Verkaufsrichtpreis CHF 4'490'000»; Nebenkosten/Parkplätze separat
4. Eckdaten als Label-Zeilen: Objekttyp, Baujahr, Etage, Zimmer, Wohnfläche (ca.), Grundstücksfläche, Bezugstermin («Nach Vereinbarung»)
5. Beschreibung: ca. 150–250 Wörter, 3 Absätze, sachlich-warm, ohne Superlativ-Stapel
6. Drei bebilderte Highlight-Blöcke (z. B. «Architektur», «Dachterrasse», «Seesicht»)
7. Ausstattungs-Checkliste (Kellerabteil, Lift, Tiefgarage, …)
8. Distanztabelle (Fahrzeit Auto/ÖV nach Zürich, Luzern, Bern)
9. Kontaktblock: Foto, Name, Funktion, Telefon, E-Mail der zuständigen Beraterin
10. CTAs: «Besichtigung terminieren», Merkliste (Login), Teilen (Link, E-Mail, WhatsApp, Social)
11. Kein «Ähnliche Objekte»-Block, kein Hypothekenrechner, keine Preis-Historie.

Verkaufsdokumentation als PDF («hasPdf») wird über den Berater/Anfrage bezogen, nicht frei verlinkt.

## 4. Bewertung und Verkauf

Bewertung (`/verkaufen/wohnimmobilien/online-marktwertschaetzung`):

- H1 «Immobilienbewertung mit unserem Online-Tool», Subline «Erfahren Sie den Wert Ihrer Immobilie in wenigen Minuten und kostenlos».
- Prozess nicht nummeriert, aber dreiteilig erzählt: Eckdaten eingeben → Vergleich mit regionalen Transaktionspreisen →
  PDF per E-Mail mit Preisspanne und 3-Jahres-Wertentwicklung. Danach zweiter Schritt: persönliche Einschätzung
  mit Besichtigung («kostenlos und unverbindlich»).
- Explizite Ehrlichkeit: «Unsere Online-Schätzung stellt nur einen groben Richtwert […] dar».
- Sektionen: Marktwertschätzung, So profitieren Sie, FAQs. Ergänzend `/marktcheck` (wie viele Käufer interessiert sind).

Verkauf (`/verkaufen`, `/verkaufen/wohnimmobilien`):

- H1 «Immobilien Verkaufen in der Schweiz: Ihr Immobilienmakler», Subline «40 Jahren Erfahrung».
- Sektionen: Warum Walde? → Online Marktwertschätzung → Immobilien verkaufen mit Walde → Expertise nach Objekttyp →
  Was unsere Kunden begeistert → FAQ → Kontakt.
- Prozess: ca. 9 Leistungsschritte als Fliesstext/Liste (Bewertung, Potenzial, Zielgruppe, Dokumentation,
  Besichtigungen, Verhandlung, Reporting, Abschluss bis Handänderung) – nicht als Stepper inszeniert.
- Wohnimmobilien-Seite argumentiert über Lebenssituationen (Erbschaft, Scheidung, Pensionierung), Checklisten, FAQ
  («Wie lange dauert der Verkauf?» → «3 bis 6 Monate vom Verkaufsauftrag bis zur Handänderung»).
- Ton: beratend, ruhig, «unverbindlich» wird konsequent wiederholt; Zahlen sparsam (40 Jahre, 70'000 Suchende, 3–6 Monate).

## 5. Suchprofil / Merkliste

- Angebot: «Persönliches Suchprofil» = Benachrichtigung bei passenden Objekten, teilweise «noch vor dem Vermarktungsstart».
  Zweites, leichteres Angebot: wöchentlicher Newsletter (nur Anrede, Name, E-Mail).
- Keine harte Account-Wand beim Suchen und Ansehen: Suche, Filter, Detailseiten, Kontakt und Besichtigungsanfrage
  sind komplett ohne Login nutzbar.
- Login (Azure B2C) erst für Merkliste («Bitte anmelden, um Merkliste zu erstellen») und zum Speichern des Suchprofils
  («Suchprofil speichern», «Suchprofil benennen», «Suchprofil bearbeiten»). Filter zuerst setzen, dann speichern –
  der Wert ist vor dem Login sichtbar.
- Suchprofil-Formular auf der Homepage nutzt nur Anrede, Vor-/Nachname, E-Mail.
- Stufenmodell: Newsletter (E-Mail) < Suchprofil (Kriterien) < Merkliste (Account). Personalisierung wird als Service
  beschrieben («Angebote direkt in Ihr Postfach»), nie als Feature-Liste.

## 6. Vertrauen und Beleg

- Unternehmen (`/unternehmen`): «Das Unternehmen: Wer wir sind, was wir tun». Sektionen: Mission, Werte
  (Engagement, Professionalität, Wertschätzung), Geschichte (1985, Familie Walde, «Von Generation zu Generation»),
  Walde in Zahlen, Netzwerk, Mehr über Walde.
- Zahlen: gegründet 1985, 11 Standorte, >80 Mitarbeitende, 12'000 vermittelte Objekte, 70'000 Suchprofile/Abonnenten,
  60'000 Dokumentationsbestellungen/Jahr, 70 % auf Empfehlung. Anlage-Team: 600 betreute Objekte, 50 Transaktionen/Jahr.
- Mitgliedschaften als Logoleiste: EREN, FIABCI, Maklerkammer/SMK, Leading Real Estate Companies of the World,
  FGP Swiss & Alps (Forbes Global Properties), Luxury Portfolio International.
- Team (`/team`): «Unser Team.» + ein Satz («mit Herz, empathisch, kompetent»). Ca. 100 Personen, gruppiert nach
  Standort/Abteilung; pro Person Foto, Name, Funktion, Telefon, E-Mail, LinkedIn. Keine Rankings, keine «Top-Makler».
- Standortseiten (`/office/…`): Adresse, Öffnungszeiten, Anreise, Team des Büros. Keine Verkaufsprosa.
- Erfolgsgeschichten (`/erfolgsgeschichten`): Hub mit drei Karten – «Verkaufserfolge» («aus über 8'000 verkauften
  Immobilien», gegliedert nach Region Zürich/Zentralschweiz/Baden/Anlage/Premium; Felder: Bild, Titel, Ort, Objekttyp,
  Berater), «Zufriedene Kunden» (60+ Testimonials: Foto, Name, Objekttyp + Ort wie «Kauf EFH, Esslingen», Link zum
  Volltext; keine Sterne-Ratings), «Neubau-Referenzen».
- Immobilienwissen (`/content-hub`): Blog, Ratgeber, Checklisten, Whitepaper, Marktberichte; Filter nach Thema/Format.

## 7. Übertragbare Prinzipien

1. Ein Satz im Hero, ein Suchfeld, ein Verkaufs-CTA – Premium heisst Reduktion der Entscheidungen im ersten Viewport.
2. Vier Top-Level-Navigationspunkte reichen; alles Weitere wandert ins Burger-/Footer-Menü, weil Übersicht Vertrauen schafft.
3. Kauf und Miete teilen eine Suchseite mit Umschalter – ein Inventar, ein Interface, kein doppelter Weg.
4. Objektkarten tragen nur Bild, Titel, Ort, Typ, Zimmer, Fläche, Preis, Status; alles andere gehört auf die Detailseite.
5. Preise werden ausgeschrieben («Verkaufspreis CHF 3'285'000»), nicht versteckt – Transparenz wirkt hochwertiger als «auf Anfrage».
6. Detailseiten folgen einer festen Abfolge (Fakten → Text → Highlights → Ausstattung → Distanz → Person) – Wiedererkennbarkeit statt Layout-Varianten.
7. Jede Detailseite endet bei einem Menschen mit Foto, Namen und Direktkontakt statt bei einem anonymen Formular.
8. Bewertung wird ehrlich als «grober Richtwert» beschrieben und führt in einen zweiten, persönlichen Schritt – Ehrlichkeit ist das Premium-Signal.
9. Personalisierung ist gestuft (Newsletter → Suchprofil → Merkliste) und der Login kommt erst nach dem sichtbaren Nutzen.
10. Proof wird kuratiert, nicht gestapelt: wenige Kennzahlen (Gründungsjahr, Objekte, Empfehlungsquote), Mitgliedschaften als Logos, Referenzen nach Region.
11. Der Prozess wird erzählt, nicht als 7-Schritte-Grafik inszeniert; Sicherheit entsteht durch FAQ mit konkreten Antworten («3 bis 6 Monate»).
12. Das Wort «unverbindlich» steht bei jedem Kontaktpunkt – Druckfreiheit ist Teil der Positionierung.
13. Premium wird als Tag und Netzwerk (Forbes, Luxury Portfolio) markiert, nicht als eigene Glamour-Welt – Zurückhaltung statt Luxus-Vokabular.

## 8. NICHT kopieren

- Wortmarke/Claim «Wir bringen Mensch und Immobilie zusammen» und alle Walde-Formulierungen wörtlich.
- Kategoriekarten-Raster der Homepage (5 Objektkategorien als Bildkacheln) in identischer Reihenfolge und Kachelform.
- Header-Suchleiste mit Select «Kaufen | Mieten» + Ortsfeld als 1:1-Nachbau (Muster ja, Komponente nein).
- Farbwelt, Typografie, Logo, Bildsprache (Fotograf-Credits in Dateinamen), Icon-Set, Karussell-Animationen.
- Die dreiteilige Highlight-Block-Gestaltung der Detailseite mit Bild links/rechts.
- Testimonial-Grid mit Kundenfotos und Namen (Datenschutz-/Rechtefrage; eigenes Format wählen).
- Newsletter-Pflichtblock am Seitenende jeder Seite und Social-Share-Leiste (WhatsApp/Twitter/Facebook) – wirkt portalhaft.
- Login via Azure B2C für Merkliste – Muster «Login erst bei Speichern» übernehmen, technische Lösung eigen.
- Bezeichnungen «Erfolgsgeschichten», «Immobilienwelt», «Gut beraten», «Haus der Immobilien».
