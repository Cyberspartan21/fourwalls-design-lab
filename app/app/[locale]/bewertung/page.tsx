import type { Metadata } from "next";
import { istLocale, DEFAULT_LOCALE, LOCALES, uebersetzer, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { Kopf } from "@/components/site/kopf";
import { AnliegenFormular } from "@/components/anliegen/anliegen-formular";
import { anliegenTexte } from "@/components/anliegen/texte";

/* Bewertung anfragen — Dienst "valuation". Objekt→Kontakt→Prüfen, davor ein
   kurzer Erklärtext: was wir brauchen, was danach passiert, was am Ende
   dabei herauskommt — ausdrücklich eine Einschätzung im Gespräch, keine
   automatisch errechnete Zahl (§Auftrag: keine Zahlen, kein «kostenlos»,
   keine Frist). */
export const dynamic = "force-dynamic";
type Params = { locale: string };

function localeAus(roh: string): Locale { return istLocale(roh) ? roh : DEFAULT_LOCALE; }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const locale = localeAus((await params).locale);
  const t = uebersetzer(locale);
  return { title: t("al_meta_valuation_titel"), description: t("al_meta_valuation_beschreibung") };
}

export default async function Bewertung({ params }: { params: Promise<Params> }) {
  const { locale: roh } = await params;
  const locale = localeAus(roh);
  const t = uebersetzer(locale);
  const s = await sitzung();
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/bewertung`])) as Record<Locale, string>;

  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      <main className="wiz an">
        <p className="hin" style={{ color: "var(--leise)" }}>{t("al_valuation_lead")}</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, margin: "20px 0 30px" }}>
          <div>
            <h3 style={{ fontSize: ".85rem", fontWeight: 500 }}>{t("al_valuation_brauchenTitel")}</h3>
            <p style={{ color: "var(--leise)", fontSize: ".85rem", marginTop: 6 }}>{t("al_valuation_brauchenText")}</p>
          </div>
          <div>
            <h3 style={{ fontSize: ".85rem", fontWeight: 500 }}>{t("al_valuation_danachTitel")}</h3>
            <p style={{ color: "var(--leise)", fontSize: ".85rem", marginTop: 6 }}>{t("al_valuation_danachText")}</p>
          </div>
          <div>
            <h3 style={{ fontSize: ".85rem", fontWeight: 500 }}>{t("al_valuation_erhaltenTitel")}</h3>
            <p style={{ color: "var(--leise)", fontSize: ".85rem", marginTop: 6 }}>{t("al_valuation_erhaltenText")}</p>
          </div>
        </div>

        <AnliegenFormular dienst="valuation" angemeldet={s !== null} locale={locale} t={anliegenTexte(t)} />
      </main>
    </>
  );
}
