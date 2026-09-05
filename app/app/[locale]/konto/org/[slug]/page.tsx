import { notFound } from "next/navigation";
import { istLocale, uebersetzer, DEFAULT_LOCALE, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { verlangeOrgRecht } from "@/server/org-kontext";
import { orgZaehlung } from "@/server/orginserate";
import { orgAnfragen } from "@/server/organfragen";
import { mitglieder } from "@/server/organisationen";
import { orgDarf } from "@/domain/orgrechte";
import { asAppError } from "@/lib/errors";
import { Kachel } from "../../page";
import { NeuesInseratKnopf } from "@/components/org/neues-inserat-knopf";

/* Die Übersicht einer Organisation (P5.7 §2) — Kacheln mit echten,
   serverseitig gezählten Zahlen. Nichts, was es in der Datenbank nicht
   gibt (§Auftrag). */
export const dynamic = "force-dynamic";

const STATUS_ZAEHL: string[] = ["draft", "submitted", "in_review", "changes_required", "approved", "published", "paused"];

export default async function OrgUebersicht({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: roh, slug } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  if (!s) notFound();
  const t = uebersetzer(locale);

  let kontext;
  try { kontext = await verlangeOrgRecht(s.person, slug, "VIEW_ORG_LISTINGS"); }
  catch (e) { if (asAppError(e).code === "NOT_FOUND") notFound(); throw e; }

  const [zaehlung, anfragen, team] = await Promise.all([
    orgZaehlung(kontext),
    orgAnfragen(kontext, 1),
    mitglieder(kontext)
  ]);

  const gesamtInserate = STATUS_ZAEHL.reduce((n, st) => n + (zaehlung[st] ?? 0), 0);
  const statusText = STATUS_ZAEHL.filter(st => zaehlung[st]).map(st => `${zaehlung[st]} ${t("st_" + st)}`).join(" · ");

  return (
    <div>
      <h3 style={{ fontSize: ".95rem" }}>{t("og_uebersichtTitel")}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginTop: 12 }}>
        <Kachel href={`/${locale}/konto/org/${slug}/inserate`} zahl={gesamtInserate} label={statusText ? `${t("og_nav_inserate")} — ${statusText}` : t("og_nav_inserate")} />
        <Kachel href={`/${locale}/konto/org/${slug}/anfragen`} zahl={anfragen.total} label={t("og_kachelOffeneAnfragen")} />
        <Kachel href={`/${locale}/konto/org/${slug}/team`} zahl={team.mitglieder.length} label={t("og_kachelTeam")} />
      </div>

      <div style={{ marginTop: 26, display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
        {orgDarf(kontext.mitglied.rolle, "IMPORT_LISTINGS") && (
          <a className="knopf" href={`/${locale}/konto/org/${slug}/inserate/import`}>{t("og_csvImportieren")}</a>
        )}
        {orgDarf(kontext.mitglied.rolle, "CREATE_LISTING") && (
          <NeuesInseratKnopf locale={locale} slug={slug} label={t("og_neuesInserat")} voll />
        )}
      </div>
    </div>
  );
}
