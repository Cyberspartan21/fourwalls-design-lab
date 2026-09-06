import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { istLocale, DEFAULT_LOCALE, uebersetzer, LOCALES, PFAD, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { vorschau } from "@/server/vorschau";
import { baueDossier } from "@/domain/dossier";
import { typLabel } from "@/server/listings";
import { ObjektSeite } from "@/components/property/seite";
import { woerter, mitMerkmalen } from "@/components/marktplatz/labels";
import { sql } from "@/server/db";
import { asAppError } from "@/lib/errors";
import { NOINDEX } from "@/lib/seo";

/* Vorschau — geschützt, nie öffentlich (§36/§37). */
export const dynamic = "force-dynamic";

/* NOINDEX war bereits gesetzt (statisch, ohne Titel) — jetzt über die
   gemeinsame Konstante (lib/seo.ts) und mit Titel (P5.9 Phase B). Locale-
   abhängig, deshalb generateMetadata statt eines statischen Exports. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string; ref: string }> }): Promise<Metadata> {
  const { locale: roh, ref } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  return { ...NOINDEX, title: `${uebersetzer(locale)("v_titel")} · ${ref.toUpperCase()}` };
}

export default async function Vorschau({ params }: { params: Promise<{ locale: string; ref: string }> }) {
  const { locale: roh, ref } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  const publicRef = ref.toUpperCase();
  const v = await vorschauOderFehler(s?.person ?? null, publicRef, locale, () =>
    redirect(`/${locale}/konto/anmelden?weiter=${encodeURIComponent(`/${locale}/vorschau/${ref}`)}`));
  if (!v) notFound();
  {
    const t = uebersetzer(locale);
    const merkmale = await sql`SELECT key, coalesce(${sql("name_" + locale)}, name_de) AS name FROM feature ORDER BY sort_order`;
    const w = mitMerkmalen(woerter(t), merkmale.map(m => ({ key: String(m.key), name: String(m.name) })));
    const dossier = baueDossier(v.detail, t, locale, typLabel(v.detail.property.kind, locale), 0);
    const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/vorschau/${ref}`])) as Record<Locale, string>;
    void PFAD;
    return (
      <>
        <div className="hinweisbox" style={{ margin: "0", borderRadius: 0, position: "sticky", top: 0, zIndex: 70 }} role="status">
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", maxWidth: 1200, margin: "0 auto" }}>
            <b>{t("v_titel")}</b>
            <span style={{ color: "var(--leise)", fontSize: ".85rem" }}>{t("v_hinweis")}</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {v.eigen && ["draft", "changes_required", "rejected"].includes(v.status) &&
                <a className="knopf" href={`/${locale}/inserieren/${ref}`}>{t("v_zurueckZumEntwurf")}</a>}
              <a className="knopf leise" href={`/${locale}/konto`}>{t("k_meineInserate")}</a>
            </span>
          </div>
        </div>
        <ObjektSeite d={dossier} t={t} locale={locale} aehnliche={[]} w={w} sprachLinks={sprachLinks} angemeldet={!!s} zuletzt={[]} />
      </>
    );
  }
}

/* Laden mit Rechteentscheid; das Markup entsteht danach (keine JSX im try). */
async function vorschauOderFehler(person: Parameters<typeof vorschau>[0], publicRef: string, locale: Locale, beiAnmeldung: () => never) {
  try { return await vorschau(person, publicRef, locale); }
  catch (e) {
    const err = asAppError(e);
    if (err.code === "UNAUTHORIZED") beiAnmeldung();
    if (err.code === "NOT_FOUND") return null;
    throw e;
  }
}
