import "server-only";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";
import { env, istProduktion } from "./env";
import { sql } from "./db";
import { einreihenOhneTx } from "./outbox";
import { mailtext } from "@/lib/mailtext";
import { log } from "@/lib/log";

/* Authentifizierung — Better Auth 1.7.2, auf das FOURWALLS-Datenmodell gelegt.

   Der Entscheid (P5.4 §4/§5) und was er bedeutet:

   · Die Bibliothek besitzt Passwort-Hashing (scrypt), Sitzungen, E-Mail-
     Bestätigung und Passwort-Zurücksetzung. Wir schreiben davon nichts selbst
     (§7). Auth.js/NextAuth wäre die Alternative gewesen; es überlässt genau
     diese drei Dinge der Anwendung — das hätte Eigenbau-Kryptografie verlangt.
   · Die Bibliothek besitzt NICHT unser Datenmodell. `user` zeigt auf die
     bestehende Tabelle `app_user` aus P5.1; Rolle und Sprache sind
     Zusatzfelder mit `input: false` — kein Formular kann sie setzen (§66/§67).
     Die drei reinen Auth-Tabellen (Sitzung, Konto, Bestätigung) sind in
     Migration 0011 versioniert; zur Laufzeit ändert nichts das Schema (§6).
   · IDs erzeugt die Datenbank (`gen_random_uuid()`), nicht die Bibliothek —
     unsere Fremdschlüssel sind uuid.

   Der Pool hier ist der zweite Verbindungspool des Prozesses (postgres.js für
   die Fachlogik, pg für Better Auth). Klein gehalten; für eine Instanz
   unproblematisch, für den späteren Mehrinstanzbetrieb im Bericht vermerkt. */

const pool = new Pool({ connectionString: env().DATABASE_URL, max: 5, idleTimeoutMillis: 30_000 });

/* Die Adresse, an die Bestätigungs- und Zurücksetzungslinks zeigen. */
const basis = () => env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

/* Sprache der Empfängerin frisch aus der Datenbank — nicht aus dem
   Better-Auth-Nutzerobjekt, dessen Typ die Zusatzfelder nicht kennt. */
async function locale(userId: string): Promise<"de" | "fr" | "it" | "en"> {
  const z = await sql`SELECT locale FROM app_user WHERE id = ${userId}`;
  const l = z[0]?.locale;
  return l === "fr" || l === "it" || l === "en" ? l : "de";
}

export const auth = betterAuth({
  appName: "Fourwalls",
  baseURL: basis(),
  database: pool,
  secret: env().APP_SECRET ?? "entwicklung-nur-lokal-nicht-geheim",
  trustedOrigins: [basis()],

  /* ---------- Abbildung auf das bestehende Modell ---------- */
  user: {
    modelName: "app_user",
    fields: {
      name: "display_name",
      emailVerified: "email_verified",   // Boolean für die Bibliothek; der fachliche
      image: "image_url",                //   Zeitstempel email_verified_at folgt per Trigger
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    additionalFields: {
      /* Rolle und Sprache gehören der Anwendung. `input: false` heisst: kein
         Registrierungs- oder Profilformular kann sie mitschicken (§66). */
      platform_role: { type: "string", required: false, input: false, returned: true },
      locale: { type: "string", required: false, input: false, returned: true }
    },
    changeEmail: { enabled: false }
  },
  session: {
    modelName: "auth_session",
    fields: { userId: "user_id", expiresAt: "expires_at", createdAt: "created_at", updatedAt: "updated_at", ipAddress: "ip_address", userAgent: "user_agent" },
    /* Sieben Tage Gültigkeit, täglich verlängert, solange jemand da ist (§8). */
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    freshAge: 60 * 15
  },
  account: {
    modelName: "auth_account",
    fields: { userId: "user_id", accountId: "account_id", providerId: "provider_id", accessToken: "access_token", refreshToken: "refresh_token", idToken: "id_token", accessTokenExpiresAt: "access_token_expires_at", refreshTokenExpiresAt: "refresh_token_expires_at", createdAt: "created_at", updatedAt: "updated_at" }
  },
  verification: {
    modelName: "auth_verification",
    fields: { expiresAt: "expires_at", createdAt: "created_at", updatedAt: "updated_at" }
  },
  advanced: {
    database: { generateId: false },       // uuid-Vorgaben der Datenbank
    cookiePrefix: "fw",
    useSecureCookies: istProduktion(),
    defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" }
  },

  /* ---------- E-Mail und Passwort ---------- */
  emailAndPassword: {
    enabled: true,
    /* Anmelden ohne bestätigte Adresse ist erlaubt: entwerfen darf man sofort.
       Erst das Einreichen verlangt die Bestätigung — das prüft die Fachlogik
       (domain/rechte.ts), nicht die Bibliothek (§16). */
    requireEmailVerification: false,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    /* Nach der Registrierung nicht automatisch anmelden: so antwortet die
       Registrierung immer gleich, ob die Adresse schon vergeben ist oder nicht (§19). */
    autoSignIn: false,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword({ user, url }) {
      const l = await locale(user.id);
      const { betreff, text } = mailtext("password_reset", l, { name: user.name || user.email, url });
      await einreihenOhneTx({ an: user.email, betreff, text, locale: l, art: "password_reset", bezug: { art: "user", kennung: user.id } });
    }
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    async sendVerificationEmail({ user, url }) {
      const l = await locale(user.id);
      const { betreff, text } = mailtext("verification", l, { name: user.name || user.email, url });
      await einreihenOhneTx({ an: user.email, betreff, text, locale: l, art: "verification", bezug: { art: "user", kennung: user.id } });
    }
  },

  /* ---------- Missbrauchsschutz ----------
     Die Bibliothek zählt im Speicher dieses Prozesses. Das genügt für eine
     Instanz und ist als solches im Bericht vermerkt; verteilt braucht es
     denselben Zähler in Postgres oder Redis (§18). */
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 300, max: 8 },
      "/sign-up/email": { window: 3600, max: 5 },
      "/forget-password": { window: 3600, max: 5 },
      "/reset-password": { window: 3600, max: 8 },
      "/send-verification-email": { window: 3600, max: 5 }
    }
  },

  plugins: [nextCookies()],

  /* Sicherheitsrelevante Ereignisse ohne persönliche Daten (§71). */
  logger: {
    disabled: false,
    log: (stufe, nachricht) => {
      if (stufe === "error") log.error("auth", { nachricht: String(nachricht).slice(0, 200) });
      else if (stufe === "warn") log.warn("auth", { nachricht: String(nachricht).slice(0, 200) });
    }
  }
});

export type AuthSitzung = typeof auth.$Infer.Session;
