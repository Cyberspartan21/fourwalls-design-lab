# FOURWALLS — Leistung & Last (P5.10 §23–§27)

Bericht zu vier Prüfungen: Produktions-Leistung (§26), Bildpipeline-Audit
(§27), Marktplatz-Last (§23), Last der Anbieter-Übersicht (§24) und der
Anliegen-Übersicht (§25). Alle Messungen liefen **lokal** gegen einen
Produktions-**Build** (`next build` + `.next/standalone/server.js`), nicht
gegen eine gehostete Produktionsumgebung — Fourwalls hat noch keine (siehe
`docs/PRODUCTION-INFRA-DEFERRED.md`). Wo das für die Interpretation wichtig
ist, steht es nochmals ausdrücklich dabei.

## Kurzfassung

- Produktions-Build lief sauber (`next build --webpack`, siehe Methodik),
  Server auf Port 3008 in einer isolierten Kopie des Projekts (Begründung
  unten). Acht Seiten × 2 Geräte gemessen: keine Seite reisst das JS-Budget,
  MapLibre lädt nachweislich nur auf der Karten-Ansicht, CLS ist überall
  0.0000, LCP lokal überall < 1 s (als **lokal** gekennzeichnet, siehe §26).
- Bildpipeline-Audit: drei echte Abweichungen gefunden und behoben (Sizes
  auf der Startseiten-Kachel/Mosaik/Galerie trafen die reale Spaltenbreite
  nicht; „erstes sichtbares Bild eager" fehlte auf der Startseite und im
  Galerie-Gitter). Reine Attribut-Änderungen, keine Layout-Änderung, CLS
  vorher/nachher identisch (0.0000).
- Marktplatz-Last (§23): bestehender `skalen-test.mjs`-Bericht (320–50 000
  Inserate) wiederverwendet (siehe Begründung), zehn ergänzende Fälle aus dem
  Auftrag frisch gemessen (EXPLAIN ANALYZE, Median aus 3 Läufen + HTTP gegen
  :3008). Kein Seq Scan über 50 ms beim Ist-Bestand; die aus dem
  historischen Bericht bekannten Schwachstellen bei 50 000 Inseraten
  (Sortierung CHF/m², Ähnliche Inserate) bestehen unverändert — Vorschläge
  unten, nicht gebaut.
- Anbieter-Last (§24): **blockiert** durch einen Fehler im bestehenden
  Skript `scripts/skalen-org-test.mjs` (Datenbank-Trigger lehnt Anfragen an
  nicht-veröffentlichte Inserate ab, das Skript legt aber genau solche an) —
  Root Cause dokumentiert, Testdaten der abgebrochenen Stufe aufgeräumt,
  Korrekturvorschlag unten, **nicht** gebaut (Skript ist ausserhalb meiner
  Zuständigkeit für diesen Auftrag).
- Anliegen-Last (§25): sauber durchgelaufen, alle Fälle < 20 ms bei 10 000
  Zeilen, ein erwarteter Seq Scan bei ~19 ms (Volltext) wie im Auftrag
  vorgesehen dokumentiert, keine Optimierung nötig.
- Aufräumen bestätigt: Server auf :3008 beendet, keine Synth-Daten übrig,
  Dev-Server :3007 unberührt, `tsc`/`lint` grün, `lieferkette-test.mjs`
  gegen :3007 grün (33/33 Schritte).

---

## Methodik & Randbedingungen

### Produktions-Build ohne den laufenden Dev-Server zu gefährden

Der Dev-Server auf :3007 lief die ganze Zeit unverändert weiter (`next dev -p
3007` im echten Projektordner, eigenes `.next`). `next build` schreibt in
denselben Standard-Ordner `.next` wie `next dev` — ein Build **im selben
Ordner** hätte das laufende `.next` des Dev-Servers überschrieben/vermischt
(Manifeste, Webpack-Cache) und ihn mit hoher Wahrscheinlichkeit beschädigt.
Das widerspricht der Vorgabe „Dev-Server :3007 läuft — nicht neu starten".

Lösung: Das Projekt wurde nach
`/private/tmp/.../scratchpad/fw-h7-build` **kopiert** (ohne `.next`, ohne
`node_modules` — `node_modules` wurde per Symlink auf das echte, im Betrieb
befindliche Verzeichnis verwiesen, rein lesend). Dort lief `next build`
(mit `--webpack`, siehe unten) in einem komplett eigenen `.next`. Ergebnis:
Der Dev-Server auf :3007 war während des gesamten Vorgangs nie betroffen
(mehrfach mit `lsof`/`ps` geprüft). Für den CLS-Vorher/Nachher-Vergleich
(§27) wurde eine zweite, unabhängige Kopie mit dem **alten** Stand der vier
geänderten Dateien gebaut und auf Port 3009 betrieben, nach der Messung
sauber beendet (PID über `lsof -p <pid> | grep cwd` als Kopie-Prozess
verifiziert, dann `kill`).

`--webpack` statt der Turbopack-Vorgabe: Turbopack verweigerte den Build mit
`Symlink [project]/node_modules is invalid, it points out of the filesystem
root` (der Symlink zeigt vom `/private/tmp`-Baum auf `/Users/...` — für
Turbopacks Projektwurzel-Prüfung ausserhalb des erlaubten Baums). Der
reguläre Webpack-Build hat damit kein Problem und ist für diese Messung
gleichwertig (Produktionsbundle, keine Turbopack-spezifische Optik).

`APP_ENV` blieb **development** (wie in `.env.local`), nicht `production`:
Ein Testlauf mit `APP_ENV=production` brach den Build ab, weil
`domain/env.ts` in Produktion echte Infrastruktur verlangt (verschlüsselte
DB-Verbindung, echter Speicher- und Mail-Anbieter, echte Domain — siehe
Fehlermeldung unten). Das Projekt hat laut `docs/PRODUCTION-INFRA-DEFERRED.md`
bewusst noch keine solche Infrastruktur. Gemessen wurde deshalb ein
**Produktions-Build mit Entwicklungs-Konfiguration** — das ist die einzige
in diesem Projektstand mögliche Annäherung an „Produktions-Leistung" und
wird unten konsequent als **lokal** gekennzeichnet.

```
Error: Failed to collect configuration for /api/anliegen
  Umgebung unvollständig oder ungültig:
    DEMO_INHALTE: … STORAGE_PROVIDER: Der lokale Speicher ist in production nicht erlaubt
    MAIL_PROVIDER: … DATABASE_URL: Eine lokale Datenbank ist in production nicht erlaubt … usw.
```

### Server-Start (Vorgabe befolgt)

```
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
(set -a; . ./.env.local; set +a; PORT=3008 node .next/standalone/server.js &)
```
— unverändert wie vorgegeben, nur im Kopie-Verzeichnis statt im
Original-Ordner ausgeführt.

### Werkzeug: eigenes CDP-Skript, kein Puppeteer

Das Projekt hat keine Browser-Automatisierung als Abhängigkeit
(`package.json` enthält weder Puppeteer noch Playwright). `scripts/leistung-test.mjs`
startet **Google Chrome** headless
(`--headless=new --remote-debugging-port=<Port≥9700> --user-data-dir=/tmp/fw-h7-<port>`)
und spricht das Chrome DevTools Protocol direkt über Node 26s eingebautes
`WebSocket` an (kein zusätzliches npm-Paket). Node/Chrome-Version: Node
v26.0.0, Google Chrome (system, `/Applications/Google Chrome.app`).

Gemessen wird je Seite × Gerät (Desktop 1280×860, Mobil 390×844 mit
iPhone-User-Agent, `Emulation.setDeviceMetricsOverride`):

- **Anzahl Requests, Bytes gesamt**, je Kategorie (HTML/JS/CSS/Font/Bild)
  aus `Network.loadingFinished.encodedDataLength` (das sind die **echten
  Wire-Bytes**, wie Chrome sie mit `Accept-Encoding: gzip, br` ausgehandelt
  hat — siehe Kompressions-Befund unten).
- Für JS/CSS zusätzlich `Network.getResponseBody` (liefert immer die
  entschlüsselte Originalgrösse) → **wahre unkomprimierte Grösse**; wenn der
  Server selbst NICHT komprimiert hatte, zusätzlich eine Gzip-Schätzung per
  `node:zlib`.
- **TTFB, DOMContentLoaded, Load** aus `performance.getEntriesByType('navigation')[0]`
  (Level-2-Timing, `responseStart` ist bereits TTFB relativ zum Navigationsstart).
- **LCP** per `PerformanceObserver({type:'largest-contentful-paint', buffered:true})`,
  Element benannt (Tag/ID/Klassen).
- **CLS** per `PerformanceObserver({type:'layout-shift', buffered:true})`,
  Summe ohne `hadRecentInput`.
- **MapLibre-Nachweis**: Produktions-Chunk-Namen sind gehasht
  (`4784-5b25009b3e9c273e.js`) und verraten die Bibliothek nicht über die
  URL — deshalb wird der tatsächliche Skriptinhalt jedes JS-Chunks auf die
  Zeichenkette `"maplibre"` geprüft (übersteht Minifizierung).
- **5 grösste Ressourcen** je Seite/Gerät.

Aufruf: `node scripts/leistung-test.mjs http://localhost:3008` → Tabellen auf
stdout, vollständige Daten in `var/leistung-bericht.json`.

**Lokale Streuung**: Wiederholte Läufe auf derselben Maschine schwankten
deutlich (z. B. Start/Desktop-TTFB zwischen 8 ms und 512 ms je nach
Systemlast — auf dieser Maschine liefen parallel weitere Agenten-Skripte,
der Dev-Server und diverse Editor-Prozesse). Alle Zeitwerte unten sind daher
**Anhaltswerte**, keine belastbaren Produktionszahlen; die einzige robuste
Aussage ist die relative Grössenordnung und die Bytes-/Request-Zahlen (die
schwanken kaum).

---

## §26 Produktions-Leistung

### Ergebnistabelle (ein repräsentativer Lauf, `var/leistung-bericht.json`)

| Seite | Gerät | Requests | Bytes gesamt | TTFB | DCL | Load | LCP (Element) | CLS | MapLibre |
|---|---|---|---|---|---|---|---|---|---|
| Start | desktop | 23 | 542 KB | 41 ms | 147 ms | 203 ms | 204 ms (IMG) | 0.0000 | nein |
| Start | mobil | 20 | 520 KB | 43 ms | 92 ms | 186 ms | 132 ms (IMG) | 0.0000 | nein |
| Kaufen-Suche | desktop | 44 | 1027 KB | 68 ms | 99 ms | 208 ms | 196 ms (IMG) | 0.0000 | nein |
| Kaufen-Suche | mobil | 26 | 752 KB | 40 ms | 71 ms | 144 ms | 140 ms (IMG) | 0.0000 | nein |
| Objekt Exclusive | desktop | 25 | 626 KB | 216 ms | 247 ms | 399 ms | 368 ms (IMG) | 0.0000 | nein |
| Objekt Exclusive | mobil | 22 | 598 KB | 127 ms | 441 ms | 484 ms | 288 ms (IMG) | 0.0000 | nein |
| Objekt Standard | desktop | 17 | 423 KB | 86 ms | 138 ms | 213 ms | 160 ms (IMG) | 0.0000 | nein |
| Objekt Standard | mobil | 17 | 407 KB | 41 ms | 85 ms | 135 ms | 100 ms (IMG) | 0.0000 | nein |
| Karte | desktop | 39 | 1014 KB | 153 ms | 237 ms | 334 ms | 532 ms (P) | 0.0000 | **ja** |
| Karte | mobil | 22 | 694 KB | 152 ms | 263 ms | 420 ms | 600 ms (P) | 0.0000 | **ja** |
| Verkaufen | desktop | 14 | 379 KB | 11 ms | 33 ms | 96 ms | 68 ms (P) | 0.0000 | nein |
| Verkaufen | mobil | 14 | 379 KB | 19 ms | 53 ms | 98 ms | 88 ms (LI) | 0.0000 | nein |
| Wissen-Beitrag | desktop | 14 | 382 KB | 25 ms | 61 ms | 108 ms | 72 ms (P) | 0.0000 | nein |
| Wissen-Beitrag | mobil | 14 | 382 KB | 23 ms | 146 ms | 147 ms | 92 ms (P) | 0.0000 | nein |
| Anbieterseite | desktop | 26 | 586 KB | 78 ms | 184 ms | 187 ms | 184 ms (IMG) | 0.0000 | nein |
| Anbieterseite | mobil | 22 | 614 KB | 42 ms | 184 ms | 185 ms | 172 ms (IMG) | 0.0000 | nein |

**Bewertung LCP**: alle Werte liegen lokal deutlich unter der 2.5-s-Schwelle
(schlechtester Wert: Karte/Mobil 600 ms). **Das ist ausdrücklich kein Beweis
für Produktion** — reales Hosting hat Netzwerklatenz (Swiss/EU-Rechenzentrum
statt localhost), TLS-Handshake, echte Nutzer-Endgeräte und ggf. ein CDN vor
den Bildern, was diese Zahlen in beide Richtungen verschieben kann. Die
Aussage, die diese Messung stützt, ist enger: *Auf Anwendungsebene gibt es
keinen offensichtlichen LCP-Blocker* (kein blockierendes synchrones Skript
vor dem grössten Bild, keine riesige Einzelressource vor dem ersten Render
ausser dem MapLibre-Chunk auf der Karten-Seite selbst).

### JS-Budget & MapLibre-Nachweis

| Seite | JS (Wire, komprimiert) | JS unkomprimiert (wahre Bundle-Grösse) | MapLibre geladen? |
|---|---|---|---|
| Start / Verkaufen / Wissen-Beitrag / Anbieterseite / Objekt Standard | ~206–219 KB | 649–682 KB | nein |
| Kaufen-Suche | 234 KB | 743 KB | nein |
| Objekt Exclusive | 219 KB | 682 KB | nein |
| **Karte** | **480 KB** | **1655 KB** | **ja** |

**Beleg für „MapLibre lädt nur auf der Karte"**: Der 240 KB grosse Chunk
`702b0e5e.….js` enthält die Zeichenkette `maplibre` und erscheint **nur**
beim Aufruf von `/immobilien/kaufen?ansicht=karte` unter den geladenen
Skripten (Top-Ressource dieser Seite). Auf den Objektseiten (Standard und
Exclusive) — die ebenfalls eine Lagekarte im Abschnitt „Lage" haben — lädt
beim initialen Seitenaufruf **kein** MapLibre-Code; Grund im Quelltext
(`components/property/lage-karte.tsx`, Zeile 68 und 75):

```
const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); bauen(); } }, { rootMargin: "200px" });
…
const { detailKarte } = await import("@/components/map/detail-map");
```

Die Lagekarte lädt per `dynamic import` **erst**, wenn der Abschnitt in die
Nähe des Viewports scrollt (200 px Vorlauf) — ein sauberes, bereits
vorhandenes Muster, das kein initiales JS-Budget für Objektseiten kostet.
Es gibt **keine serverseitige Clustering-API** (kein Treffer für „cluster"
in `server/`; die Kartenansicht rendert Einzelpunkte aus der normalen
Kartenausschnitt-Suche, `q.modus==="map"`, LIMIT 2000 Punkte, siehe §23) —
der Auftragstext ging von einer Clustering-API aus, die es in diesem
Projektstand nicht gibt. Das ist eine Feststellung, keine gebaute Änderung.

### Kompressions-Befund (wichtig für die Bytes-Interpretation)

Der Standalone-Server komprimiert **nicht einheitlich**:

| Antworttyp | Beispiel | `Content-Encoding` mit `Accept-Encoding: gzip, br` |
|---|---|---|
| HTML-Seiten (SSR) | `/de`, `/de/immobilien/kaufen`, Objektseiten | **gzip** |
| Statische JS/CSS-Chunks | `/_next/static/chunks/*.js` | **gzip** |
| **JSON-API-Routen** | `/api/search`, vermutlich alle `app/api/**/route.ts` | **keine** (nur `Transfer-Encoding: chunked`) |
| Bilder | `/img/*.png`, `.webp`, `.jpg` | keine (bereits komprimierte Formate, korrekt so) |

Belegt per `curl -H "Accept-Encoding: gzip, br"` gegen :3008. Für die
Server-Antwortzeiten-Messung (unten) ist das relevant: die Suchseite selbst
(SSR-HTML) wird komprimiert ausgeliefert, aber ruft `/api/search` clientseitig
NICHT auf (die Suchseite ist serverseitig gerendert) — die fehlende
Kompression bei API-Routen betrifft direkte API-Aufrufe (z. B. clientseitige
Nachladefunktionen, externe Integrationen), nicht den Erstaufruf der Seite.
**Empfehlung P2** (nicht gebaut, ausserhalb der erlaubten Dateien): Next.js'
eingebaute Kompression greift automatisch für Page-Responses, aber
offenbar nicht für `Response.json(...)` aus Route-Handlern unter Node —
das lohnt eine gezielte Prüfung (z. B. `compress: true` ist Next-Standard,
Ursache vermutlich node:http-Server-Konfiguration im `standalone`-Ausgang).

Weil real komprimiert wird, sind die „Bytes gesamt" oben bereits die reale
Wire-Grösse — keine zusätzliche Gzip-Schätzung nötig für die grossen Dateien;
nur eine einzelne, unter dem Next-internen Kompressions-Schwellenwert
liegende 470-Byte-Datei (`main-app-*.js`) kam unkomprimiert und wurde per
`node:zlib` geschätzt (220 Byte) — vernachlässigbar.

### Grösste Einzelressource: `logo-ink.png` (68.8 KB) auf praktisch jeder Seite

Auf 7 von 8 Seiten ist `public/img/logo-ink.png` (68.8 KB, PNG) die grösste
Einzelressource überhaupt (grösser als jeder JS-Chunk ausser dem
Karten-spezifischen MapLibre-Bundle). Es wird **nicht** über ein `<img>`,
sondern als CSS-`mask-image` in `styles/ufer.css` Zeile 97 geladen
(`.fw .k{…mask-image:url(/img/logo-ink.png)}`) — das ist das
Kopf-Monogramm, das laut Projektregeln eingefroren ist («UFER ist
eingefroren … Logo … nicht neu gestalten») und ausserdem in einer CSS-Datei
liegt, die nicht zu den für diesen Auftrag freigegebenen Dateien gehört.

**Empfehlung P1** (nicht gebaut — betrifft `styles/ufer.css` und die
Bild-Datei selbst, beides ausserhalb der Berechtigung dieses Berichts): Ein
68.8 KB PNG als CSS-Maske, die auf **jeder** Seite geladen wird, ist für ein
kleines Kopf-Monogramm ungewöhnlich gross — eine verlustfrei komprimierte
oder als SVG-Maske ausgeführte Version dürfte auf einen Bruchteil davon
kommen, ohne das eingefrorene Design zu ändern (reine Dateioptimierung,
keine Gestaltungsänderung).

### Server-Antwortverhalten der Suchseite (`/de/immobilien/kaufen`)

| Messung | Median | Max |
|---|---|---|
| 20 sequentielle Aufrufe | 48.4 ms | 124.5 ms |
| 10 parallele Aufrufe | 155.6 ms | 157.1 ms (Gesamtdauer aller 10: 158.1 ms) |

Die 10 parallelen Aufrufe liefen praktisch gleichzeitig ab (Gesamtdauer ≈
längster Einzelaufruf) — kein Hinweis auf eine serialisierende Ressource
(z. B. eine einzelne DB-Verbindung, `max:1`) unter dieser Last. Bei stärkerer
Last wäre das erneut zu prüfen (Verbindungs-Pool-Grösse von `postgres()` in
`server/db.ts` wurde in diesem Auftrag nicht geprüft — siehe offene Punkte).

---

## §27 Bildpipeline-Audit

### Vorgefundener Zustand

- **`width`/`height`/`aspect-ratio`**: überall vorhanden (P5.9-Ergebnis
  bestätigt) — jedes `<img>` in `karte.tsx`, `bild.tsx`, `galerie.tsx`,
  `seite.tsx` hat `style={{aspectRatio: "…"}}`. CLS ist deshalb bereits vor
  diesem Auftrag 0.0000 gewesen (siehe Vergleich unten).
- **Lazy/Eager**: `components/property/bild.tsx` unterstützte `eager`
  bereits korrekt (`loading="eager" fetchPriority="high"` vs.
  `loading="lazy" decoding="async"`), und die Objektseiten-Hero-Bilder
  (Premiere/Mosaik) nutzten das schon richtig — **aber**:
  - `components/marktplatz/karte.tsx` (Ergebniskarte des Marktplatzes) hatte
    **gar keine** `eager`-Option — jedes Kartenbild war immer `loading="lazy"`,
    auch das allererste, meist oberhalb des Falts sichtbare auf der
    Startseite.
  - `components/property/galerie.tsx` (Bildgitter im Abschnitt „Bilder")
    hatte ebenfalls keine `eager`-Option — jedes Gitterbild war immer lazy.
- **`sizes` vs. reale Spaltenbreite**: nicht in allen drei Rastern korrekt.

### Behobene Abweichungen (nur Attribute, keine Layout-Änderung)

**1. `components/marktplatz/karte.tsx`** — `.gitter` ist ein
`grid-template-columns:repeat(auto-fill,minmax(296px,1fr))`-Raster
(`styles/portal.css`), das je nach Breite 1–5 Spalten zeigt. Die reale
Spaltenbreite liegt bei ~1200 px Viewport bei ≈30 vw (3 Spalten), bei sehr
breiten Bildschirmen (≥1900 px) bei ≈18 vw (5 Spalten) — das feste
`sizes="… , 25vw"` war eine grobe Mitte. Neue Stufen:
`"(max-width:700px) 100vw, (max-width:1100px) 50vw, (max-width:1700px) 33vw, 20vw"`
(passender an den in `docs`-Auftrag genannten 3-Spalten-Fall ≈33vw).
Zusätzlich neue `eager`-Prop: erstes sichtbares Kartenbild kann jetzt
`loading="eager" fetchPriority="high"` bekommen.

**2. `app/[locale]/page.tsx`** — erstes Bild der „Exclusive"-Kachelreihe auf
der Startseite bekommt jetzt `eager` übergeben (`treffer.map((l,i)=>… eager={i===0}`).
Das ist auf der Startseite in aller Regel das LCP-Element (bestätigt:
LCP-Element = `IMG` in der Messung oben).

**3. `components/property/seite.tsx`** — Mosaik-Held (Standard-Objektseite,
2fr/1fr-Raster, erste Kachel spannt 2 Zeilen): alle drei Kacheln hatten
dasselbe `sizes="…, 60vw"`, obwohl die erste Kachel real ≈66 vw und die
beiden anderen real ≈33 vw einnehmen (unter 960 px wird das Raster zudem
zweispaltig — auch dort war „100vw" falsch, real ≈50vw je Kachel). Neu:
erste Kachel `"(max-width:960px) 50vw, 66vw"`, die anderen beiden
`"(max-width:960px) 50vw, 33vw"`.

**4. `components/property/galerie.tsx`** — Bildgitter `.gal` hat 12 Spalten
mit sechs wiederkehrenden Kachel-Spannweiten (`g0`…`g5` = 7/5/4/8/6/6 von
12); alle hatten `sizes="…, 50vw"`. Reale Breiten (bei 1280 px Viewport, wo
`.dhaupt` ≈63 vw misst) liegen zwischen ≈20 vw (g2) und ≈42 vw (g3) — nie
50 vw. Neu: je Kachel-Index ein eigener Wert (36/26/20/42/31/31 vw), unter
960 px weiterhin 100 vw (dort werden die Kacheln laut CSS volle Breite).
Zusätzlich: erstes Gitterbild bekommt jetzt `eager`.

*(Hinweis zur Selbst-Prüfung: Das erste Gitterbild im Abschnitt „Bilder" ist
inhaltlich dasselbe Foto wie `bilder[0]`, das auf Nicht-Exclusive-Seiten
bereits im Mosaik-Held oberhalb dieses Abschnitts eager geladen wird. Der
Auftrag verlangt ausdrücklich „Galerie: erstes Bild eager" — umgesetzt wie
beschrieben; ob das für dieses spezielle Duplikat (Held + Gitter, gleiches
Foto, unterschiedliche Grösse) tatsächlich Bandbreite spart oder eher ein
zweites, unterhalb des Falts liegendes Eager-Bild erzeugt, hängt vom
Bildschnitt/den Sizes ab und wurde nicht vertieft geprüft — zur Kenntnis für
die Prüfung.)*

### Bestätigungen ohne Änderungsbedarf

- **`components/property/bild.tsx`**: unverändert, war bereits korrekt
  (Default-`sizes` sinnvoll, `eager`-Mechanik sauber).
- **Anbieter-Logo** (`app/[locale]/_anbieter/gemeinsam.tsx`, Zeile 116):
  96×96 px, kein `loading`-Attribut, Standard-Browser-Verhalten (eager). Bei
  dieser Grösse vernachlässigbar; die Datei liegt **ausserhalb der für
  diesen Auftrag freigegebenen Dateien** (nicht in der Liste), deshalb nicht
  angefasst — nur dokumentiert.
- **Wissensseiten**: bestätigt bilderfrei. `grep` auf `<img`/`<picture` in
  `app/[locale]/wissen/page.tsx` und `.../wissen/[slug]/page.tsx` liefert
  keinen Treffer.

### CLS vorher/nachher (Start, Objekt Exclusive)

Gemessen gegen zwei unabhängige Produktions-Builds — einen mit dem
ursprünglichen Stand der vier geänderten Dateien (Port 3009, danach sauber
beendet), einen mit dem neuen Stand (Port 3008):

| Seite | Gerät | CLS vorher | CLS nachher |
|---|---|---|---|
| Start | desktop | 0.0000 | 0.0000 |
| Start | mobil | 0.0000 | 0.0000 |
| Objekt Exclusive | desktop | 0.0000 | 0.0000 |
| Objekt Exclusive | mobil | 0.0000 | 0.0000 |

Keine Regression — erwartbar, da nur `loading`/`fetchPriority`/`sizes`
geändert wurden, nie die reservierte Fläche (`aspect-ratio` blieb
unverändert in allen vier Dateien).

### Prüfungen nach den Attribut-Fixes

```
npx tsc --noEmit         → 0 Fehler
npx eslint components/property/galerie.tsx components/property/seite.tsx \
  components/property/bild.tsx components/marktplatz/karte.tsx "app/[locale]/page.tsx"
                          → 0 Fehler, 0 Warnungen
node scripts/lieferkette-test.mjs http://localhost:3007
                          → 33 Schritte, 0 FEHLER, 33 OK
```

---

## §23 Marktplatz-Last

### Was `scripts/skalen-test.mjs` aufbaut (gelesen, nicht verändert)

Erzeugt je Stufe (320 [Ist-Bestand, ungeändert] / 2000 / 10000 / 50000)
synthetische `property`/`listing`-Zeilen mit `public_ref` beginnend
`FWI-2026-9…`/`FWL-2026-9…`, durchläuft die vier echten Statuswechsel
(`draft→submitted→in_review→approved→published`) und misst sieben feste
`EXPLAIN (ANALYZE, BUFFERS)`-Abfragen (Standardsuche, Preis+Zimmer, Umkreis
20 km Luzern, Kartenausschnitt Miete, Zählung mit Facetten, Sortierung
CHF/m², Ähnliche Inserate) je dreifach, Median als Ergebnis. Am Ende werden
alle Synth-Zeilen restlos gelöscht und `VACUUM ANALYZE` ausgeführt; das
Skript bricht bei > 10 Minuten für die 50 000er-Stufe ab.

### Entscheidung: bestehenden Bericht wiederverwenden statt neu zu seeden

In dieser Runde laufen laut Auftrag parallel weitere Prüfspuren (H3a/H3b
Sicherheit, H8 Mobil/A11y) **gegen denselben Dev-Server :3007 und dieselbe
Datenbank**. `skalen-test.mjs` fügt bei der 50 000er-Stufe kurzzeitig **50 000
zusätzliche Zeilen** in die von der Suche gelesene `listing`-Tabelle ein
(Fassaden-Views wie `listing_public` eingeschlossen) — das würde Treffer-
und Facettenzahlen für jeden gleichzeitig laufenden Test verändern, der die
öffentliche Suche gegen :3007 aufruft. Ein vollständiger Neu-Lauf hätte
dieses Kollisionsrisiko für die parallelen Prüfspuren erzeugt, ohne dass ich
deren Skripte kenne oder koordinieren kann.

Es liegt bereits ein vollständiger, sauberer Bericht in
`var/skalen-bericht.json` vor (erzeugt 2026-09-03T20:24:30Z, alle vier
Stufen durchgelaufen, `rest_synth_am_ende: 0`, Ist-Bestand vorher/nachher
unverändert). Ich habe diesen **wiederverwendet** statt neu zu erzeugen und
stattdessen die im Auftrag zusätzlich verlangten sechs Fälle **rein lesend**
(nur `SELECT`/`EXPLAIN`, keine Schreiboperation) gegen den aktuellen
Ist-Bestand ergänzt — das hat kein Kollisionsrisiko. **Das ist eine
Sicherheitsentscheidung, keine für mich zulässige Abkürzung ohne Beleg** —
zur Prüfung: falls ein vollständiger Neu-Lauf bei 2000/10000/50000
gewünscht ist, ist dafür ein Zeitfenster ohne parallele :3007-Last nötig.

### Historischer Bericht (`var/skalen-bericht.json`, wiederverwendet)

Median-ms aus `EXPLAIN ANALYZE` (DB-Zeit, nicht Client-Zeit):

| Abfrage | 320 | 2 000 | 10 000 | 50 000 | Index bei 50 000 |
|---|---|---|---|---|---|
| 1 Standard (neu, Kauf) | 0.18 | 0.22 | 0.21 | 2.12 | `listing_aktiv_neu` |
| 2 Preis+Zimmer | 0.73 | 0.24 | 0.92 | 8.86 | `listing_aktiv_preis` |
| 3 Umkreis 20 km Luzern | 0.24 | 0.64 | 2.10 | **117.48** | `listing_geom_gix` |
| 4 Kartenausschnitt (Miete) | 0.32 | 1.14 | 0.39 | 0.61 | `listing_geom_gix` |
| 5 Zählung mit Facetten | 0.96 | 0.57 | 0.84 | 0.57 | `listing_geom_gix` |
| 6 Sortierung CHF/m² | 0.59 | 5.52 | 13.07 | **138.66** | *(kein Index)* |
| 7 Ähnliche Inserate | 1.17 | 6.34 | 20.76 | **210.36** | *(kein Index)* |

Drei Fälle überschreiten bei 50 000 Inseraten die im Skript selbst
angesetzte 200-ms-Schwelle „für interaktive Suche ungeeignet" (# 3, 6, 7).
**Empfehlung P1** (Beleg vorhanden, nicht gebaut — betrifft
Datenbankmigration/Indizes, ausserhalb der freigegebenen Dateien dieses
Auftrags):
- # 6 (Sortierung CHF/m²) und # 7 (Ähnliche Inserate, nutzt denselben
  berechneten Wert) sortieren/filtern über den **berechneten** Ausdruck
  `price_per_m2`, für den kein Index existiert — ein funktionaler Index auf
  diesem Ausdruck (gefiltert auf `status='published'`) sollte beide Fälle
  deutlich beschleunigen.
- # 3 (Umkreis) verwendet zwar bereits `listing_geom_gix`, degradiert aber
  bei grossem Bestand dennoch — das ist plausibel, wenn der Umkreis (20 km
  um Luzern) einen grossen Anteil der 50 000 synthetischen Zeilen trifft
  (sie sind gleichmässig über die Schweiz verteilt, siehe Erzeugung im
  Skript); bei realistischerer, ungleichmässiger Verteilung (Ballungsräume)
  wäre der Effekt vermutlich kleiner. Nur als Hinweis, nicht weiter geprüft.

### Zehn ergänzende Fälle (frisch gemessen, Ist-Bestand, Median aus 3 Läufen)

Eigenes, nicht ins Repository übernommenes Hilfsskript (siehe „Ausserhalb
der freigegebenen Dateien" unten), rein lesend gegen die tatsächlichen
`server/search.ts`-Abfragen nachgebaut, `EXPLAIN (ANALYZE, BUFFERS)` je 3×
(Median, wie `skalen-test.mjs`), HTTP-Zeit als Median aus 3 Aufrufen gegen
`:3008` (`/api/search`).

Ist-Bestand zum Zeitpunkt der Messung: 196 veröffentlichte Kauf-Inserate.

| Abfrage | Zeilen | Plan-Knoten | Index | DB-Zeit (Median) | HTTP-Zeit (Median) |
|---|---|---|---|---|---|
| Basis (sort=neu) | 24 | Seq Scan on listing | — | 0.98 ms | 19.0 ms |
| Filterkombination (typ+preis+zi) | 24 | Seq Scan on listing | — | 1.18 ms | 34.9 ms |
| Umkreis 10 km Zürich | 1 | Bitmap Heap Scan on property | `listing_geom_gix` | 1.93 ms | 24.8 ms |
| Kartenausschnitt (box, LIMIT 2000) | 37 | Seq Scan on listing | — | 0.91 ms | 15.6 ms |
| Sortierung preis-auf | 24 | Seq Scan on listing | — | 1.13 ms | 10.8 ms |
| Sortierung preis-ab | 24 | Seq Scan on listing | — | 0.69 ms | 14.1 ms |
| Sortierung neu (Window-Funktion) | 24 | Seq Scan on listing | — | 0.88 ms | 8.2 ms |
| Anbieterfilter quelle=fourwalls | 24 | Seq Scan on listing | — | 0.45 ms | 10.2 ms |
| Anbieterfilter quelle=entwickler | 16 | Seq Scan on listing | — | 0.64 ms | 6.5 ms |
| Seite 5 (Offset 96) | 24 | Seq Scan on listing | — | 0.95 ms | 13.3 ms |

Kein Fall über 2 ms DB-Zeit, kein Seq Scan über 50 ms — beim Ist-Bestand
(196 Zeilen) ist ein Seq Scan über die ganze `listing`-Tabelle trivial
billig; das sagt nichts über das Verhalten bei 10 000+ Zeilen aus (siehe
oben, historischer Bericht) — diese Fälle wurden dort nicht mitgemessen
(die sechs Fälle sind Ergänzungen zum Auftrag, keine Wiederholung der
sieben skalen-test.mjs-Fälle bei hoher Stufe). **Offener Punkt**: eine
Kombination „diese sechs Fälle × 10 000/50 000 synthetische Zeilen" wäre
wertvoll, erfordert aber ein Zeitfenster ohne parallele :3007-Last (siehe
oben) — nicht in dieser Runde durchgeführt.

Methodischer Hinweis: Der allererste Testlauf (ohne Median-Bildung) zeigte
für „Umkreis 10 km Zürich" 90.96 ms statt 1.93 ms — ein reiner
Kaltstart-Ausreisser (PostGIS-/Planer-Erstaufruf in einer frischen
Verbindung). Nach Umstellung auf 3 Läufe/Median (wie `skalen-test.mjs`) ist
der Wert stabil bei ~2 ms. Alle oben gezeigten Werte sind bereits die
Median-Fassung.

**Zur „Clustering-API"**: wie unter §26 festgestellt, gibt es keine
serverseitige Clustering-Route; „Kartenausschnitt" misst die tatsächliche
`modus=map`-Abfrage (LIMIT 2000 Punkte, Client zeichnet Einzelmarker).

**Ausserhalb der freigegebenen Dateien**: Das Hilfsskript für die zehn
Zusatzfälle wurde bewusst **nicht** unter `app/scripts/` abgelegt (mein
Auftrag nennt als neue Dateien nur `scripts/leistung-test.mjs` und
`docs/LEISTUNG.md`) — es liegt im Scratch-Verzeichnis dieser Sitzung und ist
nicht Teil des Repositorys. Rohausgabe der Läufe: siehe Tabellen oben, volle
JSON-Ausgabe bei Bedarf reproduzierbar (Abfragen 1:1 aus `server/search.ts`
nachgebaut, im Bericht oben aufgeführt).

---

## §24 Professionelle Anbieter — blockiert

`scripts/skalen-org-test.mjs` bricht bei **jeder** Stufe (getestet: N=10)
mit einem unbehandelten Datenbankfehler ab:

```
PostgresError: Anfrage ist nur zu einem veröffentlichten oder reservierten Inserat möglich
  where: 'PL/pgSQL function inquiry_listing_status_pruefen() line 8 at RAISE'
```

**Root Cause**: Das Skript erzeugt N Inserate mit rotierendem Status
(`draft`/`submitted`/`published`, je ⅓), wählt danach 200 **zufällige**
dieser Inserat-IDs aus und legt für jede eine `inquiry`-Zeile an — ohne nach
Status zu filtern. Ein Datenbank-Trigger
(`inquiry_listing_status_pruefen`) verhindert inzwischen (zu Recht, aus
Sicht der Anwendungslogik) Anfragen an nicht-veröffentlichte Inserate. Das
Skript ist damit **mit dem aktuellen Schema nicht mehr kompatibel** — ein
Bug im Skript selbst, keine Anwendungsstörung.

`scripts/skalen-org-test.mjs` ist **nicht** in der Liste der für diesen
Auftrag freigegebenen Dateien; ich habe es deshalb nicht repariert.

**Aufräumen durchgeführt**: Der abgebrochene Lauf hinterliess eine
Organisation (`fw-skalentest-1788721675140`), 10 `property`-Zeilen
(`city='Skalentest-1788721675140'`) und 3 `app_user`-Zeilen — alle wurden
manuell in derselben Reihenfolge wie die eigene `aufraeumen()`-Funktion des
Skripts entfernt (inquiry → listing → property → org_membership →
organization → app_user) und die Nullstellung bestätigt (Anschliessend
`organization`-Zahl zurück auf den Ausgangswert 44).

**Korrekturvorschlag** (Beleg vorhanden, nicht gebaut): Die Zeile

```js
const listingIds = (await sql`SELECT id FROM listing WHERE published_by_org_id = ${orgId} ORDER BY random() LIMIT 200`)…
```

müsste um `AND status IN ('published','reserved')` ergänzt werden (oder alle
N Test-Inserate vor der Anfragen-Erzeugung auf `published` setzen). Damit
könnten die Stufen 10/100/1000/5000 wie im Auftrag vorgesehen gemessen
werden.

---

## §25 Anliegen

`scripts/skalen-anliegen-test.mjs` lief unverändert und vollständig durch
(100 / 1000 / 10000), räumte sich selbst korrekt auf (`service_lead`-Zeilen
mit `contact_email LIKE 'skalen+%@example.com'` sowie die drei
Wegwerf-Personen; Endkontrolle: 0 übrig).

| Abfrage | N=100 | N=1000 | N=10000 | Index bei N=10000 |
|---|---|---|---|---|
| a Seite 1 (ohne Filter) | 0.09 ms | 0.42 ms | 3.86 ms | *(kein Index — Seq Scan)* |
| b Filter status=new | 0.06 ms | 0.04 ms | 0.04 ms | `service_lead_eingang` |
| c Filter service=sell AND status=new | 0.05 ms | 0.17 ms | 0.04 ms | `service_lead_dienst` |
| d Suche (ILIKE Name/E-Mail/Referenz) | 0.30 ms | 1.96 ms | **19.22 ms** | *(kein Index — Seq Scan)* |
| e Filter user_id (eigene Anliegen) | 0.04 ms | 0.16 ms | 0.07 ms | `service_lead_person` |

Alle Werte liegen weit unter der im Skript angesetzten 150-ms-Schwelle. Fall
„d" (Volltext, ILIKE) nutzt bei 10 000 Zeilen einen Seq Scan bei ~19 ms —
genau der im Auftrag als **akzeptabel** benannte Bereich („Seq Scan bei ~17
ms ist akzeptabel — nur dokumentieren"). Keine Optimierung vorgeschlagen.

---

## Abschluss & Aufräumen

### Prod-Server beendet

```
lsof -nP -iTCP:3008 -sTCP:LISTEN   → PID im scratchpad-Kopie-Verzeichnis bestätigt
kill -TERM <pid>                    → Port 3008 danach ohne Listener
```
Ebenso der Vergleichs-Server auf 3009 (CLS-Vorher-Messung) — beide PIDs vor
dem Beenden per `lsof -p <pid> | grep cwd` als Prozesse **der eigenen
Scratch-Kopie** verifiziert (nicht per Portnummer geraten), wie von
`docs/PROJECT-ISOLATION-RULE.md` verlangt. Dev-Server :3007 während der
gesamten Sitzung nie berührt.

### Testdaten-Zähler

| Tabelle | vor dieser Runde (ungefähr) | nach dieser Runde | Kommentar |
|---|---|---|---|
| `listing` | 334–335 | 336 | **+1**, stammt aus dem vorgeschriebenen `lieferkette-test.mjs`-Lauf gegen :3007 (das Skript legt als Teil seiner Ende-zu-Ende-Prüfung bewusst ein echtes, veröffentlichtes Test-Inserat an — bestehendes, unverändertes Skriptverhalten, keine Restdaten aus meinen Skalen-Messungen) |
| `organization` | 44 | 44 | unverändert (Skalentest-Organisation aus dem abgebrochenen §24-Lauf manuell entfernt) |
| `service_lead` | 4 | 4 | unverändert (10 000 Synth-Zeilen der §25-Messung vollständig selbst aufgeräumt) |
| `app_user` | ~380 | 382 | **+2**, ebenfalls aus dem vorgeschriebenen `lieferkette-test.mjs`-Lauf (zwei echte Test-Konten `lka+…`/`lkb+…`) |

`FWL-2026-9%`/`FWI-2026-9%` (skalen-test.mjs-Präfix): 0 verbleibend.
`skalen+%@example.com` (Anliegen-Präfix): 0 verbleibend.
`fw-skalentest-%` (Organisations-Präfix): 0 verbleibend.

### Prüfungen grün

```
npx tsc --noEmit                                  → 0 Fehler
npx eslint <die vier geänderten Komponenten-Dateien> → 0 Fehler, 0 Warnungen
node scripts/lieferkette-test.mjs http://localhost:3007
  → 33 Schritte, 0 FEHLER, 33 OK — Dauer 26.4 s
  (FW_TEST_MOD_EMAIL/-PASSWORT aus var/konten.local.json „konten" gelesen,
  mod@fourwalls.example — Zugangsdaten selbst nicht in diesen Bericht übernommen)
```

### Geänderte/neue Dateien dieses Berichts

- `scripts/leistung-test.mjs` (neu)
- `docs/LEISTUNG.md` (neu, diese Datei)
- `components/marktplatz/karte.tsx` (Sizes korrigiert, `eager`-Prop ergänzt)
- `components/property/galerie.tsx` (Sizes je Kachel-Index, erstes Bild eager)
- `components/property/seite.tsx` (Mosaik-Sizes je Kachel-Index)
- `app/[locale]/page.tsx` (erstes Exclusive-Kachelbild eager)
- `components/property/bild.tsx`: **nicht geändert** (bereits korrekt)

### Offene Punkte für die nächste Runde

1. §24 blockiert — `scripts/skalen-org-test.mjs` braucht die oben
   beschriebene Ein-Zeilen-Korrektur (Status-Filter vor der
   Anfragen-Erzeugung), dann Nachmessung bei 10/100/1000/5000.
2. §23: die zehn Auftrags-Zusatzfälle wurden nur beim Ist-Bestand gemessen
   (Kollisionsrisiko mit parallelen :3007-Prüfspuren, siehe Begründung) —
   eine Messung bei 2 000/10 000/50 000 synthetischen Inseraten steht aus
   und braucht ein Zeitfenster ohne parallele Last auf :3007.
3. P1: `price_per_m2`-Ausdruck ohne Index (Sortierung „m2", „Ähnliche
   Inserate" werden ab ~10 000 Inseraten langsam) — Vorschlag oben, nicht
   gebaut.
4. P1: `logo-ink.png` (68.8 KB, CSS-Maske, auf jeder Seite geladen) —
   Dateioptimierung empfohlen, liegt ausserhalb der freigegebenen Dateien.
5. P2: JSON-API-Routen (`/api/**`) werden vom Standalone-Server nicht
   komprimiert, HTML/JS/CSS schon — Ursache nicht vertieft, siehe
   Kompressions-Befund.
6. Verbindungs-Pool-Grösse (`postgres()` in `server/db.ts`) bei den 10
   parallelen Suchaufrufen nicht geprüft — bei höherer paralleler Last
   erneut zu betrachten.
