"use client";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n";

/* Der Organisationsumschalter (P5.7 §18) — reine Navigation zwischen
   /konto/org/<slug>-Adressen. Kein Client-Zustand als Autorisierung: jede
   Zieladresse prüft ihr eigenes layout.tsx erneut über verlangeOrgRecht(). */
export function OrgUmschalter({ locale, aktivSlug, label, organisationen }:
  { locale: Locale; aktivSlug: string; label: string;
    organisationen: { slug: string; displayName: string }[] }) {
  const router = useRouter();
  if (organisationen.length <= 1) return null;
  return (
    <select
      className="feld"
      aria-label={label}
      value={aktivSlug}
      style={{ maxWidth: 260 }}
      onChange={e => router.push(`/${locale}/konto/org/${e.target.value}`)}
    >
      {organisationen.map(o => <option key={o.slug} value={o.slug}>{o.displayName}</option>)}
    </select>
  );
}
