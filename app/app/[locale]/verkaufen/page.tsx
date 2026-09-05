import type { Metadata } from "next";
import { istLocale, DEFAULT_LOCALE, LOCALES, type Locale } from "@/i18n";
import { Kopf } from "@/components/site/kopf";
import { firma, feld } from "@/config/company";
import { zusage } from "@/config/policy";
import de from "@/i18n/messages/de/service.json";
import fr from "@/i18n/messages/fr/service.json";
import it from "@/i18n/messages/it/service.json";
import en from "@/i18n/messages/en/service.json";

/* Landeseite «Mit Fourwalls verkaufen» — P5.8.

   i18n/messages/{de,fr,it,en}/service.json (Präfix sv_) ist angelegt, aber NICHT in
   i18n/index.ts registriert (ausserhalb dieses Auftrags, siehe Bericht) —
   darum liest diese Seite ihre Texte direkt aus den vier JSON-Dateien statt
   über uebersetzer(). Sobald service.json registriert ist, kann dieser
   lokale Katalog durch uebersetzer() ersetzt werden.

   §34: was Fourwalls tut als Absicht formuliert, ohne Zahlen. §37: fünf
   Schritte Anfrage→Gespräch→Einschätzung→Vermarktung→Abschluss. §38:
   Vertrauensblock mit Herausgeberidentität, konfigurierten Kontaktwegen,
   Ablauf nach der Anfrage, Datenhinweis — keine Statistik. §35/§71: der
   Honorarsatz erscheint nur, wenn config/policy.ts ihn per zusage()
   freigibt (heute: nicht bestätigt, also nichts). */
const SV: Record<Locale, Record<string, string>> = { de, fr, it, en };
function sv(locale: Locale, key: string): string { return SV[locale]?.[key] ?? SV.de[key] ?? key; }

export const dynamic = "force-dynamic";
type Params = { locale: string };
function localeAus(roh: string): Locale { return istLocale(roh) ? roh : DEFAULT_LOCALE; }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const locale = localeAus((await params).locale);
  return { title: `${sv(locale, "sv_vkTitel")} — Fourwalls`, description: sv(locale, "sv_vkLead") };
}

export default async function Verkaufen({ params }: { params: Promise<Params> }) {
  const { locale: roh } = await params;
  const locale = localeAus(roh);
  const t = (k: string) => sv(locale, k);
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/verkaufen`])) as Record<Locale, string>;
  const honorar = zusage("honorarNurBeiErfolg");
  const platzhalter = firma.strasse.stand !== "bestaetigt";

  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} aktuell="verkaufen" />
      <main className="wiz an" style={{ maxWidth: 780 }}>
        <h2>{t("sv_vkTitel")}</h2>
        <p style={{ color: "var(--leise)", marginTop: 10, maxWidth: "56ch" }}>{t("sv_vkLead")}</p>

        <section style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 500 }}>{t("sv_vkTunTitel")}</h3>
          <ul style={{ marginTop: 12, paddingLeft: 18, display: "grid", gap: 8 }}>
            <li>{t("sv_vkTun1")}</li>
            <li>{t("sv_vkTun2")}</li>
            <li>{t("sv_vkTun3")}</li>
            <li>{t("sv_vkTun4")}</li>
            <li>{t("sv_vkTun5")}</li>
          </ul>
        </section>

        <section style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 500 }}>{t("sv_vkProzessTitel")}</h3>
          <ol style={{ marginTop: 12, paddingLeft: 18, display: "grid", gap: 12 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <li key={n}><b>{t(`sv_vkSchritt${n}Titel`)}</b><br /><span style={{ color: "var(--leise)" }}>{t(`sv_vkSchritt${n}Text`)}</span></li>
            ))}
          </ol>
        </section>

        <section style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 500 }}>{t("sv_vkErwartenTitel")}</h3>
          <p style={{ marginTop: 10, color: "var(--leise)" }}>{t("sv_vkErwartenText")}</p>
          {honorar && <p style={{ marginTop: 10 }}>{honorar}</p>}
        </section>

        <p style={{ marginTop: 32 }}>
          <a className="knopf voll" href={`/${locale}/verkaufen/anfrage`}>{t("sv_ctaAnfrage")}</a>
        </p>

        <section style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid var(--linie)" }}>
          <h3 style={{ fontSize: ".95rem", fontWeight: 500 }}>{t("sv_vkAbgrenzungTitel")}</h3>
          <p style={{ marginTop: 8, color: "var(--leise)" }}>{t("sv_vkAbgrenzungText")} <a href={`/${locale}/inserieren`}>{t("sv_vkAbgrenzungLink")}</a></p>
        </section>

        <section style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid var(--linie)" }}>
          <h3 style={{ fontSize: ".95rem", fontWeight: 500 }}>{t("sv_vkVertrauenTitel")}</h3>
          <p style={{ marginTop: 8, color: "var(--leise)" }}>
            {t("sv_vkHerausgeber")} {feld("strasse", "")} · {feld("plzOrt", "")}{platzhalter ? ` (${t("sv_vkPlatzhalterHinweis")})` : ""}
          </p>
          <p style={{ marginTop: 8, color: "var(--leise)" }}>{feld("telefon", "")} · {feld("email", "")}</p>
          <p style={{ marginTop: 8, color: "var(--leise)" }}>{t("sv_vkNachAnfrage")}</p>
          <p style={{ marginTop: 8, color: "var(--leise)" }}>{t("sv_vkDatenhinweis")}</p>
        </section>
      </main>
    </>
  );
}
