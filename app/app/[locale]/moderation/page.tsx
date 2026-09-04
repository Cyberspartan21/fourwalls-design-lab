import { redirect } from "next/navigation";
import { istLocale, DEFAULT_LOCALE, uebersetzer, LOCALES, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { warteschlange } from "@/server/moderation";
import { darf } from "@/domain/rechte";
import { Kopf } from "@/components/site/kopf";

/* Die Warteschlange — was liegt zur Prüfung an, Ältestes zuerst. */
export const dynamic = "force-dynamic";

export default async function Moderation({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  if (!s) redirect(`/${locale}/konto/anmelden?weiter=${encodeURIComponent(`/${locale}/moderation`)}`);
  if (!darf(s.person.rolle, "VIEW_MODERATION_QUEUE")) redirect(`/${locale}/konto`);
  const t = uebersetzer(locale);
  const liste = await warteschlange(s.person);
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/moderation`])) as Record<Locale, string>;

  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      <main className="wiz an" style={{ maxWidth: 1100 }}>
        <span className="schrittz">{t("m_titel")}</span>
        <h2>{t("m_warteschlange")}</h2>
        {liste.length === 0 ? (
          <p style={{ color: "var(--leise)", marginTop: 18 }}>{t("m_keineFaelle")}</p>
        ) : (
          <div className="scroll" style={{ overflowX: "auto", marginTop: 18 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".9rem" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--leise)", fontSize: ".62rem", letterSpacing: ".14em", textTransform: "uppercase" }}>
                  <th style={{ padding: "8px 10px 8px 0" }}>{t("w_titel")}</th>
                  <th style={{ padding: "8px 10px" }}>{t("m_herausgeber")}</th>
                  <th style={{ padding: "8px 10px" }}>{t("w_ortLabel")}</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>{t("w_preis")}</th>
                  <th style={{ padding: "8px 10px", textAlign: "right" }}>{t("w_bilderZahl")}</th>
                  <th style={{ padding: "8px 10px" }}>{t("m_eingereichtAm")}</th>
                  <th style={{ padding: "8px 0 8px 10px" }}>{t("m_durchgang")}</th>
                </tr>
              </thead>
              <tbody>
                {liste.map(e => (
                  <tr key={e.publicRef} style={{ borderTop: "1px solid var(--linie)" }}>
                    <td style={{ padding: "12px 10px 12px 0" }}>
                      <a href={`/${locale}/moderation/${e.publicRef.toLowerCase()}`} style={{ fontWeight: 500 }}>{e.titel ?? e.publicRef}</a>
                      <div style={{ color: "var(--leise)", fontSize: ".76rem", fontVariantNumeric: "tabular-nums" }}>{e.publicRef}</div>
                    </td>
                    <td style={{ padding: "12px 10px" }}>{e.herausgeber}</td>
                    <td style={{ padding: "12px 10px" }}>{e.ort ?? "—"}</td>
                    <td style={{ padding: "12px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{e.preis != null ? "CHF " + e.preis.toLocaleString("de-CH") : "—"}</td>
                    <td style={{ padding: "12px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{e.bilder}</td>
                    <td style={{ padding: "12px 10px", color: "var(--leise)", fontSize: ".82rem" }}>{e.eingereicht ? e.eingereicht.slice(0, 16).replace("T", " ") : "—"}</td>
                    <td style={{ padding: "12px 0 12px 10px", fontVariantNumeric: "tabular-nums" }}>{e.durchgang}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
