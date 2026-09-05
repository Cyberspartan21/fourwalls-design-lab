import { NextRequest, NextResponse } from "next/server";
import { bestaetigen } from "@/server/gespeicherteSuchen";
import { env } from "@/server/env";
import { istLocale, DEFAULT_LOCALE } from "@/i18n";
import { ratenPruefen, fehlerAntwort } from "@/lib/route-schutz";

export const dynamic = "force-dynamic";

/* Bestätigungslink aus der Mail (Double-Opt-in, anonyme Suchabos).
   Kommt aus einer E-Mail, nie same-origin — deshalb kein herkunftPruefen().
   Stattdessen ein Ratenlimit auf den Token selbst, damit niemand Tokens
   durchprobieren kann. */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token") ?? "";
    await ratenPruefen(req, "suchabo-bestaetigen", 10, 60 * 60 * 1000, env().APP_SECRET ?? "dev", token || "leer");
    const localeRoh = req.nextUrl.searchParams.get("locale") ?? "";
    const locale = istLocale(localeRoh) ? localeRoh : DEFAULT_LOCALE;
    const ok = token ? await bestaetigen(token) : false;
    const ziel = new URL(`/${locale}/suchabo/bestaetigt`, env().NEXT_PUBLIC_SITE_URL);
    if (!ok) ziel.searchParams.set("fehler", "1");
    return NextResponse.redirect(ziel, { status: 302 });
  } catch (e) { return fehlerAntwort(e, "suchabo.bestaetigen"); }
}
