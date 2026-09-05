import { NextRequest } from "next/server";
import { treffernachRefs } from "@/server/favoriten";
import { env } from "@/server/env";
import { ratenPruefen, fehlerAntwort } from "@/lib/route-schutz";

export const dynamic = "force-dynamic";

/* GET /api/vergleich?refs=FWL-...,FWL-... → Treffer der (höchstens vier)
   angefragten, aktuell öffentlichen Referenzen. Keine Sitzung nötig — der
   Vergleich lebt im Browser (components/vergleich.ts), diese Route löst nur
   Referenzen zu Treffern auf, wie /api/favoriten es für die Merkliste tut.
   Ungültige, doppelte oder nicht (mehr) öffentliche Referenzen fehlen im
   Ergebnis einfach — kein Fehler dafür. */
export async function GET(req: NextRequest) {
  try {
    await ratenPruefen(req, "vergleich-lesen", 60, 60 * 60 * 1000, env().APP_SECRET ?? "dev");
    const refs = (req.nextUrl.searchParams.get("refs") ?? "")
      .split(",").map(r => r.trim()).filter(Boolean).slice(0, 4);
    return Response.json({ treffer: await treffernachRefs(refs) }, { headers: { "cache-control": "no-store" } });
  } catch (e) { return fehlerAntwort(e, "vergleich.liste"); }
}
