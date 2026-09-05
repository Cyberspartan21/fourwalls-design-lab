import { NextRequest } from "next/server";
import { z } from "zod";
import { verlangeSitzung } from "@/server/sitzung";
import { umbenennen, frequenzAendern, pausierenUmschalten, loeschen } from "@/server/gespeicherteSuchen";
import { env } from "@/server/env";
import { herkunftPruefen, ratenPruefen, jsonLesen, fehlerAntwort } from "@/lib/route-schutz";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  label: z.string().max(200).nullable().optional(),
  frequency: z.enum(["immediately", "daily", "weekly"]).optional(),
  isPaused: z.boolean().optional()
});

/* Verwalten des eigenen Suchabos — umbenennen, Häufigkeit ändern, pausieren.
   Jede zugrundeliegende Funktion prüft die Eigentümerschaft selbst (§13/§65):
   eine fremde ID führt zu NOT_FOUND, nie zu FORBIDDEN. */
export async function PATCH(req: NextRequest, { params }: P) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    await ratenPruefen(req, "suchabo-aendern", 60, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const { id } = await params;
    const body = PatchSchema.parse(await jsonLesen(req));
    if (body.label !== undefined) await umbenennen(s.person.id, id, body.label);
    if (body.frequency !== undefined) await frequenzAendern(s.person.id, id, body.frequency);
    if (body.isPaused !== undefined) await pausierenUmschalten(s.person.id, id, body.isPaused);
    return Response.json({ ok: true });
  } catch (e) { return fehlerAntwort(e, "suchabo.aendern"); }
}

export async function DELETE(req: NextRequest, { params }: P) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    await ratenPruefen(req, "suchabo-loeschen", 60, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const { id } = await params;
    await loeschen(s.person.id, id);
    return Response.json({ ok: true });
  } catch (e) { return fehlerAntwort(e, "suchabo.loeschen"); }
}
