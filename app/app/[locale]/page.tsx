import { notFound } from "next/navigation";
import { LOCALES, PFAD, istLocale, uebersetzer, type Locale } from "@/i18n";
import { sql } from "@/server/db";
import { env } from "@/server/env";
import { suche } from "@/server/search";
import { Kopf } from "@/components/site/kopf";
import { Karte, objektPfad } from "@/components/marktplatz/karte";
import { woerter } from "@/components/marktplatz/labels";
import { LEER } from "@/domain/marktplatz";

/* Startseite je Sprache — Einstieg in den Marktplatz. Bewusst kein Nachbau
   der Prototyp-Startseite (Held, Wasser, Wege): P5.3 migriert Suche und
   Karte. Was hier steht, kommt aus der Datenbank: die Zahl der Inserate und
   eine kuratierte Auswahl (Exclusive-Mandate) über denselben Suchanbieter —
   keine fest verdrahteten Objekte. */
export const dynamic = "force-dynamic";

export default async function Start({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!istLocale(locale)) notFound();
  const t = uebersetzer(locale); const w = woerter(t); const p = PFAD[locale];
  const nurEcht = env().APP_ENV === "production";
  const [zahl, exklusiv] = await Promise.all([
    sql`SELECT count(*)::int AS n FROM listing_public lp WHERE lp.status = 'published' AND (${nurEcht} = false OR lp.is_demo = false)`,
    suche({ ...LEER, quelle: "fourwalls", sort: "empfohlen", proSeite: 3 }, locale)
  ]);
  const n = Number(zahl[0]?.n ?? 0);
  const sprachLinks = Object.fromEntries(LOCALES.map(l => [l, `/${l}`])) as Record<Locale, string>;
  const kaufen = `/${locale}/${p.immobilien}/${p.kaufen}`, mieten = `/${locale}/${p.immobilien}/${p.mieten}`;
  return (
    <>
      <Kopf locale={locale} sprachLinks={sprachLinks} />
      {/* P5.8: kein className="blatt" hier — diese Klasse ist in ufer.css das
          mobile Vollbild-Menüblatt (position:fixed; inset:0; display:none
          ausser .an, siehe components/site/kopf.tsx). Auf dieser Seite ohne
          .an angewendet, machte sie den gesamten Seiteninhalt unsichtbar
          (display:none) — ein Namenskollisions-Bug, der vor diesem Auftrag
          bestand und auch app/[locale]/error.tsx sowie
          app/[locale]/not-found.tsx betrifft (dort NICHT behoben, siehe
          Bericht). */}
      <main style={{ padding: "clamp(40px,8vh,96px) var(--pad) 64px" }}>
        <p style={{ fontSize: ".62rem", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--leise)" }}>Fourwalls · {t("nav.alle")} · {n}</p>
        <h1 style={{ fontFamily: "var(--d)", fontWeight: 300, fontSize: "clamp(2rem,5vw,3.4rem)", margin: "12px 0 22px", maxWidth: "18ch" }}>{t("nav.wegSuchen")}</h1>
        <p style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0 0 40px" }}>
          <a className="knopf voll" href={kaufen}>{w.kaufen}</a>
          <a className="knopf" href={mieten}>{w.mieten}</a>
          <a className="knopf" href={`${kaufen}?ansicht=karte`}>{w.karte}</a>
          <a className="knopf" href={`${kaufen}?quelle=fourwalls`}>{w.exclusive}</a>
        </p>
        {exklusiv.treffer.length > 0 && (
          <section aria-label={w.exclusive}>
            <h2 style={{ fontFamily: "var(--d)", fontWeight: 300, fontSize: "1.5rem", margin: "0 0 14px" }}>{w.exclusive}</h2>
            <div className="gitter">{exklusiv.treffer.map(l => <Karte key={l.id} l={l} w={w} locale={locale} href={objektPfad(locale, p, l)} />)}</div>
          </section>
        )}
        <section aria-label={t("nav.fuerEigentuemer")} style={{ marginTop: 56 }}>
          <h2 style={{ fontFamily: "var(--d)", fontWeight: 300, fontSize: "1.5rem", margin: "0 0 14px" }}>{t("nav.fuerEigentuemer")}</h2>
          <div className="gitter">
            {[
              { href: `/${locale}/inserieren`, titel: t("nav.wegInser"), text: t("nav.wegInserS") },
              { href: `/${locale}/verkaufen`, titel: t("nav.wegVerk"), text: t("nav.wegVerkS") },
              { href: `/${locale}/bewertung`, titel: t("nav.wegBewertung"), text: t("nav.wegBewertungS") },
              { href: `/${locale}/verwalten`, titel: t("nav.wegVerw"), text: t("nav.wegVerwS") }
            ].map(w2 => (
              <div key={w2.href}>
                <a className="knopf" href={w2.href}>{w2.titel}</a>
                <p style={{ fontSize: ".8rem", color: "var(--leise)", margin: "10px 0 0", maxWidth: "32ch" }}>{w2.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
