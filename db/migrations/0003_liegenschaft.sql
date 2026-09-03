-- ============================================================
-- FOURWALLS — 0003 Liegenschaft und Ort
--
-- Die wichtigste Trennung des ganzen Modells:
--
--   property  = das Ding in der Welt. Eine Wohnung an einer Adresse.
--   listing   = eine Veröffentlichung dieses Dings zu einem Zweck (0004).
--
-- Dasselbe Haus wird 2026 vermietet, 2029 verkauft und 2031 wieder vermietet.
-- Das sind drei Inserate zu einer Liegenschaft. Hängt alles am Inserat, geht
-- beim Archivieren die Geschichte verloren — und man kann nie sagen, ob zwei
-- Inserate dieselbe Wohnung sind (Doppelerfassung, Preisverlauf, Betrugserkennung).
--
-- Der Prototyp kennt diese Trennung noch nicht: dort ist ein Inserat ein
-- flaches Objekt mit allem darin. Diese Migration entflicht das.
-- ============================================================

BEGIN;

-- ---------- Orte: das Verzeichnis aus P3, jetzt in der Datenbank ----------

CREATE TABLE place (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stabile Kennung aus P3 (ort-zuerich, kt-VD, rg-tessin, plz-8001).
  -- Steht in geteilten Links; darf sich nicht ändern.
  key             text UNIQUE NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('municipality','postal_code','canton','region','country')),
  canton          text,
  -- Namen in vier Sprachen. Genf/Genève/Ginevra/Geneva.
  name_de         text NOT NULL,
  name_fr         text,
  name_it         text,
  name_en         text,
  -- Schreibvarianten für die Tippfehlertoleranz («zuerich», «geneve»)
  aliases         text[] NOT NULL DEFAULT '{}',
  postal_codes    text[] NOT NULL DEFAULT '{}',
  centroid        geography(Point, 4326),
  bbox            geography(Polygon, 4326),
  parent_id       uuid REFERENCES place(id),   -- Gemeinde → Kanton → Land
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX place_centroid_gix ON place USING gist (centroid);
CREATE INDEX place_bbox_gix     ON place USING gist (bbox);
CREATE INDEX place_name_trgm    ON place USING gin (normalize_text(name_de) gin_trgm_ops);
CREATE INDEX place_kind         ON place (kind);
CREATE TRIGGER place_touch BEFORE UPDATE ON place FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- Neubauprojekte: Projekt → Gebäude → Einheit ----------
-- Eine Überbauung mit 40 Wohnungen ist nicht 40 zusammenhanglose Häuser.
-- Die Umsetzung darf vorerst dünn bleiben; die Struktur darf sie nicht verbauen.

CREATE TABLE project (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_ref      text UNIQUE NOT NULL DEFAULT next_public_reference('FWP'),
  slug            text UNIQUE NOT NULL,
  name            text NOT NULL,
  developer_org_id uuid REFERENCES organization(id),
  place_id        uuid REFERENCES place(id),
  completion_date date,
  description_de  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER project_touch BEFORE UPDATE ON project FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE building (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid REFERENCES project(id) ON DELETE CASCADE,
  name            text,                        -- «Haus B»
  floors          smallint,
  built_year      smallint,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------- Die Liegenschaft ----------

CREATE TABLE property (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_ref      text UNIQUE NOT NULL DEFAULT next_public_reference('FWI'),

  kind            property_kind NOT NULL,
  building_id     uuid REFERENCES building(id),      -- gesetzt bei Neubauprojekten
  unit_label      text,                              -- «3.4» innerhalb des Gebäudes

  -- ----- Adresse: intern vollständig, öffentlich nur, was freigegeben ist -----
  street          text,
  house_number    text,
  postal_code     text NOT NULL,
  city            text NOT NULL,
  canton          text NOT NULL,
  country         text NOT NULL DEFAULT 'CH',
  place_id        uuid REFERENCES place(id),

  -- ----- Die zwei Geometrien. Der Kern der Standort-Privatsphäre. -----
  -- geom_exact verlässt den Server nie. Auch nicht «nur für die Karte»,
  -- auch nicht «gerundet im Frontend». Wer die Antwort abfängt, hat sonst die
  -- Adresse, egal was gezeichnet wird.
  geom_exact      geography(Point, 4326),
  -- geom_public ist die versetzte/gerasterte Koordinate, die ausgeliefert wird.
  -- Sie wird beim Speichern berechnet, nicht bei jeder Anfrage.
  geom_public     geography(Point, 4326),
  geo_precision   geo_precision NOT NULL DEFAULT 'approximate',
  geo_radius_m    integer NOT NULL DEFAULT 450,

  -- ----- Fakten -----
  rooms           numeric(4,1),
  living_area_m2  integer,
  usable_area_m2  integer,
  plot_area_m2    integer,
  volume_m3       integer,
  bedrooms        smallint,
  bathrooms       smallint,
  floor           smallint,                         -- 0 = Erdgeschoss
  floors_total    smallint,
  built_year      smallint,
  renovated_year  smallint,
  ceiling_height_m numeric(3,2),

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT property_flaechen_positiv CHECK (
    coalesce(living_area_m2, 1) > 0 AND coalesce(plot_area_m2, 1) > 0 AND coalesce(rooms, 1) > 0),
  CONSTRAINT property_baujahr_plausibel CHECK (
    built_year IS NULL OR (built_year BETWEEN 1200 AND extract(year FROM now())::int + 6)),
  CONSTRAINT property_renovation_nach_bau CHECK (
    renovated_year IS NULL OR built_year IS NULL OR renovated_year >= built_year),
  CONSTRAINT property_radius_zur_stufe CHECK (
    (geo_precision = 'exact'         AND geo_radius_m = 0)   OR
    (geo_precision = 'approximate'   AND geo_radius_m BETWEEN 100 AND 900) OR
    (geo_precision = 'municipality'  AND geo_radius_m BETWEEN 1000 AND 5000))
);

CREATE INDEX property_geom_public_gix ON property USING gist (geom_public);
CREATE INDEX property_place           ON property (place_id);
CREATE INDEX property_kind_idx        ON property (kind);
CREATE TRIGGER property_touch BEFORE UPDATE ON property FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- geom_exact ist die einzige Spalte dieser Datenbank, die niemals in eine
-- Antwort an den Browser gehört. Als Erinnerung an jede Person, die später eine
-- Abfrage schreibt — und als Grundlage für eine Spaltenberechtigung, sobald die
-- Anwendung mit einer eingeschränkten Rolle auf die Datenbank zugreift.
COMMENT ON COLUMN property.geom_exact IS
  'INTERN. Darf keine API-Antwort verlassen. Öffentlich ist ausschliesslich geom_public.';

-- Die öffentliche Koordinate aus der exakten ableiten: gerastert, nicht zufällig
-- versetzt. Zufall pro Anfrage liesse sich über mehrere Abrufe herausmitteln und
-- ergäbe am Ende doch die Adresse.
CREATE OR REPLACE FUNCTION compute_public_geom(exact geography, stufe geo_precision)
RETURNS geography AS $$
DECLARE
  raster_deg numeric;
  lon numeric; lat numeric;
BEGIN
  IF exact IS NULL THEN RETURN NULL; END IF;
  IF stufe = 'exact' THEN RETURN exact; END IF;

  -- ~0.005° ≈ 400–550 m in der Schweiz; ~0.02° ≈ 1.6–2.2 km
  raster_deg := CASE stufe WHEN 'approximate' THEN 0.005 ELSE 0.02 END;
  lon := round((ST_X(exact::geometry) / raster_deg)::numeric) * raster_deg;
  lat := round((ST_Y(exact::geometry) / raster_deg)::numeric) * raster_deg;
  RETURN ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Die öffentliche Koordinate wird bei jedem Schreibvorgang neu bestimmt, nie
-- von aussen gesetzt. So kann sie nicht versehentlich auf die exakte Lage
-- gesetzt werden — auch nicht durch einen Importfehler.
CREATE OR REPLACE FUNCTION property_set_public_geom() RETURNS trigger AS $$
BEGIN
  NEW.geom_public := compute_public_geom(NEW.geom_exact, NEW.geo_precision);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER property_public_geom
  BEFORE INSERT OR UPDATE OF geom_exact, geo_precision ON property
  FOR EACH ROW EXECUTE FUNCTION property_set_public_geom();

-- ---------- Merkmale ----------
-- Als eigene Tabelle statt als 40 boolesche Spalten: Merkmale kommen dazu
-- (Ladestation gab es 2015 nicht), und ein Filter über eine Verknüpfung ist
-- billiger als ein Schema-Wechsel.

CREATE TABLE feature (
  key             text PRIMARY KEY,             -- 'balcony', 'lakeview', …
  name_de         text NOT NULL,
  name_fr         text,
  name_it         text,
  name_en         text,
  sort_order      smallint NOT NULL DEFAULT 100
);

CREATE TABLE property_feature (
  property_id     uuid NOT NULL REFERENCES property(id) ON DELETE CASCADE,
  feature_key     text NOT NULL REFERENCES feature(key),
  PRIMARY KEY (property_id, feature_key)
);

CREATE INDEX property_feature_by_key ON property_feature (feature_key);

COMMIT;
