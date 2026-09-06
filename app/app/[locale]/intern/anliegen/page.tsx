import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { istLocale, DEFAULT_LOCALE, uebersetzer, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { leadListe, type LeadFilter } from "@/server/anliegen";
import { DIENSTE, DIENST_LABEL, type Dienst } from "@/domain/anliegen";
import { darf } from "@/domain/rechte";
import { InternRahmen } from "@/components/intern/intern-rahmen";
import { NOINDEX } from "@/lib/seo";

/* Die Übersicht der Anliegen von Eigentümerinnen an FOURWALLS (P5.8 §24–§27,
   §80) — serverseitig gefiltert und geblättert über Query-Parameter. Tabelle
   auf Desktop, Karten auf dem Handy (dieselben Daten, .org-tabelle-wrap/
   .org-karten aus styles/portal.css — ein generisches Muster, kein
   Organisations-Detail). Kein CRM: keine Notizen, keine Aufgaben, kein
   Scoring — nur, was hier ohnehin ansteht. */
export const dynamic = "force-dynamic";

/* NOINDEX (interner Bereich, P5.9 Phase B). */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  return { ...NOINDEX, title: uebersetzer(locale)("in_titelListe") };
}

const STATUS_WERTE = ["new", "contacted", "qualified", "closed", "declined"] as const;
const LOCALE_WERTE = ["de", "fr", "it", "en"] as const;

type SP = { status?: string; service?: string; locale?: string; q?: string; seite?: string };

export default async function InternAnliegenSeite({ params, searchParams }:
  { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const sp = await searchParams;
  const s = await sitzung();
  if (!s) redirect(`/${locale}/konto/anmelden?weiter=${encodeURIComponent(`/${locale}/intern/anliegen`)}`);
  if (!darf(s.person.rolle, "VIEW_SERVICE_LEADS")) notFound();
  const t = uebersetzer(locale);

  const statusRoh = sp.status ?? "";
  const serviceRoh = sp.service ?? "";
  const localeRoh = sp.locale ?? "";
  const filter: LeadFilter = {
    status: (STATUS_WERTE as readonly string[]).includes(statusRoh) ? statusRoh : "",
    service: (DIENSTE as readonly string[]).includes(serviceRoh) ? serviceRoh : "",
    locale: (LOCALE_WERTE as readonly string[]).includes(localeRoh) ? localeRoh : "",
    q: sp.q ?? "",
    seite: Number(sp.seite ?? "1") || 1
  };

  const uebersicht = await leadListe(filter);
  const letzteSeite = Math.max(1, Math.ceil(uebersicht.total / uebersicht.proSeite));

  const basisParams = new URLSearchParams();
  if (filter.status) basisParams.set("status", filter.status);
  if (filter.service) basisParams.set("service", filter.service);
  if (filter.locale) basisParams.set("locale", filter.locale);
  if (filter.q) basisParams.set("q", filter.q);
  function seiteHref(seite: number): string {
    const p = new URLSearchParams(basisParams);
    p.set("seite", String(seite));
    return `?${p.toString()}`;
  }

  const dienstLabel = (d: string) => DIENST_LABEL[locale][d as Dienst] ?? d;
  const statusLabel = (st: string) => t("in_status_" + st);

  return (
    <InternRahmen locale={locale} titel={t("in_titelListe")} lead={t("in_leadListe")}>
      <form method="get" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20, alignItems: "flex-end" }}>
        <div className="fld" style={{ margin: 0 }}>
          <label htmlFor="fStatus">{t("in_filterStatus")}</label>
          <select className="feld" id="fStatus" name="status" defaultValue={filter.status}>
            <option value="">{t("in_filterAlle")}</option>
            {STATUS_WERTE.map(st => <option key={st} value={st}>{statusLabel(st)}</option>)}
          </select>
        </div>
        <div className="fld" style={{ margin: 0 }}>
          <label htmlFor="fService">{t("in_filterDienst")}</label>
          <select className="feld" id="fService" name="service" defaultValue={filter.service}>
            <option value="">{t("in_filterAlle")}</option>
            {DIENSTE.map(d => <option key={d} value={d}>{dienstLabel(d)}</option>)}
          </select>
        </div>
        <div className="fld" style={{ margin: 0 }}>
          <label htmlFor="fLocale">{t("in_filterSprache")}</label>
          <select className="feld" id="fLocale" name="locale" defaultValue={filter.locale}>
            <option value="">{t("in_filterAlle")}</option>
            {LOCALE_WERTE.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="fld" style={{ margin: 0 }}>
          <label htmlFor="fQ">{t("in_filterSuche")}</label>
          <input className="feld" id="fQ" type="text" name="q" defaultValue={filter.q} />
        </div>
        <button className="knopf" type="submit">{t("in_filternKnopf")}</button>
      </form>

      {uebersicht.zeilen.length === 0 ? (
        <p style={{ color: "var(--leise)", marginTop: 18 }}>{t("in_keineAnliegen")}</p>
      ) : (
        <>
          <div className="org-tabelle-wrap">
            <table className="org-tabelle">
              <thead>
                <tr>
                  <th scope="col">{t("in_thReferenz")}</th>
                  <th scope="col">{t("in_thDienst")}</th>
                  <th scope="col">{t("in_thDatum")}</th>
                  <th scope="col">{t("in_thKontakt")}</th>
                  <th scope="col">{t("in_thOrt")}</th>
                  <th scope="col">{t("in_thStatus")}</th>
                  <th scope="col">{t("in_thZustaendig")}</th>
                </tr>
              </thead>
              <tbody>
                {uebersicht.zeilen.map(z => (
                  <tr key={z.publicRef}>
                    <td>
                      <a href={`/${locale}/intern/anliegen/${z.publicRef.toLowerCase()}`} style={{ fontWeight: 500 }}>{z.publicRef}</a>
                    </td>
                    <td>{dienstLabel(z.service)}</td>
                    <td style={{ color: "var(--leise)", fontSize: ".82rem" }}>{z.createdAt.slice(0, 10)}</td>
                    <td>
                      {z.contactName}
                      <div style={{ color: "var(--leise)", fontSize: ".76rem" }}>{z.contactEmail}</div>
                    </td>
                    <td>{z.ort ?? "—"}{z.typ ? ` · ${z.typ}` : ""}</td>
                    <td><span style={{ fontSize: ".62rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--leise)" }}>{statusLabel(z.status)}</span></td>
                    <td>{z.assignedStaff?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="org-karten">
            {uebersicht.zeilen.map(z => (
              <li key={z.publicRef} className="org-karte">
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ fontSize: ".62rem", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--leise)" }}>{statusLabel(z.status)}</span>
                  <a href={`/${locale}/intern/anliegen/${z.publicRef.toLowerCase()}`} style={{ fontWeight: 500 }}>{z.publicRef}</a>
                </div>
                <div style={{ color: "var(--leise)", fontSize: ".78rem", marginTop: 4 }}>
                  {dienstLabel(z.service)} · {z.createdAt.slice(0, 10)}
                </div>
                <div style={{ marginTop: 6 }}>
                  {z.contactName} — {z.contactEmail}
                </div>
                <div style={{ color: "var(--leise)", fontSize: ".82rem", marginTop: 4 }}>
                  {z.ort ?? "—"}{z.typ ? ` · ${z.typ}` : ""} · {t("in_thZustaendig")}: {z.assignedStaff?.name ?? "—"}
                </div>
              </li>
            ))}
          </ul>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
            <a className="knopf leise" href={seiteHref(Math.max(1, filter.seite - 1))} aria-disabled={filter.seite <= 1} style={filter.seite <= 1 ? { pointerEvents: "none", opacity: .4 } : undefined}>{t("w_zurueck")}</a>
            <span style={{ color: "var(--leise)", fontSize: ".82rem" }}>{filter.seite} / {letzteSeite}</span>
            <a className="knopf leise" href={seiteHref(Math.min(letzteSeite, filter.seite + 1))} aria-disabled={!uebersicht.hatMehr} style={!uebersicht.hatMehr ? { pointerEvents: "none", opacity: .4 } : undefined}>{t("w_weiter")}</a>
          </div>
        </>
      )}
    </InternRahmen>
  );
}
