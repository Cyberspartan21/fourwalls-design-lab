import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_LOCALE, LOCALES } from "@/i18n";

/* Jede Seite lebt unter einer Sprache. Ohne Sprache: Umleitung auf Deutsch.
   Mit unbekanntem erstem Segment: unter Deutsch weiterreichen, damit die
   Seite eine echte 404 in einer Sprache rendert. API und Statisches bleiben. */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/") || /\.[a-z0-9]+$/i.test(pathname)) return NextResponse.next();
  const erstes = pathname.split("/")[1] ?? "";
  if ((LOCALES as readonly string[]).includes(erstes)) return NextResponse.next();
  const url = req.nextUrl.clone();
  if (pathname === "/") { url.pathname = `/${DEFAULT_LOCALE}`; return NextResponse.redirect(url, 308); }
  url.pathname = `/${DEFAULT_LOCALE}${pathname}`;
  return NextResponse.rewrite(url);
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
