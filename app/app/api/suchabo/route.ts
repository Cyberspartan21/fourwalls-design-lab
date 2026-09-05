import { NextRequest } from "next/server";
import { z } from "zod";
import { personOderNull, verlangeSitzung } from "@/server/sitzung";
import { anlegen, meineSuchen } from "@/server/gespeicherteSuchen";
import { env } from "@/server/env";
import { AppError } from "@/lib/errors";
import { herkunftPruefen, ratenPruefen, jsonLesen, fehlerAntwort } from "@/lib/route-schutz";

export const dynamic = "force-dynamic";

/* Meine gespeicherten Suchen — nur angemeldet (die Kontoseite braucht das
   nicht: sie ruft meineSuchen() serverseitig direkt. Diese Route besteht für
   das Prüfskript und für einen möglichen künftigen Client-Aufruf). */
export async function GET() {
  try {
    const s = await verlangeSitzung();
    return Response.json({ suchen: await meineSuchen(s.person.id) }, { headers: { "cache-control": "no-store" } });
  } catch (e) { return fehlerAntwort(e, "suchabo.liste"); }
}

const BodySchema = z.object({
  query: z.unknown(),
  label: z.string().max(200).nullable().optional(),
  email: z.string().email().optional(),
  frequency: z.enum(["immediately", "daily", "weekly"]),
  locale: z.enum(["de", "fr", "it", "en"]).optional()
});

/* Ein Suchabo anlegen — angemeldet sofort aktiv (Kontoadresse), sonst mit
   Bestätigungsmail (Double-Opt-in). Ein mitgeschicktes email-Feld wird bei
   bestehender Sitzung ignoriert: die Zieladresse kommt nie vom Client. */
export async function POST(req: NextRequest) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const person = await personOderNull();
    await ratenPruefen(req, "suchabo-anlegen", 10, 60 * 60 * 1000, env().APP_SECRET ?? "dev", person?.id);
    const body = BodySchema.parse(await jsonLesen(req));
    if (!person && !body.email) {
      throw new AppError("VALIDATION", "Bitte geben Sie eine E-Mail-Adresse an", { email: "Pflichtfeld" });
    }
    const traeger = person ? { userId: person.id } : { email: body.email! };
    const ergebnis = await anlegen(traeger, body.query, body.label ?? null, body.frequency, body.locale);
    return Response.json({ ok: true, erfordertBestaetigung: ergebnis.erfordertBestaetigung }, { status: 201 });
  } catch (e) { return fehlerAntwort(e, "suchabo.anlegen"); }
}
