-- ============================================================
-- FOURWALLS — 0020 Demo-Kennzeichen für Organisationen (P5.10 §34/§35)
--
-- listing.is_demo gibt es seit 0009: die Anwendung filtert fiktiven
-- Inseratsbestand aus, wenn Demo-Inhalte nicht gezeigt werden sollen.
-- Dieselbe Frage stellt sich für Organisationen — die drei fiktiven
-- Anbieter aus scripts/seed-profis.mjs (Alpha Immobilien AG, Seewind
-- Verwaltung GmbH, Nordlicht Bauträger AG, alle Slug-Suffix „-demo“)
-- erscheinen sonst auf Anbieterseiten und in der Sitemap, auch wenn das
-- zentrale Demo-Inhalte-Tor (server/env.ts demoSichtbar()) geschlossen ist.
--
-- Kein Index nötig: organization ist eine kleine Tabelle, is_demo wird nie
-- allein als Filterspalte in einem grossen Scan gebraucht.
-- ============================================================

BEGIN;

ALTER TABLE organization ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN organization.is_demo IS
  'Fiktive Organisation (scripts/seed-profis.mjs). Bei DEMO_INHALTE=aus liefert die Anwendung sie nicht aus.';

UPDATE organization SET is_demo = true
 WHERE slug IN ('alpha-immobilien-ag-demo', 'seewind-verwaltung-gmbh-demo', 'nordlicht-bautraeger-ag-demo')
    OR slug LIKE 'demo-%';

COMMIT;
