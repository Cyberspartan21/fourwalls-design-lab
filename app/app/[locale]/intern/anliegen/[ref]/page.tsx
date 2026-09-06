import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { istLocale, DEFAULT_LOCALE, uebersetzer, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { leadLesen, personalListe, UEBERGAENGE } from "@/server/anliegen";
import { DIENST_LABEL, type Dienst } from "@/domain/anliegen";
import { darf } from "@/domain/rechte";
import { asAppError } from "@/lib/errors";
import { InternRahmen } from "@/components/intern/intern-rahmen";
import { LeadAktionen } from "@/components/intern/lead-aktionen";
import { ZuweisenAuswahl } from "@/components/intern/zuweisen-auswahl";
import { NOINDEX } from "@/lib/seo";

/* Ein Anliegen: Kontakt, Objektkontext, Situation, Herkunft, Wunschtermin —
   Status-Wechsel und Zuweisung als Aktionen, Prüfspur am Ende (P5.8 §24–§30).
   Kein CRM: keine Notizen, keine Aufgaben, kein Scoring. */
export const dynamic = "force-dynamic";

/* NOINDEX (interner Bereich, P5.9 Phase B) — Titel ohne erneuten
   leadLesen()-Aufruf: Referenz aus dem Pfad reicht für einen sinnvollen,
   nicht indexierten Titel. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string; ref: string }> }): Promise<Metadata> {
  const { locale: roh, ref } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  return { ...NOINDEX, title: `${uebersetzer(locale)("in_eyebrow")} · ${ref.toUpperCase()}` };
}

export default async function InternAnliegenDetailSeite({ params }: { params: Promise<{ locale: string; ref: string }> }) {
  const { locale: roh, ref } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  if (!s) redirect(`/${locale}/konto/anmelden?weiter=${encodeURIComponent(`/${locale}/intern/anliegen/${ref}`)}`);
  if (!darf(s.person.rolle, "VIEW_SERVICE_LEADS")) notFound();
  const t = uebersetzer(locale);

  const publicRef = ref.toUpperCase();
  let d;
  try { d = await leadLesen(publicRef); }
  catch (e) { if (asAppError(e).code === "NOT_FOUND") notFound(); throw e; }

  const darfAendern = darf(s.person.rolle, "MANAGE_SERVICE_LEADS");
  const darfZuweisen = darf(s.person.rolle, "ASSIGN_SERVICE_LEAD");
  const erlaubteUebergaenge = darfAendern ? ((UEBERGAENGE as Record<string, string[]>)[d.status] ?? []) : [];
  const personal = darfZuweisen ? await personalListe() : [];
  const statusLabels = Object.fromEntries(["new", "contacted", "qualified", "closed", "declined"].map(st => [st, t("in_status_" + st)]));

  return (
    <InternRahmen locale={locale} titel={`${DIENST_LABEL[locale][d.service as Dienst] ?? d.service} · ${d.publicRef}`} lead={t("in_status_" + d.status)}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginTop: 18 }}>
        <Feld label={t("in_detailKontakt")}>
          {d.contact.name}<br />
          <span style={{ color: "var(--leise)", fontSize: ".82rem" }}>{d.contact.email}</span><br />
          {d.contact.phone && <span style={{ color: "var(--leise)", fontSize: ".82rem" }}>{d.contact.phone}<br /></span>}
          <span style={{ color: "var(--leise)", fontSize: ".78rem" }}>{t("in_kanal_" + d.contact.channel)}</span>
        </Feld>
        <Feld label={t("in_detailWunschtermin")}>
          {d.contact.wunschdatum ?? "—"}{d.contact.wunschfenster ? ` · ${t("in_fenster_" + d.contact.wunschfenster)}` : ""}
        </Feld>
        <Feld label={t("in_detailHerkunft")}>
          {d.herkunft.seite ?? "—"}{d.herkunft.kampagne ? ` · ${d.herkunft.kampagne}` : ""}
        </Feld>
        <Feld label={t("in_thZustaendig")}>
          {darfZuweisen ? (
            <ZuweisenAuswahl publicRef={d.publicRef} aktuell={d.assignedStaff?.id ?? null} personal={personal}
              label={t("in_zuweisenLabel")} unzugewiesenLabel={t("in_zuweisenNiemand")} fehlerLabel={t("w_speicherFehler")} />
          ) : (d.assignedStaff?.name ?? "—")}
        </Feld>
      </div>

      <div className="fld" style={{ marginTop: 24 }}>
        <label>{t("in_detailObjekt")}</label>
        <ObjektZeile d={d} t={t} />
      </div>

      <div className="fld" style={{ marginTop: 22 }}>
        <label>{t("in_detailNachricht")}</label>
        <p style={{ whiteSpace: "pre-wrap", maxWidth: "70ch" }}>{d.objekt.nachricht ?? "—"}</p>
      </div>

      {darfAendern && (
        <LeadAktionen publicRef={d.publicRef} erlaubt={erlaubteUebergaenge} labels={statusLabels}
          speichertLabel={t("w_speichert")} fehlerLabel={t("w_speicherFehler")} />
      )}

      <div className="fld" style={{ marginTop: 30 }}>
        <label>{t("in_detailPruefspur")}</label>
        {d.verlauf.length === 0 ? (
          <p style={{ color: "var(--leise)", fontSize: ".86rem" }}>{t("in_verlaufLeer")}</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: ".86rem" }}>
            {d.verlauf.map((v, n) => (
              <li key={n} style={{ borderTop: "1px solid var(--linie)", padding: "8px 0", display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span style={{ color: "var(--leise)", fontVariantNumeric: "tabular-nums", minWidth: 130 }}>{v.zeit.slice(0, 16).replace("T", " ")}</span>
                <span>{v.aktion}{v.von ? ` · ${v.von} → ${v.nach}` : ""}</span>
                <span style={{ color: "var(--leise)", marginLeft: "auto" }}>{v.wer ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </InternRahmen>
  );
}

function Feld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: ".62rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--leise)", marginBottom: 4 }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

function ObjektZeile({ d, t }: { d: Awaited<ReturnType<typeof leadLesen>>; t: (k: string) => string }) {
  const o = d.objekt;
  const teile: string[] = [];
  if (o.ort) teile.push(o.ort);
  if (o.typ) teile.push(o.typ);
  if (o.zimmer != null) teile.push(`${o.zimmer} ${t("in_feldZimmer")}`);
  if (o.flaeche != null) teile.push(`${o.flaeche} m²`);
  if (o.grundstueck != null) teile.push(`${t("in_feldGrundstueck")}: ${o.grundstueck} m²`);
  if (o.baujahr != null) teile.push(`${t("in_feldBaujahr")}: ${o.baujahr}`);
  if (o.einheiten != null) teile.push(`${t("in_feldEinheiten")}: ${o.einheiten}`);
  if (o.zustand) teile.push(o.zustand);
  if (o.belegung) teile.push(o.belegung);
  if (o.zeitpunkt) teile.push(o.zeitpunkt);
  if (o.leistungen.length) teile.push(o.leistungen.join(", "));
  if (o.listingRef) teile.push(o.listingRef);
  return <p>{teile.length ? teile.join(" · ") : "—"}</p>;
}
