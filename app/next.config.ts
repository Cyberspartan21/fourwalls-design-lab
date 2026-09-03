import type { NextConfig } from "next";

/* Bewusst schlank. Keine anbieterspezifischen Bausteine (siehe P5.1: die
   Anwendung muss zwischen EU- und Schweizer Hosting umziehen können, ohne
   umgebaut zu werden). */
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /* Bilder werden als vorbereitete Varianten über <picture> ausgeliefert,
     genau wie im Prototyp — damit die Komposition den Referenzaufnahmen
     entspricht. next/image würde die Dateien neu kodieren. */
  images: { unoptimized: true },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
      ]
    }];
  }
};

export default config;
