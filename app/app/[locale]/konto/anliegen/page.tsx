import { redirect } from "next/navigation";
import { istLocale, uebersetzer, DEFAULT_LOCALE, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { meineAnliegen } from "@/server/anliegen";
import { KontoRahmen } from "../kopfzeile";

/* Meine Anliegen — was eine angemeldete Person über die fünf
   Anliegen-Formulare (Verkauf, Vermietung, Bewertung, Verwaltung, Beratung)
   selbst eingereicht hat. Zeigt nur, was `service_lead.status` wirklich
   hergibt, in kundentauglichen Worten — kein erfundener Zwischenstand. */
export const dynamic = "force-dynamic";

export default async function MeineAnliegenSeite({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  if (!s) redirect(`/${locale}/konto/anmelden?weiter=${encodeURIComponent(`/${locale}/konto/anliegen`)}`);
  const t = uebersetzer(locale);
  const anliegen = await meineAnliegen(s.person.id);

  return (
    <KontoRahmen locale={locale} titel={t("al_titel")} breit nav aktiv="anliegen">
      {anliegen.length === 0 ? (
        <div style={{ marginTop: 16 }}>
          <p style={{ color: "var(--leise)" }}>{t("al_leer")}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <a className="knopf" href={`/${locale}/verkaufen/anfrage`}>{t("al_leer_sell")}</a>
            <a className="knopf" href={`/${locale}/vermieten/anfrage`}>{t("al_leer_let")}</a>
            <a className="knopf" href={`/${locale}/bewertung`}>{t("al_leer_valuation")}</a>
            <a className="knopf" href={`/${locale}/verwalten/anfrage`}>{t("al_leer_pm")}</a>
            <a className="knopf" href={`/${locale}/beratung`}>{t("al_leer_beratung")}</a>
          </div>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0" }}>
          {anliegen.map(a => (
            <li key={a.publicRef} style={{ borderTop: "1px solid var(--linie)", padding: "16px 0" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                <b style={{ fontSize: "1.02rem", fontWeight: 500 }}>{t("al_dienst_" + a.service)}</b>
                <span style={{ color: "var(--leise)", fontSize: ".78rem", fontVariantNumeric: "tabular-nums" }}>{a.publicRef}</span>
                <span style={{ fontSize: ".62rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--leise)" }}>{t("al_status_" + a.status)}</span>
              </div>
              {(a.ort || a.typ) && (
                <p style={{ marginTop: 6, color: "var(--leise)", fontSize: ".85rem" }}>
                  {[a.ort, a.typ ? t("w_typ_" + a.typ) : null].filter(Boolean).join(" · ")}
                </p>
              )}
              {a.nachricht && <p style={{ marginTop: 8, color: "var(--leise)" }}>{a.nachricht}</p>}
              <span style={{ color: "var(--leise)", fontSize: ".78rem" }}>{a.createdAt.slice(0, 10)}</span>
            </li>
          ))}
        </ul>
      )}
    </KontoRahmen>
  );
}
