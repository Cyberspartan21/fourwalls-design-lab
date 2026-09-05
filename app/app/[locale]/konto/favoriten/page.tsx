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
   Die Client-Komponente zeigt beide Fälle: Karte oder «nicht mehr verfügbar».

   Ohne Sitzung KEIN Redirect zur Anmeldung: die Merkliste lebt dann lokal im
   Browser (components/favorites.ts) — FavoritenListe löst sie im anonymen
   Modus selbst über GET /api/favoriten/aufloesen auf (anonymApi). FavoritenInit
   entfällt dabei, sonst würde sie die lokale Liste mit dem (leeren)
   Serverstand überschreiben. */
export const dynamic = "force-dynamic";

export default async function KontoFavoriten({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  const t = uebersetzer(locale);
  const p = PFAD[locale];
  const refs = s ? await listeFavoriten(s.person.id) : [];
  const treffer = s ? await treffernachRefs(refs) : [];

  return (
    <KontoRahmen locale={locale} titel={t("fv_titel")} breit nav aktiv="favoriten">
      {!s && (
        <div className="hinweisbox" style={{ marginTop: 16 }}>
          {t("fv_anonymHinweis")}{" "}
          <a href={`/${locale}/konto/anmelden?weiter=${encodeURIComponent(`/${locale}/konto/favoriten`)}`}>{t("k_anmelden")}</a>
        </div>
      )}
      {s && <FavoritenInit refs={refs} />}
      <FavoritenListe
        refs={refs}
        treffer={treffer}
        locale={locale}
        w={woerter(t)}
        anonymApi={!s}
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
