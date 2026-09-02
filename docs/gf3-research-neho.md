# GF3 Research: NEHO (neho.ch) – Informationsarchitektur

Stand: 2026-09-02. Fokus ausschliesslich IA (Struktur, Felder, Reihenfolge, CTAs) – kein visueller Stil.

## Untersuchte Seiten & Methode

| Seite | URL | Status |
|---|---|---|
| Startseite | https://neho.ch/de | gelesen |
| Suche/Liste (alle) | https://neho.ch/de/immobilien | gelesen |
| Liste Häuser Kt. ZH | https://neho.ch/de/zum-verkauf/haeuser/kanton/zuerich | gelesen |
| Liste Wohnungen Kt. ZH | https://neho.ch/de/zum-verkauf/wohnungen/kanton/zuerich | gelesen |
| Detail EFH Zürich 8057 | https://neho.ch/de/zum-verkauf/haeuser/kanton/zuerich/8057-zuerich-80 | gelesen |
| Detail DEFH Glattfelden | https://neho.ch/de/zum-verkauf/haeuser/kanton/zuerich/8192-glattfelden-91 | gelesen + Roh-HTML (curl) analysiert |
| Detail EFH Obfelden | https://neho.ch/de/zum-verkauf/haeuser/kanton/zuerich/8912-obfelden-109 | gelesen |
| Detail Attika Zollikon | https://neho.ch/de/zum-verkauf/wohnungen/kanton/zuerich/8702-zollikon-114 | gelesen |

Fehlgeschlagen: `/de/kaufen` und `/fr/acheter` liefern 404 (Kaufen-Einstieg ist `/de/immobilien`). URL-Schema der Objekte: `/de/zum-verkauf/{haeuser|wohnungen}/kanton/{kanton}/{PLZ}-{ort}-{id}`. Einschränkung: Werkzeuge sehen gerendertes HTML ohne Login; eingeloggte Zustände (Rundgang, Pläne, Dokumente) sind nur als Platzhalter beschrieben.

## 1. Objekt-Detailseite: Sequenz der Blöcke

Konsistent auf allen vier Objekten (Haus wie Wohnung). Seitenraster: linke Hauptspalte + rechte Sidebar (Desktop).

| # | Block | Inhalt / Felder | Zustand |
|---|---|---|---|
| 0 | Fixer Header mit Anker-Menü | `Übersicht · Merkmale · Hypotheken · Karte · Häufige Fragen · Einheiten · Dokumente · Ähnliche Immobilien` | fix (position-fixed), auf Mobile als horizontal scrollbare Chip-Leiste |
| 1 | Breadcrumb | Kanton › Bezirk › Gemeinde › Ort (PLZ) | – |
| 2 | Medien-Panel (Tabs) | `Bilder · Virtueller Rundgang · Broschüre · Grundrisse · Karte · Besonnungs-Simulation · Katasterkarte`; Bildzähler («45 Fotos»), Label «Virtuelles Staging» | Bilder offen; Rundgang/Broschüre/Grundrisse/Besonnung/Kataster zeigen Login-Platzhalter mit `Anmelden` / `Ein Konto erstellen` |
| 3 | Titel-Block (`#overview-section`) | H1 (z.B. «Zu verkaufen: 200 m²-Doppelhaushälfte in Glattfelden»), `Inserat Nr. 8192-26-3`, Status-Badge (`Exklusiv bei Neho`, `Neho Privilege`, `Neu`, `Reserviert`) | offen |
| 4 | Eckdaten-Zeile | Ort (`8192 Glattfelden, Zürich`), `Verkaufspreis` (mit Währungswahl), `Wohnfläche`/`Nettowohnfläche`, `Terrasse` (Wohnung), `Zimmer`, `Badezimmer`, `Baujahr` oder `Letzte Renovation`, `Verfügbarkeit` (Sofort / Nach Absprache), `Inklusive: 1 Garagenplatz` | offen; nicht vorhandene Felder werden weggelassen, nicht mit «–» gefüllt |
| 5 | Finanzierungs-Teaser | «Ab CHF 516 / Monat», Link `Zinssätze ansehen`, Partnerlogo Strike | offen |
| 6 | Beschreibung | Fliesstext | eingeklappt, `Mehr sehen` / `Weniger sehen` |
| 7 | Highlights | Bullet-Liste (bis ~20 Punkte) + Tag-Chips («Garten», «Ruhige Lage», «Treppenlift»…), Link `Details ansehen` | offen |
| 8 | Merkmale (`#features-section`) | siehe Abschnitt 2 | Gruppen aufklappbar; nur gefüllte Felder erscheinen (kein «–» im Markup) |
| 9 | Finanzierung (`#finance-section`, Titel «Finanzierung dieser Immobilie») | a) «Benötigtes Einkommen und Eigenkapital für den Kauf»: `Benötigtes jährliches Haushaltseinkommen` (maskiert `CHF *******` + `Anzeigen`), `Benötigtes Eigenkapital` («davon müssen … aus Ihren Ersparnissen stammen»), `Kaufpreis total`, `Nebenkosten ab 0.15% – Zürich`, Regler `Hypothek 80% / Eigenmittel 20%`, Link `Tragbarkeit prüfen`. b) «Wie viel kostet diese Immobilie pro Monat?»: Zinsart `SARON / Fest 7 Jahre / Fest 10 Jahre / Benutzerdefiniert`, Zinssatz-Feld, Toggle `Mit Amortisation`, Ausgabe `Theoretische monatliche Gesamtkosten` = `Zinsen + Gebühren & Wartung + Amortisation + Baurechtszins + Verwaltungskosten`. c) CTA-Box «Sind Sie an dieser Immobilie interessiert?» → `Finanzierungsbestätigung erhalten`. d) Strike-Zinsband «1.42 % – 2.16 %» + Beraterkontakt | offen, Werte teils maskiert bis Klick |
| 10 | GEAK | Skala «Sehr energieeffizient … Wenig energieeffizient», Link «Lesen Sie unseren Artikel» | offen; ohne GEAK-Wert bleibt Skala ohne Marker |
| 11 | Die Nachbarschaft / Karte (`#map-section`) | Ort, Link `Genaue Adresse anzeigen` (nur nach Login/Besichtigung), `Auf der Karte anzeigen`, Lage-Fliesstext, Distanzen (Bus, Laden, Bank, Kita, Schule, Spielplatz), Geo-Breadcrumb, Karte | offen |
| 12 | Einheiten (`#units-section`) | Anker vorhanden, Sektion im HTML der Häuser nicht gerendert (relevant für Neubau/MFH) | Anker bleibt als toter Link stehen |
| 13 | Dokumente (`#documents-section`) | Checkbox `Alle auswählen`, `(0) Dokumente herunterladen`, Liste sofort: `Strike Finanzanalyse der Immobilie`, `Katasterplan ÖREB`, `Nebenkosten`; «verfügbar nach der Besichtigung»: `Aktueller Grundbuchauszug`, `Architekturpläne`, `Detaillierte Liste aller Renovationen`, `Elektrische NIV Inspektion`, `Gebäudeversicherungspolice (mit Kubaturinfo)`, `Katasterplan`; Wohnung zusätzlich Jahresrechnungen/Budgets 2023–2025, Protokolle, `Regulationen Stockwerkeigentum` | offen; fehlende Dokumente explizit als «Nicht hochgeladen» markiert |
| 14 | Häufige Fragen (`#faq-section`) | 4 identische Prozess-Fragen (Rundgang vor Besichtigung, Bonitätsprüfung, Verkäufer führt Besichtigung, «Was sind die nächsten Schritte?» mit 8-Schritte-Liste) | Akkordeon, eingeklappt |
| 15 | Ähnliche Immobilien (`#similar-properties-section`) | Karten wie in der Liste (Preis, Ort, Zimmer, Bad, m², Parkplatz, Makler) | nur gerendert, wenn Treffer |
| 16 | «Zu Ihrer Verfügung» / «Kontaktieren Sie Ihr Team vor Ort» | Makler + Assistenz, Telefon maskiert `+41435*** **` + `Anzeigen`, `Kontakt anfragen` | offen (Wiederholung des Sidebar-Blocks) |
| 17 | Verkäufer-Cross-Sell | «Verkaufen Sie Ihre Immobilie zum besten Preis» → `Immobilie kostenlos bewerten` | offen |
| 18 | Registrieren-Block | `Detaillierte Inserate · Zugang vor anderen Käufern · Personalisierte Suchabos`; E-Mail/SwissID/Google/Apple/Facebook | offen |
| 19 | Begriffs-Glossar | «Was bedeuten unsere Begriffe?» – erklärt alle Status-Badges | Modal/Akkordeon |
| 20 | Footer | siehe 5. | – |

Umgang mit fehlenden Daten: Felder/Zeilen werden ausgeblendet statt mit Platzhalter gezeigt; einzig Dokumente («Nicht hochgeladen») und Preis («Auf Anfrage») nennen das Fehlen explizit. Versteckt im DOM liegt ein Modal «Details of PPE expenses» mit Dummy-Nebenkosten (englische Labels, CHF 1'602) – Template-Rest, nicht produktiv.

## 2. Merkmale: tatsächliche Labels

**Allgemein:** Grundstückfläche · Wohnfläche · Nettowohnfläche · Terrasse · Garten · Bastelraumfläche · Waschraumbereich · Kubatur («814 m³ (Gebäudeversicherung)») · Garagenplatz/Garagenplätze · Parkplatz · Zimmer · Schlafzimmer · Etage (Wohnung) · Etagen (Haus) · Raumhöhe · Badezimmer · Ausstattung der Badezimmer (Dusche, Wanne) · Art des Bodenbelags (Fliesen, Laminat, Teppich, Kunststoff) · Art der Küche (Separate / Halboffene / Geschlossene Küche) · Qualität der Ausstattung (Normal) · Gästetoilette · Ausrichtung (Süden, Südwest) · Höhe (m ü. M.)

**Gebäude:** Baujahr · Zustand der Immobilie (Gut gepflegt, Modernisiert, Renovationsbedürftig) · Art der Bauweise (Massivbauweise) · Typ des Daches (Schrägdach) · Aussicht (Freie Aussicht) · Verglasungsart (Doppel-/Dreifachverglasung) · Fensterrahmen (Holz) · Wohnungen im Gebäude · Tiefgarage · Aufzug

**Ausstattung (Tag-Gruppen):** Haushaltsgeräte (Backofen/Steamer, Kühlschrank, Ceran-/Induktionskochfeld, Geschirrspüler, Tumbler, Waschmaschine, Wärmeschublade) · Verarbeitungsqualität (Granitabdeckung, Hochwertige Bodenbeläge, Massivbau, Dreifachverglasung) · Ort/Raum (Garderobe, Keller, Naturkeller, Hobbyraum mit Tageslicht, Begehbare Dusche, Besucher-WC, Direkter Zugang zur Garage) · Haustechnik (Cheminée, Aufzug direkt in die Wohnung) · Heizung (Bodenheizung, Wärmepumpe mit Erdsonde) · Anderes

**Aussenbereich:** Grosszügiger Aussenbereich · Überdachte Terrasse · Garten · Haustiere · Cheminée · Aussicht

**Parken:** Aussenstellplatz · Garage mit direktem Zugang zum Haus · Tiefgarage

**Mikro-Lage (Tags):** Ruhiges, familienfreundliches Quartier · In ruhiger Sackgasse · Aussicht ins Grüne

**Energie:** Heizungssystem (Fernwärme, Heizkessel, Sole/Wasser-Wärmepumpe) · Hauptenergiequelle(n) (Heizöl, Erdwärme) · Wärmeverteilung (Radiatoren, Fussbodenheizung) · PV-Anlage · GEAK-Skala

**Finanzielles:** Verkaufspreis (oder «Auf Anfrage») · Kaufpreis total · Nebenkosten (Kaufnebenkosten in % je Kanton) · Hypothek/Eigenmittel-Split · Benötigtes jährliches Haushaltseinkommen · Benötigtes Eigenkapital · Theoretische monatliche Gesamtkosten (Zinsen, Gebühren & Wartung, Amortisation, Baurechtszins, Verwaltungskosten) · Zinsband Strike · Wohnung: Nebenkosten-Aufstellung, Jahresrechnungen STWE

## 3. Kontakt-, Besichtigungs- und Next-Step-CTAs

- **Sticky Sidebar (Desktop, `position-sticky`):** Ort + `Genaue Adresse anzeigen`, Preis, Makler-Duo («Sven Neeser, unterstützt von Vanessa Neidhart»), Telefon maskiert + `Anzeigen` bzw. «Nur Kontaktformular», Nachfrage-Hinweis («Durch die hohe Nachfrage … Warteliste»), Button-Stapel: `Rundgang ansehen` → `Besichtigung planen` → `Angebot unterbreiten`; je nach Objekt zusätzlich `Für die Open-House Besichtigung anmelden`, `Zu meinen Prozessen`, `Rückgängig machen`.
- **Prozess-Logik, nicht nur Buttons:** Reihenfolge ist erzwungen (Rundgang ansehen → Besichtigung planen → Angebot). FAQ erklärt warum; Schritt-Block «Interessiert Sie diese Immobilie?» wiederholt die Stufen (`Siehe Virtueller Rundgang`, `Eine Besichtigung planen`, `Ein Angebot machen`, `Besichtigung vor Ort anfragen`) plus Gegen-CTA «Diese Immobilie archivieren».
- **Wiederholungen:** Maklerblock 3× (Sidebar, nach FAQ, «Zu Ihrer Verfügung»); Finanzierungs-CTA 2× (Teaser oben, Box im Finanzblock).
- **Mobile:** kein separater fixer Kontakt-Balken gefunden; Sidebar-Inhalte fliessen inline. Ein fixer Bottom-Banner existiert, bewirbt aber den *Verkauf* («Möchten Sie Ihre Immobilie verkaufen?» → `Immobilie verkaufen`).
- **Login als Gate:** Rundgang, Grundrisse, Broschüre, Besonnung, Kataster, genaue Adresse, Dokumente, Einkommens-Kennzahl, Telefonnummer – alles hinter `Anmelden`/`Ein Konto erstellen`.

## 4. Suchresultate: Objektkarte

Reihenfolge der Felder: Bild (+Badge) → Preis `CHF 1'190'000` → Ort `8192 Glattfelden` → Hinweis «Genaue Adresse nach Anmeldung angezeigt» → `6.5 Zimmer` · `2 Badezimmer` · `200 m2` · `1 Parkplatz` → Makler-Avatare + Namen → Badge (`Exklusiv bei Neho`, `Neu` = erste 15 Tage, `Neho Privilege`, `Reserviert`, `Mit Neho verkauft`). Kein Objekttyp-Label, kein Baujahr, kein Preis/m² auf der Karte.

Listen-Rahmen: Trefferzahl («883 Immobilien»), Umschalter `Liste | Karte` (Karte mit Zeichnen-Funktion, `Kartenausschnitt zurücksetzen`), `Sortieren nach` (neu/alt, Preis auf/ab, Preis pro m² auf/ab), Seitenzahlen-Pagination. Filter: `Immobilientyp` (Wohnung, Haus, Grundstück, Renditeliegenschaft, Geschäftsgebäude, Parken) · `Preis` · `Zimmer` · `Fläche` · `Grundstücksfläche` · `Preis / m2` · `Anzahl Schlafzimmer` · `Badezimmer` · `Parkplatz` (mit Garage-Pflicht) · `Baujahr` / `Nur Neubauten` · `Wichtigste Ausstattungen` (Aussenbereich, Aussicht, Keller, Rollstuhlgängig, Kabel-TV, Haustiere erlaubt, Klimatisierung, Cheminée, Aufzug) · `Stockwerke – Häuser/Wohnungen` · `Standort` (Max. Distanz zu Schulen / öV, Reisezeit-Suche) · `Details zur Veröffentlichung` (nur mit Rundgang, nur Privilege) · `Objektstatus` (Zu verkaufen, Reservierte, Mit Neho verkauft). Unter den Treffern: m²-Preisstatistik der Region (Ø, Median), SEO-Text, Suchabo-CTA, Bezirks-Links je Objekttyp, Registrieren-Block.

## 5. Startseite: Navigation & Service-Gruppen

Top-Navigation: `Startseite` · `Verkaufen` (Angebot, Erfahrungsberichte, Bewertung meiner Immobilie, Immobilienpreise pro m2, Grundstückgewinnsteuer berechnen, Haus/Wohnung, Renditeobjekt, Grundstück, Neubauprojekt) · `Kaufen` (Immobilien, Neubauprojekte, Unsere Dienstleistungen, Kundenvorteile, Finanzierung, Tragbarkeit prüfen, Finanzierungsbestätigung) · `Immobilien` · `Neubauprojekte` · `Ratgeber` (Blog, Immobilienlexikon, Hausrenovation) · `Über uns` · `Kontaktieren Sie uns` · Login/Registrieren · Sprache DE/FR/EN + Währung.

Seitenablauf: Hero «Ihr Immobilienverkauf zum besten Preis» mit Bewertungs-Widget (Haus/Wohnung/Gebäude/Grundstück) → Trust (Trustpilot 4.5 / Google 4.4) → Testimonials → Vorteile → Regionalteam → 3-Schritte-Verkaufsprozess → Sparrechner → FAQ → Standorte nach Kanton (Tabs Romandie/Deutschschweiz). Footer-Gruppen: `Verkaufen` · `Kaufen` · `Firma` · `Hilfe` · Legal. Befund: Die Startseite ist eine Verkäufer-Landingpage; Käufer werden über `Immobilien` direkt in die Suche geleitet.

## 6. Übertragbare Prinzipien (IA, nicht visuell)

1. **Ein Anker-Menü mit 6–8 festen Stationen im fixen Header** – Nutzer orientieren sich in langen Objektseiten ohne Scroll-Suche; die Reihenfolge ist auf jedem Objekt identisch und damit lernbar.
2. **Eckdaten-Zeile direkt unter dem Titel mit maximal 8 Feldern** – beantwortet Preis/Fläche/Zimmer/Bad/Baujahr/Verfügbarkeit/Parkplatz in einer Sekunde, bevor die Beschreibung beginnt.
3. **Fehlende Felder ausblenden statt «–» zeigen** – Tabellen bleiben kurz und glaubwürdig; nur erwartbare Pflichtinhalte (Dokumente) tragen ein explizites «Nicht hochgeladen».
4. **Merkmale in feste Gruppen mit stabilen Labels** (Allgemein, Gebäude, Ausstattung, Aussenbereich, Parken, Energie) – Käufer vergleichen Objekte, weil Felder immer am selben Ort stehen.
5. **Monatliche Kosten statt nur Kaufpreis** – Tragbarkeitsrechner mit Zinsart/Amortisation direkt auf dem Objekt macht die Entscheidung «kann ich mir das leisten?» ohne Seitenwechsel möglich.
6. **CTAs als geführte Sequenz** (Rundgang → Besichtigung → Angebot) und nicht als gleichwertige Buttons – reduziert unqualifizierte Anfragen, und die FAQ erklärt den Grund an Ort.
7. **Kontaktblock in sticky Sidebar plus 2 Wiederholungen im Fluss** – die Handlung ist an jedem Scrollpunkt erreichbar, ohne separates Overlay.
8. **Dokumente als zweistufige Liste (sofort / nach Besichtigung)** – Transparenz über *was existiert*, auch wenn es noch gesperrt ist; das schafft Vertrauen und einen Anreiz zum nächsten Schritt.
9. **Adresse und Kontaktdaten progressiv freigeben** (PLZ/Ort offen, genaue Adresse nach Login) – schützt Verkäufer und wandelt Interesse in Registrierung.
10. **Status-Vokabular explizit dokumentieren** (Neu, Reserviert, Sistiert, Mit Neho verkauft …) mit Glossar auf der Seite – vermeidet Interpretationsfragen.
11. **Listenkarte auf 4 Kennzahlen + Preis + Ort + Makler beschränken** – schnelle Scanbarkeit; Details gehören auf die Objektseite.
12. **Objekt-URLs semantisch** (`/zum-verkauf/haeuser/kanton/zuerich/8192-glattfelden-91`) mit Geo-Breadcrumb – SEO und Orientierung zugleich, und die Liste je Gemeinde/Bezirk ist automatisch verlinkt.

## 7. NICHT kopieren

- Violettes Brand-Farbsystem (`neho-brand-purple`), Logo-«N», Button- und Badge-Formen.
- Wording «Exklusiv bei Neho», «Neho Privilege», «Mit Neho verkauft» – markenspezifische Statusnamen.
- Partner-Integration Strike (Zinsband, Finanzanalyse-PDF, Zertifikats-Grafik) – fremde Marke.
- Fixer Bottom-Banner für Verkäufer-Akquise auf Käuferseiten (Cross-Sell stört den Kaufflow).
- Login-Gate für Grundrisse/Broschüre – für Fourwalls ist Offenheit ein Differenzierungsmerkmal, nicht die Registrierungs-Hürde.
- Tote Anker (`Einheiten`, `Ähnliche Immobilien` ohne Ziel) und Template-Reste wie das englische «Details of PPE expenses»-Modal.
- Trustpilot/Google-Sterne-Widgets, Testimonial-Karussell, kantonale Telefonlisten im Footer.
- Bild-Alt-Texte mit maschinellen Beschreibungen («außenansicht mit woods view»).
