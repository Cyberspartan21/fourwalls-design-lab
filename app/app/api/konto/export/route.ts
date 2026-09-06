import { NextRequest } from "next/server";
import { verlangeSitzung } from "@/server/sitzung";
import { kontoExportieren } from "@/server/konto-export";
import { env } from "@/server/env";
import { herkunftPruefen, ratenPruefen, fehlerAntwort } from "@/lib/route-schutz";

export const dynamic = "force-dynamic";

/* GET /api/konto/export — die eigenen Daten als Datei zum Herunterladen
   (P5.10 §12). Ratenbegrenzung 3/h: ein Export ist teuer genug (mehrere
   Abfragen) und selten genug gebraucht, dass ein enges Limit niemanden im
   normalen Gebrauch stört. herkunftPruefen() auch bei GET: ein Download-Link
   von einer fremden Seite aus soll nicht funktionieren. */
export async function GET(req: NextRequest) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    await ratenPruefen(req, "konto-export", 3, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const daten = await kontoExportieren(s.person, s.email);
    const datum = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(daten, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="fourwalls-konto-${datum}.json"`,
        "cache-control": "no-store"
      }
    });
  } catch (e) { return fehlerAntwort(e, "konto.export"); }
}
