import type { ReactNode } from "react";
import "@/styles/ufer.css";
import "@/styles/objekt.css";
import "@/styles/app.css";
import { DEFAULT_LOCALE, istLocale } from "@/i18n";
import { ModusScript } from "@/components/site/modus-script";
import { Fuss } from "@/components/site/fuss";

/* Wurzel-Layout — je Sprache, damit <html lang> stimmt. proxy.ts sorgt dafür,
   dass hier nur bekannte Sprachen ankommen; alles andere läuft unter Deutsch
   in die 404. */
export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = istLocale(locale) ? locale : DEFAULT_LOCALE;
  return (
    <html lang={l}>
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="" />
        <link rel="preconnect" href="https://vectortiles.geo.admin.ch" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Petrona:ital,wght@0,200..500;1,200..400&family=Manrope:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </head>
      {/* Der Modus wird vor dem ersten Zeichnen im Browser gesetzt (ModusScript); React soll die Abweichung zum Server-Markup hinnehmen. */}
      <body data-mode="hell" suppressHydrationWarning>
        <ModusScript />
        {children}
        <Fuss locale={l} />
      </body>
    </html>
  );
}
