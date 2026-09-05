import { NextRequest, NextResponse } from "next/server";
import { abmelden } from "@/server/gespeicherteSuchen";
import { env } from "@/server/env";
import { istLocale, DEFAULT_LOCALE } from "@/i18n";
import { ratenPruefen, fehlerAntwort } from "@/lib/route-schutz";

export const dynamic = "force-dynamic";

/* Abmeldelink aus jeder Suchabo-Mail — die einzige Verwaltung für anonyme
   Suchabos. Kein herkunftPruefen() (kommt aus einer E-Mail), stattdessen ein
   Ratenlimit auf den Token selbst. */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token") ?? "";
    await ratenPruefen(req, "suchabo-abmelden", 10, 60 * 60 * 1000, env().APP_SECRET ?? "dev", token || "leer");
    const localeRoh = req.nextUrl.searchParams.get("locale") ?? "";
    const locale = istLocale(localeRoh) ? localeRoh : DEFAULT_LOCALE;
    const ok = token ? await abmelden(token) : false;
    const ziel = new URL(`/${locale}/suchabo/abgemeldet`, env().NEXT_PUBLIC_SITE_URL);
    if (!ok) ziel.searchParams.set("fehler", "1");
    return NextResponse.redirect(ziel, { status: 302 });
  } catch (e) { return fehlerAntwort(e, "suchabo.abmelden"); }
}
