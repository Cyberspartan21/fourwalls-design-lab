# FOURWALLS — bindende Arbeitsregeln in diesem Repository

## Projekt-Isolation (bindend, siehe docs/PROJECT-ISOLATION-RULE.md)

Bevor du in diesem Verzeichnisbaum irgendeinen Prozess, Container, Datenbank
oder temporären Ordner stoppst, löschst oder zurücksetzt: lies
`docs/PROJECT-ISOLATION-RULE.md` und halte dich daran. Kurzfassung: nur
Ressourcen mit `fw-`-Namen, dem Docker-Label `com.fourwalls.project=true`,
oder Prozessen, deren volle Befehlszeile den Repository-Pfad enthält, dürfen
angefasst werden. Kein `pkill` nach Portnummer oder Teilnamen, kein
`docker stop`/`rm` ohne exakten Namen, kein `docker system prune`. Anlass:
ein Prüfauftrag hat in P5.5 mit einem zu unspezifischen `pkill`-Muster einen
fremden Prozess eines anderen Projekts beendet.

## Kostenfreiheit (bindend, seit P5.5)

Keine bezahlte Infrastruktur, keine Domain, kein bezahlter Dienst, kein
Abonnement — auch kein "kostenloser Trial", der später kostenpflichtig
werden kann. Lokale Infrastruktur (Docker: Postgres/PostGIS, MinIO, Mailpit,
siehe `infra/local/docker-compose.yml`) ersetzt echtes Hosting, bis der
Auftraggeber den öffentlichen Start konkret vorbereitet
(`docs/PRODUCTION-INFRA-DEFERRED.md`).

## UFER ist eingefroren

Typografie, Kernfarben, Heldenbild-Richtung, Wasser-/Spiegelungsmotiv, Logo,
Kartensprache, Tag-/Abendmodus, Formulierungen der öffentlichen
Objektseite — nicht neu gestalten, nur vervollständigen.
