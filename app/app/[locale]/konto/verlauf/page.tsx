import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { istLocale, uebersetzer, DEFAULT_LOCALE, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { listeVerlauf } from "@/server/verlauf";
import { treffernachRefs } from "@/server/favoriten";
import { woerter } from "@/components/marktplatz/labels";
import { KontoRahmen } from "../kopfzeile";
import { VerlaufListe } from "@/components/verlauf-liste";
import { NOINDEX } from "@/lib/seo";

/* Zuletzt angesehen — geräteübergreifend, sobald ein Konto besteht.
   Anonym bleibt der Verlauf im Browser (components/verlauf.ts); dafür gibt
   es keine Kontoseite, weil kein Konto besteht (§29). */
export const dynamic = "force-dynamic";

/* NOINDEX (Konto, P5.9 Phase B). */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  return { ...NOINDEX, title: uebersetzer(locale)("vl_titel") };
}

export default async function KontoVerlauf({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  if (!s) redirect(`/${locale}/konto/anmelden?weiter=${encodeURIComponent(`/${locale}/konto/verlauf`)}`);
  const t = uebersetzer(locale);
  const refs = await listeVerlauf(s.person.id);
  const treffer = await treffernachRefs(refs);

  return (
    <KontoRahmen locale={locale} titel={t("vl_titel")} breit nav aktiv="verlauf">
      {treffer.length === 0
        ? <p style={{ color: "var(--leise)", marginTop: 16 }}>{t("vl_leer")}</p>
        : <VerlaufListe treffer={treffer} w={woerter(t)} locale={locale} />}
    </KontoRahmen>
  );
}
