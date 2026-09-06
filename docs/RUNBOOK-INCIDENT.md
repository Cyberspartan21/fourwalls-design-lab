# FOURWALLS — Incident-Runbook (P5.10 §38)

Kurz, operativ, mit Befehlen. Keine Geheimnisse in diesem Dokument, keine
Geheimnisse in Protokollen (`lib/log.ts` entfernt bekannte Geheimnis-Wörter
aus Fehlermeldungen, `server/outbox.ts` ebenso für `last_error`).

Projekt-Isolation gilt auch im Notfall: nur `fw-`-benannte Ressourcen
anfassen, kein `docker system prune`, kein `pkill` nach Muster (siehe
`docs/PROJECT-ISOLATION-RULE.md`). Das gilt für die lokale Entwicklungsumgebung
identisch wie für Staging/Produktion — dort mit den entsprechenden
Container-/Dienstnamen des Zielsystems.

## Erste Fragen, immer zuerst

1. `curl -i https://<host>/api/health` — lebt der Prozess überhaupt?
2. `curl -i https://<host>/api/ready` — ist die Datenbank erreichbar, sind
   Migrationen/Umgebung in Ordnung? (Antwort trennt `checks` von `launch` —
   siehe `docs/RUNBOOK-DEPLOY.md` Abschnitt 10.)
3. Seit wann? Was wurde zuletzt verändert (Deploy? Migration? DNS? Anbieter-
   Störung)?

## 1. Site down (keine Antwort / 5xx durchgehend)

- `docker compose -f infra/staging/docker-compose.yml ps` (bzw. das
  Produktionsäquivalent) — läuft der Container?
- `docker compose -f infra/staging/docker-compose.yml logs --tail 200 app`
  — Absturzursache im Protokoll?
- Reverse Proxy prüfen (`Caddyfile`): läuft Caddy, ist das Zertifikat gültig,
  zeigt `reverse_proxy app:3000` auf den richtigen Dienst?
- Wenn der letzte Deploy die Ursache ist: sofort **Rollback** (Abschnitt 5).
- Wenn die Datenbank die Ursache ist: weiter mit Abschnitt 2.

## 2. Datenbank nicht erreichbar

- `/api/ready` antwortet `503` mit `db: "unreachable"` (kein Stack, keine
  Zugangsdaten in der Antwort — das ist Absicht, siehe `app/api/ready/route.ts`).
- Direkt prüfen (vom Anwendungshost, mit den Produktionszugangsdaten aus dem
  Secret-Store, NIE aus diesem Dokument):
  ```
  psql "$DATABASE_URL" -c "select 1"
  ```
- Mögliche Ursachen: Anbieterausfall (Statusseite prüfen), IP-Filter/Firewall
  seit einer Änderung, Zertifikat/`sslmode` abgelaufen oder falsch, zu viele
  Verbindungen (Pool-Grösse in `server/db.ts` ist bewusst klein — 10 in
  Produktion, siehe Datei).
- Ist die Datenbank grundsätzlich weg (nicht nur unerreichbar): Restore aus
  der letzten Sicherung, siehe `db/RESTORE.md`. Reihenfolge: neue/ersetzte
  Datenbankinstanz bereitstellen → `app/scripts/db-restore.sh` → `DATABASE_URL`
  in der Umgebung der Anwendung anpassen → Anwendung neu starten.
- Die Anwendung selbst bleibt bei einem DB-Ausfall am Leben (`/api/health`
  antwortet weiterhin `200`) — nur `/api/ready` und alle Seiten, die die
  Datenbank brauchen, scheitern. Das ist die Trennung aus
  `docs/RUNBOOK-DEPLOY.md` Abschnitt 10, praktisch sichtbar.

## 3. Mail-Rückstau (`mail_outbox`)

Details zum Outbox-Mechanismus: `app/server/outbox.ts` (Kopfkommentar) und
die vertiefende Outbox-Dokumentation (paralleler Workstream, siehe dort für
Zähler-Feinheiten über das Folgende hinaus).

- Zähler nach Status:
  ```sql
  SELECT status, count(*) FROM mail_outbox GROUP BY status ORDER BY status;
  ```
- Was gerade fällig ist (wird beim nächsten Arbeiterlauf ohnehin abgeholt):
  ```sql
  SELECT count(*) FROM mail_outbox WHERE status IN ('created','failed') AND next_attempt_at <= now();
  ```
- Läuft der Arbeiter überhaupt (`instrumentation.ts`, Takt
  `OUTBOX_INTERVAL_MS`)? Prozessprotokoll prüfen: `outbox.angenommen`/
  `outbox.fehlgeschlagen`/`outbox.aufgegeben`-Einträge (`lib/log.ts`-Format).
  Kein Log-Fluss trotz wartender Zeilen → Prozess neu starten (Abschnitt 5,
  ohne Migration/Backup nötig, wenn sonst nichts kaputt ist).
- Nach vier Fehlversuchen gibt eine Zeile auf (`status = 'abandoned'`, siehe
  `server/outbox.ts`, `WARTEZEIT_MIN`). Ursache zuerst beheben (SMTP-Zugang,
  Anbieterausfall, DNS des Mailanbieters), DANN erneut einreihen:
  ```sql
  UPDATE mail_outbox
     SET status = 'created', attempts = 0, next_attempt_at = now(), last_error = NULL
   WHERE status = 'abandoned' AND id = '<einzelne id>';
  ```
  Für einen ganzen Rückstau denselben Befehl ohne `AND id = …`, aber ERST
  NACHDEM die Ursache behoben ist — sonst gibt der nächste Lauf sofort wieder
  auf.
- `last_error` je Zeile lesen (`SELECT id, kind, attempts, last_error FROM
  mail_outbox WHERE status IN ('failed','abandoned') ORDER BY created_at DESC
  LIMIT 20;`) — enthält nie ein Geheimnis (siehe `fehlermeldung()` in
  `server/outbox.ts`), aber die Fehlerklasse (z. B. Authentifizierung, DNS,
  Timeout).

## 4. Objektspeicher nicht erreichbar (Bilder fehlen, Uploads 5xx)

- Prüfen, ob der Endpunkt selbst erreichbar ist (vom Anwendungshost):
  ```
  curl -i "$S3_ENDPOINT"
  ```
- Anbieterstatusseite prüfen. Ist der Ausfall auf Anbieterseite: abwarten,
  Nutzerinnen sehen fehlende Bilder, aber keine falschen Daten — der
  Objektspeicher trägt keine fachliche Wahrheit, nur Dateien.
- Zugangsdaten falsch/rotiert seit einer Änderung: `S3_ACCESS_KEY_ID`/
  `S3_SECRET_ACCESS_KEY` im Secret-Store gegen die zuletzt gültigen prüfen.
- Bucket-Zustand prüfen (Policy/Existenz nicht versehentlich verändert):
  ```
  node scripts/s3-buckets.mjs
  ```
  (idempotent — legt nichts doppelt an, meldet nur, was fehlt oder abweicht).
- Ist ein Behälter tatsächlich beschädigt/geleert: Wiederherstellung aus der
  letzten Objektspeicher-Sicherung, siehe `db/RESTORE.md`
  (`app/scripts/speicher-backup.mjs wiederherstellen`).

## 5. Fehlerhafter Deploy (Rollback)

- Kein destruktiver Migrationsschritt seit dem vorherigen Deploy:
  ```
  cd infra/staging   # bzw. das Produktionsäquivalent
  ./rollback.sh
  ```
  Setzt das zuletzt gemerkte Abbild zurück, startet neu, lässt die Datenbank
  unverändert (Migrationen sind vorwärtskompatibel, siehe
  `docs/RUNBOOK-DEPLOY.md` Abschnitt 6).
- War die Migration seit dem letzten guten Stand destruktiv (sollte laut
  Vorgabe grundsätzlich vermieden werden) oder hat der fehlerhafte Deploy
  bereits fehlerhafte Daten geschrieben: zusätzlich das Backup von VOR der
  Migration einspielen (`db/RESTORE.md`) — Reihenfolge: Anwendung stoppen →
  DB restaurieren → altes Abbild starten → erst nach Prüfung wieder Verkehr
  zulassen.
- Nach jedem Rollback: `/api/health` und `/api/ready` erneut prüfen (Abschnitt
  „Erste Fragen“).

## 6. Migrationsfehler

- `node scripts/migrate.mjs` bricht bei der ersten fehlschlagenden Datei ab
  (`for`-Schleife in Dateireihenfolge, kein Weiterlaufen). Jede Migrationsdatei
  trägt ihre eigene Transaktion (`BEGIN`/`COMMIT` im SQL-Text selbst, siehe
  `db/migrations/*.sql`) — schlägt eine Anweisung darin fehl, rollt NUR diese
  eine Migration vollständig zurück; bereits erfolgreich angewendete frühere
  Migrationen bleiben stehen (ihre Zeile in `schema_migration` wurde bereits
  committet). Die fehlgeschlagene Migration selbst erhält KEINE Zeile in
  `schema_migration` — ein erneuter Lauf von `migrate.mjs` versucht sie
  automatisch wieder, sobald die Ursache behoben ist.
- Sofortmassnahme: Deploy NICHT fortsetzen (siehe `infra/staging/deploy.sh` —
  ein fehlgeschlagener Migrationsschritt bricht den Deploy vor dem Neustart
  ab, die alte Version bleibt online; das ist die eingebaute Sicherung, nicht
  etwas, das im Notfall improvisiert werden muss).
- Ursache lesen: die SQL-Fehlermeldung von `migrate.mjs` benennt Datei und
  Postgres-Fehler direkt (kein Geheimnis darin, reine DDL-Fehlermeldung).
  Häufige Ursachen: eine Migration wurde von Hand am Zielsystem verändert
  (Prüfsumme gibt es hier nicht — die Datei muss identisch mit der im Abbild
  sein), eine Erweiterung fehlt auf dem Zielsystem (`CREATE EXTENSION`
  schlägt fehl, wenn die Datenbank sie nicht mitbringt — bei einer verwalteten
  PostGIS-Datenbank vorher prüfen), eine Berechtigung fehlt der Anwendungsrolle.
- Ist die Ursache nicht kurzfristig behebbar UND die Datenbank bereits in
  einem unklaren Zwischenzustand (sollte durch die Transaktion pro Datei
  eigentlich nicht vorkommen, aber: mehrere Migrationsdateien könnten in
  Summe einen Zwischenzustand hinterlassen, wenn einige schon committet
  waren): Backup von VOR dem Migrationsversuch einspielen (`db/RESTORE.md`),
  altes Anwendungsabbild weiterlaufen lassen, Migration in Ruhe reparieren
  und in einer Wegwerf-Datenbank testen (`db/RESTORE.md`, Abschnitt
  Katastrophentest — derselbe Weg wie `fw_restore_test_*`, nur mit der neuen
  Migrationsdatei).

## 7. Verdacht auf Zugangsdatenleck

Reihenfolge, nicht optional, nicht parallelisierbar (jeder Schritt kann den
nächsten kurzzeitig stören — das ist hinzunehmen, ein Leck ist dringlicher):

1. **`APP_SECRET` rotieren.** `server/auth.ts` signiert Sitzungen damit
   (`secret: env().APP_SECRET`) — eine Rotation macht ALLE bestehenden
   Sitzungen ungültig, jede Person muss sich neu anmelden. Das ist der
   gewünschte Effekt bei einem Leckverdacht, keine Nebenwirkung.
2. **Datenbankpasswort rotieren** (beim Anbieter/auf dem Datenbankserver),
   `DATABASE_URL` in der Umgebung der Anwendung aktualisieren, Anwendung neu
   starten.
3. **S3-Zugangsschlüssel rotieren** (`S3_ACCESS_KEY_ID`/
   `S3_SECRET_ACCESS_KEY` beim Anbieter neu ausstellen, alte Schlüssel
   sofort widerrufen), Umgebung aktualisieren, Anwendung neu starten.
4. **SMTP-Zugangsdaten rotieren** (`SMTP_USER`/`SMTP_PASSWORD` beim
   Mailanbieter), Umgebung aktualisieren, Anwendung neu starten.
5. **`audit_log` prüfen** — wer hat in der fraglichen Zeitspanne was getan:
   ```sql
   SELECT created_at, actor_user_id, actor_role, action, entity_type, entity_id, previous_state, new_state
     FROM audit_log
    WHERE created_at >= '<verdaechtiger Zeitpunkt>'
    ORDER BY created_at;
   ```
   Besonders auf `role.changed`, `org.verify`, `listing.status_change` mit
   unbekanntem `actor_user_id` achten. `audit_log` enthält bewusst keine
   Inhalte, nur Vorgänge (siehe `db/migrations/0007_moderation.sql`) — für
   Kontoinhalte zusätzlich `app_user`/`org_membership` zum fraglichen
   Zeitpunkt gegenprüfen.
6. **Meldepflicht ist eine Rechtsfrage → „Rechtsprüfung“.** Ob und wann eine
   Meldung an Betroffene oder eine Behörde nötig ist (Datenschutzrecht),
   entscheidet dieses Runbook NICHT — das ist an dieser Stelle immer
   „Rechtsprüfung“ zu vermerken und an die dafür zuständige Person zu
   eskalieren, nie selbst zu entscheiden oder stillschweigend zu unterlassen.
