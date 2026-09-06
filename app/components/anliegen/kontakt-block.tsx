import type { KontaktDaten, Kanal, Wunschfenster } from "./typen";

/* Kontaktschritt — Name, E-Mail, optional Telefon, bevorzugter Kontaktweg als
   echte Radiogruppe (fieldset/legend, nicht die Chip-Optik der Auswahlkarten:
   hier zählt die native Radiosemantik für Screenreader), ein optionaler
   Wunschtermin und der Datenschutzsatz. Bewusst ohne Newsletter-Häkchen —
   ein Anliegen ist keine Anmeldung zu etwas anderem. */

const KANAELE: Kanal[] = ["email", "phone", "whatsapp"];
const FENSTER: Wunschfenster[] = ["morning", "afternoon", "evening"];

export function KontaktBlock({ kontakt, aendern, t, fehlt, datenschutzHref }:
  { kontakt: KontaktDaten; aendern: (t: Partial<KontaktDaten>) => void; t: Record<string, string>;
    fehlt: (feld: string) => boolean; datenschutzHref: string }) {
  return (
    <>
      <div className="fld">
        <label htmlFor="al-name">{t.w_name}</label>
        <input className="feld" id="al-name" type="text" autoComplete="name" maxLength={120}
          aria-invalid={fehlt("name") || undefined} aria-describedby={fehlt("name") ? "al-name-fehler" : undefined}
          value={kontakt.name} onChange={e => aendern({ name: e.target.value })} style={{ width: "100%" }} />
        {fehlt("name") && <p className="fehler" role="alert" id="al-name-fehler">{t.al_nameFehler}</p>}
      </div>

      <div className="fld">
        <label htmlFor="al-email">{t.k_email}</label>
        <input className="feld" id="al-email" type="email" autoComplete="email" maxLength={200}
          aria-invalid={fehlt("email") || undefined} aria-describedby={fehlt("email") ? "al-email-fehler" : undefined}
          value={kontakt.email} onChange={e => aendern({ email: e.target.value })} style={{ width: "100%" }} />
        {fehlt("email") && <p className="fehler" role="alert" id="al-email-fehler">{t.al_emailFehler}</p>}
      </div>

      <div className="fld">
        <label htmlFor="al-telefon">{t.w_telefon}</label>
        <input className="feld" id="al-telefon" type="tel" autoComplete="tel" maxLength={40}
          value={kontakt.telefon} onChange={e => aendern({ telefon: e.target.value })} style={{ width: "100%" }} />
      </div>

      <fieldset className="fld" id="al-kanal" style={{ border: "none", padding: 0, margin: "18px 0 0" }}>
        <legend style={{ fontSize: ".62rem", letterSpacing: ".16em", textTransform: "uppercase", color: "var(--leise)", marginBottom: 7, padding: 0 }}>
          {t.al_kanalLabel}
        </legend>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {KANAELE.map(k => (
            <label key={k} style={{ display: "flex", gap: 7, alignItems: "center", fontSize: ".85rem", cursor: "pointer" }}>
              <input type="radio" name="al-kanal-radio" value={k} checked={kontakt.kanal === k}
                onChange={() => aendern({ kanal: k })} style={{ accentColor: "var(--licht)" }} />
              {t["al_kanal_" + k]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="fld" style={{ marginTop: 22 }}>
        <label htmlFor="al-wunschdatum">{t.al_wunschterminLabel}</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input className="feld" id="al-wunschdatum" type="date" min={new Date().toISOString().slice(0, 10)}
            value={kontakt.wunschdatum} onChange={e => aendern({ wunschdatum: e.target.value })} />
          <select className="feld" id="al-wunschfenster" aria-label={t.al_wunschfensterLabel}
            value={kontakt.wunschfenster} onChange={e => aendern({ wunschfenster: e.target.value as Wunschfenster | "" })}>
            <option value="">—</option>
            {FENSTER.map(f => <option key={f} value={f}>{t["al_wunschfenster_" + f]}</option>)}
          </select>
        </div>
        <p className="hin" style={{ color: "var(--leise)", fontSize: ".78rem", marginTop: 6 }}>{t.al_wunschterminHin}</p>
      </div>

      <p className="hin" style={{ color: "var(--leise)", fontSize: ".8rem", marginTop: 22 }}>
        {t.al_datenschutzHin} <a href={datenschutzHref}>{t.al_datenschutzLink}</a>
      </p>
    </>
  );
}
