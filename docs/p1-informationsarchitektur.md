# P1 — Informationsarchitektur FOURWALLS

Grundlage: [UFER Design Language v1](ufer-design-language-v1.md) · [Gap-Analyse](p1-gap-analyse.md) · [Prinzipien Neho/Properti/Walde](gf3-principles.md)

## 1. Die fünf Reisen

Ein Besucher muss binnen Sekunden erkennen, welche dieser fünf Wege ihn betrifft. Sie werden nie unter «Dienstleistungen» versteckt.

| Reise | Wer | Einstieg | Ziel |
|---|---|---|---|
| **Suchen** | Käufer, Mieter | Startseite, Suchleiste, Karte | Objekt finden, merken, anfragen |
| **Verkaufen lassen** | Eigentümer mit Mandatswunsch | Verkaufen → Bewertung | Bewertung, dann Mandat |
| **Selbst inserieren** | Private, Makler, Verwaltungen, Bauträger | Knopf «Gratis inserieren», Weiche | Inserat in neun Schritten |
| **Bewerten** | Eigentümer ohne Verkaufsabsicht | Verkaufen → Bewertung, Wissen | Richtwert plus Gespräch |
| **Verwalten lassen** | Eigentümer von Rendite- und Stockwerkeigentum | Verwalten → Offerte | Offerte in 48 Stunden |

Die Weiche zwischen **Selbst inserieren** und **Mit Fourwalls verkaufen** bleibt an jeder Stelle explizit. Das kostenlose Angebot wird nie versteckt, um Mandate zu erzeugen.

## 2. Sitemap

```
/                        Startseite
/portal                  Suche (Liste)
  #karte                 Suche (Karte)
  #objekt/<slug>         Objektseite (Standard und Makler)
  #exclusive/<slug>      Objektseite (Fourwalls Exclusive)
  #neu                   Weiche + Inserats-Assistent
  #konto                 Merkliste · Suchabos · Anfragen · Meine Inserate
/verkaufen               Mit Fourwalls verkaufen
  #bewertung             Bewertung anfordern
  #ablauf                Zehn Etappen
  #exclusive             Was Exclusive bedeutet
  #fragen                Häufige Fragen
/verwalten               Bewirtschaftung
  #leistungen  #report  #erstvermietung  #offerte
/wissen                  Ratgeber, Rechner, Markt
  #tragbarkeit  #nebenkosten  #ratgeber  #markt  #checklisten
```

**Für die Produktion** werden die Rautenrouten zu echten Pfaden (§50): `/kaufen/<kanton>/<gemeinde>`, `/mieten/…`, `/objekt/<id>-<slug>`, `/neubau/<projekt>`, `/wissen/<beitrag>`. Indexierbar sind Transaktion, Region, Kanton, Gemeinde, Objekttyp und das Objekt selbst — nicht beliebige Filterkombinationen.

## 3. Navigation

Vier Gruppen im Kopf, alles Weitere darunter und im Fuss. Keine zehn obersten Punkte.

| Gruppe | Untereinträge |
|---|---|
| **Immobilien** | Kaufen · Mieten · Karte · Fourwalls Exclusive · Neubauprojekte · Suchabo |
| **Verkaufen** | Bewertung · Mit Fourwalls verkaufen · Gratis selbst inserieren · Vermieten |
| **Verwalten** | Bewirtschaftung · Eigentümer-Report · Erstvermietung · Offerte |
| **Wissen** | Ratgeber · Tragbarkeit · Kaufnebenkosten · Marktbericht |

Jeder Untereintrag trägt **eine erklärende Zeile**, die die Reise benennt («Sie inserieren und betreuen selbst» gegen «Wir übernehmen den ganzen Verkauf»). Damit ersetzt die Tafel ein Mega-Menü, ohne eine Sitemap über die Seite zu legen.

Dauerhaft rechts im Kopf: Sprache, Gemerkt mit Zähler, **Gratis inserieren**, Tag/Abend. Auf Mobil ersetzt ein Blatt die Tafeln, mit denselben Erklärzeilen.

## 4. Objektseite — Informationsarchitektur

**Prinzip: Übersicht zuerst, Tiefe auf Abruf.**

**Erstes Bild, ohne Scrollen:** Bild oder Premiere · Typ und Ort · Titel · Preis · CHF/m² · «ab CHF x/Monat» mit Sprung zur Finanzierung · Zimmer, Wohnfläche, Grundstück, Baujahr, Verfügbarkeit · Quelle · Merken · Kontakt.

**Anker-Menü (klebend), Reihenfolge fix:**

| Station | Inhalt | Fehlt wenn |
|---|---|---|
| Übersicht | bis zu 6 Highlights, Beschreibung gekürzt mit «Ganze Beschreibung» | nie |
| Bilder und Medien | Mosaik, Kategoriefilter, Video, 360°, 3D | weniger als 4 Bilder und keine Medien |
| Eckdaten | Faktenraster, Gruppen Gebäude/Ausstattung/Aussen/Parkieren/Energie, GEAK | nie |
| Grundrisse | Geschosswahl, Zoom, Vollbild, Download | keine Pläne |
| Lage | Karte mit Distanzringen, POI-Filter, Listen, Fahrzeiten, Ausrichtung | nie (Minimalfassung: PLZ, Ort, Kanton) |
| Finanzierung | Eigenmittel-Regler, Zinsmodell, Monatskosten, nötiges Einkommen | Miete oder Preis auf Anfrage |
| Dokumente | fünf Zugangsstufen, ehrlich beschriftet | keine Dokumente |
| Häufige Fragen | objektbezogen | keine |
| Kontakt | wer antwortet, nächste Schritte, Formular | nie |
| Ähnliche Objekte | drei Treffer | keine |

**Begleiter rechts (klebend):** wer inseriert, wer antwortet, Besichtigung, Frage, Telefon, nächste Schritte. Auf Mobil wandert er in die Station «Kontakt», zusätzlich eine ruhige Leiste unten mit Preis und Hauptaktion.

**Drei Tiefenstufen, eine Architektur:**

| Stufe | Beispiel | Stationen | Medien |
|---|---|---|---|
| A Privat | 2.5-Zi.-Wohnung Zürich | 7 | 3 Bilder |
| B Makler | 6-Zi.-Einfamilienhaus Zürich | 10 | 8 Bilder, Video, Pläne als PDF |
| C Fourwalls Exclusive | Seehaus Walensee | 10 | 13 Bilder mit Kategorien, Video, 360°, 3D, SVG-Pläne |

Leere Blöcke entstehen nicht — geprüft: Stufe A erzeugt sieben Stationen ohne Platzhalter.

## 5. Datenmodell — Erweiterungen

Bestehend in `listings.js` und `core.js`: Kennung, Quelle, Anbieter, Transaktion, Objekttyp, Ort, PLZ, Kanton, Koordinaten, Preis, Miete, Nebenkosten, Zimmer, Wohnfläche, Grundstück, Baujahr, Etage, Merkmale, Bild, Status, Veröffentlichung, Statistik.

Neu je Objekt in `ufer/detail-data.js` (`window.FWD`), produktionsfähig als eigenes Dossier-Dokument:

```
stufe · quelle{art,name,person,telefon,email,verifiziert,hinweis}
story{titel,absaetze[]} · highlights[]
fakten{wohnflaeche,nutzflaeche,grundstueck,zimmer,schlafzimmer,badezimmer,
       baujahr,renovation,geschosse,raumhoehe,kubatur,verfuegbar,preis,preisM2}
gebaeude · ausstattung · energie{…,geakKlasse} · aussen · parkieren
medien{bilder[{key,text,kat}], video{…}, tour360{…}, modell3d{…}, sonne{…}}
grundrisse[{geschoss,datei,flaeche,raeume[{name,m2}]}]
lage{beschreibung,gemeinde,kanton,plz,quartier,charakter,steuerfuss,
     oev[],schulen[],einkauf[],gesundheit[],freizeit[],verkehr[],fahrzeiten[]}
finanzen{kaufpreis,nebenkosten,eigenmittel20,hypothekBeispiel{…},
         tragbarkeitEinkommen,preisM2Kontext}
dokumente[{name,typ,groesse,seiten,zugang,hinweis}]
faq[{frage,antwort}] · naechsteSchritte[] · aehnliche[]
```

`zugang` kennt fünf Stufen: `oeffentlich`, `konto`, `anfrage`, `besichtigung`, `gesperrt`. Sie werden in Produktion **serverseitig** durchgesetzt, nicht nur in der Anzeige.

Fehlende Felder sind erlaubt und erwartet. Kein Feld wird mit «–» gefüllt.

## 6. Was P1 bewusst nicht enthält

Aus der Gap-Analyse in spätere Phasen verschoben: Umkreissuche in Kilometern, Trefferzähler im Filterknopf, Filter für Verfügbarkeit, Etage, Baujahr und Obergrenzen, Suchabo ohne Konto, Empty State mit quantifizierten Lockerungen, Pendlerzeit-Suche, Polygonsuche auf der Karte, Preisentwicklung je Gemeinde, Objektvergleich. Diese gehören zu P3 (Suche und Karte).
