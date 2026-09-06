# Datenkarte — Konto löschen (P5.10 §11)

Diese Tabelle ist aus `domain/kontoloeschung.ts` (`DATENKLASSEN`) erzeugt —
dieselbe Datenstruktur, die auch die Löschlogik (`server/konto-loeschung.ts`)
und die Seite `/konto/loeschen` benutzen. Ändert sich die Behandlung einer
Datenart, ändert sich diese Datei nur, wenn jemand `DATENKLASSEN` ändert;
umgekehrt kann diese Datei nicht mehr behaupten als der Server tatsächlich tut.

**Bindend:** Aufbewahrung ist UNENTSCHIEDEN. Wo unten "RECHTSPRÜFUNG" steht,
ist bewusst keine Frist genannt — weder hier noch im Code noch in der
Oberfläche. Das System behauptet nie, alles sei gelöscht, wenn etwas bleibt.

## Übersicht

| Datenart | Tabelle | Personenbezogen | Eigentümer | Behandlung bei Kontolöschung | Aufbewahrung |
|---|---|---|---|---|---|
| Anmeldesitzungen | `auth_session` | ja | Person | LÖSCHEN | technisch, keine Frist nötig |
| Anmeldeweg (Passwort) | `auth_account` | ja | Person | LÖSCHEN | technisch, keine Frist nötig |
| Bestätigungs-/Rücksetzmarken | `auth_verification` | ja | Person | LÖSCHEN | technisch, keine Frist nötig |
| Merkliste | `favorite` | ja | Person | LÖSCHEN | technisch, keine Frist nötig |
| Gespeicherte Suchen/Suchabo | `saved_search`, `search_alert`, `search_alert_sent` | ja | Person | LÖSCHEN | technisch, keine Frist nötig |
| Zuletzt angesehen | `recently_viewed` | ja | Person | LÖSCHEN | technisch, keine Frist nötig |
| Eigene Entwürfe/Inserate in Prüfung (+ Bilder) | `listing`, `property`, `listing_image`, `listing_content`, `moderation_case`, `draft_claim`, `media_asset`/`media_variant` | ja | Person | LÖSCHEN | technisch, keine Frist nötig |
| Eigene Inserate, die öffentlich waren/sind | `listing` (privat) | ja | Person | ZURÜCKGESTELLT — Status `archived`, damit aus `listing_public` und somit aus jeder öffentlichen Anzeige entfernt; Bilder bleiben im Speicher, aber nicht mehr öffentlich ausgeliefert | **UNENTSCHIEDEN / RECHTSPRÜFUNG** |
| Organisationsinserate | `listing` (`published_by_org_id` gesetzt) | nein | Organisation | BLEIBT FREMDES EIGENTUM — `assigned_user_id` → NULL, Inserat bleibt veröffentlicht | technisch, keine Frist nötig (gehört der Organisation) |
| Gesendete Anfragen | `inquiry` (`sender_user_id`) | ja | Person | ZURÜCKGESTELLT — `sender_user_id` → NULL, Kontaktfelder bleiben (Posteingang der angefragten Anbieterin) | **UNENTSCHIEDEN / RECHTSPRÜFUNG** |
| Anliegen an FOURWALLS | `service_lead` | ja | Person | ZURÜCKGESTELLT — `user_id` → NULL, Kontaktfelder bleiben | **UNENTSCHIEDEN / RECHTSPRÜFUNG** (bereits in 0019 §44 offen) |
| Prüfspur | `audit_log` | nein | Fourwalls | BLEIBT — nur Vorgänge/Kennungen, keine Inhalte; `actor_user_id` bleibt gültig (Person wird anonymisiert, nicht gelöscht) | unbefristet zulässig (keine Inhalte) |
| Bereits versendete Post | `mail_outbox` (Status `accepted`) | ja | Person | ZURÜCKGESTELLT — unverändert | **UNENTSCHIEDEN / RECHTSPRÜFUNG** |
| Nicht versendete Post | `mail_outbox` (Status `created`/`failed`/`abandoned`) | ja | Person | LÖSCHEN — wird nicht mehr versendet | technisch, keine Frist nötig |
| Team-Mitgliedschaft | `org_membership` | ja | Organisation | BLEIBT FREMDES EIGENTUM — `is_active` → false (deaktiviert, wie beim regulären Austritt) | technisch, keine Frist nötig (gehört der Organisation) |
| Offene Einladung an die Person | `org_invitation` | ja | Organisation | BLEIBT FREMDES EIGENTUM — `revoked_at` gesetzt (widerrufen) | technisch, keine Frist nötig (gehört der Organisation) |
| Die Person selbst | `app_user` | ja | Person | ANONYMISIEREN (Tombstone) — `email` → `geloescht+<uuid>@konto.geloescht.invalid`, `display_name` → „Gelöschtes Konto“, `phone` → NULL, `platform_role` → `user`, `deleted_at` = jetzt; Zeile bleibt wegen Fremdschlüsseln | entfällt (keine personenbezogenen Klartextfelder mehr) |

## Nicht entschieden

- **Aufbewahrungsfrist** für zurückgestellte Daten (eigene ehemals öffentliche
  Inserate, gesendete Anfragen, Anliegen an FOURWALLS, bereits versendete
  Post). Es gibt keine Frist — weder 30 Tage noch 10 Jahre noch „für immer“.
- Ob archivierte, private Inserate einer gelöschten Person irgendwann ganz
  gelöscht werden dürfen/müssen (derzeit: Endzustand, keine Rücknahme, aber
  auch kein automatisches Löschen).
- Ob `inquiry.recipient_user_id` (die EMPFANGENDE Seite einer Anfrage, wenn
  diese Person selbst ein Privatinserat betreibt) bei deren eigener
  Kontolöschung eine andere Behandlung braucht als hier beschrieben — diese
  Migration fasst nur die SENDENDE Seite an (Auftragsvorgabe P5.10 §9).
- Eine Stilllegungsfunktion für Organisationen existiert bereits
  (`server/organisationen.ts:stilllegen`) und wird von dieser Migration nur
  benutzt (Übergabe der Besitzerschaft ODER Stilllegung, §10) — keine neue
  Funktion. Ob eine dritte Option (z. B. automatische Übergabe an
  FOURWALLS) fachlich gewünscht ist, ist nicht entschieden und wurde nicht
  gebaut.

## Für die Rechtsprüfung nötige Entscheide

1. Aufbewahrungsfristen für jede mit „UNENTSCHIEDEN / RECHTSPRÜFUNG“
   markierte Zeile oben — je Datenart, nicht pauschal.
2. Ob ein archiviertes, ehemals öffentliches Inserat einer gelöschten Person
   nach Ablauf einer (noch zu bestimmenden) Frist ganz gelöscht werden darf,
   und was mit seinen Bildern dann geschieht.
3. Ob `service_lead`- und `inquiry`-Kontaktfelder nach einer Frist anonymisiert
   statt nur entkoppelt (`user_id` → NULL) werden müssen.
4. Ob eine Bestätigungs-E-Mail beim Löschen rechtlich verlangt ist (aktuell:
   keine — nur die sofortige Antwort der API und die Bestätigungsseite).
