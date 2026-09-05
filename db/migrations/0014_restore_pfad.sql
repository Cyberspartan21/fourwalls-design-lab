-- ============================================================
-- FOURWALLS — 0014 normalize_text() gegen leeren search_path absichern
--
-- Befund aus dem P5.5/P5.6-Restore-Beweis (siehe db/RESTORE.md): `pg_restore`
-- setzt in jeder Sitzung `search_path = ''` (Sicherheitsmassnahme moderner
-- Postgres-Clients). normalize_text() ruft darin unaccent() OHNE
-- Schema-Qualifizierung auf — mit leerem search_path findet Postgres die
-- Funktion nicht, auch wenn `public.unaccent` existiert, und der davon
-- abhängige Index `place_name_trgm` (0003_liegenschaft.sql) schlägt beim
-- Wiederherstellen fehl.
--
-- Der Fix gehört an die Quelle, nicht nur ins Restore-Werkzeug: die Funktion
-- bekommt ihren eigenen, festen search_path. Damit trägt auch ein KÜNFTIGER
-- pg_dump diese Korrektur schon in der Funktionsdefinition, und ein Restore
-- braucht keinen manuellen Zwischenschritt mehr, um sie zu erhalten (siehe
-- db/RESTORE.md, dort bleibt der Schritt als Verteidigungslinie erhalten,
-- ist nach dieser Migration aber nur noch redundant, nicht mehr nötig).
-- ============================================================

BEGIN;

ALTER FUNCTION normalize_text(text) SET search_path = public, pg_catalog;

COMMIT;
