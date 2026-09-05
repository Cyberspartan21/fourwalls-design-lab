import { notFound } from "next/navigation";
import { istLocale, uebersetzer, DEFAULT_LOCALE, PFAD, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { verlangeOrgRecht } from "@/server/org-kontext";
import { orgInserate, type OrgInseratFilter, type OrgInseratZeile } from "@/server/orginserate";
import { mitglieder } from "@/server/organisationen";
import { orgDarf } from "@/domain/orgrechte";
import type { Status } from "@/domain/rechte";
import { asAppError } from "@/lib/errors";
import { NeuesInseratKnopf } from "@/components/org/neues-inserat-knopf";
import { ZuweisenAuswahl } from "@/components/org/zuweisen-auswahl";

/* Die Inseratsliste einer Organisation (P5.7 §4) — serverseitig gefiltert
   und geblättert über Query-Parameter. Tabelle auf Desktop, Karten auf dem
   Handy (dieselben Daten, siehe .org-tabelle-wrap/.org-karten in
   styles/portal.css) — keine schrumpfende Desktop-Tabelle (§46). */
export const dynamic = "force-dynamic";

const STATUS_WERTE = ["draft", "submitted", "in_review", "changes_required", "approved", "published", "paused", "reserved", "sold", "rented", "expired", "archived", "rejected"] as const;
const AMPEL: Record<string, string> = {
  draft: "var(--leise)", submitted: "var(--licht)", in_review: "var(--licht)",
  changes_required: "var(--warn)", approved: "var(--licht)", published: "var(--gut, #7FA66B)",
  paused: "var(--leise)", rejected: "var(--warn)", archived: "var(--leise)"
};
const BEARBEITBAR = ["draft", "changes_required", "rejected"];
const OEFFENTLICH = ["published", "reserved"];

function slugify(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
function ansehenHref(locale: Locale, slug: string, z: OrgInseratZeile): string {
  const p = PFAD[locale];
  const art = z.trans === "rent" ? p.mieten : p.kaufen;
  const kernSlug = slugify(z.titel || "inserat") || "inserat";
  return `/${locale}/${p.immobilien}/${art}/${kernSlug}-${z.publicRef.toLowerCase()}`;
}

type SP = { q?: string; status?: string; zugewiesen?: string; trans?: string; sort?: string; seite?: string };

export default async function OrgInserateSeite({ params, searchParams }:
  { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<SP> }) {
  const { locale: roh, slug } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const sp = await searchParams;
  const s = await sitzung();
  if (!s) notFound();
  const t = uebersetzer(locale);

  let kontext;
  try { kontext = await verlangeOrgRecht(s.person, slug, "VIEW_ORG_LISTINGS"); }
  catch (e) { if (asAppError(e).code === "NOT_FOUND") notFound(); throw e; }

  const statusRoh = sp.status ?? "";
  const filter: OrgInseratFilter = {
    q: sp.q ?? "",
    status: (STATUS_WERTE as readonly string[]).includes(statusRoh) ? (statusRoh as Status | "") : "",
    zugewiesen: sp.zugewiesen ?? "",
    trans: sp.trans === "sale" || sp.trans === "rent" ? sp.trans : "",
    seite: Number(sp.seite ?? "1") || 1,
    ...(sp.sort === "aktualisiert" || sp.sort === "status" || sp.sort === "titel" ? { sort: sp.sort } : {})
  };

  const darfZuweisen = orgDarf(kontext.mitglied.rolle, "ASSIGN_LISTING");
  const [uebersicht, team] = await Promise.all([
    orgInserate(kontext, filter),
    darfZuweisen ? mitglieder(kontext) : Promise.resolve(null)
  ]);
  const mitgliederOptionen = team?.mitglieder.filter(m => m.isActive).map(m => ({ userId: m.userId, name: m.name })) ?? [];

  const PRO_SEITE = 25;
  const letzteSeite = Math.max(1, Math.ceil(uebersicht.total / PRO_SEITE));
  const basisParams = new URLSearchParams();
  if (filter.q) basisParams.set("q", filter.q);
  if (filter.status) basisParams.set("status", filter.status);
  if (filter.zugewiesen) basisParams.set("zugewiesen", filter.zugewiesen);
  if (filter.trans) basisParams.set("trans", filter.trans);
  if (filter.sort) basisParams.set("sort", filter.sort);
  function seiteHref(seite: number): string {
    const p = new URLSearchParams(basisParams);
    p.set("seite", String(seite));
    return `?${p.toString()}`;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: ".95rem" }}>{t("og_inserateTitel")}</h3>
        {orgDarf(kontext.mitglied.rolle, "CREATE_LISTING") && (
          <NeuesInseratKnopf locale={locale} slug={slug} label={t("og_neuesInserat")} />
        )}
      </div>

      <form method="get" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16, alignItems: "flex-end" }}>
        <div className="fld" style={{ margin: 0 }}>
          <label htmlFor="fQ">{t("og_filterSuche")}</label>
          <input className="feld" id="fQ" type="text" name="q" defaultValue={filter.q} />
        </div>
        <div className="fld" style={{ margin: 0 }}>
          <label htmlFor="fStatus">{t("og_filterStatus")}</label>
          <select className="feld" id="fStatus" name="status" defaultValue={filter.status}>
            <option value="">{t("og_filterAlle")}</option>
            {STATUS_WERTE.map(st => <option key={st} value={st}>{t("st_" + st)}</option>)}
          </select>
        </div>
        <div className="fld" style={{ margin: 0 }}>
          <label htmlFor="fTrans">{t("og_filterTransaktion")}</label>
          <select className="feld" id="fTrans" name="trans" defaultValue={filter.trans}>
            <option value="">{t("og_filterAlle")}</option>
            <option value="sale">{t("w_verkaufen")}</option>
            <option value="rent">{t("w_vermieten")}</option>
          </select>
        </div>
        <div className="fld" style={{ margin: 0 }}>
          <label htmlFor="fZugewiesen">{t("og_filterZugewiesen")}</label>
          <select className="feld" id="fZugewiesen" name="zugewiesen" defaultValue={filter.zugewiesen}>
            <option value="">{t("og_filterAlle")}</option>
            <option value="keine">{t("og_filterUnzugewiesen")}</option>
            {mitgliederOptionen.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
          </select>
        </div>
        <div className="fld" style={{ margin: 0 }}>
          <label htmlFor="fSort">{t("og_filterSortierung")}</label>
          <select className="feld" id="fSort" name="sort" defaultValue={filter.sort ?? "aktualisiert"}>
            <option value="aktualisiert">{t("og_sortAktualisiert")}</option>
            <option value="status">{t("og_sortStatus")}</option>
            <option value="titel">{t("og_sortTitel")}</option>
          </select>
        </div>
        <button className="knopf" type="submit">{t("og_filternKnopf")}</button>
      </form>

      {uebersicht.zeilen.length === 0 ? (
        <p style={{ color: "var(--leise)", marginTop: 18 }}>{t("og_keineInserate")}</p>
      ) : (
        <>
          <div className="org-tabelle-wrap">
            <table className="org-tabelle">
              <thead>
                <tr>
                  <th scope="col">{t("og_thTitel")}</th>
                  <th scope="col">{t("og_thStatus")}</th>
                  <th scope="col">{t("og_thTransaktion")}</th>
                  <th scope="col">{t("og_thOrt")}</th>
                  <th scope="col">{t("og_thZugewiesen")}</th>
                  <th scope="col">{t("og_thAktualisiert")}</th>
                  <th scope="col">{t("og_thAktionen")}</th>
                </tr>
              </thead>
              <tbody>
                {uebersicht.zeilen.map(z => (
                  <tr key={z.publicRef}>
                    <td>
                      <b style={{ fontWeight: 500 }}>{z.titel || z.publicRef}</b>
                      <div style={{ color: "var(--leise)", fontSize: ".76rem", fontVariantNumeric: "tabular-nums" }}>{z.publicRef}</div>
                    </td>
                    <td><span style={{ fontSize: ".62rem", letterSpacing: ".1em", textTransform: "uppercase", color: AMPEL[z.status] ?? "var(--leise)" }}>{t("st_" + z.status)}</span></td>
                    <td>{z.trans === "rent" ? t("w_vermieten") : z.trans === "sale" ? t("w_verkaufen") : "—"}</td>
                    <td>{z.ort ?? "—"}</td>
                    <td>
                      {darfZuweisen ? (
                        <ZuweisenAuswahl slug={slug} publicRef={z.publicRef} aktuell={z.zugewiesen?.id ?? null}
                          mitglieder={mitgliederOptionen} label={t("og_zuweisenLabel")} unzugewiesenLabel={t("og_zuweisenNiemand")} />
                      ) : (z.zugewiesen?.name ?? "—")}
                    </td>
                    <td style={{ color: "var(--leise)", fontSize: ".82rem" }}>{z.aktualisiert.slice(0, 10)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {BEARBEITBAR.includes(z.status) && <a className="knopf leise" href={`/${locale}/inserieren/${z.publicRef.toLowerCase()}`}>{t("k_bearbeiten")}</a>}
                        <a className="knopf leise" href={`/${locale}/vorschau/${z.publicRef.toLowerCase()}`}>{t("k_vorschau")}</a>
                        {OEFFENTLICH.includes(z.status) && <a className="knopf leise" href={ansehenHref(locale, slug, z)}>{t("k_ansehen")}</a>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="org-karten">
            {uebersicht.zeilen.map(z => (
              <li key={z.publicRef} className="org-karte">
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ fontSize: ".62rem", letterSpacing: ".1em", textTransform: "uppercase", color: AMPEL[z.status] ?? "var(--leise)" }}>{t("st_" + z.status)}</span>
                  <b style={{ fontWeight: 500 }}>{z.titel || z.publicRef}</b>
                </div>
                <div style={{ color: "var(--leise)", fontSize: ".78rem", marginTop: 4 }}>
                  {z.ort ?? "—"} · {z.trans === "rent" ? t("w_vermieten") : z.trans === "sale" ? t("w_verkaufen") : "—"} · {z.aktualisiert.slice(0, 10)}
                </div>
                <div style={{ marginTop: 10 }}>
                  {darfZuweisen ? (
                    <ZuweisenAuswahl slug={slug} publicRef={z.publicRef} aktuell={z.zugewiesen?.id ?? null}
                      mitglieder={mitgliederOptionen} label={t("og_zuweisenLabel")} unzugewiesenLabel={t("og_zuweisenNiemand")} />
                  ) : (
                    <span style={{ fontSize: ".82rem", color: "var(--leise)" }}>{t("og_thZugewiesen")}: {z.zugewiesen?.name ?? "—"}</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {BEARBEITBAR.includes(z.status) && <a className="knopf leise" href={`/${locale}/inserieren/${z.publicRef.toLowerCase()}`}>{t("k_bearbeiten")}</a>}
                  <a className="knopf leise" href={`/${locale}/vorschau/${z.publicRef.toLowerCase()}`}>{t("k_vorschau")}</a>
                  {OEFFENTLICH.includes(z.status) && <a className="knopf leise" href={ansehenHref(locale, slug, z)}>{t("k_ansehen")}</a>}
                </div>
              </li>
            ))}
          </ul>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
            <a className="knopf leise" href={seiteHref(Math.max(1, filter.seite - 1))} aria-disabled={filter.seite <= 1} style={filter.seite <= 1 ? { pointerEvents: "none", opacity: .4 } : undefined}>{t("w_zurueck")}</a>
            <span style={{ color: "var(--leise)", fontSize: ".82rem" }}>{t("og_seite")} {filter.seite} / {letzteSeite}</span>
            <a className="knopf leise" href={seiteHref(Math.min(letzteSeite, filter.seite + 1))} aria-disabled={!uebersicht.hatMehr} style={!uebersicht.hatMehr ? { pointerEvents: "none", opacity: .4 } : undefined}>{t("w_weiter")}</a>
          </div>
        </>
      )}
    </div>
  );
}
