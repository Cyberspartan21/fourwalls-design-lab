import type { Metadata } from "next";
import "@/styles/ufer.css";
import "@/styles/objekt.css";
import "@/styles/portal.css";
import "@/styles/app.css";
import { Fuss } from "@/components/site/fuss";

/* Globale 404 (Next.js 16 `experimental.globalNotFound`, next.config.ts).

   Arbeitsteilung der drei 404-Ebenen dieser Anwendung:
   1. proxy.ts rewritet ein unbekanntes erstes Segment stillschweigend auf
      /de/<pfad> (Sprachpräfix-Logik) — das betrifft nur das erste Segment
      und entscheidet nicht über 404/200.
   2. DIESE Datei greift, wenn danach GAR KEINE Route matcht (weder eine
      bekannte Sprache+Seite noch ein dynamisches Segment) — z. B.
      /de/gibt-es-nicht oder /de/a/b/c. Sie ist die einzige Stelle, an der
      ein unbekannter Pfad serverseitig gerenderten Inhalt MIT Status 404
      bekommt (Next liefert bei diesem Mechanismus echten 404-Status).
      Sie besitzt bewusst ein eigenes <html>/<body> (wie global-error.tsx):
      beim globalen Not-Found greift kein Layout aus app/[locale]/layout.tsx.
      Rein statisch — keine dynamischen APIs (kein params/headers/cookies),
      daher hartcodiert auf Deutsch als Ausgangssprache mit Verweisen auf
      die drei anderen Sprachen.
   3. app/[locale]/not-found.tsx bleibt für alle Pfade, die zwar in ein
      bekanntes dynamisches Segment fallen ([bereich]/[art], [slug],
      anbieter/[slug], wissen/[slug] …), dort aber notFound() auslösen
      (z. B. eine nicht existierende Inserate-Referenz). Das ist die Grenze
      des Frameworks: diese Seite wird clientseitig nachgerendert, liefert
      aber ebenfalls Status 404 und den lokalisierten Text der jeweiligen
      Sprache. */

export const metadata: Metadata = {
  title: "Diese Seite gibt es nicht — Fourwalls",
  robots: { index: false, follow: false }
};

export default function GlobalNotFound() {
  return (
    <html lang="de">
      <body data-mode="hell">
        <a className="skip" href="#inhalt">Zum Inhalt springen</a>
        <header className="kopf">
          <a href="/de" className="fw" aria-label="Fourwalls"><i className="k"></i><i className="s"></i></a>
        </header>
        <main id="inhalt" className="wiz an" style={{ minHeight: "60vh" }}>
          <p className="schrittz">404</p>
          <h1 className="titel">Diese Seite gibt es nicht.</h1>
          <p className="lauf">Das Inserat wurde vielleicht zurückgezogen, oder die Adresse stimmt nicht.</p>
          <p style={{ marginTop: 24 }}><a className="knopf voll" href="/de">Zur Startseite</a></p>
          <div style={{ marginTop: 40, display: "grid", gap: 8 }}>
            <p className="lauf">Cette page n&apos;existe pas. <a href="/fr">Accueil en français</a></p>
            <p className="lauf">Questa pagina non esiste. <a href="/it">Pagina iniziale in italiano</a></p>
            <p className="lauf">This page does not exist. <a href="/en">Homepage in English</a></p>
          </div>
        </main>
        <Fuss locale="de" />
      </body>
    </html>
  );
}
