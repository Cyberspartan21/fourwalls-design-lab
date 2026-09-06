import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/styles/ufer.css";
import "@/styles/objekt.css";
import "@/styles/portal.css";
import "@/styles/app.css";
import { DEFAULT_LOCALE, istLocale, uebersetzer } from "@/i18n";
import { ModusScript } from "@/components/site/modus-script";
import { Fuss } from "@/components/site/fuss";

/* Titel-Vorlage für alle Kind-Segmente: Seiten liefern nur den Kern-Titel
   (z. B. "Verkaufen"), das Template hängt "— Fourwalls" genau einmal an.
   Seiten, die selbst schon "— Fourwalls" anhängen, wurden dafür bereinigt
   (siehe Bericht) — sonst stünde es doppelt im <title>. */
export const metadata: Metadata = { title: { default: "Fourwalls", template: "%s — Fourwalls" } };

/* Wurzel-Layout — je Sprache, damit <html lang> stimmt. proxy.ts sorgt dafür,
   dass hier nur bekannte Sprachen ankommen; alles andere läuft unter Deutsch
   in die 404. */
export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = istLocale(locale) ? locale : DEFAULT_LOCALE;
  const t = uebersetzer(l);
  return (
    <html lang={l}>
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://vectortiles.geo.admin.ch" crossOrigin="" />
        {/* Schriften sind selbst gehostet (public/fonts, @font-face in ufer.css,
            P5.9 Entscheid 23) — Preload nur der zwei meistgenutzten Dateien. */}
        <link rel="preload" as="font" type="font/woff2" href="/fonts/petrona-latin-wght-normal.woff2" crossOrigin="" />
        <link rel="preload" as="font" type="font/woff2" href="/fonts/manrope-latin-wght-normal.woff2" crossOrigin="" />
      </head>
      {/* Der Modus wird vor dem ersten Zeichnen im Browser gesetzt (ModusScript); React soll die Abweichung zum Server-Markup hinnehmen. */}
      <body data-mode="hell" suppressHydrationWarning>
        <a className="skip" href="#inhalt">{t("skipZumInhalt")}</a>
        <ModusScript />
        {children}
        <Fuss locale={l} />
      </body>
    </html>
  );
}
