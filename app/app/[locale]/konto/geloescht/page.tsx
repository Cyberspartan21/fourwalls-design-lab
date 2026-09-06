import type { Metadata } from "next";
import { istLocale, uebersetzer, DEFAULT_LOCALE, type Locale } from "@/i18n";
import { KontoRahmen } from "../kopfzeile";
import { NOINDEX } from "@/lib/seo";

/* Bestätigungsseite nach dem Löschen (P5.10 §9) — statisch, ohne Sitzung:
   das Konto ist in diesem Moment schon abgemeldet, die Seite darf trotzdem
   erreichbar sein. Kein Datenzugriff, keine dynamische Zusammenfassung —
   die genaue Zusammenfassung stand bereits in der Antwort von
   POST /api/konto/loeschen; hier steht nur der allgemeine, immer gültige
   Hinweis, was grundsätzlich bleibt und dass Fristen noch fehlen. */
export const dynamic = "force-static";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  return { ...NOINDEX, title: uebersetzer(locale)("kg_titel") };
}

export default async function KontoGeloescht({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: roh } = await params;
  const locale: Locale = istLocale(roh) ? roh : DEFAULT_LOCALE;
  const t = uebersetzer(locale);
  return (
    <KontoRahmen locale={locale} titel={t("kg_titel")}>
      <p style={{ marginTop: 10, maxWidth: "56ch" }}>{t("kg_text")}</p>
      <div style={{ marginTop: 26 }}>
        <a className="knopf voll" href={`/${locale}`}>{t("sa_zurStartseite")}</a>
      </div>
    </KontoRahmen>
  );
}
