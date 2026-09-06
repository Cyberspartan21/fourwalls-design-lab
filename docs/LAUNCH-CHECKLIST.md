# FOURWALLS — Launch-Checkliste

Automatisch erzeugt von `scripts/launch-checkliste.mjs` am 2026-09-06T18:17:24.303Z. Nicht von Hand bearbeiten —
die eine Quelle der Wahrheit ist `config/bereitschaft.ts` (P5.10 §3/§4).

**launchReady: NEIN** — wahr nur, wenn TECH, BUSINESS, LEGAL und INFRA alle bereit sind.

## TECH — nicht bereit

| ID | Titel | Status | Blocker | Beleg |
|---|---|---|---|---|
| `migrationen` | Datenbankmigrationen aktuell | ✗ fehlt | ja | 20/21 Migrationen angewendet |
| `umgebung` | Umgebungsschema gültig | ✓ ok | ja | Umgebungsschema gültig |
| `outbox` | Outbox-Arbeiter aktiv | ✓ ok | ja | instrumentation.ts registriert den Outbox-Arbeiter |
| `speicher` | Speicher-Provider konfiguriert | ✓ ok | ja | Objektspeicher: lokal (Entwicklung) |
| `sitemap_robots` | Sitemap/robots vorhanden | ✓ ok | ja | robots.ts und sitemap.ts vorhanden |
| `ci_suites` | CI-Testsuiten vorhanden | ✓ ok | ja | 24 Integrationsskripte, 19 Unit-Testdateien |

## BUSINESS — nicht bereit

| ID | Titel | Status | Blocker | Beleg |
|---|---|---|---|---|
| `firma_markenname` | Markenname | ✗ fehlt | ja | Platzhalter, noch nicht bestätigt |
| `firma_firmierung` | Firmierung | ✗ fehlt | ja | Platzhalter, noch nicht bestätigt |
| `firma_rechtsform` | Rechtsform | ✗ fehlt | ja | Platzhalter, noch nicht bestätigt |
| `firma_uid` | UID / Handelsregister-Nummer | ? unentschieden | ja | offen — nichts hinterlegt |
| `firma_strasse` | Strasse | ✗ fehlt | ja | Platzhalter, noch nicht bestätigt |
| `firma_plzOrt` | PLZ/Ort | ✗ fehlt | ja | Platzhalter, noch nicht bestätigt |
| `firma_telefon` | Telefon | ✗ fehlt | ja | Platzhalter, noch nicht bestätigt |
| `firma_email` | E-Mail | ✗ fehlt | ja | Platzhalter, noch nicht bestätigt |
| `aussage_honorarNurBeiErfolg` | Geschäftsaussage: honorarNurBeiErfolg | ✓ ok | nein | Geschäftsentscheid getroffen |
| `aussage_mandatLaufzeit` | Geschäftsaussage: mandatLaufzeit | ✓ ok | nein | Geschäftsentscheid getroffen |
| `aussage_kaeuferliste` | Geschäftsaussage: kaeuferliste | ✓ ok | nein | Geschäftsentscheid getroffen |
| `aussage_verwaltungPreismodell` | Geschäftsaussage: verwaltungPreismodell | ✓ ok | nein | Geschäftsentscheid getroffen |
| `aussage_eigentuemerReport` | Geschäftsaussage: eigentuemerReport | ✓ ok | nein | Geschäftsentscheid getroffen |
| `aussage_finanzierungspartner` | Geschäftsaussage: finanzierungspartner | ✓ ok | nein | Geschäftsentscheid getroffen |
| `aussage_exclusivePraesentation` | Geschäftsaussage: exclusivePraesentation | ✓ ok | nein | Geschäftsentscheid getroffen |
| `aussage_vertrittVerkaeuferschaft` | Geschäftsaussage: vertrittVerkaeuferschaft | ✓ ok | nein | Geschäftsentscheid getroffen |
| `aussage_dokumentFreigabe` | Geschäftsaussage: dokumentFreigabe | ✓ ok | nein | Geschäftsentscheid getroffen |
| `aussage_identitaetGeprueft` | Geschäftsaussage: identitaetGeprueft | ✓ ok | nein | Geschäftsentscheid getroffen |
| `aussage_erstvermietungMarktmiete` | Geschäftsaussage: erstvermietungMarktmiete | ✓ ok | nein | Geschäftsentscheid getroffen |

## LEGAL — nicht bereit

| ID | Titel | Status | Blocker | Beleg |
|---|---|---|---|---|
| `recht_impressum` | Impressum | ? unentschieden | ja | LEGAL_REVIEW_REQUIRED |
| `recht_datenschutz` | Datenschutzerklärung | ? unentschieden | ja | LEGAL_REVIEW_REQUIRED |
| `recht_agb` | Allgemeine Geschäftsbedingungen | ? unentschieden | ja | LEGAL_REVIEW_REQUIRED |
| `recht_inseratsbedingungen` | Inseratsbedingungen | ? unentschieden | ja | LEGAL_REVIEW_REQUIRED |
| `recht_anbieterbedingungen` | Anbieterbedingungen | ? unentschieden | ja | LEGAL_REVIEW_REQUIRED |
| `retention` | Aufbewahrung/Löschfristen | ? unentschieden | ja | UNDECIDED / LEGAL REVIEW REQUIRED (P5.10) |

## INFRA — nicht bereit

| ID | Titel | Status | Blocker | Beleg |
|---|---|---|---|---|
| `app_env` | Umgebung auf production gesetzt | ✗ fehlt | ja | Umgebung ist nicht production. |
| `site_url` | Öffentliche Adresse produktionsreif | ✗ fehlt | ja | Öffentliche Adresse ist lokal oder nicht https. |
| `mail` | Mailversand produktionsreif | ✗ fehlt | ja | Mailversand: Entwicklungssenke. |
| `speicher_infra` | Objektspeicher produktionsreif | ✗ fehlt | ja | Objektspeicher: lokal oder kein externer Endpunkt. |
| `datenbank` | Datenbank produktionsreif | ✗ fehlt | ja | Datenbank ist eine lokale Adresse. |
| `backup` | Backup-Nachweis vorhanden | ✗ fehlt | ja | Kein Backup-Nachweis vorhanden. |
| `domain_dns_https` | Domain/DNS/HTTPS geprüft | ✗ fehlt | ja | Kein Nachweis geprüft (kein Netzaufruf im Bereitschaftscheck). |
