import { notFound } from "next/navigation";
import { istLocale, uebersetzer, DEFAULT_LOCALE, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { einladungLesen } from "@/server/einladungen";
import { asAppError } from "@/lib/errors";
import { KontoRahmen } from "../../konto/kopfzeile";
import { EinladungAnnehmenKnopf } from "@/components/org/einladung-annehmen";

/* Die Einladungsseite (P5.7 §9) — öffentlich lesbar (nur Name, Rolle,
   maskierte Adresse, Zustand — nie mehr, §15), das Annehmen selbst
   verlangt eine Sitzung. Token nie protokollieren. */
export const dynamic = "force-dynamic";

export default async function EinladungSeite({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale: roh, token } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const t = uebersetzer(locale);

  let einladung;
  try { einladung = await einladungLesen(token); }
  catch (e) { if (asAppError(e).code === "NOT_FOUND") notFound(); throw e; }

  const s = await sitzung();
  const weiterZiel = `/${locale}/einladung/${token}`;

  return (
    <KontoRahmen locale={locale} titel={t("og_einladungTitel")}>
      <p style={{ color: "var(--leise)", marginTop: 8 }}>{t("og_einladungEingeladenHin")}</p>
      <h3 style={{ marginTop: 10 }}>{einladung.orgDisplayName}</h3>
      <p style={{ color: "var(--leise)", marginTop: 4 }}>
        {t("og_einladungAls")} {t("og_rolle_" + einladung.rolle)} · {t("og_einladungFuer")} {einladung.emailMaskiert}
      </p>

      {einladung.zustand === "abgelaufen" && <p className="hinweisbox" style={{ marginTop: 20 }}>{t("og_einladungZustandAbgelaufen")}</p>}
      {einladung.zustand === "angenommen" && <p className="hinweisbox" style={{ marginTop: 20 }}>{t("og_einladungZustandAngenommen")}</p>}
      {einladung.zustand === "widerrufen" && <p className="hinweisbox" style={{ marginTop: 20 }}>{t("og_einladungZustandWiderrufen")}</p>}

      {einladung.zustand === "offen" && (
        !s ? (
          <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <p style={{ color: "var(--leise)", width: "100%" }}>{t("og_einladungAnmeldenNoetig")}</p>
            <a className="knopf voll" href={`/${locale}/konto/anmelden?weiter=${encodeURIComponent(weiterZiel)}`}>{t("k_anmelden")}</a>
            <a className="knopf" href={`/${locale}/konto/registrieren?weiter=${encodeURIComponent(weiterZiel)}`}>{t("k_registrieren")}</a>
          </div>
        ) : (
          <div style={{ marginTop: 20 }}>
            <EinladungAnnehmenKnopf locale={locale} token={token} label={t("og_einladungAnnehmenKnopf")} weiterHin={t("og_einladungAngenommenWeiter")} />
          </div>
        )
      )}
    </KontoRahmen>
  );
}
