"use client";
import { useEffect } from "react";
import { initialisiereServerFavoriten } from "@/components/favorites";

/* Füllt den In-Memory-Zwischenspeicher der Merkliste beim ersten Rendern
   einer Seite mit dem Serverstand — für angemeldete Personen. Wiederverwendbar:
   Objektseite und Konto/Merkliste binden dieselbe Komponente ein, VOR allem,
   was `favorites()` liest (Kopf, MerkKnopf, MerkZahl). */
export function FavoritenInit({ refs }: { refs: string[] }) {
  useEffect(() => { initialisiereServerFavoriten(refs); }, [refs]);
  return null;
}
