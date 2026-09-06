import type { MetadataRoute } from "next";
import { startTor } from "@/config/start-tor";

/* Staging darf nirgends in einer Suche auftauchen — zusätzlich zum
   x-robots-tag aus proxy.ts (P5.5 §35). Ausserhalb von Staging: offen mit
   einer Disallow-Liste als Verteidigung in der Tiefe (P5.9 Phase B) — die
   eigentliche Grenze sind die noindex-Metadaten je Seite (lib/seo.ts
   NOINDEX), diese Liste fängt nur ab, was ein Crawler trotzdem anfasst.

   force-dynamic ist hier Pflicht, nicht Vorsicht: ein einziges Abbild bedient
   development/staging/production (Aufgabe 4), APP_ENV kommt erst zur
   Laufzeit über `docker run -e`. Ohne dynamic rendert Next diese Route beim
   Build als statische Datei und friert das APP_ENV der Build-Stufe für immer
   ein — in Staging bliebe es dann fälschlich bei "Allow: /". Aus demselben
   Grund liest diese Datei NEXT_PUBLIC_SITE_URL direkt aus process.env statt
   über server/env.ts:env() — dessen Ergebnis ist ab dem ersten Aufruf für
   den Lebenszyklus des Prozesses eingefroren (`geprueft`-Zwischenspeicher). */
export const dynamic = "force-dynamic";

/* Muster mit `*` treffen jede Sprache (/de/…, /fr/…, /it/…, /en/…) und —
   ohne `$`-Anker — auch alle Unterseiten darunter (robots.txt-Semantik:
   ein Muster ohne Endanker ist ein Präfix). */
const DISALLOW = ["/api/", "/*/konto", "/*/intern", "/*/moderation", "/*/vorschau", "/*/inserieren", "/*/vergleich", "/*/einladung"];

export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (process.env.APP_ENV === "staging") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  /* Produktion: Disallow: / (alles), solange das Start-Tor nicht bereit
     ist — bestätigte Firmenangaben UND freigegebene Rechtsseiten fehlen
     heute noch (config/start-tor.ts). /api/ready meldet dieselbe Prüfung. */
  if (process.env.APP_ENV === "production" && !startTor().bereit) {
    return { rules: { userAgent: "*", disallow: "/" }, sitemap: `${site}/sitemap.xml` };
  }

  return { rules: { userAgent: "*", allow: "/", disallow: DISALLOW }, sitemap: `${site}/sitemap.xml` };
}
