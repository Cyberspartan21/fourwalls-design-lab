import { NextRequest } from "next/server";
import { verlangeSitzung } from "@/server/sitzung";
import { verlangeOrgRecht } from "@/server/org-kontext";
import { csvImportieren } from "@/server/import-csv";
import { env } from "@/server/env";
import { herkunftPruefen, ratenPruefen, fehlerAntwort } from "@/lib/route-schutz";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";
type P = { params: Promise<{ slug: string }> };

const MAX_BYTES = 1024 * 1024 + 4096; // etwas Luft für eine JSON-Hülle

/* CSV-Import als dokumentierte Grenze (docs/IMPORT-ADAPTER.md, §29–§31).
   Body entweder roher Text (`Content-Type: text/csv`) oder JSON `{ csv }`. */
export async function POST(req: NextRequest, { params }: P) {
  try {
    herkunftPruefen(req, env().NEXT_PUBLIC_SITE_URL);
    const s = await verlangeSitzung();
    const { slug } = await params;
    await ratenPruefen(req, "org-import", 10, 60 * 60 * 1000, env().APP_SECRET ?? "dev", s.person.id);
    const kontext = await verlangeOrgRecht(s.person, slug, "IMPORT_LISTINGS");

    const laenge = Number(req.headers.get("content-length") ?? 0);
    if (laenge > MAX_BYTES) throw new AppError("VALIDATION", "Die Datei ist zu gross");
    const roh = await req.text();
    if (roh.length > MAX_BYTES) throw new AppError("VALIDATION", "Die Datei ist zu gross");

    const contentType = req.headers.get("content-type") ?? "";
    let csv: string;
    if (contentType.includes("application/json")) {
      let json: unknown;
      try { json = JSON.parse(roh || "{}"); } catch { throw new AppError("VALIDATION", "Kein gültiges JSON"); }
      const feld = (json as { csv?: unknown } | null)?.csv;
      if (typeof feld !== "string") throw new AppError("VALIDATION", "Feld csv fehlt", { csv: "erforderlich" });
      csv = feld;
    } else {
      csv = roh;
    }

    const ergebnisse = await csvImportieren(s.person, kontext, csv);
    return Response.json({ ergebnisse });
  } catch (e) { return fehlerAntwort(e, "org.import.csv"); }
}
