import { NextRequest } from "next/server";
import { verlangeSitzung } from "@/server/sitzung";
import { verlangeOrgRecht } from "@/server/org-kontext";
import { mitglieder } from "@/server/organisationen";
import { einladen } from "@/server/einladungen";
import { env } from "@/server/env";
import { herkunftPruefen, ratenPruefen, jsonLesen, fehlerAntwort } from "@/lib/route-schutz";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ slug: string }> };

/* Team ansehen — jedes Mitglied sieht die Namen, nur wer MANAGE_MEMBERS hat,
   sieht zusätzlich E-Mail-Adressen und offene Einladungen (server-seitig
   entschieden, siehe server/organisationen.ts:mitglieder). */
export async function GET(_req: NextRequest, { params }: P) {
  try {
    const s = await verlangeSitzung();
    const { slug } = await params;
    const kontext = await verlangeOrgRecht(s.person, slug, "VIEW_ORG_LISTINGS");
    return Response.json(await mitglieder(kontext), { headers: { "cache-control": "no-store" } });
  } catch (e) { return fehlerAntwort(e, "org.mitglieder.liste"); }
}

/* Einladen. */
export async function POST(req: NextRequest, { params }: P) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    const { slug } = await params;
    await ratenPruefen(req, "org-einladen", 20, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const kontext = await verlangeOrgRecht(s.person, slug, "MANAGE_MEMBERS");
    const roh = await jsonLesen(req);
    await einladen(kontext, s.person, roh);
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) { return fehlerAntwort(e, "org.mitglieder.einladen"); }
}
