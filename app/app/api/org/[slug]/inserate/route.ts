import { NextRequest } from "next/server";
import { verlangeSitzung } from "@/server/sitzung";
import { verlangeOrgRecht } from "@/server/org-kontext";
import { entwurfAnlegen } from "@/server/entwuerfe";
import { orgInserate, orgZaehlung, type OrgInseratFilter } from "@/server/orginserate";
import { EntwurfSchema } from "@/domain/entwurf";
import { env } from "@/server/env";
import { herkunftPruefen, ratenPruefen, jsonLesen, fehlerAntwort } from "@/lib/route-schutz";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ slug: string }> };

/* Die Übersicht der Organisation: nach Status, Zuweisung und Text gefiltert,
   serverseitig geblättert (P5.7 §21/§49/§60). Fremde oder unbekannte
   Organisation → NOT_FOUND (verlangeOrgRecht, §15). */
export async function GET(req: NextRequest, { params }: P) {
  try {
    const s = await verlangeSitzung();
    const { slug } = await params;
    const kontext = await verlangeOrgRecht(s.person, slug, "VIEW_ORG_LISTINGS");
    const p = req.nextUrl.searchParams;
    const sort = p.get("sort");
    const filter: OrgInseratFilter = {
      q: p.get("q") ?? "",
      status: (p.get("status") as OrgInseratFilter["status"]) ?? "",
      zugewiesen: p.get("zugewiesen") ?? "",
      trans: (p.get("trans") as OrgInseratFilter["trans"]) ?? "",
      seite: Number(p.get("seite") ?? "1") || 1,
      ...(sort === "aktualisiert" || sort === "status" || sort === "titel" ? { sort } : {})
    };
    const [uebersicht, zaehlung] = await Promise.all([orgInserate(kontext, filter), orgZaehlung(kontext)]);
    return Response.json({ ...uebersicht, zaehlung }, { headers: { "cache-control": "no-store" } });
  } catch (e) { return fehlerAntwort(e, "org.inserate.liste"); }
}

/* Ein Inserat unter der Organisation anlegen — die Herausgeberschaft kommt
   aus dem Organisationskontext, nie aus dem Formular (§26/§42). */
export async function POST(req: NextRequest, { params }: P) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    const { slug } = await params;
    await ratenPruefen(req, "org-inserat-neu", 20, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const kontext = await verlangeOrgRecht(s.person, slug, "CREATE_LISTING");
    const roh = await jsonLesen(req);
    const uebernahme = roh && typeof roh === "object" && "daten" in roh
      ? EntwurfSchema.parse((roh as { daten: unknown }).daten) : undefined;
    const e = await entwurfAnlegen(s.person, uebernahme, { kontext });
    return Response.json(e, { status: 201 });
  } catch (e) { return fehlerAntwort(e, "org.inserate.anlegen"); }
}
