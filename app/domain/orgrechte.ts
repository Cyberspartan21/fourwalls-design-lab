/* Rechte innerhalb einer Organisation — die eine Stelle, an der steht, was
   eine Rolle im Team darf (P5.7 §5/§6).

   Getrennt von domain/rechte.ts (Plattformrollen): Eine Person kann Besitzerin
   eines Maklerbüros sein und trotzdem keine Moderatorin — und umgekehrt. Kein
   Teamrecht führt je zu einem FOURWALLS-Recht (§6: «An agency admin must NOT
   gain FOURWALLS moderator rights»).

   Vier Rollen, bewusst wenige. Eine fünfte kommt erst, wenn eine echte
   Funktion sie braucht. Rein: keine Datenbank, keine Sitzung. */

export type OrgRolle = "owner" | "admin" | "agent" | "viewer";
export const ORG_ROLLEN: OrgRolle[] = ["owner", "admin", "agent", "viewer"];

export const ORG_RECHTE = [
  "MANAGE_ORGANIZATION",      // Stammdaten, Sprache, Stilllegen
  "MANAGE_MEMBERS",           // Einladen, Rollen ändern, Entfernen
  "MANAGE_PUBLISHER_PROFILE", // Öffentliches Profil, Logo
  "VIEW_ORG_LISTINGS",
  "CREATE_LISTING",
  "EDIT_ORG_LISTING",
  "SUBMIT_ORG_LISTING",
  "WITHDRAW_ORG_LISTING",
  "ASSIGN_LISTING",
  "VIEW_INQUIRIES",
  "IMPORT_LISTINGS"
] as const;
export type OrgRecht = (typeof ORG_RECHTE)[number];

const LESEN: OrgRecht[] = ["VIEW_ORG_LISTINGS", "VIEW_INQUIRIES"];
const ARBEITEN: OrgRecht[] = [...LESEN, "CREATE_LISTING", "EDIT_ORG_LISTING", "SUBMIT_ORG_LISTING", "WITHDRAW_ORG_LISTING"];
const FUEHREN: OrgRecht[] = [...ARBEITEN, "ASSIGN_LISTING", "MANAGE_MEMBERS", "MANAGE_PUBLISHER_PROFILE", "IMPORT_LISTINGS"];

export const ORG_ROLLE_RECHTE: Record<OrgRolle, readonly OrgRecht[]> = {
  viewer: LESEN,
  agent: ARBEITEN,
  admin: FUEHREN,
  owner: ORG_RECHTE
};

export const orgDarf = (rolle: OrgRolle | null | undefined, recht: OrgRecht): boolean =>
  !!rolle && ORG_ROLLE_RECHTE[rolle]?.includes(recht) === true;

/* Welche Rollen eine Person einer anderen geben darf: nie mehr als die eigene
   Stufe, und «owner» nur durch eine Besitzerin (§16/§17). */
export function darfRolleVergeben(eigene: OrgRolle, ziel: OrgRolle): boolean {
  if (!orgDarf(eigene, "MANAGE_MEMBERS")) return false;
  if (ziel === "owner") return eigene === "owner";
  return true;
}

/* Die aktive Zugehörigkeit einer Person zu einer Organisation — vom Server
   frisch aus org_membership geladen, nie aus dem Browser (§61/§62). */
export interface OrgMitglied {
  orgId: string;
  rolle: OrgRolle;
}
