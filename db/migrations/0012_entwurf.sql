-- ============================================================
-- 0012 — Entwurfsdaten des Inserats-Assistenten (P5.4)
--
-- Ein Entwurf ist ab der ersten Sekunde ein echtes `listing` mit
-- status = 'draft', Eigentümerin, Version und Zeitstempeln (§24). Was die
-- Person im Assistenten eingibt, steht bis zum Einreichen in `draft_data`.
--
-- Warum zwei Formen und keine Verdopplung:
--   draft_data  ist die EINGABE — unfertig, in Schritten entstehend, ohne
--               Zwang, die typisierten Spalten zu füllen, die es noch gar
--               nicht geben kann (property.city ist NOT NULL, die Person hat
--               den Ort aber erst in Schritt 3 gewählt).
--   listing/property sind die VERÖFFENTLICHTE FORM — sie entsteht beim
--               Einreichen aus draft_data, geprüft und typisiert.
-- Die Richtung ist immer dieselbe: draft_data → listing/property. Nie zurück.
-- Damit gibt es eine Wahrheit je Lebensphase, keinen zweiten Assistentenstand
-- im Browser (§22).
--
-- Nebenläufigkeit: `listing.version` erhöht der bestehende Trigger bei jeder
-- Änderung. Der Autosave schreibt mit `WHERE version = <gelesen>`; trifft er
-- keine Zeile, hat jemand anders (anderer Tab) inzwischen gespeichert (§26).
-- ============================================================
BEGIN;

ALTER TABLE listing
  ADD COLUMN IF NOT EXISTS draft_data jsonb,
  -- Wer zuletzt eingereicht hat und wann — für die Warteschlange der Moderation.
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

ALTER TABLE listing
  ADD CONSTRAINT listing_draft_data_objekt CHECK (draft_data IS NULL OR jsonb_typeof(draft_data) = 'object');

-- Warteschlange: was liegt zur Prüfung an, älteste zuerst.
CREATE INDEX IF NOT EXISTS listing_warteschlange ON listing (submitted_at)
  WHERE status IN ('submitted', 'in_review');

-- Meine Inserate: alles einer Person, neueste zuerst.
CREATE INDEX IF NOT EXISTS listing_meine ON listing (published_by_user_id, updated_at DESC)
  WHERE published_by_user_id IS NOT NULL;

-- Die Rückmeldung der Moderation an die inserierende Person.
-- `moderation_case.notes` trägt die interne Notiz; hier steht, was die
-- Eigentümerin sieht — getrennt, damit interne Vermerke nicht nach aussen
-- geraten (§45).
ALTER TABLE moderation_case
  ADD COLUMN IF NOT EXISTS message_to_owner text,
  ADD COLUMN IF NOT EXISTS reason moderation_reason;

COMMIT;
