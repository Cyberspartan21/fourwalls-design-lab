# FOURWALLS — Datenbank

Schema für die Produktion. PostgreSQL 16 mit PostGIS.

## Was hier steht

```
migrations/   nummerierte, wiederholbar einspielbare Migrationen
tests/        prüft, ob die Zusagen des Schemas wirklich greifen
```

Jede Migration liegt in einer eigenen Transaktion: Sie geht ganz durch oder gar
nicht. Ein halb eingespieltes Schema ist schlimmer als keines.

## Lokal ausprobieren

```bash
docker run -d --name fw-db \
  -e POSTGRES_PASSWORD=test -e POSTGRES_DB=fourwalls \
  -p 55432:5432 postgis/postgis:16-3.4-alpine

for f in db/migrations/*.sql; do
  docker exec -i fw-db psql -U postgres -d fourwalls -v ON_ERROR_STOP=1 -q < "$f"
done

docker exec -i fw-db psql -U postgres -d fourwalls -q < db/tests/schema-test.sql
```

Der Test läuft in einer Transaktion und endet mit `ROLLBACK` — er hinterlässt
nichts in der Datenbank.

## Reihenfolge

| Datei | Inhalt |
|---|---|
| `0001_grundlage` | Erweiterungen, Aufzählungstypen, Hilfsfunktionen |
| `0002_identitaet` | Personen, Organisationen, Zugehörigkeit, Rollen |
| `0003_liegenschaft` | Orte, Projekte, Liegenschaften, Merkmale, Geo-Privatsphäre |
| `0004_inserat` | Inserate, Statusübergänge, Slug-Historie |
| `0005_medien` | Bilder, Grundrisse, Dokumente, Zugangsstufen |
| `0006_interaktion` | Anfragen, Besichtigungen, Merkliste, Suchabos |
| `0007_moderation` | Prüfvorgang, Meldungen, Prüfpfad |
| `0008_suche` | Öffentliche Sicht, Indizes, Umkreissuche |

## Die drei Entscheidungen, auf die es ankommt

**1. Liegenschaft ≠ Inserat.** Dasselbe Haus kann über die Jahre mehrfach
inseriert werden. Hängt alles am Inserat, verliert man beim Archivieren die
Geschichte — und kann nie feststellen, ob zwei Inserate dieselbe Wohnung sind.

**2. Zwei Koordinaten.** `geom_exact` verlässt den Server nie. `geom_public`
wird beim Speichern daraus berechnet (gerastert, nicht zufällig versetzt) und
ist das Einzige, was ausgeliefert wird. Die öffentliche Sicht `listing_public`
enthält `geom_exact` gar nicht erst.

**3. Status ist nicht frei setzbar.** Die erlaubten Übergänge stehen als
Bedingung in der Datenbank. Auch ein Fehler in der Anwendung kann einen Entwurf
nicht direkt veröffentlichen, und archiviert bleibt archiviert.

## Geprüft

`db/tests/schema-test.sql` prüft 16 Zusagen, unter anderem:

- die öffentliche Koordinate liegt messbar entfernt von der exakten (198 m im Test)
- sie ist reproduzierbar, nicht pro Abruf zufällig (sonst liesse sie sich herausmitteln)
- `draft → published` wird abgelehnt, der reguläre Weg funktioniert
- jeder Statuswechsel landet im Prüfpfad
- `listing_public` enthält weder `geom_exact` noch Strasse
- eine gespeicherte Suche verlangt die Anfrage, nicht ihre Beschriftung

Stand: alle 16 grün gegen PostgreSQL 16.4 / PostGIS 3.4.
