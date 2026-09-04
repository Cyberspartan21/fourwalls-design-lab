#!/usr/bin/env bash
set -euo pipefail
# FOURWALLS — Staging-Deploy (P5.5 §71–§72).
#
# Aufruf:  APP_IMAGE=<registry>/fourwalls-app:<tag> ./deploy.sh
#
# Reihenfolge, bewusst so und nicht anders: erst das Abbild ziehen, dann das
# LAUFENDE Abbild für einen möglichen Rollback merken, dann die Migrationen
# fahren — scheitert die Migration, bricht der Deploy VOR dem Neustart ab,
# die alte Version bleibt online. Erst wenn die Migration durch ist, wird
# neu gestartet.
#
# Keine anbieterspezifischen Befehle hier (kein exo …) — das Abbild kommt aus
# einer Registry, deren Adresse Teil von APP_IMAGE ist.

: "${APP_IMAGE:?APP_IMAGE ist Pflicht, z. B. APP_IMAGE=registry.example/fourwalls-app:2026-09-04 ./deploy.sh}"

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_DATEI="/etc/fourwalls/staging.env"
MERKORDNER="/var/lib/fourwalls"
MERKDATEI="$MERKORDNER/previous-image"

if [ ! -f "$ENV_DATEI" ]; then
  echo "Fehlt: $ENV_DATEI — siehe README.md, Abschnitt Ersteinrichtung." >&2
  exit 1
fi

echo "→ Ziehe $APP_IMAGE"
docker pull "$APP_IMAGE"

echo "→ Merke das aktuell laufende Abbild für einen möglichen Rollback"
mkdir -p "$MERKORDNER"
AKTUELLE_ID="$(docker compose -f "$HIER/docker-compose.yml" images -q app 2>/dev/null || true)"
if [ -n "$AKTUELLE_ID" ]; then
  VORHERIGES_TAG="$(docker inspect --format '{{index .RepoTags 0}}' "$AKTUELLE_ID" 2>/dev/null || true)"
  if [ -n "$VORHERIGES_TAG" ] && [ "$VORHERIGES_TAG" != "$APP_IMAGE" ]; then
    echo "$VORHERIGES_TAG" > "$MERKDATEI"
    echo "  vorheriges Abbild gemerkt: $VORHERIGES_TAG"
  fi
else
  echo "  kein laufender Dienst gefunden — nichts zu merken (Ersteinrichtung?)"
fi

echo "→ Migrationen (vor dem Start — scheitert sie, bricht der Deploy hier ab)"
docker run --rm --env-file "$ENV_DATEI" "$APP_IMAGE" node app/scripts/migrate.mjs

echo "→ Anwendung starten"
APP_IMAGE="$APP_IMAGE" docker compose -f "$HIER/docker-compose.yml" up -d

echo "✓ Deploy von $APP_IMAGE abgeschlossen"
