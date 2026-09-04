import { verlangeRecht } from "@/server/sitzung";
import { warteschlange } from "@/server/moderation";
import { fehlerAntwort } from "@/lib/route-schutz";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const s = await verlangeRecht("VIEW_MODERATION_QUEUE");
    return Response.json({ warteschlange: await warteschlange(s.person) }, { headers: { "cache-control": "no-store" } });
  } catch (e) { return fehlerAntwort(e, "moderation.warteschlange"); }
}
