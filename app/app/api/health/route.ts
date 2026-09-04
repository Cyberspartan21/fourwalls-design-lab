import { env } from "@/server/env";

/* Lebt der Prozess? Keine Datenbankprüfung — das ist Aufgabe von /api/ready.
   Immer 200, solange der Node-Prozess Anfragen beantwortet (P5.5 §43). */
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({ status: "alive", env: env().APP_ENV }, { status: 200, headers: { "cache-control": "no-store" } });
}
