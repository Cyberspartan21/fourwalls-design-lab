import { NextRequest } from "next/server";
import { SuchanfrageSchema, suche } from "@/server/search";
import { AppError, asAppError } from "@/lib/errors";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const roh = Object.fromEntries(req.nextUrl.searchParams.entries());
    const p = SuchanfrageSchema.safeParse(roh);
    if (!p.success) throw new AppError("VALIDATION", "Ungültige Suchparameter", Object.fromEntries(Object.entries(p.error.flatten().fieldErrors).map(([k, v]) => [k, (v as string[] | undefined)?.[0] ?? "ungültig"])));
    return Response.json(await suche(p.data), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const err = asAppError(e);
    if (err.code === "INTERNAL") log.error("search.fehler", { fehler: e instanceof Error ? e.message : String(e) });
    return Response.json(err.toResponseBody(), { status: err.status });
  }
}
