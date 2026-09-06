#!/usr/bin/env bash
set -euo pipefail
# FOURWALLS — Datenbanksicherung (pg_dump, Custom-Format). Siehe db/RESTORE.md.
#
# Aufruf:
#   ./scripts/db-backup.sh <ziel-datei.dump> [DATABASE_URL]
#
# DATABASE_URL: Parameter 2, sonst die Umgebungsvariable DATABASE_URL.
#
# Zwei Wege, je nachdem, was auf dem ausführenden Rechner steht:
#   1. Ist pg_dump lokal installiert (Staging-/Produktionshost, CI-Runner mit
#      Postgres-Client): läuft direkt gegen DATABASE_URL. Kein Docker-Aufruf,
#      kein Anbieterbefehl — das ist der Weg für Cron auf einem echten Host.
#   2. Ist pg_dump NICHT installiert (dieser Entwicklungsrechner) UND zeigt
#      DATABASE_URL auf den lokalen Entwicklungscontainer fw-dev-db
#      (localhost:55433 / 127.0.0.1:55433): fällt auf
#      `docker exec fw-dev-db pg_dump …` zurück. Das ist der EINZIGE
#      Container, den dieser Zweig anfasst (Projekt-Isolation, siehe
#      docs/PROJECT-ISOLATION-RULE.md) — kein generisches Muster, kein
#      anderer Container.
#
# Für den Katastrophentest siehe scripts/katastrophen-test.mjs.

ZIEL="${1:?Aufruf: $0 <ziel-datei.dump> [DATABASE_URL]}"
URL="${2:-${DATABASE_URL:-}}"
if [ -z "$URL" ]; then
  echo "DATABASE_URL fehlt (weder Parameter 2 noch Umgebungsvariable)." >&2
  exit 1
fi

mkdir -p "$(dirname "$ZIEL")"

if command -v pg_dump >/dev/null 2>&1; then
  echo "→ lokales pg_dump gegen die Zieladresse"
  pg_dump "$URL" -Fc -f "$ZIEL"
elif [[ "$URL" == *"localhost:55433"* || "$URL" == *"127.0.0.1:55433"* ]]; then
  echo "→ kein lokales pg_dump gefunden — falle auf 'docker exec fw-dev-db pg_dump' zurück (nur der lokale Entwicklungscontainer)"
  # Datenbankname aus der URL: alles nach dem letzten "/", ohne eine
  # eventuelle Anfrage (?sslmode=...).
  DBNAME="$(echo "$URL" | sed -E 's#.*/([^/?]+).*#\1#')"
  docker exec fw-dev-db pg_dump -U fourwalls -Fc -d "$DBNAME" > "$ZIEL"
else
  echo "Weder lokales pg_dump gefunden noch zeigt DATABASE_URL auf fw-dev-db (localhost:55433) — Sicherung nicht möglich." >&2
  exit 1
fi

echo "✓ Sicherung geschrieben: $ZIEL ($(du -h "$ZIEL" | cut -f1))"
