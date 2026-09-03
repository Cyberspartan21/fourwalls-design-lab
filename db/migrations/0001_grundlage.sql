-- ============================================================
-- FOURWALLS — 0001 Grundlage
-- Erweiterungen, Aufzählungstypen, gemeinsame Hilfen.
--
-- Grundsatz für alle Migrationen: Was die Datenbank garantieren kann, garantiert
-- die Datenbank. TypeScript-Prüfungen laufen im selben Prozess wie der Fehler,
-- den sie verhindern sollen; eine Fremdschlüsselbedingung nicht.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;          -- Koordinaten, Umkreis, Ausschnitt
CREATE EXTENSION IF NOT EXISTS pgcrypto;         -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;          -- Ortssuche mit Tippfehlertoleranz
CREATE EXTENSION IF NOT EXISTS unaccent;         -- «Zuerich» findet «Zürich»
CREATE EXTENSION IF NOT EXISTS citext;           -- E-Mail ohne Gross-/Kleinschreibungsfallen

-- ---------- Aufzählungen ----------

-- Wer inseriert. Trennung von der Frage, wer die Eigentümerschaft vertritt
-- (siehe 0004: listing.represented_by_org_id).
CREATE TYPE publisher_kind AS ENUM (
  'private_person',      -- Privatperson, inseriert selbst
  'fourwalls',           -- Fourwalls als Mandatsträgerin
  'agency',              -- Maklerbüro
  'developer',           -- Bauträger
  'property_manager',    -- Verwaltung
  'institutional'        -- Pensionskasse, Fonds, Immobiliengesellschaft
);

-- Lebenslauf eines Inserats. Übergänge werden in 0004 erzwungen, nicht im Code.
CREATE TYPE listing_status AS ENUM (
  'draft',               -- entsteht im Assistenten, nur für die verfassende Person
  'submitted',           -- eingereicht, wartet auf Prüfung
  'in_review',           -- eine Person prüft gerade
  'changes_required',    -- zurückgewiesen mit Begründung, kann überarbeitet werden
  'approved',            -- geprüft, noch nicht veröffentlicht
  'published',           -- öffentlich sichtbar
  'paused',              -- vorübergehend zurückgezogen
  'reserved',            -- reserviert, bleibt sichtbar
  'sold',
  'rented',
  'expired',             -- Laufzeit abgelaufen
  'archived',            -- aus dem Verkehr, bleibt für Historie und Weiterleitung
  'rejected'             -- endgültig abgelehnt
);

CREATE TYPE transaction_kind AS ENUM ('sale', 'rent');

CREATE TYPE property_kind AS ENUM (
  'apartment', 'house', 'villa', 'chalet', 'multi_family',
  'commercial', 'land', 'parking'
);

-- Wie genau die Lage öffentlich erscheinen darf. Aus P3 übernommen und hier
-- verbindlich: der Server entscheidet, was den Server verlässt.
CREATE TYPE geo_precision AS ENUM (
  'exact',               -- Punkt auf der Adresse
  'approximate',         -- Feld von rund 450 m
  'municipality'         -- Feld von rund 2 km
);

-- Zugangsstufen für Dokumente. In P1 als Gestaltung eingeführt, ab hier
-- serverseitig durchgesetzt (siehe 0005).
CREATE TYPE document_access AS ENUM (
  'public',              -- frei herunterladbar
  'authenticated',       -- angemeldet
  'on_request',          -- nach Anfrage, von der inserierenden Seite freigegeben
  'after_viewing',       -- nach stattgefundener Besichtigung
  'qualified',           -- nach Finanzierungsnachweis
  'internal'             -- nur Eigentümerschaft und Fourwalls
);

CREATE TYPE inquiry_kind AS ENUM (
  'listing_question',    -- Frage zum Objekt
  'viewing_request',     -- Besichtigung
  'valuation',           -- Bewertung anfragen
  'management_quote',    -- Offerte Bewirtschaftung
  'general'
);

CREATE TYPE inquiry_status AS ENUM ('new', 'seen', 'answered', 'closed', 'spam');

CREATE TYPE org_role AS ENUM ('owner', 'admin', 'agent', 'viewer');

-- Plattformrollen. Bewusst getrennt von org_role: Eine Person kann in ihrer
-- Firma 'agent' sein und auf der Plattform trotzdem nichts moderieren dürfen.
CREATE TYPE platform_role AS ENUM ('user', 'staff', 'moderator', 'admin');

CREATE TYPE alert_frequency AS ENUM ('instant', 'daily', 'weekly');

-- ---------- Gemeinsame Hilfen ----------

-- updated_at pflegt sich selbst; sonst wird es irgendwann vergessen.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Öffentliche, zitierbare Kennung: FW-2026-000142.
-- Getrennt von der internen UUID (die niemand vorlesen will) und vom Slug
-- (der sich ändern darf). Diese Nummer ändert sich nie.
CREATE SEQUENCE public_reference_seq START 1000;

CREATE OR REPLACE FUNCTION next_public_reference(prefix text DEFAULT 'FW')
RETURNS text AS $$
  SELECT prefix || '-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public_reference_seq')::text, 6, '0');
$$ LANGUAGE sql VOLATILE;

-- Für Ortssuche und Slugs: «Zürich» und «Zuerich» sollen sich treffen.
CREATE OR REPLACE FUNCTION normalize_text(input text)
RETURNS text AS $$
  SELECT lower(unaccent(coalesce(input, '')));
$$ LANGUAGE sql IMMUTABLE;

COMMIT;
