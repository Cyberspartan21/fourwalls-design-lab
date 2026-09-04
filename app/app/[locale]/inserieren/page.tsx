import { redirect } from "next/navigation";
import { istLocale, DEFAULT_LOCALE, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { meineInserate } from "@/server/entwuerfe";
import { AssistentSeite } from "./assistent-seite";
import { VorabUebernahme } from "@/components/inserieren/uebernahme";

/* Einstieg «Inserat erstellen».

   Ohne Konto beginnt der Assistent im Browser (§22). Mit Konto führt der Weg
   in einen offenen Entwurf oder legt einen neuen an — und übernimmt dabei,
   was vorher schon eingegeben wurde (§23). */
export const dynamic = "force-dynamic";

export default async function Inserieren({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  if (!s) return <AssistentSeite locale={locale} start={null} />;

  /* Angemeldet: den zuletzt bearbeiteten offenen Entwurf weiterführen. */
  const meine = await meineInserate(s.person);
  const offen = meine.find(i => i.status === "draft" || i.status === "changes_required");
  if (offen) redirect(`/${locale}/inserieren/${offen.publicRef.toLowerCase()}`);
  /* Sonst: einen neuen anlegen — im Browser, damit der vorab eingegebene
     Stand aus dem sessionStorage mitgeht. */
  return <VorabUebernahme locale={locale} />;
}
