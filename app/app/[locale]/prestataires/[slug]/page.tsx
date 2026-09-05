import type { Metadata } from "next";
import { generateAnbieterMetadata, AnbieterSeiteRoute } from "../../_anbieter/gemeinsam";

/* /fr/prestataires/<slug> — siehe app/[locale]/_anbieter/gemeinsam.tsx */
export const dynamic = "force-dynamic";
type Params = { locale: string; slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return generateAnbieterMetadata(params, "prestataires");
}

export default function Seite({ params }: { params: Promise<Params> }) {
  return AnbieterSeiteRoute({ params, wort: "prestataires" });
}
