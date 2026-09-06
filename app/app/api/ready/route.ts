import { dbErreichbar } from "@/server/db";
import { bereitschaft } from "@/config/bereitschaft";

/* Ist die Anwendung bereit, Verkehr zu bedienen? „ready" heisst ausschliesslich:
   darf Produktionsverkehr technisch annehmen — Datenbank erreichbar,
   Migrationen aktuell, Umgebungsschema gültig. Keine Verbindungsdaten, kein
   Stack, keine Konfigurationswerte in der Antwort (P5.5 §43).

   `launch` (P5.10 §3/§4: config/bereitschaft.ts) meldet zusätzlich die volle
   Startbereitschaft (TECH/BUSINESS/LEGAL/INFRA) — rein informativ:
   ein fehlendes Geschäfts- oder Rechtstor ist kein Grund, /api/ready
   scheitern zu lassen (eine Staging-Umgebung ist technisch „ready", ohne
   dass die Firma dort öffentlich starten will). `launch` beeinflusst den
   HTTP-Status dieser Route NIE. */
export const dynamic = "force-dynamic";
export async function GET() {
  const [db, launch] = await Promise.all([dbErreichbar(), bereitschaft()]);
  const findet = (id: string) => launch.tore.tech.find(p => p.id === id)?.status === "ok";
  const migrationenOk = findet("migrationen");
  const envOk = findet("umgebung");
  const outboxOk = findet("outbox");
  const speicherOk = findet("speicher");

  const ready = db && migrationenOk && envOk;

  return Response.json(
    { status: ready ? "ready" : "not-ready", checks: { db, storage: speicherOk, outbox: outboxOk }, launch },
    { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } }
  );
}
