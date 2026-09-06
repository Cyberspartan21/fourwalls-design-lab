import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { istLocale, DEFAULT_LOCALE, uebersetzer, LOCALES, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { fallLesen, GRUENDE } from "@/server/moderation";
import { fehlend } from "@/domain/entwurf";
import { darf, istEigentuemer } from "@/domain/rechte";
import { Kopf } from "@/components/site/kopf";
import { ModerationsAktionen } from "@/components/moderation/aktionen";
import { asAppError } from "@/lib/errors";
import { NOINDEX } from "@/lib/seo";

/* Ein Fall: was eingereicht wurde, wer es war, was fehlt — und die Entscheide. */
export const dynamic = "force-dynamic";

/* NOINDEX (Moderation, P5.9 Phase B) — Titel ohne erneuten fallLesen()-Aufruf. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string; ref: string }> }): Promise<Metadata> {
  const { locale: roh, ref } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  return { ...NOINDEX, title: `${uebersetzer(locale)("m_titel")} · ${ref.toUpperCase()}` };
}

export default async function Fall({ params }: { params: Promise<{ locale: string; ref: string }> }) {
  const { locale: roh, ref } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  if (!s) redirect(`/${locale}/konto/anmelden?weiter=${encodeURIComponent(`/${locale}/moderation/${ref}`)}`);
  if (!darf(s.person.rolle, "REVIEW_LISTING")) redirect(`/${locale}/konto`);
  const t = uebersetzer(locale);

  const f = await fallOderNull(s.person, ref.toUpperCase());
  if (!f) notFound();
  {
    const maengel = fehlend(f.daten);
    const eigenes = istEigentuemer(s.person, { ownerId: null, status: f.status }) ||
      f.herausgeber.email === s.email;   // Sicht: die Aktionen prüft ohnehin der Server
    const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}/moderation/${ref}`])) as Record<Locale, string>;
    const gruende = GRUENDE.map(g => ({ wert: g, label: t("g_" + g) }));

    return (
      <>
        <Kopf locale={locale} sprachLinks={sprachLinks} />
        <main id="inhalt" className="wiz an" style={{ maxWidth: 1100 }}>
          <span className="schrittz">{t("m_titel")} · {f.publicRef} · {t("st_" + f.status)}</span>
          <h2>{f.daten.titel ?? f.publicRef}</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginTop: 18 }}>
            <Feld label={t("m_herausgeber")}>
              {f.herausgeber.name}<br />
              <span style={{ color: "var(--leise)", fontSize: ".82rem" }}>{f.herausgeber.email}</span><br />
              <span style={{ color: f.herausgeber.bestaetigt ? "var(--leise)" : "var(--warn)", fontSize: ".78rem" }}>
                {f.herausgeber.bestaetigt ? t("k_emailBestaetigt") : t("k_emailUnbestaetigt")} · {f.herausgeber.inserate} {t("k_meineInserate")}
              </span>
            </Feld>
            <Feld label={t("m_eingereichtAm")}>{f.eingereicht ? f.eingereicht.slice(0, 16).replace("T", " ") : "—"}</Feld>
            <Feld label={t("m_lagegenauigkeit")}>{f.ort ?? "—"} · {genauigkeitWort(f.genauigkeit, t)}</Feld>
            <Feld label={t("m_vollstaendigkeit")}>
              {maengel.length === 0 ? t("w_bereit") : <span style={{ color: "var(--warn)" }}>{maengel.map(m => t("w_feld_" + m.feld) || m.feld).join(", ")}</span>}
            </Feld>
          </div>

          <div style={{ marginTop: 22 }}>
            <a className="knopf" href={`/${locale}/vorschau/${ref}`}>{t("k_vorschau")}</a>
          </div>

          {f.bilder.length > 0 && (
            <div className="fld" style={{ marginTop: 22 }}>
              <label>{t("w_bilderZahl")} ({f.bilder.length})</label>
              <div className="bildwahl">
                {f.bilder.map(b => <div key={b.id} style={{ aspectRatio: "4/3", overflow: "hidden", border: "1px solid var(--linie)", borderRadius: "var(--r)" }}>
                  <img src={`/api/medien/${b.id}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>)}
              </div>
            </div>
          )}

          <div className="fld" style={{ marginTop: 22 }}>
            <label>{t("w_beschreibung")}</label>
            <p style={{ whiteSpace: "pre-wrap", maxWidth: "70ch" }}>{f.daten.beschreibung ?? "—"}</p>
          </div>

          {eigenes ? (
            <div className="hinweisbox" style={{ marginTop: 24 }} role="status">{t("m_eigenesInserat")}</div>
          ) : (
            <ModerationsAktionen publicRef={f.publicRef} status={f.status} gruende={gruende} locale={locale}
              t={Object.fromEntries(["m_freigeben", "m_veroeffentlichen", "m_freigebenUndVeroeffentlichen", "m_aenderung", "m_ablehnen",
                "m_grund", "m_nachrichtAnPerson", "m_nachrichtHin", "w_speichert", "w_speicherFehler"].map(k => [k, t(k)]))} />
          )}

          <div className="fld" style={{ marginTop: 30 }}>
            <label>{t("m_verlauf")}</label>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: ".86rem" }}>
              {f.verlauf.map((v, n) => (
                <li key={n} style={{ borderTop: "1px solid var(--linie)", padding: "8px 0", display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ color: "var(--leise)", fontVariantNumeric: "tabular-nums", minWidth: 130 }}>{v.zeit.slice(0, 16).replace("T", " ")}</span>
                  <span>{v.von ? `${t("st_" + v.von)} → ` : ""}{v.nach ? t("st_" + v.nach) : v.aktion}</span>
                  {v.grund && <span style={{ color: "var(--leise)" }}>{v.grund}</span>}
                  <span style={{ color: "var(--leise)", marginLeft: "auto" }}>{v.wer ?? "—"}</span>
                </li>
              ))}
            </ul>
          </div>
        </main>
      </>
    );
  }
}

async function fallOderNull(person: Parameters<typeof fallLesen>[0], publicRef: string) {
  try { return await fallLesen(person, publicRef); }
  catch (e) { if (asAppError(e).code === "NOT_FOUND") return null; throw e; }
}

function Feld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: ".62rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--leise)", marginBottom: 4 }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

/* Die Datenbank führt die Genauigkeit englisch (exact/approximate/municipality).
   Die Moderationsansicht ist Oberfläche und spricht die Sprache der Person. */
function genauigkeitWort(wert: string, t: (k: string) => string): string {
  if (wert === "municipality") return t("w_lageGemeinde");
  if (wert === "approximate") return t("w_lageUngefaehr");
  if (wert === "exact") return t("w_lageExakt");
  return wert;
}
