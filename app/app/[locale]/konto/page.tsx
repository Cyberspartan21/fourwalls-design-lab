import { redirect } from "next/navigation";
import { istLocale, uebersetzer, DEFAULT_LOCALE, PFAD, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { meineInserate } from "@/server/entwuerfe";
import { getPlace } from "@/server/geo";
import { arbeitstitel } from "@/domain/entwurf";
import { darf } from "@/domain/rechte";
import { KontoRahmen } from "./kopfzeile";
import { AbmeldeKnopf, BestaetigungErneut } from "@/components/konto/formulare";

/* Meine Inserate — die Liste, aus der jede weitere Handlung startet.

   Bewusst klein gehalten: P5.4 braucht die Lieferkette, nicht das ganze
   künftige Kontocenter (§20). Merkliste und Suchabos bleiben lokal im
   Browser, wie in P5.3; ihre Übernahme ins Konto gehört zu einer späteren
   Phase. */
export const dynamic = "force-dynamic";

const AMPEL: Record<string, string> = {
  draft: "var(--leise)", submitted: "var(--licht)", in_review: "var(--licht)",
  changes_required: "var(--warn)", approved: "var(--licht)", published: "var(--gut, #7FA66B)",
  paused: "var(--leise)", rejected: "var(--warn)", archived: "var(--leise)"
};

export default async function Konto({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  if (!s) redirect(`/${locale}/konto/anmelden?weiter=${encodeURIComponent(`/${locale}/konto`)}`);
  const t = uebersetzer(locale);
  const inserate = await meineInserate(s.person);
  const p = PFAD[locale];

  const orte = new Map<string, string>();
  for (const i of inserate) {
    if (i.daten.ortId && !orte.has(i.daten.ortId)) {
      const o = await getPlace(i.daten.ortId, locale);
      if (o) orte.set(i.daten.ortId, o.label);
    }
  }

  return (
    <KontoRahmen locale={locale} titel={t("k_meineInserate")} breit>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
        <span style={{ color: "var(--leise)", fontSize: ".85rem" }}>{s.name} · {s.email}</span>
        {darf(s.person.rolle, "VIEW_MODERATION_QUEUE") && <a className="knopf" href={`/${locale}/moderation`}>{t("m_titel")}</a>}
        <AbmeldeKnopf t={{ k_abmelden: t("k_abmelden") }} weiter={`/${locale}`} />
      </div>

      {!s.person.emailBestaetigt && (
        <div style={{ marginTop: 18 }}>
          <BestaetigungErneut t={{ k_emailUnbestaetigt: t("k_emailUnbestaetigt"), k_emailBestaetigenHin: t("k_emailBestaetigenHin"), k_erneutSenden: t("k_erneutSenden"), k_pruefenMail: t("k_pruefenMail") }} email={s.email} />
        </div>
      )}

      <div style={{ marginTop: 26, display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <a className="knopf voll" href={`/${locale}/inserieren`}>{t("k_neuesInserat")}</a>
      </div>

      {inserate.length === 0 ? (
        <p style={{ color: "var(--leise)", marginTop: 16 }}>{t("k_keineInserate")}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0" }}>
          {inserate.map(i => {
            const titel = arbeitstitel(i.daten, orte.get(i.daten.ortId ?? "") ?? null, t);
            const bearbeitbar = ["draft", "changes_required", "rejected"].includes(i.status);
            const oeffentlich = ["published", "reserved"].includes(i.status);
            const pfad = i.daten.trans === "rent" ? p.mieten : p.kaufen;
            return (
              <li key={i.publicRef} style={{ borderTop: "1px solid var(--linie)", padding: "16px 0" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ fontSize: ".62rem", letterSpacing: ".14em", textTransform: "uppercase", color: AMPEL[i.status] ?? "var(--leise)" }}>{t("st_" + i.status)}</span>
                  <b style={{ fontSize: "1.02rem", fontWeight: 500 }}>{titel}</b>
                  <span style={{ color: "var(--leise)", fontSize: ".78rem", fontVariantNumeric: "tabular-nums" }}>{i.publicRef}</span>
                </div>
                {i.status === "changes_required" && i.rueckmeldung && (
                  <div className="hinweisbox" style={{ marginTop: 10 }}>
                    <b>{t("w_rueckmeldung")}</b>
                    <p style={{ marginTop: 4 }}>{i.rueckmeldung.nachricht}</p>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  {bearbeitbar && <a className="knopf" href={`/${locale}/inserieren/${i.publicRef.toLowerCase()}`}>{t("k_bearbeiten")}</a>}
                  <a className="knopf leise" href={`/${locale}/vorschau/${i.publicRef.toLowerCase()}`}>{t("k_vorschau")}</a>
                  {oeffentlich && <a className="knopf leise" href={`/${locale}/${p.immobilien}/${pfad}/${i.daten.titel ? "" : ""}${slugOderRef(i)}`}>{t("k_ansehen")}</a>}
                  <span style={{ color: "var(--leise)", fontSize: ".78rem", alignSelf: "center", marginLeft: "auto" }}>
                    {t("k_zuletztGeaendert")}: {i.aktualisiert.slice(0, 10)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </KontoRahmen>
  );
}

/* Die öffentliche Adresse ist <slug>-<referenz>; den Slug vergibt die
   Veröffentlichung. Bis dahin genügt die Referenz. */
function slugOderRef(i: { publicRef: string; daten: { titel: string | null } }): string {
  return `${(i.daten.titel ?? "inserat").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}-${i.publicRef.toLowerCase()}`;
}
