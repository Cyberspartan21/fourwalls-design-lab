import { notFound } from "next/navigation";
import { istLocale, uebersetzer, PFAD } from "@/i18n";

/* Startseite je Sprache — in P5.2 bewusst ein Einstieg, keine Nachbildung
   der Prototyp-Startseite. Sie führt zur einen echten Objektseite. */
export default async function Start({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!istLocale(locale)) notFound();
  const t = uebersetzer(locale);
  const p = PFAD[locale];
  return (
    <main className="blatt" style={{ padding: "clamp(48px,10vh,120px) var(--pad)", minHeight: "60vh" }}>
      <p className="kick" style={{ fontSize: ".62rem", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--leise)" }}>Fourwalls · P5.2</p>
      <h1 style={{ fontFamily: "var(--d)", fontWeight: 300, fontSize: "clamp(2rem,5vw,3.4rem)", margin: "12px 0 24px" }}>{t("exclusive")}</h1>
      <p style={{ maxWidth: "60ch", color: "var(--leise)" }}>Entwicklungsstand: eine Objektseite aus der Datenbank, in vier Sprachen.</p>
      <p style={{ marginTop: 24 }}><a className="knopf voll" href={`/${locale}/${p.immobilien}/${p.kaufen}/seehaus-walensee-fwl-2026-000142`}>Seehaus Walensee →</a></p>
    </main>
  );
}
