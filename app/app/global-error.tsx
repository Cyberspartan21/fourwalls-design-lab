"use client";
import "@/styles/ufer.css";
import "@/styles/objekt.css";
import "@/styles/portal.css";
import "@/styles/app.css";

/* Fehler im Wurzel-Layout selbst (app/[locale]/layout.tsx) — dort greift
   app/[locale]/error.tsx NICHT, weil dieser Fehler das Layout betrifft, das
   error.tsx umschliesst (siehe node_modules/next/dist/docs — error.md,
   Abschnitt "Global Error"). Next ersetzt bei einem solchen Fehler das ganze
   Dokument; diese Datei bringt darum wie app/global-not-found.tsx ein
   eigenes <html>/<body> und dieselben UFER-Stile mit — es gibt kein anderes
   Layout mehr, das sie liefern könnte.

   Fehlerbehandlung als Client Component: `metadata`/`generateMetadata` sind
   hier nicht erlaubt (siehe dieselbe Doku-Datei) — daher kein Metadata-Export,
   nur ein <title> im <head>.

   Rein statisch — keine dynamischen APIs (kein params/headers/cookies) und
   kein next/navigation, weil ein Fehler auf dieser Ebene auch die Grundlagen
   des Routings betroffen haben könnte. Darum hartcodiert auf Deutsch, wie
   global-not-found.tsx, mit Verweisen auf die drei anderen Sprachen. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="de">
      <head><title>Diese Seite ist gerade nicht verfügbar — Fourwalls</title></head>
      <body data-mode="hell">
        <header className="kopf">
          <a href="/de" className="fw" aria-label="Fourwalls"><i className="k"></i><i className="s"></i></a>
        </header>
        <main id="inhalt" className="wiz an" style={{ minHeight: "60vh" }}>
          <h1 className="titel">Diese Seite ist gerade nicht verfügbar.</h1>
          <p className="lauf">Die Daten konnten nicht geladen werden. Bitte versuchen Sie es in einem Moment noch einmal.</p>
          {error.digest && <p className="lauf" style={{ fontSize: ".78rem" }}>Fehlerkennung: {error.digest}</p>}
          <p style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="knopf voll" onClick={reset}>Noch einmal versuchen</button>
            <a className="knopf" href="/de">Zur Startseite</a>
          </p>
          <div style={{ marginTop: 40, display: "grid", gap: 8 }}>
            <p className="lauf">Cette page n&apos;est pas disponible pour le moment. <a href="/fr">Accueil en français</a></p>
            <p className="lauf">Questa pagina non è al momento disponibile. <a href="/it">Pagina iniziale in italiano</a></p>
            <p className="lauf">This page is currently unavailable. <a href="/en">Homepage in English</a></p>
          </div>
        </main>
      </body>
    </html>
  );
}
