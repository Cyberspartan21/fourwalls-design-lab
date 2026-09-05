import type { Metadata } from "next";
import { generateAnbieterMetadata, AnbieterSeiteRoute } from "../../_anbieter/gemeinsam";

/* /de/anbieter/<slug> — siehe app/[locale]/_anbieter/gemeinsam.tsx für die
   Begründung dieser vier parallelen, literalen Ordner (einer je Sprachwort). */
export const dynamic = "force-dynamic";
type Params = { locale: string; slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return generateAnbieterMetadata(params, "anbieter");
}

export default function Seite({ params }: { params: Promise<Params> }) {
  return AnbieterSeiteRoute({ params, wort: "anbieter" });
}
