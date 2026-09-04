-- ============================================================
-- 0013 — Mail-Outbox (P5.5 §25–§33, §77)
--
-- Eine Veröffentlichung darf NIE scheitern, weil eine Mail scheitert. Darum
-- steht jede Nachricht zuerst hier, in derselben Datenbanktransaktion wie die
-- fachliche Änderung — und erst danach übergibt ein Arbeiter im Serverprozess
-- sie an SMTP. Scheitert der Versand, bleibt die fachliche Zeile unberührt.
--
-- Zustände in `status`:
--   created    — die Anwendung hat die Nachricht angenommen, noch nicht versucht
--   accepted   — SMTP hat die Nachricht angenommen (provider_id gesetzt)
--   failed     — der letzte Versuch ist gescheitert, wird wiederholt
--   abandoned  — nach vier Versuchen aufgegeben, kein weiterer Versuch
--
-- In `last_error` steht NIE ein Passwort und NIE ein Token — nur eine kurze,
-- bereinigte Fehlerklasse und -meldung (siehe lib/log.ts).
-- ============================================================
BEGIN;

CREATE TABLE mail_outbox (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient        text NOT NULL,
  subject          text NOT NULL,
  body_text        text NOT NULL,
  locale           text NOT NULL DEFAULT 'de' CHECK (locale IN ('de','fr','it','en')),
  kind             text NOT NULL CHECK (kind IN ('verification','password_reset','listing_submitted','changes_requested','listing_published','inquiry')),
  ref_type         text,
  ref_id           text,
  status           text NOT NULL DEFAULT 'created' CHECK (status IN ('created','accepted','failed','abandoned')),
  attempts         int NOT NULL DEFAULT 0,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  provider_id      text,
  last_error       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  accepted_at      timestamptz
);

-- Was der Arbeiter abholt: offene Nachrichten, älteste Fälligkeit zuerst.
CREATE INDEX mail_outbox_faellig ON mail_outbox (status, next_attempt_at) WHERE status = 'created';

COMMIT;
