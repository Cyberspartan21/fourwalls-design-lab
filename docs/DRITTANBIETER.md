# Drittanbieter — Stand nach P5.9 Entscheid 23

Diese Seite hält fest, welche externen Hosts die Anwendung im Browser noch
anspricht, welche Bibliotheken/Schriften selbst gehostet werden, und dass es
kein Analytics/Tracking/Embed gibt. Grundlage: `lib/sicherheitskoepfe.ts`
(CSP) und die Änderungen in P5.9 Entscheid 23 (Schriften und MapLibre selbst
hosten, Attribution korrekt, Bilder mit Massen).

## Extern angesprochene Hosts (Stand: nach diesem Paket)

Nur zwei Zwecke, beide fachlich notwendig (Kartendaten), keiner davon lädt
Skripte oder Schriften:

- **`https://*.geo.admin.ch`** (swisstopo) — Kartenstil, Glyphen, Sprite und
  Vektorkacheln (`vectortiles.geo.admin.ch`, `vectortiles0-4.geo.admin.ch`).
  Amtliche Schweizer Geodaten, offen, ohne Schlüssel. Quelle wird an der
  Karte genannt (`© swisstopo`, verlinkt).
- **`https://tiles.openfreemap.org`** — Rückfallkarte, falls swisstopo nicht
  antwortet. Ebenfalls offen, ohne Schlüssel. Quelle wird an der Karte
  genannt (`© OpenStreetMap-Mitwirkende · © OpenFreeMap`, verlinkt).
- Objektspeicher-Ableitungen (Bilder) kommen von `S3_PUBLIC_BASE_URL`, wenn
  `STORAGE_PROVIDER=s3` gesetzt ist (lokal: `local`, keine externe Adresse).

**Entfernt in diesem Paket:** `fonts.googleapis.com`, `fonts.gstatic.com`
(Google Fonts) und `cdnjs.cloudflare.com` (MapLibre GL) — die Anwendung
spricht diese Hosts nicht mehr an. Geprüft per `curl` gegen die laufende
Anwendung (`content-security-policy`-Kopfzeile und Seitenquelltext enthalten
keine dieser drei Zeichenketten mehr) und in `lib/sicherheitskoepfe.ts`
(CSP: `script-src`, `style-src`, `font-src` ohne fremde Hosts).

## Selbst gehostete Bibliotheken und Schriften

| Was | Version | Lizenz | Quelle | Wo im Repository |
|---|---|---|---|---|
| MapLibre GL JS | 5.6.0 (identisch zur bisherigen cdnjs-Version) | BSD-3-Clause | npm-Paket `maplibre-gl` | `node_modules/maplibre-gl` (Laufzeit-Abhängigkeit in `app/package.json`); dynamisch importiert in `app/components/map/ukarte.js`, das selbst nur per `import()` geladen wird (eigenes Bündel, nicht im Hauptpaket) |
| Petrona (variabel, wght 100–900, aufrecht + kursiv) | Fontsource-Paket-Version 5.3.0 (Schriftdaten Google-Fonts-Stand) | SIL Open Font License 1.1 | `@fontsource-variable/petrona` (npm, Entwicklungsabhängigkeit — nur zum Beschaffen der Dateien) | `app/public/fonts/petrona-latin-wght-normal.woff2`, `petrona-latin-wght-italic.woff2`, Lizenz in `app/public/fonts/LICENSE-Petrona.txt`; `@font-face` in `app/styles/ufer.css` |
| Manrope (variabel, wght 100–900) | Fontsource-Paket-Version 5.3.0 | SIL Open Font License 1.1 | `@fontsource-variable/manrope` (npm, Entwicklungsabhängigkeit) | `app/public/fonts/manrope-latin-wght-normal.woff2`, Lizenz in `app/public/fonts/LICENSE-Manrope.txt`; `@font-face` in `app/styles/ufer.css` |

Nur das Subset **latin** wurde übernommen: sein Unicode-Bereich
(`U+0000-00FF,U+0131,U+0152-0153,…`) deckt sowohl «œ» (U+0152/U+0153) als
auch «ß» (U+00DF) ab — die deutschen, französischen und italienischen Texte
der Anwendung brauchen kein Zeichen aus dem separaten `latin-ext`-Subset
(geprüft gegen die von den Fontsource-Paketen ausgelieferten
Unicode-Bereiche). Variable Schriftschnitte statt einzelner Schnitte pro
Gewicht — weniger Dateien, eine Achse deckt 300–600 (Manrope) bzw. 200–500
(Petrona) ab, ohne dass die Datenmenge pro Zeichen steigt (`woff2-variations`
enthält alle Gewichte in einer Datei).

## Analytics, Tracking, Embeds

Keine. Es gibt kein Analytics-Skript, keinen Tracking-Pixel und kein
eingebettetes Drittanbieter-Widget (kein YouTube/Vimeo/Google Maps/Social
Embed). Die einzigen externen Netzwerkanfragen des Browsers sind die beiden
Kartendienste oben, plus — falls konfiguriert — der eigene S3-kompatible
Objektspeicher für Bilder.
