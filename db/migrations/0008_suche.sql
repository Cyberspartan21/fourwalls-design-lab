-- ============================================================
-- FOURWALLS — 0008 Suche: Sicht und Indizes
--
-- P3 hat gemessen: Rechnen ist nicht die Grenze, die Auslieferung ist es. Die
-- Suche im Browser schaffte 50 000 Objekte in 9–25 ms — nur konnte man 50 000
-- Objekte nie in den Browser laden. Genau diese Arbeit übernimmt jetzt die
-- Datenbank, mit denselben Begriffen wie der Suchvertrag aus P3.
--
-- Kein Elasticsearch. Der Auftrag verlangt ausdrücklich, es erst dann zu
-- erwägen, wenn ein Bedarf nachgewiesen ist. PostGIS und passende Indizes
-- tragen einen Schweizer Marktplatz um Grössenordnungen weiter, als er in den
-- ersten Jahren wird.
-- ============================================================

BEGIN;

-- ---------- Die öffentliche Sicht ----------
-- Eine Sicht, die nur enthält, was öffentlich sein darf. geom_exact und die
-- vollständige Adresse kommen hier nicht vor: Was nicht in der Sicht steht,
-- kann eine Abfrage auch nicht versehentlich ausliefern.

CREATE VIEW listing_public AS
SELECT
  l.id, l.public_ref, l.slug, l.transaction, l.status,
  l.title, l.description, l.content_locale,
  l.price_chf, l.rent_net_chf, l.rent_extra_chf, l.price_on_request,
  l.available_from, l.available_immediately, l.published_at,
  l.publisher_kind,
  l.published_by_org_id, l.represented_by_org_id,
  p.id AS property_id, p.kind AS property_kind,
  p.rooms, p.living_area_m2, p.plot_area_m2, p.floor, p.built_year,
  -- Öffentlich: Ort ja, Strasse nein.
  p.postal_code, p.city, p.canton, p.place_id,
  p.geom_public, p.geo_precision, p.geo_radius_m,
  -- Preis pro m² für Sortierung und Anzeige
  CASE WHEN l.transaction = 'sale' AND l.price_chf IS NOT NULL AND p.living_area_m2 > 0
       THEN (l.price_chf::numeric / p.living_area_m2) END AS price_per_m2
FROM listing l
JOIN property p ON p.id = l.property_id
WHERE l.status IN ('published','reserved');

COMMENT ON VIEW listing_public IS
  'Die einzige Quelle für öffentliche Suchergebnisse. Enthält bewusst weder geom_exact noch Strasse/Hausnummer.';

-- ---------- Indizes ----------
-- Gesetzt nach den Filtern, die die Oberfläche seit P2/P3 wirklich anbietet.

-- Räumlich: Umkreis (ST_DWithin) und Kartenausschnitt (ST_Intersects)
CREATE INDEX listing_geom_gix ON property USING gist (geom_public);

-- Der häufigste Zugriff überhaupt: veröffentlichte Inserate einer
-- Transaktionsart, nach Datum. Teilindex, weil Entwürfe und Archiv die Suche
-- nicht interessieren.
CREATE INDEX listing_aktiv_neu ON listing (transaction, published_at DESC)
  WHERE status IN ('published','reserved');

CREATE INDEX listing_aktiv_preis ON listing (transaction, price_chf)
  WHERE status IN ('published','reserved') AND price_chf IS NOT NULL;

CREATE INDEX listing_aktiv_miete ON listing (transaction, rent_net_chf)
  WHERE status IN ('published','reserved') AND rent_net_chf IS NOT NULL;

CREATE INDEX property_such_felder ON property (kind, rooms, living_area_m2);

-- Ortsbezogene Suche ohne Umkreis («alle in Zürich»)
CREATE INDEX property_ort ON property (place_id, postal_code);

-- Moderationsschlange: was liegt an?
CREATE INDEX listing_wartet ON listing (status, updated_at)
  WHERE status IN ('submitted','in_review','changes_required');

-- ---------- Umkreissuche ----------
-- Die Funktion, die der SearchProvider aus P3 serverseitig aufruft. Die
-- Reihenfolge der geografischen Auslegung ist dieselbe wie im Browser:
-- Ausschnitt schlägt Umkreis, Umkreis schlägt Ort.

CREATE OR REPLACE FUNCTION search_listings_nearby(
  mittelpunkt geography,
  umkreis_m   integer,
  art         transaction_kind DEFAULT NULL,
  max_treffer integer DEFAULT 100
) RETURNS TABLE (listing_id uuid, distanz_m double precision) AS $$
  SELECT lp.id,
         ST_Distance(lp.geom_public, mittelpunkt) AS distanz_m
    FROM listing_public lp
   WHERE ST_DWithin(lp.geom_public, mittelpunkt, umkreis_m)
     AND (art IS NULL OR lp.transaction = art)
   ORDER BY distanz_m
   LIMIT max_treffer;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION search_listings_nearby IS
  'Umkreissuche über geom_public. Die Distanz bezieht sich damit auf die öffentliche, nicht auf die exakte Lage — das ist beabsichtigt und muss in der Anzeige als «ungefähr» erscheinen.';

COMMIT;
