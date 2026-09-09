# FOURWALLS — Asset-Inventar

Der Demo-Bestand ist KI-generierte Fotografie via Canva (`generate-design`, Typ desktop_wallpaper, 1920×1080) → Export JPG → weboptimiert 1440px q68 in `assets/web/`. Keine echten Objekte, keine Stock-/Wettbewerber-Assets.

| Datei | Motiv | Verwendung |
|---|---|---|
| lakeside-villa-1/2 | Moderne Villa am See, blaue Stunde | Flagship «Seehaus Walensee», Heroes |
| zurich-altbau-1/2 | Sandstein-Altbau-Strassen | ZH Enge, Basel St. Alban |
| penthouse-1/2 | Penthouse-Interieurs Abend, Seeblick | ZH Penthouse, Luzern |
| interior-bright-1/2 | Helle minimalistische Wohnräume | Mietwohnungen, Galerien |
| kitchen-1 | Küche Eiche/Stein | Galerien |
| condo-modern-1/2 | Neubau-Fassaden begrünte Balkone | Zug Neubau |
| family-house-1/2 | Holz-EFH mit Garten | Köniz BE |
| geneva-facade-1 | Klassische Steinfassade | Genève Champel |
| ticino-villa-1/2 | Tessiner Villa / Arkade mit Seeblick | Collina d'Oro |
| chalet-1/2 | Alpine Chalets Winterabend | Val d'Anniviers, Andermatt |
| mfh-winterthur-1 | Renoviertes MFH 1930er | Rendite-Objekt Winterthur |
| aerial-lake-1 | Luftbild See mit Dörfern, Nebel | Atmosphäre/Heroes |

Bekannte kleinere KI-Artefakte (akzeptiert für Prototyp): zurich-altbau-2 (weisse Lücke Strassenende), ticino-villa-2 (leichtes Banding rechts), aerial-lake-1 (Kirchturm-Geometrie).

## Echte Fotografie — seit 2026-09-08

Auf Wunsch des Auftraggebers ist das Heldenbild des Exclusive-Mandats
«Seehaus Walensee» kein generiertes Bild mehr, sondern eine echte Aufnahme.
Der Auftraggeber hat eine erste Fassung (ein Bergsee ohne Gebäude)
zurückgewiesen: Ein Titelbild einer Immobilie muss eine Immobilie zeigen.

| Datei | Motiv | Fotograf | Quelle | Lizenz |
|---|---|---|---|---|
| `fw-seevilla-1-{480,960,1600}.{jpg,webp}` | Villa am Zürichsee mit gedecktem Bootshaus, Quaimauer, Wasser im Vordergrund | Roland zh | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Wollishofen_-_Villa_Moser-Nef_-_Cassiopeiasteg_2015-05-06_13-49-07.JPG) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/deed.de) |

Bearbeitung: 16:9-Ausschnitt aus dem Original (4928×3264, Fenster
4928×2772+0+80), Grössen 480/960/1440, JPEG (4:2:0, progressiv) und WebP,
EXIF entfernt. Keine Farbmanipulation, keine Retusche. Die Bearbeitung ist
eine Bearbeitung im Sinne der Lizenz und steht damit ebenfalls unter
CC BY-SA 3.0.

Namensnennung: Die Lizenz verlangt sie sichtbar im Produkt, nicht nur in
dieser Datei. Sie steht auf der Seite `/{sprache}/bildnachweis`, verlinkt aus
der Fusszeile jeder Seite.

### Was dieses Bild nicht behauptet

Die Aufnahme zeigt ein bestehendes, privates Gebäude in Zürich-Wollishofen.
Das Inserat «Seehaus Walensee» ist erfunden: erfundene Adresse (Quarten SG),
erfundener Preis, erfundene Eigentümerschaft. Damit daraus kein falscher
Eindruck entsteht, gilt:

- Die Fusszeile jeder Seite nennt den Entwicklungsstand mit fiktiven Objekt-
  und Firmendaten (`components/site/fuss.tsx`).
- Die Bildlegende benennt nur, was zu sehen ist («Seeseite mit dem gedeckten
  Bootshaus»), und nennt weder Gebäudenamen noch Eigentümerschaft.
- Die Seite `/bildnachweis` sagt ausdrücklich, dass die übrigen Bilder
  generiert sind und keine bestehenden Gebäude zeigen.
- Das Inserat trägt `listing.is_demo = true`. Im Produktionsbetrieb blendet
  die Anwendung Demo-Inserate aus (`nurEcht` in `server/search.ts`,
  `server/similar.ts`, `server/inquiries.ts`, `server/angebot.ts`); das Bild
  erscheint dort also gar nicht.
- Es ist ein Demo-Asset, kein Inseratsbild. Ein echtes Mandat braucht eine
  Aufnahme des tatsächlich vermarkteten Objekts.

## Heldenbild der Startseite — vier Vorschläge (2026-09-08)

Der Auftraggeber will auch auf der Startseite des UFER-Prototyps
(`final/ufer/index.html`) ein echtes Foto mit Wasser davor statt des
generierten Bildes mit Pool. Umschaltbar über `?bild=1..6`; 1 und 2 sind die
bisherigen generierten Bildwelten, 3 bis 6 die Vorschläge.

| Nr. | Datei | Motiv | Fotograf | Lizenz | Wasseranteil |
|---|---|---|---|---|---|
| 3 | `ufer-faulensee-*` | Faulensee am Thunersee, ruhige Wasserfläche | JoachimKohler-HB | CC BY-SA 4.0 | 26 % |
| 4 | `ufer-merligen-*` | Merligen am Thunersee, türkises Wasser mit Bojen | JoachimKohler-HB | CC BY-SA 4.0 | 18 % |
| 5 | `ufer-hilterfingen-*` | Hilterfingen, Hotel Bellevue und Kirche | JoachimKohler-HB | CC BY-SA 4.0 | 11 % |
| 6 | `ufer-oberhofen-*` | Schloss Oberhofen im Thunersee | JoachimKohler-HB | CC BY-SA 4.0 | Wasser rechts und unten |

Alle vier über [Wikimedia Commons](https://commons.wikimedia.org/), Bearbeitung
jeweils 16:9-Ausschnitt für den Desktop und 3:4 für mobil, Grössen
480/960/1600/1920 sowie m-480/m-960 als JPEG und WebP, EXIF entfernt, keine
Farbmanipulation. Die Bearbeitungen stehen unter derselben Lizenz.
Namensnennung: `.bildnachweis` unten rechts im Helden, aus dem Feld
`nachweis` der jeweiligen Bildwelt — bei den generierten Bildwelten 1 und 2
entfällt die Zeile.

### Nachtrag: moderne Bauten statt Altbauten (2026-09-08)

Der Auftraggeber hat die vier Vorschläge 3 bis 6 abgelehnt: zu alt, keine
Schlösser und keine Chalets, sondern normale moderne Häuser oder Bauten.

Ergebnis der Nachsuche: **Im frei lizenzierten Bestand gibt es keine
Aufnahme moderner Schweizer Wohnarchitektur am Wasser.** Geprüft wurden
Wikimedia Commons mit rund 60 Suchbegriffen (Zürichsee, Thunersee, Zugersee,
Vierwaldstättersee, Bodensee, Lago di Lugano, Lac Léman; dazu Neubau,
Wohnüberbauung, Seeufer, moderne Architektur) und Openverse, das anonyme
Zugriffe nach wenigen Abfragen drosselt (HTTP 429). Freie
Architekturfotografie dokumentiert Denkmäler, öffentliche Bauten und
Infrastruktur; private Neubauten werden praktisch nie unter freier Lizenz
veröffentlicht.

Moderne Bauten direkt am Wasser gibt es frei lizenziert nur im Ausland, vor
allem in niederländischen und dänischen Hafenquartieren:

| Nr. | Datei | Motiv | Fotograf | Lizenz |
|---|---|---|---|---|
| 7 | `ufer-achtvillas-*` | Acht Villas, Amsterdam IJburg — moderne Wohnhäuser mit Glasfronten, Schilf und Wasser davor | Fred Romero | CC BY 2.0 |
| 8 | `ufer-sluseholmen-*` | Sluseholmen, Kopenhagen — moderne Wohnbauten am Kanal mit Hausbooten | Thomas Dahlstrøm Nielsen | CC BY-SA 4.0 |

Nummer 7 erfüllt die Bedingungen des Helden am besten (Wasserband unten,
Himmel oben rechts, moderne Wohnhäuser), ist aber erkennbar niederländisch:
flaches Land, keine Berge. Damit steht ein Zielkonflikt zur Entscheidung an,
den nur der Auftraggeber auflösen kann: echtes Foto und modern, aber nicht
Schweiz — oder Schweiz und modern, aber generiert — oder die Regel der
Kostenfreiheit für ein gekauftes Stockfoto lockern.

### Nachtrag 2: moderne, gehobene Bauten (2026-09-09)

Rückmeldung: Richtung Amsterdam/Kopenhagen falsch, das ursprüngliche
generierte Bild gefällt besser; gesucht sind moderne Bauten, gehoben und
speziell. Vier weitere Vorschläge liegen als Bildwelt 9 bis 12 bereit:

| Nr. | Datei | Motiv | Fotograf | Lizenz |
|---|---|---|---|---|
| 9 | `ufer-island-*` | Seljavallalaug, Island — weisser moderner Baukörper im Bergtal, Becken davor | Michael James | CC0 |
| 10 | `ufer-pool-*` | Infinity-Pool, der in die Bucht übergeht | Cosmic Timetraveler | CC0 |
| 11 | `ufer-miragalli-*` | Villa Miragalli — Infinity-Pool über dem Meer | Bruno Acampora | CC BY-SA 3.0 |
| 12 | `ufer-falling-*` | Fallingwater — Sichtbeton über dem Wasserfall | Joshua G Chang | CC BY-SA 4.0 |

Damit ist der freie Bestand ausgeschöpft. Geprüft wurden in rund zwanzig
Durchgängen: Wikimedia Commons (Volltext und Unsplash-Importe, ~120
Suchbegriffe), Openverse (drosselt anonyme Zugriffe), Unsplash direkt
(Bot-Prüfung sperrt automatisierte Zugriffe).

**Befund:** Gehobene, moderne Architekturfotografie am Wasser ist
kommerziell wertvoll und wird deshalb praktisch nie unter freier Lizenz
veröffentlicht. Was frei vorliegt, ist entweder Denkmalpflege (historische
Villen, Schlösser), Infrastruktur (Häfen, Bäder), Landschaft ohne Gebäude
oder Architektur-Ikonen als Museum (Fallingwater, Farnsworth House).

**Drei Wege, die zum Referenzbild führen:**

1. Beim generierten Bild bleiben. Es ist die einzige Aufnahme, die moderne
   Villa, Alpensee und gehobene Anmutung zugleich zeigt.
2. Ein Stockfoto lizenzieren (Getty, Adobe Stock, Stocksy; erfahrungsgemäss
   100 bis 500 Franken). Das hebt die Regel der Kostenfreiheit auf und ist
   eine Entscheidung des Auftraggebers.
3. Kostenlos, aber mit einem Handgriff des Auftraggebers: Unsplash und
   Pexels führen genau diese Motive unter einer Lizenz, die auch
   kommerzielle Nutzung ohne Namensnennung erlaubt. Die Bot-Prüfung der
   Seiten sperrt automatisierte Zugriffe, nicht menschliche. Ein Link genügt,
   die Einbindung dauert Minuten.

### Was das Bild hier leisten muss

Drei Bedingungen, die den Kreis der brauchbaren Fotos stark einschränken und
erklären, warum die naheliegenden Aufnahmen von Seevillen ausgeschieden sind:

1. **Sauberes Wasserband unten.** Der WebGL-Shader bewegt alles unterhalb von
   `wl`. Liegt dort noch Ufer, wackelt das Ufer mit. `wl` je Bild gemessen
   über den Einbruch der Zeilentextur (Wasser ist glatt).
2. **Ruhige, helle Fläche oben rechts.** Dort steht die Schlagzeile im
   Tagmodus in Dunkelblau (`#0F1B2A`). Der Kommentar im Quelltext sagt es
   bereits: «das Haus steht links am Ufer, Himmel und Berge rechts tragen die
   Schrift».
3. **Weite statt Nähe.** Teleaufnahmen einzelner Villen vom Boot aus füllen
   das Bild mit Fassade; die Schrift steht dann auf dem Haus. Verworfen wurden
   deshalb Aufnahmen aus Wollishofen, Erlenbach, Gunten und Iseltwald.

### Warum kein moderner Neubau (betrifft das Heldenbild der Objektseite)

Das Inserat beschrieb ursprünglich einen Sichtbetonbau von 2019. Eine Suche
über Wikimedia Commons und Openverse (CC0, CC BY, CC BY-SA; fünf Runden,
rund 190 geprüfte Kandidaten) hat kein einziges frei lizenziertes Foto eines
modernen Wohnhauses am Wasser ergeben — freie Architekturfotografie zeigt
öffentliche Bauten und historische Villen, private Neubauten praktisch nie.
Openverse war zudem nicht erreichbar (Zeitüberschreitung).

Statt das Bild dem Text anzupassen (unmöglich) wurde der Text dem Bild
angepasst: Das Objekt ist neu eine Villa von 1912, die 2019 kernsaniert und
nach Süden um einen Wohnpavillon aus Sichtbeton und Glas erweitert wurde.
Damit bleiben die zwölf generierten Innen- und Terrassenbilder (moderne
Räume, raumhohes Glas, Sichtbetondecken) stimmig — sie zeigen den Pavillon
und die sanierten Räume. Geändert wurden `final/properties.js` (Tagline,
Kurztext, Beschreibung, Highlights, Baujahr 1912/renoviert 2019 in vier
Sprachen), `final/ufer/detail-data.js` (Geschichte, Highlights, Fakten,
Gebäude, Bildlegenden) und `app/scripts/import-demo.mjs` (Geschosse 3,
Raumhöhe 3.1 m).

