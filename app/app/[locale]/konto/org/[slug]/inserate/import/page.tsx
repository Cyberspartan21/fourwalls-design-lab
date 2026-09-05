import { notFound, redirect } from "next/navigation";
import { istLocale, uebersetzer, DEFAULT_LOCALE, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { verlangeOrgRecht } from "@/server/org-kontext";
import { asAppError } from "@/lib/errors";
import { ImportFormular } from "@/components/org/import-formular";

/* CSV-Import (P5.7 §5, docs/IMPORT-ADAPTER.md) — die dokumentierte Grenze:
   eine Datei, einmal hochgeladen, Zeile für Zeile durch dieselbe Prüfung wie
   der Assistent. */
export const dynamic = "force-dynamic";

const SPALTEN = ["external_ref", "trans", "typ", "ortId", "zimmer", "flaeche", "preis", "titel", "beschreibung", "sprache"];

export default async function OrgImportSeite({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: roh, slug } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  if (!s) notFound();
  const t = uebersetzer(locale);

  try {
    await verlangeOrgRecht(s.person, slug, "IMPORT_LISTINGS");
  } catch (e) {
    const ae = asAppError(e);
    if (ae.code === "NOT_FOUND") notFound();
    if (ae.code === "FORBIDDEN") redirect(`/${locale}/konto/org/${slug}`);
    throw e;
  }

  const txt = Object.fromEntries([
    "og_importDatei", "og_importText", "og_importKnopf", "og_importErgebnisTitel",
    "og_importThZeile", "og_importThRef", "og_importThStatus", "og_importThGrund",
    "og_importStatusAngelegt", "og_importStatusUebersprungen", "og_importStatusAbgelehnt"
  ].map(k => [k, t(k)]));

  return (
    <div>
      <h3 style={{ fontSize: ".95rem" }}>{t("og_importTitel")}</h3>
      <p style={{ color: "var(--leise)", marginTop: 8, maxWidth: "60ch" }}>{t("og_importLead")}</p>

      <div className="hinweisbox" style={{ marginTop: 16 }}>
        <b>{t("og_importSpaltenTitel")}</b>
        <p style={{ marginTop: 6, fontFamily: "monospace", fontSize: ".78rem", overflowWrap: "anywhere" }}>{SPALTEN.join(",")}</p>
      </div>

      <div style={{ marginTop: 22 }}>
        <ImportFormular slug={slug} t={txt} />
      </div>
    </div>
  );
}
