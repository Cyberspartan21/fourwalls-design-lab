"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n";

/* Das öffentliche Herausgeberprofil bearbeiten (P5.7 §8) — Logo über den
   bestehenden Medienweg (POST /api/medien, dann PATCH /api/org/<slug>
   {logoAssetId}). Firmenname und Sprache gehen nur mit, wenn die Person
   MANAGE_ORGANIZATION hat — sonst lehnt der Server das ganze Formular ab
   (server/organisationen.ts:profilAendern, «heikle» Felder). */

type Texte = Record<string, string>;
export interface ProfilDaten {
  displayName: string; legalName: string; locale: Locale;
  website: string | null; publicEmail: string | null; publicPhone: string | null;
  street: string | null; postalCode: string | null; city: string | null; description: string | null;
  logoAssetId: string | null;
}

const SPRACHEN: Locale[] = ["de", "fr", "it", "en"];

export function ProfilFormular({ slug, profil, darfProfilAendern, darfOrgAendern, t }:
  { slug: string; profil: ProfilDaten; darfProfilAendern: boolean; darfOrgAendern: boolean; t: Texte }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profil.displayName);
  const [legalName, setLegalName] = useState(profil.legalName);
  const [orgLocale, setOrgLocale] = useState<Locale>(profil.locale);
  const [website, setWebsite] = useState(profil.website ?? "");
  const [publicEmail, setPublicEmail] = useState(profil.publicEmail ?? "");
  const [publicPhone, setPublicPhone] = useState(profil.publicPhone ?? "");
  const [street, setStreet] = useState(profil.street ?? "");
  const [postalCode, setPostalCode] = useState(profil.postalCode ?? "");
  const [city, setCity] = useState(profil.city ?? "");
  const [description, setDescription] = useState(profil.description ?? "");
  const [logoAssetId, setLogoAssetId] = useState<string | null>(profil.logoAssetId);
  const [logoFehlt, setLogoFehlt] = useState(false);

  const [fehler, setFehler] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [logoLaeuft, setLogoLaeuft] = useState(false);
  const dateiRef = useRef<HTMLInputElement>(null);

  async function speichern(e: FormEvent) {
    e.preventDefault();
    setFehler(null); setGespeichert(false); setLaeuft(true);
    try {
      const body: Record<string, unknown> = {
        website: website.trim() || null, publicEmail: publicEmail.trim() || null, publicPhone: publicPhone.trim() || null,
        street: street.trim() || null, postalCode: postalCode.trim() || null, city: city.trim() || null,
        description: description.trim() || null
      };
      if (darfProfilAendern) body.displayName = displayName.trim();
      if (darfOrgAendern) { body.legalName = legalName.trim(); body.locale = orgLocale; }

      const res = await fetch(`/api/org/${slug}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const a = await res.json().catch(() => ({}));
      if (!res.ok) { setFehler(a?.message ?? "—"); return; }
      setGespeichert(true);
      router.refresh();
    } finally { setLaeuft(false); }
  }

  async function logoHochladen(datei: File) {
    setLogoLaeuft(true); setFehler(null);
    try {
      const form = new FormData();
      form.set("datei", datei);
      const up = await fetch("/api/medien", { method: "POST", body: form });
      const bild = await up.json().catch(() => ({}));
      if (!up.ok) { setFehler(bild?.message ?? "—"); return; }
      const res = await fetch(`/api/org/${slug}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ logoAssetId: bild.id }) });
      const a = await res.json().catch(() => ({}));
      if (!res.ok) { setFehler(a?.message ?? "—"); return; }
      setLogoAssetId(bild.id); setLogoFehlt(false);
      router.refresh();
    } finally { setLogoLaeuft(false); }
  }

  async function logoEntfernen() {
    setLogoLaeuft(true); setFehler(null);
    try {
      const res = await fetch(`/api/org/${slug}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ logoAssetId: null }) });
      const a = await res.json().catch(() => ({}));
      if (!res.ok) { setFehler(a?.message ?? "—"); return; }
      setLogoAssetId(null);
      router.refresh();
    } finally { setLogoLaeuft(false); }
  }

  return (
    <div>
      <div className="fld">
        <label>{t.og_feldLogo}</label>
        {logoAssetId && !logoFehlt && (
          <img src={`/api/medien/${logoAssetId}?w=240`} alt="" onError={() => setLogoFehlt(true)}
            style={{ maxWidth: 180, maxHeight: 90, display: "block", marginBottom: 10, borderRadius: "var(--r)", border: "1px solid var(--linie)" }} />
        )}
        {darfProfilAendern && (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input ref={dateiRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) void logoHochladen(f); }} />
              <button type="button" className="knopf" disabled={logoLaeuft} onClick={() => dateiRef.current?.click()}>{logoLaeuft ? "…" : t.og_logoHochladen}</button>
              {logoAssetId && <button type="button" className="knopf leise" disabled={logoLaeuft} onClick={logoEntfernen}>{t.og_logoEntfernen}</button>}
            </div>
            <p className="hin" style={{ color: "var(--leise)", fontSize: ".78rem", marginTop: 6 }}>{t.og_logoHin}</p>
          </>
        )}
      </div>

      <form className="fld" onSubmit={speichern} noValidate>
        <fieldset disabled={!darfProfilAendern} style={{ border: 0, padding: 0, margin: 0 }}>
        {!darfOrgAendern && <p className="hin" style={{ color: "var(--leise)", fontSize: ".78rem" }}>{t.og_nurBesitzerin}</p>}
        {darfProfilAendern && (
          <div className="fld">
            <label htmlFor="pfDisplayName">{t.og_feld_anzeigename}</label>
            <input className="feld" id="pfDisplayName" type="text" required minLength={2} maxLength={120} value={displayName} onChange={e => setDisplayName(e.target.value)} />
          </div>
        )}
        {darfOrgAendern && (
          <>
            <div className="fld">
              <label htmlFor="pfLegalName">{t.og_feld_firmenname}</label>
              <input className="feld" id="pfLegalName" type="text" minLength={2} maxLength={160} value={legalName} onChange={e => setLegalName(e.target.value)} />
            </div>
            <div className="fld">
              <label htmlFor="pfLocale">{t.og_feld_sprache}</label>
              <select className="feld" id="pfLocale" value={orgLocale} onChange={e => setOrgLocale(e.target.value as Locale)}>
                {SPRACHEN.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
              </select>
            </div>
          </>
        )}
        <div className="fld">
          <label htmlFor="pfWebsite">{t.og_feld_website}</label>
          <input className="feld" id="pfWebsite" type="url" placeholder="https://…" value={website} onChange={e => setWebsite(e.target.value)} />
        </div>
        <div className="fld">
          <label htmlFor="pfPublicEmail">{t.og_feld_publicEmail}</label>
          <input className="feld" id="pfPublicEmail" type="email" value={publicEmail} onChange={e => setPublicEmail(e.target.value)} />
        </div>
        <div className="fld">
          <label htmlFor="pfPublicPhone">{t.og_feld_publicPhone}</label>
          <input className="feld" id="pfPublicPhone" type="tel" maxLength={40} value={publicPhone} onChange={e => setPublicPhone(e.target.value)} />
        </div>
        <div className="fld">
          <label htmlFor="pfStreet">{t.og_feld_strasse}</label>
          <input className="feld" id="pfStreet" type="text" maxLength={120} value={street} onChange={e => setStreet(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div className="fld" style={{ flex: "1 1 140px" }}>
            <label htmlFor="pfPostalCode">{t.og_feld_plz}</label>
            <input className="feld" id="pfPostalCode" type="text" maxLength={20} value={postalCode} onChange={e => setPostalCode(e.target.value)} />
          </div>
          <div className="fld" style={{ flex: "2 1 220px" }}>
            <label htmlFor="pfCity">{t.og_feld_ort}</label>
            <input className="feld" id="pfCity" type="text" maxLength={120} value={city} onChange={e => setCity(e.target.value)} />
          </div>
        </div>
        <div className="fld">
          <label htmlFor="pfDescription">{t.og_feld_beschreibung}</label>
          <textarea className="feld" id="pfDescription" maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        </fieldset>
        {fehler && <p role="alert" style={{ color: "var(--warn)", fontSize: ".82rem", marginTop: 10 }}>{fehler}</p>}
        {gespeichert && !fehler && <p role="status" style={{ color: "var(--leise)", fontSize: ".82rem", marginTop: 10 }}>{t.og_profilGespeichert}</p>}
        {darfProfilAendern && (
          <div style={{ marginTop: 18 }}>
            <button className="knopf voll" type="submit" disabled={laeuft}>{laeuft ? "…" : t.og_profilSpeichern}</button>
          </div>
        )}
      </form>
    </div>
  );
}
