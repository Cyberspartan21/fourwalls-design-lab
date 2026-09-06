"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n";

/* Formular «Organisation anlegen» (P5.7 §1) — POST /api/org, danach
   Weiterleitung zu /konto/org/<slug>. Erlaubnisliste und Missbrauchsbremse
   prüft ausschliesslich server/organisationen.ts:organisationAnlegen; hier
   steht nur die Eingabe. */

type Texte = Record<string, string>;

const ARTEN = ["agency", "property_manager", "developer", "institutional"] as const;
const SPRACHEN = ["de", "fr", "it", "en"] as const;

export function OrganisationAnlegenFormular({ t, locale }: { t: Texte; locale: Locale }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [kind, setKind] = useState<(typeof ARTEN)[number]>("agency");
  const [orgLocale, setOrgLocale] = useState<Locale>(locale);
  const [website, setWebsite] = useState("");
  const [publicEmail, setPublicEmail] = useState("");
  const [publicPhone, setPublicPhone] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function senden(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    setLaeuft(true);
    try {
      const body: Record<string, unknown> = {
        displayName: displayName.trim(), kind, locale: orgLocale
      };
      if (legalName.trim()) body.legalName = legalName.trim();
      if (website.trim()) body.website = website.trim();
      if (publicEmail.trim()) body.publicEmail = publicEmail.trim();
      if (publicPhone.trim()) body.publicPhone = publicPhone.trim();
      if (street.trim()) body.street = street.trim();
      if (postalCode.trim()) body.postalCode = postalCode.trim();
      if (city.trim()) body.city = city.trim();
      if (description.trim()) body.description = description.trim();

      const res = await fetch("/api/org", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const a = await res.json().catch(() => ({}));
      if (!res.ok) { setFehler(a?.message ?? "—"); setLaeuft(false); return; }
      router.push(`/${locale}/konto/org/${a.slug}`);
    } catch {
      setFehler("—");
      setLaeuft(false);
    }
  }

  return (
    <form className="fld" onSubmit={senden} noValidate>
      <div className="fld">
        <label htmlFor="ogName">{t.og_feld_anzeigename}</label>
        <input className="feld" id="ogName" type="text" required minLength={2} maxLength={120} value={displayName} onChange={e => setDisplayName(e.target.value)} />
      </div>
      <div className="fld">
        <label htmlFor="ogLegalName">{t.og_feld_firmenname}</label>
        <input className="feld" id="ogLegalName" type="text" maxLength={160} value={legalName} onChange={e => setLegalName(e.target.value)} aria-describedby="ogLegalNameHin" />
        <p className="hin" id="ogLegalNameHin" style={{ color: "var(--leise)", fontSize: ".78rem", marginTop: 6 }}>{t.og_feld_firmennameHin}</p>
      </div>
      <div className="fld">
        <label htmlFor="ogKind">{t.og_feld_art}</label>
        <select className="feld" id="ogKind" value={kind} onChange={e => setKind(e.target.value as typeof kind)}>
          {ARTEN.map(a => <option key={a} value={a}>{t["og_art_" + a]}</option>)}
        </select>
      </div>
      <div className="fld">
        <label htmlFor="ogLocale">{t.og_feld_sprache}</label>
        <select className="feld" id="ogLocale" value={orgLocale} onChange={e => setOrgLocale(e.target.value as Locale)}>
          {SPRACHEN.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
      </div>
      <div className="fld">
        <label htmlFor="ogWebsite">{t.og_feld_website}</label>
        <input className="feld" id="ogWebsite" type="url" placeholder="https://…" value={website} onChange={e => setWebsite(e.target.value)} />
      </div>
      <div className="fld">
        <label htmlFor="ogPublicEmail">{t.og_feld_publicEmail}</label>
        <input className="feld" id="ogPublicEmail" type="email" value={publicEmail} onChange={e => setPublicEmail(e.target.value)} />
      </div>
      <div className="fld">
        <label htmlFor="ogPublicPhone">{t.og_feld_publicPhone}</label>
        <input className="feld" id="ogPublicPhone" type="tel" maxLength={40} value={publicPhone} onChange={e => setPublicPhone(e.target.value)} />
      </div>
      <div className="fld">
        <label htmlFor="ogStreet">{t.og_feld_strasse}</label>
        <input className="feld" id="ogStreet" type="text" maxLength={120} value={street} onChange={e => setStreet(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div className="fld" style={{ flex: "1 1 140px" }}>
          <label htmlFor="ogPostalCode">{t.og_feld_plz}</label>
          <input className="feld" id="ogPostalCode" type="text" maxLength={20} value={postalCode} onChange={e => setPostalCode(e.target.value)} />
        </div>
        <div className="fld" style={{ flex: "2 1 220px" }}>
          <label htmlFor="ogCity">{t.og_feld_ort}</label>
          <input className="feld" id="ogCity" type="text" maxLength={120} value={city} onChange={e => setCity(e.target.value)} />
        </div>
      </div>
      <div className="fld">
        <label htmlFor="ogDescription">{t.og_feld_beschreibung}</label>
        <textarea className="feld" id="ogDescription" maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} />
      </div>
      {fehler && <p className="fehler an" role="alert" style={{ color: "var(--warn)", fontSize: ".82rem", marginTop: 10 }}>{fehler}</p>}
      <p className="hin" style={{ color: "var(--leise)", fontSize: ".8rem", marginTop: 18 }}>
        {t.og_anbieterbedingungenHin} <a href={`/${locale}/anbieterbedingungen`}>{t.og_anbieterbedingungenLink}</a>
      </p>
      <div style={{ marginTop: 20 }}>
        <button className="knopf voll gross" type="submit" disabled={laeuft}>{laeuft ? "…" : t.og_anlegenKnopf}</button>
      </div>
    </form>
  );
}
