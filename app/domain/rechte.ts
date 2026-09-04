/* Rechte und Rollen — die eine Stelle, an der steht, wer was darf.

   Zwei Achsen, beide müssen zustimmen (P5.4 §12/§13):

     1. RECHT      Was darf diese Rolle überhaupt? (`darf()`)
     2. RESSOURCE  Gehört dieses Objekt der Person, und ist es im richtigen
                   Zustand? (`darfEntwurfBearbeiten()`, `darfEinreichen()`, …)

   Ein `isAdmin`-Schalter gibt es nicht. Eine Moderatorin darf die Warteschlange
   sehen — aber ihr eigenes Inserat trotzdem nicht selbst freigeben, weil die
   Ressourcenprüfung das gesondert verbietet.

   Diese Datei ist rein: keine Datenbank, kein Netz, keine Sitzung. Sie lässt
   sich ohne Server prüfen (tests/rechte.test.ts). Der Server ruft sie auf,
   nachdem er die Sitzung und das Objekt geladen hat — nie der Browser. */

export type Rolle = "user" | "staff" | "moderator" | "admin";

export const RECHTE = [
  /* Eigene Inserate */
  "CREATE_OWN_LISTING",
  "EDIT_OWN_DRAFT",
  "SUBMIT_OWN_LISTING",
  "VIEW_OWN_LISTINGS",
  "PREVIEW_OWN_LISTING",
  "WITHDRAW_OWN_LISTING",
  /* Moderation */
  "VIEW_MODERATION_QUEUE",
  "REVIEW_LISTING",
  "APPROVE_LISTING",
  "REQUEST_CHANGES",
  "REJECT_LISTING",
  "PUBLISH_LISTING",
  "PAUSE_PUBLISHED_LISTING"
] as const;
export type Recht = (typeof RECHTE)[number];

const EIGENE: Recht[] = ["CREATE_OWN_LISTING", "EDIT_OWN_DRAFT", "SUBMIT_OWN_LISTING", "VIEW_OWN_LISTINGS", "PREVIEW_OWN_LISTING", "WITHDRAW_OWN_LISTING"];
const MODERATION: Recht[] = ["VIEW_MODERATION_QUEUE", "REVIEW_LISTING", "APPROVE_LISTING", "REQUEST_CHANGES", "REJECT_LISTING", "PUBLISH_LISTING", "PAUSE_PUBLISHED_LISTING"];

/* Rollen sind Bündel von Rechten, nicht Fähigkeiten für sich.
   `staff` ist heute Fourwalls-Personal ohne Moderationsauftrag — die
   Herausgeber-Werkzeuge der Agenturen kommen später und erweitern diese
   Tabelle, nicht die Prüfstellen. */
export const ROLLE_RECHTE: Record<Rolle, readonly Recht[]> = {
  user: EIGENE,
  staff: EIGENE,
  moderator: [...EIGENE, ...MODERATION],
  admin: RECHTE
};

export const darf = (rolle: Rolle | null | undefined, recht: Recht): boolean =>
  !!rolle && ROLLE_RECHTE[rolle]?.includes(recht) === true;

/* ---------- Zustände des Inserats ---------- */
export type Status = "draft" | "submitted" | "in_review" | "changes_required" | "approved" | "published" | "paused" | "reserved" | "sold" | "rented" | "expired" | "archived" | "rejected";

/* Zustände, in denen die Eigentümerin ihren Entwurf selbst ändern darf.
   Sobald er in der Prüfung liegt, ist er aus der Hand gegeben. */
export const BEARBEITBAR: Status[] = ["draft", "changes_required", "rejected"];
/* Zustände, aus denen eingereicht werden darf. */
export const EINREICHBAR: Status[] = ["draft", "changes_required", "rejected"];
/* Zustände, die in der Moderationswarteschlange erscheinen. */
export const IN_PRUEFUNG: Status[] = ["submitted", "in_review"];
/* Öffentlich sichtbare Zustände (Spiegel der Sicht listing_public). */
export const OEFFENTLICH: Status[] = ["published", "reserved"];

export interface Inserat {
  ownerId: string | null;      // listing.published_by_user_id
  status: Status;
}
export interface Person {
  id: string;
  rolle: Rolle;
  emailBestaetigt: boolean;
}

/* ---------- Ressourcenentscheide ----------
   Jede Funktion beantwortet genau eine Frage und nennt den Grund, wenn sie
   verneint. Der Grund geht in die Antwort (NOT_FOUND oder FORBIDDEN) und ins
   Protokoll — nie eine SQL-Meldung. */
export type Entscheid = { erlaubt: true } | { erlaubt: false; grund: Grund };
export type Grund = "keine-sitzung" | "kein-recht" | "nicht-eigentuemer" | "falscher-zustand" | "email-unbestaetigt" | "eigenes-inserat";
const ja: Entscheid = { erlaubt: true };
const nein = (grund: Grund): Entscheid => ({ erlaubt: false, grund });

export const istEigentuemer = (p: Person, l: Inserat) => l.ownerId != null && l.ownerId === p.id;

/* Lesen und bearbeiten darf die Eigentümerin — und niemand sonst, auch keine
   Moderatorin: die sieht den Entwurf erst, wenn er eingereicht ist. */
export function darfEntwurfSehen(p: Person, l: Inserat): Entscheid {
  if (istEigentuemer(p, l)) return ja;
  if (darf(p.rolle, "REVIEW_LISTING") && (IN_PRUEFUNG.includes(l.status) || l.status === "approved")) return ja;
  return nein("nicht-eigentuemer");
}
export function darfEntwurfBearbeiten(p: Person, l: Inserat): Entscheid {
  if (!darf(p.rolle, "EDIT_OWN_DRAFT")) return nein("kein-recht");
  if (!istEigentuemer(p, l)) return nein("nicht-eigentuemer");
  if (!BEARBEITBAR.includes(l.status)) return nein("falscher-zustand");
  return ja;
}
/* Einreichen verlangt zusätzlich eine bestätigte E-Mail (§16): Entwerfen darf
   jede angemeldete Person sofort, in den Marktplatz kommt nur, wer erreichbar
   ist — die Anfragen der Interessierten gehen an diese Adresse. */
export function darfEinreichen(p: Person, l: Inserat): Entscheid {
  if (!darf(p.rolle, "SUBMIT_OWN_LISTING")) return nein("kein-recht");
  if (!istEigentuemer(p, l)) return nein("nicht-eigentuemer");
  if (!EINREICHBAR.includes(l.status)) return nein("falscher-zustand");
  if (!p.emailBestaetigt) return nein("email-unbestaetigt");
  return ja;
}
export function darfZurueckziehen(p: Person, l: Inserat): Entscheid {
  if (!darf(p.rolle, "WITHDRAW_OWN_LISTING")) return nein("kein-recht");
  if (!istEigentuemer(p, l)) return nein("nicht-eigentuemer");
  if (l.status === "archived") return nein("falscher-zustand");
  return ja;
}

/* Moderation: Recht UND passender Zustand UND nicht das eigene Inserat.
   Die letzte Bedingung ist der Grund, warum Rollen allein nicht genügen — eine
   Moderatorin, die selbst inseriert, darf sich nicht selbst freigeben (§74). */
function moderiert(p: Person, l: Inserat, recht: Recht, zustaende: Status[]): Entscheid {
  if (!darf(p.rolle, recht)) return nein("kein-recht");
  if (istEigentuemer(p, l)) return nein("eigenes-inserat");
  if (!zustaende.includes(l.status)) return nein("falscher-zustand");
  return ja;
}
export const darfPruefen = (p: Person, l: Inserat) => moderiert(p, l, "REVIEW_LISTING", IN_PRUEFUNG);
export const darfFreigeben = (p: Person, l: Inserat) => moderiert(p, l, "APPROVE_LISTING", IN_PRUEFUNG);
export const darfAenderungVerlangen = (p: Person, l: Inserat) => moderiert(p, l, "REQUEST_CHANGES", IN_PRUEFUNG);
export const darfAblehnen = (p: Person, l: Inserat) => moderiert(p, l, "REJECT_LISTING", IN_PRUEFUNG);
export const darfVeroeffentlichen = (p: Person, l: Inserat) => moderiert(p, l, "PUBLISH_LISTING", ["approved"]);
export const darfPausieren = (p: Person, l: Inserat) => moderiert(p, l, "PAUSE_PUBLISHED_LISTING", ["published", "reserved"]);

/* Vorschau eines unveröffentlichten Inserats: Eigentümerin immer, Moderation
   nur während der Prüfung. Niemand sonst, angemeldet oder nicht (§37). */
export function darfVorschauSehen(p: Person | null, l: Inserat): Entscheid {
  if (!p) return nein("keine-sitzung");
  return darfEntwurfSehen(p, l);
}
