-- ============================================================
-- FOURWALLS — Entwicklungsbestand (Seed). NUR Entwicklung und Staging.
-- Erzeugt aus dem P1-Referenzdossier «Seehaus Walensee». Alle Personen, Firmen,
-- Adressen und Objekte sind erfunden; die Strasse ist absichtlich keine echte
-- Adresse. Jedes Inserat trägt is_demo = true — die Anwendung liefert solche
-- Inserate in der Produktion nicht aus (migrate.mjs verweigert den Seed dort
-- ohnehin).
-- Wiederholbar: räumt seine eigenen Zeilen zuerst weg.
-- ============================================================
BEGIN;
SET LOCAL app.actor_id = '00000000-0000-0000-0000-00000000dead';
SET LOCAL app.reason = 'seed';

DELETE FROM listing WHERE public_ref LIKE 'FWL-2026-0001%';
DELETE FROM property WHERE public_ref IN ('FWI-DEMO-000001','FWI-DEMO-000002','FWI-DEMO-000003','FWI-DEMO-000004');
DELETE FROM media_asset WHERE storage_key LIKE 'demo/%';
DELETE FROM app_user WHERE id IN ('00000000-0000-0000-0000-00000000dead','a1000000-0000-4000-8000-000000000001');
DELETE FROM organization WHERE slug = 'fourwalls';
DELETE FROM place WHERE key IN ('ort-quarten','ort-zuerich-demo','ort-bern-demo');

-- Merkmale (18, vier Sprachen — aus core.js FEAT_T)
INSERT INTO feature (key, name_de, name_fr, name_it, name_en, sort_order) VALUES
 ('balcony','Balkon','Balcon','Balcone','Balcony',10),('terrace','Terrasse','Terrasse','Terrazza','Terrace',20),
 ('garden','Garten','Jardin','Giardino','Garden',30),('parking','Parkplatz','Place de parc','Posto auto','Parking space',40),
 ('garage','Garage','Garage','Garage','Garage',50),('lift','Lift','Ascenseur','Ascensore','Lift',60),
 ('lakeview','Seeblick','Vue sur le lac','Vista lago','Lake view',70),('mountainview','Bergsicht','Vue sur les montagnes','Vista montagna','Mountain view',80),
 ('fireplace','Cheminée','Cheminée','Camino','Fireplace',90),('parquet','Parkett','Parquet','Parquet','Parquet flooring',100),
 ('floorheating','Bodenheizung','Chauffage au sol','Riscaldamento a pavimento','Underfloor heating',110),('minergie','Minergie','Minergie','Minergie','Minergie',120),
 ('cellar','Keller','Cave','Cantina','Cellar',130),('washtower','Waschturm','Colonne de lavage','Torre di lavaggio','Washer-dryer tower',140),
 ('pool','Pool','Piscine','Piscina','Pool',150),('sauna','Sauna','Sauna','Sauna','Sauna',160),
 ('evcharging','E-Ladestation','Borne de recharge','Colonnina di ricarica','EV charging',170),('concierge','Concierge','Conciergerie','Portineria','Concierge',180)
ON CONFLICT (key) DO NOTHING;

-- Handelnde (Demo): Systemkonto für den Seed, eine Ansprechperson
INSERT INTO app_user (id, email, display_name, platform_role, locale) VALUES
 ('00000000-0000-0000-0000-00000000dead', 'seed@fourwalls.example', 'Seed', 'admin', 'de'),
 ('a1000000-0000-4000-8000-000000000001', 'lena.furrer@fourwalls.example', 'Lena Furrer', 'staff', 'de');

INSERT INTO organization (id, slug, kind, legal_name, display_name, phone, email, verified_at, verified_by) VALUES
 ('b1000000-0000-4000-8000-000000000001', 'fourwalls', 'fourwalls', 'Fourwalls AG (Demo)', 'Fourwalls AG', '+41 44 555 01 01', 'hallo@fourwalls.example', now(), '00000000-0000-0000-0000-00000000dead');
INSERT INTO org_membership (organization_id, user_id, role, public_title) VALUES
 ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'owner', 'Leitung Verkauf Zürich');

-- Orte
INSERT INTO place (id, key, kind, canton, name_de, name_fr, name_it, name_en, postal_codes, centroid) VALUES
 ('c1000000-0000-4000-8000-000000000001', 'ort-quarten', 'municipality', 'SG', 'Quarten', 'Quarten', 'Quarten', 'Quarten', '{8883}', ST_SetSRID(ST_MakePoint(9.2088, 47.1147), 4326)::geography),
 ('c1000000-0000-4000-8000-000000000002', 'ort-zuerich-demo', 'municipality', 'ZH', 'Zürich', 'Zurich', 'Zurigo', 'Zurich', '{8001,8032}', ST_SetSRID(ST_MakePoint(8.5417, 47.3769), 4326)::geography),
 ('c1000000-0000-4000-8000-000000000003', 'ort-bern-demo', 'municipality', 'BE', 'Bern', 'Berne', 'Berna', 'Bern', '{3011}', ST_SetSRID(ST_MakePoint(7.4474, 46.9480), 4326)::geography);

-- ---------- Das Flaggschiff: Seehaus Walensee ----------
-- Strasse bewusst fiktiv. geom_exact liegt am Südufer; geom_public entsteht per Trigger.
INSERT INTO property (id, public_ref, kind, street, house_number, postal_code, city, canton, place_id,
  geom_exact, geo_precision, geo_radius_m, rooms, living_area_m2, usable_area_m2, plot_area_m2, volume_m3,
  bedrooms, bathrooms, floors_total, built_year, ceiling_height_m) VALUES
 ('d1000000-0000-4000-8000-000000000001', 'FWI-DEMO-000001', 'house', 'Seehausweg (fiktiv)', '1', '8883', 'Quarten', 'SG',
  'c1000000-0000-4000-8000-000000000001', ST_SetSRID(ST_MakePoint(9.2151, 47.1132), 4326)::geography, 'approximate', 450,
  5.5, 289, 331, 1120, 1240, 4, 3, 2, 2019, 2.60);
INSERT INTO property_feature (property_id, feature_key)
 SELECT 'd1000000-0000-4000-8000-000000000001', k FROM unnest(ARRAY['lakeview','mountainview','fireplace','parquet','floorheating','minergie','garage','terrace','garden','evcharging']) k;

INSERT INTO listing (id, public_ref, property_id, transaction, publisher_kind, published_by_org_id, represented_by_org_id, contact_user_id,
  title, description, content_locale, price_chf, price_on_request, available_immediately, slug, is_demo) VALUES
 ('e1000000-0000-4000-8000-000000000001', 'FWL-2026-000142', 'd1000000-0000-4000-8000-000000000001', 'sale', 'fourwalls',
  'b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
  'Seehaus Walensee', 'Ein stilles Haus über dem Walensee: zwei auskragende Geschosse, raumhohes Glas gegen Süden, Sichtbeton, Eiche und ein Garten, der direkt in den Abend übergeht.', 'de',
  548000000, false, false, 'seehaus-walensee', true);
INSERT INTO listing_slug (slug, listing_id, is_current) VALUES ('seehaus-walensee', 'e1000000-0000-4000-8000-000000000001', true);
-- Ein alter Slug, der weiterleiten muss (Test für die Slug-Historie)
INSERT INTO listing_slug (slug, listing_id, is_current) VALUES ('villa-am-walensee', 'e1000000-0000-4000-8000-000000000001', false);

INSERT INTO listing_content (listing_id, locale, title, tagline, sections) VALUES
 ('e1000000-0000-4000-8000-000000000001','de','Seehaus Walensee','Beton, Glas und ein See, der die Wände färbt.','{"story": {"titel": "Ein Haus, das dem Licht folgt", "absaetze": ["Das Seehaus wurde 2019 von einem Zürcher Architekturbüro als privater Rückzugsort über dem Walensee realisiert. Zwei auskragende Geschosse aus Sichtbeton schieben sich über den Hang, raumhohes Glas öffnet den Wohnbereich nach Süden zum Wasser. Die Bauherrschaft legte Wert auf reduzierte Materialität: Beton, Eiche und Naturstein, ohne zusätzliche Dekoration. Entstanden ist ein Haus, das sich der Landschaft unterordnet, statt sie zu dominieren.", "Der Grundriss folgt der Tagesroutine der Bewohner: Küche und Essbereich liegen im Osten und fangen die Morgensonne, der Wohnraum mit freistehendem Cheminéeofen orientiert sich zum See, das Hauptschlafzimmer mit Ankleide besetzt das gesamte südliche Ende des Obergeschosses. Drei weitere Zimmer und zwei Bäder ergänzen das Raumprogramm. Ein Arbeitszimmer im Erdgeschoss lässt sich bei Bedarf als Gästezimmer nutzen.", "Die Umgebung bleibt bewusst zurückhaltend: Wiese, acht Obstbäume, ein öffentlicher Badeplatz drei Gehminuten entfernt. Technisch ist das Haus auf Langfristigkeit ausgelegt – Erdsonden-Wärmepumpe, 12 kWp Photovoltaik mit Speicher und KNX-Gebäudesteuerung sorgen trotz grosszügiger Verglasung für tiefe Betriebskosten. Seit dem Bezug 2019 wurde das Haus durchgehend gepflegt, nie vermietet und nie umgebaut."]}, "highlights": ["Eigener Seeanstoss mit Bootssteg und Badeplatz", "Unverbaubarer Blick über den Walensee auf die Churfirsten", "Architektur 2019, Minergie-zertifiziert", "Terrasse und Wohnräume nach Süd-West", "Erdsonden-Wärmepumpe mit 12 kWp Photovoltaik und Speicher", "Doppelgarage mit zwei Wallboxen"], "gebaeude": {"bauweise": "Kompaktbau in Sichtbeton und Stahl, zweigeschossig zum See auskragend", "dach": "Flachdach, extensiv begrünt, Attika-Aufbau für Haustechnik", "fenster": "Pfosten-Riegel-Verglasung, 3-fach isolierverglast, Sonnenschutzglas Süd", "zustand": "Neuwertig, durchgehend gepflegt seit Bezug 2019", "ausrichtung": "Hauptfassade Süd-West zum See, Schlafräume Ost", "volumen": 1240}, "ausstattung": {"kueche": "Offene Design-Küche, Fronten Nussbaum, Arbeitsplatte Kalkstein, Gaggenau-Geräte", "baeder": "3 Bäder in Naturstein (Kalkstein/Travertin), bodenebene Duschen, Doppellavabo im Hauptbad", "boeden": "Eichenparkett in den Hauptgeschossen, Feinsteinzeug in Nassräumen, Sichtbeton im Eingang", "geraete": "Gaggenau-Kochfeld und -Ofen, Miele-Geschirrspüler, integrierter Weinklimaschrank", "waschen": "Separater Waschraum mit Miele-Waschturm, Ablufttrockner", "cheminee": "Raumhoher Cheminéeofen im Wohnbereich, verkleidet mit Speckstein", "lift": "Kein Personenlift (kompakter zweigeschossiger Baukörper)", "smarthome": "KNX-Gebäudesteuerung für Licht, Storen und Heizung, App-Zugriff", "stauraum": "Eingebaute Schrankwände in der Ankleide, Kellerabteil, separater Technikraum"}, "energie": {"heizung": "Wärmepumpe mit Erdsonde, Fussbodenheizung in allen Geschossen", "energietraeger": "Erdwärme, ergänzt durch Photovoltaik-Eigenverbrauch", "verteilung": "Bodenheizung, raumweise geregelt über KNX", "photovoltaik": "12 kWp auf dem Flachdach, Batteriespeicher 10 kWh", "geak": "A", "geakKlasse": "A (sehr tiefer Bedarf)", "minergie": true}, "aussen": {"balkon": "Keine Balkone (Terrassen übernehmen diese Funktion)", "terrasse": "68 m² gedeckte Seeterrasse plus 40 m² Sonnendeck", "garten": "1''120 m² Umschwung, Wiese, acht Obstbäume, Badeplatz 3 Gehminuten entfernt", "pool": "Kein eigener Pool (öffentlicher Seezugang fussläufig)", "aussicht": "Freie Sicht auf Walensee und Churfirsten", "privatsphaere": "Keine direkte Einsicht von Nachbargrundstücken, Bepflanzung als natürlicher Sichtschutz"}, "parkieren": {"garage": "Doppelgarage direkt im Haus integriert", "tiefgarage": "Keine (ebenerdige Garage genügt der Hanglage)", "aussenplaetze": "1 Besucherparkplatz vor dem Haus", "ladestation": "2× Wallbox 11 kW in der Garage"}, "medien": {"video": {"titel": "Objektfilm", "dauer": "1:40 Min.", "hinweis": "Rundgang durch Haus, Terrasse und Ufergrundstück"}, "tour360": {"titel": "360°-Rundgang", "raeume": 8, "hinweis": "Acht Standpunkte: Eingang, Wohnen, Küche, Terrasse, zwei Schlafzimmer, Bad, Untergeschoss"}, "modell3d": {"titel": "3D-Modell", "hinweis": "Volumenmodell mit Geschosswechsel — vorhanden, weil das Objekt digital vermessen wurde"}, "sonne": {"ausrichtung": "Süd-West", "hauptraeume": "Wohnen, Küche und Terrasse nach Süd-West", "sonnenstunden": "Terrasse besonnt bis in den Abend (Sommer), Wintersonne ab dem späten Vormittag", "grundlage": "Aus Ausrichtung und Hanglage abgeleitet — keine vermessene Verschattungsstudie"}}, "grundrisse": [{"geschoss": "Erdgeschoss", "datei": "plan-eg.svg", "flaeche": 123, "raeume": [{"name": "Eingang", "m2": 8}, {"name": "Garderobe", "m2": 6}, {"name": "Küche", "m2": 24}, {"name": "Wohnen/Essen", "m2": 58}, {"name": "Gäste-WC", "m2": 4}, {"name": "Büro", "m2": 14}]}, {"geschoss": "Obergeschoss", "datei": "plan-og.svg", "flaeche": 130, "raeume": [{"name": "Hauptschlafzimmer", "m2": 32}, {"name": "Schlafzimmer 2", "m2": 18}, {"name": "Schlafzimmer 3", "m2": 16}, {"name": "Bad 1", "m2": 12}, {"name": "Bad 2", "m2": 9}, {"name": "Ankleide", "m2": 10}, {"name": "Galerie", "m2": 15}]}], "lage": {"beschreibung": "Das Grundstück liegt am Südufer des Walensees zwischen Quarten und Unterterzen, mit eigenem Seeanstoss und 1120 m² ummauertem Umschwung. Die Churfirsten stehen gegenüber, die Hanglage schützt vor Nordwind und öffnet den Blick über die ganze Seelänge. Die Zufahrt erfolgt über eine private Stichstrasse; das nächste Nachbarhaus steht rund 60 Meter entfernt.", "gemeinde": "Quarten", "kanton": "St. Gallen", "plz": "8883", "quartier": "Seeufer Quarten–Unterterzen", "charakter": "Ruhige Streusiedlung am See, wenig Durchgangsverkehr. Im Sommer Badebetrieb am öffentlichen Strandbad 400 m westlich.", "steuerfuss": "Gemeinde Quarten 138 %, Kanton St. Gallen 105 %", "oev": [{"name": "Bus Quarten Dorf – Walenstadt", "distanz": "600 m", "zeit": "4 Min. zu Fuss"}, {"name": "Bahnhof Unterterzen (S-Bahn S4)", "distanz": "3.1 km", "zeit": "6 Min. mit Auto"}, {"name": "Schiffstation Quarten", "distanz": "900 m", "zeit": "11 Min. zu Fuss"}], "schulen": [{"name": "Primarschule Quarten", "distanz": "1.2 km", "zeit": "4 Min."}, {"name": "Oberstufe Mels-Walenstadt", "distanz": "7.4 km", "zeit": "11 Min."}, {"name": "Kantonsschule Sargans", "distanz": "18 km", "zeit": "20 Min."}], "einkauf": [{"name": "Volg Quarten", "distanz": "1.1 km", "zeit": "3 Min."}, {"name": "Coop Walenstadt", "distanz": "6.8 km", "zeit": "9 Min."}, {"name": "Wochenmarkt Walenstadt", "distanz": "6.8 km", "zeit": "9 Min."}], "gesundheit": [{"name": "Hausarztpraxis Walenstadt", "distanz": "6.9 km", "zeit": "9 Min."}, {"name": "Spital Walenstadt", "distanz": "7.2 km", "zeit": "10 Min."}, {"name": "Kantonsspital Chur", "distanz": "46 km", "zeit": "35 Min."}], "freizeit": [{"name": "Strandbad Quarten", "distanz": "400 m", "zeit": "5 Min. zu Fuss"}, {"name": "Segelclub Walenstadt", "distanz": "6.5 km", "zeit": "9 Min."}, {"name": "Skigebiet Flumserberg", "distanz": "12 km", "zeit": "18 Min."}, {"name": "Seilbahn Unterterzen (Churfirsten)", "distanz": "3.2 km", "zeit": "6 Min."}], "verkehr": [{"name": "Autobahnanschluss A3 Murg", "distanz": "4.6 km", "zeit": "6 Min."}, {"name": "Bahnhof Sargans (IC nach Zürich)", "distanz": "22 km", "zeit": "22 Min."}], "fahrzeiten": [{"ziel": "Walenstadt", "zeit": "9 Min."}, {"ziel": "Sargans", "zeit": "22 Min."}, {"ziel": "Chur", "zeit": "35 Min."}, {"ziel": "Zürich HB", "zeit": "1 Std. 5 Min."}, {"ziel": "Flughafen Zürich", "zeit": "1 Std. 10 Min."}, {"ziel": "St. Gallen", "zeit": "55 Min."}]}, "finanzen": {"nebenkosten": "Notariat, Grundbuch und Handänderungssteuer im Kanton St. Gallen: ca. 1.5–2% des Kaufpreises, üblicherweise hälftig zwischen Käufer- und Verkäuferschaft verhandelbar", "preisM2Kontext": "Regionaler Median Seegemeinden Walensee ca. 13''500 CHF/m² – Lage und Architektur begründen den Aufschlag"}, "faq": [{"frage": "Ist der Seezugang privat?", "antwort": "Nein, der öffentliche Badeplatz liegt rund drei Gehminuten entfernt; ein eigener Bootssteg besteht nicht."}, {"frage": "Wie ist die Erschliessung im Winter?", "antwort": "Die Zufahrtsstrasse wird kommunal geräumt, das Grundstück liegt hangseitig ohne Steigung ab der Strasse."}, {"frage": "Gibt es eine Gästewohnung oder ein separates Studio?", "antwort": "Nein, das Raumprogramm ist auf eine Familie ausgelegt; das Arbeitszimmer im Erdgeschoss lässt sich bei Bedarf als Gästezimmer nutzen."}, {"frage": "Sind Anpassungen am Grundriss möglich?", "antwort": "Nichttragende Wände im Obergeschoss können versetzt werden; die Statik wurde entsprechend ausgelegt, Details im Baubeschrieb."}, {"frage": "Wie hoch sind die Nebenkosten pro Jahr?", "antwort": "Betriebskosten inklusive Heizung und PV-Unterhalt liegen erfahrungsgemäss bei rund CHF 8''400 pro Jahr, ohne Gebäudeversicherung."}, {"frage": "Ist ein Verkauf an ausländische Käuferschaft möglich?", "antwort": "Ja, da es sich um einen ständig bewohnten Hauptwohnsitz ohne Lex-Koller-Beschränkung handelt (Prüfung im Einzelfall empfohlen)."}], "naechsteSchritte": ["Besichtigung anfragen", "Frage stellen", "Finanzierung prüfen", "Dossier anfordern"]}'::jsonb),
 ('e1000000-0000-4000-8000-000000000001','fr','Seehaus Walensee','Béton, verre et un lac qui teinte les murs.','{"story": {"titel": "Seehaus Walensee", "absaetze": ["Construite en 2019 par un bureau zurichois comme refuge privé, la maison suit la lumière : cuisine et salle à manger ouvertes à l''est, séjour avec cheminée face au lac, chambre principale avec dressing sur toute l''extrémité sud de l''étage."]}, "highlights": ["Vue lac imprenable", "Architecture 2019, Minergie", "1 120 m² de terrain", "Baignade à 3 min"]}'::jsonb),
 ('e1000000-0000-4000-8000-000000000001','it','Seehaus Walensee','Cemento, vetro e un lago che colora le pareti.','{"story": {"titel": "Seehaus Walensee", "absaetze": ["Costruita nel 2019 da uno studio zurighese come rifugio privato, la casa segue la luce: cucina e pranzo aperti a est, soggiorno con camino verso il lago, camera principale con cabina armadio su tutta l''estremità sud del piano superiore."]}, "highlights": ["Vista lago non edificabile", "Architettura 2019, Minergie", "1''120 m² di terreno", "Riva a 3 minuti"]}'::jsonb),
 ('e1000000-0000-4000-8000-000000000001','en','Seehaus Walensee','Concrete, glass, and a lake that colours the walls.','{"story": {"titel": "Seehaus Walensee", "absaetze": ["Seehaus was built in 2019 by a Zurich practice as a private retreat. The plan follows the light: kitchen and dining open east to the morning sun, the living room with fireplace faces the lake, the main bedroom with dressing room takes the whole southern end of the upper floor."]}, "highlights": ["Unobstructable lake view", "2019 architecture, Minergie", "1,120 m² grounds", "3 min to swimming spot"]}'::jsonb);

-- Medien: Fixtures aus public/media (Grössen aus den echten Dateien)
INSERT INTO media_asset (id, storage_key, mime_type, byte_size, width, exif_stripped, uploaded_by) VALUES ('f1000000-0000-4000-8000-000000000000','demo/lakeside-villa-1-1600.jpg','image/jpeg',60367,1600,true,'00000000-0000-0000-0000-00000000dead');
INSERT INTO media_variant (asset_id, storage_key, width, format, byte_size) VALUES
 ('f1000000-0000-4000-8000-000000000000','demo/lakeside-villa-1-480.jpg',480,'jpeg',12332),
 ('f1000000-0000-4000-8000-000000000000','demo/lakeside-villa-1-480.webp',480,'webp',6142),
 ('f1000000-0000-4000-8000-000000000000','demo/lakeside-villa-1-960.jpg',960,'jpeg',36882),
 ('f1000000-0000-4000-8000-000000000000','demo/lakeside-villa-1-960.webp',960,'webp',16478),
 ('f1000000-0000-4000-8000-000000000000','demo/lakeside-villa-1-1600.jpg',1600,'jpeg',60367),
 ('f1000000-0000-4000-8000-000000000000','demo/lakeside-villa-1-1600.webp',1600,'webp',28442);
INSERT INTO listing_image (listing_id, asset_id, sort_order, category, caption, is_cover) VALUES ('e1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000000',0,'aussen','Südfassade mit auskragendem Obergeschoss über dem See',true);
INSERT INTO media_asset (id, storage_key, mime_type, byte_size, width, exif_stripped, uploaded_by) VALUES ('f1000000-0000-4000-8000-000000000001','demo/fw-see-terrasse-1-1600.jpg','image/jpeg',184449,1600,true,'00000000-0000-0000-0000-00000000dead');
INSERT INTO media_variant (asset_id, storage_key, width, format, byte_size) VALUES
 ('f1000000-0000-4000-8000-000000000001','demo/fw-see-terrasse-1-480.jpg',480,'jpeg',28792),
 ('f1000000-0000-4000-8000-000000000001','demo/fw-see-terrasse-1-480.webp',480,'webp',17254),
 ('f1000000-0000-4000-8000-000000000001','demo/fw-see-terrasse-1-960.jpg',960,'jpeg',88343),
 ('f1000000-0000-4000-8000-000000000001','demo/fw-see-terrasse-1-960.webp',960,'webp',45796),
 ('f1000000-0000-4000-8000-000000000001','demo/fw-see-terrasse-1-1600.jpg',1600,'jpeg',184449),
 ('f1000000-0000-4000-8000-000000000001','demo/fw-see-terrasse-1-1600.webp',1600,'webp',81822);
INSERT INTO listing_image (listing_id, asset_id, sort_order, category, caption, is_cover) VALUES ('e1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001',1,'aussen','Terrasse mit Pergola aus Lärche, Blick über den See',false);
INSERT INTO media_asset (id, storage_key, mime_type, byte_size, width, exif_stripped, uploaded_by) VALUES ('f1000000-0000-4000-8000-000000000002','demo/fw-see-wohnen-2-1600.jpg','image/jpeg',164789,1600,true,'00000000-0000-0000-0000-00000000dead');
INSERT INTO media_variant (asset_id, storage_key, width, format, byte_size) VALUES
 ('f1000000-0000-4000-8000-000000000002','demo/fw-see-wohnen-2-480.jpg',480,'jpeg',22193),
 ('f1000000-0000-4000-8000-000000000002','demo/fw-see-wohnen-2-480.webp',480,'webp',10434),
 ('f1000000-0000-4000-8000-000000000002','demo/fw-see-wohnen-2-960.jpg',960,'jpeg',75721),
 ('f1000000-0000-4000-8000-000000000002','demo/fw-see-wohnen-2-960.webp',960,'webp',32258),
 ('f1000000-0000-4000-8000-000000000002','demo/fw-see-wohnen-2-1600.jpg',1600,'jpeg',164789),
 ('f1000000-0000-4000-8000-000000000002','demo/fw-see-wohnen-2-1600.webp',1600,'webp',61714);
INSERT INTO listing_image (listing_id, asset_id, sort_order, category, caption, is_cover) VALUES ('e1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002',2,'wohnen','Wohnraum mit raumhoher Verglasung nach Süden',false);
INSERT INTO media_asset (id, storage_key, mime_type, byte_size, width, exif_stripped, uploaded_by) VALUES ('f1000000-0000-4000-8000-000000000003','demo/fw-see-wohnen-1-1600.jpg','image/jpeg',151549,1600,true,'00000000-0000-0000-0000-00000000dead');
INSERT INTO media_variant (asset_id, storage_key, width, format, byte_size) VALUES
 ('f1000000-0000-4000-8000-000000000003','demo/fw-see-wohnen-1-480.jpg',480,'jpeg',21729),
 ('f1000000-0000-4000-8000-000000000003','demo/fw-see-wohnen-1-480.webp',480,'webp',9944),
 ('f1000000-0000-4000-8000-000000000003','demo/fw-see-wohnen-1-960.jpg',960,'jpeg',70304),
 ('f1000000-0000-4000-8000-000000000003','demo/fw-see-wohnen-1-960.webp',960,'webp',26644),
 ('f1000000-0000-4000-8000-000000000003','demo/fw-see-wohnen-1-1600.jpg',1600,'jpeg',151549),
 ('f1000000-0000-4000-8000-000000000003','demo/fw-see-wohnen-1-1600.webp',1600,'webp',50654);
INSERT INTO listing_image (listing_id, asset_id, sort_order, category, caption, is_cover) VALUES ('e1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000003',3,'wohnen','Essbereich, Eichenboden, Sichtbetondecke',false);
INSERT INTO media_asset (id, storage_key, mime_type, byte_size, width, exif_stripped, uploaded_by) VALUES ('f1000000-0000-4000-8000-000000000004','demo/fw-see-kueche-1-1600.jpg','image/jpeg',147522,1600,true,'00000000-0000-0000-0000-00000000dead');
INSERT INTO media_variant (asset_id, storage_key, width, format, byte_size) VALUES
 ('f1000000-0000-4000-8000-000000000004','demo/fw-see-kueche-1-480.jpg',480,'jpeg',22116),
 ('f1000000-0000-4000-8000-000000000004','demo/fw-see-kueche-1-480.webp',480,'webp',10042),
 ('f1000000-0000-4000-8000-000000000004','demo/fw-see-kueche-1-960.jpg',960,'jpeg',69939),
 ('f1000000-0000-4000-8000-000000000004','demo/fw-see-kueche-1-960.webp',960,'webp',26840),
 ('f1000000-0000-4000-8000-000000000004','demo/fw-see-kueche-1-1600.jpg',1600,'jpeg',147522),
 ('f1000000-0000-4000-8000-000000000004','demo/fw-see-kueche-1-1600.webp',1600,'webp',50346);
INSERT INTO listing_image (listing_id, asset_id, sort_order, category, caption, is_cover) VALUES ('e1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000004',4,'kueche','Küche mit Kochinsel aus Kalkstein',false);
INSERT INTO media_asset (id, storage_key, mime_type, byte_size, width, exif_stripped, uploaded_by) VALUES ('f1000000-0000-4000-8000-000000000005','demo/fw-see-kueche-2-1600.jpg','image/jpeg',145994,1600,true,'00000000-0000-0000-0000-00000000dead');
INSERT INTO media_variant (asset_id, storage_key, width, format, byte_size) VALUES
 ('f1000000-0000-4000-8000-000000000005','demo/fw-see-kueche-2-480.jpg',480,'jpeg',20680),
 ('f1000000-0000-4000-8000-000000000005','demo/fw-see-kueche-2-480.webp',480,'webp',9174),
 ('f1000000-0000-4000-8000-000000000005','demo/fw-see-kueche-2-960.jpg',960,'jpeg',67016),
 ('f1000000-0000-4000-8000-000000000005','demo/fw-see-kueche-2-960.webp',960,'webp',25190),
 ('f1000000-0000-4000-8000-000000000005','demo/fw-see-kueche-2-1600.jpg',1600,'jpeg',145994),
 ('f1000000-0000-4000-8000-000000000005','demo/fw-see-kueche-2-1600.webp',1600,'webp',48150);
INSERT INTO listing_image (listing_id, asset_id, sort_order, category, caption, is_cover) VALUES ('e1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000005',5,'kueche','Küche, Fronten in Nussbaum, integrierte Geräte',false);
INSERT INTO media_asset (id, storage_key, mime_type, byte_size, width, exif_stripped, uploaded_by) VALUES ('f1000000-0000-4000-8000-000000000006','demo/fw-see-schlafen-1-1600.jpg','image/jpeg',144760,1600,true,'00000000-0000-0000-0000-00000000dead');
INSERT INTO media_variant (asset_id, storage_key, width, format, byte_size) VALUES
 ('f1000000-0000-4000-8000-000000000006','demo/fw-see-schlafen-1-480.jpg',480,'jpeg',20922),
 ('f1000000-0000-4000-8000-000000000006','demo/fw-see-schlafen-1-480.webp',480,'webp',9774),
 ('f1000000-0000-4000-8000-000000000006','demo/fw-see-schlafen-1-960.jpg',960,'jpeg',67173),
 ('f1000000-0000-4000-8000-000000000006','demo/fw-see-schlafen-1-960.webp',960,'webp',27448),
 ('f1000000-0000-4000-8000-000000000006','demo/fw-see-schlafen-1-1600.jpg',1600,'jpeg',144760),
 ('f1000000-0000-4000-8000-000000000006','demo/fw-see-schlafen-1-1600.webp',1600,'webp',51560);
INSERT INTO listing_image (listing_id, asset_id, sort_order, category, caption, is_cover) VALUES ('e1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000006',6,'schlafen','Hauptschlafzimmer mit Balkon nach Osten',false);
INSERT INTO media_asset (id, storage_key, mime_type, byte_size, width, exif_stripped, uploaded_by) VALUES ('f1000000-0000-4000-8000-000000000007','demo/fw-see-schlafen-2-1600.jpg','image/jpeg',150911,1600,true,'00000000-0000-0000-0000-00000000dead');
INSERT INTO media_variant (asset_id, storage_key, width, format, byte_size) VALUES
 ('f1000000-0000-4000-8000-000000000007','demo/fw-see-schlafen-2-480.jpg',480,'jpeg',20714),
 ('f1000000-0000-4000-8000-000000000007','demo/fw-see-schlafen-2-480.webp',480,'webp',9470),
 ('f1000000-0000-4000-8000-000000000007','demo/fw-see-schlafen-2-960.jpg',960,'jpeg',69011),
 ('f1000000-0000-4000-8000-000000000007','demo/fw-see-schlafen-2-960.webp',960,'webp',27834),
 ('f1000000-0000-4000-8000-000000000007','demo/fw-see-schlafen-2-1600.jpg',1600,'jpeg',150911),
 ('f1000000-0000-4000-8000-000000000007','demo/fw-see-schlafen-2-1600.webp',1600,'webp',54038);
INSERT INTO listing_image (listing_id, asset_id, sort_order, category, caption, is_cover) VALUES ('e1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000007',7,'schlafen','Zweites Schlafzimmer am Morgen',false);
INSERT INTO media_asset (id, storage_key, mime_type, byte_size, width, exif_stripped, uploaded_by) VALUES ('f1000000-0000-4000-8000-000000000008','demo/fw-see-bad-1-1600.jpg','image/jpeg',124637,1600,true,'00000000-0000-0000-0000-00000000dead');
INSERT INTO media_variant (asset_id, storage_key, width, format, byte_size) VALUES
 ('f1000000-0000-4000-8000-000000000008','demo/fw-see-bad-1-480.jpg',480,'jpeg',17331),
 ('f1000000-0000-4000-8000-000000000008','demo/fw-see-bad-1-480.webp',480,'webp',6750),
 ('f1000000-0000-4000-8000-000000000008','demo/fw-see-bad-1-960.jpg',960,'jpeg',56746),
 ('f1000000-0000-4000-8000-000000000008','demo/fw-see-bad-1-960.webp',960,'webp',19694),
 ('f1000000-0000-4000-8000-000000000008','demo/fw-see-bad-1-1600.jpg',1600,'jpeg',124637),
 ('f1000000-0000-4000-8000-000000000008','demo/fw-see-bad-1-1600.webp',1600,'webp',39316);
INSERT INTO listing_image (listing_id, asset_id, sort_order, category, caption, is_cover) VALUES ('e1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000008',8,'bad','Hauptbad mit freistehender Wanne und Seeblick',false);
INSERT INTO media_asset (id, storage_key, mime_type, byte_size, width, exif_stripped, uploaded_by) VALUES ('f1000000-0000-4000-8000-000000000009','demo/fw-see-bad-2-1600.jpg','image/jpeg',122274,1600,true,'00000000-0000-0000-0000-00000000dead');
INSERT INTO media_variant (asset_id, storage_key, width, format, byte_size) VALUES
 ('f1000000-0000-4000-8000-000000000009','demo/fw-see-bad-2-480.jpg',480,'jpeg',16875),
 ('f1000000-0000-4000-8000-000000000009','demo/fw-see-bad-2-480.webp',480,'webp',6808),
 ('f1000000-0000-4000-8000-000000000009','demo/fw-see-bad-2-960.jpg',960,'jpeg',56065),
 ('f1000000-0000-4000-8000-000000000009','demo/fw-see-bad-2-960.webp',960,'webp',19980),
 ('f1000000-0000-4000-8000-000000000009','demo/fw-see-bad-2-1600.jpg',1600,'jpeg',122274),
 ('f1000000-0000-4000-8000-000000000009','demo/fw-see-bad-2-1600.webp',1600,'webp',39400);
INSERT INTO listing_image (listing_id, asset_id, sort_order, category, caption, is_cover) VALUES ('e1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000009',9,'bad','Bad in Naturstein, Doppelwaschtisch in Eiche',false);
INSERT INTO media_asset (id, storage_key, mime_type, byte_size, width, exif_stripped, uploaded_by) VALUES ('f1000000-0000-4000-8000-000000000010','demo/fw-see-terrasse-2-1600.jpg','image/jpeg',160800,1600,true,'00000000-0000-0000-0000-00000000dead');
INSERT INTO media_variant (asset_id, storage_key, width, format, byte_size) VALUES
 ('f1000000-0000-4000-8000-000000000010','demo/fw-see-terrasse-2-480.jpg',480,'jpeg',24853),
 ('f1000000-0000-4000-8000-000000000010','demo/fw-see-terrasse-2-480.webp',480,'webp',13730),
 ('f1000000-0000-4000-8000-000000000010','demo/fw-see-terrasse-2-960.jpg',960,'jpeg',76559),
 ('f1000000-0000-4000-8000-000000000010','demo/fw-see-terrasse-2-960.webp',960,'webp',36990),
 ('f1000000-0000-4000-8000-000000000010','demo/fw-see-terrasse-2-1600.jpg',1600,'jpeg',160800),
 ('f1000000-0000-4000-8000-000000000010','demo/fw-see-terrasse-2-1600.webp',1600,'webp',68178);
INSERT INTO listing_image (listing_id, asset_id, sort_order, category, caption, is_cover) VALUES ('e1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000010',10,'aussen','Sonnendeck am Nachmittag',false);
INSERT INTO media_asset (id, storage_key, mime_type, byte_size, width, exif_stripped, uploaded_by) VALUES ('f1000000-0000-4000-8000-000000000011','demo/lakeside-villa-2-1600.jpg','image/jpeg',56488,1600,true,'00000000-0000-0000-0000-00000000dead');
INSERT INTO media_variant (asset_id, storage_key, width, format, byte_size) VALUES
 ('f1000000-0000-4000-8000-000000000011','demo/lakeside-villa-2-480.jpg',480,'jpeg',11900),
 ('f1000000-0000-4000-8000-000000000011','demo/lakeside-villa-2-480.webp',480,'webp',6420),
 ('f1000000-0000-4000-8000-000000000011','demo/lakeside-villa-2-960.jpg',960,'jpeg',35256),
 ('f1000000-0000-4000-8000-000000000011','demo/lakeside-villa-2-960.webp',960,'webp',16778),
 ('f1000000-0000-4000-8000-000000000011','demo/lakeside-villa-2-1600.jpg',1600,'jpeg',56488),
 ('f1000000-0000-4000-8000-000000000011','demo/lakeside-villa-2-1600.webp',1600,'webp',28168);
INSERT INTO listing_image (listing_id, asset_id, sort_order, category, caption, is_cover) VALUES ('e1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000011',11,'aussen','Haus und Spiegelung in der Abendstimmung',false);
INSERT INTO media_asset (id, storage_key, mime_type, byte_size, width, exif_stripped, uploaded_by) VALUES ('f1000000-0000-4000-8000-000000000012','demo/aerial-lake-1-1600.jpg','image/jpeg',41695,1600,true,'00000000-0000-0000-0000-00000000dead');
INSERT INTO media_variant (asset_id, storage_key, width, format, byte_size) VALUES
 ('f1000000-0000-4000-8000-000000000012','demo/aerial-lake-1-480.jpg',480,'jpeg',9426),
 ('f1000000-0000-4000-8000-000000000012','demo/aerial-lake-1-480.webp',480,'webp',4608),
 ('f1000000-0000-4000-8000-000000000012','demo/aerial-lake-1-960.jpg',960,'jpeg',26237),
 ('f1000000-0000-4000-8000-000000000012','demo/aerial-lake-1-960.webp',960,'webp',11690),
 ('f1000000-0000-4000-8000-000000000012','demo/aerial-lake-1-1600.jpg',1600,'jpeg',41695),
 ('f1000000-0000-4000-8000-000000000012','demo/aerial-lake-1-1600.webp',1600,'webp',19348);
INSERT INTO listing_image (listing_id, asset_id, sort_order, category, caption, is_cover) VALUES ('e1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000012',12,'lage','Luftaufnahme: Lage am Walensee mit den Churfirsten',false);
INSERT INTO floorplan (listing_id, level_label, area_m2, sort_order, access) VALUES ('e1000000-0000-4000-8000-000000000001','Erdgeschoss',123,0,'public');
INSERT INTO floorplan (listing_id, level_label, area_m2, sort_order, access) VALUES ('e1000000-0000-4000-8000-000000000001','Obergeschoss',130,1,'public');
INSERT INTO listing_document (listing_id, name, doc_type, pages, sort_order, access) VALUES ('e1000000-0000-4000-8000-000000000001','Verkaufsdokumentation','pdf',24,0,'public');
INSERT INTO listing_document (listing_id, name, doc_type, pages, sort_order, access) VALUES ('e1000000-0000-4000-8000-000000000001','Grundrisse EG und OG','pdf',2,1,'public');
INSERT INTO listing_document (listing_id, name, doc_type, pages, sort_order, access) VALUES ('e1000000-0000-4000-8000-000000000001','Situationsplan mit Umschwung','pdf',1,2,'public');
INSERT INTO listing_document (listing_id, name, doc_type, pages, sort_order, access) VALUES ('e1000000-0000-4000-8000-000000000001','GEAK-Ausweis','pdf',4,3,'authenticated');
INSERT INTO listing_document (listing_id, name, doc_type, pages, sort_order, access) VALUES ('e1000000-0000-4000-8000-000000000001','Baubeschrieb und Materialisierung','pdf',12,4,'authenticated');
INSERT INTO listing_document (listing_id, name, doc_type, pages, sort_order, access) VALUES ('e1000000-0000-4000-8000-000000000001','Grundbuchauszug','pdf',3,5,'on_request');
INSERT INTO listing_document (listing_id, name, doc_type, pages, sort_order, access) VALUES ('e1000000-0000-4000-8000-000000000001','Gebäudeversicherungsausweis','pdf',2,6,'on_request');
INSERT INTO listing_document (listing_id, name, doc_type, pages, sort_order, access) VALUES ('e1000000-0000-4000-8000-000000000001','Unterhalts- und Serviceverträge','pdf',9,7,'after_viewing');
INSERT INTO listing_document (listing_id, name, doc_type, pages, sort_order, access) VALUES ('e1000000-0000-4000-8000-000000000001','Kaufvertragsentwurf des Notariats','pdf',14,8,'internal');

UPDATE listing SET status='submitted'  WHERE id='e1000000-0000-4000-8000-000000000001';
UPDATE listing SET status='in_review'  WHERE id='e1000000-0000-4000-8000-000000000001';
UPDATE listing SET status='approved'   WHERE id='e1000000-0000-4000-8000-000000000001';
UPDATE listing SET status='published', published_at='2026-08-20T09:00:00Z' WHERE id='e1000000-0000-4000-8000-000000000001';
UPDATE listing SET is_indexable=true   WHERE id='e1000000-0000-4000-8000-000000000001';

-- ---------- Kleine Testinserate: Suche, Privatsphäre, Status ----------
-- Zürich, exakte Lage freigegeben (exact → geom_public = geom_exact)
INSERT INTO property (id, public_ref, kind, postal_code, city, canton, place_id, geom_exact, geo_precision, geo_radius_m, rooms, living_area_m2, built_year) VALUES
 ('d1000000-0000-4000-8000-000000000002','FWI-DEMO-000002','apartment','8032','Zürich','ZH','c1000000-0000-4000-8000-000000000002', ST_SetSRID(ST_MakePoint(8.5600, 47.3660),4326)::geography,'exact',0, 3.5, 96, 1911);
INSERT INTO listing (id, public_ref, property_id, transaction, publisher_kind, published_by_org_id, title, content_locale, price_chf, slug, is_demo) VALUES
 ('e1000000-0000-4000-8000-000000000002','FWL-2026-000143','d1000000-0000-4000-8000-000000000002','sale','fourwalls','b1000000-0000-4000-8000-000000000001','Altbau in der Enge (Demo)','de',169000000,'altbau-enge-demo',true);
INSERT INTO listing_slug (slug, listing_id) VALUES ('altbau-enge-demo','e1000000-0000-4000-8000-000000000002');
UPDATE listing SET status='submitted' WHERE id='e1000000-0000-4000-8000-000000000002';
UPDATE listing SET status='in_review' WHERE id='e1000000-0000-4000-8000-000000000002';
UPDATE listing SET status='approved'  WHERE id='e1000000-0000-4000-8000-000000000002';
UPDATE listing SET status='published' WHERE id='e1000000-0000-4000-8000-000000000002';

-- Bern, Miete, Gemeindeebene (municipality, 2 km)
INSERT INTO property (id, public_ref, kind, postal_code, city, canton, place_id, geom_exact, geo_precision, geo_radius_m, rooms, living_area_m2, built_year) VALUES
 ('d1000000-0000-4000-8000-000000000003','FWI-DEMO-000003','apartment','3011','Bern','BE','c1000000-0000-4000-8000-000000000003', ST_SetSRID(ST_MakePoint(7.4420, 46.9510),4326)::geography,'municipality',2000, 2.5, 60, 1965);
INSERT INTO listing (id, public_ref, property_id, transaction, publisher_kind, published_by_org_id, title, content_locale, rent_net_chf, rent_extra_chf, slug, is_demo) VALUES
 ('e1000000-0000-4000-8000-000000000003','FWL-2026-000144','d1000000-0000-4000-8000-000000000003','rent','fourwalls','b1000000-0000-4000-8000-000000000001','2.5-Zimmer-Wohnung (Demo)','de',185000,22000,'wohnung-bern-demo',true);
INSERT INTO listing_slug (slug, listing_id) VALUES ('wohnung-bern-demo','e1000000-0000-4000-8000-000000000003');
UPDATE listing SET status='submitted' WHERE id='e1000000-0000-4000-8000-000000000003';
UPDATE listing SET status='in_review' WHERE id='e1000000-0000-4000-8000-000000000003';
UPDATE listing SET status='approved'  WHERE id='e1000000-0000-4000-8000-000000000003';
UPDATE listing SET status='published' WHERE id='e1000000-0000-4000-8000-000000000003';

-- Ein ENTWURF: darf öffentlich nie erreichbar sein (Negativtest)
INSERT INTO property (id, public_ref, kind, postal_code, city, canton, place_id, geom_exact, geo_precision, geo_radius_m, rooms, living_area_m2) VALUES
 ('d1000000-0000-4000-8000-000000000004','FWI-DEMO-000004','house','8883','Quarten','SG','c1000000-0000-4000-8000-000000000001', ST_SetSRID(ST_MakePoint(9.2200, 47.1150),4326)::geography,'approximate',450, 4.5, 140);
INSERT INTO listing (id, public_ref, property_id, transaction, publisher_kind, published_by_org_id, title, content_locale, price_chf, slug, is_demo) VALUES
 ('e1000000-0000-4000-8000-000000000004','FWL-2026-000145','d1000000-0000-4000-8000-000000000004','sale','fourwalls','b1000000-0000-4000-8000-000000000001','Entwurf, nicht veröffentlicht (Demo)','de',99000000,'entwurf-unsichtbar',true);
INSERT INTO listing_slug (slug, listing_id) VALUES ('entwurf-unsichtbar','e1000000-0000-4000-8000-000000000004');

COMMIT;
