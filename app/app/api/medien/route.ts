import { NextRequest } from "next/server";
import { verlangeSitzung } from "@/server/sitzung";
import { bildHochladen, meineBilder } from "@/server/medien";
import { env } from "@/server/env";
import { herkunftPruefen, ratenPruefen, fehlerAntwort } from "@/lib/route-schutz";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const s = await verlangeSitzung();
    return Response.json({ bilder: await meineBilder(s.person) }, { headers: { "cache-control": "no-store" } });
  } catch (e) { return fehlerAntwort(e, "medien.liste"); }
}

/* Ein Bild. Der Inhalt entscheidet über Art und Zulässigkeit, nicht der Name (§33). */
export async function POST(req: NextRequest) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    await ratenPruefen(req, "upload", 80, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const laenge = Number(req.headers.get("content-length") ?? 0);
    if (laenge > 9 * 1024 * 1024) throw new AppError("VALIDATION", "Das Bild ist zu gross");
    const form = await req.formData();
    const datei = form.get("datei");
    if (!(datei instanceof File)) throw new AppError("VALIDATION", "Keine Datei erhalten");
    const bild = await bildHochladen(s.person, await datei.arrayBuffer(), datei.type || "unbekannt");
    return Response.json(bild, { status: 201 });
  } catch (e) { return fehlerAntwort(e, "medien.upload"); }
}
