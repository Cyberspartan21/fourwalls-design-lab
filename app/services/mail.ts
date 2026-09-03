import "server-only";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { env } from "@/server/env";
import { log } from "@/lib/log";

/* E-Mail hinter einer Schnittstelle.

   Was «Erfolg» hier bedeutet, ist genau festgelegt: Die Anwendung hat die
   Nachricht ANGENOMMEN und dem Versand übergeben. Nicht: zugestellt. Die
   Oberfläche darf nach einer Anfrage sagen «Anfrage angenommen» — nicht
   «E-Mail versendet».

   Entwicklung: DevMailProvider schreibt jede Nachricht als Datei nach
   var/mail/ und ins Protokoll. Es verlässt nichts den Rechner. env.ts
   verweigert diesen Anbieter ausserhalb der Entwicklung. */

export interface Nachricht {
  an: string;
  betreff: string;
  text: string;
  /* Bezug für die Nachvollziehbarkeit, nie für den Inhalt. */
  bezug?: { art: string; kennung: string };
}

export interface MailProvider {
  readonly name: string;
  /* Liefert eine Annahmekennung. Wirft, wenn die Übergabe scheitert. */
  senden(n: Nachricht): Promise<{ angenommen: true; kennung: string }>;
}

class DevMailProvider implements MailProvider {
  readonly name = "dev";
  private readonly ordner = join(process.cwd(), "var", "mail");

  async senden(n: Nachricht) {
    const kennung = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    mkdirSync(this.ordner, { recursive: true });
    writeFileSync(join(this.ordner, kennung + ".json"),
      JSON.stringify({ kennung, zeit: new Date().toISOString(), von: env().MAIL_FROM, ...n }, null, 2));
    /* Ins Protokoll nur Empfänger-Domain und Bezug — nicht der Text. */
    log.info("mail.dev.abgelegt", { kennung, anDomain: n.an.split("@")[1] ?? "?", bezugArt: n.bezug?.art ?? null, bezug: n.bezug?.kennung ?? null });
    return { angenommen: true as const, kennung };
  }
}

let instanz: MailProvider | null = null;
export function mail(): MailProvider {
  if (instanz) return instanz;
  if (env().MAIL_PROVIDER === "dev") instanz = new DevMailProvider();
  else throw new Error("Der produktive Mailversand ist in P5.2 noch nicht angebunden");
  return instanz;
}
