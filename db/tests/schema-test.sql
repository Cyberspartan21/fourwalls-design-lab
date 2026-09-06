-- ============================================================
-- FOURWALLS — Prüfung der Datenbankzusagen
--
-- Ein Schema, das nur fehlerfrei einspielt, hat nichts bewiesen. Geprüft wird,
-- ob die Bedingungen wirklich greifen: ob die exakte Koordinate wirklich nicht
-- öffentlich wird, ob ein Entwurf wirklich nicht direkt veröffentlicht werden
-- kann, ob ein Inserat ohne Preis wirklich nicht publiziert werden kann.
--
-- Jeder Test schlägt laut fehl (ASSERT), statt still durchzulaufen.
-- Aufruf: psql -f schema-test.sql
-- ============================================================

\set ON_ERROR_STOP on
BEGIN;

-- ---------- Vorbereitung ----------
INSERT INTO app_user (id, email, display_name, platform_role)
VALUES ('11111111-1111-1111-1111-111111111111', 'test@example.ch', 'Testperson', 'user');

INSERT INTO app_user (id, email, display_name, platform_role)
VALUES ('22222222-2222-2222-2222-222222222222', 'mod@example.ch', 'Moderation', 'moderator');

-- Für die Zuweisungsgarantie (0022): eine Organisation, ein aktives Mitglied,
-- eine Person, die dazu nicht gehört.
INSERT INTO app_user (id, email, display_name, platform_role)
VALUES ('77777777-7777-7777-7777-777777777777', 'team@example.ch', 'Team-Mitglied', 'user');
INSERT INTO app_user (id, email, display_name, platform_role)
VALUES ('88888888-8888-8888-8888-888888888888', 'fremd@example.ch', 'Fremde Person', 'user');
INSERT INTO organization (id, slug, kind, legal_name, display_name)
VALUES ('99999999-9999-9999-9999-999999999999', 'test-buero-zuerich', 'agency', 'Test Büro AG', 'Test Büro');
INSERT INTO org_membership (organization_id, user_id, role, is_active)
VALUES ('99999999-9999-9999-9999-999999999999', '77777777-7777-7777-7777-777777777777', 'agent', true);

INSERT INTO place (id, key, kind, canton, name_de, name_fr, centroid)
VALUES ('33333333-3333-3333-3333-333333333333', 'test-ort-zuerich', 'municipality', 'ZH', 'Zürich', 'Zurich',
        ST_SetSRID(ST_MakePoint(8.5417, 47.3769), 4326)::geography);

-- Liegenschaft mit exakter Koordinate mitten in Zürich
INSERT INTO property (id, kind, postal_code, city, canton, place_id, living_area_m2, rooms,
                      geom_exact, geo_precision, geo_radius_m)
VALUES ('44444444-4444-4444-4444-444444444444', 'apartment', '8001', 'Zürich', 'ZH',
        '33333333-3333-3333-3333-333333333333', 120, 3.5,
        ST_SetSRID(ST_MakePoint(8.54371, 47.37655), 4326)::geography, 'approximate', 450);

DO $$
DECLARE
  d numeric;
  ok boolean;
  v_status listing_status;
  n integer;
BEGIN

  -- ===== 1. Geo-Privatsphäre: die öffentliche Koordinate ist versetzt =====
  SELECT ST_Distance(geom_exact, geom_public) INTO d
    FROM property WHERE id = '44444444-4444-4444-4444-444444444444';
  ASSERT d > 20, format('Öffentliche Koordinate zu nah an der exakten: %s m', round(d));
  RAISE NOTICE '✓ 1  geom_public ist % m von geom_exact entfernt', round(d);

  -- ===== 2. Die öffentliche Koordinate ist stabil, nicht pro Aufruf zufällig =====
  -- Zufall liesse sich über mehrere Abrufe herausmitteln.
  ASSERT (SELECT compute_public_geom(ST_SetSRID(ST_MakePoint(8.54371, 47.37655), 4326)::geography, 'approximate')
              = compute_public_geom(ST_SetSRID(ST_MakePoint(8.54371, 47.37655), 4326)::geography, 'approximate')),
         'compute_public_geom liefert unterschiedliche Ergebnisse für dieselbe Eingabe';
  RAISE NOTICE '✓ 2  Öffentliche Koordinate ist reproduzierbar (kein Zufall pro Abruf)';

  -- ===== 3. Stufe «exakt» heisst wirklich exakt =====
  ASSERT (SELECT compute_public_geom(ST_SetSRID(ST_MakePoint(8.5, 47.3), 4326)::geography, 'exact')
              = ST_SetSRID(ST_MakePoint(8.5, 47.3), 4326)::geography),
         'Stufe exact darf die Koordinate nicht verändern';
  RAISE NOTICE '✓ 3  Stufe «exakt» liefert die unveränderte Koordinate';

  -- ===== 4. Radius muss zur Stufe passen =====
  BEGIN
    INSERT INTO property (kind, postal_code, city, canton, geo_precision, geo_radius_m)
    VALUES ('house', '8001', 'Zürich', 'ZH', 'exact', 450);
    ASSERT false, 'Stufe «exakt» mit Radius 450 wurde fälschlich angenommen';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '✓ 4  Unpassender Radius zur Genauigkeitsstufe wird abgelehnt';
  END;

  -- ===== 5. Ein Inserat braucht einen Herausgeber =====
  BEGIN
    INSERT INTO listing (property_id, transaction, publisher_kind)
    VALUES ('44444444-4444-4444-4444-444444444444', 'sale', 'private_person');
    ASSERT false, 'Inserat ohne Herausgeber wurde angenommen';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '✓ 5  Inserat ohne Herausgeber wird abgelehnt';
  END;

  -- ===== Ein gültiger Entwurf =====
  INSERT INTO listing (id, property_id, transaction, publisher_kind, published_by_user_id, title, slug, price_chf)
  VALUES ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444',
          'sale', 'private_person', '11111111-1111-1111-1111-111111111111',
          '3.5-Zi.-Wohnung', 'test-wohnung-zuerich', 1200000);

  -- ===== 6. Ein Entwurf darf nicht direkt veröffentlicht werden =====
  BEGIN
    UPDATE listing SET status = 'published' WHERE id = '55555555-5555-5555-5555-555555555555';
    ASSERT false, 'Sprung von draft direkt auf published wurde zugelassen';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '✓ 6  draft → published wird abgelehnt (Prüfschritt nicht überspringbar)';
  END;

  -- ===== 7. Der vorgesehene Weg funktioniert =====
  UPDATE listing SET status = 'submitted' WHERE id = '55555555-5555-5555-5555-555555555555';
  UPDATE listing SET status = 'in_review' WHERE id = '55555555-5555-5555-5555-555555555555';
  UPDATE listing SET status = 'approved'  WHERE id = '55555555-5555-5555-5555-555555555555';
  UPDATE listing SET status = 'published' WHERE id = '55555555-5555-5555-5555-555555555555';
  SELECT status INTO v_status FROM listing WHERE id = '55555555-5555-5555-5555-555555555555';
  ASSERT v_status = 'published', 'Regulärer Weg bis published schlug fehl';
  RAISE NOTICE '✓ 7  draft → submitted → in_review → approved → published funktioniert';

  -- ===== 8. published_at wird automatisch gesetzt =====
  ASSERT (SELECT published_at IS NOT NULL FROM listing WHERE id = '55555555-5555-5555-5555-555555555555'),
         'published_at wurde beim Veröffentlichen nicht gesetzt';
  RAISE NOTICE '✓ 8  published_at wird beim Veröffentlichen selbst gesetzt';

  -- ===== 9. Jede Statusänderung steht im Prüfpfad =====
  SELECT count(*) INTO n FROM audit_log
   WHERE entity_id = '55555555-5555-5555-5555-555555555555' AND action = 'listing.status_change';
  -- Vier Übergänge (submitted, in_review, approved, published). Das Anlegen des
  -- Entwurfs ist kein Wechsel und wird darum nicht protokolliert.
  ASSERT n = 4, format('Erwartet 4 Einträge im Prüfpfad, gefunden %s', n);
  RAISE NOTICE '✓ 9  Alle 4 Statuswechsel stehen im Prüfpfad';

  -- ===== 10. Archiv ist eine Endstation =====
  UPDATE listing SET status = 'archived' WHERE id = '55555555-5555-5555-5555-555555555555';
  BEGIN
    UPDATE listing SET status = 'published' WHERE id = '55555555-5555-5555-5555-555555555555';
    ASSERT false, 'Ein archiviertes Inserat konnte wiederbelebt werden';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '✓ 10 Archiviert bleibt archiviert';
  END;

  -- ===== 11. Nur Veröffentlichtes darf indexiert werden =====
  BEGIN
    UPDATE listing SET is_indexable = true WHERE id = '55555555-5555-5555-5555-555555555555';
    ASSERT false, 'Ein archiviertes Inserat wurde für Suchmaschinen freigegeben';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '✓ 11 Nicht veröffentlichte Inserate können nicht indexiert werden';
  END;

  -- ===== 12. Die öffentliche Sicht zeigt die exakte Lage nicht =====
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_name = 'listing_public' AND column_name IN ('geom_exact', 'street', 'house_number');
  ASSERT n = 0, format('listing_public enthält %s Spalte(n), die nicht öffentlich sein dürfen', n);
  RAISE NOTICE '✓ 12 listing_public enthält weder geom_exact noch Strasse';

  -- ===== 13. Version zählt hoch (Schutz vor gegenseitigem Überschreiben) =====
  SELECT version INTO n FROM listing WHERE id = '55555555-5555-5555-5555-555555555555';
  ASSERT n > 1, 'Version wurde bei Änderungen nicht erhöht';
  RAISE NOTICE '✓ 13 Version zählt bei Änderungen hoch (jetzt %)', n;

  -- ===== 14. Merkliste: dasselbe Objekt nicht zweimal =====
  INSERT INTO favorite (listing_id, user_id)
  VALUES ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111');
  BEGIN
    INSERT INTO favorite (listing_id, user_id)
    VALUES ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111');
    ASSERT false, 'Dasselbe Objekt konnte zweimal gemerkt werden';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE '✓ 14 Dasselbe Objekt lässt sich nicht doppelt merken';
  END;

  -- ===== 15. Gespeicherte Suche verlangt eine echte Anfrage, keinen Text =====
  BEGIN
    INSERT INTO saved_search (user_id, query, label)
    VALUES ('11111111-1111-1111-1111-111111111111', '"Zürich + 10 km"'::jsonb, 'Zürich');
    ASSERT false, 'Gespeicherte Suche ohne Anfrageobjekt wurde angenommen';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE '✓ 15 Gespeicherte Suche verlangt ein Anfrageobjekt, keinen Anzeigetext';
  END;

  -- ===== 16. Umkreissuche findet über die öffentliche Koordinate =====
  -- Eigenes Inserat: das erste ist archiviert und bleibt es (Test 10).
  INSERT INTO listing (id, property_id, transaction, publisher_kind, published_by_user_id, title, slug, price_chf)
  VALUES ('66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444',
          'sale', 'private_person', '11111111-1111-1111-1111-111111111111',
          'Zweites Testinserat', 'test-zweitobjekt-zuerich', 990000);
  UPDATE listing SET status = 'submitted' WHERE id = '66666666-6666-6666-6666-666666666666';
  UPDATE listing SET status = 'in_review' WHERE id = '66666666-6666-6666-6666-666666666666';
  UPDATE listing SET status = 'approved'  WHERE id = '66666666-6666-6666-6666-666666666666';
  UPDATE listing SET status = 'published' WHERE id = '66666666-6666-6666-6666-666666666666';
  -- Gezählt werden nur die eigenen Testinserate: die Datenbank darf Bestand haben (P5.3-Import).
  SELECT count(*) INTO n FROM search_listings_nearby(
    ST_SetSRID(ST_MakePoint(8.5417, 47.3769), 4326)::geography, 5000, 'sale', 400) s
   WHERE s.listing_id IN ('55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666');
  ASSERT n = 1, format('Umkreissuche fand %s statt 1 eigenes Inserat (archiviertes darf nicht erscheinen)', n);
  RAISE NOTICE '✓ 16 Umkreissuche findet das Inserat über geom_public';

  -- ===== 17. assigned_user_id nur aktives Mitglied der Herausgeber-Org (0022) =====
  UPDATE listing SET published_by_org_id = '99999999-9999-9999-9999-999999999999'
   WHERE id = '66666666-6666-6666-6666-666666666666';
  BEGIN
    UPDATE listing SET assigned_user_id = '88888888-8888-8888-8888-888888888888'
     WHERE id = '66666666-6666-6666-6666-666666666666';
    ASSERT false, 'Zuweisung an eine fremde Person wurde angenommen';
  EXCEPTION WHEN check_violation THEN
    NULL; -- erwartet, weiter zum positiven Fall
  END;
  UPDATE listing SET assigned_user_id = '77777777-7777-7777-7777-777777777777'
   WHERE id = '66666666-6666-6666-6666-666666666666';
  ASSERT (SELECT assigned_user_id FROM listing WHERE id = '66666666-6666-6666-6666-666666666666')
           = '77777777-7777-7777-7777-777777777777',
         'Zuweisung an ein aktives Mitglied wurde fälschlich abgelehnt';
  RAISE NOTICE '✓ 17 assigned_user_id: Nicht-Mitglied wird abgelehnt, aktives Mitglied gelingt';

  -- ===== 18. Anfrage nur zu einem veröffentlichten/reservierten Inserat (0022) =====
  BEGIN
    INSERT INTO inquiry (listing_id, sender_name, sender_email, message, kind, recipient_user_id)
    VALUES ('55555555-5555-5555-5555-555555555555', 'Testperson', 'anfrage@example.ch', 'Test',
            'listing_question', '11111111-1111-1111-1111-111111111111');
    ASSERT false, 'Anfrage an ein archiviertes Inserat wurde angenommen';
  EXCEPTION WHEN check_violation THEN
    NULL; -- erwartet, weiter zum positiven Fall
  END;
  INSERT INTO inquiry (listing_id, sender_name, sender_email, message, kind, recipient_user_id)
  VALUES ('66666666-6666-6666-6666-666666666666', 'Testperson', 'anfrage@example.ch', 'Test',
          'listing_question', '11111111-1111-1111-1111-111111111111');
  INSERT INTO inquiry (listing_id, sender_name, sender_email, message, kind)
  VALUES (NULL, 'Testperson', 'anfrage@example.ch', 'Test', 'general');
  RAISE NOTICE '✓ 18 Anfrage: nicht veröffentlichtes Inserat abgelehnt, veröffentlichtes und listing-loses gelingen';

  -- ===== 19. service_lead.status folgt nur den Übergängen aus UEBERGAENGE (0022) =====
  INSERT INTO service_lead (id, service, contact_name, contact_email)
  VALUES ('11111111-2222-3333-4444-555555555555', 'sell', 'Testperson', 'lead@example.ch');
  BEGIN
    UPDATE service_lead SET status = 'qualified' WHERE id = '11111111-2222-3333-4444-555555555555';
    ASSERT false, 'Sprung von new direkt auf qualified wurde zugelassen';
  EXCEPTION WHEN check_violation THEN
    NULL; -- erwartet, weiter zum regulären Weg
  END;
  UPDATE service_lead SET status = 'contacted' WHERE id = '11111111-2222-3333-4444-555555555555';
  UPDATE service_lead SET status = 'qualified' WHERE id = '11111111-2222-3333-4444-555555555555';
  UPDATE service_lead SET status = 'closed'    WHERE id = '11111111-2222-3333-4444-555555555555';
  BEGIN
    UPDATE service_lead SET status = 'new' WHERE id = '11111111-2222-3333-4444-555555555555';
    ASSERT false, 'Ein geschlossenes Anliegen wurde wiedereröffnet';
  EXCEPTION WHEN check_violation THEN
    NULL; -- erwartet
  END;
  RAISE NOTICE '✓ 19 service_lead.status: kein Sprung new → qualified, closed ist Endstation, regulärer Weg gelingt';

  RAISE NOTICE '';
  RAISE NOTICE '19 von 19 Zusagen geprüft.';
END $$;

ROLLBACK;   -- Die Prüfung hinterlässt nichts.
