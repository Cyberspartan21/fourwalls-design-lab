# FOURWALLS — Datenbank wiederherstellen (`pg_dump` / `pg_restore`)

Dieses Dokument beschreibt den verbindlichen Weg, eine mit `pg_dump -Fc`
erzeugte Sicherung wiederherzustellen. Er wurde tatsächlich ausprobiert
(P5.5-Nachtrag) und behebt einen beobachteten Fehler beim Anlegen des
Trigram-Index auf `place`. **Nicht** verbindlich ist ein einzelner,
unsektionierter `pg_restore`-Lauf ohne die Schritte unten — der zeigt den
Fehler zuverlässig.

## Was tatsächlich beobachtet wurde

Ein Restore mit `pg_restore -d <db> <dump>` (ein einziger Lauf, keine
`--section`) bricht beim Anlegen des Index `place_name_trgm`
(`db/migrations/0003_liegenschaft.sql`) mit dieser Fehlermeldung ab:

```
pg_restore: error: could not execute query: ERROR:  function unaccent(text) does not exist
LINE 2:   SELECT lower(unaccent(coalesce(input, '')));
                       ^
CONTEXT:  SQL function "normalize_text" during inlining
Command was: CREATE INDEX place_name_trgm ON public.place USING gin (public.normalize_text(name_de) public.gin_trgm_ops);
```

**Wichtiger Befund, der die ursprüngliche Vermutung korrigiert:** Das
Aufteilen des Restores in die drei Standard-Abschnitte
(`--section=pre-data`, `--section=data`, `--section=post-data`) **allein
behebt den Fehler nicht**. Er tritt in allen drei getesteten Varianten
identisch auf (monolithisch, sektioniert, sektioniert mit zusätzlichem
manuellem `CREATE EXTENSION IF NOT EXISTS unaccent;` vor `post-data`) —
`unaccent` ist zu diesem Zeitpunkt bereits installiert, das Problem liegt
woanders.

**Tatsächliche Ursache:** Jeder `pg_restore`-Lauf (unabhängig von
`--section`) setzt zu Beginn der Sitzung aus Sicherheitsgründen
`SELECT pg_catalog.set_config('search_path', '', false);` — das steht so
im von `pg_dump` erzeugten Vorspann und ist bei modernen PostgreSQL-Clients
Standard (verhindert Angriffe über einen manipulierten `search_path`). Die
Funktion `normalize_text()` (`db/migrations/0001_grundlage.sql`) ruft darin
`unaccent(...)` aber **ohne Schema-Qualifizierung** auf. Beim Anlegen des
Index wird `normalize_text()` als `IMMUTABLE`-SQL-Funktion inline geprüft;
mit leerem `search_path` findet Postgres das unqualifizierte `unaccent`
nicht, obwohl `public.unaccent` längst existiert. Eine ganz normale
`psql`-Sitzung (mit normalem `search_path`) ist davon nicht betroffen —
nur der `pg_restore`-Prozess selbst.

Die Migrationsdateien sind dabei korrekt und werden nicht geändert; das
Verhalten liegt ausschliesslich am `search_path`, den `pg_restore` für seine
eigene Sitzung setzt.

## Der tatsächlich funktionierende Ablauf

Sektionierter Restore **plus** ein einmaliger Fix, der der Funktion
`normalize_text` einen eigenen, festen `search_path` mitgibt (das ändert
nichts an ihrem Verhalten, nur an der Namensauflösung während `pg_restore`):

```bash
# 1) pre-data: Erweiterungen, Typen, Tabellen, Funktionen (ohne Indizes/Trigger)
pg_restore -U <benutzer> -d <db> --no-owner --no-privileges \
  --section=pre-data <dump-datei>

# 2) data: die Zeilen selbst
pg_restore -U <benutzer> -d <db> --no-owner --no-privileges \
  --section=data <dump-datei>

# 3) Fix für den search_path, den pg_restore in seiner eigenen Sitzung setzt:
#    normalize_text() bekommt einen eigenen, festen search_path, damit das
#    darin unqualifizierte unaccent() aufgelöst werden kann.
psql -U <benutzer> -d <db> -c \
  "ALTER FUNCTION public.normalize_text(text) SET search_path = public, pg_catalog;"

# 4) post-data: Indizes, Constraints, Trigger — inkl. place_name_trgm
pg_restore -U <benutzer> -d <db> --no-owner --no-privileges \
  --section=post-data <dump-datei>
```

Geprüft mit `postgis/postgis:16-3.4-alpine` in einem eigenen, isolierten
Container (`fw-restore-proof`, Port 55436), Sicherung aus `fw-dev-db`:

- Schritt 1 und 2: keine Fehlermeldungen.
- Ohne Schritt 3 bricht Schritt 4 mit obigem `unaccent`-Fehler ab (geprüft,
  reproduzierbar, auch mit zusätzlichem manuellem
  `CREATE EXTENSION IF NOT EXISTS unaccent;` davor — das ändert nichts,
  weil die Erweiterung bereits vorhanden ist).
- Mit Schritt 3: Schritt 4 läuft vollständig fehlerfrei durch (`EXIT 0`,
  keine Ausgabe).
- Nach dem Restore: `place_name_trgm` existiert und ist gültig
  (`pg_index.indisvalid = t`), `SELECT count(*) FROM app_user` (119) und
  `SELECT count(*) FROM place` (76) stimmen exakt mit `fw-dev-db` überein.

## Der Fix gehört an die Quelle (P5.6-Nachtrag)

Migration `0014_restore_pfad.sql` gibt `normalize_text()` denselben festen
`search_path` dauerhaft mit:

```sql
ALTER FUNCTION normalize_text(text) SET search_path = public, pg_catalog;
```

Damit trägt jede Sicherung, die **nach** dieser Migration erzeugt wird, die
Korrektur schon in der Funktionsdefinition selbst — `pg_dump` schreibt sie
mit, `pg_restore` muss sie nicht mehr nachträglich setzen. Geprüft: eine
frische Sicherung von `fw-dev-db` (nach 0014) liess sich mit einem
EINZIGEN, unsektionierten `pg_restore -d <db> <dump>` fehlerfrei einspielen
(nur die drei erwarteten, harmlosen „schema already exists"-Meldungen für
`tiger`/`tiger_data`/`topology`, die das PostGIS-Image selbst mitbringt).
`place_name_trgm` war gültig, `place`-Zeilenzahl (76) und `app_user`-Zeilenzahl
(119) stimmten exakt mit `fw-dev-db` überein.

## Verbindlichkeit

Für eine Sicherung aus einer Datenbank **mit** Migration 0014 genügt ein
einzelner `pg_restore -d <db> <dump>`-Lauf. Für eine ÄLTERE Sicherung (vor
0014, ohne den `search_path` in der Funktion selbst) bleibt der sektionierte
Weg mit dem `ALTER FUNCTION`-Zwischenschritt verbindlich — er ist bei einer
aktuellen Sicherung wirkungslos, aber nie schädlich, und deckt beide Fälle
gleichzeitig ab.

Für den Alltag gibt es `app/scripts/db-restore.sh` (führt die vier Schritte
automatisiert aus, funktioniert für beide Sicherungsalter), analog zu
`app/scripts/migrate.mjs`:

```bash
cd app
./scripts/db-restore.sh /pfad/zur/sicherung.dump "postgresql://user:pass@host:port/db"
```

## Sicherung erzeugen: `app/scripts/db-backup.sh` (P5.10 §20)

```bash
cd app
./scripts/db-backup.sh var/backups/2026-09-06.dump "$DATABASE_URL"
```

Läuft mit lokal installiertem `pg_dump` direkt gegen `DATABASE_URL` (Staging/
Produktion, CI-Runner mit Postgres-Client). Ist kein `pg_dump` installiert
UND zeigt `DATABASE_URL` auf den lokalen Entwicklungscontainer (`localhost:
55433` bzw. `127.0.0.1:55433` — dieser Entwicklungsrechner hat keine lokalen
Postgres-Clientwerkzeuge), fällt das Skript auf
`docker exec fw-dev-db pg_dump …` zurück — der einzige Container, den es
anfasst (Projekt-Isolation, `docs/PROJECT-ISOLATION-RULE.md`).

## Der vollständige Katastrophentest (P5.10 §20)

`app/scripts/katastrophen-test.mjs` führt Sicherung, Wiederherstellung und
Vergleich automatisiert und nummeriert für Datenbank UND Objektspeicher
durch — geprüft, reproduzierbar grün:

```bash
cd app
set -a; . ./.env.local; set +a
S3_ENDPOINT=http://localhost:59000 S3_REGION=us-east-1 \
S3_ACCESS_KEY_ID=fwdev S3_SECRET_ACCESS_KEY=fwdev-nur-lokal-0000 \
S3_FORCE_PATH_STYLE=ja \
S3_BUCKET_PRIVATE=fw-dev-privat S3_BUCKET_PUBLIC=fw-dev-oeffentlich \
node scripts/katastrophen-test.mjs
```

Ablauf (18 nummerierte Schritte, siehe Kopfkommentar der Datei für Details):

1. `docker exec fw-dev-db pg_dump -U fourwalls -Fc -d <db>` → `var/backups/<datum>.dump`
   (dieser Rechner hat kein lokales `pg_dump`/`pg_restore`/`psql` — siehe
   `scripts/db-backup.sh` oben; ein Host mit Postgres-Client bräuchte hier
   keinen `docker exec`-Umweg).
2. `CREATE DATABASE "fw_restore_test_<ts>" OWNER fourwalls` (Wartungsverbindung
   auf die `postgres`-Datenbank desselben Clusters).
3. Dump + `scripts/db-restore.sh` per `docker cp` in den Container kopiert,
   dort ausgeführt gegen `postgresql://fourwalls:fourwalls_dev@localhost:5432/fw_restore_test_<ts>`
   (Container-interner Port 5432, nicht der host-seitig veröffentlichte 55433).
4. Zeilenzahlen von `listing`, `organization`, `app_user`, `inquiry`,
   `service_lead`, `media_asset`, `saved_search`, `audit_log`, `mail_outbox`
   — Original gegen Wiederherstellung.
5. Summe: `count(*) FROM listing WHERE status = 'published'`.
6. Prüfsumme: `md5(string_agg(public_ref, ',' ORDER BY public_ref))` über
   jede Tabelle (und die Sicht `listing_public`), die eine `public_ref`-Spalte
   trägt (per `information_schema.columns` ermittelt, nicht hartkodiert).
7. `SELECT count(*) FROM listing_public` — die Sicht funktioniert nach dem
   Restore identisch.
8. `schema_migration`-Namen — Original und Wiederherstellung tragen exakt
   dieselben Migrationen.
9. `DROP DATABASE IF EXISTS "fw_restore_test_<ts>"`.
10. Ein Testobjekt (`restore-test/<ts>.txt`) in `S3_BUCKET_PUBLIC` hochladen.
11.–12. Beide Behälter (`S3_BUCKET_PRIVATE`, `S3_BUCKET_PUBLIC`) vollständig
    nach `var/backups/s3-<ts>/{privat,oeffentlich}/` gesichert
    (`scripts/speicher-backup.mjs`, Funktion `sichern()`) — bei diesem
    Bestand (~11 MB, ~250 Objekte) ohne Einschränkung auf ein Präfix; erst ab
    etwa 500 MB wäre laut Auftrag nur `pub/` + `orig/` eines Testinserats zu
    sichern.
13. Wegwerf-Behälter `fw-restore-test-<ts>` anlegen (kleingeschriebener
    Zeitstempel — S3-Behälternamen erlauben keine Grossbuchstaben).
14. Beide Sicherungen mit den Präfixen `privat/` bzw. `oeffentlich/` in den
    Wegwerf-Behälter hochgeladen (`wiederherstellen()`).
15. Jedes wiederhergestellte Objekt gegen das Original verglichen: Existenz,
    Grösse, ETag (`vergleichen()`, per `HeadObjectCommand`).
16. Das Testobjekt aus dem ECHTEN Behälter gelöscht — ein erneuter Abruf
    liefert `NoSuchKey`.
17. Das Testobjekt aus der lokalen Sicherung (nicht aus dem Wegwerf-Behälter)
    zurück in den echten Behälter geschrieben — der Abruf gelingt wieder,
    Inhalt identisch.
18. Aufräumen: Wegwerf-Behälter geleert und gelöscht, Testobjekt im echten
    Behälter entfernt.

Ergebnis: `docs/backup-nachweis.json` (maschinenlesbar) und
`var/backups/bericht-<ts>.md` (lesbar). Nach einem vollständigen Lauf bleiben
weder eine `fw_restore_test_*`-Datenbank noch ein `fw-restore-test-*`-Behälter
zurück — geprüft per `SELECT datname FROM pg_database WHERE datname LIKE
'fw_restore_test%'` (leer) und Behälterlisting (nur die beiden echten
Behälter). Die lokale Sicherung selbst (`var/backups/<datum>.dump`,
`var/backups/s3-<ts>/`) bleibt als Nachweis liegen — `var/` ist ausserhalb
der Versionskontrolle (`.gitignore`).
