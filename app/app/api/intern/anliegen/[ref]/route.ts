import { NextRequest } from "next/server";
import { verlangeRecht } from "@/server/sitzung";
import { leadLesen, statusSetzen, zuweisen } from "@/server/anliegen";
import { env } from "@/server/env";
import { herkunftPruefen, jsonLesen, fehlerAntwort } from "@/lib/route-schutz";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ ref: string }> };

export async function GET(_req: NextRequest, { params }: P) {
  try {
    await verlangeRecht("VIEW_SERVICE_LEADS");
    const { ref } = await params;
    return Response.json(await leadLesen(ref.toUpperCase()), { headers: { "cache-control": "no-store" } });
  } catch (e) { return fehlerAntwort(e, "intern.anliegen.lesen"); }
}

/* Genau eine Absicht je Aufruf: entweder den Status ändern (MANAGE_SERVICE_LEADS)
   oder zuweisen (ASSIGN_SERVICE_LEAD) — nie beides zugleich, nie keins. */
export async function PATCH(req: NextRequest, { params }: P) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const { ref } = await params;
    const publicRef = ref.toUpperCase();
    const roh = await jsonLesen(req) as { status?: unknown; assignedStaffId?: unknown };
    const hatStatus = Object.prototype.hasOwnProperty.call(roh, "status");
    const hatZuweisung = Object.prototype.hasOwnProperty.call(roh, "assignedStaffId");
    if (hatStatus === hatZuweisung) {
      throw new AppError("VALIDATION", "Bitte entweder status oder assignedStaffId angeben", { body: "genau eines von status, assignedStaffId" });
    }

    if (hatStatus) {
      if (typeof roh.status !== "string") throw new AppError("VALIDATION", "status fehlt", { status: "erforderlich" });
      const s = await verlangeRecht("MANAGE_SERVICE_LEADS");
      return Response.json(await statusSetzen(s.person, publicRef, roh.status));
    }

    if (roh.assignedStaffId !== null && typeof roh.assignedStaffId !== "string") {
      throw new AppError("VALIDATION", "assignedStaffId ungültig", { assignedStaffId: "erforderlich" });
    }
    const s = await verlangeRecht("ASSIGN_SERVICE_LEAD");
    return Response.json(await zuweisen(s.person, publicRef, roh.assignedStaffId));
  } catch (e) { return fehlerAntwort(e, "intern.anliegen.aendern"); }
}
