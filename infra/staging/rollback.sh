#!/usr/bin/env bash
set -euo pipefail
# FOURWALLS — Staging-Rollback (P5.5 §71–§72).
#
# Aufruf: ./rollback.sh
#
# Setzt APP_IMAGE auf das zuletzt von deploy.sh gemerkte Abbild und startet
# neu. Die Datenbank bleibt unverändert dabei: Migrationen aus db/migrations
# sind additiv/vorwärtskompatibel (P5.1) — es gibt bewusst KEINE
# Rückwärtsmigration. Ein älteres Abbild läuft gegen ein bereits neueres
# Schema weiter, solange die neueren Migrationen nur hinzugefügt haben.

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MERKDATEI="/var/lib/fourwalls/previous-image"

if [ ! -f "$MERKDATEI" ]; then
  echo "Kein gemerktes vorheriges Abbild unter $MERKDATEI — kein Rollback möglich." >&2
  exit 1
fi

APP_IMAGE="$(cat "$MERKDATEI")"
if [ -z "$APP_IMAGE" ]; then
  echo "Merkdatei $MERKDATEI ist leer." >&2
  exit 1
fi

echo "→ Rollback auf $APP_IMAGE"
docker pull "$APP_IMAGE"
APP_IMAGE="$APP_IMAGE" docker compose -f "$HIER/docker-compose.yml" up -d
echo "✓ Rollback auf $APP_IMAGE abgeschlossen"
