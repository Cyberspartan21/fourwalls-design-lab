import { NextRequest } from "next/server";
import { aehnliche } from "@/server/similar";
import { AppError, asAppError } from "@/lib/errors";

/* GET /api/similar?ref=FWL-2026-000142 → bis zu drei ähnliche, veröffentlichte Inserate */
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const ref = req.nextUrl.searchParams.get("ref") ?? "";
    if (!/^FWL-\d{4}-\d{6}$/.test(ref)) throw new AppError("VALIDATION", "Ungültige Referenz");
    return Response.json({ treffer: await aehnliche(ref.toUpperCase(), 3) }, { headers: { "cache-control": "no-store" } });
  } catch (e) { const err = asAppError(e); return Response.json(err.toResponseBody(), { status: err.status }); }
}
