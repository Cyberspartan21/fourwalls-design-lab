"use client";
import { createAuthClient } from "better-auth/react";

/* Der Auth-Client im Browser. Er spricht mit /api/auth/* und hält keine
   Geheimnisse: die Sitzung steht in einem HttpOnly-Cookie, das JavaScript
   nicht lesen kann (§9). Was hier zurückkommt, ist Anzeigezustand — die
   Berechtigung entscheidet immer der Server (§10).

   Die Bibliothek baut ihre Aufrufe zur Laufzeit über einen Proxy; ohne die
   Server-Instanz als Typparameter kennt TypeScript sie nicht. Statt den
   Client zu `any` zu erklären, steht der genutzte Ausschnitt hier als
   Vertrag: was wir aufrufen und was zurückkommt. Passt die Bibliothek das
   an, bricht der Bau hier — und nicht erst im Browser. */

export interface AuthFehler { message?: string; code?: string; status?: number }
export type AuthAntwort = { error?: AuthFehler | null };

interface FourwallsAuthClient {
  signIn: { email(daten: { email: string; password: string; rememberMe?: boolean }): Promise<AuthAntwort> };
  signUp: { email(daten: { email: string; password: string; name: string }): Promise<AuthAntwort> };
  signOut(): Promise<AuthAntwort>;
  forgetPassword(daten: { email: string; redirectTo: string }): Promise<AuthAntwort>;
  resetPassword(daten: { newPassword: string; token: string }): Promise<AuthAntwort>;
  sendVerificationEmail(daten: { email: string; callbackURL?: string }): Promise<AuthAntwort>;
}

export const authClient = createAuthClient() as unknown as FourwallsAuthClient;
