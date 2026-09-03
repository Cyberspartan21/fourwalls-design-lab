-- ============================================================
-- FOURWALLS — 0004 Inserat
--
-- Das Inserat ist die Veröffentlichung einer Liegenschaft zu einem Zweck.
-- Eine Liegenschaft kann über die Jahre mehrere Inserate haben.
--
-- Zwei Rollen, die im Prototyp verschmolzen waren und hier getrennt bleiben:
--
--   published_by_*   — wer das Inserat aufgeschaltet hat
--   represented_by_* — wer die Eigentümerschaft vertritt
--
-- Die Objektseite sagt seit P1 «Fourwalls vertritt die Verkäuferschaft» oder
-- «Fourwalls vertritt dieses Objekt nicht». Diese Ehrlichkeit hängt an genau
-- dieser Unterscheidung — sie muss die Datenbank überleben, nicht nur die
-- Gestaltung.
-- ============================================================

BEGIN;

CREATE TABLE listing (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Öffentliche, zitierbare Nummer. Steht auf der Objektseite als «Referenz»,
  -- ändert sich nie, auch nicht beim Umbenennen.
  public_ref          text UNIQUE NOT NULL DEFAULT next_public_reference('FWL'),

  property_id         uuid NOT NULL REFERENCES property(id) ON DELETE RESTRICT,
  transaction         transaction_kind NOT NULL,
  status              listing_status NOT NULL DEFAULT 'draft',

  -- ----- Wer inseriert -----
  publisher_kind      publisher_kind NOT NULL,
  published_by_user_id uuid REFERENCES app_user(id),
  published_by_org_id  uuid REFERENCES organization(id),
  -- ----- Wer die Eigentümerschaft vertritt (kann leer sein) -----
  represented_by_org_id uuid REFERENCES organization(id),
  -- Sichtbare Ansprechperson, falls abweichend von der einreichenden Person
  contact_user_id     uuid REFERENCES app_user(id),

  -- ----- Inhalt -----
  title               text,
  description         text,
  content_locale      text NOT NULL DEFAULT 'de' CHECK (content_locale IN ('de','fr','it','en')),

  -- ----- Preis. In Rappen, damit nichts gerundet wird, was nicht gerundet gehört. -----
  price_chf           bigint,               -- Kaufpreis
  rent_net_chf        bigint,               -- Nettomiete pro Monat
  rent_extra_chf      bigint,               -- Nebenkosten pro Monat
  deposit_max_chf     bigint,
  price_on_request    boolean NOT NULL DEFAULT false,

  -- ----- Verfügbarkeit -----
  available_from      date,
  available_immediately boolean NOT NULL DEFAULT false,

  -- ----- Veröffentlichung -----
  slug                text,                 -- darf sich ändern; Historie in listing_slug
  published_at        timestamptz,
  expires_at          timestamptz,
  -- Sichtbarkeit für Suchmaschinen. Entwürfe und zurückgezogene Inserate
  -- werden nie indexiert (siehe Anwendungsschicht: noindex + Zugriffsschutz).
  is_indexable        boolean NOT NULL DEFAULT false,

  -- Optimistische Sperre gegen versehentliches Überschreiben aus zwei Fenstern.
  -- Kein gemeinsames Bearbeiten, nur der Schutz davor, Arbeit zu verlieren.
  version             integer NOT NULL DEFAULT 1,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- Ein Inserat gehört einer Person oder einer Organisation. Nicht keinem.
  CONSTRAINT listing_hat_herausgeber CHECK (
    published_by_user_id IS NOT NULL OR published_by_org_id IS NOT NULL),

  -- Verkauf braucht einen Preis oder «auf Anfrage»; Miete eine Nettomiete.
  CONSTRAINT listing_preis_vorhanden CHECK (
    status IN ('draft','submitted','in_review','changes_required','rejected')
    OR price_on_request
    OR (transaction = 'sale' AND price_chf IS NOT NULL AND price_chf > 0)
    OR (transaction = 'rent' AND rent_net_chf IS NOT NULL AND rent_net_chf > 0)),

  -- Was öffentlich steht, braucht Titel, Slug und Zeitpunkt.
  CONSTRAINT listing_veroeffentlicht_vollstaendig CHECK (
    status <> 'published'
    OR (title IS NOT NULL AND slug IS NOT NULL AND published_at IS NOT NULL)),

  -- Nur Veröffentlichtes darf indexiert werden.
  CONSTRAINT listing_index_nur_publiziert CHECK (
    is_indexable = false OR status = 'published')
);

CREATE UNIQUE INDEX listing_slug_uniq ON listing (slug) WHERE slug IS NOT NULL;
CREATE INDEX listing_property        ON listing (property_id);
CREATE INDEX listing_publisher_user  ON listing (published_by_user_id);
CREATE INDEX listing_publisher_org   ON listing (published_by_org_id);
CREATE INDEX listing_status_idx      ON listing (status);
CREATE TRIGGER listing_touch BEFORE UPDATE ON listing FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Version bei jeder inhaltlichen Änderung erhöhen. Die Anwendung schickt beim
-- Speichern die Version mit, die sie geladen hat; stimmt sie nicht mehr, wurde
-- inzwischen woanders gespeichert und die Person wird gefragt.
CREATE OR REPLACE FUNCTION listing_bump_version() RETURNS trigger AS $$
BEGIN
  IF NEW.* IS DISTINCT FROM OLD.* THEN NEW.version := OLD.version + 1; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER listing_version BEFORE UPDATE ON listing FOR EACH ROW EXECUTE FUNCTION listing_bump_version();

-- ---------- Slug-Historie: ein umbenanntes Inserat bleibt auffindbar ----------
CREATE TABLE listing_slug (
  slug            text PRIMARY KEY,
  listing_id      uuid NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  is_current      boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listing_slug_by_listing ON listing_slug (listing_id);

COMMENT ON TABLE listing_slug IS
  'Alte Slugs bleiben stehen und zeigen per 301 auf den aktuellen. Ein umbenanntes Inserat darf keinen toten Link hinterlassen.';

-- ---------- Statusübergänge ----------
-- Der Auftrag verlangt, dass niemand den Veröffentlichungsstand aus dem Browser
-- frei setzen kann. Die Regel steht deshalb in der Datenbank: auch ein Fehler in
-- der Anwendung kann einen Entwurf nicht direkt veröffentlichen.

CREATE OR REPLACE FUNCTION listing_status_erlaubt(alt listing_status, neu listing_status)
RETURNS boolean AS $$
BEGIN
  IF alt = neu THEN RETURN true; END IF;
  RETURN CASE alt
    WHEN 'draft'            THEN neu IN ('submitted','archived')
    WHEN 'submitted'        THEN neu IN ('in_review','changes_required','rejected','draft')
    WHEN 'in_review'        THEN neu IN ('approved','changes_required','rejected')
    WHEN 'changes_required' THEN neu IN ('submitted','draft','archived')
    WHEN 'approved'         THEN neu IN ('published','archived','changes_required')
    WHEN 'published'        THEN neu IN ('paused','reserved','sold','rented','expired','archived')
    WHEN 'paused'           THEN neu IN ('published','archived','expired')
    WHEN 'reserved'         THEN neu IN ('published','sold','rented','archived')
    WHEN 'sold'             THEN neu IN ('archived')
    WHEN 'rented'           THEN neu IN ('archived')
    WHEN 'expired'          THEN neu IN ('published','archived')
    WHEN 'rejected'         THEN neu IN ('draft','archived')
    WHEN 'archived'         THEN false          -- Endstation
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION listing_status_pruefen() RETURNS trigger AS $$
BEGIN
  IF NOT listing_status_erlaubt(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'Unzulässiger Statuswechsel: % → %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = 'published' AND OLD.status <> 'published' THEN
    NEW.published_at := coalesce(NEW.published_at, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listing_status_guard
  BEFORE UPDATE OF status ON listing
  FOR EACH ROW EXECUTE FUNCTION listing_status_pruefen();

COMMIT;
