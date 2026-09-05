import { NextRequest } from "next/server";
import { z } from "zod";
import { verlangeSitzung } from "@/server/sitzung";
import { favoritenMergen } from "@/server/favoriten";
import { env } from "@/server/env";
import { herkunftPruefen, ratenPruefen, jsonLesen, fehlerAntwort } from "@/lib/route-schutz";

export const dynamic = "force-dynamic";

/* Höchstens 500 Zeichenketten entgegennehmen (Schutz vor missbrauchter
   Eingabe) — welche davon gültige, existierende Referenzen sind, entscheidet
   favoritenMergen() selbst (Muster + höchstens 200, alles andere wird
   stillschweigend ignoriert statt die ganze Anfrage abzulehnen). */
const MergeSchema = z.object({ refs: z.array(z.string()).max(500) });

export async function POST(req: NextRequest) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    await ratenPruefen(req, "favorit-merge", 10, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const { refs } = MergeSchema.parse(await jsonLesen(req));
    await favoritenMergen(s.person.id, refs);
    return Response.json({ ok: true });
  } catch (e) { return fehlerAntwort(e, "favoriten.merge"); }
}
