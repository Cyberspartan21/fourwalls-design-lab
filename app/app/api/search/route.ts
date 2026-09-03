import { NextRequest } from "next/server";
import { anfrageAusParams, SuchanfrageSchema, suche } from "@/server/search";
import { istLocale } from "@/i18n";
import { AppError, asAppError } from "@/lib/errors";
import { log } from "@/lib/log";
import type { Suchanfrage } from "@/domain/marktplatz";

/* GET /api/search?trans=buy&ort=ort-zuerich&um=10&typ=wohnung&pmin=…&seite=2
       …&ansicht=karte           → Kartenmodus: alle Punkte + die ersten 60 Karten
       …&box=n,s,o,w             → Kartenausschnitt (schlägt Umkreis)
   Dieselben Parameternamen wie die Adresszeile der Suche (P2). Jeder Wert wird
   geprüft und begrenzt; die Antwort enthält nur öffentliche Geografie. */
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const p = Object.fromEntries(req.nextUrl.searchParams.entries());
    const locale = istLocale(p.locale ?? "") ? (p.locale as "de") : "de";
    /* Streng: was nicht ins Schema passt, wird hier (anders als auf der Seite) abgewiesen */
    const q: Suchanfrage = anfrageAusParams(p, undefined, true);
    if (p.proSeite) { const ps = SuchanfrageSchema.shape.proSeite.safeParse(p.proSeite); if (!ps.success) throw new AppError("VALIDATION", "Ungültige Seitengrösse"); q.proSeite = ps.data; }
    const a = await suche(q, locale);
    return Response.json(a, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const err = asAppError(e);
    if (err.code === "INTERNAL") log.error("search.fehler", { fehler: e instanceof Error ? e.message : String(e) });
    return Response.json(err.toResponseBody(), { status: err.status });
  }
}
