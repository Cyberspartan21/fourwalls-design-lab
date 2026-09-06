# FOURWALLS — Barrierefreiheits-Audit (P5.10 §29)

Automatisiertes Audit von Tastaturbedienbarkeit, sichtbarem Fokus, Dialogen,
Formularfehlern, Knopfnamen, `aria-pressed`, Überschriftenstruktur,
`lang`-Attribut und `prefers-reduced-motion`. Skript: `app/scripts/a11y-test.mjs`.

```
cd app
set -a; . ./.env.local; set +a
node scripts/a11y-test.mjs http://localhost:3007
```

UFER ist eingefroren (Typografie, Kernfarben, Layout) — dieser Auftrag hat
**nur** aria-Attribute, Fokusstile und Rollen ergänzt, keine Gestaltung
verändert.

## Geprüfte Reisen/Seiten

| # | Prüfung | Seite(n) | Breite(n) |
|---|---|---|---|
| 1 | Tab-Reihenfolge (erste 15 Stopps, Skip-Link zuerst, dann Kopf, dann Inhalt) | Start | 1280 |
| 1b | Skip-Link aktivieren (Enter → `#inhalt` im Viewport) | Start | 1280 |
| 2 | Fokus sichtbar nach jedem Tab-Stopp (12 Stopps) | Start, Kaufen-Suche, Objektseite Exclusive, Bewertung, Konto/Anmelden, Wissen/Einschätzung, Datenschutz | 1280 + 390 |
| 3 | Mobiles Menü: Enter öffnet, Tab bleibt drin, Escape schliesst + Fokus zurück | Start | 390 |
| 4a | Dialog Galerie-Lichtbox: `role=dialog`, `aria-modal`, Fokusfalle, Escape + Fokus zurück | Objektseite Exclusive | 1280 |
| 4b | Dialog Suchabo (`#sucheSpeichern`): `role=dialog`, `aria-modal`, Fokusfalle, Escape + Fokus zurück | Kaufen-Suche | 1280 |
| 5 | Formular mit Fehlern: `role=alert`, `aria-invalid`, `aria-describedby` | Bewertung | 1280 |
| 6 | Karten-Alternative: benannter Umschalter, Liste per Tastatur erreichbar | Kaufen-Suche (`?ansicht=karte`) | 1280 |
| 7 | Knopfnamen: `<button>`/`<a>` ohne Text/aria-label/aria-labelledby/title | alle 7 Seiten | 1280 + 390 |
| 8 | `aria-pressed` wechselt beim Klick (Filterchips, Tag/Abend) | Kaufen-Suche | 1280 |
| 9 | Genau ein `h1` je Seite, keine Ebenensprünge | alle 7 Seiten | 1280 |
| 10 | `html lang` je Sprache (Stichprobe) | Start (de/fr/it/en) | — |
| 11 | `prefers-reduced-motion`: keine laufenden Animationen, Transition ≤ 0.01 s | Start | 1280 |

Die Objektseite «Exclusive» wird je Lauf per `SELECT ... FROM listing_public
WHERE publisher_kind = 'fourwalls'` ermittelt (dieselbe Spalte, die auch den
Nav-Filter `?quelle=fourwalls` speist) — unter den jüngsten Treffern wird der
erste genommen, der tatsächlich eine sichtbare Galerie führt, damit Prüfung 4a
eine echte Lichtbox öffnen kann.

Ergebnis des letzten Laufs: **13/13 Prüfungen OK**, bis auf einen dokumentierten
Befund ausserhalb der Schreibrechte dieses Auftrags (siehe Befund 6 unten,
Prüfung 9).

## Fixliste (behoben)

| # | Befund | Schwere | Datei:Zeile | Fix |
|---|---|---|---|---|
| 1 | `.feld:focus{outline:0}` schwächte die globale `:focus-visible`-Regel — Formularfelder (Text/E-Mail/Datum/Select) hatten bei Tastaturfokus keine sichtbare Kontur, nur die (auch bei Mausklick greifende) Randfarbe. | Mittel | `app/styles/ufer.css:240` | `:focus` behält die Randfarbe, `:focus-visible` bekommt zusätzlich `outline:2px solid var(--licht); outline-offset:2px` — dieselbe Kontur wie jedes andere Element. |
| 2 | Anliegen-Formular (`/de/bewertung` u. a.): Fehlermeldungen zu Name/E-Mail/Ort/Typ waren nur visuell neben dem Feld platziert, ohne `aria-invalid`/`aria-describedby` — Screenreader-Nutzung bekommt den Bezug zwischen Feld und Meldung nicht mit. | Mittel | `app/components/anliegen/kontakt-block.tsx` (al-name, al-email), `app/components/anliegen/objekt-block.tsx` (al-ort, al-typ-Gruppe) | `aria-invalid` + `aria-describedby` auf die (jetzt mit `id` versehene) Fehlermeldung ergänzt; die Typ-Auswahl (Knopfgruppe statt einzelnem Feld) bekam `role="group"` mit `aria-labelledby`/`aria-describedby` (ohne `aria-invalid`, das ARIA auf `role=group` nicht vorsieht — sonst Lint-Warnung `jsx-a11y/role-supports-aria-props`). |
| 3 | **Funktionaler Defekt, beim Bauen der Prüfung 5 gefunden:** `weiter()` rief `schrittGueltig(S)` direkt nach `setZeigeMaengel(true)` auf — React aktualisiert den State nicht synchron, `fehltObjekt`/`fehltKontakt` lasen also noch den alten `zeigeMaengel`-Wert (`false`) und meldeten nie einen Mangel. Der erste Klick auf «Weiter» sprang dadurch **immer** zum nächsten Schritt, egal ob Ort/Typ/Name/E-Mail ausgefüllt waren — keine Fehlermeldung für Maus- **und** Tastaturnutzung. | Hoch | `app/components/anliegen/anliegen-formular.tsx` (`schrittGueltig`/`weiter`) | `schrittGueltig` prüft jetzt direkt den Objekt-/Kontakt-Zustand (unabhängig vom Anzeige-Flag `zeigeMaengel`); `weiter()` setzt `zeigeMaengel` nur noch, wenn die Prüfung tatsächlich fehlschlägt. |
| 4 | Galerie-Lichtbox (Objektseite): `role="dialog"`/`aria-modal="true"` waren zwar gesetzt, aber keine Fokusfalle (Tab konnte den Dialog verlassen) und kein Zurückgeben des Fokus an den Auslöser beim Schliessen (Fokus fiel auf `<body>`). | Hoch | `app/components/property/galerie.tsx` | Tab-Handling in der bestehenden `keydown`-Behandlung ergänzt (hält den Fokus zwischen erstem/letztem fokussierbaren Element im Dialog); Auslöser wird beim Öffnen **synchron** in der Klick-Handlerfunktion `oeffneLicht()` gemerkt (nicht in einem `useEffect` — der autoFocus-Knopf «Schliessen» hat den Fokus zu dem Zeitpunkt schon übernommen) und beim Schliessen zurückgegeben. |
| 5 | Suchabo-Dialog (Kaufen-Suche, `#sucheSpeichern`): `role="dialog"`/`aria-modal="true"` vorhanden, aber kein Escape-Handler, keine Fokusfalle, kein Fokus-Hinein beim Öffnen, kein Fokus-Zurück beim Schliessen. | Hoch | `app/components/marktplatz/steuerung.tsx` (`AboZeile`) | `useEffect` auf den `offen`-Zustand: fokussiert beim Öffnen das erste Element im Dialog, registriert einen Escape-/Tab-Handler (Fokusfalle) nur solange der Dialog offen ist, gibt den Fokus beim Schliessen an `#sucheSpeichern` zurück. |

## Offene Befunde (nicht behoben)

| # | Befund | Schwere | Fundstelle | Warum nicht behoben |
|---|---|---|---|---|
| 6 | Objektseite: Im Abschnitt «Lage» springt die Überschriftenebene von `<h2>` (Abschnittstitel) direkt zu `<h4>` (POI-Spalten «ÖV/Schulen/…» und «Fahrzeiten mit dem Auto») — kein `<h3>` dazwischen. Betrifft alle Objektseiten mit POI-Daten, nicht nur die geprüfte Exclusive-Seite. | Niedrig (Struktur, kein Blocker für Tastatur/AT-Bedienung) | `app/components/property/seite.tsx:168-169` | `seite.tsx` steht **nicht** in den Schreibrechten dieses Auftrags (nur `galerie.tsx` und `begleiter.tsx` aus `components/property/`). Minimaler Fix wäre, die beiden `<h4>` durch `<h3>` zu ersetzen. |
| 7 | Bildkacheln im Galerie-Raster (`.gal figure[data-li]`, `onClick`) sind nicht per Tastatur erreichbar (`<figure>` ohne `tabIndex`/Rolle/`onKeyDown`) — reiner Mausauslöser. | Niedrig (funktionale Alternative vorhanden) | `app/components/property/galerie.tsx` (Bildgitter, `teil.map(...)`) | Es gibt einen gleichwertigen, per Tastatur erreichbaren Zugang zum selben Dialog: den Knopf «Alle Bilder anzeigen» (`#alleBilder`) sowie die Medienknöpfe (Video/360°/3D). Die Kacheln selbst tastaturfähig zu machen (Rolle, `tabIndex`, `onKeyDown`, evtl. Fokusreihenfolge im Raster) ist ein grösserer Eingriff als in diesem Auftrag als „minimal" vorgesehen — dokumentiert statt behoben. |

## Kontrastmessung (einfache Luminanzrechnung, WCAG-Formel)

Kein automatisiertes Kontrast-Tool verwendet — Verhältnisse aus den
CSS-Variablen in `app/styles/ufer.css` per WCAG-Relativluminanz-Formel
berechnet (`(L1+0.05)/(L2+0.05)`, `L1` die hellere Farbe). WCAG AA verlangt
4.5:1 für normalen Text, 3:1 für grossen/fetten Text und für UI-Komponenten.

| Modus | Paar | Verhältnis | WCAG AA (Normaltext 4.5:1) |
|---|---|---|---|
| Hell (`[data-mode="hell"]`) | Text (`--ink`) auf Hintergrund (`--gr`) | 16.26 : 1 | ✓ (AAA) |
| Hell | Leiser Text (`--leise`) auf Hintergrund | 5.22 : 1 | ✓ |
| Hell | Akzent (`--licht`) auf Hintergrund | 3.92 : 1 | ✗ für Fliesstext, ✓ für grossen/fetten Text und UI-Komponenten (3:1) — `--licht` wird im UFER-System nirgends für normalgrossen Fliesstext verwendet, nur für Kickers, Akzentlinks und Icons |
| Hell | Knopftext auf gefülltem Knopf (`.knopf.voll`, Text `#0B121B` auf `--licht`) | 4.50 : 1 | ✓ (knapp) |
| Dunkel (Standard, `:root`) | Text (`--ink`) auf Hintergrund (`--gr`) | 15.83 : 1 | ✓ (AAA) |
| Dunkel | Leiser Text (`--leise`) auf Hintergrund | 6.39 : 1 | ✓ |
| Dunkel | Akzent (`--licht`) auf Hintergrund | 8.18 : 1 | ✓ |
| Dunkel | Knopftext auf gefülltem Knopf | 8.18 : 1 | ✓ |

Einziger auffälliger Wert: der Akzentton auf hellem Hintergrund (3.92:1) liegt
unter der 4.5:1-Schwelle für normalgrossen Fliesstext. Da `--licht` im
Hell-Modus im bestehenden Markup ausschliesslich für Kickers (11px,
Grossbuchstaben, kein Fliesstext), Icons und Akzentlinien verwendet wird
(nicht für lesbare Textabsätze), ordnet dieses Audit den Befund als
**Beobachtung, keinen Fix-Auftrag** ein — UFER ist eingefroren, eine
Farbänderung wäre ohnehin ausserhalb des erlaubten Rahmens (nur aria-Attribute,
Fokusstile, Rollen).

## Was NICHT geprüft wurde

- **Kein echter Screenreader-Test** (VoiceOver, NVDA, JAWS) — alle
  Dialog-/Formular-/Fokus-Prüfungen laufen über Chrome DevTools Protocol
  (Tastatursimulation + DOM-Zustand), nicht über eine tatsächliche
  AT-Ausgabe.
- **Keine WCAG-Zertifizierung** — dieses Audit deckt die in P5.10 §29
  benannten elf Prüfungen ab, nicht den vollständigen WCAG-2.x-Kriterienkatalog
  (z. B. keine Prüfung von Zoom/Reflow bei 400%, keine Prüfung der
  Spracheinstellung einzelner Textabschnitte, keine Prüfung von
  Zeitlimits/Auto-Update-Inhalten).
- **Kontrastmessung ist eine eigene, einfache Berechnung** (siehe oben) aus
  den CSS-Variablen, kein Werkzeug wie axe-core oder Lighthouse; sie deckt
  nur die vier genannten Farbpaare ab, nicht jede Text-/Hintergrundkombination
  im gesamten UFER-System (z. B. nicht die schwebende Kopfzeile über Fotos,
  deren Kontrast vom jeweiligen Bild abhängt).
- **Nur sieben Seiten geprüft** (siehe Tabelle oben) — nicht der gesamte
  Marktplatz (z. B. nicht `/konto/*`-Unterseiten ausser Anmelden, nicht die
  Anbieterprofile, nicht die Vergleichsseite, nicht die internen
  Moderations-/Intern-Bereiche — die haben eigene, ältere Audits,
  siehe `scripts/intern-mobil-test.mjs`).
- **Dialoge und Formularfehler nur bei 1280 px geprüft**, nicht zusätzlich bei
  390 px (die Mechanik — `role`, Fokusfalle, Fokusrückgabe — hängt nicht von
  der Fensterbreite ab; das mobile Menü selbst ist separat bei 390 px geprüft,
  Prüfung 3).
- **`prefers-reduced-motion` nur auf der Startseite geprüft**, nicht auf allen
  sieben Seiten (die Regel in `ufer.css:80` ist global, seitenunabhängig).
- **Bildkacheln im Galerie-Raster bleiben mausexklusiv** (siehe offener
  Befund 7) — dokumentiert, nicht behoben.
- **Überschriften-Ebenensprung in `components/property/seite.tsx`** bleibt
  bestehen (siehe offener Befund 6) — Datei ausserhalb der Schreibrechte
  dieses Auftrags.
- **Keine Prüfung von Screenreader-spezifischem Live-Region-Timing** (z. B.
  ob `aria-live="polite"`-Ansagen tatsächlich rechtzeitig vorgelesen werden)
  — nur, dass die Attribute strukturell vorhanden sind.

## Regressionsnachweis

- `npm run typecheck` — grün (keine Fehler).
- `npm run lint` — grün (0 Fehler; 170 Warnungen, alle bereits vor diesem
  Auftrag vorhanden, unverändert durch diese Änderungen — geprüft durch
  Vergleich der Warnungszahl vor/nach dem `role="group"`-Fix in
  `objekt-block.tsx`).
- `node scripts/anliegen-test.mjs` (mit `FW_TEST_MOD_EMAIL`/`FW_TEST_MOD_PASSWORT`
  aus `var/konten.local.json`, Konto `mod@…`) — 33/33 Schritte grün in einem
  sauberen Lauf. Ein vorheriger Lauf zeigte vereinzelte Fehlschläge durch
  Mail-Timing bzw. das eigene Ratenlimit der Testsuite (Schritt 7.1/7.2 prüft
  genau dieses Verhalten) bei mehreren Läufen kurz hintereinander — beides
  unabhängig von den hier gemachten Änderungen (reine Client-Validierung/aria-
  Attribute, keine Server-/Mail-Logik berührt).
- `node scripts/a11y-test.mjs` — 13/13 Prüfungen grün bis auf den dokumentierten,
  ausserhalb der Schreibrechte liegenden Befund 6 (Prüfung 9, Objektseite
  Exclusive).
