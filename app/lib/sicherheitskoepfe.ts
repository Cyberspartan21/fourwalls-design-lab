/* Sicherheitsköpfe, die von der UMGEBUNG abhängen — zur Laufzeit gesetzt,
   nicht beim Bau (P5.5 §56/§57). Ein und dasselbe Abbild bedient Entwicklung,
   Staging und Produktion; erst beim Start ist bekannt, woher die Bilder kommen
   (S3_PUBLIC_BASE_URL) und ob HSTS gilt. Die statischen Köpfe (nosniff,
   Referrer-Policy, …) stehen weiterhin in next.config.ts.

   Wird von proxy.ts gerufen; liest deshalb process.env direkt (kein
   server-only, kein Datenbankmodul). */

/* ---------- Content-Security-Policy — aus den tatsächlichen Quellen gebaut (P5.5 §56) ----------
   - Google Fonts: Stylesheet von fonts.googleapis.com, Schriftdateien von
     fonts.gstatic.com (app/[locale]/layout.tsx).
   - MapLibre GL selbst kommt von cdnjs.cloudflare.com (Skript + Stylesheet),
     siehe components/map/ukarte.js und components/map/detail-map.ts.
   - swisstopo liefert Stil, Glyphen und Sprite über vectortiles.geo.admin.ch
     und die Kacheln über vectortiles0-4.geo.admin.ch (per curl gegen den
     echten Stil und die echte tiles.json geprüft) — zusammengefasst als
     https://*.geo.admin.ch.
   - OpenFreeMap (Rückfall, wenn swisstopo nicht antwortet) liegt komplett
     unter tiles.openfreemap.org (ebenfalls per curl geprüft).
   - Objektspeicher-Ableitungen (Bilder) kommen von S3_PUBLIC_BASE_URL, wenn
     STORAGE_PROVIDER=s3 gesetzt ist. Das ist eine Umgebungsvariable und gehört
     damit ins Konfigurationsmodul (server/env.ts ist server-only und liefe
     hier, in next.config.ts, nicht mit). */
/* Nur der Ursprung (Schema + Host + Port): eine CSP-Quelle MIT Pfad gilt nur
   für genau diesen Pfad — «https://host/behaelter» würde
   «https://host/behaelter/pub/…» NICHT erlauben (gefunden im lokalen
   Vergleich: alle Bilder blockiert, 37–49 % Abweichung). */
function speicherUrsprung(): string | null { try { return process.env.S3_PUBLIC_BASE_URL ? new URL(process.env.S3_PUBLIC_BASE_URL).origin : null; } catch { return null; } }

const SWISSTOPO = "https://*.geo.admin.ch";
const OPENFREEMAP = "https://tiles.openfreemap.org";
const MAPLIBRE_CDN = "https://cdnjs.cloudflare.com";
const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com";
const GOOGLE_FONTS_FILES = "https://fonts.gstatic.com";

function imgSrc(): string[] { const u = speicherUrsprung(); return ["'self'", "data:", "blob:", SWISSTOPO, OPENFREEMAP, ...(u ? [u] : [])]; }

export function csp(): string { return [
  `default-src 'self'`,
  /* Next rendert die RSC-Nutzlast serverseitig in Inline-<script>-Elemente
     ohne src; ohne Nonce-Infrastruktur (die dieses Projekt nicht hat) lässt
     sich das nicht ohne 'unsafe-inline' erlauben. Geprüft am Produktionsbau
     (npm run build; next start -p 3009): das ausgelieferte HTML enthält
     Inline-<script>-Blöcke ohne src. Bewusste, dokumentierte Einschränkung —
     kein 'unsafe-eval'. */
  `script-src 'self' 'unsafe-inline' ${MAPLIBRE_CDN}`,
  /* Die Anwendung nutzt Inline-Styles (u. a. berechnete Kartenfarben). */
  `style-src 'self' 'unsafe-inline' ${GOOGLE_FONTS_CSS} ${MAPLIBRE_CDN}`,
  `font-src 'self' ${GOOGLE_FONTS_FILES}`,
  `img-src ${imgSrc().join(" ")}`,
  /* Stil/Kacheln/Glyphen werden per fetch geladen, nicht per <img> — daher connect-src. */
  `connect-src 'self' ${SWISSTOPO} ${OPENFREEMAP}`,
  /* MapLibre erzeugt seinen Worker aus einem blob:-URL. */
  `worker-src 'self' blob:`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`
].join("; "); }


export function hsts(): string | null {
  const e = process.env.APP_ENV;
  return e === "staging" || e === "production" ? "max-age=31536000; includeSubDomains" : null;
}
