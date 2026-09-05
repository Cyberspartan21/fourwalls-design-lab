import { NextRequest } from "next/server";
import { z } from "zod";
import { verlangeSitzung } from "@/server/sitzung";
import { verlangeOrgRecht } from "@/server/org-kontext";
import { rolleAendern, mitgliedEntfernen } from "@/server/organisationen";
import { env } from "@/server/env";
import { herkunftPruefen, ratenPruefen, jsonLesen, fehlerAntwort } from "@/lib/route-schutz";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ slug: string; userId: string }> };

const RolleSchema = z.object({ rolle: z.enum(["owner", "admin", "agent", "viewer"]) }).strict();

/* Rolle eines Teammitglieds ändern. */
export async function PATCH(req: NextRequest, { params }: P) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    const { slug, userId } = await params;
    await ratenPruefen(req, "org-rolle-aendern", 60, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const kontext = await verlangeOrgRecht(s.person, slug, "MANAGE_MEMBERS");
    const { rolle } = RolleSchema.parse(await jsonLesen(req));
    await rolleAendern(kontext, s.person, userId, rolle);
    return Response.json({ ok: true });
  } catch (e) { return fehlerAntwort(e, "org.mitglieder.rolle"); }
}

/* Ein Teammitglied entfernen. */
export async function DELETE(req: NextRequest, { params }: P) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    const { slug, userId } = await params;
    await ratenPruefen(req, "org-mitglied-entfernen", 60, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const kontext = await verlangeOrgRecht(s.person, slug, "MANAGE_MEMBERS");
    await mitgliedEntfernen(kontext, s.person, userId);
    return Response.json({ ok: true });
  } catch (e) { return fehlerAntwort(e, "org.mitglieder.entfernen"); }
}
