-- ============================================================
-- 0010 — Suchindex für «Ähnliche Objekte» (P5.3)
-- Befund aus dem Skalentest (tools/skalen-test.mjs, 50 000 Inserate): die
-- Kandidatensuche für Ähnliche (gleiche Transaktion, gleiche Objektart,
-- veröffentlicht, Preisband) lief als Seq Scan in ~210 ms. Ein Teilindex über
-- die veröffentlichten Inserate nach Transaktion, Objektart und Preis deckt
-- genau diesen Zugriff. Objektart steht auf property, Preis auf listing —
-- darum liegt der Index auf listing (transaction, price_chf) und die Art wird
-- über den Join geprüft; für Miete entsprechend rent_net_chf.
-- CHF/m²-Sortierung (price_per_m2 ist ein Sichtausdruck) bleibt ohne Index —
-- bei 50 000 Inseraten ~140 ms; erst mit einer gespeicherten Spalte sinnvoll.
-- ============================================================
BEGIN;
CREATE INDEX IF NOT EXISTS listing_aktiv_property ON listing (property_id, transaction)
  WHERE status IN ('published','reserved');
CREATE INDEX IF NOT EXISTS property_kind_idx ON property (kind);
COMMIT;
