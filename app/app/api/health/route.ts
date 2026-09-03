import { dbErreichbar } from "@/server/db";
import { env } from "@/server/env";

/* Lebt die Anwendung, erreicht sie die Datenbank. Keine Interna. */
export const dynamic = "force-dynamic";
export async function GET() {
  const db = await dbErreichbar();
  return Response.json({ status: db ? "ok" : "degraded", db: db ? "reachable" : "unreachable", env: env().APP_ENV }, { status: db ? 200 : 503 });
}
