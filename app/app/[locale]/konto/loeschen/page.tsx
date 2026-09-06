import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { istLocale, uebersetzer, DEFAULT_LOCALE, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { alleinigeOrganisationenLesen } from "@/server/konto-loeschung";
import { DATENKLASSEN, type Behandlung } from "@/domain/kontoloeschung";
import { KontoRahmen } from "../kopfzeile";
import { LoeschenFormular } from "@/components/konto/loeschen-formular";
import { NOINDEX } from "@/lib/seo";

export const dynamic = "force-dynamic";

/* NOINDEX (Kontoseite mit sensibler Handlung). */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  return { ...NOINDEX, title: uebersetzer(locale)("kl_titel") };
}

/* Das Bestätigungswort je Sprache (dieselbe Liste wie server-seitig in
   app/api/konto/loeschen/route.ts geprüft). */
const BESTAETIGUNGSWORT: Record<Locale, string> = { de: "LÖSCHEN", fr: "SUPPRIMER", it: "ELIMINA", en: "DELETE" };

/* Gruppierung der Datenkarte für diese Seite (§9): "wird gelöscht", "bleibt
   bestehen" (inkl. anonymisiert — die Zeile bleibt, nur verändert) und "noch
   nicht entschieden". Die Gruppen selbst kommen aus domain/kontoloeschung.ts
   (DATENKLASSEN); nur die menschenlesbare Kurzbeschreibung je Zeile lebt als
   Übersetzung (kl_dk_<schluessel>) — vier Sprachen, eine Quelle für die Liste. */
const GRUPPE: Record<Behandlung, "geloescht" | "bleibt" | "zurueckgestellt"> = {
  LOESCHEN: "geloescht",
  ANONYMISIEREN: "bleibt",
  BLEIBT: "bleibt",
  BLEIBT_FREMDES_EIGENTUM: "bleibt",
  ZURUECKGESTELLT_RECHTSENTSCHEID: "zurueckgestellt"
};

export default async function KontoLoeschen({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const t = uebersetzer(locale);
  const s = await sitzung();
  if (!s) redirect(`/${locale}/konto/anmelden?weiter=${encodeURIComponent(`/${locale}/konto/loeschen`)}`);

  const alleinigeOrganisationen = await alleinigeOrganisationenLesen(s.person.id);
  const gesperrt = alleinigeOrganisationen.length > 0;

  const geloescht = DATENKLASSEN.filter(d => GRUPPE[d.behandlung] === "geloescht");
  const bleibt = DATENKLASSEN.filter(d => GRUPPE[d.behandlung] === "bleibt");
  const zurueckgestellt = DATENKLASSEN.filter(d => GRUPPE[d.behandlung] === "zurueckgestellt");

  const liste = (gruppe: typeof geloescht) => (
    <ul style={{ margin: "10px 0 0", paddingLeft: 20 }}>
      {gruppe.map(d => <li key={d.schluessel} style={{ marginTop: 4 }}>{t(`kl_dk_${d.schluessel}`)}</li>)}
    </ul>
  );

  const txForm = Object.fromEntries(
    ["k_passwort", "kl_passwortHin", "kl_bestaetigungLabel", "kl_bestaetigungFehler", "kl_knopf", "kl_fehlerPasswort", "kl_fehlerAllgemein"]
      .map(k => [k, t(k)])
  );

  return (
    <KontoRahmen locale={locale} titel={t("kl_titel")} lead={t("kl_lead")}>
      <p style={{ marginTop: 10 }}>
        <a className="knopf" href="/api/konto/export">{t("kd_exportLink")}</a>
        {" "}<span style={{ color: "var(--leise)", fontSize: ".85rem" }}>{t("kl_exportHinweis")}</span>
      </p>

      {gesperrt && (
        <div className="hinweisbox" role="alert" style={{ marginTop: 22 }}>
          <b>{t("kl_soleOwnerTitel")}</b>
          <p style={{ marginTop: 6 }}>{t("kl_soleOwnerText")}</p>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
            {alleinigeOrganisationen.map(o => (
              <li key={o.orgId} style={{ marginTop: 4 }}>
                {o.orgName} — <a href={`/${locale}/konto/org/${o.orgSlug}/team`}>{t("kl_soleOwnerLink")}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 26 }}>
        <h3 style={{ fontSize: ".95rem" }}>{t("kl_wirdGeloescht")}</h3>
        {liste(geloescht)}
      </div>
      <div style={{ marginTop: 22 }}>
        <h3 style={{ fontSize: ".95rem" }}>{t("kl_bleibtBestehen")}</h3>
        {liste(bleibt)}
      </div>
      <div style={{ marginTop: 22 }}>
        <h3 style={{ fontSize: ".95rem" }}>{t("kl_nochNichtEntschieden")}</h3>
        {liste(zurueckgestellt)}
        <p style={{ color: "var(--leise)", fontSize: ".85rem", marginTop: 8 }}>{t("kl_nochNichtEntschiedenHin")}</p>
      </div>

      <div style={{ marginTop: 32, borderTop: "1px solid var(--linie)", paddingTop: 24 }}>
        <LoeschenFormular t={txForm} bestaetigungswort={BESTAETIGUNGSWORT[locale]} weiterHref={`/${locale}/konto/geloescht`} gesperrt={gesperrt} />
      </div>
    </KontoRahmen>
  );
}
