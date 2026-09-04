import { auth } from "@/server/auth";
import { toNextJsHandler } from "better-auth/next-js";

/* Alle Auth-Endpunkte der Bibliothek: Registrierung, Anmeldung, Abmeldung,
   Bestätigung, Passwort zurücksetzen. Herkunftsprüfung, Ratenbegrenzung und
   Cookie-Regeln stehen in server/auth.ts. */
export const { GET, POST } = toNextJsHandler(auth);
