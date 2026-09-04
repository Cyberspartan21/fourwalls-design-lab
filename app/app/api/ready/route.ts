import { dbErreichbar } from "@/server/db";

/* Ist die Anwendung bereit, Verkehr zu bedienen? Prüft die Datenbank —
   keine Verbindungsdaten, kein Stack in der Antwort (P5.5 §43). */
export const dynamic = "force-dynamic";
export async function GET() {
  const db = await dbErreichbar();
  return Response.json(
    db ? { status: "ready" } : { status: "not-ready", db: "unreachable" },
    { status: db ? 200 : 503, headers: { "cache-control": "no-store" } }
  );
}
