-- ============================================================
-- FOURWALLS — 0019 Anliegen an FOURWALLS (P5.8 §6–§9, §26–§28, §40, §77)
--
-- Ein Anliegen ist die Bitte einer Eigentümerin an FOURWALLS: verkaufen,
-- vermieten, bewerten, verwalten oder einfach besprechen. Es ist KEINE
-- Objektanfrage (inquiry: Interessierte fragen zu einem Inserat) und KEIN
-- Inserat (listing: die Eigentümerin veröffentlicht selbst). Drei Objekte,
-- drei Tabellen — bewusst getrennt (§42).
--
-- Normalisierte Felder statt eines JSON-Blobs (§6). Nur, was ein Gespräch
-- wirklich vorbereitet (§11, §43). Kein Dokument, kein Upload (§48).
-- Kein Preismodell, keine Bewertung, keine Pipeline (§72–§74).
-- ============================================================

BEGIN;

CREATE TYPE service_kind AS ENUM ('sell', 'let', 'valuation', 'property_management', 'owner_consultation');
-- Nur Zustände, die das System wirklich trägt (§26).
CREATE TYPE service_lead_status AS ENUM ('new', 'contacted', 'qualified', 'closed', 'declined');

CREATE TABLE service_lead (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_ref        text UNIQUE NOT NULL DEFAULT next_public_reference('FWS'),
  service           service_kind NOT NULL,
  status            service_lead_status NOT NULL DEFAULT 'new',

  -- Wer fragt: Konto optional (§8), Kontaktdaten Pflicht
  user_id           uuid REFERENCES app_user(id) ON DELETE SET NULL,
  contact_name      text NOT NULL,
  contact_email     citext NOT NULL,
  contact_phone     text,
  preferred_channel text NOT NULL DEFAULT 'email' CHECK (preferred_channel IN ('email','phone','whatsapp')),
  -- Terminwunsch als Wunsch, nie als Buchung (§40/§41)
  preferred_date    date,
  preferred_window  text CHECK (preferred_window IN ('morning','afternoon','evening')),
  locale            text NOT NULL DEFAULT 'de' CHECK (locale IN ('de','fr','it','en')),

  -- Objektkontext, alles optional (§9): ein Inserat, ein Ort aus dem Index, Fakten
  listing_id        uuid REFERENCES listing(id) ON DELETE SET NULL,
  place_key         text REFERENCES place(key) ON DELETE SET NULL,   -- kanonische Geo-Kennung (§58)
  property_kind     property_kind,
  rooms             numeric(4,1) CHECK (rooms IS NULL OR (rooms >= 0.5 AND rooms <= 30)),
  living_area_m2    integer CHECK (living_area_m2 IS NULL OR living_area_m2 BETWEEN 1 AND 100000),
  plot_area_m2      integer CHECK (plot_area_m2 IS NULL OR plot_area_m2 BETWEEN 1 AND 10000000),
  built_year        integer CHECK (built_year IS NULL OR built_year BETWEEN 1000 AND 2100),
  units             integer CHECK (units IS NULL OR units BETWEEN 1 AND 5000),         -- Verwaltung
  condition         text CHECK (condition IN ('new','good','renovation_needed','unknown')),
  occupancy         text CHECK (occupancy IN ('owner','rented','vacant','unknown')),
  timing            text CHECK (timing IN ('asap','3m','6m','12m','unsure')),
  already_listed    boolean,
  other_broker      boolean,
  -- Gewünschter Umfang bei Vermietung/Verwaltung: kurze, feste Schlüssel
  services_wanted   text[] NOT NULL DEFAULT '{}',
  message           text CHECK (message IS NULL OR length(message) <= 4000),

  -- Herkunft: Seite und Kampagne — keine Klickpfade, keine Fingerabdrücke (§43)
  source_page       text,
  campaign          text,
  ip_hash           text,
  user_agent_hash   text,

  -- Betrieb: Zuständigkeit im FOURWALLS-Team, nie Eigentum (§28)
  assigned_staff_id uuid REFERENCES app_user(id) ON DELETE SET NULL,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  closed_at         timestamptz,

  CONSTRAINT service_lead_units_nur_verwaltung CHECK (units IS NULL OR service IN ('property_management','let','owner_consultation','sell','valuation')),
  CONSTRAINT service_lead_name_form CHECK (length(contact_name) BETWEEN 2 AND 120)
);

CREATE INDEX service_lead_eingang     ON service_lead (status, created_at DESC);
CREATE INDEX service_lead_dienst      ON service_lead (service, status, created_at DESC);
CREATE INDEX service_lead_person      ON service_lead (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX service_lead_zustaendig  ON service_lead (assigned_staff_id, status) WHERE assigned_staff_id IS NOT NULL;
CREATE INDEX service_lead_ort         ON service_lead (place_key) WHERE place_key IS NOT NULL;
CREATE TRIGGER service_lead_touch BEFORE UPDATE ON service_lead FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE service_lead IS
  'Anliegen an FOURWALLS (Verkauf, Vermietung, Bewertung, Verwaltung, Beratung). Aufbewahrungsfrist: Geschäfts-/Rechtsentscheid steht aus (P5.8 §44).';
COMMENT ON COLUMN service_lead.ip_hash IS
  'Gehashte Herkunft für Ratenbegrenzung und Missbrauchserkennung. Die IP selbst wird nicht gespeichert.';

-- Mailarten: interne Meldung an FOURWALLS und Bestätigung an die Person (§22/§23)
ALTER TABLE mail_outbox DROP CONSTRAINT mail_outbox_kind_check;
ALTER TABLE mail_outbox ADD CONSTRAINT mail_outbox_kind_check
  CHECK (kind IN ('verification','password_reset','listing_submitted','changes_requested',
                  'listing_published','inquiry','search_alert_confirm','search_alert_match',
                  'org_invitation','org_member_removed',
                  'service_lead_intern','service_lead_bestaetigung'));

COMMIT;
