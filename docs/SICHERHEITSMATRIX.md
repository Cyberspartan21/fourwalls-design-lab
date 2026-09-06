# Autorisierungs-Master-Matrix (P5.10 §8)

Diese Matrix listet jede Akteur×Ressource-Kombination, die
`app/scripts/autorisierung-matrix-test.mjs` gegen einen laufenden
Entwicklungsserver prüft. Für jede Zeile steht **Erwartet** — hergeleitet
direkt aus dem Code (`domain/rechte.ts`, `domain/orgrechte.ts`,
`server/org-kontext.ts`, den jeweiligen `server/*.ts`-Funktionen) — neben
**Ist**, dem tatsächlich gemessenen HTTP-Status aus dem letzten grünen Lauf.
Eine Abweichung wäre ein Fund; es gibt keine.

Ergänzend prüft `app/scripts/final-sicherheit-test.mjs` (P5.10 §47) dieselben
Grenzen noch einmal adversarial (Cookie-Wiederverwendung, Feldinjektion,
Geo-/Adressprivatsphäre, Massenzuweisung, Einladungstoken, Produktions-
konfiguration, Demo-Tore) — siehe Kopfkommentar dort für den vollständigen
Katalog. Diese Datei bildet nur die *Master-Matrix* (§8) ab.

## Akteure

| Kürzel | Rolle | Herkunft im Testlauf |
|---|---|---|
| anonym | keine Sitzung | kein Cookie |
| K | Kunde, keine Sonderrechte | `platform_role = user` |
| P | privater Verkäufer | `platform_role = user`, eigener Entwurf + eigenes veröffentlichtes Inserat |
| O1 | Besitzerin von ALPHA | `org_membership.role = owner` |
| A1 | Admin von ALPHA | `org_membership.role = admin` |
| G1 | Agent von ALPHA | `org_membership.role = agent` |
| V1 | Viewer von ALPHA | `org_membership.role = viewer` |
| O2 | Besitzerin von BETA | `org_membership.role = owner`, fremde Organisation |
| S | FOURWALLS-Personal | `platform_role = staff` (SQL gesetzt) |
| M | Moderation | `platform_role = moderator` (aus `var/konten.local.json`, Rückfall über `scripts/rolle.mjs`) |
| AD | Plattform-Admin | `platform_role = admin` (SQL gesetzt), **kein** Mitglied irgendeiner Organisation |

## Ressourcen und Herleitung

| Ressource/Aktion | Rechtsquelle |
|---|---|
| `/api/konto/*` (Favoriten, Suchabos, Verlauf, Anfragen, Anliegen, Export) | `verlangeSitzung()` — sitzungsgebunden, kein ID-Parameter |
| `/api/entwuerfe/<ref>` GET/PATCH/aktion | `domain/rechte.ts:darfEntwurfSehen/-Bearbeiten/-Einreichen` → `server/entwuerfe.ts` |
| `/vorschau/<ref>` | `domain/rechte.ts:darfVorschauSehen` → `server/vorschau.ts` |
| `/api/org/<slug>/*` | `server/org-kontext.ts:verlangeOrgRecht` (fremd/unbekannt → 404, Mitglied ohne Recht → 403) |
| `/api/org/<slug>/inserate/<ref>/zuweisen` | `domain/orgrechte.ts: ASSIGN_LISTING ∈ FUEHREN` |
| `/api/org/<slug>/mitglieder*` | `domain/orgrechte.ts: MANAGE_MEMBERS`, `darfRolleVergeben` |
| `/api/moderation*` | `domain/rechte.ts: VIEW_MODERATION_QUEUE/REVIEW_LISTING/…`, `beteiligt()` (eigenes Büro) |
| `/api/intern/anliegen*` | `domain/rechte.ts: VIEW_SERVICE_LEADS/MANAGE_SERVICE_LEADS/ASSIGN_SERVICE_LEAD` (nur `staff`+`admin`) |
| `/api/medien/<id>` | `server/medien.ts:bildAusliefern` (eigen, öffentlich, oder Moderation in Prüfung) |
| `/api/einladungen/<token>` | `server/einladungen.ts` (Zustand, Adressabgleich, `organization_id`-Filter beim Widerruf) |
| `/api/suchabo/<id>` | `server/gespeicherteSuchen.ts` (Besitz → NOT_FOUND bei fremder ID) |

## Matrix

| Nr | Akteur → Aktion | Erwartet | Ist | Herleitung |
|---:|---|:---:|:---:|---|
| 1 | K → eigene `/api/konto/*`-Routen (Anliegen, Favoriten, Suchabo, Export) | 200 | 200 | sitzungsgebunden, kein IDOR-Vektor |
| 2 | K → `/api/konto/export` ohne Sitzung | 401 | 401 | `verlangeSitzung()` |
| 3 | K → `/api/konto/loeschen` mit falschem Passwort | 4xx | 422 | `server/konto-loeschung.ts` prüft Passwort vor jeder Wirkung |
| 4 | K → `/api/favoriten` mit fremder `userId` im Query | eigene Liste, fremdes Objekt fehlt | bestätigt | Route liest nur die Sitzung, keine ID wird entgegengenommen |
| 5 | P → K's Suchabo PATCH/DELETE (erratene/aufgezählte ID) | 404/404 | 404/404 | `server/gespeicherteSuchen.ts`: fremde ID → NOT_FOUND, nie FORBIDDEN |
| 6 | P → eigenen Entwurf GET/PATCH | 200 | 200 | `istEigentuemer(P, Entwurf)` |
| 7 | K → P's privaten Entwurf GET | 404 | 404 | `darfEntwurfSehen` verneint, `entwurfLesen` wirft NOT_FOUND |
| 8 | K → P's privaten Entwurf PATCH | 404 | 404 | s. o. |
| 9 | K → P's privaten Entwurf `aktion` (einreichen) | 404 | 404 | s. o. |
| 10 | `/vorschau/<P's Entwurf>`: anonym / K (fremd) / P (Eigentümerin) | 3xx / 404 / 200 | 3xx / 404 / 200 | `darfVorschauSehen`: `keine-sitzung` → Login-Umleitung, sonst NOT_FOUND |
| 11 | Medien: K → P's privates Bild / P → eigenes Bild | 404 / 200 | 404 / 200 | `server/medien.ts:bildAusliefern` — nicht öffentlich, nicht eigen, keine Moderation im Spiel |
| 12 | O2 (BETA) → GET/POST `/api/org/<alpha>/inserate` | 404/404 | 404/404 | `verlangeOrgRecht`: keine Mitgliedschaft → NOT_FOUND (§15) |
| 13 | V1 (viewer) → GET Inserate / POST anlegen | 200 / 403 | 200 / 403 | `VIEW_ORG_LISTINGS ∈ LESEN`, `CREATE_LISTING ∉ LESEN` |
| 14 | G1 (agent) → POST zuweisen | 403 | 403 | `ASSIGN_LISTING ∉ ARBEITEN`, nur `FUEHREN` |
| 15 | A1 (admin) → POST zuweisen | 200 | 200 | `ASSIGN_LISTING ∈ FUEHREN` |
| 16 | V1 (viewer) → PATCH fremden (Team-)Entwurf | 403 | 403 | Mitglied ohne `EDIT_ORG_LISTING` → FORBIDDEN (nicht NOT_FOUND, da Mitgliedschaft besteht) |
| 17 | O2 (BETA) → GET `/api/org/<alpha>/mitglieder` | 404 | 404 | `verlangeOrgRecht` |
| 18 | V1 (viewer) → POST einladen | 403 | 403 | `MANAGE_MEMBERS ∉ LESEN` |
| 19 | G1 (agent) → PATCH eigene Rolle → admin | 403 | 403 | `rolleAendern`: `zielUserId === akteur.id` → FORBIDDEN |
| 20 | A1 (admin) → PATCH G1 → `rolle: owner` | 403 | 403 | `domain/orgrechte.ts:darfRolleVergeben` — `owner` nur durch `owner` |
| 21 | A1 (admin) → PATCH G1 → `rolle: viewer` | 200 | 200 | `MANAGE_MEMBERS ∈ FUEHREN`, Ziel ≠ `owner` |
| 22 | V1 (viewer) → DELETE Mitglied | 403 | 403 | `MANAGE_MEMBERS ∉ LESEN` |
| 23 | V1 (viewer) → GET Anfragen / O2 (fremd) → GET Anfragen | 200 / 404 | 200 / 404 | `VIEW_INQUIRIES ∈ LESEN`; fremd → `verlangeOrgRecht` NOT_FOUND |
| 24 | G1 (agent) → PATCH Anbieterprofil | 403 | 403 | `MANAGE_PUBLISHER_PROFILE ∉ ARBEITEN` |
| 25 | A1 (admin) → PATCH Anbieterprofil | 200 | 200 | `MANAGE_PUBLISHER_PROFILE ∈ FUEHREN` |
| 26 | O2 (fremd) → PATCH `/api/org/<alpha>` | 404 | 404 | `verlangeOrgRecht` |
| 27 | O1 (Eigentümerin, kein Moderationsrecht) → GET `/api/moderation` | 403 | 403 | `ROLLE_RECHTE.user` enthält keine `MODERATION`-Rechte |
| 28 | S (staff) → GET `/api/moderation` | 403 | 403 | `ROLLE_RECHTE.staff = EIGENE+GESCHAEFT`, keine `MODERATION` |
| 29 | M (kein Mitglied ALPHA) → POST freigeben | 200 | 200 | `darf(moderator, REVIEW_LISTING)`, `beteiligt()` = false |
| 30 | M wird ALPHA-Mitglied → POST veröffentlichen (eigenes Büro) / nach Austritt | 403 / 200 | 403 / 200 | `domain/rechte.ts:beteiligt()` — Teamzugehörigkeit zählt wie Eigentum (§74) |
| 31 | M → GET `/api/intern/anliegen` | 403 | 403 | Moderation trägt keine `GESCHAEFT`-Rechte (§56) |
| 32 | S (staff) → GET/PATCH `/api/intern/anliegen` | 200 | 200 | `GESCHAEFT ∈ ROLLE_RECHTE.staff` |
| 33 | K → GET `/api/intern/anliegen/<beliebig>` | 403 | 403 | kein `VIEW_SERVICE_LEADS`, unabhängig von der Referenz (keine 404-Aufzählung) |
| 34 | AD (Plattform-Admin) → GET `/api/intern/anliegen` | 200 | 200 | `admin` trägt alle `RECHTE` |
| 35 | AD → GET `/api/org/<alpha>/inserate` bzw. `/mitglieder` | 404 / 404 | 404 / 404 | Plattformrolle ≠ Teammitgliedschaft — `verlangeOrgRecht` kennt nur `org_membership` |
| 36 | O1 (ALPHA) widerruft eine BETA-Einladung (fremde `invitationId`) | 404 | 404 | `server/einladungen.ts:widerrufen` filtert zusätzlich auf `organization_id` |
| 37 | Abgelaufene Einladung annehmen | 409 | 409 | `server/einladungen.ts:annehmen`, `zustand === 'abgelaufen'` |

## Zähler

- **37** nummerierte Matrixprüfungen + **10** Vorbereitungsschritte (Akteure/Ressourcen aufbauen) = 47 Schritte insgesamt.
- **47 / 47 grün**, **0 Abweichungen**, letzter Lauf: 47.2 s gegen `http://localhost:3007`.
- Jede Zeile oben wurde vor dem Lauf aus dem Code hergeleitet (Spalte „Herleitung“), nicht nachträglich an das Ergebnis angepasst.

## Ergänzende Feststellungen (kein Fund, zur Einordnung)

- **Dokument-Freigabe-API**: Es existiert keine dedizierte Route für „Dokument
  freigeben“ getrennt von `/api/medien/<id>` — Bilder und (potenzielle)
  Dokumente laufen über denselben, bereits geprüften Auslieferungspfad.
- **Cross-user Favoriten/Suchabos**: Beide Ressourcen sind entweder
  sitzungsgebunden ohne ID (`/api/favoriten`) oder prüfen die Eigentümerschaft
  serverseitig vor jeder Wirkung (`/api/suchabo/<id>`) — ein IDOR-Vektor
  besteht strukturell nicht.
- **Einladungstoken**: Der Klartext-Token verlässt den Server nur in der
  Mail; die Datenbank speichert ausschliesslich `token_hash` (§14). Ein
  erratener/manipulierter Token führt zu 404 (siehe
  `scripts/final-sicherheit-test.mjs`, Abschnitt J).

## Hinweise zur Ausführung

```
cd app
set -a; . ./.env.local; set +a
FW_TEST_MOD_EMAIL=<aus var/konten.local.json, mod@…> \
FW_TEST_MOD_PASSWORT=<dasselbe Konto> \
  node scripts/autorisierung-matrix-test.mjs http://localhost:3007
```

Hintergrundkonten (K, P, O1/A1/G1/V1, O2, S, AD) bestätigen ihre Adresse
direkt per SQL statt über den Mailweg — dieses Skript prüft Autorisierung,
nicht die Bestätigungs-/Einladungs-*Mail* selbst (dafür bestehen
`scripts/sicherheit-test.mjs` und `scripts/org-sicherheit-test.mjs`). Der
echte Mailweg bleibt für Schritt 37 (abgelaufene Einladung) erhalten, weil
dort das Token selbst geprüft wird. Alle Testorganisationen und -inserate
werden am Ende aufgeräumt; Konten mit Prüfspur bleiben bestehen.
