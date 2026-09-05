import { redirect } from "next/navigation";
import { istLocale, uebersetzer, DEFAULT_LOCALE, PFAD, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { listeFavoriten, treffernachRefs } from "@/server/favoriten";
import { woerter } from "@/components/marktplatz/labels";
import { KontoRahmen } from "../kopfzeile";
import { FavoritenInit } from "@/components/konto/favoriten-init";
import { FavoritenListe } from "@/components/konto/favoriten-liste";

/* Meine Merkliste — geräteübergreifend, sobald ein Konto besteht.

   `listeFavoriten` liefert ALLE gemerkten Referenzen (auch nicht mehr
   öffentliche), `treffernachRefs` nur die aktuell öffentlichen Treffer dazu.
   Die Client-Komponente zeigt beide Fälle: Karte oder «nicht mehr verfügbar». */
export const dynamic = "force-dynamic";

export default async function KontoFavoriten({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  if (!s) redirect(`/${locale}/konto/anmelden?weiter=${encodeURIComponent(`/${locale}/konto/favoriten`)}`);
  const t = uebersetzer(locale);
  const refs = await listeFavoriten(s.person.id);
  const treffer = await treffernachRefs(refs);
  const p = PFAD[locale];

  return (
    <KontoRahmen locale={locale} titel={t("fv_titel")} breit>
      <FavoritenInit refs={refs} />
      <FavoritenListe
        refs={refs}
        treffer={treffer}
        locale={locale}
        w={woerter(t)}
        tx={{
          leer: t("fv_leer"),
          leerLink: t("fv_leerLink"),
          leerLinkHref: `/${locale}/${p.immobilien}/${p.kaufen}`,
          nichtVerfuegbar: t("fv_nichtVerfuegbar"),
          entfernen: t("fv_entfernen")
        }}
      />
    </KontoRahmen>
  );
}
