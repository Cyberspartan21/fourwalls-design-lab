import { NextRequest } from "next/server";
import { verlangeRecht } from "@/server/sitzung";
import { fallLesen, freigeben, aenderungVerlangen, ablehnen, veroeffentlichen, pausieren, type ModerationsGrund } from "@/server/moderation";
import { env } from "@/server/env";
import { herkunftPruefen, ratenPruefen, jsonLesen, fehlerAntwort } from "@/lib/route-schutz";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ ref: string }> };

export async function GET(_req: NextRequest, { params }: P) {
  try {
    const s = await verlangeRecht("REVIEW_LISTING");
    const { ref } = await params;
    return Response.json(await fallLesen(s.person, ref.toUpperCase()), { headers: { "cache-control": "no-store" } });
  } catch (e) { return fehlerAntwort(e, "moderation.fall"); }
}

/* Eine Absicht je Aufruf. «freigeben+veröffentlichen» führt beide Übergänge
   nacheinander aus — beide stehen danach im Protokoll (§44). */
export async function POST(req: NextRequest, { params }: P) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeRecht("REVIEW_LISTING");
    const { ref } = await params;
    const publicRef = ref.toUpperCase();
    await ratenPruefen(req, "moderation", 300, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const roh = await jsonLesen(req) as { absicht?: unknown; nachricht?: unknown; grund?: unknown; notiz?: unknown };
    const absicht = String(roh?.absicht ?? "");
    const nachricht = String(roh?.nachricht ?? "");
    const grund = String(roh?.grund ?? "other") as ModerationsGrund;

    if (absicht === "freigeben") await freigeben(s.person, publicRef, roh?.notiz ? String(roh.notiz).slice(0, 2000) : undefined);
    else if (absicht === "veroeffentlichen") await veroeffentlichen(s.person, publicRef);
    else if (absicht === "freigeben-und-veroeffentlichen") { await freigeben(s.person, publicRef); await veroeffentlichen(s.person, publicRef); }
    else if (absicht === "aenderung") await aenderungVerlangen(s.person, publicRef, nachricht, grund);
    else if (absicht === "ablehnen") await ablehnen(s.person, publicRef, nachricht, grund);
    else if (absicht === "pausieren") await pausieren(s.person, publicRef, nachricht || undefined);
    else throw new AppError("VALIDATION", "Unbekannte Absicht", { absicht: "freigeben | veroeffentlichen | freigeben-und-veroeffentlichen | aenderung | ablehnen | pausieren" });

    return Response.json({ ok: true, absicht });
  } catch (e) { return fehlerAntwort(e, "moderation.aktion"); }
}
