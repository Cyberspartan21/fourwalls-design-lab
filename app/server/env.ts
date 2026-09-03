import "server-only";
import { z } from "zod";

/* Alle Umgebungsvariablen an einer Stelle, beim Start geprüft.
   Kein process.env.X irgendwo sonst in der Anwendung.

   Grundsatz: Ausserhalb der Entwicklung darf nichts stillschweigend auf einen
   Entwicklungswert zurückfallen. Fehlt in Staging oder Produktion etwas, das
   dort Pflicht ist, startet die Anwendung nicht — lieber laut scheitern als
   leise mit falschen Zugängen laufen. */

const Umgebung = z.enum(["development", "test", "staging", "production"]);

const Schema = z.object({
  APP_ENV: Umgebung.default("development"),
  DATABASE_URL: z.string().url().refine(u => u.startsWith("postgres://") || u.startsWith("postgresql://"), "DATABASE_URL muss eine Postgres-Adresse sein"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  MAIL_PROVIDER: z.enum(["dev", "smtp"]).default("dev"),
  MAIL_FROM: z.string().email().default("noreply@fourwalls.example"),
  MAIL_DEV_SINK: z.string().email().default("dev-sink@fourwalls.example"),
  APP_SECRET: z.string().min(32).optional()
}).superRefine((e, ctx) => {
  const scharf = e.APP_ENV === "staging" || e.APP_ENV === "production";
  if (!scharf) return;
  /* Fail closed: was in Staging/Produktion fehlt, ist ein Startfehler. */
  if (!e.APP_SECRET) ctx.addIssue({ code: "custom", path: ["APP_SECRET"], message: `APP_SECRET ist in ${e.APP_ENV} Pflicht` });
  if (e.STORAGE_PROVIDER === "local") ctx.addIssue({ code: "custom", path: ["STORAGE_PROVIDER"], message: `Der lokale Speicher ist in ${e.APP_ENV} nicht erlaubt` });
  if (e.MAIL_PROVIDER === "dev") ctx.addIssue({ code: "custom", path: ["MAIL_PROVIDER"], message: `Der Entwicklungs-Mailversand ist in ${e.APP_ENV} nicht erlaubt` });
  if (/localhost|127\.0\.0\.1/.test(e.DATABASE_URL)) ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: `Eine lokale Datenbank ist in ${e.APP_ENV} nicht erlaubt` });
  if (!e.NEXT_PUBLIC_SITE_URL.startsWith("https://")) ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SITE_URL"], message: "muss https sein" });
});

export type Env = z.infer<typeof Schema>;

let geprueft: Env | null = null;

export function env(): Env {
  if (geprueft) return geprueft;
  const ergebnis = Schema.safeParse(process.env);
  if (!ergebnis.success) {
    const zeilen = ergebnis.error.issues.map(i => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    /* Absichtlich ohne die Werte selbst — die Meldung landet im Protokoll. */
    throw new Error(`Umgebung unvollständig oder ungültig:\n${zeilen}`);
  }
  geprueft = ergebnis.data;
  return geprueft;
}

export const istProduktion = () => env().APP_ENV === "production";
