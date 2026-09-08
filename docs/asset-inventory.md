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

### Warum kein moderner Neubau

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

