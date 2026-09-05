import { redirect } from "next/navigation";
import { istLocale, uebersetzer, DEFAULT_LOCALE, PFAD, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { meineInserate } from "@/server/entwuerfe";
import { getPlace } from "@/server/geo";
import { arbeitstitel } from "@/domain/entwurf";
import { darf } from "@/domain/rechte";
import { KontoRahmen } from "./kopfzeile";
import { AbmeldeKnopf, BestaetigungErneut } from "@/components/konto/formulare";
import { meineAnfragen } from "@/server/inquiries";
import { listeFavoriten } from "@/server/favoriten";
import { meineSuchen } from "@/server/gespeicherteSuchen";
import { meineOrganisationen } from "@/server/org-kontext";

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

/* Eine Kachel der Übersicht — Zahl + Beschriftung, verlinkt auf die
   zugehörige Kontounterseite. Nur reale, aus der Datenbank gezählte Zahlen
   (§Auftrag) — nichts, was es serverseitig nicht gibt. */
export function Kachel({ href, zahl, label }: { href: string; zahl: number; label: string }) {
  return (
    <a href={href} style={{ display: "block", padding: "14px 16px", border: "1px solid var(--linie)", borderRadius: "var(--r)", textDecoration: "none", color: "inherit" }}>
      <div style={{ fontSize: "1.6rem", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{zahl}</div>
      <div style={{ fontSize: ".78rem", color: "var(--leise)", marginTop: 2 }}>{label}</div>
    </a>
  );
}

export default async function Konto({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  if (!s) redirect(`/${locale}/konto/anmelden?weiter=${encodeURIComponent(`/${locale}/konto`)}`);
  const t = uebersetzer(locale);
  const inserate = await meineInserate(s.person);
  const p = PFAD[locale];
  const anfragen = await meineAnfragen(s.person.id);
  const merkliste = await listeFavoriten(s.person.id);
  const suchabos = await meineSuchen(s.person.id);
  const organisationen = await meineOrganisationen(s.person.id);

  const statusZaehlung = new Map<string, number>();
  for (const i of inserate) statusZaehlung.set(i.status, (statusZaehlung.get(i.status) ?? 0) + 1);
  const statusText = [...statusZaehlung.entries()].map(([st, n]) => `${n} ${t("st_" + st)}`).join(" · ");

  const orte = new Map<string, string>();
  for (const i of inserate) {
    if (i.daten.ortId && !orte.has(i.daten.ortId)) {
      const o = await getPlace(i.daten.ortId, locale);
      if (o) orte.set(i.daten.ortId, o.label);
    }
  }

  return (
    <KontoRahmen locale={locale} titel={t("k_meineInserate")} breit nav aktiv="uebersicht">
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
        <span style={{ color: "var(--leise)", fontSize: ".85rem" }}>{s.name} · {s.email}</span>
        <a className="knopf" href={`/${locale}/konto/favoriten`}>{t("fv_navLink")}</a>
        {darf(s.person.rolle, "VIEW_MODERATION_QUEUE") && <a className="knopf" href={`/${locale}/moderation`}>{t("m_titel")}</a>}
        <a className="knopf" href={`/${locale}/konto/suchabos`}>{t("k_gespeicherteSuchen")}</a>
        <AbmeldeKnopf t={{ k_abmelden: t("k_abmelden") }} weiter={`/${locale}`} />
      </div>

      <h3 style={{ marginTop: 30, fontSize: ".95rem" }}>{t("k_uebersicht")}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginTop: 12 }}>
        <Kachel href={`/${locale}/konto`} zahl={inserate.length} label={statusText ? `${t("k_meineInserate")} — ${statusText}` : t("k_meineInserate")} />
        <Kachel href={`/${locale}/konto/favoriten`} zahl={merkliste.length} label={t("fv_navLink")} />
        <Kachel href={`/${locale}/konto/anfragen`} zahl={anfragen.length} label={t("af_titel")} />
        <Kachel href={`/${locale}/konto/suchabos`} zahl={suchabos.length} label={t("k_gespeicherteSuchen")} />
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

      {/* Getrennter Bereich (§19/§45): eigene Organisationen sind kein
          zweites Login, nur eine andere Rolle innerhalb derselben Person.
          Die Organisationsnavigation selbst lebt im OrgRahmen. */}
      <div style={{ marginTop: 46, borderTop: "1px solid var(--linie)", paddingTop: 24 }}>
        <h3 style={{ fontSize: ".95rem" }}>{t("og_professionell")}</h3>
        {organisationen.length === 0 ? (
          <p style={{ color: "var(--leise)", marginTop: 10 }}>
            {t("og_keineOrganisation")} <a className="knopf" style={{ marginLeft: 8 }} href={`/${locale}/konto/org/neu`}>{t("og_organisationAnlegen")}</a>
          </p>
        ) : (
          <>
            <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
              {organisationen.map(o => (
                <li key={o.org.slug} style={{ borderTop: "1px solid var(--linie)", padding: "12px 0", display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                  <a href={`/${locale}/konto/org/${o.org.slug}`} style={{ fontWeight: 500 }}>{o.org.displayName}</a>
                  <span style={{ color: "var(--leise)", fontSize: ".78rem" }}>{t("og_rolle_" + o.rolle)}</span>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 16 }}>
              <a className="knopf" href={`/${locale}/konto/org/neu`}>{t("og_organisationAnlegen")}</a>
            </div>
          </>
        )}
      </div>
    </KontoRahmen>
  );
}

/* Die öffentliche Adresse ist <slug>-<referenz>; den Slug vergibt die
   Veröffentlichung. Bis dahin genügt die Referenz. */
function slugOderRef(i: { publicRef: string; daten: { titel: string | null } }): string {
  return `${(i.daten.titel ?? "inserat").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}-${i.publicRef.toLowerCase()}`;
}
