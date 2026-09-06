# FOURWALLS — CI-Kette der Anwendung (`app-ci.yml`)

P5.10 §19-Nachtrag/§43/§45. Übersicht über alle Schritte, eine grobe
Dauer-Schätzung, die Isolationsregeln zwischen den HTTP-Prüfsuiten und wie
sich die ganze Kette lokal nachstellen lässt.

## Warum zwei Jobs

`pruefen` und `haertung` laufen **parallel** (kein `needs` zwischen ihnen),
jeder mit eigenem Postgres/PostGIS-Dienstcontainer und eigenem
Migrieren/Seeden/Bauen/Starten. Grund: alle Schritte in einem einzigen Job
hätten das in P5.10 §19 gesetzte 45-Minuten-Budget riskiert. `image` (das
Docker-Abbild) baut erst, nachdem **beide** grün sind (`needs: [pruefen,
haertung]`) — das ist das eigentliche "Master-Gate". `migrationstor` bleibt
ein dritter, unabhängiger Job (reine Migrationsprüfung, kein Seed, kein
Build).

Neue Schritte, deren Skript aus einer parallelen Spur (H3a/H3b/H7/H8) noch
nicht existiert, laufen nur mit `if: hashFiles('app/scripts/<datei>') != ''`
— ein Skript, das gerade erst entsteht, macht die Kette nicht rot. Zum
Zeitpunkt dieses Standes fehlen noch:

- `scripts/upload-angriff-test.mjs` (H3a)
- `scripts/final-sicherheit-test.mjs` (H3b)

Alle anderen in diesem Dokument genannten Skripte existierten bereits und
sind fest verdrahtet.

`scripts/leistung-test.mjs` (H7) existiert ebenfalls, ist aber **nicht**
Teil dieser Kette — es stand nicht auf der Liste der hier verlangten
Schritte. Wer H7 abschliesst, entscheidet an dieser Stelle bewusst, ob und
in welchem Job es dazukommt (vermutlich `haertung`, da laufzeitintensiv).

## Schritte — Job `pruefen`

Kernkette und Kundenerlebnis. Läuft immer (kein `hashFiles`-Vorbehalt für
Skripte, die schon vor P5.10 bestanden).

| Schritt | Skript/Befehl | Geschätzte Dauer |
|---|---|---|
| Checkout, Node, `npm ci` | — | ~30–60 s |
| Lint | `npm run lint` | ~15 s |
| Typecheck | `npm run typecheck` | ~20 s |
| Unit-Tests | `npm test` | ~5 s |
| Migrationen von null + 19 Schema-Zusagen | `scripts/migrate.mjs`, `--test` | ~5 s |
| Seed (Entwicklungsbestand) | `scripts/migrate.mjs --seed` | ~10–20 s |
| Build | `npm run build` | ~60–120 s |
| Anwendung starten | `next start` + Health-Poll | ~5–15 s |
| Lieferkette | `lieferkette-test.mjs` | ~30–60 s |
| Sicherheit | `sicherheit-test.mjs` | ~30–60 s |
| Merkliste | `favoriten-test.mjs` | ~20–40 s |
| Suchabo + Alarm | `suchabo-test.mjs` | ~30–60 s |
| Verlauf/Vergleich | `verlauf-vergleich-test.mjs` | ~20–40 s |
| Anfragen-Kontobezug | `anfragen-test.mjs` | ~30–60 s |
| Seed professioneller Anbieter | `seed-profis.mjs` | ~10–20 s |
| Org & Team | `org-test.mjs` | ~20–40 s |
| Organisationsinserate | `org-inserate-test.mjs` | ~30–40 s |
| Org — Sicherheitsmatrix | `org-sicherheit-test.mjs` | ~20–40 s |
| Org — vier Reisen | `org-reisen-test.mjs` | ~30–60 s |
| Skalentest Org-Übersicht (N=1000) | `skalen-org-test.mjs 1000` | ~30–60 s |
| Anliegen — Lieferkette | `anliegen-test.mjs` | ~60–140 s |
| Anliegen — Sicherheitsmatrix | `anliegen-sicherheit-test.mjs` | ~30–60 s |
| Anliegen — sieben Reisen | `anliegen-reisen-test.mjs` | ~60–90 s |
| Skalentest Anliegen-Übersicht (N=1000) | `skalen-anliegen-test.mjs 1000` | ~30–60 s |
| Kontolöschung *(neu, P5.10 §9–§12)* | `kontoloeschung-test.mjs` | ~20–40 s |
| SEO und Index-Verhalten | `seo-test.mjs` | ~20–40 s |
| Antwort-Header *(neu)* | `header-test.mjs` | ~10–20 s |
| Fehlerseiten *(neu)* | `fehler-test.mjs` | ~10–20 s |

Geschätzte Gesamtdauer `pruefen`: **rund 15–20 Minuten**.

## Schritte — Job `haertung`

Sicherheits-Fuzzing, Autorisierung, Wissen/Mobil/A11y, Sichtprüfung,
Katastrophentest. Alle mit `hashFiles`-Vorbehalt, weil diese Skripte aus
parallelen Spuren (H3a/H3b/H7/H8) stammen und zum Zeitpunkt dieses Standes
teils noch entstehen.

| Schritt | Skript/Befehl | Geschätzte Dauer |
|---|---|---|
| Checkout, Node, `npm ci` | — | ~30–60 s |
| Migrationen von null + 19 Schema-Zusagen | `scripts/migrate.mjs`, `--test` | ~5 s |
| Seed (Entwicklungsbestand) | `scripts/migrate.mjs --seed` | ~10–20 s |
| Build | `npm run build` | ~60–120 s |
| Anwendung starten | `next start` + Health-Poll | ~5–15 s |
| Seed professioneller Anbieter | `seed-profis.mjs` | ~10–20 s |
| Auth-Härtung *(neu, H3a)* | `auth-haertung-test.mjs` | ~30–60 s |
| Eingabe-Fuzzing *(neu, H3a)* | `eingabe-fuzz-test.mjs` | ~30–60 s |
| Upload-Angriffe *(neu, H3a — Skript fehlt noch)* | `upload-angriff-test.mjs` | ~20–40 s |
| Autorisierungs-Master-Matrix *(neu, H3b)* | `autorisierung-matrix-test.mjs` | ~40–80 s |
| Finale Sicherheitsrunde *(neu, H3b — Skript fehlt noch)* | `final-sicherheit-test.mjs` | ~30–60 s |
| Wissen *(neu, H8)* | `wissen-test.mjs` | ~15–30 s |
| Mobile Kundenreisen *(neu, H8, Chrome)* | `mobil-reisen-test.mjs` | ~90–180 s (19 Reisen, Screenshots) |
| Basis-A11y *(neu, H8, Chrome)* | `a11y-test.mjs` | ~30–60 s |
| Sichtprüfung *(bestehend, verschoben aus `pruefen`)* | `tools/baseline.mjs` + `tools/sichtpruefung.mjs` | ~60–120 s |
| Postgres-Client installieren *(neu)* | `apt-get install postgresql-client` | ~10–20 s |
| Katastrophentest *(bestehend, jetzt CI-fähig)* | `katastrophen-test.mjs` (nur DB-Teil) | ~15–30 s |

Geschätzte Gesamtdauer `haertung`: **rund 10–15 Minuten** (bei bereits
existierenden Skripten; die beiden noch fehlenden werden übersprungen, bis
sie da sind).

Beide Jobs laufen parallel — Wanduhrzeit der Gesamtkette bis `image`: **rund
20 Minuten**, deutlich unter dem 45-Minuten-Budget.

## Isolationsregeln zwischen den HTTP-Prüfsuiten

Alle Suiten in `pruefen` und `haertung` laufen **sequentiell gegen denselben
Next-Server** (Port 3007) im selben Job. Zwei Mechanismen verhindern, dass
sie sich gegenseitig stören:

1. **Eigene `x-forwarded-for`-Herkunft je Suite.** Registrierung/Anmeldung
   ist je Herkunft ratenbegrenzt (`lib/ratelimit.ts`, `herkunftHash`). Jede
   Suite, die Konten anlegt, erzeugt sich einen eigenen Adressraum
   (`10.<RUNSEED>.<n>.<letztes-Oktett>`, `RUNSEED` zufällig pro Lauf) — siehe
   `xff()`/`xffTag` in `org-inserate-test.mjs`, `anfragen-test.mjs`,
   `anliegen-test.mjs`, `autorisierung-matrix-test.mjs`,
   `mobil-reisen-test.mjs` und (seit P5.10 §43) neu auch in
   `verlauf-vergleich-test.mjs` und `intern-mobil-test.mjs`. Suiten ohne
   Kontenanlage (`header-test.mjs`, `fehler-test.mjs`, `seo-test.mjs`,
   `routen-test.mjs`, die Skalentests, `mailquelle-test.mjs`,
   `outbox-test.mjs`, `katastrophen-test.mjs`) brauchen das nicht — sie
   registrieren keine Konten und sind vom Ratenlimit nicht betroffen.
2. **Eigene Konten-Präfixe je Suite** (`testadresse(kennzeichen, ts)`,
   `scripts/lib/mailquelle.mjs`). Jede Suite hat ein eindeutiges Kürzel;
   zusammen mit dem Zeitstempel im lokalen Adressteil kollidieren zwei
   Suiten nie auf derselben E-Mail-Adresse. Übersicht der vergebenen Kürzel
   (keine doppelt vergeben, Stand P5.10):

   | Kürzel-Präfix | Suite |
   |---|---|
   | `a`, `b`, `esc13`, `esc14` | `sicherheit-test.mjs` |
   | `lka`, `lkb` | `lieferkette-test.mjs` |
   | `fva`, `fvb`, `fvc` | `favoriten-test.mjs` |
   | `saa`, `sab`, `sac`, `sad` | `suchabo-test.mjs` |
   | `vlvg` | `verlauf-vergleich-test.mjs` |
   | `afa`, `afb`, `afc` | `anfragen-test.mjs` |
   | `orga`…`orgd` | `org-test.mjs` |
   | `oia`…`oid`, `alpha-org`, `alpha-verwaltung`, `beta-org`, `beta-verwaltung` | `org-inserate-test.mjs` |
   | `osa`…`osd`, `osx`, `osrl` | `org-sicherheit-test.mjs` |
   | `ora`, `orb`, `orc`, `ord`, `ore` | `org-reisen-test.mjs` |
   | `ala`, `alb`, `alstaff`, `alkunde`, `alx`, `s7ip*`, `s7mail`, `s102` | `anliegen-test.mjs` |
   | `asa`, `asb`, `asstaff`, `askunde`, `asx`, `as7-*` | `anliegen-sicherheit-test.mjs` |
   | `arb1`, `arb2`, `arstaff`, `arx`, `ara`, `arc`…`arg`, `h2-*` | `anliegen-reisen-test.mjs` |
   | `kla`…`kle` | `kontoloeschung-test.mjs` |
   | `amk`, `amp`, `amo1`, `ama1`, `amg1`, `amv1`, `amo2`, `amstaff`, `amadmin`, `aminv-*`, `am-abgelehnt` | `autorisierung-matrix-test.mjs` |
   | `ah-*` | `auth-haertung-test.mjs` |
   | `imstaff` (kein `testadresse()`, eigenes Muster) | `intern-mobil-test.mjs` |
   | `h8a+*` (kein `testadresse()`, eigenes Muster — siehe Kopfkommentar zum Doppel-Plus-Fund) | `mobil-reisen-test.mjs` |

   `eingabe-fuzz-test.mjs` legt keine eigenen Konten an (loggt sich, wo
   nötig, mit dem bestehenden Moderationskonto aus `FW_TEST_MOD_EMAIL` ein)
   — kein Präfix, keine `x-forwarded-for`-Frage. `upload-angriff-test.mjs`
   und `final-sicherheit-test.mjs` existierten zum Zeitpunkt dieses Standes
   noch nicht — beim Fertigstellen dort ein noch nicht vergebenes Kürzel
   wählen (falls Kontenanlage nötig ist) und diese Tabelle ergänzen.

3. **Kein gemeinsamer Zähler.** Keine Suite liest oder setzt einen globalen
   Zustand (Datei, Tabellenzeile), den eine andere Suite ebenfalls
   anfasst — jede räumt ausschliesslich ihre eigenen Zeilen/Organisationen
   auf (Präfix- oder ID-genau).

Ergebnis: Kein Timeout-Erhöhen nötig, weil keine Suite durch eine andere ins
Ratenlimit läuft.

## Geklärter Befund: «verlorene» Mails der Entwicklungs-Senke

Symptom während P5.10: `mail_outbox` markiert Zeilen als `accepted`, aber die
Datei unter `var/mail/` fehlt. Ursache (2026-09-06 geklärt): Die Outbox ist
eine gemeinsame Datenbanktabelle, und JEDER laufende Anwendungsprozess
betreibt einen Outbox-Worker (`FOR UPDATE SKIP LOCKED`). Während der
Prüfrunden liefen neben dem Dev-Server (:3007) zeitweise Produktions-Builds
(:3008/:3009) mit anderem Arbeitsverzeichnis (`.next/standalone` oder eine
Scratch-Kopie). Diese Prozesse nahmen Outbox-Zeilen an und schrieben die
Datei in IHR `var/mail/` — für die Suiten am Dev-Server unsichtbar. Kein
Fehler im Versand, sondern ein Nebeneffekt mehrerer Instanzen mit
Entwicklungs-Senke.

Abhilfe: `MAIL_DEV_DIR` (absoluter Pfad, `.env.example`) zwingt alle
Prozesse auf denselben Ordner; in CI läuft nur ein Prozess je Job. In
Produktion (`MAIL_PROVIDER=smtp`) darf jede Instanz senden — dort ist das
gewünscht.

## Lokal nachstellen

```sh
cd app
set -a; . ./.env.local; set +a

# Migration + Schema-Zusagen (wie im Migrationstor)
node scripts/migrate.mjs
node scripts/migrate.mjs
node scripts/migrate.mjs --test

# Unit-Tests (mit und ohne DATABASE_URL)
npm test
env -u DATABASE_URL npm test

# Seed, Build, Start (Dev-Server auf :3007 läuft bereits per Projektregel —
# NICHT neu starten; für eine echte Kette lokal einen zweiten Port nehmen
# oder den bestehenden Server wiederverwenden, wie in dieser Aufgabe)
node scripts/migrate.mjs --seed
node scripts/seed-profis.mjs http://localhost:3007

# Eine einzelne Suite, mit Moderationskonto aus var/konten.local.json
FW_TEST_MOD_EMAIL=<mod@…-Adresse aus var/konten.local.json> \
FW_TEST_MOD_PASSWORT=<zugehöriges Passwort> \
  node scripts/anliegen-test.mjs http://localhost:3007

# Katastrophentest, CI-Modus (kein fw-dev-db, kein MinIO) — braucht lokal
# installierte postgresql-client-Werkzeuge
FW_KATASTROPHE_DB_MODUS=direkt FW_KATASTROPHE_SPEICHER=aus \
  node scripts/katastrophen-test.mjs

# Katastrophentest, normaler lokaler Modus (fw-dev-db + MinIO)
S3_ENDPOINT=http://localhost:59000 S3_REGION=us-east-1 \
S3_ACCESS_KEY_ID=fwdev S3_SECRET_ACCESS_KEY=fwdev-nur-lokal-0000 \
S3_FORCE_PATH_STYLE=ja \
S3_BUCKET_PRIVATE=fw-dev-privat S3_BUCKET_PUBLIC=fw-dev-oeffentlich \
  node scripts/katastrophen-test.mjs
```

YAML-Gültigkeit prüfen (ohne zusätzliche Werkzeuge):

```sh
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/app-ci.yml'))"
```

## Verweise

- `db/migrations/0022_db_garantien.sql` — die drei neuen Datenbankgarantien.
- `app/tests/db-garantien.test.ts` — gezielte Tests dafür (skip ohne
  `DATABASE_URL`).
- `docs/PROJECT-ISOLATION-RULE.md` — warum jedes Skript nur `fw-`-Ressourcen
  anfasst (Katastrophentest, `docker exec fw-dev-db`).
- `docs/REGRESSION.md` — Sichtprüfung/Baseline im Detail.
