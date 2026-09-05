import { NextRequest } from "next/server";
import { treffernachRefs } from "@/server/favoriten";
import { env } from "@/server/env";
import { ratenPruefen, fehlerAntwort } from "@/lib/route-schutz";

export const dynamic = "force-dynamic";

/* GET /api/favoriten/aufloesen?refs=FWL-...,FWL-... → Treffer der (höchstens
   60) angefragten, aktuell öffentlichen Referenzen. Keine Sitzung nötig: dient
   der anonymen, lokal gespeicherten Merkliste (components/favorites.ts) auf
   /konto/favoriten — wie /api/vergleich es für die (auf vier begrenzte)
   Vergleichsliste tut, nur mit höherer Obergrenze, weil die Merkliste keine
   Vier-Objekte-Grenze kennt. Ungültige, doppelte oder nicht (mehr) öffentliche
   Referenzen fehlen im Ergebnis einfach — kein Fehler dafür. */
export async function GET(req: NextRequest) {
  try {
    await ratenPruefen(req, "favoriten-aufloesen", 60, 60 * 60 * 1000, env().APP_SECRET ?? "dev");
    const refs = (req.nextUrl.searchParams.get("refs") ?? "")
      .split(",").map(r => r.trim()).filter(Boolean).slice(0, 60);
    return Response.json({ treffer: await treffernachRefs(refs) }, { headers: { "cache-control": "no-store" } });
  } catch (e) { return fehlerAntwort(e, "favoriten.aufloesen"); }
}
