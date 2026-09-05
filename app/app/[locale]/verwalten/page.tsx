import type { Metadata } from "next";
import { istLocale, DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n";
import { Kopf } from "@/components/site/kopf";
import de from "@/i18n/messages/de/service.json";
import fr from "@/i18n/messages/fr/service.json";
import it from "@/i18n/messages/it/service.json";
import en from "@/i18n/messages/en/service.json";

/* Landeseite «Verwaltung anfragen» — P5.8. Siehe Kommentar in
   app/[locale]/verkaufen/page.tsx zu service.json (angelegt, nicht
   registriert). §35: beabsichtigter Umfang neutral als Anfrage-Themen, kein
   Leistungsversprechen; Preismodell nur, wenn config/policy.ts es über
   zusage() freigibt (heute nicht bestätigt — hier nicht verwendet, da kein
   konkreter Satz vorliegt). */
const SV: Record<Locale, Record<string, string>> = { de, fr, it, en };
function sv(locale: Locale, key: string): string { return SV[locale]?.[key] ?? SV.de[key] ?? key; }

export const dynamic = "force-dynamic";
type Params = { locale: string };
function localeAus(roh: string): Locale { return istLocale(roh) ? roh : DEFAULT_LOCALE; }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const locale = localeAus((await params).locale);
  return { title: `${sv(locale, "sv_vwTitel")} — Fourwalls`, description: sv(locale, "sv_vwLead") };
}

export default async function Verwalten({ params }: { params: Promise<Params> }) {
  const { locale: roh } = await params;
  const locale = localeAus(roh);
  const t = (k: string) => sv(locale, k);
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/verwalten`])) as Record<Locale, string>;

  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} aktuell="verwalten" />
      <main className="wiz an" style={{ maxWidth: 780 }}>
        <h2>{t("sv_vwTitel")}</h2>
        <p style={{ color: "var(--leise)", marginTop: 10, maxWidth: "56ch" }}>{t("sv_vwLead")}</p>

        <section style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 500 }}>{t("sv_vwThemenTitel")}</h3>
          <ul style={{ marginTop: 12, paddingLeft: 18, display: "grid", gap: 8 }}>
            <li>{t("sv_vwThema1")}</li>
            <li>{t("sv_vwThema2")}</li>
            <li>{t("sv_vwThema3")}</li>
          </ul>
        </section>

        <section style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 500 }}>{t("sv_vwProzessTitel")}</h3>
          <ol style={{ marginTop: 12, paddingLeft: 18, display: "grid", gap: 12 }}>
            {[1, 2, 3, 4].map(n => (
              <li key={n}><b>{t(`sv_vwSchritt${n}Titel`)}</b><br /><span style={{ color: "var(--leise)" }}>{t(`sv_vwSchritt${n}Text`)}</span></li>
            ))}
          </ol>
        </section>

        <p style={{ marginTop: 32 }}>
          <a className="knopf voll" href={`/${locale}/verwalten/anfrage`}>{t("sv_ctaAnfrage")}</a>
        </p>

        <section style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid var(--linie)" }}>
          <h3 style={{ fontSize: ".95rem", fontWeight: 500 }}>{t("sv_vwAbgrenzungTitel")}</h3>
          <p style={{ marginTop: 8, color: "var(--leise)" }}>{t("sv_vwAbgrenzungText")} <a href={`/${locale}/vermieten`}>{t("sv_vwAbgrenzungLink")}</a></p>
        </section>
      </main>
    </>
  );
}
