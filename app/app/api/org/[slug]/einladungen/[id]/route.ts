import { NextRequest } from "next/server";
import { verlangeSitzung } from "@/server/sitzung";
import { verlangeOrgRecht } from "@/server/org-kontext";
import { widerrufen } from "@/server/einladungen";
import { env } from "@/server/env";
import { herkunftPruefen, ratenPruefen, fehlerAntwort } from "@/lib/route-schutz";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ slug: string; id: string }> };

/* Eine offene Einladung widerrufen — nur innerhalb der eigenen Organisation. */
export async function DELETE(req: NextRequest, { params }: P) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    const { slug, id } = await params;
    await ratenPruefen(req, "org-einladung-widerrufen", 60, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const kontext = await verlangeOrgRecht(s.person, slug, "MANAGE_MEMBERS");
    await widerrufen(kontext, id);
    return Response.json({ ok: true });
  } catch (e) { return fehlerAntwort(e, "org.einladung.widerrufen"); }
}
