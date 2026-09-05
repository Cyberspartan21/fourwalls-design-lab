-- ============================================================
-- FOURWALLS — 0016 Suchabo-Mailarten in der Outbox erlauben (P5.6 §22–§26)
--
-- 0013_outbox.sql kannte nur die sechs P5.5-Mailarten. Die Suchabo-Benach-
-- richtigung (Bestätigung + Treffer-Alarm) braucht zwei weitere. Gefunden
-- beim ersten echten Versandversuch (CHECK-Verletzung), nicht vermutet.
-- ============================================================

BEGIN;

ALTER TABLE mail_outbox DROP CONSTRAINT mail_outbox_kind_check;
ALTER TABLE mail_outbox ADD CONSTRAINT mail_outbox_kind_check
  CHECK (kind IN ('verification','password_reset','listing_submitted','changes_requested',
                  'listing_published','inquiry','search_alert_confirm','search_alert_match'));

COMMIT;
