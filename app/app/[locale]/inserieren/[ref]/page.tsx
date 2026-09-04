import { notFound, redirect } from "next/navigation";
import { istLocale, DEFAULT_LOCALE, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { entwurfLesen, type EntwurfZeile } from "@/server/entwuerfe";
import { AssistentSeite } from "../assistent-seite";
import { asAppError } from "@/lib/errors";
import type { Person } from "@/domain/rechte";

export const dynamic = "force-dynamic";

/* Laden und Rechteentscheid getrennt vom Markup: ein Fehler beim Laden ist
   eine Antwort (404), kein abgefangener Renderfehler. */
async function lesenOderNull(person: Person, publicRef: string): Promise<EntwurfZeile | null> {
  try { return await entwurfLesen(person, publicRef); }
  catch (e) { if (asAppError(e).code === "NOT_FOUND") return null; throw e; }
}

export default async function EntwurfBearbeiten({ params }: { params: Promise<{ locale: string; ref: string }> }) {
  const { locale: roh, ref } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  if (!s) redirect(`/${locale}/konto/anmelden?weiter=${encodeURIComponent(`/${locale}/inserieren/${ref}`)}`);

  const e = await lesenOderNull(s.person, ref.toUpperCase());
  if (!e) notFound();
  /* Wer nicht mehr bearbeiten darf, sieht die Vorschau statt eines Formulars,
     das nichts mehr speichern könnte. */
  if (!["draft", "changes_required", "rejected"].includes(e.status)) redirect(`/${locale}/vorschau/${ref}`);

  return <AssistentSeite locale={locale} start={{
    publicRef: e.publicRef, version: e.version, daten: e.daten, status: e.status,
    rueckmeldung: e.rueckmeldung ? { nachricht: e.rueckmeldung.nachricht, grund: e.rueckmeldung.grund } : null
  }} />;
}
