import { NextRequest } from "next/server";
import { z } from "zod";
import { verlangeSitzung } from "@/server/sitzung";
import { listeFavoriten, favoritKippen } from "@/server/favoriten";
import { env } from "@/server/env";
import { herkunftPruefen, ratenPruefen, jsonLesen, fehlerAntwort } from "@/lib/route-schutz";

export const dynamic = "force-dynamic";

/* Meine Merkliste — nur Referenzen, die Seite löst sie bei Bedarf zu Treffern auf. */
export async function GET() {
  try {
    const s = await verlangeSitzung();
    return Response.json({ refs: await listeFavoriten(s.person.id) }, { headers: { "cache-control": "no-store" } });
  } catch (e) { return fehlerAntwort(e, "favoriten.liste"); }
}

const KippenSchema = z.object({ publicRef: z.string().regex(/^FWL-\d{4}-\d{6}$/) });

/* Merken/Entmerken — ein Aufruf schaltet um. */
export async function POST(req: NextRequest) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    await ratenPruefen(req, "favorit-kippen", 120, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const { publicRef } = KippenSchema.parse(await jsonLesen(req));
    return Response.json(await favoritKippen(s.person.id, publicRef));
  } catch (e) { return fehlerAntwort(e, "favoriten.kippen"); }
}
