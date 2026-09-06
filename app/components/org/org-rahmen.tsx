import type { Locale } from "@/i18n";
import { LOCALES, uebersetzer } from "@/i18n";
import { Kopf } from "@/components/site/kopf";
import { OrgUmschalter } from "./org-umschalter";
import { OrgNav } from "./org-nav";
import type { OrgKopf } from "@/server/org-kontext";
import type { OrgRolle } from "@/domain/orgrechte";

/* Der Rahmen jeder Organisationsseite (P5.7 §7, §18–§20) — ein
   zurückhaltendes Arbeitsfeld: kein CRM, keine Pipeline, keine
   Wasseranimation hinter Tabellen. UFER-Typografie, -Abstände, -Formulare.

   Getrennt von KontoRahmen (der Kundennavigation): diese Navigation lebt
   ausschliesslich innerhalb einer Organisation. `rolle` ist bewusst Teil der
   Schnittstelle — jede Unterseite prüft ihre Bedienelemente trotzdem selbst
   über ihren eigenen, frisch aus verlangeOrgRecht() geladenen Kontext; der
   Rahmen selbst zeigt allen aktiven Mitgliedern dieselbe Navigation. */
export function OrgRahmen({ locale, org, meine, children }: {
  locale: Locale;
  org: OrgKopf;
  meine: { org: OrgKopf; rolle: OrgRolle }[];
  children: React.ReactNode;
}) {
  const t = uebersetzer(locale);
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/konto/org/${org.slug}`])) as Record<Locale, string>;
  const zustandText = org.verificationState === "verified" ? t("og_status_geprueft") : t("og_status_ungeprueft");

  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      <main id="inhalt" className="wiz an" style={{ maxWidth: 980 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div>
            <span className="schrittz">{t("og_art_" + org.kind)} · {zustandText}</span>
            <h1 className="titel">{org.displayName}</h1>
          </div>
          <OrgUmschalter locale={locale} aktivSlug={org.slug} label={t("og_umschalterLabel")}
            organisationen={meine.map(m => ({ slug: m.org.slug, displayName: m.org.displayName }))} />
        </div>

        <OrgNav locale={locale} slug={org.slug} displayName={org.displayName} />

        <div style={{ marginTop: 20 }}>
          {children}
        </div>
      </main>
    </>
  );
}
