import { NextRequest } from "next/server";
import { z } from "zod";
import { verlangeSitzung } from "@/server/sitzung";
import { kontoLoeschen } from "@/server/konto-loeschung";
import { env } from "@/server/env";
import { AppError } from "@/lib/errors";
import { herkunftPruefen, ratenPruefen, jsonLesen, fehlerAntwort } from "@/lib/route-schutz";

export const dynamic = "force-dynamic";

/* Die vier Bestätigungswörter der Formulare (de/fr/it/en) — dieselbe Prüfung
   wie das Formular selbst zeigt, hier zusätzlich serverseitig, damit ein
   direkter API-Aufruf nicht daran vorbeikommt. Gross-/Kleinschreibung und
   Leerraum spielen keine Rolle; die Sicherheit liegt im Passwort, nicht im
   Wort — das Wort ist die bewusste Pause vor einer nicht umkehrbaren Aktion. */
const BESTAETIGUNGSWORT = new Set(["LÖSCHEN", "LOESCHEN", "SUPPRIMER", "ELIMINA", "DELETE"]);

const LoeschenSchema = z.object({
  passwort: z.string().min(1).max(200),
  bestaetigung: z.string().trim().max(40)
}).strict();

/* POST /api/konto/loeschen — Sitzung, Herkunft, Ratenlimit, Passwort, dann in
   EINER Transaktion (server/konto-loeschung.ts). Kein DELETE: die Wirkung ist
   zu weitreichend, um sie in eine einzelne HTTP-Methode ohne Body zu packen —
   ein POST mit Passwort im Body ist hier ehrlicher als ein DELETE ohne. */
export async function POST(req: NextRequest) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    await ratenPruefen(req, "konto-loeschen", 8, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const { passwort, bestaetigung } = LoeschenSchema.parse(await jsonLesen(req));
    if (!BESTAETIGUNGSWORT.has(bestaetigung.toUpperCase())) {
      throw new AppError("VALIDATION", "Bitte tippen Sie das Bestätigungswort genau ab", { bestaetigung: "stimmt nicht" });
    }
    const zusammenfassung = await kontoLoeschen(s.person, s.email, passwort);
    return Response.json(zusammenfassung);
  } catch (e) { return fehlerAntwort(e, "konto.loeschen"); }
}
