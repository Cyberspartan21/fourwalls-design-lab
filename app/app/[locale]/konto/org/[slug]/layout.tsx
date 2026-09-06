import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { istLocale, DEFAULT_LOCALE, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { verlangeOrgRecht, meineOrganisationen } from "@/server/org-kontext";
import { asAppError } from "@/lib/errors";
import { OrgRahmen } from "@/components/org/org-rahmen";
import { NOINDEX } from "@/lib/seo";

/* Der gemeinsame Rahmen jeder /konto/org/<slug>-Seite (P5.7 §7).

   Die Organisation kommt aus dem Pfad — aber ob die Person dort Mitglied
   ist, entscheidet ausschliesslich verlangeOrgRecht() frisch aus der
   Datenbank. Ein fremder oder unbekannter Slug führt zu notFound() (§15). */
export const dynamic = "force-dynamic";

/* NOINDEX für alle /konto/org/<slug>-Unterseiten (P5.9 Phase B) — ein Aufruf
   hier statt einer erneuten Datenbankabfrage je Unterseite. Titel = der
   Organisationsname, dieselbe Überschrift, die OrgRahmen als h2 zeigt.
   Kein notFound()/redirect() hier: eine fehlgeschlagene Berechtigungsprüfung
   in generateMetadata soll nie vor dem eigentlichen Seitenaufbau greifen —
   im schlimmsten Fall bleibt es beim generischen "Fourwalls"-Titel. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale: roh, slug } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  if (!s) return NOINDEX;
  try {
    const kontext = await verlangeOrgRecht(s.person, slug, "VIEW_ORG_LISTINGS");
    return { ...NOINDEX, title: kontext.org.displayName };
  } catch {
    return NOINDEX;
  }
}

export default async function OrgLayout({ children, params }:
  { children: React.ReactNode; params: Promise<{ locale: string; slug: string }> }) {
  const { locale: roh, slug } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  if (!s) redirect(`/${locale}/konto/anmelden?weiter=${encodeURIComponent(`/${locale}/konto/org/${slug}`)}`);

  let kontext;
  try {
    kontext = await verlangeOrgRecht(s.person, slug, "VIEW_ORG_LISTINGS");
  } catch (e) {
    if (asAppError(e).code === "NOT_FOUND") notFound();
    throw e;
  }

  const meine = await meineOrganisationen(s.person.id);

  return (
    <OrgRahmen locale={locale} org={kontext.org} meine={meine}>
      {children}
    </OrgRahmen>
  );
}
