import { AppError } from "@/lib/errors";
import { fehlerAntwort } from "@/lib/route-schutz";

/* Auffangbecken für jeden /api/*-Pfad, den keine andere Route bedient
   (P5.10 §17). Next matcht literale Segmente (app/api/health, .../search, …)
   immer VOR diesem Catch-all — er greift also ausschliesslich für
   tatsächlich unbekannte API-Pfade.

   Ohne diese Datei würde ein solcher Pfad in app/global-not-found.tsx
   landen: eine ganze HTML-Seite mit Status 404, was für einen API-Client
   nichts Sinnvolles ist und (siehe scripts/fehler-test.mjs) auch nicht der
   Erwartung entspricht, dass /api/* immer JSON antwortet — 4xx/5xx
   eingeschlossen. Alle Methoden liefern dieselbe, nichtssagende Antwort;
   welche Route fehlt, verrät nur der Pfad selbst, den der Client kennt. */
function nichtGefunden(): Response {
  return fehlerAntwort(new AppError("NOT_FOUND", "Diese Schnittstelle gibt es nicht"), "api.catchall");
}

export const dynamic = "force-dynamic";
export const GET = nichtGefunden;
export const POST = nichtGefunden;
export const PUT = nichtGefunden;
export const PATCH = nichtGefunden;
export const DELETE = nichtGefunden;
