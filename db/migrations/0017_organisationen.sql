-- ============================================================
-- FOURWALLS — 0017 Professionelle Anbieter (P5.7 §3–§6, §13–§14, §24, §31)
--
-- organization und org_membership (mit org_role owner/admin/agent/viewer)
-- gibt es seit 0002. Was fehlte: Einladungen, das öffentliche Herausgeber-
-- profil, ein ehrlicher Prüfstand, die Zuweisung eines Inserats an eine
-- Person im Team, und eine stabile Fremdkennung für Importe.
--
-- Bewusst NICHT hier: Verifizierung als Prozess (bleibt Geschäftsentscheid),
-- Abrechnung, Feeds, ein Projekt-/Einheiten-Modell (Bauträger-Inserate hängen
-- vorerst wie alle anderen an einer Organisation, §32).
-- ============================================================

BEGIN;

-- ---------- Prüfstand: drei Zustände, kein Häkchen ----------
-- verified_at/verified_by (0002) bleiben als Beleg; der Zustand macht
-- «unverifiziert» sichtbar, statt es aus einem NULL zu erraten.
CREATE TYPE org_verification AS ENUM ('unverified', 'pending_review', 'verified');

ALTER TABLE organization
  ADD COLUMN verification_state org_verification NOT NULL DEFAULT 'unverified',
  -- Öffentliches Profil: verfasster Text (nie automatisch übersetzt, §57)
  ADD COLUMN description       text,
  ADD COLUMN logo_asset_id     uuid REFERENCES media_asset(id) ON DELETE SET NULL,
  ADD COLUMN locale            text NOT NULL DEFAULT 'de' CHECK (locale IN ('de','fr','it','en')),
  -- Absichtlich öffentliche Kontaktwege — getrennt von email/phone (Verwaltung)
  ADD COLUMN public_email      citext,
  ADD COLUMN public_phone      text,
  -- Lebenszyklus: kein Löschen, nur Stilllegen (§40)
  ADD COLUMN archived_at       timestamptz,
  ADD COLUMN created_by        uuid REFERENCES app_user(id);

UPDATE organization SET verification_state = 'verified' WHERE verified_at IS NOT NULL;

ALTER TABLE organization ADD CONSTRAINT organization_verifiziert_hat_zeitpunkt
  CHECK (verification_state <> 'verified' OR verified_at IS NOT NULL);

-- ---------- Einladungen ----------
-- Der Token selbst wird nie gespeichert, nur sein Hash: ein Datenbankleck
-- ergibt keine gültigen Einladungen. Ein Token ist einmal brauchbar, läuft
-- ab und ist nach Annahme oder Widerruf tot (§14).
CREATE TABLE org_invitation (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  email           citext NOT NULL,
  role            org_role NOT NULL DEFAULT 'agent',
  token_hash      text UNIQUE NOT NULL,
  invited_by      uuid REFERENCES app_user(id),
  expires_at      timestamptz NOT NULL,
  accepted_at     timestamptz,
  accepted_by     uuid REFERENCES app_user(id),
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Eine Einladung kann nicht zugleich angenommen und widerrufen sein.
  CONSTRAINT org_invitation_ein_ende CHECK (accepted_at IS NULL OR revoked_at IS NULL),
  -- Besitzer werden nicht eingeladen, sie werden ernannt.
  CONSTRAINT org_invitation_kein_owner CHECK (role <> 'owner')
);

CREATE INDEX org_invitation_offen ON org_invitation (organization_id, created_at DESC)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
-- Je Adresse und Organisation höchstens eine offene Einladung.
CREATE UNIQUE INDEX org_invitation_offen_uniq ON org_invitation (organization_id, email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- ---------- Zuweisung und Fremdkennung am Inserat ----------
ALTER TABLE listing
  -- Operative Verantwortung im Team. Ändert nie, wer Herausgeberin ist (§24).
  ADD COLUMN assigned_user_id uuid REFERENCES app_user(id) ON DELETE SET NULL,
  -- Stabile Kennung aus dem System der Organisation (Import, §31)
  ADD COLUMN external_ref     text;

ALTER TABLE listing ADD CONSTRAINT listing_external_ref_form
  CHECK (external_ref IS NULL OR (length(external_ref) BETWEEN 1 AND 80 AND external_ref !~ '[[:cntrl:]]'));

-- Zweimal derselbe Import erzeugt kein zweites Inserat.
CREATE UNIQUE INDEX listing_org_external_ref ON listing (published_by_org_id, external_ref)
  WHERE published_by_org_id IS NOT NULL AND external_ref IS NOT NULL;

-- Die Übersicht einer Organisation: nach Status und Aktualität, serverseitig
-- geblättert (§21/§49). Teilindex, weil Privatinserate hier nie gesucht werden.
CREATE INDEX listing_org_uebersicht ON listing (published_by_org_id, status, updated_at DESC)
  WHERE published_by_org_id IS NOT NULL;
CREATE INDEX listing_org_zuweisung ON listing (published_by_org_id, assigned_user_id)
  WHERE published_by_org_id IS NOT NULL AND assigned_user_id IS NOT NULL;

-- Anfragen einer Organisation: der Posteingang (§35)
CREATE INDEX inquiry_org_eingang ON inquiry (recipient_org_id, created_at DESC)
  WHERE recipient_org_id IS NOT NULL;

COMMENT ON COLUMN listing.assigned_user_id IS
  'Zuständige Person im Team der herausgebenden Organisation. Muss aktives Mitglied sein (Anwendungsregel); beim Austritt wird sie entfernt (P5.7 §38).';

COMMIT;
