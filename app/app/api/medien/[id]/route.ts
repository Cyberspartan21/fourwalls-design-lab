import { NextRequest } from "next/server";
import { personOderNull, verlangeSitzung } from "@/server/sitzung";
import { bildAusliefern, bildEntfernen } from "@/server/medien";
import { env } from "@/server/env";
import { herkunftPruefen, fehlerAntwort } from "@/lib/route-schutz";

/* Bilder laufen über diese Route, nicht über den öffentlichen Ordner: ein
   Entwurfsbild darf niemand sehen, der das Inserat nicht sehen darf (§36). */
export const dynamic = "force-dynamic";
type P = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: P) {
  try {
    const { id } = await params;
    const b = await bildAusliefern(await personOderNull(), id);
    if (!b) return new Response("Nicht gefunden", { status: 404 });
    return new Response(b.bytes as unknown as BodyInit, {
      headers: {
        "content-type": b.typ,
        /* Privat, solange nicht veröffentlicht: kein geteilter Zwischenspeicher. */
        "cache-control": "private, max-age=300",
        "x-content-type-options": "nosniff",
        "content-disposition": "inline"
      }
    });
  } catch (e) { return fehlerAntwort(e, "medien.ausliefern"); }
}

export async function DELETE(req: NextRequest, { params }: P) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    const { id } = await params;
    await bildEntfernen(s.person, id);
    return Response.json({ ok: true });
  } catch (e) { return fehlerAntwort(e, "medien.entfernen"); }
}
