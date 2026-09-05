-- ============================================================
-- FOURWALLS — 0015 Zuletzt angesehen (P5.6 §27–§29)
--
-- Anonym bleibt das im Browser (localStorage, wie die Merkliste vor P5.6) —
-- dafür braucht es keine Tabelle. Angemeldete Personen bekommen eine
-- geräteübergreifende, bewusst knappe Ablage: nur Kennung und Zeitpunkt,
-- keine Verweildauer, keine Klickpfade, kein Gerätefingerabdruck (§28).
--
-- Begrenzung geschieht aktiv, nicht nur durch die Abfrage: jede Ansicht
-- entfernt ältere Zeilen über der Grenze. Wer eine Immobilie erneut ansieht,
-- bekommt keine zweite Zeile — der Zeitpunkt wird aktualisiert (UPSERT).
-- ============================================================

BEGIN;

CREATE TABLE recently_viewed (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  listing_id  uuid NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  viewed_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, listing_id)
);

CREATE INDEX recently_viewed_user ON recently_viewed (user_id, viewed_at DESC);

COMMIT;
