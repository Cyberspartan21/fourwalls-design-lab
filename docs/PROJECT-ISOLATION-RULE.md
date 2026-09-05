# FOURWALLS — Projekt-Isolation für Werkzeuge und Agenten (bindend)

Anlass: Während P5.5 hat ein Prüfauftrag mit dem Befehl
`pkill -f "next start -p 30"` einen fremden Prozess eines **anderen**
Projekts auf demselben Rechner beendet (ein Vorschauserver von "adamont" auf
Port 3013 — der Ziffernanfang "30" traf zufällig auch dessen Port). Das darf
nicht wieder passieren.

## Die Regel

Jedes Skript, jeder Prüfauftrag und jeder Agent, der in diesem Repository
arbeitet, darf ausschliesslich Ressourcen stoppen, löschen oder zurücksetzen,
die **eindeutig FOURWALLS gehören** — erkennbar an EINEM der folgenden
Merkmale, nie an einer Vermutung:

1. **Docker-Container/Volumes**: Name beginnt mit `fw-` (z. B. `fw-dev-db`,
   `fw-clean-db`, `fw-restore-test`) ODER trägt das Docker-Label
   `com.fourwalls.project=true` (siehe `infra/local/docker-compose.yml`).
2. **Prozesse**: Nur beenden, wenn die volle Befehlszeile (`ps -o command=`)
   den absoluten Pfad dieses Repositoriums enthält (z. B.
   `.../fourwalls/app`), NIE nach Portziffern, Programmname oder einem Teil
   davon.
3. **Temporäre Verzeichnisse**: Nur eigene, mit `fw-` präfigierte Pfade unter
   `/tmp` (z. B. `/tmp/fw-mail-tls`, `/tmp/fw-p53-baseline`) oder Pfade
   innerhalb dieses Repositoriums.
4. **Testdatenbanken**: Nur Datenbanken, die ein FOURWALLS-Skript in
   demselben Lauf selbst mit `fw-`-Namen angelegt hat (z. B.
   `fourwalls_clean`, `fourwalls_restore`).

## Ausdrücklich verboten

- `pkill` mit einem Muster, das nicht den vollen Repository-Pfad enthält
  (`pkill -f "next start"` ist verboten; `pkill -f "/fourwalls/app"` wäre
  erlaubt, sofern die Ausgabe vorher geprüft wurde).
- `kill` einer PID, die nicht zuvor über den vollen Befehlszeileninhalt als
  FOURWALLS-Prozess bestätigt wurde.
- `docker stop`/`docker rm` ohne expliziten `fw-`-Namen (kein `$(docker ps -q)`,
  kein Filter nach Image-Name allein, kein Filter nach Portnummer allein).
- `docker system prune`, `docker container prune` — trifft immer alle
  Projekte auf der Maschine, nie erlaubt.
- Entfernen gemeinsamer temporärer Wurzelverzeichnisse (`/tmp` selbst, nicht
  darunterliegende `fw-*`-Unterordner).
- Jede Aktion "vorsichtshalber auf alles", weil ein einzelnes Ziel nicht
  gefunden wurde — lieber nichts tun und melden.

## Vor jeder stoppenden/löschenden Aktion

1. Erst **auflisten** (`docker ps --format ...`, `lsof -i :<port>`,
   `ps -p <pid> -o command=`), NIE blind eine Aktion mit einem Muster
   ausführen, das mehr treffen könnte als beabsichtigt.
2. Die Ausgabe **lesen** und gegen die vier Merkmale oben prüfen.
3. Erst dann gezielt mit dem exakten Namen/der exakten PID handeln.
4. Trifft das Muster mehr als erwartet (z. B. mehrere Prozesse), abbrechen
   und nachfragen statt zu raten.

## Falsifikation (muss nach jeder Änderung an dieser Regel erneut geprüft werden)

Ein unbeteiligter „Attrappen"-Container und -Prozess eines fremden,
erfundenen Projekts müssen jeden in diesem Repository möglichen
Aufräumvorgang überleben. Prüflauf und Ergebnis: siehe P5.6-Bericht,
Abschnitt „Cross-Project Safety".

## Geltungsbereich

Diese Datei gilt für jeden Agenten, jedes Skript und jede Person, die in
`/Users/spqr/Documents/06 AI & Development/fourwalls` automatisiert etwas
stoppt, löscht oder zurücksetzt — auch ausserhalb von P5.6.
