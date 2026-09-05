import { redirect } from "next/navigation";
import { istLocale, uebersetzer, DEFAULT_LOCALE, PFAD, type Locale } from "@/i18n";
import { sitzung } from "@/server/sitzung";
import { meineAnfragen, type MeineAnfrage } from "@/server/inquiries";
import { KontoRahmen } from "../kopfzeile";

/* Meine Anfragen — was eine angemeldete Person selbst über /api/inquiries
   verschickt hat. Zeigt nur, was inquiry.status wirklich hergibt (§Auftrag);
   kein erfundener «beantwortet»-Zustand. Ein gelöschtes Inserat lässt die
   Zeile stehen, nur ohne Link (server/inquiries.ts meineAnfragen). */
export const dynamic = "force-dynamic";

const AUSZUG_LAENGE = 140;

function auszug(text: string): string {
  const glatt = text.replace(/\s+/g, " ").trim();
  return glatt.length > AUSZUG_LAENGE ? glatt.slice(0, AUSZUG_LAENGE) + "…" : glatt;
}

/* Wie in konto/page.tsx (slugOderRef): ein Objekt ohne (mehr) gültigen Slug
   bekommt einen aus dem Titel abgeleiteten — reicht für den Link, die
   Objektseite selbst korrigiert per Redirect auf die kanonische Adresse. */
function objektHref(locale: Locale, a: MeineAnfrage): string | null {
  if (!a.listing) return null;
  const p = PFAD[locale];
  const art = a.listing.transaction === "rent" ? p.mieten : p.kaufen;
  const slug = a.listing.slug ?? (a.listing.title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "inserat");
  return `/${locale}/${p.immobilien}/${art}/${slug}-${a.listing.publicRef.toLowerCase()}`;
}

export default async function MeineAnfragenSeite({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const s = await sitzung();
  if (!s) redirect(`/${locale}/konto/anmelden?weiter=${encodeURIComponent(`/${locale}/konto/anfragen`)}`);
  const t = uebersetzer(locale);
  const anfragen = await meineAnfragen(s.person.id);

  return (
    <KontoRahmen locale={locale} titel={t("af_titel")} breit nav aktiv="anfragen">
      {anfragen.length === 0 ? (
        <p style={{ color: "var(--leise)", marginTop: 16 }}>{t("af_leer")}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 0" }}>
          {anfragen.map(a => {
            const href = objektHref(locale, a);
            return (
              <li key={a.publicRef} style={{ borderTop: "1px solid var(--linie)", padding: "16px 0" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                  {href ? <a href={href} style={{ fontSize: "1.02rem", fontWeight: 500 }}>{a.listing!.title || a.listing!.publicRef}</a>
                        : <b style={{ fontSize: "1.02rem", fontWeight: 500, color: "var(--leise)" }}>{t("af_objektNichtVerfuegbar")}</b>}
                  <span style={{ fontSize: ".62rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--leise)" }}>{t("af_art_" + a.kind)}</span>
                  <span style={{ fontSize: ".62rem", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--leise)" }}>{t("af_status_" + a.status)}</span>
                </div>
                <p style={{ marginTop: 8, color: "var(--leise)" }}>{auszug(a.message)}</p>
                <span style={{ color: "var(--leise)", fontSize: ".78rem" }}>{a.createdAt.slice(0, 10)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </KontoRahmen>
  );
}
