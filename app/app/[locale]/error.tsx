"use client";
/* Fehlerzustand der Seite — etwa wenn die Datenbank nicht erreichbar ist.
   Es wird nichts vorgetäuscht und nichts Internes gezeigt. */
export default function Fehler({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="blatt" style={{ padding: "clamp(48px,10vh,120px) var(--pad)", minHeight: "60vh" }}>
      <p style={{ fontSize: ".62rem", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--leise)" }}>Fourwalls</p>
      <h1 style={{ fontFamily: "var(--d)", fontWeight: 300, fontSize: "clamp(1.8rem,4vw,2.8rem)", margin: "12px 0 18px" }}>Diese Seite ist gerade nicht verfügbar.</h1>
      <p style={{ maxWidth: "56ch", color: "var(--leise)" }}>Die Daten konnten nicht geladen werden. Bitte versuchen Sie es in einem Moment noch einmal.</p>
      <p style={{ marginTop: 24 }}><button className="knopf" onClick={reset}>Noch einmal versuchen</button></p>
    </main>
  );
}
