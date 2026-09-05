import type { Locale } from "@/i18n";
import { PFAD } from "@/i18n";
import type { Treffer } from "@/domain/marktplatz";
import type { Woerter } from "@/components/marktplatz/labels";
import { Karte, objektPfad } from "@/components/marktplatz/karte";

/* Zuletzt angesehen — wiederverwendbar auf der Objektseite und in
   Mein-Konto. Dieselbe Ergebniskarte wie überall, in einer horizontal
   scrollbaren Reihe (.hreihe, styles/objekt.css) statt im Suchraster. */
export function VerlaufListe({ treffer, w, locale }: { treffer: Treffer[]; w: Woerter; locale: Locale }) {
  if (treffer.length === 0) return null;
  return (
    <div className="hreihe">
      {treffer.map(t => <Karte key={t.id} l={t} w={w} locale={locale} href={objektPfad(locale, PFAD[locale], t)} />)}
    </div>
  );
}
