/* Typen für das wörtlich übernommene karte.js (P3). */
import type { Suchergebnis } from "@/domain/marktplatz";
export interface GlMapMinimal { zoomOut(n?: number): void; resize(): void; remove(): void }
export interface UKarte {
  starte(behaelterId: string, handler: { bewegt?: (b: { n: number; s: number; o: number; w: number }) => void; gewaehlt?: (slug: string) => void }): Promise<unknown>;
  zeige(antwort: Suchergebnis & { treffer: unknown[] }, opt?: { behalteAusschnitt?: boolean }): void;
  waehle(slug: string | null, vonKarte?: boolean): void;
  ueberfliege(slug: string | null): void;
  setzeModus(dunkel: boolean): void;
  bounds(): { n: number; s: number; o: number; w: number } | null;
  passeAn(b: [number, number, number, number]): void;
  detail(behaelterId: string, opt: { lat: number; lng: number; genauigkeitM?: number; zoom?: number }): Promise<unknown>;
  vorwaermen(): void;
  offen(): boolean; istBewegt(): boolean; setzeBewegt(v: boolean): void;
  stil(): { url: string; name: string; attribution: string };
  karte(): GlMapMinimal | null; groesseNeu(): void; zerstoere(): void;
}
export const UKARTE: UKarte;
