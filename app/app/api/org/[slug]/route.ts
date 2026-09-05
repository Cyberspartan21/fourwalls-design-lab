import { NextRequest } from "next/server";
import { verlangeSitzung } from "@/server/sitzung";
import { verlangeOrgRecht } from "@/server/org-kontext";
import { profilLesen, profilAendern, stilllegen } from "@/server/organisationen";
import { env } from "@/server/env";
import { herkunftPruefen, ratenPruefen, jsonLesen, fehlerAntwort } from "@/lib/route-schutz";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ slug: string }> };

/* Fremde oder unbekannte Organisation → NOT_FOUND, nie FORBIDDEN (§15) — das
   übernimmt verlangeOrgRecht() für jede Route in dieser Datei. */
export async function GET(_req: NextRequest, { params }: P) {
  try {
    const s = await verlangeSitzung();
    const { slug } = await params;
    const kontext = await verlangeOrgRecht(s.person, slug, "VIEW_ORG_LISTINGS");
    return Response.json(await profilLesen(kontext), { headers: { "cache-control": "no-store" } });
  } catch (e) { return fehlerAntwort(e, "org.profil.lesen"); }
}

export async function PATCH(req: NextRequest, { params }: P) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    const { slug } = await params;
    await ratenPruefen(req, "org-profil-aendern", 60, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const kontext = await verlangeOrgRecht(s.person, slug, "MANAGE_PUBLISHER_PROFILE");
    const roh = await jsonLesen(req);
    return Response.json(await profilAendern(kontext, s.person, roh));
  } catch (e) { return fehlerAntwort(e, "org.profil.aendern"); }
}

export async function DELETE(req: NextRequest, { params }: P) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    const { slug } = await params;
    await ratenPruefen(req, "org-stilllegen", 20, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const kontext = await verlangeOrgRecht(s.person, slug, "MANAGE_ORGANIZATION");
    await stilllegen(kontext, s.person);
    return Response.json({ ok: true });
  } catch (e) { return fehlerAntwort(e, "org.stilllegen"); }
}
