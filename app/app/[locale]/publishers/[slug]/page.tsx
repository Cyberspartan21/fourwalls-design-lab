import type { Metadata } from "next";
import { generateAnbieterMetadata, AnbieterSeiteRoute } from "../../_anbieter/gemeinsam";

/* /en/publishers/<slug> — siehe app/[locale]/_anbieter/gemeinsam.tsx */
export const dynamic = "force-dynamic";
type Params = { locale: string; slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  return generateAnbieterMetadata(params, "publishers");
}

export default function Seite({ params }: { params: Promise<Params> }) {
  return AnbieterSeiteRoute({ params, wort: "publishers" });
}
