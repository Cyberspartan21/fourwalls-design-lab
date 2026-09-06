-- ============================================================
-- 0021 — Konto löschen: Unterstützung für die Aufräumabfragen (P5.10 §9–§12)
--
-- Diese Migration verändert kein Schema inhaltlich. Die Löschung selbst ist
-- Anwendungslogik (domain/kontoloeschung.ts, server/konto-loeschung.ts) und
-- arbeitet mit den Tabellen, die seit 0002–0019 bestehen — kein neuer Status,
-- keine neue Spalte, kein neuer Zustand war dafür nötig:
--
--   - app_user wird ANONYMISIERT (Tombstone), nie gelöscht — die Zeile bleibt
--     wegen bestehender Fremdschlüssel (audit_log, listing, inquiry, …).
--   - listing wechselt, wo nötig, in den bestehenden Zustand 'archived'
--     (0004: listing_status_erlaubt lässt das aus jedem aktiven Zustand zu).
--   - org_membership/org_invitation werden deaktiviert bzw. widerrufen
--     (bestehende Spalten is_active/revoked_at).
--
-- Zwei Indizes fehlten für die Aufräumabfragen selbst — ohne sie liefe die
-- Löschung einer Person auf einen Sequential Scan über mail_outbox bzw.
-- org_invitation. Beide sind rein lesend hilfreich, ändern kein Verhalten.
-- ============================================================
BEGIN;

-- Ungesendete Post an die (alte) Adresse einer gelöschten Person finden und
-- entfernen (§9: "ungesendete an diese Adresse: LOESCHEN"). Ohne Index liegt
-- `recipient` nirgends indiziert.
CREATE INDEX IF NOT EXISTS mail_outbox_empfaenger ON mail_outbox (recipient);

-- Offene Einladungen an die (alte) Adresse einer gelöschten Person widerrufen
-- (§9). Der bestehende Unique-Index deckt nur (organization_id, email) ab;
-- hier wird über alle Organisationen nach der Adresse gesucht.
CREATE INDEX IF NOT EXISTS org_invitation_email_offen ON org_invitation (email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

COMMIT;
