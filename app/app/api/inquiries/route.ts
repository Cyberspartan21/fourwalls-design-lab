import { NextRequest } from "next/server";
import { AnfrageSchema, anfrageAnnehmen } from "@/server/inquiries";
import { env } from "@/server/env";
import { personOderNull } from "@/server/sitzung";
import { AppError, asAppError } from "@/lib/errors";
import { log } from "@/lib/log";
import { speicherLimiter, herkunftHash } from "@/lib/ratelimit";

/* POST /api/inquiries — die einzige Schreibroute der Scheibe.

   Schutz, in dieser Reihenfolge: Herkunft (Origin / Sec-Fetch-Site), Grösse,
   Ratenlimit je Herkunft, Honigtopf, Schema. Erst dann berührt die Anfrage die
   Datenbank. Fehler kommen als das Fehlermodell aus lib/errors — nie als
   Stack oder SQL.

   Zum CSRF-Modell: Ein Route Handler prüft die Herkunft nicht von selbst
   (anders als Server Actions, die Next mit Origin/Host abgleicht). Darum
   hier ausdrücklich. Es gibt keine Cookie-Sitzung in P5.2 — die Prüfung
   verhindert Missbrauch von fremden Seiten aus, sobald es eine gibt. */

const MAX_BYTES = 8 * 1024;
const jeHerkunft = speicherLimiter(5, 10 * 60 * 1000);   // 5 Anfragen je 10 Minuten
const jeInserat  = speicherLimiter(60, 60 * 60 * 1000);  // 60 je Inserat und Stunde

function herkunftErlaubt(req: NextRequest): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && !["same-origin", "same-site", "none"].includes(site)) return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;               // Nicht-Browser: kein Origin, kein Sec-Fetch-Site — das Ratenlimit greift
  const eigen = new Set<string>([new URL(env().NEXT_PUBLIC_SITE_URL).origin]);
  const host = req.headers.get("host");
  if (host) { eigen.add(`http://${host}`); eigen.add(`https://${host}`); }
  return eigen.has(origin);
}

export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    if (!herkunftErlaubt(req)) throw new AppError("FORBIDDEN", "Die Anfrage kam nicht von dieser Website");
    const laenge = Number(req.headers.get("content-length") ?? 0);
    if (laenge > MAX_BYTES) throw new AppError("VALIDATION", "Die Anfrage ist zu gross");
    const text = await req.text();
    if (text.length > MAX_BYTES) throw new AppError("VALIDATION", "Die Anfrage ist zu gross");

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "lokal";
    const salz = env().APP_SECRET ?? "dev-salz";
    const ipHash = await herkunftHash(ip, salz);
    if (!(await jeHerkunft.erlaubt(ipHash))) throw new AppError("RATE_LIMIT", "Zu viele Anfragen — bitte später noch einmal");

    let roh: unknown;
    try { roh = JSON.parse(text); } catch { throw new AppError("VALIDATION", "Kein gültiges JSON"); }
    const p = AnfrageSchema.safeParse(roh);
    if (!p.success) {
      /* Der Honigtopf ist eine Validierungsverletzung wie jede andere —
         Skripte bekommen keinen anderen Hinweis als Menschen. */
      throw new AppError("VALIDATION", "Bitte prüfen Sie Ihre Angaben", Object.fromEntries(Object.entries(p.error.flatten().fieldErrors).map(([k, v]) => [k, (v as string[] | undefined)?.[0] ?? "ungültig"])));
    }
    if (!(await jeInserat.erlaubt(p.data.publicRef))) throw new AppError("RATE_LIMIT", "Zu viele Anfragen zu diesem Inserat");

    const ua = req.headers.get("user-agent");
    const senderUserId = (await personOderNull())?.id ?? null;
    const ergebnis = await anfrageAnnehmen(p.data, { ipHash, uaHash: ua ? await herkunftHash(ua, salz) : null }, senderUserId);
    return Response.json({ angenommen: true, publicRef: ergebnis.publicRef }, { status: 201 });
  } catch (e) {
    const err = asAppError(e);
    if (err.code === "INTERNAL") log.error("inquiry.fehler", { fehler: e instanceof Error ? e.message : String(e) });
    return Response.json(err.toResponseBody(), { status: err.status });
  }
}
