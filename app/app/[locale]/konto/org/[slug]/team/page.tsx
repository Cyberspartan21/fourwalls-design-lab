import { notFound } from "next/navigation";
import { istLocale, uebersetzer, DEFAULT_LOCALE, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { verlangeOrgRecht } from "@/server/org-kontext";
import { mitglieder } from "@/server/organisationen";
import { orgDarf } from "@/domain/orgrechte";
import { asAppError } from "@/lib/errors";
import { Team } from "@/components/org/team";

/* Das Team einer Organisation (P5.7 §7). Jedes aktive Mitglied sieht die
   Namen; nur wer MANAGE_MEMBERS hat, sieht E-Mail-Adressen, offene
   Einladungen und die Bedienelemente dafür (server/organisationen.ts:mitglieder). */
export const dynamic = "force-dynamic";

export default async function OrgTeamSeite({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: roh, slug } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  if (!s) notFound();
  const t = uebersetzer(locale);

  let kontext;
  try { kontext = await verlangeOrgRecht(s.person, slug, "VIEW_ORG_LISTINGS"); }
  catch (e) { if (asAppError(e).code === "NOT_FOUND") notFound(); throw e; }

  const { mitglieder: mitgliederListe, einladungen } = await mitglieder(kontext);
  const darfMitgliederVerwalten = orgDarf(kontext.mitglied.rolle, "MANAGE_MEMBERS");

  const txt = Object.fromEntries([
    "og_teamMitgliederTitel", "og_thName", "og_thRolle", "og_thZustand", "og_thSeit", "og_thAktionen",
    "og_zustandAktiv", "og_entfernen", "og_entfernenBestaetigen", "og_rolleAendern",
    "og_einladungenTitel", "og_einladungenLeer", "og_thEmail", "og_thLaeuftAb", "og_widerrufen",
    "og_widerrufenBestaetigen", "og_erneutEinladen", "og_einladenTitel", "og_einladenKnopf", "og_einladenGesendet",
    "og_rolle_owner", "og_rolle_admin", "og_rolle_agent", "og_rolle_viewer"
  ].map(k => [k, t(k)]));

  return (
    <div>
      <h3 style={{ fontSize: ".95rem", marginBottom: 8 }}>{t("og_teamTitel")}</h3>
      <Team slug={slug} eigeneRolle={kontext.mitglied.rolle} eigeneUserId={s.person.id}
        darfMitgliederVerwalten={darfMitgliederVerwalten} mitglieder={mitgliederListe} einladungen={einladungen} t={txt} />
    </div>
  );
}
