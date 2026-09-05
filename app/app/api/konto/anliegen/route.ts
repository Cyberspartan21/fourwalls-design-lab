import { verlangeSitzung } from "@/server/sitzung";
import { meineAnliegen } from "@/server/anliegen";
import { fehlerAntwort } from "@/lib/route-schutz";

/* GET /api/konto/anliegen — die eigenen Anliegen einer angemeldeten Person. */

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const s = await verlangeSitzung();
    return Response.json({ anliegen: await meineAnliegen(s.person.id) }, { headers: { "cache-control": "no-store" } });
  } catch (e) { return fehlerAntwort(e, "anliegen.meine"); }
}
