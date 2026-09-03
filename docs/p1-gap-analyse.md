# P1 — Funktionale Lückenanalyse: Homegate · ImmoScout24 · newhome · RealAdvisor

**Datum:** 2026-09-02 · **Scope:** rein funktional (keine Optik, kein Layout-Urteil) · **Zweck:** Lückenmatrix für FOURWALLS

## 1. Methode & Abrufbarkeit

| Portal | Startseite | Trefferliste/Filter | Objektseite | Bewerten/Verkaufen | Konto/Suchabo | Quelle |
|---|---|---|---|---|---|---|
| **Homegate** | ✅ live | ✅ live | ✅ live (Inserat 4003410713) | ✅ | teilweise (Login-Wand) | Live-Begehung 2026-09-01 (r7) + Ratgeberseiten |
| **ImmoScout24** | ✅ live | ❌ **DataDome-CAPTCHA** | ❌ blockiert | ✅ (LP-Seiten) | ✅ (Guide/Release-Notes) | Startseite live; Rest über Hilfe-/Release-Seiten + SMG-Medienmitteilung |
| **newhome** | ✅ live | ✅ live | ✅ live (Inserat 6164908) | ✅ | ✅ | Live-Begehung 2026-09-01 (r7) |
| **RealAdvisor** | ❌ **Cloudflare-Challenge** | ❌ blockiert | ❌ blockiert | ❌ blockiert | ❌ blockiert | **rein sekundär**: App-Store-Beschreibung, RealAdvisor-Landingpages via Suche, Fachpresse |

**Wichtig:** Bot-Schutz wurde **nicht umgangen** (weder CAPTCHA noch Cloudflare). Erneuter Versuch am 2026-09-02 mit echtem Browser: IS24 lieferte leeren Body, RealAdvisor «Sicherheitsüberprüfung wird durchgeführt». Alles zu **RealAdvisor ist damit unverifiziert** und als Zweitquelle zu lesen; bei IS24 gilt das für Trefferliste und Objektseite. Homegate und newhome sind vollständig verifiziert. Keine der Seiten enthielt agent-gerichtete Handlungsaufforderungen; alle Inhalte wurden als Daten behandelt.

Legende: ✅ vorhanden · — nicht vorhanden/nicht gefunden · **?** unverifiziert (Zweitquelle)

---

## 2. Bereich SUCHE

| Feature | Homegate | ImmoScout24 | newhome | RealAdvisor | Kommentar |
|---|---|---|---|---|---|
| Kaufen/Mieten als Tab | ✅ | ✅ | ✅ | ✅? | Überall Segment, nie Dropdown |
| Ort-Autocomplete (Ort/Region/PLZ/Kanton) | ✅ | ✅ | ✅ (+ **Immocode**) | ✅? | newhome erlaubt Direktsprung per Objektcode |
| **Umkreis in km** | ✅ +0…50 km | ✅ | ✅ | ✅? | Basisfunktion bei allen vieren |
| **Reisezeit/Isochrone** (Ziel + Verkehrsmittel + max. Minuten) | ✅ Filter «Reisezeit» | ✅ «Wegzeit-Suche» | ✅ **im Sucheinstieg** | — | newhome stellt sie gleichrangig neben den Umkreis |
| **Suchgebiet auf Karte zeichnen (Polygon)** | ✅ nur App | ✅ Web + App (iOS/Android) | — | — | IS24 laut Release-Notes auch im Web |
| Objektart/Kategorie primär | im Modal | im Modal | ✅ primär | ✅? | SMG versteckt sie, newhome/RealAdvisor nicht |
| Preis von/bis | ✅ (feste Stufen) | ✅ (feste Stufen) | ✅ | ✅ | Freie Eingabe/Slider bei keinem gefunden |
| Zimmer von/bis (0.5er) | ✅ | ✅ | ✅ (Stepper) | ✅ | |
| Wohnfläche von/bis | ✅ 20–300 m² | ✅ | ✅ | ✅ | |
| **Baujahr von/bis** | ✅ | ✅ | ✅ | ? | |
| Objekttyp-Verfeinerung (Attika/Loft/Maisonette…) | ✅ | ✅ | ✅ | ✅? | |
| **Etage / «nicht im EG»** | ✅ | ✅ | ✅ «Parterre ausschliessen» | ? | |
| **Verfügbarkeit / Einzug ab** | ✅ (sofort…12 Mte.) | ✅ | ✅ Sortierung «Sofort verfügbar» | ? | |
| **Freitext-Filter** | ✅ (max. 50 Z.) | ✅ | — | — | |
| **KI-/Natürlichsprachige Suche** | — | ✅ «Intelligente Suche» + **Spracheingabe** | — | — | Umschalter klassisch ↔ KI; übersetzt Freitext in Filter |
| Ausstattungs-Checkboxen | ✅ 9 | ✅ | ✅ 13 (inkl. **E-Ladestation**, kinderfreundlich) | ? | newhome am breitesten |
| **Preis pro m² als Filter** | — | — | — | ✅? | RealAdvisor-Profi-Filter |
| **Mietrendite als Filter** | — | — | — | ✅? | Investorenlogik, sonst nirgends |
| Anbietertyp-Filter (privat/Makler) | — | — | — | — | **Bei keinem gefunden** |
| Nur mit Preis / nur mit Bildern | ✅ «nur mit Preis» | ? | — | — | |
| Inserat-Alter («jünger als») | — | — | — | — | nur Comparis (ausserhalb Sample) |
| **Live-Trefferzähler im Apply-Button** | ✅ «1'000+ Treffer» | ✅? | ✅ «634 Treffer anzeigen» | ? | De-facto-Standard |
| Aktive Filter als Chips sichtbar | — (nur im Modal) | — | ✅ **Wert-im-Chip** («Kosten: Beliebig») | ? | newhome bestes Muster |
| Sortierung | Preis ↑↓, Zimmer ↑↓, Top Angebote, Neueste, **Exklusive zuerst (Plus+)** | ähnlich | Relevanz, Neuste, Günstigste, **Sofort verfügbar**, Ort A–Z, **360°-Ansicht** | Preis, ? | newhome sortiert nach Medienart (360°) — einzigartig |
| Karte: eigener Modus | ✅ Toggle | ✅ | ✅ Toggle | ✅? | |
| Karte: Split-View mit Live-Sync Liste↔Karte | — | — | — | ? | **Bei keinem CH-Portal verifiziert** (Zillow-Muster) |
| Suchabo/Alert | ✅ (Konto nötig) | ✅ **ohne Konto, E-Mail + Bestätigungslink**, sofort bei neuem Inserat, editierbar per Link im Mail | ✅ gratis, auch als Checkbox im Kontaktformular | ✅? «in zwei Klicks», inkl. Objekte **in der Nähe** | IS24 hat die niedrigste Hürde |
| Push-Benachrichtigung | ✅ App | ✅ App | ✅ App | ✅? App | |
| **Inserate ausblenden («passt nicht»/«beworben»)** | — | ✅ | — | — | IS24-Alleinstellung |
| Ergebniskarte: Felder | Bild+Chips → Preis+«Premium» → Zi./Fläche → Adresse → Titel → Snippet → **ÖV-Wegzeit** | ähnlich + Wegzeit | Badge → Typ+Zi. → Adresse → Preis → Fläche (schlankste) | Bild, Preis, Eckdaten? | Homegate maximal, newhome minimal |
| Treffer/Seite | ~20–23 | ? | 20 | ? | |

## 3. Bereich OBJEKTSEITE

| Feature | Homegate | ImmoScout24 | newhome | RealAdvisor | Kommentar |
|---|---|---|---|---|---|
| Blockabfolge | Galerie → Kernzahlen → **Wegzeit+Umgebung** → Kosten → Eckdaten → Merkmale → Dokumente → Beschreibung → Besichtigung → Anbieter → Kontaktformular → Ähnliche | ? | Galerie → **DETAILS** → **KOSTEN** → Beschreibung → Dokumente → **Lage & Umgebung** → Anbieter+Formular → Besichtigung/Melden | ? | newhome: Fakten vor Prosa, Lage spät; Homegate: Lage sehr früh |
| Anker-/Sprungmenü | — | — | — | — | **Bei keinem gefunden** — FOURWALLS-Vorsprung |
| Galerie mit Zähler | ✅ («1/12») | ✅ | ✅ («11 Bilder») | ✅? | |
| **Grundriss als Galerie-Tab** | ✅ | ✅? | via Dokumente | ? | |
| Video / 360° / 3D | ? | ? | ✅ 360° (sogar Sortierkriterium) | ✅? «virtuelle Touren» | |
| Faktengruppen | Kosten (netto/NK/brutto) · Eckdaten (Verfügbar ab, Typ, Zimmer, Etage, Fläche) · Merkmale | ? | DETAILS (Typ, Bezug, Fläche, Zimmer, Stockwerk, Baujahr, Immocode, Objektnummer) · KOSTEN · Eigenschaften | ? | Trennung Kosten/Objektdaten ist Standard |
| **Nettomiete / NK / Bruttomiete getrennt** | ✅ | ✅? | ✅ | ? | Pflichtmuster CH |
| **Umgebungsinfos mit Gehminuten** (Supermarkt, Schule, Apotheke, ÖV) | ✅ mit Namen | ✅ automatisch | ✅ POI-Explorer | ? | |
| **Pendlerzeit zum eigenen Ziel auf der Objektseite** | ✅ Wegzeit ÖV | ✅ eigenes Ziel + mehrere Verkehrsmittel | ✅ «Ort hinzufügen» (z.B. Arbeitsort) | — | Drei von vier haben das |
| Karte / Street View | ✅ | ✅ (+ **E-Ladestationen** in iOS-Karte) | ✅ + Street View | ✅? | |
| Finanzierungs-/Tragbarkeitswidget im Inserat | Upsell-Modul (iLocator-Fixkosten) | ? | — | ✅? Hypothekenrechner | Kein echtes eingebettetes Tragbarkeits-Widget verifiziert |
| Dokumente (PDF/Grundriss) | ✅ | ✅? | ✅ | ? | |
| Kontaktformular-Felder | Vorname, Name, E-Mail, Tel., Nachricht + **Haushaltseinkommen («Erfolgs-Booster»)** | + **Bewerberprofil** (Person, Umzugspläne) | Vorname, Name, E-Mail, Tel., Nachricht + Suchabo-Checkbox + Newsletter-Opt-in | Makler-Kontakt? | IS24 baut ein echtes Bewerberdossier |
| Besichtigungstermin buchen | ✅ Link/Kalender des Anbieters | ✅ | Hinweis | ? | |
| Sticky-CTA «Anbieter kontaktieren» | ✅ mobil | ? | ? | ? | |
| Ähnliche Objekte | ✅ | ✅ | ✅ (im Empty State) | ✅? | |
| Betrugswarnung + «Inserat melden» | ✅ | ✅? | ✅ | ? | |
| Inseratsalter («online seit») | — | ✅? | — | — | nur Comparis verifiziert |
| Notizen zum Favoriten | — | ✅ | — | — | IS24-Alleinstellung |

## 4. Bereich TOOLS & KONTO

| Feature | Homegate | ImmoScout24 | newhome | RealAdvisor | Kommentar |
|---|---|---|---|---|---|
| Konto nötig für Suchabo | ✅ ja | **nein** (E-Mail reicht) | nein | ? | |
| Favoriten + Geräte-Sync | ✅ | ✅ + Notizen | ✅ Merkliste | ✅ | |
| **Kostenlose Online-Bewertung (Verkäufer)** | ✅ Adresse → Wert + Mietwert + Marktvergleich | ✅ | ✅ | ✅ **Kernprodukt**, >70 Kriterien (20 Objekt-, 50 Kontextfaktoren) | RealAdvisor ist Bewertung-first, Portal-second |
| Hypothekenrechner | ✅ | ✅? | ✅ (max. Kaufpreis aus Finanzlage) | ✅ | |
| Tragbarkeits-/Leistbarkeitsrechner | ✅ (in Hypothek integriert) | ? | ✅ | ✅? | |
| **Preisentwicklung / historische Marktdaten** | ✅ Regionstrend im Bewertungsprodukt | ✅ **Immobilienpreise-Atlas** | Ø-Preise im SEO-FAQ | ✅ **Preise pro m² je PLZ mit Karte + Trend** | RealAdvisor am granularsten (PLZ-Ebene) |
| **Maklervergleich/-verzeichnis** | — | — | — | ✅ nach Transaktionen, Angeboten, Kundenbewertungen | RealAdvisor-Alleinstellung |
| **Mietkautions-Info/-Angebot** | ✅ SwissCaution-Upsell | ✅? | ✅ AXA (einziger Upsell) | — | |
| Betreibungsauszug bestellen | ✅ CHF 29.90 | ✅ (gratis bei MieterPlus) | — | — | |
| Steuerrechner Gemeinde | — | — | — | — | nur Comparis (ausserhalb Sample) |
| Lärmkarte | — | — | — | — | **Bei keinem der vier gefunden** |
| Bezahlabo für Suchende | ✅ MieterPlus | ✅ MieterPlus (früherer Zugang, Statistiken) | — | — | Pay-to-win, siehe Abschnitt 6 |
| Nachrichten-Postfach | — | — | — | — | nur Flatfox/immobiliare (ausserhalb Sample) |
| Objekte vergleichen (Side-by-side) | — | — | — | — | **Bei keinem gefunden** |
| Inserieren gratis für Private | ✅ ab CHF 0 (Nachmieter) | ab CHF 129 | ✅ FREE 7 Tage / CLASSIC ab CHF 139 | — | newhome prüft Inserate vor Freigabe |
| KI-Inseratstexte für Anbieter | — | ✅ Titel + Text aus Bildern | — | ✅? Pro-Software | |

---

## 5. LÜCKEN GEGENÜBER FOURWALLS

**FOURWALLS-Stand (verifiziert in `final/ufer`):** Kaufen/Mieten, Ort/PLZ/Kanton/Region-Autocomplete, Objekttyp, **freie Preisspanne von/bis** (besser als alle vier!), Zimmer ab, Wohnfläche ab, Anbieter-Filter (haben die anderen nicht), Ausstattungs-Chips, Sortierung, Liste/Karte, Favoriten, Suchabo, Objektseite mit Anker-Menü (haben die anderen nicht), Fakten, Grundrissen, Video/360°/3D, Lage inkl. POI + Steuerfuss, Tragbarkeitsrechner, Dokumente, FAQ, Besichtigung, Melden, Teilen; Verkaufen-Seite mit Bewertung.

| Feature | Wer braucht es | Phase der Reise | MVP | Wo im Produkt |
|---|---|---|---|---|
| **Umkreissuche in km (+0…50)** | alle Suchenden, v.a. pendelnde Familien | Orientierung (erste Suche) | **ja** | Sucheinstieg, direkt am Ortsfeld als Dropdown |
| **Live-Trefferzähler im Filter-Button** | alle Suchenden | Verfeinern | **ja** | Filterpanel, Submit-Button |
| **Aktive Filter als Wert-Chips** (newhome-Muster) | alle Suchenden | Verfeinern | **ja** | Kopf der Trefferliste |
| **Verfügbar ab / Einzug ab** | Mieter mit Kündigungsfrist | Verfeinern | **ja** | Filterpanel + Objekt-Fakten |
| **Etage / «nicht im Erdgeschoss»** | Familien, Ältere, Sicherheitsbewusste | Verfeinern | **ja** | Filterpanel (Mehr Filter) |
| **Baujahr von/bis als Filter** | Käufer (Sanierungsrisiko), Neubau-Interessierte | Verfeinern | **ja** | Filterpanel (Mehr Filter) |
| **Suchabo ohne Konto** (E-Mail + Bestätigungslink, IS24-Muster) | Gelegenheitssuchende, Datenschutz-Sensible | Wiederkehr | **ja** | Trefferliste + Empty State |
| **Empty State mit quantifizierten Lockerungen** («+5 km → 42 Treffer») | Suchende in dünnen Märkten | Verfeinern/Frust | **ja** | Trefferliste, 0-Treffer-Zustand |
| **Zimmer/Fläche auch als «bis»** | Downsizer, Budget-Bewusste | Verfeinern | **ja** | Filterpanel |
| **Reisezeit-/Pendlersuche (Isochrone)** | Pendler, Familien mit fixem Arbeitsort | Orientierung | nein (Phase 2) | Sucheinstieg als Alternative zum Umkreis |
| **Pendlerzeit zum eigenen Ziel auf der Objektseite** | Käufer/Mieter im Vergleich | Bewerten | nein (Phase 2) | Objektseite, Block «Lage» |
| **Suchgebiet auf Karte zeichnen (Polygon, mehrere Gebiete)** | ortskundige Städter | Orientierung | nein (Phase 2) | Kartenmodus |
| **Split-View Karte↔Liste mit Live-Sync** | Desktop-Rechercheure | Verfeinern | nein (Phase 2) | Suchergebnis, Desktop |
| **Nur mit Preis / nur mit Bildern** | qualitätsbewusste Suchende | Verfeinern | nein (Phase 2) | Filterpanel |
| **«Online seit»/Inserat-Alter (Feld + Filter)** | aktive Sucher im knappen Markt | Verfeinern/Bewerten | nein (Phase 2) | Ergebniskarte + Objektseite |
| **Preisentwicklung/Ø-Preis pro m² für die Gemeinde** | Käufer, Verkäufer | Bewerten | nein (Phase 2) | Objektseite «Lage», eigene Preis-Seiten (SEO) |
| **Objekte vergleichen (2–3 nebeneinander)** | Käufer in der Endauswahl | Entscheiden | nein (Phase 2) | Favoriten/Merkliste |
| **Notizen zu Favoriten + Ausblenden von Inseraten** | Vielsucher | Entscheiden | nein (Phase 2) | Favoriten + Ergebniskarte |
| **Besichtigungstermin direkt buchen (Slots)** | Mieter im Massenmarkt | Kontakt | nein (Phase 2) | Objektseite, Kontaktblock |
| **Nachrichten-Postfach (Suchende ↔ Anbieter)** | beide Seiten | Kontakt/Nachfassen | nein (Phase 3) | Konto |
| **Bewerberprofil/Dossier (freiwillig, nach Interesse)** | Mieter im knappen Markt | Kontakt | nein (Phase 3) | Konto, **nicht** im Erstkontakt-Formular |
| **Freitext-Filter im Inseratstext** | Suchende mit Nischenwunsch | Verfeinern | nein (Phase 3) | Filterpanel |
| **Natürlichsprachige Suche als Umschalter** | Erstnutzer, Mobile | Orientierung | nein (Phase 3) | Sucheinstieg, klassisch bleibt Default |
| **Preis pro m² / Rendite als Filter + Feld** | Investoren, Renditekäufer | Bewerten | nein (Phase 3) | Filterpanel + Objekt-Fakten |
| **Immocode/Objektnummer-Direktsuche** | Rückkehrer aus Inserat/Print | Wiederkehr | nein (Phase 3) | Ortsfeld akzeptiert Code |
| **Maklerverzeichnis mit Transaktions-Historie** | Verkäufer | Verkaufsentscheid | nein (Phase 3) | Verkaufen-Bereich |
| **Lärmbelastung/Umweltdaten zur Adresse** | Familien, Ruhesuchende | Bewerten | nein (Phase 3) | Objektseite «Lage» (BAFU-Daten) |
| **Mietkautions-Info (neutral, nicht als Werbung)** | Erstmieter | Nach Zusage | nein (Phase 3) | Wissen-Bereich, verlinkt von Objektseite |

---

## 6. BEWUSST NICHT ÜBERNEHMEN

| Muster | Wer macht es | Warum nicht |
|---|---|---|
| **Bezahlabo für Suchende** (MieterPlus: «exklusive Inserate», früherer Zugang) | Homegate, IS24 | Zweiklassen-Wohnungsmarkt. FOURWALLS monetarisiert beim **Anbieter**, nie am Zugang zum Wohnraum. |
| **Sortierung «Exklusive zuerst (Plus+)» / «Top Angebote»** | Homegate, IS24 | Vermischt Relevanz mit Bezahlung. Sortierkriterien müssen erklärbar und rein sachlich sein. |
| **Label-Inflation** (14 von 20 Treffern «TOP»; erste ~6 alle «Premium») | newhome, Homegate | Ein Label, das fast alle tragen, informiert nicht mehr — es täuscht. Max. 2–3 bezahlte Slots pro Seite, klar deklariert. |
| **Werbe-/Eigenmodule zwischen den Treffern** | Homegate, newhome («SPECIALS»-Block) | Die Trefferliste ist das Produkt. Fremdinhalte gehören nicht zwischen die Ergebnisse. |
| **Upsell-Sandwich auf der Objektseite** (5+ Fremdmodule zwischen Kosten und Beschreibung) | Homegate | Zerstört die Faktenlage genau dort, wo entschieden wird. Services in eine klar getrennte, ruhige Sektion. |
| **Haushaltseinkommen im Erstkontakt-Formular** («Erfolgs-Booster») | Homegate | Sozialer Druck + Diskriminierungsrisiko, bevor überhaupt ein Gespräch stattfand. Dossier frühestens nach Besichtigungsinteresse, freiwillig. |
| **Consent-Layer mit 800+ «Partnern», kein Ablehnen auf Ebene 1** | Homegate, IS24 (SMG-Verbund) | Dark Pattern. FOURWALLS: «Alle ablehnen» gleichrangig auf erster Ebene. |
| **Konzernweite Weitergabe «kumulierter Personendaten»** | SMG-Portale | Datenverkauf als Geschäftsmodell. Suchdaten bleiben beim Nutzer. |
| **Login-Wall auf den wertvollsten Daten** (geblurrte Indizes, «Einloggen und ansehen») | Comparis-Muster, Ansätze bei IS24 | Transparenzdaten offen zeigen; das Konto verkauft sich über Komfort (Sync, Abos, Notizen), nicht über Erpressung. |
| **Suchabo nur mit Konto** | Homegate | Unnötige Hürde im wichtigsten Retention-Moment. IS24 zeigt: E-Mail + Bestätigungslink reicht. |
| **Preis nur in starren Dropdown-Stufen** (1'250'000 → 1'500'000, kein 1.4 Mio.) | alle vier | FOURWALLS hat bereits freie Eingabe — das ist ein echter Vorsprung, nicht aufgeben. |
| **«Preis auf Anfrage» als Normalzustand** | alle vier (deshalb brauchen sie «nur mit Preis»-Filter) | Preisangabe zur Inseratspflicht machen; Ausnahmen nur begründet (Luxus/Gewerbe). |
| **Aggressiver Bot-Schutz gegen legitime Nutzung** | IS24 (DataDome), RealAdvisor (Cloudflare) | Trifft auch Screenreader, Preisvergleiche und Forschung. Rate-Limiting statt Totalblockade. |
