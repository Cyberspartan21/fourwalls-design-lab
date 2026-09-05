# FOURWALLS — CSV-Import für Organisationen (P5.7 §29–§31, §75)

Eine bewusst kleine, dokumentierte Grenze. Kein Feed, keine API, kein XML —
eine Datei, einmal hochgeladen, Zeile für Zeile durch dieselbe Prüfung wie
der Inserats-Assistent. Es gibt keine zweite Inserats-Engine (§22): jede
importierte Zeile wird ein ganz normaler Entwurf und durchläuft denselben
Moderationsweg wie ein von Hand erfasstes Inserat.

## Wer darf importieren

Eine Person mit dem Teamrecht `IMPORT_LISTINGS` in der Organisation
(Rollen `owner`/`admin`, siehe `domain/orgrechte.ts`). Route:
`POST /api/org/[slug]/import`, Ratenlimit 10 Aufrufe je Stunde und Person.

## Format

Reine Textdatei, UTF-8, `text/csv` oder JSON `{ "csv": "..." }`. Trennzeichen
Komma, Anführungszeichen `"` zum Einschliessen von Feldern mit Komma oder
Zeilenumbruch, verdoppeltes `""` als escapetes Anführungszeichen. CRLF- und
LF-Zeilenenden werden beide akzeptiert.

Die Kopfzeile ist Pflicht und muss **exakt** lauten:

```
external_ref,trans,typ,ortId,zimmer,flaeche,preis,titel,beschreibung,sprache
```

| Spalte        | Pflicht | Werte                                              |
|---------------|---------|-----------------------------------------------------|
| external_ref  | ja      | 1–80 Zeichen, keine Steuerzeichen — die Fremdkennung aus dem System der Organisation |
| trans         | nein    | `sale` \| `rent`                                    |
| typ           | nein    | `wohnung`\|`haus`\|`villa`\|`chalet`\|`mfh`\|`gewerbe`\|`grundstueck`\|`parkplatz` |
| ortId         | nein    | `ort-…` aus dem Ortsindex                           |
| zimmer        | nein    | Zahl                                                 |
| flaeche       | nein    | Zahl (m²)                                            |
| preis         | nein    | Zahl (CHF)                                           |
| titel         | nein    | Text, max. 70 Zeichen                                |
| beschreibung  | nein    | Text, max. 4000 Zeichen                              |
| sprache       | nein    | `de`\|`fr`\|`it`\|`en`, Standard `de`                |

Jede Zeile durchläuft dasselbe Schema wie der Assistent
(`domain/entwurf.ts:EntwurfSchema`) — unbekannte oder ungültige Werte führen
zur Ablehnung dieser einen Zeile, nicht des ganzen Imports.

Name, E-Mail und Telefon werden **nicht** aus der CSV übernommen: sie kommen,
wie bei jedem Organisationsinserat, aus dem öffentlichen Profil der
Organisation (`display_name`/`public_email`/`public_phone`) und lassen sich
im Assistenten nachträglich ändern (§23).

## Grenzen

- Höchstens **200 Zeilen** je Import (ohne Kopfzeile).
- Höchstens **1 MB** Dateigrösse.
- Höchstens 10 Importe je Stunde und Person.

## Ergebnis

Für jede Zeile eine Antwort:

| Status         | Bedeutung                                                        |
|----------------|-------------------------------------------------------------------|
| `angelegt`     | Ein neuer Entwurf wurde erstellt (Zustand `draft`, wie immer).     |
| `uebersprungen`| Es gibt in dieser Organisation bereits ein Inserat mit demselben `external_ref` — der Import ist wiederholbar, ohne Duplikate zu erzeugen. |
| `abgelehnt`    | Die Zeile ist ungültig; `grund` nennt, warum.                      |

Die Prüfung auf Wiederholung erfolgt **vor** dem Schreiben (`SELECT` auf den
Unique-Index `listing_org_external_ref` aus `db/migrations/0017_organisationen.sql`),
nicht durch Abfangen eines Datenbankfehlers.

## Nie das Statusmodell umgehen

Ein Import erzeugt ausschliesslich Entwürfe (§30). Es gibt keinen Weg, per
CSV ein Inserat direkt zu veröffentlichen, jemanden zuzuweisen oder eine
Organisation zu wechseln — diese Felder kennt das CSV-Schema nicht, und
`EntwurfSchema` lehnt jedes unbekannte Feld ab (§67).

## Was hier bewusst NICHT gebaut ist (§75)

- **Kein Feed-Abo**: kein wiederkehrender, automatischer Abgleich mit dem
  System der Organisation. Jeder Import ist eine bewusste, einmalige Handlung
  einer Person mit dem passenden Teamrecht.
- **Keine API zum Massenschreiben**: kein Endpunkt, der Inserate ohne Prüfung
  durch eine Person anlegt.
- **Kein XML/Feed-Format** (z. B. OpenImmo, IDX). Ein einziges, dokumentiertes
  CSV-Schema — kein Übersetzungslayer für fremde Formate.
- **Keine automatische Aktualisierung** bestehender Zeilen: ein zweiter
  Import mit demselben `external_ref` überspringt die Zeile, statt sie still
  zu überschreiben. Änderungen an einem bereits importierten Inserat laufen
  über den Assistenten wie jede andere Bearbeitung.

Wird ein echter Feed-Anschluss künftig gebraucht, ist das eine eigene,
bewusst entschiedene Erweiterung — kein stillschweigender Ausbau dieser
Grenze.
