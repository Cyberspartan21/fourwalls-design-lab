import { NextRequest } from "next/server";
import { verlangeSitzung } from "@/server/sitzung";
import { verlangeOrgRecht } from "@/server/org-kontext";
import { zuweisen } from "@/server/entwuerfe";
import { env } from "@/server/env";
import { herkunftPruefen, ratenPruefen, jsonLesen, fehlerAntwort } from "@/lib/route-schutz";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ slug: string; ref: string }> };

/* Ein Inserat einem Teammitglied zuweisen — oder die Zuweisung aufheben
   (`userId: null`). Die Route verlangt das Teamrecht in der Organisation der
   Adresse; `zuweisen()` prüft zusätzlich, dass das ANGESPROCHENE Inserat
   wirklich dieser Organisation gehört (fremdes Inserat → NOT_FOUND, §13). */
export async function POST(req: NextRequest, { params }: P) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    const { slug, ref } = await params;
    await ratenPruefen(req, "org-inserat-zuweisen", 120, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    await verlangeOrgRecht(s.person, slug, "ASSIGN_LISTING");
    const roh = await jsonLesen(req) as { userId?: unknown };
    if (roh.userId !== null && typeof roh.userId !== "string") throw new AppError("VALIDATION", "userId fehlt", { userId: "erforderlich" });
    const e = await zuweisen(s.person, ref.toUpperCase(), roh.userId);
    return Response.json(e);
  } catch (e) { return fehlerAntwort(e, "org.inserate.zuweisen"); }
}
