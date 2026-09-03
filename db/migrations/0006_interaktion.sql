-- ============================================================
-- FOURWALLS — 0006 Anfragen, Merkliste, Suchabos, Besichtigungen
--
-- Produktentscheid aus P1–P4, der die Migration überleben muss: Suchen, Merken
-- und ein Suchabo anlegen geht ohne Konto. Das Konto bringt Nutzen (mehrere
-- Geräte, Verlauf), es ist keine Schranke.
--
-- Technisch heisst das: Alle diese Tabellen hängen entweder an einem Konto ODER
-- an einer Besucherkennung. Meldet sich eine Person später an, wandert alles
-- mit (merge_anonymous_data).
-- ============================================================

BEGIN;

-- ---------- Anfragen ----------

CREATE TABLE inquiry (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_ref        text UNIQUE NOT NULL DEFAULT next_public_reference('FWA'),
  kind              inquiry_kind NOT NULL,
  status            inquiry_status NOT NULL DEFAULT 'new',

  listing_id        uuid REFERENCES listing(id) ON DELETE SET NULL,
  -- Wer fragt: Konto oder nur Kontaktangaben (Anfrage ohne Konto bleibt möglich)
  sender_user_id    uuid REFERENCES app_user(id),
  sender_name       text NOT NULL,
  sender_email      citext NOT NULL,
  sender_phone      text,

  -- Wer antworten soll. Aufgelöst beim Anlegen, damit die Anfrage auch dann
  -- zustellbar bleibt, wenn das Inserat später archiviert wird.
  recipient_user_id uuid REFERENCES app_user(id),
  recipient_org_id  uuid REFERENCES organization(id),

  message           text NOT NULL,
  wants_alert       boolean NOT NULL DEFAULT false,   -- «Ähnliche Objekte per Suchabo»

  -- Herkunft für die Auswertung und die Spam-Erkennung
  source            text,                             -- 'listing_page', 'sell_form', 'management_form'
  ip_hash           text,                             -- gehasht, nicht die IP selbst
  user_agent_hash   text,

  answered_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT inquiry_hat_empfaenger CHECK (
    kind IN ('valuation','management_quote','general')
    OR recipient_user_id IS NOT NULL OR recipient_org_id IS NOT NULL)
);

CREATE INDEX inquiry_listing    ON inquiry (listing_id, created_at DESC);
CREATE INDEX inquiry_recipient  ON inquiry (recipient_org_id, status) WHERE recipient_org_id IS NOT NULL;
CREATE INDEX inquiry_sender     ON inquiry (sender_user_id, created_at DESC);
CREATE TRIGGER inquiry_touch BEFORE UPDATE ON inquiry FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN inquiry.ip_hash IS
  'Gehashte Herkunft für Ratenbegrenzung und Spam-Erkennung. Die IP selbst wird nicht gespeichert.';

-- ---------- Besichtigungen ----------

CREATE TABLE viewing (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      uuid NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  inquiry_id      uuid REFERENCES inquiry(id) ON DELETE SET NULL,
  visitor_user_id uuid REFERENCES app_user(id),
  visitor_name    text,
  scheduled_for   timestamptz,
  -- Für die Dokumentstufe «nach Besichtigung»: erst wenn das hier steht, wird
  -- freigegeben. Deshalb bestätigt es die anbietende Seite, nicht die besuchende.
  attended_at     timestamptz,
  confirmed_by    uuid REFERENCES app_user(id),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX viewing_listing ON viewing (listing_id, scheduled_for);
CREATE INDEX viewing_visitor ON viewing (visitor_user_id);
CREATE TRIGGER viewing_touch BEFORE UPDATE ON viewing FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- Merkliste ----------

CREATE TABLE favorite (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      uuid NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES app_user(id) ON DELETE CASCADE,
  anonymous_key   text,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT favorite_hat_traeger CHECK (user_id IS NOT NULL OR anonymous_key IS NOT NULL)
);

-- Ein Objekt einmal pro Person, egal ob mit Konto oder ohne.
CREATE UNIQUE INDEX favorite_uniq_user ON favorite (user_id, listing_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX favorite_uniq_anon ON favorite (anonymous_key, listing_id) WHERE anonymous_key IS NOT NULL;

-- ---------- Gespeicherte Suchen ----------
-- Gespeichert wird die Anfrage, nicht ihre Beschriftung. «Zürich + 10 km,
-- max. 2 Mio.» muss sich morgen erneut ausführen lassen — ein Text wie
-- «Zürich + 10 km» kann das nicht.

CREATE TABLE saved_search (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES app_user(id) ON DELETE CASCADE,
  anonymous_key   text,
  name            text,
  -- Die kanonische SearchQuery aus P3, unverändert übernommen.
  query           jsonb NOT NULL,
  -- Menschenlesbare Fassung nur für die Anzeige, nie als Grundlage zum Ausführen.
  label           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT saved_search_hat_traeger CHECK (user_id IS NOT NULL OR anonymous_key IS NOT NULL),
  CONSTRAINT saved_search_query_objekt CHECK (jsonb_typeof(query) = 'object')
);

CREATE INDEX saved_search_user ON saved_search (user_id);
CREATE TRIGGER saved_search_touch BEFORE UPDATE ON saved_search FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- Suchabo: die Zustellung ----------

CREATE TABLE search_alert (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_search_id   uuid NOT NULL REFERENCES saved_search(id) ON DELETE CASCADE,
  email             citext NOT NULL,
  -- Ohne bestätigte Adresse wird nichts verschickt. Verhindert, dass jemand
  -- fremde Adressen einträgt.
  confirmed_at      timestamptz,
  confirm_token     text UNIQUE,
  unsubscribe_token text UNIQUE NOT NULL,
  frequency         alert_frequency NOT NULL DEFAULT 'daily',
  is_paused         boolean NOT NULL DEFAULT false,
  last_run_at       timestamptz,
  last_sent_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX search_alert_faellig ON search_alert (frequency, last_run_at)
  WHERE confirmed_at IS NOT NULL AND NOT is_paused;
CREATE TRIGGER search_alert_touch BEFORE UPDATE ON search_alert FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Was schon verschickt wurde. Ohne das wird dasselbe Objekt jede Nacht erneut
-- als «neu» gemeldet — der schnellste Weg, ein Suchabo abbestellen zu lassen.
CREATE TABLE search_alert_sent (
  alert_id        uuid NOT NULL REFERENCES search_alert(id) ON DELETE CASCADE,
  listing_id      uuid NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alert_id, listing_id)
);

-- ---------- Übernahme beim Anmelden ----------
-- Wer ohne Konto gemerkt und gesucht hat, soll das nicht noch einmal tun müssen.

CREATE OR REPLACE FUNCTION merge_anonymous_data(ziel_user uuid, schluessel text)
RETURNS void AS $$
BEGIN
  -- Merkliste: was schon am Konto hängt, bleibt; der Rest wandert mit.
  UPDATE favorite f SET user_id = ziel_user, anonymous_key = NULL
   WHERE f.anonymous_key = schluessel
     AND NOT EXISTS (SELECT 1 FROM favorite g WHERE g.user_id = ziel_user AND g.listing_id = f.listing_id);
  DELETE FROM favorite WHERE anonymous_key = schluessel;

  UPDATE saved_search SET user_id = ziel_user, anonymous_key = NULL
   WHERE anonymous_key = schluessel;

  UPDATE listing SET published_by_user_id = ziel_user
   WHERE published_by_user_id IS NULL AND status = 'draft'
     AND id IN (SELECT listing_id FROM draft_claim WHERE anonymous_key = schluessel);
END;
$$ LANGUAGE plpgsql;

-- Entwürfe aus dem Assistenten, die ohne Konto begonnen wurden.
CREATE TABLE draft_claim (
  listing_id      uuid PRIMARY KEY REFERENCES listing(id) ON DELETE CASCADE,
  anonymous_key   text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX draft_claim_key ON draft_claim (anonymous_key);

COMMIT;
