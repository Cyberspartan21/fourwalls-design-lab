-- ============================================================
-- FOURWALLS — 0009 Redaktioneller Inhalt eines Inserats, Demo-Kennzeichen
--
-- P5.1 hat das Inserat bewusst schlank gehalten: Preis, Fakten, Status, Lage.
-- Die Objektseite aus P1 zeigt aber mehr — eine Geschichte, Baubeschrieb,
-- Ausstattung, Umgebung, Fragen und Antworten. Das sind redaktionelle Blöcke,
-- die je Inserat und Sprache verfasst werden und deren Aufbau sich mit dem
-- Dossier weiterentwickelt. Dafür passt ein geprüftes JSON-Dokument je Sprache
-- besser als vierzig Spalten, die morgen anders heissen.
--
-- Die Prüfung der Struktur übernimmt die Anwendung (zod), die Datenbank
-- garantiert: gültiges JSON-Objekt, eine Sprache je Inserat, Fremdschlüssel.
--
-- Zweitens: ein ausdrückliches Demo-Kennzeichen. Der Auftrag verlangt, dass
-- fiktiver Bestand in der Produktion nie als echt erscheinen kann. Die
-- Anwendung filtert `is_demo` in der Produktion aus — und die Spalte macht
-- sichtbar, was Fiktion ist, statt es an Namen oder Adressen zu erraten.
-- ============================================================

BEGIN;

CREATE TABLE listing_content (
  listing_id      uuid NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  locale          text NOT NULL CHECK (locale IN ('de','fr','it','en')),
  title           text NOT NULL,
  tagline         text,
  -- Die Abschnitte der Objektseite: story, highlights, gebaeude, ausstattung,
  -- energie, aussen, parkieren, lage, faq, finanzen. Fehlt ein Abschnitt,
  -- fehlt er — die Seite zeigt ihn dann nicht (Grundsatz aus P1).
  sections        jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, locale),
  CONSTRAINT listing_content_sections_objekt CHECK (jsonb_typeof(sections) = 'object')
);

CREATE TRIGGER listing_content_touch BEFORE UPDATE ON listing_content FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE listing ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN listing.is_demo IS
  'Fiktiver Bestand für Entwicklung und Staging. Die Anwendung liefert solche Inserate in der Produktion nicht aus.';

-- Öffentliche Sicht um das Kennzeichen ergänzen, damit die Suche es filtern kann.
CREATE OR REPLACE VIEW listing_public AS
SELECT
  l.id, l.public_ref, l.slug, l.transaction, l.status,
  l.title, l.description, l.content_locale,
  l.price_chf, l.rent_net_chf, l.rent_extra_chf, l.price_on_request,
  l.available_from, l.available_immediately, l.published_at,
  l.publisher_kind,
  l.published_by_org_id, l.represented_by_org_id,
  p.id AS property_id, p.kind AS property_kind,
  p.rooms, p.living_area_m2, p.plot_area_m2, p.floor, p.built_year,
  p.postal_code, p.city, p.canton, p.place_id,
  p.geom_public, p.geo_precision, p.geo_radius_m,
  CASE WHEN l.transaction = 'sale' AND l.price_chf IS NOT NULL AND p.living_area_m2 > 0
       THEN (l.price_chf::numeric / p.living_area_m2) END AS price_per_m2,
  -- Neue Spalten nur am Ende: CREATE OR REPLACE VIEW erlaubt kein Einschieben.
  l.is_demo
FROM listing l
JOIN property p ON p.id = l.property_id
WHERE l.status IN ('published','reserved');

COMMIT;
