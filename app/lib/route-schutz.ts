import type { NextRequest } from "next/server";
import { AppError, asAppError } from "./errors";
import { log } from "./log";
import { speicherLimiter, herkunftHash, type RateLimiter } from "./ratelimit";

/* Gemeinsamer Schutz für alle schreibenden Routen der Anwendung.

   Better Auth schützt seine eigenen Endpunkte. Unsere Inserats-, Medien- und
   Moderationsrouten schützen sich selbst — die Annahme, eine Auth-Bibliothek
   sichere auch fremde Routen, wäre falsch (§64).

   Reihenfolge, absichtlich: Herkunft → Grösse → Ratenlimit → Inhalt. Was
   billig zu prüfen ist, kommt zuerst. */

export function herkunftPruefen(req: NextRequest, erwarteteBasis: string): void {
  const site = req.headers.get("sec-fetch-site");
  if (site && !["same-origin", "same-site", "none"].includes(site)) {
    throw new AppError("FORBIDDEN", "Die Anfrage kam nicht von dieser Website");
  }
  const origin = req.headers.get("origin");
  if (!origin) return;                       // Nicht-Browser: das Ratenlimit greift
  const eigen = new Set<string>();
  try { eigen.add(new URL(erwarteteBasis).origin); } catch { /* unkonfiguriert */ }
  const host = req.headers.get("host");
  if (host) { eigen.add(`http://${host}`); eigen.add(`https://${host}`); }
  if (!eigen.has(origin)) throw new AppError("FORBIDDEN", "Die Anfrage kam nicht von dieser Website");
}

/* Ein Zähler je Zweck. Im Speicher dieses Prozesses — für eine Instanz
   ausreichend, verteilt braucht es denselben Zähler in Postgres oder Redis
   (im Bericht vermerkt, §18/§70). */
const zaehler = new Map<string, RateLimiter>();
export function limit(zweck: string, max: number, fensterMs: number): RateLimiter {
  const k = `${zweck}:${max}:${fensterMs}`;
  let l = zaehler.get(k);
  if (!l) { l = speicherLimiter(max, fensterMs); zaehler.set(k, l); }
  return l;
}

export async function ratenPruefen(req: NextRequest, zweck: string, max: number, fensterMs: number, salz: string, schluessel?: string): Promise<void> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "lokal";
  const k = schluessel ?? await herkunftHash(ip, salz);
  if (!(await limit(zweck, max, fensterMs).erlaubt(k))) {
    throw new AppError("RATE_LIMIT", "Zu viele Anfragen — bitte einen Moment warten");
  }
}

/* JSON lesen mit Obergrenze: eine Antwort, kein Speicherfresser. */
export async function jsonLesen(req: NextRequest, maxBytes = 64 * 1024): Promise<unknown> {
  const laenge = Number(req.headers.get("content-length") ?? 0);
  if (laenge > maxBytes) throw new AppError("VALIDATION", "Die Anfrage ist zu gross");
  const text = await req.text();
  if (text.length > maxBytes) throw new AppError("VALIDATION", "Die Anfrage ist zu gross");
  try { return JSON.parse(text || "{}"); } catch { throw new AppError("VALIDATION", "Kein gültiges JSON"); }
}

/* Ein Fehler wird zur Antwort — nie zu einem Stack oder einer SQL-Meldung. */
export function fehlerAntwort(e: unknown, wo: string): Response {
  const err = asAppError(e);
  /* Das Fehlerobjekt selbst ins Protokoll — nicht in ein Feld verpackt, sonst
     steht dort «[object Object]» (P5.7-Befund). */
  if (err.code === "INTERNAL") log.error(wo, e);
  return Response.json(err.toResponseBody(), { status: err.status });
}
