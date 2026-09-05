"use client";
import { useSelectedLayoutSegment } from "next/navigation";
import type { Locale, T } from "@/i18n";
import { uebersetzer } from "@/i18n";

/* Die Sekundärnavigation innerhalb einer Organisation — welcher Eintrag
   aktiv ist, liest dieses Client-Stück direkt aus dem Next-Router
   (`useSelectedLayoutSegment`), damit layout.tsx selbst ein reiner
   Server-Rahmen bleiben kann und keine Seite ihre eigene Markierung
   mitbringen muss. */
const NAV_ITEMS: { key: string; segment: string | null; href: (l: Locale, slug: string) => string; label: (t: T) => string }[] = [
  { key: "uebersicht", segment: null, href: (l, s) => `/${l}/konto/org/${s}`, label: t => t("og_nav_uebersicht") },
  { key: "inserate", segment: "inserate", href: (l, s) => `/${l}/konto/org/${s}/inserate`, label: t => t("og_nav_inserate") },
  { key: "anfragen", segment: "anfragen", href: (l, s) => `/${l}/konto/org/${s}/anfragen`, label: t => t("og_nav_anfragen") },
  { key: "team", segment: "team", href: (l, s) => `/${l}/konto/org/${s}/team`, label: t => t("og_nav_team") },
  { key: "profil", segment: "profil", href: (l, s) => `/${l}/konto/org/${s}/profil`, label: t => t("og_nav_profil") }
];

export function OrgNav({ locale, slug, displayName }: { locale: Locale; slug: string; displayName: string }) {
  const segment = useSelectedLayoutSegment();
  const t = uebersetzer(locale);
  return (
    <nav style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18, alignItems: "center" }} aria-label={displayName}>
      {NAV_ITEMS.map(it => (
        <a key={it.key} className="knopf leise" href={it.href(locale, slug)} aria-current={segment === it.segment ? "page" : undefined}>{it.label(t)}</a>
      ))}
      <a className="knopf leise" href={`/${locale}/konto`} style={{ marginLeft: "auto" }}>{t("og_zurueckZuKonto")}</a>
    </nav>
  );
}
