# FOURWALLS — Staging-Betrieb

Container, Migrationstor, Rollback. Kein Anbieterbefehl in diesem Ordner —
das Abbild kommt aus einer Registry, deren Adresse Teil von `APP_IMAGE` ist.

## Wo die Geheimnisse liegen

`/etc/fourwalls/staging.env` auf dem Host — **nicht** in diesem Repo. Enthält
mindestens alle Pflichtwerte, die `server/env.ts` in Staging verlangt
(`APP_SECRET`, `DATABASE_URL` mit `sslmode=verify-full`, `STORAGE_PROVIDER=s3`
samt `S3_*`, `MAIL_PROVIDER=smtp` samt `SMTP_*`, `STAGING_GATE_USER`,
`STAGING_GATE_PASSWORD`, `APP_ENV=staging`, `NEXT_PUBLIC_SITE_URL=https://…`).
Die Anwendung selbst prüft das beim Start noch einmal (fail closed) — dieser
Ordner verlässt sich nicht allein auf disziplinierte Pflege der Datei.

Rechte auf dem Host: `chmod 600 /etc/fourwalls/staging.env`, Eigentümer der
Benutzer, unter dem `docker` läuft.

## Ersteinrichtung (einmalig auf dem Host)

1. Docker und Docker Compose installieren.
2. Gemeinsames Netzwerk für Anwendung und Caddy anlegen:
   `docker network create fourwalls_edge`
3. Caddy installieren (Paket oder eigener Container) und mit `Caddyfile` aus
   diesem Ordner starten, angehängt an `fourwalls_edge`. `STAGING_HOST` muss
   in der Umgebung von Caddy gesetzt sein (z. B. `staging.fourwalls.example`).
   Häfen 80/443 zeigen auf Caddy, nicht auf die Anwendung direkt.
4. `/etc/fourwalls/staging.env` mit allen Pflichtwerten anlegen (siehe oben),
   `chmod 600`.
5. `mkdir -p /var/lib/fourwalls` (Merkdatei für Rollback).
6. Erster Deploy: siehe unten.

## Deploy

```
cd infra/staging
APP_IMAGE=<registry>/fourwalls-app:<tag> ./deploy.sh
```

Ablauf: Abbild ziehen → laufendes Abbild für Rollback merken → Migrationen
fahren (`node app/scripts/migrate.mjs` im neuen Abbild, gegen dieselbe
`staging.env`) → nur wenn das gelingt, `docker compose up -d`. Scheitert die
Migration, bleibt die vorherige Version weiter online, nichts wird
neugestartet.

Nach dem Deploy prüfen:
```
curl -i https://<STAGING_HOST>/api/health     # 200, kein Zugang nötig
curl -i https://<STAGING_HOST>/api/ready      # 200 oder 503, kein Zugang nötig
curl -i https://<STAGING_HOST>/de             # 401 ohne Zugang, 200/308 mit -u
```

## Rollback

```
cd infra/staging
./rollback.sh
```

Setzt `APP_IMAGE` auf das von `deploy.sh` gemerkte vorherige Abbild
(`/var/lib/fourwalls/previous-image`) und startet neu. Die Datenbank bleibt
unverändert — Migrationen sind vorwärtskompatibel, es gibt keine
Rückwärtsmigration. Ein Rollback über mehr als eine Version zurück: die
gewünschte `APP_IMAGE` von Hand in `docker-compose.yml`-Aufruf setzen
(`APP_IMAGE=<älteres-tag> docker compose up -d`), statt `rollback.sh` zu
verwenden (das kennt nur die zuletzt vorherige Version).

## Log und Zustand

`docker compose -f infra/staging/docker-compose.yml logs -f app`
`docker compose -f infra/staging/docker-compose.yml ps`
