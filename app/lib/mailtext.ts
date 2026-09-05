import type { MailArt } from "../services/mail";

/* Mail-Texte je Sprache und Art — getrennt von i18n/index.ts, damit die
   Mail-Nachrichtendateien nie ins Client-Bundle gelangen. Dieser Helfer wird
   ausschliesslich von serverseitigem Code importiert (server/, services/) —
   nie von einer Client-Komponente. Dieselben vier Sprachen wie i18n/index.ts,
   Rückfall auf Deutsch bei unbekanntem Schlüssel. */

import de from "../i18n/messages/de/mail.json" with { type: "json" };
import fr from "../i18n/messages/fr/mail.json" with { type: "json" };
import it from "../i18n/messages/it/mail.json" with { type: "json" };
import en from "../i18n/messages/en/mail.json" with { type: "json" };

type MailLocale = "de" | "fr" | "it" | "en";
interface Vorlage { betreff: string; text: string }
type Katalog = Record<MailArt, Vorlage>;

const KATALOGE: Record<MailLocale, Katalog> = { de, fr, it, en } as Record<MailLocale, Katalog>;

export interface Werte {
  name?: string;
  url?: string;
  titel?: string;
  nachricht?: string;
  referenz?: string;
  label?: string;
  anzahl?: string;
  treffer?: string;
  abmeldeUrl?: string;
  org?: string;
  rolle?: string;
  ablauf?: string;
}

function ersetzen(vorlage: string, werte: Werte): string {
  return vorlage
    .replaceAll("{name}", werte.name ?? "")
    .replaceAll("{url}", werte.url ?? "")
    .replaceAll("{titel}", werte.titel ?? "")
    .replaceAll("{nachricht}", werte.nachricht ?? "")
    .replaceAll("{referenz}", werte.referenz ?? "")
    .replaceAll("{label}", werte.label ?? "")
    .replaceAll("{anzahl}", werte.anzahl ?? "")
    .replaceAll("{treffer}", werte.treffer ?? "")
    .replaceAll("{abmeldeUrl}", werte.abmeldeUrl ?? "")
    .replaceAll("{org}", werte.org ?? "")
    .replaceAll("{rolle}", werte.rolle ?? "")
    .replaceAll("{ablauf}", werte.ablauf ?? "");
}

/* Betreff und Text für eine Mailart in einer Sprache, mit eingesetzten Werten.
   Unbekannte Sprache fällt auf Deutsch zurück — wie i18n/index.ts. */
export function mailtext(art: MailArt, locale: string, werte: Werte = {}): { betreff: string; text: string } {
  const katalog = KATALOGE[(locale as MailLocale)] ?? KATALOGE.de;
  const vorlage = katalog[art];
  return { betreff: ersetzen(vorlage.betreff, werte), text: ersetzen(vorlage.text, werte) };
}
