import type { NextConfig } from "next";

/* Bewusst schlank. Keine anbieterspezifischen Bausteine (siehe P5.1: die
   Anwendung muss zwischen EU- und Schweizer Hosting umziehen können, ohne
   umgebaut zu werden). */

const APP_ENV = process.env.APP_ENV;

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /* Bilder werden als vorbereitete Varianten über <picture> ausgeliefert,
     genau wie im Prototyp — damit die Komposition den Referenzaufnahmen
     entspricht. next/image würde die Dateien neu kodieren. */
  images: { unoptimized: true },
  /* Container-Bild ohne node_modules — nur der abhängigkeitsfreie Server (P5.5 §44). */
  output: "standalone",
  experimental: {
    /* app/global-not-found.tsx: liefert für Pfade, die GAR KEINER Route
       entsprechen, serverseitig gerenderten Inhalt mit Status 404 (siehe
       Kopfkommentar dort). */
    globalNotFound: true
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        /* Content-Security-Policy und Strict-Transport-Security setzt proxy.ts
           zur LAUFZEIT (lib/sicherheitskoepfe.ts): sie hängen von der Umgebung ab
           (Speicher-Ursprung, staging/production), und ein und dasselbe Abbild
           bedient alle Umgebungen — Build-Zeit-Werte wären hier falsch. */
      ]
    }];
  }
};

export default config;
