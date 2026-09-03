-- ============================================================
-- FOURWALLS — 0005 Medien, Grundrisse, Dokumente
--
-- Dateien liegen im Objektspeicher, nicht in der Datenbank und nicht im
-- Anwendungsverzeichnis. Hier stehen nur die Verweise und — wichtiger — die
-- Berechtigung.
--
-- P1 hat die Zugangsstufen gestalterisch eingeführt («Nach Anfrage»,
-- «Nach Besichtigung»). Bis P4 war das eine Beschriftung. Ab hier ist es eine
-- Bedingung: Der Browser bekommt für ein geschütztes Dokument gar keine
-- brauchbare Adresse, nicht bloss einen ausgegrauten Knopf.
-- ============================================================

BEGIN;

CREATE TABLE media_asset (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Schlüssel im Objektspeicher, z. B. 'listings/FWL-2026-000142/orig/a1b2.jpg'.
  -- Keine öffentliche URL: die entsteht erst beim Ausliefern, ggf. signiert.
  storage_key     text UNIQUE NOT NULL,
  mime_type       text NOT NULL,
  byte_size       bigint NOT NULL CHECK (byte_size > 0),
  width           integer,
  height          integer,
  -- Prüfsumme des Originals: erkennt Doppelupload und dasselbe Bild in zwei
  -- Inseraten (ein Hinweis auf gestohlene Fotos, siehe Moderation).
  sha256          text,
  -- Wurde EXIF entfernt? Fotos tragen oft GPS-Koordinaten der Aufnahme — das
  -- wäre genau die Adresse, die geom_public gerade schützen soll.
  exif_stripped   boolean NOT NULL DEFAULT false,
  uploaded_by     uuid REFERENCES app_user(id),
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Nur das, was die Verarbeitung erzeugen kann, darf hier landen.
  CONSTRAINT media_erlaubter_typ CHECK (
    mime_type IN ('image/jpeg','image/png','image/webp','image/avif','application/pdf','video/mp4'))
);

COMMENT ON COLUMN media_asset.exif_stripped IS
  'Öffentlich ausgelieferte Ableitungen müssen exif_stripped = true sein. Originale dürfen EXIF behalten, sind dann aber nicht öffentlich.';

-- Abgeleitete Grössen (480/960/1600 …) — was P2 als Dateinamensschema hatte,
-- wird hier zur Beziehung.
CREATE TABLE media_variant (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        uuid NOT NULL REFERENCES media_asset(id) ON DELETE CASCADE,
  storage_key     text UNIQUE NOT NULL,
  width           integer NOT NULL,
  format          text NOT NULL CHECK (format IN ('jpeg','webp','avif')),
  byte_size       bigint,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, width, format)
);

-- Bilder eines Inserats, mit Reihenfolge und Kategorie (Aussen, Wohnen, Küche …)
CREATE TABLE listing_image (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      uuid NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  asset_id        uuid NOT NULL REFERENCES media_asset(id) ON DELETE RESTRICT,
  sort_order      smallint NOT NULL DEFAULT 0,
  category        text CHECK (category IN ('aussen','wohnen','kueche','schlafen','bad','lage','plan')),
  caption         text,
  is_cover        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, asset_id)
);

CREATE INDEX listing_image_by_listing ON listing_image (listing_id, sort_order);
-- Höchstens ein Titelbild pro Inserat.
CREATE UNIQUE INDEX listing_image_ein_titelbild ON listing_image (listing_id) WHERE is_cover;

CREATE TABLE floorplan (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      uuid NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  asset_id        uuid REFERENCES media_asset(id),
  level_label     text NOT NULL,                 -- «Erdgeschoss», «Obergeschoss»
  area_m2         integer,
  sort_order      smallint NOT NULL DEFAULT 0,
  access          document_access NOT NULL DEFAULT 'public',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE listing_document (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id      uuid NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  asset_id        uuid REFERENCES media_asset(id),
  name            text NOT NULL,
  doc_type        text,                          -- 'grundbuch', 'geak', 'baubeschrieb' …
  access          document_access NOT NULL DEFAULT 'on_request',
  pages           smallint,
  sort_order      smallint NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX listing_document_by_listing ON listing_document (listing_id, sort_order);

-- ---------- Freigaben ----------
-- «Nach Anfrage» heisst: jemand hat gefragt und die inserierende Seite hat
-- zugestimmt. Das ist ein Vorgang mit Urheber und Zeitpunkt, kein Häkchen.

CREATE TABLE document_grant (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid NOT NULL REFERENCES listing_document(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  granted_by      uuid REFERENCES app_user(id),
  reason          text,
  expires_at      timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, user_id)
);

CREATE INDEX document_grant_by_user ON document_grant (user_id) WHERE revoked_at IS NULL;

-- Zugriffe auf geschützte Dokumente werden protokolliert. Nicht der Inhalt,
-- nur die Tatsache — für den Nachweis, wer wann was sehen durfte.
CREATE TABLE document_access_log (
  id              bigserial PRIMARY KEY,
  document_id     uuid NOT NULL REFERENCES listing_document(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES app_user(id),
  granted         boolean NOT NULL,
  reason          text,                          -- warum erlaubt oder verweigert
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX document_access_log_doc ON document_access_log (document_id, created_at DESC);

-- Nachträglich: das Profilbild einer Zugehörigkeit zeigt auf media_asset.
ALTER TABLE org_membership
  ADD CONSTRAINT org_membership_photo_fk
  FOREIGN KEY (public_photo_id) REFERENCES media_asset(id);

COMMIT;
