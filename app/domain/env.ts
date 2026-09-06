import { z } from "zod";

/* Das Umgebungsschema — rein (kein process.env, kein fs, kein „server-only“),
   damit es sich sowohl aus server/env.ts (liest process.env, cached, wirft
   beim Start) als auch aus Tests (node --test, ruft EnvSchema.safeParse(obj)
   mit einem selbstgebauten Objekt auf) verwenden lässt. server/env.ts trägt
   „server-only“ und ist deshalb unter node --test nicht importierbar — die
   Prüflogik selbst gehört daher hierher, nicht dorthin (siehe tests/env.test.ts).

   Grundsatz bleibt: ausserhalb der Entwicklung darf nichts stillschweigend
   auf einen Entwicklungswert zurückfallen. Fehlt in Staging oder Produktion
   etwas, das dort Pflicht ist, scheitert die Prüfung. */

const Umgebung = z.enum(["development", "test", "staging", "production"]);

/* Bekannte Nicht-Geheimnisse, die zufällig die Mindestlänge erfüllen —
   Build- und CI-Platzhalter dürfen nie als echtes APP_SECRET durchgehen. */
const APP_SECRET_BEISPIELWERTE = new Set([
  "build-stufe-platzhalter-keine-echten-daten-00",
  "ci-only-nicht-geheim-0000000000000000"
]);

const istBeispielAdresse = (adresse: string) => adresse.toLowerCase().endsWith(".example");

export const EnvSchema = z.object({
  APP_ENV: Umgebung.default("development"),
  DATABASE_URL: z.string().url().refine(u => u.startsWith("postgres://") || u.startsWith("postgresql://"), "DATABASE_URL muss eine Postgres-Adresse sein"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  MAIL_PROVIDER: z.enum(["dev", "smtp"]).default("dev"),
  MAIL_FROM: z.string().email().default("noreply@fourwalls.example"),
  MAIL_DEV_SINK: z.string().email().default("dev-sink@fourwalls.example"),
  /* Ablageordner der Entwicklungs-Mailsenke — absolut angeben, wenn mehrere Prozesse (Dev-Server, Prod-Build im Standalone-Ordner) dieselbe Outbox bedienen; sonst landen Mails im jeweiligen Arbeitsverzeichnis. */
  MAIL_DEV_DIR: z.string().min(1).optional(),
  /* Posteingang für Anliegen an FOURWALLS (P5.8 §20/§21): Geschäftskonfiguration,
     keine Personenadresse im Code. In Entwicklung/Test fällt sie auf MAIL_DEV_SINK
     zurück; in Staging/Produktion ist sie Pflicht. */
  SERVICE_LEAD_INBOX: z.string().email().optional(),
  APP_SECRET: z.string().min(32).optional(),

  /* Demo-Inhalte-Tor (P5.10 §34/§35): in Entwicklung/Test/Staging optional
     (Default „an“), in Produktion ausdrücklich Pflicht — kein stiller Fall
     auf „an“ oder „aus“. */
  DEMO_INHALTE: z.enum(["an", "aus"]).optional(),

  /* ---------- S3-kompatibler Objektspeicher (STORAGE_PROVIDER=s3) ----------
     Zwei Behälter, eine Grenze: PRIVATE hält Originale und alles Unveröffentlichte
     (nur über die Anwendung erreichbar), PUBLIC hält die Ableitungen
     veröffentlichter Bilder. Der Anbieter (Exoscale SOS, MinIO, …) steckt nur
     in Endpunkt und Zugangsdaten — die Anwendung kennt ihn nicht (P5.5 §5). */
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().min(1).default("ch-gva-2"),
  S3_BUCKET_PRIVATE: z.string().min(3).optional(),
  S3_BUCKET_PUBLIC: z.string().min(3).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  /* MinIO und einige Endpunkte brauchen Pfadadressierung statt Subdomain. */
  S3_FORCE_PATH_STYLE: z.enum(["ja", "nein"]).default("nein"),
  /* Öffentliche Basisadresse der Ableitungen (z. B. https://<bucket>.sos-ch-gva-2.exo.io);
     fehlt sie, wird sie aus Endpunkt und Behälter gebildet. */
  S3_PUBLIC_BASE_URL: z.string().url().optional(),

  /* ---------- Authentifizierter SMTP-Versand (MAIL_PROVIDER=smtp) ---------- */
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  /* 587 = STARTTLS (Standard), 465 = implizites TLS. Unverschlüsselt gibt es nicht. */
  SMTP_TLS: z.enum(["starttls", "tls"]).default("starttls"),
  /* Zertifikat prüfen. «nein» ist nur in der Entwicklung erlaubt (Mail-Attrappe
     mit selbstsigniertem Zertifikat) — nie draussen. */
  SMTP_VERIFY_CERT: z.enum(["ja", "nein"]).default("ja"),

  /* ---------- Staging-Zugangsschleuse (P5.5 §35) ----------
     Zusätzlich zur Anmeldung der Anwendung: HTTP-Basic vor allem, was nicht
     Gesundheitsprüfung ist. In Staging Pflicht, in Produktion verboten. */
  STAGING_GATE_USER: z.string().min(1).optional(),
  STAGING_GATE_PASSWORD: z.string().min(16).optional(),

  /* ---------- Hintergrundarbeit ---------- */
  OUTBOX_INTERVAL_MS: z.coerce.number().int().min(1000).max(600000).default(15000),
  /* Suchabo-Alarmprüfung (P5.6) — eigenes Intervall neben der Outbox. */
  ALERT_INTERVAL_MS: z.coerce.number().int().min(5000).max(3_600_000).default(30000)
}).superRefine((e, ctx) => {
  const fehlt = (pfad: string, meldung: string) => ctx.addIssue({ code: "custom", path: [pfad], message: meldung });
  const scharf = e.APP_ENV === "staging" || e.APP_ENV === "production";

  /* Anbieter, die gewählt sind, brauchen ihre Zugangsdaten — in jeder Umgebung. */
  if (e.STORAGE_PROVIDER === "s3") {
    for (const k of ["S3_ENDPOINT", "S3_BUCKET_PRIVATE", "S3_BUCKET_PUBLIC", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const)
      if (!e[k]) fehlt(k, `${k} ist bei STORAGE_PROVIDER=s3 Pflicht`);
    if (e.S3_BUCKET_PRIVATE && e.S3_BUCKET_PRIVATE === e.S3_BUCKET_PUBLIC) fehlt("S3_BUCKET_PUBLIC", "privater und öffentlicher Behälter müssen verschieden sein");
  }
  if (e.MAIL_PROVIDER === "smtp") {
    for (const k of ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"] as const)
      if (!e[k]) fehlt(k, `${k} ist bei MAIL_PROVIDER=smtp Pflicht`);
  }
  if (e.SMTP_VERIFY_CERT === "nein" && e.APP_ENV !== "development") fehlt("SMTP_VERIFY_CERT", "Zertifikatsprüfung darf nur in der Entwicklung aus sein");

  /* Demo-Inhalte: nur in Produktion ein Startfehler, wenn nicht ausdrücklich gesetzt. */
  if (e.APP_ENV === "production" && !e.DEMO_INHALTE) fehlt("DEMO_INHALTE", "DEMO_INHALTE muss in production explizit an oder aus sein");

  if (!scharf) return;
  /* Fail closed: was in Staging/Produktion fehlt, ist ein Startfehler. */
  if (!e.APP_SECRET) fehlt("APP_SECRET", `APP_SECRET ist in ${e.APP_ENV} Pflicht`);
  if (e.APP_SECRET && APP_SECRET_BEISPIELWERTE.has(e.APP_SECRET)) fehlt("APP_SECRET", `APP_SECRET ist in ${e.APP_ENV} ein bekannter Build-/CI-Platzhalter, kein Geheimnis`);
  if (e.STORAGE_PROVIDER === "local") fehlt("STORAGE_PROVIDER", `Der lokale Speicher ist in ${e.APP_ENV} nicht erlaubt`);
  if (e.MAIL_PROVIDER === "dev") fehlt("MAIL_PROVIDER", `Der Entwicklungs-Mailversand ist in ${e.APP_ENV} nicht erlaubt`);
  if (/localhost|127\.0\.0\.1/.test(e.DATABASE_URL)) fehlt("DATABASE_URL", `Eine lokale Datenbank ist in ${e.APP_ENV} nicht erlaubt`);
  if (!/sslmode=(require|verify-ca|verify-full)/.test(e.DATABASE_URL)) fehlt("DATABASE_URL", `In ${e.APP_ENV} muss die Datenbankverbindung verschlüsselt sein (sslmode=verify-full)`);
  if (!e.NEXT_PUBLIC_SITE_URL.startsWith("https://")) fehlt("NEXT_PUBLIC_SITE_URL", "muss https sein");
  if (/localhost|127\.0\.0\.1/.test(e.NEXT_PUBLIC_SITE_URL)) fehlt("NEXT_PUBLIC_SITE_URL", `Eine lokale Adresse ist in ${e.APP_ENV} nicht erlaubt`);
  if (e.S3_ENDPOINT && !e.S3_ENDPOINT.startsWith("https://")) fehlt("S3_ENDPOINT", "muss https sein");
  if (!e.SERVICE_LEAD_INBOX) fehlt("SERVICE_LEAD_INBOX", `In ${e.APP_ENV} braucht es einen Posteingang für Anliegen (SERVICE_LEAD_INBOX)`);
  if (e.SERVICE_LEAD_INBOX && istBeispielAdresse(e.SERVICE_LEAD_INBOX)) fehlt("SERVICE_LEAD_INBOX", `In ${e.APP_ENV} darf der Posteingang keine Beispieldomäne (.example) sein`);
  if (istBeispielAdresse(e.MAIL_FROM)) fehlt("MAIL_FROM", `In ${e.APP_ENV} darf die Absenderadresse keine Beispieldomäne (.example) sein`);
  if (e.APP_ENV === "staging" && (!e.STAGING_GATE_USER || !e.STAGING_GATE_PASSWORD)) fehlt("STAGING_GATE_USER", "Staging braucht die Zugangsschleuse (STAGING_GATE_USER/STAGING_GATE_PASSWORD)");
  if (e.APP_ENV === "production" && (e.STAGING_GATE_USER || e.STAGING_GATE_PASSWORD)) fehlt("STAGING_GATE_USER", "Die Staging-Schleuse gehört nicht in die Produktion");
});

export type Env = z.infer<typeof EnvSchema>;

/* Bequemlichkeit für Tests: liefert entweder die geprüften Daten oder die
   Fehlermeldungen als Text — ohne je process.env zu berühren oder zu mutieren. */
export function pruefe(obj: Record<string, unknown>): { ok: true; daten: Env } | { ok: false; fehler: string[] } {
  const ergebnis = EnvSchema.safeParse(obj);
  if (ergebnis.success) return { ok: true, daten: ergebnis.data };
  return { ok: false, fehler: ergebnis.error.issues.map(i => `${i.path.join(".")}: ${i.message}`) };
}
