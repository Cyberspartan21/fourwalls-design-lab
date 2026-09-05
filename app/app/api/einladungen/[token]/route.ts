import { NextRequest } from "next/server";
import { verlangeSitzung } from "@/server/sitzung";
import { einladungLesen, annehmen } from "@/server/einladungen";
import { env } from "@/server/env";
import { herkunftPruefen, ratenPruefen, fehlerAntwort } from "@/lib/route-schutz";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ token: string }> };

/* Öffentlich, ohne Sitzung — für die Annahmeseite. Kein herkunftPruefen()
   (der Link kommt aus einer E-Mail), stattdessen ein Ratenlimit je Herkunft,
   damit niemand Tokens durchprobieren kann (§14/§15). */
export async function GET(req: NextRequest, { params }: P) {
  try {
    const { token } = await params;
    await ratenPruefen(req, "einladung-lesen", 30, 60 * 60 * 1000, env().APP_SECRET ?? "dev");
    return Response.json(await einladungLesen(token), { headers: { "cache-control": "no-store" } });
  } catch (e) { return fehlerAntwort(e, "einladung.lesen"); }
}

/* Annehmen — verlangt eine Sitzung; welche Adresse eingeladen wurde, entscheidet
   server/einladungen.ts:annehmen anhand der Kontoadresse, nie ein Feld aus
   dem Body. */
export async function POST(req: NextRequest, { params }: P) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    const { token } = await params;
    await ratenPruefen(req, "einladung-annehmen", 10, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const ergebnis = await annehmen(s.person, token);
    return Response.json(ergebnis);
  } catch (e) { return fehlerAntwort(e, "einladung.annehmen"); }
}
