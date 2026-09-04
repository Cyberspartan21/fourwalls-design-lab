import type { MetadataRoute } from "next";

/* Staging darf nirgends in einer Suche auftauchen — zusätzlich zum
   x-robots-tag aus proxy.ts (P5.5 §35). Ausserhalb von Staging: offen,
   es gab zuvor keine public/robots.txt mit abweichenden Regeln.

   force-dynamic ist hier Pflicht, nicht Vorsicht: ein einziges Abbild bedient
   development/staging/production (Aufgabe 4), APP_ENV kommt erst zur
   Laufzeit über `docker run -e`. Ohne dynamic rendert Next diese Route beim
   Build als statische Datei und friert das APP_ENV der Build-Stufe für immer
   ein — in Staging bliebe es dann fälschlich bei "Allow: /". */
export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  if (process.env.APP_ENV === "staging") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return { rules: { userAgent: "*", allow: "/" } };
}
