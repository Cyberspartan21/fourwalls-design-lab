import { NextRequest } from "next/server";
import { verlangeSitzung } from "@/server/sitzung";
import { meineOrganisationen } from "@/server/org-kontext";
import { organisationAnlegen } from "@/server/organisationen";
import { env } from "@/server/env";
import { herkunftPruefen, ratenPruefen, jsonLesen, fehlerAntwort } from "@/lib/route-schutz";

export const dynamic = "force-dynamic";

/* Meine Organisationen — für den Umschalter im Konto (§18). */
export async function GET() {
  try {
    const s = await verlangeSitzung();
    return Response.json({ organisationen: await meineOrganisationen(s.person.id) }, { headers: { "cache-control": "no-store" } });
  } catch (e) { return fehlerAntwort(e, "org.liste"); }
}

/* Eine Organisation anlegen. Die Erlaubnisliste steht in
   server/organisationen.ts:organisationAnlegen — kein Feld daraus kommt aus
   dem Body ausser dem, was dort ausdrücklich erlaubt ist. */
export async function POST(req: NextRequest) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    await ratenPruefen(req, "org-anlegen", 10, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const roh = await jsonLesen(req);
    const profil = await organisationAnlegen(s.person, roh);
    return Response.json(profil, { status: 201 });
  } catch (e) { return fehlerAntwort(e, "org.anlegen"); }
}
