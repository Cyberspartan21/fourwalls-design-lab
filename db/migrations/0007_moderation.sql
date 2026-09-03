-- ============================================================
-- FOURWALLS — 0007 Moderation und Nachvollziehbarkeit
--
-- Kostenlos inserieren heisst: es kommt auch, was nicht kommen soll. Doppel-
-- erfassungen, fremde Fotos, falsche Orte, Preise, die niemand ernst meint.
--
-- P5 löst das nicht automatisch — das wäre eine Illusion. P5 baut den Vorgang:
-- Etwas fällt auf, jemand schaut es an, jemand entscheidet, und die Entscheidung
-- bleibt nachvollziehbar. «Unsichtbare Administratorenmagie» ist ausdrücklich
-- ausgeschlossen: Jede Statusänderung hat eine handelnde Person und einen Grund.
-- ============================================================

BEGIN;

CREATE TYPE moderation_reason AS ENUM (
  'spam', 'fraud_suspected', 'duplicate', 'wrong_location', 'stolen_images',
  'misleading_price', 'prohibited_content', 'incomplete', 'other'
);

CREATE TYPE report_status AS ENUM ('open', 'in_review', 'upheld', 'dismissed');

-- ---------- Prüfvorgang ----------

CREATE TABLE moderation_case (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      uuid NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  assigned_to     uuid REFERENCES app_user(id),
  opened_at       timestamptz NOT NULL DEFAULT now(),
  closed_at       timestamptz,
  outcome         text,
  notes           text
);

CREATE INDEX moderation_case_offen ON moderation_case (listing_id) WHERE closed_at IS NULL;
CREATE INDEX moderation_case_zugeteilt ON moderation_case (assigned_to) WHERE closed_at IS NULL;

-- ---------- Meldungen aus dem Publikum ----------
-- Die Objektseite hat seit P1 den Knopf «Inserat melden». Hier landet er.

CREATE TABLE listing_report (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      uuid NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  reporter_user_id uuid REFERENCES app_user(id),
  reporter_email  citext,
  reason          moderation_reason NOT NULL,
  message         text,
  status          report_status NOT NULL DEFAULT 'open',
  handled_by      uuid REFERENCES app_user(id),
  handled_at      timestamptz,
  ip_hash         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX listing_report_offen ON listing_report (status, created_at) WHERE status IN ('open','in_review');
CREATE INDEX listing_report_listing ON listing_report (listing_id);

-- ---------- Verdachtsmomente aus der Maschine ----------
-- Keine automatische Ablehnung. Nur Hinweise, die eine Person priorisieren.
-- Beispiele: dasselbe Bild (sha256) in zwei Inseraten, Preis weit ausserhalb
-- des Orts-Medians, dieselbe Adresse zweimal aktiv.

CREATE TABLE moderation_signal (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      uuid NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  signal          text NOT NULL,               -- 'duplicate_image', 'price_outlier', 'duplicate_address'
  severity        smallint NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 3),
  detail          jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

CREATE INDEX moderation_signal_offen ON moderation_signal (listing_id) WHERE resolved_at IS NULL;

-- ---------- Prüfpfad ----------
-- Wer hat was wann geändert, von welchem Stand auf welchen, und warum.
-- Bewusst schlank: Es wird festgehalten, DASS etwas geschah, nicht der ganze
-- Inhalt. Ein Prüfpfad, der Dokumente mitprotokolliert, wird selbst zum Risiko.

CREATE TABLE audit_log (
  id              bigserial PRIMARY KEY,
  actor_user_id   uuid REFERENCES app_user(id),
  actor_role      platform_role,
  action          text NOT NULL,               -- 'listing.publish', 'document.grant', 'org.verify'
  entity_type     text NOT NULL,               -- 'listing', 'listing_document', 'organization'
  entity_id       uuid NOT NULL,
  previous_state  text,
  new_state       text,
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_entity ON audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX audit_log_actor  ON audit_log (actor_user_id, created_at DESC);

COMMENT ON TABLE audit_log IS
  'Nur Vorgänge, keine Inhalte. Keine Passwörter, keine Dokumentinhalte, keine vollständigen Nachrichten.';

-- Jede Statusänderung eines Inserats landet automatisch im Prüfpfad — auch
-- dann, wenn jemand sie direkt auf der Datenbank vornimmt. Die handelnde Person
-- setzt die Anwendung vorher über `SET LOCAL app.actor_id` und `app.reason`.
CREATE OR REPLACE FUNCTION listing_status_protokollieren() RETURNS trigger AS $$
DECLARE
  akteur uuid;
  grund  text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    BEGIN akteur := nullif(current_setting('app.actor_id', true), '')::uuid;
    EXCEPTION WHEN others THEN akteur := NULL; END;
    grund := nullif(current_setting('app.reason', true), '');

    INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, previous_state, new_state, reason)
    VALUES (akteur, 'listing.status_change', 'listing', NEW.id, OLD.status::text, NEW.status::text, grund);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER listing_status_audit
  AFTER UPDATE OF status ON listing
  FOR EACH ROW EXECUTE FUNCTION listing_status_protokollieren();

COMMIT;
