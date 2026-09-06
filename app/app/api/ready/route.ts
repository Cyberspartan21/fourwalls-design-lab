import { dbErreichbar } from "@/server/db";
import { startTor } from "@/config/start-tor";

/* Ist die Anwendung bereit, Verkehr zu bedienen? Prüft die Datenbank —
   keine Verbindungsdaten, kein Stack in der Antwort (P5.5 §43).

   `startTor` (P5.9 Phase B) meldet zusätzlich, ob das Start-Tor für die
   Produktion offen wäre — rein informativ: ein fehlendes Start-Tor ist kein
   Grund, den Health-Check scheitern zu lassen (das Bild kann bereit sein,
   ohne dass die Firma schon öffentlich starten will). */
export const dynamic = "force-dynamic";
export async function GET() {
  const db = await dbErreichbar();
  const tor = startTor();
  return Response.json(
    db
      ? { status: "ready", startTor: { bereit: tor.bereit, fehlend: tor.fehlend } }
      : { status: "not-ready", db: "unreachable" },
    { status: db ? 200 : 503, headers: { "cache-control": "no-store" } }
  );
}
