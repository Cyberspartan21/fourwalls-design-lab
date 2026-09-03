# UFER Design Language v1

Verbindliche Grundlage für alle weiteren FOURWALLS-Arbeiten. Eingefroren als Git-Tag `ufer-v1`.
Das Turnier ist beendet: **UFER ist die visuelle Basis.** Weitere Arbeit verbessert Funktion, Informationsarchitektur und Inhalt — nicht die Identität.

## 1. Haltung

**Was Sie sehen. Was dahinter liegt.**
Oberfläche (Wasser, Fassade) → Öffnung (Logo-Fenster, Blende) → Tiefe (Objektdossier, Finanzierung, Dokumente).

Drei Regeln, die alles andere ableiten:
1. **Einladend vor stimmungsvoll.** Tageslicht ist Standard, der Abend ist der Zweitzustand.
2. **Kontrast lokal, nie flächig.** Kein Verlauf über eine ganze Fotografie. Bänder nur dort, wo Bedienelemente liegen; sonst Textschatten oder Glasflächen.
3. **Ruhe ist das Produktversprechen.** Bewegung nur an drei definierten Stellen (siehe §7).

## 2. Farbe

Tokens in `final/ufer/ufer.css`. Zwei Zustände: `[data-mode="hell"]` (Standard) und `:root` = dunkel.

| Token | Tag (Standard) | Abend |
|---|---|---|
| `--gr` Grund | `#F5F8F9` | `#0B121B` |
| `--gr2` Fläche | `#EAEFF2` | `#111B27` |
| `--gr3` Feld | `#DCE4EA` | `#182433` |
| `--gr4` Rahmen | `#C8D3DA` | `#22303F` |
| `--ink` Schrift | `#0F1B2A` | `#E8ECEF` |
| `--leise` Sekundär | `#5A6A78` | `#8A98A7` |
| `--linie` | `rgba(15,27,42,.15)` | `rgba(232,236,239,.14)` |
| `--linie2` | `rgba(15,27,42,.32)` | `rgba(232,236,239,.28)` |
| `--licht` Akzent | `#A8702F` | `#D9A05B` |
| `--licht2` | `#C58A45` | `#F0C58A` |
| `--wasser` | `#8FA7B9` | `#3E5A72` |
| `--tief` | `#C9D3DA` | `#070C12` |
| `--gut` / `--warn` | `#4E7A49` / `#9A4A54` | `#7FA97A` / `#C4838A` |

**Ein Akzent.** Warmes Licht (`--licht`) für Handlung, Hervorhebung, aktive Zustände. Keine zweite Akzentfarbe. Semantische Farben (gut/warn) sind vom Akzent getrennt und tragen nie Marke.

Kino-Ausnahme: Die Exclusive-Premiere bleibt in beiden Modi tief (`#070C12` / Wand `#0B121B`), damit das Logo-Fenster leuchtet.

## 3. Typografie

- **Display:** Petrona 200–400, kursiv für Betonung. Titel, Preise, Objektnamen, Zahlen mit Gewicht.
- **Funktion:** Manrope 300–600. Navigation, Formulare, Fakten, Fliesstext, Etiketten.
- Skala: `clamp()` durchgehend. Hero `clamp(2.5rem,5.8vw,5.4rem)`, Seitentitel `clamp(1.8rem,3.4vw,2.9rem)`, Abschnitt `clamp(1.3rem,2vw,1.7rem)`, Fliesstext `.95rem/1.75`, Etikett `.6–.68rem` mit `letter-spacing:.16–.24em` in Versalien.
- Laufweite: Display negativ (`-.015` bis `-.025em`), Versal-Etiketten positiv.
- `text-wrap: balance` auf allen Überschriften. Fliesstext max. 60–68 Zeichen.
- Zahlen in Tabellen: `font-variant-numeric: tabular-nums`.

## 4. Raster und Abstand

- Aussenabstand `--pad: clamp(16px,3vw,48px)`; Inhaltsbreite `max-width:1280px`.
- Abschnitt `clamp(56px,8vw,120px)` vertikal, eng `clamp(40px,5vw,72px)`.
- Radius `--r: 2px` — fast eckig. Keine runden Karten.
- Trennung durch Linien und Weissraum, nicht durch Schatten. Schatten nur für schwebende Ebenen (Tafel, Filterfeld, Steg, Lightbox).

## 5. Komponenten (Bestand v1)

Kopf mit vier Gruppen und Tafeln · mobiles Blatt · Vier-Wege-Leiste · Knopf (`.knopf`, `.voll`, `.leise`, `.gross`) · Feld/Etikett · Chip · Zeile (`.zeile`) · Karte mit Wasserlinie (`.karte`, `.refl`) · Wasserlinien-Suchleiste · Filterfeld/Bottom-Sheet · Anker-Navigation · Faktenraster · Merkmalgruppen · Grundrissblatt · Minikarte · Finanzblock · Dokumentzeile · FAQ · Begleiter (sticky Kontakt) · Lightbox · Logo-Fenster (`.fenster`) · Blenden (`.auf`, `.blende`, `.blende-v`, `.bild-hinter`).

## 6. Signaturen

**Wasser.** Die Fotografie enthält die echte Spiegelung; ein handgeschriebener WebGL-Shader bewegt nur, was unter der Wasserlinie liegt: drei langsame Wellenfelder, Ringe mit Trägheit am Zeiger, ein zweiter Farbabgriff als Lichtversatz. Rückfall ohne WebGL oder bei reduzierter Bewegung: das Foto. Uniform `uNacht` schaltet Tag/Abend; beim Wechsel wandert das Licht von links nach rechts.

**Logo-Fenster.** Das Monogramm als CSS-Maske, dahinter ein langsam treibendes Bild und ein Lichtzug. Nur an vier Stellen: Intro, Startseite-Premiere, Verkaufen-Exclusive, Exclusive-Premiere. Knappheit erzeugt Wert.

## 7. Bewegung — drei Stufen

| Stufe | Wo | Dauer |
|---|---|---|
| MIKRO | Knöpfe, Filter, Karten, Fokus, Hover | 150–300 ms |
| ABSCHNITT | Blenden beim Scrollen, Tafeln, Bild hinter Fläche | 300–1200 ms |
| SIGNATUR | Hero-Wasser, Logo-Fenster, Exclusive-Premiere, Themenwechsel | bis 1600 ms |

Im Portal (Suchen, Filtern, Sortieren) gibt es **keine** Signaturbewegung. Filterwechsel sind sofort.
`prefers-reduced-motion` schaltet alle Animation auf 0.01 ms und ersetzt Signaturen durch ihren Endzustand.

## 8. Bild

- WebP + JPEG, Breiten 480/960/1600 (Hero zusätzlich 1920), `srcset`/`sizes`, `loading="lazy"`, Hero `fetchpriority="high"`, Seitenverhältnis reserviert.
- Kein base64. Mobil eigener Bildausschnitt, nicht der beschnittene Desktop.
- Bildsprache: Tageslicht, Wasser, Schweizer Landschaft, Sichtbeton/Eiche/Kalkstein, keine Menschen, keine Deko-Klischees.

## 9. Barrierefreiheit

Sichtbarer Fokus (`2px` Akzent, `offset:3px`) · Karten und Zeilen sind echte Links · Dialoge setzen Fokus auf Schliessen und reagieren auf Escape · Karte hat immer die Liste als Alternative · Formularfelder haben Etiketten · Bewegung ist nie bedeutungstragend.

## 10. Sprache

DE/FR/IT/EN in `core.js` (Produkt) und `ufer.js` (Navigation). Lange deutsche und französische Strings sind der Testfall, nicht der Sonderfall.

## 11. Was verboten ist

Flächige Verläufe über Fotos · zweite Akzentfarbe · runde Karten · Icon-Teppiche · Schatten als Standardtrennung · Signaturbewegung im Arbeitsmodus · erfundene Verifizierung, Bewertungen oder Kennzahlen · visuelle Übernahmen von Neho, Properti, Walde, Homegate, ImmoScout24, newhome, RealAdvisor.
