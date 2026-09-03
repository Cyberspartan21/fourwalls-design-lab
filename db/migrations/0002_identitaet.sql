-- ============================================================
-- FOURWALLS — 0002 Identität
-- Personen, Organisationen, Zugehörigkeit, Rollen.
--
-- Zwei Trennungen, die später schwer nachzuholen wären:
--
--  1. Person ≠ Organisation. Eine Maklerin ist eine Person, die für ein Büro
--     handelt. Wird das vermischt, lässt sich später weder ein Mitarbeiterwechsel
--     noch ein Bürowechsel sauber abbilden.
--  2. Plattformrolle ≠ Organisationsrolle. Wer in seiner Firma alles darf, darf
--     deswegen auf der Plattform noch lange nichts moderieren.
--
-- Passwörter stehen NICHT in dieser Datenbank, solange ein gehosteter
-- Authentifizierungsdienst verwendet wird (siehe Architekturentscheid).
-- `auth_subject` ist die Verbindung dorthin.
-- ============================================================

BEGIN;

CREATE TABLE app_user (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Kennung beim Authentifizierungsdienst. Eindeutig, aber optional: ein Konto
  -- kann angelegt werden, bevor sich jemand das erste Mal anmeldet.
  auth_subject    text UNIQUE,
  email           citext,
  email_verified_at timestamptz,
  display_name    text,
  phone           text,
  locale          text NOT NULL DEFAULT 'de' CHECK (locale IN ('de','fr','it','en')),
  platform_role   platform_role NOT NULL DEFAULT 'user',
  -- Wer ohne Konto sucht, merkt und ein Suchabo anlegt, bekommt eine
  -- Besucherkennung. Meldet sich diese Person später an, werden Merkliste,
  -- Suchabos und Entwurf übernommen (siehe 0006).
  anonymous_key   text UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,

  -- Ein Konto braucht entweder eine E-Mail oder eine Besucherkennung.
  CONSTRAINT app_user_identifizierbar CHECK (email IS NOT NULL OR anonymous_key IS NOT NULL)
);

CREATE UNIQUE INDEX app_user_email_uniq ON app_user (email) WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE TRIGGER app_user_touch BEFORE UPDATE ON app_user FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Organisation: Maklerbüro, Bauträger, Verwaltung, Fourwalls selbst.
-- Ausdrücklich kein Mandantensystem: Alle Organisationen sind Anbieterinnen
-- INNERHALB von Fourwalls, keine getrennten Instanzen mit eigenem Auftritt.
CREATE TABLE organization (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_ref      text UNIQUE NOT NULL DEFAULT next_public_reference('FWO'),
  slug            text UNIQUE NOT NULL,
  kind            publisher_kind NOT NULL,
  legal_name      text NOT NULL,
  display_name    text NOT NULL,
  uid_che         text,                        -- Handelsregister, falls vorhanden
  email           citext,
  phone           text,
  website         text,
  street          text,
  postal_code     text,
  city            text,
  -- Prüfung der Identität durch Fourwalls. Trägt das «geprüft»-Merkmal auf der
  -- Objektseite — deshalb mit Zeitpunkt und prüfender Person, nicht als blosses
  -- Häkchen.
  verified_at     timestamptz,
  verified_by     uuid REFERENCES app_user(id),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER organization_touch BEFORE UPDATE ON organization FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Zugehörigkeit einer Person zu einer Organisation, mit Rolle.
-- Mehrfachzugehörigkeit ist erlaubt: Eine Maklerin kann für zwei Büros arbeiten.
CREATE TABLE org_membership (
  organization_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  role            org_role NOT NULL DEFAULT 'agent',
  -- Öffentlich sichtbares Profil dieser Person in diesem Büro
  public_title    text,                        -- «Leitung Verkauf Zürich»
  public_photo_id uuid,                        -- FK wird in 0005 ergänzt
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX org_membership_user ON org_membership (user_id) WHERE is_active;
CREATE TRIGGER org_membership_touch BEFORE UPDATE ON org_membership FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Jede Organisation braucht mindestens eine Person, die sie verwalten darf.
-- Als Bedingung nicht erzwingbar (Reihenfolge beim Anlegen), darum als Prüfung
-- für die Anwendung dokumentiert und in den Tests abgedeckt.
COMMENT ON TABLE org_membership IS
  'Regel für die Anwendung: Eine aktive Organisation muss mindestens eine aktive Zugehörigkeit mit role = owner haben.';

COMMIT;
