# Reihenfolge im Marktplatz — «Neuste» und Fourwalls Exclusive

Stand: 2026-09-06 (P5.9 Phase B, Geschäftsentscheid des Inhabers)

## Was passiert technisch

Die Sortierung «Neuste» (`server/search.ts`, Sortier-Allowlist, Fall `"neu"`)
zeigt zuoberst — nicht mehr als drei — Inserate, die beide Bedingungen
erfüllen:

- sie sind von Fourwalls selbst vermarktet (`publisher_kind = 'fourwalls'`),
- **und** einer Organisation zugeordnet, die Fourwalls tatsächlich vertritt
  (`represented_by_org_id IS NOT NULL`).

Technisch geschieht das über ein Fenster (`row_number() OVER (PARTITION BY
exklusiv ORDER BY published_at DESC) <= 3`): innerhalb der Gruppe der
Exclusive-Objekte werden die drei neuesten identifiziert und vor allen
anderen Ergebnissen einsortiert. Ab dem vierten Exclusive-Objekt und für
alle übrigen Inserate gilt unverändert: neuste zuerst, ohne Bevorzugung.

Alle anderen Sortierungen (`empfohlen`, `preis-auf`, `preis-ab`, `flaeche`,
`zimmer`, `m2`) kennen diese Hervorhebung nicht — sie sortieren ausschliesslich
nach den jeweils genannten, objektiven Kriterien.

## Kennzeichnung

Ein hervorgehobenes Objekt erscheint auf der Ergebniskarte
(`components/marktplatz/karte.tsx`) nicht kommentarlos: es trägt sichtbar das
Etikett **«Fourwalls Exclusive»** (`w.exclusive`, aus `common.json` →
`exclusive`). Dieselbe Kennzeichnung erscheint auf der Objektseite
(`components/property/seite.tsx`, Feld `quelleLabel`/`istEx`). Es gibt keine
Hervorhebung ohne diese Kennzeichnung.

## Was bewusst NICHT passiert

- Es gibt **kein bezahltes Ranking**: kein Anbieter kann sich in der
  regulären Reihenfolge nach vorne kaufen. Die reguläre Reihenfolge der
  Suchergebnisse ist nicht käuflich — das gilt für «Neuste» ausserhalb der
  höchstens drei Exclusive-Plätze genauso wie für alle anderen Sortierungen.
- Die Hervorhebung gilt ausschliesslich für Fourwalls' eigene Mandate, nicht
  für Drittanbieter (Agenturen, Verwaltungen, Bauträger, Privatpersonen).
- Es sind höchstens drei Objekte — kein grösserer, konfigurierbarer Anteil.

## Geschäftsgrundlage

Diese Seite beschreibt reines Verhalten, keine Erlaubnis, es zu ändern.
Massgeblich ist der Geschäftsentscheid in `app/config/policy.ts`:

- `AUSSAGEN.exclusivePlatzierung` — bestätigt die Hervorhebung samt
  Kennzeichnung und Nicht-Käuflichkeit der übrigen Reihenfolge.
- `AUSSAGEN.keinBezahltesRanking` — bestätigt, dass die reguläre Reihenfolge
  nicht käuflich ist.

**Jede Änderung an dieser Reihenfolge — mehr als drei Plätze, andere
Kriterien, Ausweitung auf weitere Anbieterarten, bezahlte Hervorhebung
irgendeiner Art — ist eine explizite Policy-Entscheidung des Inhabers und
keine rein technische Änderung.** Sie beginnt mit einer Änderung an
`config/policy.ts` (neuer `entscheid`-Eintrag, neues Datum), nicht mit einer
Änderung an `server/search.ts`.
