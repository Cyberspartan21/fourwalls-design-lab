import { NextRequest } from "next/server";
import { anliegenAnnehmen } from "@/server/anliegen";
import { personOderNull } from "@/server/sitzung";
import { env } from "@/server/env";
import { herkunftHash } from "@/lib/ratelimit";
import { herkunftPruefen, ratenPruefen, jsonLesen, fehlerAntwort } from "@/lib/route-schutz";

/* POST /api/anliegen — die öffentliche Annahme eines Anliegens (P5.8).

   Schutz, in dieser Reihenfolge: Herkunft → Grösse → Ratenlimit je Herkunft
   UND je E-Mail-Adresse → Honigtopf/Schema (in server/anliegen.ts). Die
   E-Mail-Grenze verhindert, dass eine Adresse über wechselnde IP-Adressen
   mit Anliegen überschüttet wird — der Schlüssel ist ein Hash, nie die
   Adresse selbst im Speicher des Zählers. */

const MAX_BYTES = 32 * 1024;

/* Reines sha256(text) — für den E-Mail-Schlüssel des Ratenlimits, ohne Salz:
   Die Grenze zählt je Adresse, nicht je Adresse und Geheimnis. */
async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const roh = await jsonLesen(req, MAX_BYTES);
    const salz = env().APP_SECRET ?? "dev-salz";

    await ratenPruefen(req, "anliegen", 5, 60 * 60 * 1000, salz);

    const email = (roh as { kontakt?: { email?: unknown } } | null)?.kontakt?.email;
    if (typeof email === "string" && email.length > 0) {
      const schluessel = "anliegen-mail:" + (await sha256Hex(email.trim().toLowerCase()));
      await ratenPruefen(req, "anliegen-mail", 3, 24 * 60 * 60 * 1000, salz, schluessel);
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "lokal";
    const ipHash = await herkunftHash(ip, salz);
    const ua = req.headers.get("user-agent");
    const uaHash = ua ? await herkunftHash(ua, salz) : null;

    const person = await personOderNull();
    const ergebnis = await anliegenAnnehmen(roh, { ipHash, uaHash }, person);
    return Response.json({ publicRef: ergebnis.publicRef }, { status: 201 });
  } catch (e) { return fehlerAntwort(e, "anliegen.annehmen"); }
}
