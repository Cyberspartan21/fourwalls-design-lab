import { notFound } from "next/navigation";
import { istLocale, uebersetzer, DEFAULT_LOCALE, PFAD, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { verlangeOrgRecht } from "@/server/org-kontext";
import { profilLesen } from "@/server/organisationen";
import { orgDarf } from "@/domain/orgrechte";
import { asAppError } from "@/lib/errors";
import { ProfilFormular } from "@/components/org/profil-formular";
import { StilllegenKnopf } from "@/components/org/stilllegen-knopf";

/* Das öffentliche Herausgeberprofil (P5.7 §8). Lesen dürfen alle aktiven
   Mitglieder; ändern nur, wer MANAGE_PUBLISHER_PROFILE hat (Firmenname und
   Sprache zusätzlich nur mit MANAGE_ORGANIZATION) — die Formularlogik prüft
   server/organisationen.ts:profilAendern erneut, unabhängig davon, was diese
   Seite anzeigt. */
export const dynamic = "force-dynamic";

export default async function OrgProfilSeite({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: roh, slug } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  if (!s) notFound();
  const t = uebersetzer(locale);

  let kontext;
  try { kontext = await verlangeOrgRecht(s.person, slug, "VIEW_ORG_LISTINGS"); }
  catch (e) { if (asAppError(e).code === "NOT_FOUND") notFound(); throw e; }

  const profil = await profilLesen(kontext);
  const darfProfilAendern = orgDarf(kontext.mitglied.rolle, "MANAGE_PUBLISHER_PROFILE");
  const darfOrgAendern = orgDarf(kontext.mitglied.rolle, "MANAGE_ORGANIZATION");

  const txt = Object.fromEntries([
    "og_feldLogo", "og_logoHochladen", "og_logoEntfernen", "og_logoHin",
    "og_feld_anzeigename", "og_feld_firmenname", "og_feld_sprache", "og_feld_website",
    "og_feld_publicEmail", "og_feld_publicPhone", "og_feld_strasse", "og_feld_plz", "og_feld_ort",
    "og_feld_beschreibung", "og_profilSpeichern", "og_profilGespeichert", "og_nurBesitzerin"
  ].map(k => [k, t(k)]));

  return (
    <div>
      <h3 style={{ fontSize: ".95rem" }}>{t("og_profilTitel")}</h3>
      <p style={{ color: "var(--leise)", marginTop: 8, maxWidth: "60ch" }}>{t("og_profilLead")}</p>
      <p style={{ marginTop: 10 }}>
        <a className="knopf leise" href={`/${locale}/${PFAD[locale].anbieter}/${slug}`}>{t("og_oeffentlicheSeiteAnsehen")}</a>
      </p>

      <div style={{ marginTop: 20 }}>
        <ProfilFormular slug={slug} darfProfilAendern={darfProfilAendern} darfOrgAendern={darfOrgAendern} t={txt}
          profil={{
            displayName: profil.displayName, legalName: profil.legalName, locale: profil.locale,
            website: profil.website, publicEmail: profil.publicEmail, publicPhone: profil.publicPhone,
            street: profil.street, postalCode: profil.postalCode, city: profil.city, description: profil.description,
            logoAssetId: profil.logoAssetId
          }} />
      </div>

      {darfOrgAendern && (
        <div style={{ marginTop: 40, borderTop: "1px solid var(--linie)", paddingTop: 24 }}>
          <h3 style={{ fontSize: ".95rem" }}>{t("og_stilllegenTitel")}</h3>
          <p style={{ color: "var(--leise)", marginTop: 8, maxWidth: "60ch" }}>{t("og_stilllegenHin")}</p>
          <div style={{ marginTop: 14 }}>
            <StilllegenKnopf locale={locale} slug={slug} label={t("og_stilllegenKnopf")} bestaetigen={t("og_stilllegenBestaetigen")} />
          </div>
        </div>
      )}
    </div>
  );
}
