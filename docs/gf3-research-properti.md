# GF3-Research: PROPERTI (properti.com) – Informationsarchitektur

Stand: 2026-09-02. Fokus: IA, Auffindbarkeit von Services, Zurückhaltung. Kein visuelles Styling.

## Methodik / Zugriff

- `properti.ch` → 301 auf `properti.com/` (DE-Version unter `/ch/de/`, zusätzlich `/ch/fr/`, `/ch/it/`, `/ch/en/`).
- WebFetch und curl liefern auf allen properti.com-URLs **HTTP 403 (Cloudflare)**. Alle Inhalte wurden deshalb über den Browser-Pane (DOM-Auslesung per JavaScript, `innerText` + Link-Dump) erhoben.
- Nicht verifizierbar: das erweiterte Filter-Panel der Suche (Klick auf «Filter» hat im versteckten Pane keine neuen Inhalte gerendert). `properti.com/sitemap.xml` ebenfalls 403; stattdessen HTML-Sitemap `/ch/de/sitemap` gelesen.
- Gelesene Seiten: Homepage, `/eigentuemer/`, `/immobilien/verkaufen/`, `/immobilien/vermieten/`, `/immobilienbewertung/`, `calc.properti.com/de/immobilienbewertung`, `/insights/rechner/`, `/insights/checklisten/`, `/immobilie` (Suche), `/immobilie/kaufen/alle/` (Resultate), eine Inserat-Detailseite, `/immobilien/exclusives/`, `/neubau/`, `/anlageimmobilien/`, `/suchabo/`, `/tippgeber/`, `/immobilienpreise-schweiz`, `/immobilienmakler-finden/`, `/immobilienberatung/`, `/insights/`, `/insights/publications/`, `/sitemap`.

## 1. Vollständiger Navigationsbaum

### 1a. Header (Primärnavigation) – bewusst minimal: 4 Einträge + Login

| Label | Ziel | Bemerkung |
|---|---|---|
| Eigentümer | `/ch/de/eigentuemer/` | Hub-Seite für Verkaufen/Vermieten/Bewerten |
| Immobilienpreise | `/ch/de/immobilienpreise-schweiz` | Datenportal (Preis/m² pro Kanton/Gemeinde) |
| Immobilienmakler | `/ch/de/immobilienmakler-finden/` | Expertensuche |
| Kundenstimmen | `/ch/de/erfahrungen/` | Social Proof |
| Anmelden | `/ch/de/immobilie?login=true` | Kundenportal (Favoriten, Suchabo) |
| Sprache DE/FR/IT/EN | `/ch/{lang}/` | |

Keine Dropdowns, keine Mega-Menüs. Suche, Kaufen, Mieten, Exclusives, Neubau, Investment sind **nicht** im Header – sie sind über Hero-CTAs, Hub-Seiten und den Footer erreichbar.

### 1b. Hero-CTAs der Homepage (faktisch die «zweite Navigation»)

- **Bewerten** → `calc.properti.com/de/immobilienbewertung` (externes Tool)
- **Suchen** → `/ch/de/immobilie`
- **Verkaufen** → `/ch/de/immobilien/verkaufen/`

### 1c. Footer (vollständiger Ökosystem-Baum, 4 Gruppen)

**Immobilien**
- Kaufen und Mieten → `/ch/de/immobilie`
- Immobilienpreise → `/ch/de/immobilienpreise-schweiz`
- Verkaufen → `/ch/de/immobilien/verkaufen/`
- Vermieten → `/ch/de/immobilien/vermieten/`
- Exclusives → `/ch/de/immobilien/exclusives/`
- Neubau → `/ch/de/immobilien/neubau/`
- Investment Management → `/ch/de/immobilien/anlageimmobilien/`
- Tippgeber → `/ch/de/immobilien/tippgeber/`
- Suchabo → `/ch/de/immobilien/suchabo/`

**Immobilienmakler**
- Experten finden → `/ch/de/immobilienmakler-finden/`
- Immobilienmakler werden → `life.properti.com/de/` (separate Recruiting-Site)

**Unternehmen**
- Über uns, Nachhaltigkeit, Kultur (life.properti.com), Kontakt, Presse (`/insights/presse/`), Karriere, Partnerprogramm (`/partner/`), Standorte (`/immobilienmakler-standorte/`), Investor Relations

**Insights**
- Online-Rechner → `/ch/de/insights/rechner/`
- Checklisten → `/ch/de/insights/checklisten/`
- Blog & News → `/ch/de/insights/`
- Publikationen → `/ch/de/insights/publications/`

**Weitere Footer-Elemente:** Telefon, E-Mail, Google-Rating (4.5 | 1625) + Trustpilot (4.6 | 1144), Standortliste (Aarau, Basel, Bern, Burgdorf, Luzern, Lugano, Muttenz, Solothurn, St. Gallen, Zug, Zürich → Kantonsseiten `/immobilienmakler/{kanton}/`), Social, Sitemap, Rechtliches, Cookie-Präferenzen, Newsletter.

### 1d. Weitere Seiten ausserhalb Header/Footer (nur intern verlinkt)

- `/ch/de/immobilienbewertung/` (Landingpage Bewertung, verlinkt aus Eigentümer-Hub, Rechner-Übersicht, Suchresultaten)
- `/ch/de/mietzinsrechner/`, `/ch/de/grundstueckgewinnsteuerrechner/`
- `/ch/de/immobilienberatung/` («Kostenlose Beratung buchen»)
- `/ch/de/immobilien/haus-verkaufen/`, `/wohnung-verkaufen/` (SEO-Longtail)
- Lebensphasen-Unterseiten (Erbschaft, Verkleinerung, Jobwechsel, Ruhestand, Trennung, Zinsdruck) aus `/verkaufen/`
- SEO-Landingpages: «Haus/Wohnung kaufen/mieten im Kanton X» (je 10 Kantone auf der Homepage, alle 26 auf der Suchseite)

## 2. Wie die Homepage das Ökosystem exponiert

**Erster Viewport:** Claim «Next-Gen Real Estate Agent / Immobilien neu gedacht.» + genau **drei** gleichwertige CTAs: *Bewerten · Suchen · Verkaufen*. Header mit 4 Textlinks + Login. Keine Suchmaske im Hero (Suche ist ein Klick entfernt). Das ist die maximale Reduktion: 3 Absichten, 3 Wege.

**Reihenfolge der Sektionen (jede mit genau einem CTA):**
1. Immobilienmarkt: 8 Objektkarten (Preis, Zimmer, Typ, Ort, «Entdecken») → «Alle Immobilien anzeigen»
2. Immobilie verkaufen: Text + 4-Schritte-Prozess (siehe §4) → «Mehr erfahren»
3. Vergleich properti vs. klassischer Makler (5 Kriterien-Tabelle) → «Jetzt Immobilie bewerten»
4. In den Medien (Logos)
5. Kontakt-Teaser mit zwei Expertennamen + Telefon → «Jetzt kontaktieren»
6. Über uns + 4 Zahlen (Transaktionen, Portale, Expert:innen, Partner) → «Mehr erfahren»
7. Immobilienwissen: 9 Insight-Teaser (nur Titel + «Mehr lesen») → «Alle Insights anzeigen»
8. SEO-Blöcke «Immobilien zum Kauf/zur Miete suchen» (je 20 Kantonslinks)
9. Kontaktleiste + Footer (vollständiges Ökosystem)

**Gruppierungslogik:** Oben Absicht (Bewerten/Suchen/Verkaufen), Mitte Beweis (Angebot, Prozess, Vergleich, Presse, Zahlen), unten Wissen, ganz unten Vollständigkeit (Footer). Sekundäre Services (Exclusives, Neubau, Investment, Tippgeber, Suchabo, Vermieten) tauchen auf der Homepage **gar nicht** auf – nur im Footer. Die Hub-Seite `/eigentuemer/` übernimmt die Rolle des «Service-Menüs» für Eigentümer: «Ja, ich möchte verkaufen / Ja, ich möchte vermieten / Beratung vereinbaren», dann Vergleichstabelle, Preisportal-Teaser, zwei Rechner, Expertensuche, 4 Insights, 3 Checklisten, 6 FAQ.

**Anzahl gleichzeitiger Wahlmöglichkeiten:** Hero 3, Header 4, Hub 3, Footer 9+2+9+4. Nie mehr als ~4 Optionen pro Sektion oberhalb des Footers.

## 3. Tools, Rechner, Checklisten

### Rechner (Übersichtsseite `/insights/rechner/` – 3 Karten, je «Einfach · Kostenlos · Bewährt» + «Jetzt berechnen»)

| Tool | Ort | Einführung |
|---|---|---|
| Marktwertrechner / Immobilienbewertung | Landingpage `/immobilienbewertung/`, Tool auf `calc.properti.com` (Schritt 1: Adresse, Fortschrittsanzeige «5% abgeschlossen») | Hero-CTA Homepage, Hub, Vergleichstabelle, Suchresultate (Inline-Karte nach 4 Treffern), Preisportal, Detailseite |
| Mietzinsrechner | `/mietzinsrechner/` | Hub, Vermieten-Seite («Kostenlos Mietzins berechnen» als Hero-CTA), Rechner-Übersicht, «Weitere Tools» auf Bewertungsseite |
| Grundstückgewinnsteuer-Rechner | `/grundstueckgewinnsteuerrechner/` | nur Rechner-Übersicht + Blogartikel |
| Hypothekenrechner | **inline** auf jeder Inserat-Detailseite (Kaufpreis, Eigenmittel, Einkommen → Belehnung/Belastung) | im Abschnitt «Konditionen», mit Haftungsausschluss |
| Tippgeber-Provisionsrechner | inline auf `/tippgeber/` (Slider Immobilienwert → Provision) | einzige Sektion der Seite |
| Immobilienpreis-Portal | `/immobilienpreise-schweiz` (Karte + Tabellen Preis/m² Kaufen/Mieten, Kanton/Gemeinde, Suchfeld) | Header-Eintrag, Hub-Teaser «Kennen Sie das Immobilien-Preis Portal?» |
| Suchabo | `/immobilien/suchabo/` + auf Suchseite | siehe §5 |
| 3D-Sonnenlichtsimulation, Street View, 360°-Tour, Grundriss | inline Detailseite | als Tabs/Karten |

### Checklisten (`/insights/checklisten/`, 4 Sprungmarken-Tabs, jede Karte = Titel + 1 Satz + «Jetzt herunterladen» → eigene Unterseite mit Lead-Formular)

- **Für Verkäufer (10):** properti Guide Immobilienverkauf, Immobilienverkauf, Immobilieninserat, Maklersuche, Standortbestimmung (renovieren oder verkaufen), ESG, Leitzinsänderung, Vorlage STWE-Protokoll, Immobilie vererben, Verkauf Mehrfamilienhaus, Guide Eigenmietwert-Abschaffung 2029
- **Für Vermieter (7):** Vermietung, Immobilieninserat, Maklersuche, Vorlage Untermietvertrag, Vorlage Wohnungsübergabeprotokoll, Mietzinsänderung, Immobilie im Ruhestand
- **Für Käufer (5):** Maklersuche, Immobilienkauf, Fehler beim Immobilienkauf vermeiden, Immobilienbesichtigung, Ferienimmobilie
- **Für Mieter (4):** Mietimmobilien, Maklersuche, Umzug, Immobilienbesichtigung

Kontextuelle Platzierung: Verkaufen-Seite zeigt genau 3 (Guide, Verkauf, Inserat), Vermieten-Seite genau 3 (Vermietung, Inserat, Maklersuche), Hub 3 → «Alle anzeigen».

### Partner-Services («Services rund um Immobilien»)
Auf Suchseite und Detailseite als Icon-Reihe: Finanzierung, Umzug, Endreinigung, Renovation, Versicherung, Pension, Mietzinsdepot, Internet/Telefonie. Auf der Detailseite als Checkboxen im Kontaktformular («Finanzierung (Hypotheken), Steueroptimierung/Vorsorgeberatung, Endreinigung, Umzug, Privathaftpflicht»).

## 4. Prozesskommunikation

| Kontext | Schritte | Labels |
|---|---|---|
| Homepage (Verkauf) | 4 | Erstberatung & Marktwertermittlung · Professionelle Vermarktung · Besichtigungen virtuell & vor Ort · Berichterstattung und Vertragsabschluss |
| Verkaufen-Seite («Full-Service-Versprechen») | 5 | Präzise Marktwertanalyse · Individuelle Vermarktungsstrategie · High-End Objektaufbereitung · Maximale Reichweite · Geprüfte Interessenten & Abschluss |
| Vermieten-Seite («in 5 Schritten», mit SCHRITT-1…5-Labels + je 2–3 Sätzen) | 5 | Erstberatung · Marketing · Besichtigungen virtuell & vor Ort · Mieterselektion · Vertragsabschluss |
| Neubau («in 5 Schritten») | 5 | Erstberatung & Projektierung · Marketing · Besichtigungen · Digitales Reporting · Vertragsabschluss |
| Online-Bewertung («So funktioniert…») | 3 | Angaben zu Ihrer Immobilie · Der Marktwert wird ermittelt · Ergebnis per E-Mail erhalten |
| Suchabo («in 3 Schritten») | 3 | Kostenloses Suchabo · Besichtigungen virtuell & vor Ort · Vertragsabschluss |

Muster: Erstberatung → Vermarktung → Besichtigung → Abschluss, immer 3–5 Schritte, nummeriert, mit kurzem Label, optional aufklappbar. Ergänzt durch die **Vergleichstabelle** (Vorauszahlungen, Bewertung, 3D/Staging, Kündigungsfrist, Provision) und **FAQ-Akkordeons** (6–8 Fragen) als Erwartungsmanagement. Die Verkaufen-Seite strukturiert zusätzlich nach **Lebensphasen** (Erbschaft, Verkleinerung, Jobwechsel, Ruhestand, Trennung, Zinsdruck).

## 5. Suche

- **Einstieg `/immobilie`:** Tabs *Kaufen / Mieten / Verkaufen* (Verkaufen-Tab führt zur Bewertung), Felder *Wo* (mit Umkreis 0 km), *Kategorie* (alle, Wohnung und Haus, Wohnung, Haus, Mehrfamilienhaus, Grundstück, Gewerbe, Büro), *Preis bis* (CHF 50'000–5 Mio.), *Zimmer bis* (1–8.5), Button «Filter» (erweitertes Panel nicht verifizierbar), «Treffer anzeigen». Direkt darunter: **Suchabo erstellen**, dann Partner-Services, dann Kantons-/Städte-SEO-Links.
- **Resultate `/immobilie/kaufen/alle/`:** Titel mit Trefferzahl («15'224 Immobilien zum Kaufen»), Breadcrumb, Toggle «Nur properti-Inserate anzeigen» (697 eigene vs. Portal-Aggregat), Sortierung («Neueste zuerst»), Listen-/Kartenansicht (MapLibre), Favoriten, Paginierung. Karte: Bildanzahl, Badges (360°, Neu, Umweltfreundlich), Preis, Typ, PLZ/Ort, Zimmer, m², CHF/m², Beratername. Nach 4 Treffern eine Inline-Karte «Möchten Sie Ihre Immobilie verkaufen? → Immobilie bewerten». Unter den Resultaten: Maklerliste.
- **Detailseite:** Sticky-Tabs Übersicht · Konditionen · Merkmale und Ausstattung · Lage · Beschreibung; Aktionen Zurück/Speichern/Teilen; Karte/Grundriss/360°; inline Hypothekenrechner; Ausstattung in Gruppen (Gebäude, Ausstattungsmerkmale, Energie, Parkplatz); Beraterkontakt mit Formular + Service-Checkboxen + «Account erstellen».
- **Suchabo-Platzierung:** Suchseite (direkt unter Formular), Footer, eigene Landingpage mit 3-Schritte-Prozess, Detailseite indirekt via «Account erstellen».

## 6. Wissen / Magazin («Insights»)

- Ein Dach **Insights** mit 4 Unterbereichen: *Blog & News*, *Checklisten*, *Publikationen* (monatliche PDF-Reports, «Lesen oder anhören»), *Online-Rechner*; dazu *Presse*.
- Blog-Kategorien als Filterchips: Alle · Eigentümer · Immobilienmarkt · Kaufen · Medienmitteilungen · Mieten · properti · Technologie · Verkaufen · Vermieten. Listing = Titel + 2-Zeilen-Teaser + Datum.
- Oberfläche ohne Dominanz: Auf Homepage/Hub/Service-Seiten erscheinen Insights immer als **letzte Content-Sektion vor Kontakt**, mit 4–9 reinen Titel-Teasern und einem «Alle anzeigen». Auf Service-Seiten sind die Artikel thematisch gefiltert (Vermieten-Seite zeigt Miet-Artikel, Bewertungsseite Bewertungs-Artikel).
- Wissen ist an den Prozess gebunden: Jede Service-Seite hat den Dreiklang *Prozess → Checklisten → Insights → FAQ*.

## 7. Übertragbare Prinzipien

1. **Drei Absichten im Hero, nichts sonst** – Bewerten/Suchen/Verkaufen deckt ~90 % der Besucher ab; alles andere ist einen Klick tiefer, das senkt die Entscheidungslast sofort.
2. **Header ≠ Sitemap** – 4 Header-Links (Rollen/Beweise), der vollständige Baum liegt im Footer; wer sucht, findet, wer nicht sucht, wird nicht abgelenkt.
3. **Hub-Seite pro Zielgruppe statt Mega-Menü** – `/eigentuemer/` beantwortet «verkaufen oder vermieten?» mit zwei Ja-Sätzen und fächert dann erst auf.
4. **Ein CTA pro Sektion** – jede Homepage-Sektion hat genau einen Ausgang; Informationsdichte wird durch Klicktiefe, nicht durch Parallelität erzeugt.
5. **Nischenservices bewusst unsichtbar auf der Startseite** – Exclusives, Neubau, Investment, Tippgeber sind nur im Footer; sie verwässern die Kernbotschaft nicht, bleiben aber für ihre Zielgruppe direkt adressierbar.
6. **Prozess immer als 3–5 nummerierte Schritte mit stabilem Vokabular** – Erstberatung → Vermarktung → Besichtigung → Abschluss wiederholt sich über Verkauf, Vermietung, Neubau, Suchabo; Wiedererkennung ersetzt Erklärtext.
7. **Vergleichstabelle als Erwartungsmanagement** – 5 Kriterien «wir vs. klassisch» kommunizieren Konditionen ohne Fliesstext und beantworten die Kostenfrage vor dem FAQ.
8. **Tools kontextuell einbetten, zentral katalogisieren** – Hypothekenrechner inline auf der Detailseite, Bewertung inline in den Suchresultaten, alle Rechner zusätzlich auf einer Übersichtsseite; man stolpert über das Tool genau dort, wo die Frage entsteht.
9. **Checklisten nach Rolle, auf Service-Seiten nur drei** – vollständiger Katalog (26 Dokumente) hinter Tabs Verkäufer/Vermieter/Käufer/Mieter; jede Service-Seite zeigt nur die 3 passenden plus «Alle anzeigen».
10. **Wissen ist Schluss-, nie Eröffnungssektion** – Insights kommen immer nach Angebot/Prozess/Beweis und sind thematisch vorgefiltert; das signalisiert Kompetenz, ohne zum Blog zu werden.
11. **Teaser nur mit Titel** – Insight-Karten auf Homepage/Hub zeigen nur Überschrift + «Mehr lesen», kein Anrisstext; 9 Teaser wirken so leichter als 3 mit Text.
12. **Lebensphasen als zweite Ordnungsachse** – neben dem Prozess (was passiert) bietet die Verkaufen-Seite Situationen (Erbschaft, Scheidung, Ruhestand); Nutzer finden sich über ihr Motiv, nicht über Fachbegriffe.
13. **Beweis nahe an der Entscheidung** – Ratings (Google/Trustpilot) im Footer und auf der Bewertungsseite, Referenzen erst nach dem Prozess; Vertrauen wird dort aufgebaut, wo der CTA steht.

## 8. NICHT kopieren

- Claim-Vokabular «Next-Gen Real Estate (Tech) Agent», «Immobilien neu gedacht», «Rechnen Sie besser mit uns», «Leading Real Estate Agent» – markenspezifisch.
- Kleingeschriebene Wortmarke «properti» und deren Logo/Farbwelt; Elementor-/WordPress-Layoutraster.
- Provisions- und Konditionentabelle mit konkreten Zahlen (ab 2,5 %, ~3 %, «jederzeit kündbar») – Geschäftsmodell, nicht IA.
- Aggregierte Fremdinserate (15'224 Treffer, davon 697 eigene) und der Toggle «Nur properti-Inserate» – setzt Portal-Aggregation voraus.
- Tippgeber-Programm mit 20 %-Provisionsrechner, Investor-Relations-, Recruiting-Subsite (life.properti.com) – Unternehmensspezifika.
- Massenhafte Kantons-SEO-Linkblöcke (40 Links auf der Homepage, 26×4 auf der Suchseite) – reines SEO-Muster, verschlechtert die Lesbarkeit.
- Doppelte Trust-Badges (Google + Trustpilot) und «Bekannt aus»-Logowände.
- Externes Tool-Subdomain-Konzept (`calc.properti.com`) mit Cookie-Banner-Wiederholung – Medienbruch beim Hero-CTA.
- Duplizierte Testimonial-Karussells und Wiederholungen von «Vereinbaren Sie jetzt einen Termin»-Blöcken mit identischer Kontaktperson auf jeder B2B-Seite.
