import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { DEFAULT_LOCALE, LOCALES } from "@/i18n";
import { csp, hsts } from "@/lib/sicherheitskoepfe";

/* ---------- Staging-Zugangsschleuse (P5.5 §35) ----------
   proxy.ts läuft im Node-Runtime, vor jeder Seite und jedem statischen
   Ausliefern — auch vor der Sprachumleitung. env() aus server/env.ts ist
   bewusst server-only und prüft die GANZE Umgebung inklusive Datenbank-URL,
   Speicher- und Mailanbieter; der Proxy soll dafür kein Datenbankmodul laden
   und nicht scheitern, nur weil ein anderer Bereich der Konfiguration fehlt.
   Darum hier ausnahmsweise process.env direkt lesen — nur die zwei Werte,
   die die Schleuse selbst braucht. */
function unautorisiert(): NextResponse {
  return new NextResponse("Staging", {
    status: 401,
    headers: { "www-authenticate": 'Basic realm="Fourwalls Staging", charset="UTF-8"' }
  });
}

function schleusePruefen(req: NextRequest): NextResponse | null {
  const nutzer = process.env.STAGING_GATE_USER ?? "";
  const passwort = process.env.STAGING_GATE_PASSWORD ?? "";
  const kopf = req.headers.get("authorization") ?? "";
  if (!kopf.startsWith("Basic ")) return unautorisiert();

  let geliefert: Buffer;
  try { geliefert = Buffer.from(Buffer.from(kopf.slice(6), "base64").toString("utf8")); }
  catch { return unautorisiert(); }

  /* Zeitkonstanter Vergleich: timingSafeEqual verlangt gleich lange Buffer.
     Ungleiche Länge ist per Definition falsch, ohne die Buffer zu vergleichen. */
  const erwartet = Buffer.from(`${nutzer}:${passwort}`);
  if (geliefert.length !== erwartet.length || !timingSafeEqual(geliefert, erwartet)) return unautorisiert();
  return null;
}

/* Jede Seite lebt unter einer Sprache. Ohne Sprache: Umleitung auf Deutsch.
   Mit unbekanntem erstem Segment: unter Deutsch weiterreichen, damit die
   Seite eine echte 404 in einer Sprache rendert. API und Statisches bleiben. */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const staging = process.env.APP_ENV === "staging";
  const mitKopf = (res: NextResponse) => {
    if (staging) res.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
    /* Umgebungsabhängige Sicherheitsköpfe — zur Laufzeit, siehe lib/sicherheitskoepfe.ts. */
    res.headers.set("content-security-policy", csp());
    const h = hsts(); if (h) res.headers.set("strict-transport-security", h);
    return res;
  };

  /* Gesundheitsprüfungen bleiben ohne Zugangsdaten erreichbar — sonst könnte
     der Betrieb die Anwendung in Staging nie beobachten. Alles andere,
     inklusive _next/* und aller statischen Dateien, verlangt die Schleuse. */
  if (staging && pathname !== "/api/health" && pathname !== "/api/ready") {
    const verweigert = schleusePruefen(req);
    if (verweigert) return mitKopf(verweigert);
  }

  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/") || /\.[a-z0-9]+$/i.test(pathname)) return mitKopf(NextResponse.next());
  const erstes = pathname.split("/")[1] ?? "";
  if ((LOCALES as readonly string[]).includes(erstes)) return mitKopf(NextResponse.next());
  const url = req.nextUrl.clone();
  if (pathname === "/") { url.pathname = `/${DEFAULT_LOCALE}`; return mitKopf(NextResponse.redirect(url, 308)); }
  url.pathname = `/${DEFAULT_LOCALE}${pathname}`;
  return mitKopf(NextResponse.rewrite(url));
}
/* Der Matcher darf /api/health und /api/ready NICHT ausschliessen: in Staging
   soll auch auf ihren Antworten x-robots-tag stehen (siehe mitKopf oben) —
   das kann nur passieren, wenn proxy() für sie überhaupt läuft. Die
   Ausnahme von der Zugangsschleuse selbst steht schon im Funktionskörper
   (schleusePruefen wird für diese zwei Pfade gar nicht erst aufgerufen).
   Darum matcht dieser Proxy ausnahmslos jeden Pfad — auch _next/static,
   _next/image und favicon.ico: in der Entwicklung und Produktion ändert das
   nichts (staging ist dort false, mitKopf tut nichts, und der bestehende
   Kurzschluss für /_next/ und Dateien weiter oben bleibt unverändert), in
   Staging müssen aber genau diese Pfade ebenfalls hinter der Schleuse
   liegen. Ein und dasselbe Produktions-Abbild bedient beide Umgebungen; der
   Unterschied ist erst zur Laufzeit über APP_ENV bekannt, der Matcher selbst
   kann also nicht umgebungsabhängig sein. */
export const config = { matcher: ["/(.*)"] };
