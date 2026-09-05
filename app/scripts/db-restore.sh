#!/usr/bin/env bash
# FOURWALLS — Restore einer pg_dump-Sicherung (-Fc).
#
# Hintergrund: siehe db/RESTORE.md. Migration 0014_restore_pfad.sql gibt
# normalize_text() einen festen search_path, damit ihr unqualifizierter
# unaccent()-Aufruf auch dann auflöst, wenn pg_restore aus Sicherheitsgründen
# mit leerem search_path arbeitet. Jede Sicherung, die NACH dieser Migration
# erzeugt wurde, trägt die Korrektur schon in der Funktionsdefinition selbst
# — ein einziger, unsektionierter pg_restore-Lauf genügt dann (geprüft,
# P5.6-Nachweis). Der ALTER-FUNCTION-Schritt unten bleibt trotzdem als
# Verteidigungslinie erhalten: eine ÄLTERE Sicherung (vor Migration 0014)
# hat den Fix noch nicht in der Funktion selbst, und dieser Schritt holt ihn
# vor dem entscheidenden post-data-Abschnitt nach. Für eine aktuelle
# Sicherung ist er wirkungslos (Funktion trägt den search_path schon), aber
# nie schädlich.
#
# Aufruf:
#   ./scripts/db-restore.sh /pfad/zur/sicherung.dump "postgresql://user:pass@host:port/db"

set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Aufruf: $0 <dump-datei> <ziel-DATABASE_URL>" >&2
  exit 1
fi

DUMP_FILE="$1"
TARGET_URL="$2"

if [ ! -f "$DUMP_FILE" ]; then
  echo "Sicherungsdatei nicht gefunden: $DUMP_FILE" >&2
  exit 1
fi

echo "== 1/4: pre-data (Erweiterungen, Typen, Tabellen, Funktionen) =="
pg_restore -d "$TARGET_URL" --no-owner --no-privileges \
  --section=pre-data "$DUMP_FILE"

echo "== 2/4: data (Zeilen) =="
pg_restore -d "$TARGET_URL" --no-owner --no-privileges \
  --section=data "$DUMP_FILE"

echo "== 3/4: search_path-Verteidigungslinie fuer normalize_text() (wirkungslos bei aktueller Sicherung, siehe Kommentar oben) =="
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -c \
  "ALTER FUNCTION public.normalize_text(text) SET search_path = public, pg_catalog;"

echo "== 4/4: post-data (Indizes, Constraints, Trigger) =="
pg_restore -d "$TARGET_URL" --no-owner --no-privileges \
  --section=post-data "$DUMP_FILE"

echo "Restore abgeschlossen."
