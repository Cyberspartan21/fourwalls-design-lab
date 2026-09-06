"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

/* Das Löschformular (P5.10 §9): Passwort erneut + Bestätigungswort tippen.
   Das Wort ist eine bewusste Pause vor einer nicht umkehrbaren Aktion, keine
   Sicherheitsschranke — die liegt im Passwort (server/konto-loeschung.ts).

   Nach Erfolg: Redirect auf die statische Bestätigungsseite /konto/geloescht,
   die ohne Sitzung erreichbar ist (das Konto ist in diesem Moment schon
   abgemeldet — die Antwort hat das Cookie bereits gelöscht). */

type Texte = Record<string, string>;

export function LoeschenFormular({ t, bestaetigungswort, weiterHref, gesperrt = false }: {
  t: Texte;
  bestaetigungswort: string;
  weiterHref: string;
  /* true, solange eine alleinige Eigentümerschaft die Löschung blockiert (§10) —
     das Formular wird dann angezeigt, aber deaktiviert, nie versteckt: die
     Person soll sehen, was fehlt, nicht raten, warum der Knopf weg ist. */
  gesperrt?: boolean;
}) {
  const router = useRouter();
  const [passwort, setPasswort] = useState("");
  const [bestaetigung, setBestaetigung] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const wortStimmt = bestaetigung.trim().toUpperCase() === bestaetigungswort.toUpperCase();

  async function senden(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    if (!wortStimmt) { setFehler(t.kl_bestaetigungFehler ?? null); return; }
    setLaeuft(true);
    try {
      const res = await fetch("/api/konto/loeschen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passwort, bestaetigung })
      });
      if (res.status === 200) {
        router.push(weiterHref);
        return;
      }
      const daten = await res.json().catch(() => null);
      if (res.status === 422 && daten?.fields?.passwort) setFehler(t.kl_fehlerPasswort ?? null);
      else if (res.status === 422 && daten?.fields?.bestaetigung) setFehler(t.kl_bestaetigungFehler ?? null);
      else setFehler(t.kl_fehlerAllgemein ?? null);
    } catch {
      setFehler(t.kl_fehlerAllgemein ?? null);
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form className="fld" onSubmit={senden} noValidate>
      <div className="fld">
        <label htmlFor="klPasswort">{t.k_passwort}</label>
        <input className="feld" id="klPasswort" type="password" autoComplete="current-password" required
          value={passwort} onChange={e => setPasswort(e.target.value)} disabled={gesperrt} />
        <p className="hin" style={{ color: "var(--leise)", fontSize: ".78rem", marginTop: 6 }}>{t.kl_passwortHin}</p>
      </div>
      <div className="fld">
        <label htmlFor="klBestaetigung">{t.kl_bestaetigungLabel} «{bestaetigungswort}»</label>
        <input className="feld" id="klBestaetigung" type="text" autoComplete="off" required
          value={bestaetigung} onChange={e => setBestaetigung(e.target.value)} disabled={gesperrt}
          aria-describedby="klBestaetigungHin" placeholder={bestaetigungswort} />
      </div>
      {fehler && <p className="fehler" role="alert" style={{ color: "var(--warn)", fontSize: ".82rem", marginTop: 10 }}>{fehler}</p>}
      <div style={{ marginTop: 20 }}>
        <button className="knopf voll gross" type="submit" disabled={laeuft || gesperrt || !passwort || !wortStimmt}>
          {laeuft ? "…" : t.kl_knopf}
        </button>
      </div>
    </form>
  );
}
