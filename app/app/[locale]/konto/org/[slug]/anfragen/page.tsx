import { notFound } from "next/navigation";
import { istLocale, uebersetzer, DEFAULT_LOCALE, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { verlangeOrgRecht } from "@/server/org-kontext";
import { orgAnfragen } from "@/server/organfragen";
import { asAppError } from "@/lib/errors";
import { AnfrageZeile } from "@/components/org/anfrage-zeile";

/* Der Posteingang einer Organisation (P5.7 §6, §35) — kein erfundener
   Bearbeitungsstand, nur was inquiry tatsächlich hergibt. */
export const dynamic = "force-dynamic";
const PRO_SEITE = 25;

export default async function OrgAnfragenSeite({ params, searchParams }:
  { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ seite?: string }> }) {
  const { locale: roh, slug } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const { seite: seiteRoh } = await searchParams;
  const s = await sitzung();
  if (!s) notFound();
  const t = uebersetzer(locale);

  let kontext;
  try { kontext = await verlangeOrgRecht(s.person, slug, "VIEW_INQUIRIES"); }
  catch (e) { if (asAppError(e).code === "NOT_FOUND") notFound(); throw e; }

  const seite = Number(seiteRoh ?? "1") || 1;
  const uebersicht = await orgAnfragen(kontext, seite);
  const letzteSeite = Math.max(1, Math.ceil(uebersicht.total / PRO_SEITE));

  return (
    <div>
      <h3 style={{ fontSize: ".95rem" }}>{t("og_anfragenTitel")}</h3>
      {uebersicht.zeilen.length === 0 ? (
        <p style={{ color: "var(--leise)", marginTop: 16 }}>{t("og_anfragenLeer")}</p>
      ) : (
        <>
          <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0" }}>
            {uebersicht.zeilen.map(a => {
              const objektHref = a.listing ? `/${locale}/vorschau/${a.listing.publicRef.toLowerCase()}` : null;
              return (
                <AnfrageZeile key={a.publicRef} a={a} objektHref={objektHref}
                  t={{ og_thObjekt: t("og_thObjekt"), og_thDatum: t("og_thDatum"), og_thAbsender: t("og_thAbsender"),
                    og_thNachricht: t("og_thNachricht"), og_mehrLesen: t("og_mehrLesen"), og_wenigerLesen: t("og_wenigerLesen"),
                    og_objektNichtVerfuegbar: t("og_objektNichtVerfuegbar"), og_thZugewiesen: t("og_thZugewiesen") }} />
              );
            })}
          </ul>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
            <a className="knopf leise" href={`?seite=${Math.max(1, seite - 1)}`} aria-disabled={seite <= 1} style={seite <= 1 ? { pointerEvents: "none", opacity: .4 } : undefined}>{t("w_zurueck")}</a>
            <span style={{ color: "var(--leise)", fontSize: ".82rem" }}>{t("og_seite")} {seite} / {letzteSeite}</span>
            <a className="knopf leise" href={`?seite=${Math.min(letzteSeite, seite + 1)}`} aria-disabled={!uebersicht.hatMehr} style={!uebersicht.hatMehr ? { pointerEvents: "none", opacity: .4 } : undefined}>{t("w_weiter")}</a>
          </div>
        </>
      )}
    </div>
  );
}
