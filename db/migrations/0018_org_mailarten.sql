-- ============================================================
-- FOURWALLS — 0018 Mailarten für Teams (P5.7 §13)
-- Einladung ins Team und Anfrage an eine Organisation kommen als eigene
-- Mailarten in die Outbox. Die CHECK-Bedingung aus 0013/0016 wird erweitert,
-- nicht ersetzt — die bestehenden Arten bleiben.
-- ============================================================
BEGIN;
ALTER TABLE mail_outbox DROP CONSTRAINT mail_outbox_kind_check;
ALTER TABLE mail_outbox ADD CONSTRAINT mail_outbox_kind_check
  CHECK (kind IN ('verification','password_reset','listing_submitted','changes_requested',
                  'listing_published','inquiry','search_alert_confirm','search_alert_match',
                  'org_invitation','org_member_removed'));
COMMIT;
