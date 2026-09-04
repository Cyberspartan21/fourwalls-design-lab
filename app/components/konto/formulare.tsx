"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/* Die vier Formulare rund um das Konto — Anmelden, Registrieren, Passwort
   vergessen, Passwort setzen.

   Zwei Dinge halten sie durchgehend ein:

   · Fehlermeldungen sagen nie, ob es ein Konto gibt. «E-Mail oder Passwort
     stimmt nicht» gilt für beide Fälle; nach «Passwort vergessen» steht immer
     dieselbe Bestätigung (§19/§86).
   · Nichts wird im Browser gespeichert. Die Sitzung lebt im HttpOnly-Cookie,
     das die Bibliothek setzt (§9).

   Gestaltung: die Formularklassen des Assistenten aus dem Prototyp
   (`.wiz`, `.fld`, `.feld`, `.knopf`) — kein neues Formularbild (§83). */

type Texte = Record<string, string>;

function Fehler({ text }: { text: string | null }) {
  if (!text) return null;
  return <p className="fehler" role="alert" style={{ color: "var(--warn)", fontSize: ".82rem", marginTop: 10 }}>{text}</p>;
}

export function AnmeldeFormular({ t, weiter, registrierenHref, passwortHref }: { t: Texte; weiter: string; registrierenHref: string; passwortHref: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null); const [laeuft, setLaeuft] = useState(false);

  async function senden(e: FormEvent) {
    e.preventDefault(); setFehler(null); setLaeuft(true);
    const { error } = await authClient.signIn.email({ email: email.trim(), password: passwort });
    setLaeuft(false);
    /* Eine Meldung für alle Fälle — kein Hinweis darauf, ob die Adresse bekannt ist. */
    if (error) { setFehler(t.k_falscheDaten!); return; }
    router.push(weiter); router.refresh();
  }

  return (
    <form className="fld" onSubmit={senden} noValidate>
      <div className="fld">
        <label htmlFor="anEmail">{t.k_email}</label>
        <input className="feld" id="anEmail" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div className="fld">
        <label htmlFor="anPasswort">{t.k_passwort}</label>
        <input className="feld" id="anPasswort" type="password" autoComplete="current-password" required value={passwort} onChange={e => setPasswort(e.target.value)} />
      </div>
      <Fehler text={fehler} />
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 20, flexWrap: "wrap" }}>
        <button className="knopf voll gross" type="submit" disabled={laeuft}>{laeuft ? "…" : t.k_anmelden}</button>
        <a className="knopf leise" href={passwortHref}>{t.k_passwortVergessen}</a>
      </div>
      <p className="hin" style={{ marginTop: 22, color: "var(--leise)", fontSize: ".85rem" }}>
        {t.k_keinKonto} <a href={registrierenHref}>{t.k_registrieren}</a>
      </p>
    </form>
  );
}

export function RegistrierFormular({ t, weiter, anmeldenHref }: { t: Texte; weiter: string; anmeldenHref: string }) {
  const router = useRouter();
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null); const [laeuft, setLaeuft] = useState(false);

  async function senden(e: FormEvent) {
    e.preventDefault(); setFehler(null);
    if (passwort.length < 10) { setFehler(t.k_mindestens!); return; }
    setLaeuft(true);
    const { error } = await authClient.signUp.email({ email: email.trim(), password: passwort, name: name.trim() });
    if (error) { setLaeuft(false); setFehler(error.message ?? t.k_falscheDaten!); return; }
    /* Ohne automatische Anmeldung (Aufzählungsschutz): direkt anmelden, damit
       die Person weiterarbeiten kann. Schlägt das fehl, geht es zur Anmeldung. */
    const an = await authClient.signIn.email({ email: email.trim(), password: passwort });
    setLaeuft(false);
    if (an.error) { router.push(anmeldenHref); return; }
    router.push(weiter); router.refresh();
  }

  return (
    <form className="fld" onSubmit={senden} noValidate>
      <div className="fld">
        <label htmlFor="reName">{t.k_name}</label>
        <input className="feld" id="reName" type="text" autoComplete="name" required value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="fld">
        <label htmlFor="reEmail">{t.k_email}</label>
        <input className="feld" id="reEmail" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div className="fld">
        <label htmlFor="rePasswort">{t.k_passwort}</label>
        <input className="feld" id="rePasswort" type="password" autoComplete="new-password" required minLength={10} value={passwort} onChange={e => setPasswort(e.target.value)} aria-describedby="rePwHin" />
        <p className="hin" id="rePwHin" style={{ color: "var(--leise)", fontSize: ".78rem", marginTop: 6 }}>{t.k_mindestens}</p>
      </div>
      <Fehler text={fehler} />
      <div style={{ marginTop: 20 }}>
        <button className="knopf voll gross" type="submit" disabled={laeuft}>{laeuft ? "…" : t.k_registrieren}</button>
      </div>
      <p className="hin" style={{ marginTop: 22, color: "var(--leise)", fontSize: ".85rem" }}>
        {t.k_habenKonto} <a href={anmeldenHref}>{t.k_anmelden}</a>
      </p>
    </form>
  );
}

export function PasswortVergessenFormular({ t, zielUrl }: { t: Texte; zielUrl: string }) {
  const [email, setEmail] = useState(""); const [fertig, setFertig] = useState(false); const [laeuft, setLaeuft] = useState(false);
  async function senden(e: FormEvent) {
    e.preventDefault(); setLaeuft(true);
    await authClient.forgetPassword({ email: email.trim(), redirectTo: zielUrl });
    setLaeuft(false); setFertig(true);   // immer dieselbe Antwort (§86)
  }
  if (fertig) return (
    <div className="hinweisbox" role="status">
      <b>{t.k_pruefenMail}</b>
      <p style={{ marginTop: 6 }}>{t.k_mailGesendet}</p>
    </div>
  );
  return (
    <form className="fld" onSubmit={senden} noValidate>
      <div className="fld">
        <label htmlFor="pvEmail">{t.k_email}</label>
        <input className="feld" id="pvEmail" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div style={{ marginTop: 20 }}><button className="knopf voll gross" type="submit" disabled={laeuft}>{laeuft ? "…" : t.k_linkSenden}</button></div>
    </form>
  );
}

export function PasswortNeuFormular({ t, token, weiter }: { t: Texte; token: string; weiter: string }) {
  const router = useRouter();
  const [passwort, setPasswort] = useState(""); const [fehler, setFehler] = useState<string | null>(null); const [laeuft, setLaeuft] = useState(false);
  async function senden(e: FormEvent) {
    e.preventDefault(); setFehler(null);
    if (passwort.length < 10) { setFehler(t.k_mindestens!); return; }
    setLaeuft(true);
    const { error } = await authClient.resetPassword({ newPassword: passwort, token });
    setLaeuft(false);
    if (error) { setFehler(error.message ?? "—"); return; }
    router.push(weiter);
  }
  return (
    <form className="fld" onSubmit={senden} noValidate>
      <div className="fld">
        <label htmlFor="pnPasswort">{t.k_passwortNeu}</label>
        <input className="feld" id="pnPasswort" type="password" autoComplete="new-password" required minLength={10} value={passwort} onChange={e => setPasswort(e.target.value)} />
        <p className="hin" style={{ color: "var(--leise)", fontSize: ".78rem", marginTop: 6 }}>{t.k_mindestens}</p>
      </div>
      <Fehler text={fehler} />
      <div style={{ marginTop: 20 }}><button className="knopf voll gross" type="submit" disabled={laeuft}>{laeuft ? "…" : t.k_passwortSetzen}</button></div>
    </form>
  );
}

/* Hinweis mit Knopf, wenn die Adresse noch unbestätigt ist. */
export function BestaetigungErneut({ t, email }: { t: Texte; email: string }) {
  const [gesendet, setGesendet] = useState(false);
  return (
    <div className="hinweisbox" role="status">
      <b>{t.k_emailUnbestaetigt}</b>
      <p style={{ marginTop: 6 }}>{t.k_emailBestaetigenHin}</p>
      <button className="knopf" style={{ marginTop: 10 }} disabled={gesendet}
        onClick={async () => { await authClient.sendVerificationEmail({ email, callbackURL: "/" }); setGesendet(true); }}>
        {gesendet ? t.k_pruefenMail : t.k_erneutSenden}
      </button>
    </div>
  );
}

/* Abmelden — als Knopf, weil es eine Zustandsänderung ist. */
export function AbmeldeKnopf({ t, weiter }: { t: Texte; weiter: string }) {
  const router = useRouter();
  return <button className="knopf leise" onClick={async () => { await authClient.signOut(); router.push(weiter); router.refresh(); }}>{t.k_abmelden}</button>;
}
