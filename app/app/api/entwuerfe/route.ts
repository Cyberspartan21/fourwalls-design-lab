import { NextRequest } from "next/server";
import { verlangeRecht } from "@/server/sitzung";
import { entwurfAnlegen, meineInserate } from "@/server/entwuerfe";
import { EntwurfSchema } from "@/domain/entwurf";
import { env } from "@/server/env";
import { herkunftPruefen, ratenPruefen, jsonLesen, fehlerAntwort } from "@/lib/route-schutz";

export const dynamic = "force-dynamic";

/* Meine Inserate. */
export async function GET() {
  try {
    const s = await verlangeRecht("VIEW_OWN_LISTINGS");
    return Response.json({ inserate: await meineInserate(s.person) }, { headers: { "cache-control": "no-store" } });
  } catch (e) { return fehlerAntwort(e, "entwuerfe.liste"); }
}

/* Einen Entwurf anlegen — optional mit dem, was vor der Anmeldung schon
   eingegeben wurde (§23). Das Schema lässt nur Assistentenfelder durch. */
export async function POST(req: NextRequest) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeRecht("CREATE_OWN_LISTING");
    await ratenPruefen(req, "entwurf-neu", 20, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const roh = await jsonLesen(req);
    const uebernahme = roh && typeof roh === "object" && "daten" in roh
      ? EntwurfSchema.parse((roh as { daten: unknown }).daten) : undefined;
    const e = await entwurfAnlegen(s.person, uebernahme);
    return Response.json(e, { status: 201 });
  } catch (e) { return fehlerAntwort(e, "entwuerfe.anlegen"); }
}
