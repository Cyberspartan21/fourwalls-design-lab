import { NextRequest } from "next/server";
import { verlangeSitzung } from "@/server/sitzung";
import { verlangeOrgRecht } from "@/server/org-kontext";
import { orgAnfragen } from "@/server/organfragen";
import { fehlerAntwort } from "@/lib/route-schutz";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ slug: string }> };

/* Der Posteingang der Organisation (P5.7 §35). */
export async function GET(req: NextRequest, { params }: P) {
  try {
    const s = await verlangeSitzung();
    const { slug } = await params;
    const kontext = await verlangeOrgRecht(s.person, slug, "VIEW_INQUIRIES");
    const seite = Number(req.nextUrl.searchParams.get("seite") ?? "1") || 1;
    return Response.json(await orgAnfragen(kontext, seite), { headers: { "cache-control": "no-store" } });
  } catch (e) { return fehlerAntwort(e, "org.anfragen.liste"); }
}
