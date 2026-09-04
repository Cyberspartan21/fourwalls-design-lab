-- ============================================================
-- 0011 — Authentifizierung (P5.4)
--
-- Better Auth 1.7.2 bekommt seine drei Infrastrukturtabellen (Sitzung, Konto,
-- Bestätigung). Die Identität selbst bleibt, wo sie seit P5.1 steht: in
-- `app_user`. Die Bibliothek wurde darauf abgebildet (server/auth.ts), nicht
-- umgekehrt — sie legt zur Laufzeit nichts an und ändert nichts (§6).
--
-- Zwei Spalten fehlen `app_user` für das Kernschema der Bibliothek:
--   email_verified  boolean  — was die Bibliothek prüft und setzt
--   image_url       text     — Kernfeld `image`, hier ungenutzt, aber verlangt
-- Der fachliche Zeitstempel `email_verified_at` aus P5.1 bleibt die Wahrheit
-- für «seit wann bestätigt»; ein Trigger hält beide zusammen, damit niemand
-- zwei Quellen pflegen muss.
--
-- Die IDs erzeugt die Datenbank (gen_random_uuid()), weil unsere
-- Fremdschlüssel uuid sind; die Bibliothek ist entsprechend eingestellt
-- (advanced.database.generateId: false).
--
-- Aufräumen abgelaufener Sitzungen und Bestätigungen: siehe Index am Ende;
-- ein periodischer Lauf gehört in den Betrieb (P5.5), nicht in die Migration.
-- ============================================================
BEGIN;

-- ---------- app_user: die zwei Spalten des Kernschemas ----------
ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_url text;

-- Bestehende Zeilen mit fachlichem Zeitstempel gelten als bestätigt.
UPDATE app_user SET email_verified = true WHERE email_verified_at IS NOT NULL;

-- Beide Felder bleiben synchron, egal wer schreibt: die Bibliothek setzt das
-- Boolesche, die Fachlogik liest den Zeitstempel.
CREATE OR REPLACE FUNCTION app_user_email_bestaetigt() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.email_verified AND NOT COALESCE(OLD.email_verified, false) AND NEW.email_verified_at IS NULL THEN
    NEW.email_verified_at := now();
  ELSIF NOT NEW.email_verified AND COALESCE(OLD.email_verified, false) THEN
    NEW.email_verified_at := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS app_user_email_bestaetigt_trg ON app_user;
CREATE TRIGGER app_user_email_bestaetigt_trg
  BEFORE UPDATE ON app_user
  FOR EACH ROW EXECUTE FUNCTION app_user_email_bestaetigt();

-- ---------- Sitzungen ----------
-- Eine Zeile je angemeldetem Gerät. Abmelden löscht die Zeile, Passwortwechsel
-- löscht alle Zeilen der Person (revokeSessionsOnPasswordReset) — der Server
-- bleibt die Wahrheit, nicht das Cookie (§8).
CREATE TABLE auth_session (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_session_user ON auth_session (user_id);
CREATE INDEX auth_session_abgelaufen ON auth_session (expires_at);

-- ---------- Konten ----------
-- Bei E-Mail und Passwort genau eine Zeile je Person mit dem scrypt-Hash in
-- `password`. Für spätere Anmeldewege (Passkey, SSO) kämen weitere Zeilen mit
-- anderem provider_id dazu — das Schema trägt das bereits.
CREATE TABLE auth_account (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  account_id                text NOT NULL,
  provider_id               text NOT NULL,
  issuer                    text NOT NULL DEFAULT '',
  password                  text,
  access_token              text,
  refresh_token             text,
  id_token                  text,
  access_token_expires_at   timestamptz,
  refresh_token_expires_at  timestamptz,
  scope                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_account_user ON auth_account (user_id);
CREATE UNIQUE INDEX auth_account_anbieter ON auth_account (provider_id, account_id, issuer);

-- ---------- Bestätigungen ----------
-- Kurzlebige Marken für E-Mail-Bestätigung und Passwort-Zurücksetzung.
-- Die Werte erzeugt und prüft die Bibliothek; wir schreiben keine eigene
-- Kryptografie (§7).
CREATE TABLE auth_verification (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier  text NOT NULL,
  value       text NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_verification_kennung ON auth_verification (identifier);
CREATE INDEX auth_verification_abgelaufen ON auth_verification (expires_at);

COMMIT;
