"use client";
import { usePathname } from "next/navigation";
import { DEFAULT_LOCALE, istLocale } from "@/i18n";

/* Fehlerzustand der Seite — etwa wenn die Datenbank nicht erreichbar ist.
   Es wird nichts vorgetäuscht und nichts Internes gezeigt (§17).

   `error.digest`: Next fasst Fehler aus Server Components zu einer generischen
   Meldung mit dieser Kennung zusammen (siehe node_modules/next/dist/docs —
   error.md, Abschnitt `error.digest`) — dieselbe Rolle wie die `ref` aus
   lib/errors.ts für API-Antworten, nur vom Framework selbst vergeben. Sie
   steht hier sichtbar, damit ein Bericht an den Betrieb sich zuordnen lässt,
   ohne dass die Meldung selbst irgendetwas Internes verrät. */
export default function Fehler({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pfad = usePathname() ?? "";
  const seg = pfad.split("/")[1] ?? "";
  const locale = istLocale(seg) ? seg : DEFAULT_LOCALE;
  return (
    <main id="inhalt" style={{ padding: "clamp(48px,10vh,120px) var(--pad)", minHeight: "60vh" }}>
      <p style={{ fontSize: ".62rem", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--leise)" }}>Fourwalls</p>
      <h1 style={{ fontFamily: "var(--d)", fontWeight: 300, fontSize: "clamp(1.8rem,4vw,2.8rem)", margin: "12px 0 18px" }}>Diese Seite ist gerade nicht verfügbar.</h1>
      <p style={{ maxWidth: "56ch", color: "var(--leise)" }}>Die Daten konnten nicht geladen werden. Bitte versuchen Sie es in einem Moment noch einmal.</p>
      {error.digest && <p style={{ marginTop: 8, fontSize: ".78rem", color: "var(--leise)" }}>Fehlerkennung: {error.digest}</p>}
      <p style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="knopf" onClick={reset}>Noch einmal versuchen</button>
        <a className="knopf leise" href={`/${locale}`}>Zur Startseite</a>
      </p>
    </main>
  );
}
