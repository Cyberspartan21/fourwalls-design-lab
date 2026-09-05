import { NextRequest } from "next/server";
import { verlangeRecht } from "@/server/sitzung";
import { leadListe, type LeadFilter } from "@/server/anliegen";
import { fehlerAntwort } from "@/lib/route-schutz";

/* GET /api/intern/anliegen — die geblätterte Übersicht für das FOURWALLS-Team
   (staff/admin, nicht moderator — P5.8 §56). */

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    await verlangeRecht("VIEW_SERVICE_LEADS");
    const p = req.nextUrl.searchParams;
    const filter: LeadFilter = {
      status: p.get("status") ?? "",
      service: p.get("service") ?? "",
      locale: p.get("locale") ?? "",
      ortId: p.get("ortId") ?? "",
      q: p.get("q") ?? "",
      seite: Number(p.get("seite") ?? "1") || 1
    };
    return Response.json(await leadListe(filter), { headers: { "cache-control": "no-store" } });
  } catch (e) { return fehlerAntwort(e, "intern.anliegen.liste"); }
}
