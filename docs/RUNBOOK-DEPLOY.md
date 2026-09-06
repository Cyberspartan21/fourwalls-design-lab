# FOURWALLS — Deployment-Runbook (P5.10 §37)

Anbieterneutral: kein Anbietername steckt in Code oder Skripten dieses
Projekts (siehe `app/server/env.ts`/`app/domain/env.ts` — nur Endpunkt/
Zugangsdaten kommen aus der Umgebung). Wo unten dennoch ein Beispiel genannt
wird (Exoscale, Infomaniak), ist das eine ILLUSTRATION aus
`docs/PRODUCTION-INFRA-DEFERRED.md`, keine Bindung.

Bis der Auftraggeber den öffentlichen Start konkret vorbereitet, bleibt
Infrastruktur ausserhalb dieses Rechners aufgeschoben (Zero-Cost-Regel, siehe
`docs/PRODUCTION-INFRA-DEFERRED.md` und `CLAUDE.md`). Dieses Runbook
beschreibt den Weg für DANN — die Bausteine (Dockerfile, `infra/staging/*`,
`server/env.ts`) sind bereits gebaut und lokal bewiesen.

## 0. Reihenfolge auf einen Blick

1. Datenbank bereitstellen (PostGIS) → Migrationen fahren.
2. Objektspeicher bereitstellen (zwei Behälter) → `scripts/s3-buckets.mjs`.
3. E-Mail (SMTP) einrichten, SPF/DKIM/DMARC voraus.
4. Domain/DNS/HTTPS (Reverse Proxy) einrichten.
5. Umgebungsvariablen setzen (siehe `.env.example`, Abschnitt 1 unten).
6. Abbild bauen oder ziehen, Migrationen laufen lassen, Anwendung starten.
7. Ersten Admin bootstrapen, danach die Bootstrap-Variable entfernen.
8. Health/Ready prüfen, Backup-Cron einrichten.

## 1. Umgebungsvariablen (Produktion)

Die eine massgebliche Quelle ist `app/.env.example` (Kommentare je Variable)
und die Prüflogik in `app/domain/env.ts` (von `app/server/env.ts` beim
Start aufgerufen — die Anwendung startet NICHT, wenn etwas Pflichtiges fehlt
oder falsch ist: fail closed, keine stillschweigenden Entwicklungswerte
ausserhalb der Entwicklung). Zusammengefasst, was `domain/env.ts` für
`APP_ENV=production` zusätzlich zu den Grundwerten verlangt (Stand: siehe
Datei selbst für die exakte, aktuell gültige Fassung — sie kann sich
weiterentwickeln):

- `APP_SECRET` — mindestens 32 Zeichen, kein bekannter Build-/CI-Platzhalter.
- `STORAGE_PROVIDER=s3` mit `S3_ENDPOINT` (https), `S3_BUCKET_PRIVATE`,
  `S3_BUCKET_PUBLIC` (verschieden), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
- `MAIL_PROVIDER=smtp` mit `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`;
  `SMTP_VERIFY_CERT=nein` ist ausserhalb der Entwicklung verboten.
- `DATABASE_URL` — keine lokale Adresse, `sslmode=require|verify-ca|verify-full`.
- `NEXT_PUBLIC_SITE_URL` — `https://…`, keine lokale Adresse.
- `SERVICE_LEAD_INBOX` — Pflicht, keine `.example`-Adresse; `MAIL_FROM`
  ebenfalls keine `.example`-Adresse in Produktion.
- `DEMO_INHALTE` — in Produktion MUSS die Variable explizit `an` oder `aus`
  gesetzt sein (kein stiller Default). Praktisch: `aus` — kein Demo-Bestand
  in einer echten Produktionsumgebung (siehe Abschnitt 6, Bootstrap).
- `STAGING_GATE_USER`/`STAGING_GATE_PASSWORD` — in Produktion VERBOTEN
  (gehören nur zu `APP_ENV=staging`).

Geheimnisse liegen NIE im Repository — siehe `infra/staging/README.md` für
das Muster (`/etc/fourwalls/staging.env` auf dem Host, `chmod 600`); für
Produktion gilt dasselbe Muster mit einer eigenen Datei/einem eigenen Secret-
Store.

## 2. Datenbank

- PostgreSQL 16 mit PostGIS 3.4 (siehe `infra/local/docker-compose.yml`,
  Image `postgis/postgis:16-3.4-alpine`, als Referenz — verwaltet oder
  selbst betrieben, Version bindend).
- Eigene Rolle für die Anwendung (nicht der Superuser), Passwort aus dem
  Secret-Store.
- Verschlüsselte Verbindung ab Werk (`sslmode=verify-full`, CA-Zertifikat
  des Anbieters ziehen, wie in `docs/PRODUCTION-INFRA-DEFERRED.md`
  vorgesehen).
- Migrationen: siehe Abschnitt 5 — laufen VOR jedem Start, nie danach.
- Backups: siehe Abschnitt 8 (Cron) und `db/RESTORE.md`.

## 3. Objektspeicher

- S3-kompatibel, zwei Behälter in derselben Zone: PRIVATE (Originale,
  Unveröffentlichtes) und PUBLIC (Ableitungen veröffentlichter Bilder) —
  nie derselbe Behälter (Prüfung in `domain/env.ts`).
- Pfadstil (`S3_FORCE_PATH_STYLE`): `nein` für Anbieter mit
  Subdomain-Adressierung, `ja` nur für Endpunkte wie MinIO, die das
  brauchen.
- CORS ist für diese Anwendung NICHT nötig (Bilder werden über die
  Anwendung ausgeliefert bzw. mit signierten Adressen, kein direkter
  Browser-Zugriff über Cross-Origin-Requests auf den Behälter hinaus, der
  eine CORS-Regel bräuchte). `scripts/s3-buckets.mjs` setzt trotzdem eine
  CORS-Regel auf dem öffentlichen Behälter (siehe Datei) — schadet nicht,
  ist aber keine Voraussetzung für den Betrieb.
- Einrichtung: `node scripts/s3-buckets.mjs` mit den `S3_*`-Variablen aus
  der Zielumgebung in `process.env` (idempotent: legt beide Behälter an,
  falls sie fehlen, setzt die enge Leserichtlinie auf PUBLIC, Versionierung
  auf PRIVATE, prüft, dass PRIVATE keine öffentliche Richtlinie trägt).

## 4. E-Mail

- Authentifizierter SMTP-Versand, STARTTLS (Port 587, Standard) oder
  implizites TLS (Port 465) — nie unverschlüsselt
  (`SMTP_TLS`/`SMTP_VERIFY_CERT` in `domain/env.ts`).
- Voraussetzung, bevor die erste Produktionsmail verschickt wird: SPF-,
  DKIM- und DMARC-Einträge für die Absenderdomain sind gesetzt (siehe
  `docs/PRODUCTION-INFRA-DEFERRED.md`, Abschnitt E-Mail) — sonst landen
  Bestätigungs- und Anliegen-Mails im Spam oder werden abgewiesen.
- `SERVICE_LEAD_INBOX`: das Geschäftspostfach für Anliegen an FOURWALLS
  (Verkauf/Vermietung/Bewertung/Verwaltung/Beratung) — Pflicht in
  Produktion, keine Beispieldomäne.
- Die Outbox (`mail_outbox`, `server/outbox.ts`) entkoppelt Versand von der
  fachlichen Transaktion — ein SMTP-Ausfall blockiert keine Veröffentlichung
  oder Anfrage. Details zum Betrieb der Outbox (Zähler, erneutes Einreihen):
  siehe `docs/RUNBOOK-INCIDENT.md`, Abschnitt Mail-Rückstau, und die
  vertiefende Outbox-Dokumentation (in Arbeit, paralleler Workstream).

## 5. Domain/DNS/HTTPS

- Reverse Proxy vor der Anwendung terminiert TLS — Referenz liegt bereit:
  `infra/staging/Caddyfile` (automatisches Let's-Encrypt-Zertifikat über
  eine Domain-Adresse, kein manuelles Zertifikatshandling).
- Die Anwendung selbst setzt bereits Sicherheitsköpfe (CSP, X-Frame-Options
  etc. — siehe `lib/sicherheitskoepfe.ts`); der Proxy fügt nichts hinzu,
  entfernt nur, was die Software selbst preisgibt (`-Server` im Caddyfile).
- **HSTS erst nach Test**: Bevor `Strict-Transport-Security` mit einer
  langen `max-age` scharf geschaltet wird, muss die Domain zuverlässig unter
  HTTPS erreichbar sein (Zertifikat, Redirect 80→443, kein gemischter
  Inhalt) — ein verfrühtes HSTS mit langer Gültigkeit lässt sich nicht mehr
  zurücknehmen, solange Clients es gespeichert haben. Erst kurz testen (kurze
  `max-age`, kein `preload`), dann verlängern.
- Staging zusätzlich hinter einer HTTP-Basic-Zugangsschleuse
  (`STAGING_GATE_USER`/`STAGING_GATE_PASSWORD`, siehe `proxy.ts`) — in
  Produktion verboten (siehe Abschnitt 1).

## 6. Migrationen

- `node scripts/migrate.mjs` läuft VOR jedem Start gegen die Ziel-`DATABASE_URL`
  — siehe `infra/staging/deploy.sh` als Referenzablauf: Abbild ziehen →
  laufendes Abbild für Rollback merken → Migrationen fahren → nur wenn das
  gelingt, neu starten. Scheitert die Migration, bleibt die VORHERIGE Version
  online, nichts wird neugestartet.
- Rückwärtsstrategie: Migrationen in `db/migrations/` sind additiv/
  vorwärtskompatibel — es gibt bewusst KEINE automatischen Down-Migrationen
  (siehe `infra/staging/rollback.sh`, Kopfkommentar). Ein Rollback der
  Anwendung auf ein älteres Abbild funktioniert deshalb gegen ein bereits
  neueres Schema weiter, solange neuere Migrationen nur hinzugefügt haben.
- **Vor jeder Migration in Produktion: Backup.** `./app/scripts/db-backup.sh
  <ziel>.dump "$DATABASE_URL"` (siehe `db/RESTORE.md`) — nicht optional,
  auch wenn die Migration additiv aussieht.
- Transaktionsverhalten: siehe `docs/RUNBOOK-INCIDENT.md`, Abschnitt
  Migrationsfehler.

## 7. Bootstrap (erste Admin-Person)

- KEINE Demo-Seeds in Produktion: `scripts/migrate.mjs --seed` und
  `scripts/import-demo.mjs` verweigern den Dienst, wenn `APP_ENV=production`
  (siehe `migrate.mjs`, Funktion `seeden()`); `DEMO_INHALTE=aus` schaltet
  zusätzlich die Auslieferung etwaiger Demo-Datensätze auf Anwendungsebene ab
  (`server/env.ts`, `demoSichtbar()`).
- Erste Person mit erhöhter Rolle: registrieren (normaler Weg über die
  Anwendung), dann einmalig
  ```
  FW_ALLOW_ROLE_BOOTSTRAP=ja node scripts/rolle.mjs <email> admin
  ```
  Das Skript verweigert sich in Produktion ohne diese Variable und verweigert
  sich auch MIT der Variable, sobald bereits eine Person mit `moderator`
  oder `admin` existiert (kein wiederholbares Hintertürchen). Direkt danach:
  `FW_ALLOW_ROLE_BOOTSTRAP` aus der Umgebung entfernen. Weitere Rollen vergibt
  diese erste Admin-Person danach über die Anwendung selbst.

## 8. Backup

- Cron (Host oder Orchestrator), täglich: `./app/scripts/db-backup.sh
  var/backups/$(date +%F).dump "$DATABASE_URL"`, danach an einen vom
  Datenbankhost getrennten Ort kopieren (Objektspeicher-Behälter eines
  anderen Anbieters oder zumindest einer anderen Zone — ein Backup, das auf
  derselben Maschine liegt wie die Datenbank, ist kein Backup).
- Objektspeicher: die meisten S3-kompatiblen Anbieter bieten serverseitige
  Replikation/Versionierung an (siehe `docs/PRODUCTION-INFRA-DEFERRED.md`,
  Abschnitt Objektspeicher) — das ersetzt keinen eigenen Abgleich, ergänzt
  ihn aber. `app/scripts/speicher-backup.mjs sichern <behaelter>
  <zielordner>` für einen eigenen, anbieterunabhängigen Objektabzug.
- Nachweis: der Katastrophentest (`app/scripts/katastrophen-test.mjs`,
  siehe `db/RESTORE.md`) beweist monatlich (oder nach jeder wesentlichen
  Schemaänderung), dass eine Sicherung tatsächlich wiederherstellbar ist,
  und schreibt `docs/backup-nachweis.json` — die Bereitschaftsprüfung
  (`config/bereitschaft.ts`, INFRA-Tor) markiert einen Nachweis als
  veraltet, sobald er älter als 30 Tage ist.

## 9. Restore

Siehe `db/RESTORE.md` — vollständig, mit den tatsächlich geprüften Befehlen
(`app/scripts/db-restore.sh`) und der Begründung, warum ein sektionierter
Restore bei älteren Sicherungen nötig ist (Migration 0014 behebt es an der
Quelle für neuere Sicherungen).

## 10. Health, Ready, Launch — drei getrennte Konzepte

Diese Anwendung unterscheidet bewusst drei Fragen, die NIE zu einer
verschmelzen:

1. **`/api/health`** — „Lebt der Prozess?“ Keine Datenbankprüfung, immer
   `200`, solange Node antwortet. Das ist die Grundlage für den Docker-
   `HEALTHCHECK` im `app/Dockerfile` und für den Reverse Proxy.
2. **`/api/ready`** — „Darf diese Instanz technisch Produktionsverkehr
   annehmen?“ Prüft Datenbankverbindung, Migrationsstand und
   Umgebungsschema; `200` oder `503`. Das ist die Ampel für Orchestrierung/
   Load Balancer, NICHT für die Frage, ob FOURWALLS öffentlich starten soll.
3. **`launch`/Bereitschaft** (`config/bereitschaft.ts`,
   `domain/bereitschaft.ts`, im Antworttext von `/api/ready` unter dem
   Schlüssel `launch` mitgeliefert, rein informativ) — vier getrennte Tore
   (TECH, BUSINESS, LEGAL, INFRA), die NIE zu einem einzigen Wert
   verschmelzen. Ein fehlendes Geschäfts- oder Rechtstor beeinflusst NIE
   den HTTP-Status von `/api/ready` — eine Staging-Umgebung kann technisch
   „ready“ sein, ohne dass der Auftraggeber dort öffentlich starten will.
   `launchReady` (alle vier Tore wahr) ist die einzige Stelle, die die
   volle Startbereitschaft behauptet.

Nach jedem Deploy:
```
curl -i https://<host>/api/health     # 200, ohne Zugang
curl -i https://<host>/api/ready      # 200 oder 503, ohne Zugang — Feld launch beachten
```

## 11. Rollback

- Reines Anwendungsproblem (kein destruktiver Migrationsschritt seither):
  `infra/staging/rollback.sh` bzw. das analoge Produktionsskript — startet
  das zuletzt gemerkte vorherige Abbild neu. Die Datenbank bleibt
  unverändert (siehe Abschnitt 6).
- War die letzte Migration destruktiv (sollte laut §-Vorgabe grundsätzlich
  vermieden werden, siehe `docs/RUNBOOK-INCIDENT.md`, Abschnitt
  Migrationsfehler) oder hat der fehlerhafte Deploy bereits fehlerhafte
  Daten geschrieben: vorheriges Abbild einspielen UND das Backup von VOR der
  Migration einspielen (`db/RESTORE.md`) — in dieser Reihenfolge, nie nur
  eines von beiden.

## 12. Docker-Abbild

- `app/Dockerfile`: zweistufiger Build (Next.js `output: "standalone"`),
  Basisimage per Digest gepinnt (kein bewegliches Tag), ein Abbild für alle
  Umgebungen — die echte Konfiguration kommt ausschliesslich zur Laufzeit
  über Umgebungsvariablen (`server/env.ts` prüft sie beim Start, fail
  closed). Build-Kontext ist die REPOSITORY-WURZEL, nicht `app/` (`db/`
  liegt daneben und wird mitkopiert für `migrate.mjs`):
  ```
  docker build -f app/Dockerfile -t fourwalls-app:<tag> .
  ```
- `.github/workflows/app-ci.yml`, Job `image`: baut dieses Abbild bei jedem
  Push auf `main` (kein Push in eine Registry in dieser Datei — das ist ein
  bewusst unvollständiger, dokumentierter Zwischenstand, siehe
  `docs/PRODUCTION-INFRA-DEFERRED.md`).
- `infra/staging/deploy.sh` + `infra/staging/docker-compose.yml` +
  `infra/staging/Caddyfile` sind der geprüfte Referenzweg für einen Host mit
  Docker Compose; eine Produktionsumgebung folgt demselben Muster mit einer
  eigenen `docker-compose.yml`/`Caddyfile`-Instanz und eigenem
  `/etc/fourwalls/<umgebung>.env` (siehe `infra/staging/README.md` für die
  Ersteinrichtung, sinngemäss auf Produktion übertragen).
