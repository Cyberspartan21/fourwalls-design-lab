import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { istLocale, uebersetzer, DEFAULT_LOCALE, PFAD, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { meineSuchen } from "@/server/gespeicherteSuchen";
import { NOINDEX } from "@/lib/seo";
import { SuchanfrageSchema, paramsAusAnfrage } from "@/domain/suchurl";
import type { Suchanfrage } from "@/domain/marktplatz";
import { woerter, typLabel, chfText, type Woerter } from "@/components/marktplatz/labels";
import { KontoRahmen } from "../kopfzeile";
import { SuchaboZeile } from "@/components/konto/suchabo-zeile";

/* Meine Suchabos — verwaltbar ausschliesslich angemeldet (§ P5.6): umbenennen
   gibt es bewusst nicht (das Label kommt beim Anlegen von der Zusammenfassung
   der Suche), aber Häufigkeit ändern, pausieren/aktivieren, öffnen, löschen.
   Anonyme Suchabos verwaltet ausschliesslich der Abmeldelink in jeder Mail —
   dafür braucht es keine Oberfläche hier. */
export const dynamic = "force-dynamic";

/* NOINDEX (Suchabos, P5.9 Phase B). */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  return { ...NOINDEX, title: uebersetzer(locale)("k_gespeicherteSuchen") };
}

function einfacheZusammenfassung(w: Woerter, a: Suchanfrage): string {
  return [
    a.trans === "rent" ? w.mieten : w.kaufen,
    a.typ ? typLabel(w, a.typ) : "",
    a.ziMin ? `${a.ziMin}+ ${w.o_ziKurz}` : "",
    a.pMax != null ? "≤ " + chfText(a.pMax) : ""
  ].filter(Boolean).join(" · ");
}

export default async function KontoSuchabos({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  if (!s) redirect(`/${locale}/konto/anmelden?weiter=${encodeURIComponent(`/${locale}/konto/suchabos`)}`);
  const t = uebersetzer(locale);
  const w = woerter(t);
  const p = PFAD[locale];
  const suchen = await meineSuchen(s.person.id);

  const texte = {
    k_zuletztGeaendert: t("k_zuletztGeaendert"), sa_unbestaetigt: t("sa_unbestaetigt"),
    wieSofort: t("wieSofort"), wieTaeglich: t("wieTaeglich"), wieWoechentlich: t("wieWoechentlich"),
    sa_pausieren: t("sa_pausieren"), sa_aktivieren: t("sa_aktivieren"), sa_oeffnen: t("sa_oeffnen"),
    sa_loeschen: t("sa_loeschen"), sa_loeschenBestaetigen: t("sa_loeschenBestaetigen")
  };

  return (
    <KontoRahmen locale={locale} titel={t("k_gespeicherteSuchen")} breit nav aktiv="suchabos">
      {suchen.length === 0 ? (
        <p style={{ color: "var(--leise)", marginTop: 16 }}>{t("sa_keine")}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0" }}>
          {suchen.map(su => {
            let anfrage: Suchanfrage | null = null;
            try { anfrage = SuchanfrageSchema.parse(su.query) as Suchanfrage; } catch { anfrage = null; }
            const titel = su.label || (anfrage ? einfacheZusammenfassung(w, anfrage) : "") || t("k_gespeicherteSuchen");
            const art = anfrage?.trans === "rent" ? p.mieten : p.kaufen;
            const href = anfrage
              ? `/${locale}/${p.immobilien}/${art}?${paramsAusAnfrage(anfrage).toString()}`
              : `/${locale}/${p.immobilien}/${p.kaufen}`;
            return (
              <SuchaboZeile
                key={su.id} id={su.id} titel={titel} href={href} createdAt={su.createdAt}
                frequency={su.alert.frequency as "immediately" | "daily" | "weekly"}
                isPaused={su.alert.isPaused} confirmedAt={su.alert.confirmedAt} t={texte}
              />
            );
          })}
        </ul>
      )}
    </KontoRahmen>
  );
}
