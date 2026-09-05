# FOURWALLS — Aufgeschobene Infrastruktur (Zero-Cost bis kurz vor dem Start)

Stand 5. September 2026. Entscheidung des Auftraggebers: keine bezahlte
Infrastruktur, bevor der öffentliche Start feststeht. P5.5 hat die gesamte
Architektur dafür gebaut und lokal kostenlos bewiesen (Docker, PostgreSQL/
PostGIS, MinIO, Mailpit). Diese Datei listet, was **kurz vor dem echten
Start** noch zu tun ist — nichts davon ist heute begonnen, nichts davon
kostet heute etwas.

Jeder Punkt trägt **DEFERRED — NO COST UNTIL LAUNCH PREPARATION.**

## Domain & DNS
- [ ] Domain registrieren oder vorhandene Domain verwenden — **DEFERRED**
- [ ] DNS-Zone anlegen, `staging.<domain>` und später die Produktionsdomain — **DEFERRED**
- [ ] SPF-Eintrag für den Mailversand — **DEFERRED**
- [ ] DKIM-Einträge (vom Mailanbieter generiert) — **DEFERRED**
- [ ] DMARC-Eintrag — **DEFERRED**
- [ ] Optional DNSSEC — **DEFERRED**

## Hosting (Schweiz)
- [ ] Exoscale-Konto mit Zahlungsmittel — **DEFERRED**
- [ ] IAM-API-Schlüssel mit eingeschränkter Rolle (Compute, DBaaS, SOS) — **DEFERRED**
- [ ] Compute-Instanz in `ch-gva-2` oder `ch-dk-2` — **DEFERRED**
- [ ] Kostentor bestätigen (siehe `docs/p5.5-plan.md`, ≈ 122 EUR/Monat + Mail) — **DEFERRED**

## Datenbank
- [ ] Managed PostgreSQL/PostGIS anlegen (Plan **startup-4** wegen Fork-Fähigkeit für Rückspieltests — hobbyist-2 kann nicht forken) — **DEFERRED**
- [ ] IP-Filter auf die Anwendungsinstanz einschränken — **DEFERRED**
- [ ] CA-Zertifikat ziehen (`exo dbaas ca-certificate`), `sslmode=verify-full` scharf schalten — **DEFERRED**
- [ ] Migrationen 0001–0013 von null einspielen (Befehl bereits dokumentiert und lokal bewiesen: `node scripts/migrate.mjs`) — **DEFERRED, aber sofort ausführbar, sobald die DB existiert**
- [ ] Sicherungsplan/PITR des Anbieters bestätigen — **DEFERRED**
- [ ] Echten Fork-Rückspieltest auf der verwalteten Datenbank wiederholen (lokal bereits mit eigenem Postgres-Container bewiesen, siehe P5.5-Bericht) — **DEFERRED**

## Objektspeicher
- [ ] Exoscale SOS: zwei Behälter (privat/öffentlich) in derselben Zone — **DEFERRED**
- [ ] `scripts/s3-buckets.mjs` gegen SOS laufen lassen (Policy, CORS, Versionierung — CORS wurde gegen MinIO nur als Warnung behandelt, weil MinIO es nicht je Behälter kann; SOS muss es können — das ist beim echten Lauf zu verifizieren, nicht anzunehmen) — **DEFERRED**
- [ ] Objektspeicher-Sicherungsstrategie beim Anbieter bestätigen (Replikation, ggf. Versionierung/Object Lock) — **DEFERRED**

## E-Mail
- [ ] Infomaniak-Absenderadresse (z. B. `noreply@<domain>`) — **DEFERRED**
- [ ] Anwendungspasswort für authentifiziertes SMTP — **DEFERRED**
- [ ] SPF/DKIM/DMARC extern verifizieren (z. B. mit einem Prüfdienst) — **DEFERRED**
- [ ] Mindestens zwei Sprachen der Transaktionsmails gegen ein echtes Postfach bestätigen (lokal mit Mailpit bereits bewiesen: 6 Mailarten × 4 Sprachen, siehe `i18n/messages/*/mail.json`) — **DEFERRED**

## HTTPS & Zugriff
- [ ] TLS-Zertifikat (Caddy + Let's Encrypt, `infra/staging/Caddyfile` liegt bereit) — **DEFERRED**
- [ ] Staging-Zugangsschleuse aktivieren (`STAGING_GATE_USER`/`STAGING_GATE_PASSWORD`, Code bereits vorhanden und lokal bewiesen) — **DEFERRED**
- [ ] `robots.txt`/`x-robots-tag` in Staging prüfen (Code bereits vorhanden) — **DEFERRED**

## Geheimnisse
- [ ] `APP_SECRET`, `DATABASE_URL`, `S3_*`, `SMTP_*`, `STAGING_GATE_*` in `/etc/fourwalls/staging.env` auf dem Host ablegen, nie im Repository — **DEFERRED**
- [ ] Geheimnis-Rotation einmal üben (z. B. SMTP-Passwort wechseln, ohne die Anwendung neu zu bauen) — **DEFERRED**

## Beobachtung
- [ ] Zentrale Protokollsammlung (Docker-Logs reichen für den Anfang) — **DEFERRED**
- [ ] Fehlerüberwachung (z. B. GlitchTip/Sentry-kompatibel) nur, wenn ein konkreter Bedarf entsteht — **DEFERRED**

## Externe Sicherheitsverifikation
- [ ] Alle P5.4/P5.5-Sicherheitsfalsifikationen (IDOR, Rechteausweitung, CSRF, XSS, SQLi, Dateiangriffe, Ratenlimits, Geo-Lecks) gegen die echte HTTPS-Adresse wiederholen — lokal bereits 39/39 gegen den Produktionsbau mit S3+SMTP bewiesen — **DEFERRED**

## Auslöser: wann diese Liste abgearbeitet wird
Erst wenn der Auftraggeber den öffentlichen Start konkret vorbereitet
(Marketing, echte Anbieter/Kundschaft in Aussicht). Bis dahin bleibt die
Anwendung lokal lauffähig mit `STORAGE_PROVIDER=local`/`MAIL_PROVIDER=dev`
(Entwicklung) oder mit MinIO/Mailpit (production-naher lokaler Beweis, siehe
P5.5-Bericht) — ohne einen einzigen bezahlten Dienst.

## Was NICHT aufgeschoben ist (schon fertig, kostenlos, wiederverwendbar)
Architektur, Code und Nachweise aus P5.5 bleiben unverändert gültig und
werden beim Wechsel auf echte Infrastruktur nur noch mit echten Werten
befüllt, nicht neu gebaut:
`services/storage-s3.ts`, `services/mail-smtp.ts`, `server/outbox.ts`,
`services/bilder.ts`, `app/Dockerfile`, `infra/staging/*`, `proxy.ts`
(Staging-Schleuse), `lib/sicherheitskoepfe.ts` (CSP/HSTS zur Laufzeit),
`server/env.ts` (Umgebungswächter), `.github/workflows/app-ci.yml`
(Migrationstor, Abbild-Bau), `docs/p5.5-plan.md` (Providerfakten, Kostentor),
`docs/p5.5-datenfluss-und-auftragsverarbeiter.md` (Auftragsverarbeiter-Inventar).
