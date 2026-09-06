# Regression — SEO/Index-Verhalten und visuelle Zustände (P5.9 Phase B, WS H)

Anlass: P5.8 hatte einen Namenskollisions-Bug, der die Startseite unsichtbar
machte (Klasse `blatt`, siehe `app/[locale]/page.tsx`) — ein Screenshot davon
sah auf den ersten Blick unauffällig aus (nichts stürzt ab, Chrome liefert
ein Bild), zeigte aber eine leere Fläche. Dieser Auftrag baut zwei
unabhängige, automatische Sicherheitsnetze dafür auf: eines für das, was
Suchmaschinen sehen (Text/HTML), eines für das, was Menschen sehen (Bild).
Beide laufen in CI (`.github/workflows/app-ci.yml`, Job `pruefen`) bei jedem
Push/PR auf `app/**` oder `db/**`.

## 1. SEO und Index-Verhalten — `app/scripts/seo-test.mjs`

Reines `fetch` gegen eine laufende Anwendung (kein Browser, keine
Bildschirmaufnahme). Prüft für jede öffentliche, indexierbare Seite (Start ×4
Sprachen, kaufen/mieten ×4, eine Objektseite, eine Anbieterseite in allen
vier Sprachordnern, die Service-Landeseiten, `ueber-fourwalls`, `wissen` und
einen Wissensbeitrag):

- Status 200, genau ein `<title>` (endet genau einmal auf «— Fourwalls»),
  genau eine nicht-leere `meta description` (kein Text, der wie ein
  Übersetzungsschlüssel aussieht: kein `nav.`, kein `_`), genau ein `<h1>`.
- Canonical vorhanden und absolut, hreflang für de/fr/it/en + x-default,
  OpenGraph (`og:title`/`og:description`/`og:url`), `<html lang>` passend
  zur Sprache, kein `robots: noindex`.

Dazu, unabhängig von der Seitenliste oben:

- **NOINDEX-Seiten** (Formulare, Konto, Vergleich, Inserieren, Rechtsseiten
  vor Freigabe) tragen `noindex`; Konto/Intern/Moderation/Vorschau liefern
  anonym 307 (Umleitung zum Anmelden) oder 404 ohne `<main>`-Inhalt.
- **404**: eine unbekannte Adresse liefert Status 404 mit einer echten
  Überschrift im initialen HTML, ohne Dateisystempfad oder `node_modules` im
  Markup.
- **`/sitemap.xml`**: gültiges, ausgeglichenes XML, enthält Start/kaufen/
  Objekt/Anbieter/Service-Seiten, KEINE Formular-/Konto-/internen Adressen,
  jede `<loc>` beginnt mit der geprüften Basis-URL, xhtml:link-Alternates
  vorhanden.
- **`/robots.txt`**: nennt die Sitemap, sperrt `/api/` und die internen
  Bereiche.
- **JSON-LD**: `RealEstateListing` mit `datePosted` im Format `JJJJ-MM-TT`
  auf der Objektseite, `WebSite` auf der Startseite, `Organization` auf der
  Anbieterseite, `Article` auf einem Wissensbeitrag.
- **Behauptungs-Wächter**: keine öffentliche, indexierbare Seite darf im
  sichtbaren HTML (ohne `<script>`) eine Liste erfundener/werblicher
  Aussagen enthalten («Eigentümer-Report», «garantiert», «revolutionär» …).
- **Externe Hosts**: die Startseite lädt keine Schriften/Skripte von
  `fonts.googleapis.com`, `fonts.gstatic.com` oder `cdnjs.cloudflare.com`
  (siehe `docs/DRITTANBIETER.md`).

**WP3a/WP5-Ausnahme**: Prüfungen, die von der 404-SSR-Reparatur (WP3a) oder
den `/wissen`-Seiten (WP5) abhängen, laufen mit, aber ein Fehlschlag dort
zählt als `WARTET`, nicht als `FEHLER` — der Exit-Code bleibt davon
unberührt. Alles andere ist ein echter Befund.

Aufruf: `node scripts/seo-test.mjs <basis-url>` (aus `app/`), braucht
`DATABASE_URL` nur für zwei einzelne SELECTs (eine veröffentlichte
Inserats-Referenz, ein aktiver Anbieter-Slug) — sonst ausschliesslich HTTP.
npm-Skript: `npm run test:seo -- <basis-url>`.

## 2. Sichtprüfung — `tools/sichtpruefung.mjs`

Ergänzt `tools/baseline.mjs` (Referenzaufnahmen) um eine rein rechnerische
Prüfung jedes aufgenommenen Bildes, ohne dass jemand hinschauen muss:

1. Dateigrösse > 20 KB (eine winzige PNG-Datei ist praktisch immer eine
   leere oder einfarbige Fläche — PNG komprimiert das sehr gut).
2. Bildmasse plausibel: Breite = erwartete Viewportbreite × Gerätepixel-
   verhältnis (1440 px für Desktop-Zustände, 780 px für mobile Zustände —
   `m-`-Präfix, 390 CSS-Pixel × deviceScaleFactor 2).
3. Anteil der Pixel, die NICHT der häufigsten Farbe entsprechen, ≥ 2,5 % —
   genau das hätte den "blatt"-Fehler aus P5.8 erkannt: eine leere Seite ist
   praktisch einfarbig.

Dekodiert PNGs über `sharp` (bereits Abhängigkeit von `app/`, keine neue
Installation). Aufruf: `node tools/sichtpruefung.mjs <ordner-mit-pngs>`,
Exit 1 bei jedem Befund. npm-Skript aus `app/`: `npm run test:sicht -- <ordner>`.

## Zwei Ebenen, bewusst getrennt

| Ebene | Werkzeug | Läuft in CI | Deterministisch über Betriebssysteme |
|---|---|---|---|
| Text/HTML (SEO, Index) | `app/scripts/seo-test.mjs` | ja | ja (reines HTTP) |
| Bild, rechnerisch (Grösse/Masse/Farbvielfalt) | `tools/sichtpruefung.mjs` | ja | ja |
| Bild, Pixel-für-Pixel-Vergleich gegen eine Referenz | `tools/vergleich.mjs` | **nein, nur lokal** | nein |

`tools/vergleich.mjs` vergleicht zwei Aufnahmereihen Pixel für Pixel gegen
eine gepflegte Referenz (`baseline/p5x`) — das ist die schärfste Prüfung,
aber nicht reproduzierbar über verschiedene Betriebssysteme/GPU-Treiber
hinweg (Schriftglättung, Farbprofil-Rundung unterscheiden sich zwischen
macOS und GitHub Actions' `ubuntu-latest`). Deshalb bleibt der
Pixelvergleich **lokal** (macOS-Chrome, dieselbe Maschine, dieselbe
Referenz):

```
node tools/baseline.mjs http://localhost:3007 baseline/p5x --app
node tools/vergleich.mjs baseline/p58 baseline/p5x
```

CI ersetzt das NICHT durch einen Pixelvergleich (nicht deterministisch über
Betriebssysteme, siehe oben), sondern durch `tools/sichtpruefung.mjs` — eine
schwächere, aber maschinenunabhängige Prüfung — und lädt die aufgenommenen
PNGs als Artefakt hoch (`actions/upload-artifact@v4`, 7 Tage Aufbewahrung),
damit ein Mensch bei Bedarf trotzdem hinschauen kann:

```
CHROME_BIN=$(which google-chrome) node tools/baseline.mjs http://localhost:3007 /tmp/sicht --app
node tools/sichtpruefung.mjs /tmp/sicht
```

`tools/baseline.mjs` liest den Chrome-Pfad aus der Umgebungsvariable
`CHROME_BIN`, falls gesetzt — sonst bleibt der bisherige macOS-Pfad
(`/Applications/Google Chrome.app/…`) der Standard, lokal ändert sich
nichts.
