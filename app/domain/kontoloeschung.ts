/* Konto löschen — die Datenkarte als Datenstruktur, und die reine
   Entscheidlogik (P5.10 §9–§12).

   Zwei Dinge stehen hier bewusst zusammen:

   1. `DATENKLASSEN` ist die EINE Quelle sowohl für die Löschlogik
      (server/konto-loeschung.ts) als auch für die Datenkarte
      (docs/DATENKARTE.md, aus dieser Liste erzeugt). Zwei getrennte Listen
      wären über kurz oder lang inkonsistent — eine Datenkarte, die etwas
      anderes behauptet, als der Server tut, ist schlimmer als keine.
   2. Die Entscheidfunktionen (`alleinigeEigentuemerschaften`,
      `klassifiziereInserat`) sind rein: keine Datenbank, keine Sitzung.
      Der Server lädt die Fakten (Mitgliedschaften, Inserate) und fragt hier,
      was daraus folgt — wie domain/rechte.ts es für Inserate vormacht.

   Aufbewahrung ist an keiner Stelle dieser Datei entschieden (bindend,
   P5.10-Auftrag): "ZURUECKGESTELLT_RECHTSENTSCHEID" heisst immer "bleibt,
   bis jemand mit Rechtskompetenz eine Frist nennt" — nie "bleibt für immer"
   und nie "wird bald gelöscht". Das System behauptet nie, es sei alles
   gelöscht, wenn etwas bleibt. */

import type { OrgRolle } from "./orgrechte.ts";
import type { Status } from "./rechte.ts";

/* ---------- Die Datenkarte als Datenstruktur ---------- */

export type Behandlung =
  | "LOESCHEN"
  | "ANONYMISIEREN"
  | "BLEIBT_FREMDES_EIGENTUM"
  | "ZURUECKGESTELLT_RECHTSENTSCHEID"
  | "BLEIBT";

export type Eigentuemer = "Person" | "Organisation" | "Fourwalls";

export interface Datenklasse {
  /* Stabiler Schlüssel — für Verweise aus Code und Bericht, ändert sich nie. */
  schluessel: string;
  /* Tabelle(n) in der Datenbank, für die Datenkarte. */
  tabelle: string;
  beschreibung: string;
  personenbezogen: boolean;
  eigentuemer: Eigentuemer;
  behandlung: Behandlung;
  begruendung: string;
}

export const DATENKLASSEN: Datenklasse[] = [
  {
    schluessel: "auth_session",
    tabelle: "auth_session",
    beschreibung: "Angemeldete Sitzungen (Better Auth).",
    personenbezogen: true,
    eigentuemer: "Person",
    behandlung: "LOESCHEN",
    begruendung: "Eine Sitzung hat ohne die Person keinen Sinn; alle Sitzungen werden bei der Löschung widerrufen (§9)."
  },
  {
    schluessel: "auth_account",
    tabelle: "auth_account",
    beschreibung: "Anmeldeweg der Person (E-Mail/Passwort-Hash, Better Auth).",
    personenbezogen: true,
    eigentuemer: "Person",
    behandlung: "LOESCHEN",
    begruendung: "Ohne Konto kein Anmeldeweg — der Passwort-Hash hat ausserhalb der Person keinen Zweck."
  },
  {
    schluessel: "auth_verification",
    tabelle: "auth_verification",
    beschreibung: "Kurzlebige Bestätigungs-/Rücksetz-Marken (Better Auth), an die Adresse der Person gebunden.",
    personenbezogen: true,
    eigentuemer: "Person",
    behandlung: "LOESCHEN",
    begruendung: "An eine nicht mehr existierende Adresse gebundene Marken sind wirkungslos und werden entfernt."
  },
  {
    schluessel: "favorite",
    tabelle: "favorite",
    beschreibung: "Merkliste angemeldeter Personen.",
    personenbezogen: true,
    eigentuemer: "Person",
    behandlung: "LOESCHEN",
    begruendung: "Eine Merkliste ist ausschliesslich für die merkende Person von Nutzen (§9)."
  },
  {
    schluessel: "saved_search",
    tabelle: "saved_search, search_alert, search_alert_sent",
    beschreibung: "Gespeicherte Suchen und ihre Suchabo-Zustellung (Bestätigung, Pausierung, Versandverlauf).",
    personenbezogen: true,
    eigentuemer: "Person",
    behandlung: "LOESCHEN",
    begruendung: "Löschen von saved_search entfernt search_alert/search_alert_sent per ON DELETE CASCADE (§9)."
  },
  {
    schluessel: "recently_viewed",
    tabelle: "recently_viewed",
    beschreibung: "Zuletzt angesehene Inserate, geräteübergreifend.",
    personenbezogen: true,
    eigentuemer: "Person",
    behandlung: "LOESCHEN",
    begruendung: "Ein reiner Komfortverlauf ohne Zweck ausserhalb des eigenen Kontos (§9)."
  },
  {
    schluessel: "listing_entwurf",
    tabelle: "listing (+ property, listing_image, listing_content, moderation_case, draft_claim, media_asset/media_variant der Entwürfe)",
    beschreibung: "Eigene, private Inserate im Entwurfs- oder Prüfstadium (draft/submitted/in_review/changes_required/rejected), noch nie veröffentlicht gewesen oder nach Ablehnung nicht mehr öffentlich.",
    personenbezogen: true,
    eigentuemer: "Person",
    behandlung: "LOESCHEN",
    begruendung: "Nie öffentlich gewesen bzw. keine Prüfspur eines Marktauftritts, die eine Interessentin betrifft — inklusive der zugehörigen Bilder im Objektspeicher (§9)."
  },
  {
    schluessel: "listing_aktiv",
    tabelle: "listing (privat, ohne Organisation)",
    beschreibung: "Eigene, private Inserate, die öffentlich waren oder sind (published/reserved/paused/expired/sold/rented) oder bereits archiviert sind.",
    personenbezogen: true,
    eigentuemer: "Person",
    behandlung: "ZURUECKGESTELLT_RECHTSENTSCHEID",
    begruendung:
      "Kein Fristenentscheid getroffen (bindend). Das Inserat wird auf den bestehenden Endzustand 'archived' gesetzt — damit verschwindet es aus listing_public (WHERE status IN ('published','reserved'), 0008/0009) vollständig aus der öffentlichen Suche und Objektseite; von dort ist kein Weg zurück (Zustandsautomat, 0004). Die Bilder bleiben im Speicher (kein Beweismittel wird vernichtet), werden aber nicht mehr öffentlich ausgeliefert (pub/ → abl/, wie beim Pausieren). Ob und wann die Zeile selbst später gelöscht wird, ist ein Rechtsentscheid, kein technischer."
  },
  {
    schluessel: "listing_organisation",
    tabelle: "listing (published_by_org_id gesetzt)",
    beschreibung: "Inserate, die eine Organisation herausgibt und denen die Person nur als Teammitglied zugewiesen war.",
    personenbezogen: false,
    eigentuemer: "Organisation",
    behandlung: "BLEIBT_FREMDES_EIGENTUM",
    begruendung: "Ein Organisationsinserat gehört der Organisation, nie der einzelnen Person (P5.7 §26/§42). assigned_user_id wird auf NULL gesetzt (dieselbe Regel wie beim Austritt aus dem Team, P5.7 §38); das Inserat bleibt unverändert veröffentlicht."
  },
  {
    schluessel: "inquiry_gesendet",
    tabelle: "inquiry (sender_user_id)",
    beschreibung: "Von der Person gesendete Anfragen zu Inseraten.",
    personenbezogen: true,
    eigentuemer: "Person",
    behandlung: "ZURUECKGESTELLT_RECHTSENTSCHEID",
    begruendung: "sender_user_id wird auf NULL gesetzt; Name/E-Mail/Telefon der Anfrage bleiben stehen, weil sie im berechtigten Posteingang der angefragten Anbieterin liegen (Geschäftsvorgang der Empfängerin, nicht nur Eigentum der Absenderin). Kein Fristenentscheid getroffen (bindend)."
  },
  {
    schluessel: "service_lead",
    tabelle: "service_lead",
    beschreibung: "Anliegen der Person an FOURWALLS selbst (Verkauf, Vermietung, Bewertung, Verwaltung, Beratung).",
    personenbezogen: true,
    eigentuemer: "Person",
    behandlung: "ZURUECKGESTELLT_RECHTSENTSCHEID",
    begruendung: "user_id wird auf NULL gesetzt; Kontaktfelder bleiben, weil FOURWALLS als Geschäftspartnerin (nicht als blosse Plattform) daraus etwas schuldet oder ableitet. Aufbewahrungsfrist bereits vor dieser Migration als offen dokumentiert (0019 §44) — hier nicht neu entschieden."
  },
  {
    schluessel: "audit_log",
    tabelle: "audit_log",
    beschreibung: "Prüfspur von Statusänderungen und Verwaltungsvorgängen (Kennungen, keine Inhalte).",
    personenbezogen: false,
    eigentuemer: "Fourwalls",
    behandlung: "BLEIBT",
    begruendung: "Reine Prüfspur ohne Inhalte (0007: 'previous_state'/'new_state' sind Statuswerte, keine Nachrichtentexte). actor_user_id bleibt technisch gültig, weil app_user nicht gelöscht, sondern anonymisiert wird — kein toter Fremdschlüssel."
  },
  {
    schluessel: "mail_outbox_gesendet",
    tabelle: "mail_outbox (status = accepted)",
    beschreibung: "Bereits versandte Nachrichten an die Person.",
    personenbezogen: true,
    eigentuemer: "Person",
    behandlung: "ZURUECKGESTELLT_RECHTSENTSCHEID",
    begruendung: "Ein bereits zugestellter Versandbeleg wird nicht rückwirkend verändert. Kein Fristenentscheid getroffen (bindend)."
  },
  {
    schluessel: "mail_outbox_ungesendet",
    tabelle: "mail_outbox (status IN created/failed/abandoned)",
    beschreibung: "Noch nicht (erfolgreich) zugestellte Nachrichten an die Adresse der Person.",
    personenbezogen: true,
    eigentuemer: "Person",
    behandlung: "LOESCHEN",
    begruendung: "Eine Nachricht, die nie ankam, an eine Adresse zu senden, die es nicht mehr gibt, hat keinen Zweck (§9: 'nicht mehr versenden')."
  },
  {
    schluessel: "org_membership",
    tabelle: "org_membership",
    beschreibung: "Zugehörigkeit der Person zu Organisationen, mit Rolle.",
    personenbezogen: true,
    eigentuemer: "Organisation",
    behandlung: "BLEIBT_FREMDES_EIGENTUM",
    begruendung: "Teil der Teamstruktur der Organisation. is_active wird auf false gesetzt (deaktiviert, nicht gelöscht) — dieselbe Behandlung wie beim regulären Austritt (P5.7 §38); die Zeile bleibt als Beleg der früheren Zugehörigkeit."
  },
  {
    schluessel: "org_invitation",
    tabelle: "org_invitation (email = Adresse der Person, noch offen)",
    beschreibung: "Offene Einladungen einer Organisation an die Adresse der Person.",
    personenbezogen: true,
    eigentuemer: "Organisation",
    behandlung: "BLEIBT_FREMDES_EIGENTUM",
    begruendung: "revoked_at wird gesetzt (widerrufen) — dieselbe Wirkung wie ein manueller Widerruf durch die Organisation; die Zeile bleibt als Beleg."
  },
  {
    schluessel: "app_user",
    tabelle: "app_user",
    beschreibung: "Die Person selbst: Adresse, Anzeigename, Telefon, Rolle.",
    personenbezogen: true,
    eigentuemer: "Person",
    behandlung: "ANONYMISIEREN",
    begruendung:
      "Tombstone: email → 'geloescht+<uuid>@konto.geloescht.invalid', display_name → 'Gelöschtes Konto', phone → NULL, platform_role → 'user', deleted_at = now(). Die Zeile bleibt bestehen, weil audit_log, listing, inquiry, service_lead, org_membership u.a. per Fremdschlüssel auf sie zeigen — ein echtes Löschen würde diese Fremdschlüssel brechen oder erzwänge, ihrerseits Prüfspuren und fremdes Eigentum zu zerstören."
  }
];

export const findeDatenklasse = (schluessel: string): Datenklasse | undefined =>
  DATENKLASSEN.find(d => d.schluessel === schluessel);

/* ---------- Organisationsregeln (§10): alleinige Eigentümerschaft ---------- */

export interface OrgMitgliedschaftFuerLoeschung {
  orgId: string;
  orgName: string;
  /* Nur für die Warnung auf /konto/loeschen (Link zum Team) — die Prüfung
     selbst (alleinigeEigentuemerschaften) sieht das Feld nicht an. */
  orgSlug?: string;
  rolle: OrgRolle;
  /* Die Organisation selbst ist aktiv (is_active und nicht stillgelegt). */
  organisationAktiv: boolean;
  /* Gibt es — ausser der zu löschenden Person — eine weitere aktive Person
     mit der Rolle 'owner' in dieser Organisation? */
  weitereAktiveEigentuemerinVorhanden: boolean;
}

/* Organisationen, in denen die Person die EINZIGE aktive Besitzerin ist.
   Nicht leer → die Löschung muss blockiert werden (§10): die Person muss
   zuerst eine andere Person zur Besitzerin machen (bestehende Rollenvergabe,
   domain/orgrechte.ts:darfRolleVergeben erlaubt owner → owner) oder die
   Organisation stilllegen (server/organisationen.ts:stilllegen — bereits
   vorhanden, wird hier nur genutzt, nicht neu gebaut). */
export function alleinigeEigentuemerschaften(
  mitgliedschaften: OrgMitgliedschaftFuerLoeschung[]
): OrgMitgliedschaftFuerLoeschung[] {
  return mitgliedschaften.filter(
    m => m.organisationAktiv && m.rolle === "owner" && !m.weitereAktiveEigentuemerinVorhanden
  );
}

export const kontoLoeschungBlockiertDurchEigentum = (
  mitgliedschaften: OrgMitgliedschaftFuerLoeschung[]
): boolean => alleinigeEigentuemerschaften(mitgliedschaften).length > 0;

/* ---------- Klassifikation eines Inserats für die Löschung ---------- */

export type InseratLoeschBehandlung = "loeschen" | "zurueckstellen" | "fremdes_eigentum";

/* Zustände, in denen ein privates Inserat noch nie öffentlich sichtbar war
   (oder es durch Ablehnung nicht mehr ist) — dieselbe Liste wie
   domain/rechte.ts, hier bewusst dupliziert als Wortlaut (rein, ohne Import
   von serverseitigen Status-Konstanten), aber testbar gegen sie. */
const OHNE_OEFFENTLICHE_VERGANGENHEIT: Status[] = ["draft", "submitted", "in_review", "changes_required", "rejected"];

export function klassifiziereInserat(l: { orgId: string | null; status: Status }): InseratLoeschBehandlung {
  if (l.orgId) return "fremdes_eigentum";
  if (OHNE_OEFFENTLICHE_VERGANGENHEIT.includes(l.status)) return "loeschen";
  return "zurueckstellen";
}
