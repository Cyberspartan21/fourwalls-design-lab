import "server-only";
import nodemailer from "nodemailer";
import { env } from "@/server/env";
import type { MailProvider, Nachricht } from "@/services/mail";

/* Echter Versand über authentifizierten SMTP.

   STARTTLS ist Pflicht (SMTP_TLS=starttls, Standardfall) — es gibt keinen
   Rückfall auf Klartext. `secure: true` (implizites TLS, Port 465) ist die
   einzige Alternative (SMTP_TLS=tls). Das Zertifikat wird geprüft, ausser
   SMTP_VERIFY_CERT=nein — das erlaubt env.ts ohnehin nur in der Entwicklung.

   Ein Transport je Prozess: der Verbindungsaufbau (und ggf. das Pooling) soll
   nicht bei jeder Nachricht neu passieren. */

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function holeTransport() {
  if (transport) return transport;
  const e = env();
  /* env.ts verlangt diese drei Werte, sobald MAIL_PROVIDER=smtp — hier nur
     die Typprüfung nachvollzogen, kein neuer Zwang. */
  if (!e.SMTP_HOST || !e.SMTP_USER || !e.SMTP_PASSWORD) {
    throw new Error("SMTP-Zugangsdaten fehlen (SMTP_HOST/SMTP_USER/SMTP_PASSWORD)");
  }
  transport = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_TLS === "tls",
    requireTLS: e.SMTP_TLS === "starttls",
    auth: { user: e.SMTP_USER, pass: e.SMTP_PASSWORD },
    tls: { rejectUnauthorized: e.SMTP_VERIFY_CERT === "ja", minVersion: "TLSv1.2" }
  });
  return transport;
}

export class SmtpMailProvider implements MailProvider {
  readonly name = "smtp";

  async senden(n: Nachricht): Promise<{ angenommen: true; kennung: string }> {
    const info = await holeTransport().sendMail({
      from: env().MAIL_FROM,
      to: n.an,
      subject: n.betreff,
      text: n.text
    });
    return { angenommen: true, kennung: String(info.messageId) };
  }

  /* Verbindungs- und Anmeldeprüfung, ohne eine Nachricht zu senden. */
  async pruefen(): Promise<true> {
    await holeTransport().verify();
    return true;
  }
}
