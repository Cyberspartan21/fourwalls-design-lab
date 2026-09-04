import { NextRequest } from "next/server";
import { verlangeSitzung } from "@/server/sitzung";
import { entwurfEinreichen, entwurfZurueckziehen } from "@/server/entwuerfe";
import { env } from "@/server/env";
import { herkunftPruefen, ratenPruefen, jsonLesen, fehlerAntwort } from "@/lib/route-schutz";
import { AppError } from "@/lib/errors";

/* Absichten der Eigentümerin — nie ein Zustand, den der Browser wählt (§42). */
export const dynamic = "force-dynamic";
type P = { params: Promise<{ ref: string }> };

export async function POST(req: NextRequest, { params }: P) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    const { ref } = await params;
    await ratenPruefen(req, "entwurf-aktion", 60, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const roh = await jsonLesen(req) as { absicht?: unknown };
    const absicht = String(roh?.absicht ?? "");
    if (absicht === "einreichen") return Response.json(await entwurfEinreichen(s.person, ref.toUpperCase()));
    if (absicht === "zurueckziehen") { await entwurfZurueckziehen(s.person, ref.toUpperCase()); return Response.json({ ok: true }); }
    throw new AppError("VALIDATION", "Unbekannte Absicht", { absicht: "einreichen | zurueckziehen" });
  } catch (e) { return fehlerAntwort(e, "entwuerfe.aktion"); }
}
