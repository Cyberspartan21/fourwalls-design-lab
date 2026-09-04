import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "./auth";
import { sql } from "./db";
import { AppError } from "@/lib/errors";
import { darf, type Person, type Recht, type Rolle } from "@/domain/rechte";

/* Die Sitzung — die einzige Stelle, die beantwortet, wer gerade handelt.

   Zwei Regeln, die hier durchgesetzt werden:

   1. Rolle und Bestätigungsstand kommen aus der Datenbank, nie aus dem Cookie
      und nie aus einem Formular. Better Auth prüft die Sitzung; wir lesen
      danach `platform_role` und `email_verified` frisch aus `app_user` (§8).
   2. Der Proxy leitet nur um. Jede geschützte Seite, Aktion und Route ruft
      `verlangeSitzung()` oder `verlangeRecht()` selbst auf — ein vorhandenes
      Cookie ist keine Erlaubnis (§10).

   `cache()` fasst mehrere Aufrufe innerhalb einer Anfrage zusammen, damit eine
   Seite die Sitzung nicht dreimal lädt. Über Anfragen hinweg wird nichts
   behalten. */

export interface Sitzung {
  person: Person;
  email: string;
  name: string;
  sitzungId: string;
}

export const sitzung = cache(async (): Promise<Sitzung | null> => {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s?.user?.id) return null;
  /* Frisch aus der Datenbank: eine Rolle, die sich seit dem Anmelden geändert
     hat, gilt sofort — und eine gelöschte Person hat keine Sitzung mehr. */
  const z = await sql`
    SELECT id, email, display_name, platform_role, email_verified
      FROM app_user WHERE id = ${s.user.id} AND deleted_at IS NULL LIMIT 1`;
  const u = z[0];
  if (!u) return null;
  return {
    person: { id: String(u.id), rolle: u.platform_role as Rolle, emailBestaetigt: Boolean(u.email_verified) },
    email: String(u.email ?? ""),
    name: String(u.display_name ?? ""),
    sitzungId: String(s.session.id)
  };
});

/* Angemeldet sein — sonst 401. */
export async function verlangeSitzung(): Promise<Sitzung> {
  const s = await sitzung();
  if (!s) throw new AppError("UNAUTHORIZED", "Bitte melden Sie sich an");
  return s;
}

/* Angemeldet sein UND ein Recht haben — sonst 401 bzw. 403.
   Das Recht allein genügt nie für ein fremdes Objekt: die Ressourcenprüfung
   aus domain/rechte.ts kommt zusätzlich, nachdem das Objekt geladen ist. */
export async function verlangeRecht(recht: Recht): Promise<Sitzung> {
  const s = await verlangeSitzung();
  if (!darf(s.person.rolle, recht)) throw new AppError("FORBIDDEN", "Dafür fehlt Ihnen die Berechtigung");
  return s;
}

/* Für Seiten, die je nach Anmeldung anders aussehen, aber keine verlangen. */
export const personOderNull = async (): Promise<Person | null> => (await sitzung())?.person ?? null;
