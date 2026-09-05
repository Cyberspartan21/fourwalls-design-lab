"use client";
import { useEffect } from "react";
import { verlauf } from "@/components/verlauf";

/* Trägt einen Objektseiten-Besuch anonym in den Browser-Verlauf ein.
   Nur für Besucher ohne Sitzung — angemeldete Personen bekommen den Eintrag
   server-seitig (server/verlauf.ts), siehe components/property/seite.tsx. */
export function VerlaufEintragen({ publicRef }: { publicRef: string }) {
  useEffect(() => { verlauf().hinzufuegen(publicRef); }, [publicRef]);
  return null;
}
