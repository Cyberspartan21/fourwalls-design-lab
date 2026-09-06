-- ============================================================
-- FOURWALLS — 0022 Datenbankgarantien (P5.10 §19-Nachtrag, aus H6-Befund)
--
-- Drei Regeln, die bislang nur die Anwendung durchsetzte und die deshalb auch
-- ein Fehler in der Anwendung (oder ein direkter Zugriff auf die Datenbank)
-- verletzen konnte. Wie schon bei listing_status_erlaubt (0004) gilt: was die
-- Anwendung garantiert, muss die Datenbank selbst erzwingen.
--
-- Idempotent: CREATE OR REPLACE FUNCTION und DROP TRIGGER IF EXISTS … CREATE
-- TRIGGER, damit ein erneutes Einspielen (z.B. nach einem abgebrochenen Lauf)
-- nicht scheitert.
-- ============================================================

BEGIN;

-- ---------- (a) assigned_user_id nur aktives Mitglied der Herausgeber-Org ----------
-- listing.assigned_user_id ist operative Verantwortung im Team (0017, §24).
-- Sie darf nur eine Person sein, die zum Zeitpunkt der Zuweisung aktives
-- Mitglied genau der Organisation ist, die das Inserat herausgibt
-- (published_by_org_id). NULL (keine Zuweisung) bleibt erlaubt.

-- Bestandsprüfung vor dem Anlegen der Regel: kein Verletzer im Bestand
-- (geprüft am 2026-09-06 gegen die lokale Entwicklungsdatenbank, 0 Treffer).
-- Die Bereinigung bleibt trotzdem im Skript, weil diese Migration auch gegen
-- Staging/Produktion läuft, deren Bestand hier nicht bekannt ist: eine
-- Zuweisung, die die neue Regel verletzen würde, wird auf NULL gesetzt statt
-- die Migration scheitern zu lassen.
UPDATE listing
   SET assigned_user_id = NULL
 WHERE assigned_user_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM org_membership m
      WHERE m.organization_id = listing.published_by_org_id
        AND m.user_id = listing.assigned_user_id
        AND m.is_active
   );

CREATE OR REPLACE FUNCTION listing_zuweisung_pruefen() RETURNS trigger AS $$
BEGIN
  IF NEW.assigned_user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM org_membership m
       WHERE m.organization_id = NEW.published_by_org_id
         AND m.user_id = NEW.assigned_user_id
         AND m.is_active
    ) THEN
      RAISE EXCEPTION 'assigned_user_id ist kein aktives Mitglied'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS listing_zuweisung_guard ON listing;
CREATE TRIGGER listing_zuweisung_guard
  BEFORE INSERT OR UPDATE OF assigned_user_id, published_by_org_id ON listing
  FOR EACH ROW EXECUTE FUNCTION listing_zuweisung_pruefen();

-- ---------- (b) Anfragen nur zu einem Inserat, das Anfragen tragen kann ----------
-- inquiry.listing_id (0006) ist optional: Anfragen ohne Objektbezug (kind IN
-- ('valuation','management_quote','general'), siehe inquiry_hat_empfaenger)
-- kommen ohne Inserat aus. Ist ein Inserat gesetzt, muss es zum Zeitpunkt der
-- Anfrage veröffentlicht oder reserviert sein — nicht Entwurf, nicht archiviert.

CREATE OR REPLACE FUNCTION inquiry_listing_status_pruefen() RETURNS trigger AS $$
BEGIN
  IF NEW.listing_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM listing l
       WHERE l.id = NEW.listing_id AND l.status IN ('published','reserved')
    ) THEN
      RAISE EXCEPTION 'Anfrage ist nur zu einem veröffentlichten oder reservierten Inserat möglich'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS inquiry_listing_status_guard ON inquiry;
CREATE TRIGGER inquiry_listing_status_guard
  BEFORE INSERT ON inquiry
  FOR EACH ROW EXECUTE FUNCTION inquiry_listing_status_pruefen();

-- ---------- (c) service_lead.status: nur die Übergänge, die der Code kennt ----------
-- Übergänge exakt aus server/anliegen.ts UEBERGAENGE übernommen (nicht
-- angenommen, im Code nachgelesen):
--   new        → contacted | declined | closed
--   contacted  → qualified | closed | declined
--   qualified  → closed | declined
--   closed     → (Endzustand)
--   declined   → (Endzustand)
-- Gebaut nach demselben Muster wie listing_status_erlaubt (0004): eine reine
-- Übergangsfunktion plus ein Trigger, der bei Verstoss ablehnt.

CREATE OR REPLACE FUNCTION service_lead_status_erlaubt(alt service_lead_status, neu service_lead_status)
RETURNS boolean AS $$
BEGIN
  IF alt = neu THEN RETURN true; END IF;
  RETURN CASE alt
    WHEN 'new'       THEN neu IN ('contacted','declined','closed')
    WHEN 'contacted' THEN neu IN ('qualified','closed','declined')
    WHEN 'qualified' THEN neu IN ('closed','declined')
    WHEN 'closed'    THEN false          -- Endstation
    WHEN 'declined'  THEN false          -- Endstation
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION service_lead_status_pruefen() RETURNS trigger AS $$
BEGIN
  IF NOT service_lead_status_erlaubt(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'Unzulässiger Statuswechsel: % → %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS service_lead_status_guard ON service_lead;
CREATE TRIGGER service_lead_status_guard
  BEFORE UPDATE OF status ON service_lead
  FOR EACH ROW EXECUTE FUNCTION service_lead_status_pruefen();

COMMIT;
