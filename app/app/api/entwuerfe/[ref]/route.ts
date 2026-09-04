import { NextRequest } from "next/server";
import { verlangeSitzung } from "@/server/sitzung";
import { entwurfLesen, entwurfSpeichern } from "@/server/entwuerfe";
import { env } from "@/server/env";
import { herkunftPruefen, ratenPruefen, jsonLesen, fehlerAntwort } from "@/lib/route-schutz";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ ref: string }> };

export async function GET(_req: NextRequest, { params }: P) {
  try {
    const s = await verlangeSitzung();
    const { ref } = await params;
    return Response.json(await entwurfLesen(s.person, ref.toUpperCase()), { headers: { "cache-control": "no-store" } });
  } catch (e) { return fehlerAntwort(e, "entwuerfe.lesen"); }
}

/* Autosave. Grosszügig begrenzt — niemand soll Arbeit verlieren, weil er
   schnell tippt (§70). Die Version entscheidet über Konflikte (§26). */
export async function PATCH(req: NextRequest, { params }: P) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    const { ref } = await params;
    await ratenPruefen(req, "autosave", 600, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const roh = await jsonLesen(req);
    if (!roh || typeof roh !== "object") throw new AppError("VALIDATION", "Kein Inhalt");
    const { version, daten } = roh as { version?: unknown; daten?: unknown };
    if (typeof version !== "number") throw new AppError("VALIDATION", "Version fehlt", { version: "erforderlich" });
    return Response.json(await entwurfSpeichern(s.person, ref.toUpperCase(), daten, version));
  } catch (e) { return fehlerAntwort(e, "entwuerfe.speichern"); }
}
