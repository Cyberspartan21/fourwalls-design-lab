import { NextRequest } from "next/server";
import { suche } from "@/server/geo";
import { istLocale } from "@/i18n";
import { asAppError } from "@/lib/errors";

/* GET /api/orte?q=zür&locale=de → Vorschläge (Gemeinde, PLZ, Kanton, Region) mit stabilen Kennungen */
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 60);
    const l = req.nextUrl.searchParams.get("locale") ?? "de";
    const locale = istLocale(l) ? l : "de";
    const v = await suche(q, locale, 8);
    return Response.json(v.map(e => ({ typ: e.typ, id: e.id, label: e.label, sub: e.sub ?? "" })), { headers: { "cache-control": "public, max-age=300" } });
  } catch (e) { const err = asAppError(e); return Response.json(err.toResponseBody(), { status: err.status }); }
}
