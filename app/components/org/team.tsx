"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ORG_ROLLEN, darfRolleVergeben, type OrgRolle } from "@/domain/orgrechte";

/* Team einer Organisation (P5.7 §7, §13–§17) — Mitglieder, offene
   Einladungen, Einladeformular. Jede Änderung geht sofort an den Server;
   was der Server ablehnt (letzte Besitzerin, eigene Rolle, fehlendes
   Recht), erscheint hier als lesbare Fehlermeldung — keine eigene Logik
   verdoppelt die Serverregeln (§16/§17). */

export interface MitgliedZeile { userId: string; name: string; email: string | null; rolle: OrgRolle; isActive: boolean; createdAt: string }
export interface OffeneEinladungZeile { id: string; email: string; rolle: OrgRolle; expiresAt: string }

type Texte = Record<string, string>;

export function Team({ slug, eigeneRolle, eigeneUserId, darfMitgliederVerwalten, mitglieder, einladungen, t }: {
  slug: string; eigeneRolle: OrgRolle; eigeneUserId: string; darfMitgliederVerwalten: boolean;
  mitglieder: MitgliedZeile[]; einladungen: OffeneEinladungZeile[]; t: Texte;
}) {
  const router = useRouter();
  const [fehler, setFehler] = useState<Record<string, string>>({});
  const [laeuft, setLaeuft] = useState<Record<string, boolean>>({});
  const setZeilenFehler = (k: string, m: string | null) => setFehler(f => ({ ...f, [k]: m ?? "" }));
  const setZeilenLaeuft = (k: string, v: boolean) => setLaeuft(l => ({ ...l, [k]: v }));

  async function rolleAendern(userId: string, neueRolle: OrgRolle) {
    setZeilenLaeuft(userId, true); setZeilenFehler(userId, null);
    try {
      const res = await fetch(`/api/org/${slug}/mitglieder/${userId}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ rolle: neueRolle })
      });
      const a = await res.json().catch(() => ({}));
      if (!res.ok) { setZeilenFehler(userId, a?.message ?? "—"); return; }
      router.refresh();
    } finally { setZeilenLaeuft(userId, false); }
  }

  async function entfernen(userId: string) {
    if (typeof window !== "undefined" && !window.confirm(t.og_entfernenBestaetigen)) return;
    setZeilenLaeuft(userId, true); setZeilenFehler(userId, null);
    try {
      const res = await fetch(`/api/org/${slug}/mitglieder/${userId}`, { method: "DELETE" });
      const a = await res.json().catch(() => ({}));
      if (!res.ok) { setZeilenFehler(userId, a?.message ?? "—"); return; }
      router.refresh();
    } finally { setZeilenLaeuft(userId, false); }
  }

  async function widerrufen(id: string) {
    if (typeof window !== "undefined" && !window.confirm(t.og_widerrufenBestaetigen)) return;
    setZeilenLaeuft(id, true); setZeilenFehler(id, null);
    try {
      const res = await fetch(`/api/org/${slug}/einladungen/${id}`, { method: "DELETE" });
      const a = await res.json().catch(() => ({}));
      if (!res.ok) { setZeilenFehler(id, a?.message ?? "—"); return; }
      router.refresh();
    } finally { setZeilenLaeuft(id, false); }
  }

  async function einladen(email: string, rolle: OrgRolle, k: string): Promise<{ ok: boolean; message?: string }> {
    setZeilenLaeuft(k, true); setZeilenFehler(k, null);
    try {
      const res = await fetch(`/api/org/${slug}/mitglieder`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, rolle })
      });
      const a = await res.json().catch(() => ({}));
      if (!res.ok) { const message = a?.message ?? "—"; setZeilenFehler(k, message); return { ok: false, message }; }
      router.refresh();
      return { ok: true };
    } finally { setZeilenLaeuft(k, false); }
  }

  return (
    <div>
      <h3 style={{ fontSize: ".95rem" }}>{t.og_teamMitgliederTitel}</h3>
      <div className="org-tabelle-wrap">
        <table className="org-tabelle">
          <thead>
            <tr>
              <th scope="col">{t.og_thName}</th>
              <th scope="col">{t.og_thRolle}</th>
              <th scope="col">{t.og_thZustand}</th>
              <th scope="col">{t.og_thSeit}</th>
              {darfMitgliederVerwalten && <th scope="col">{t.og_thAktionen}</th>}
            </tr>
          </thead>
          <tbody>
            {mitglieder.map(m => (
              <tr key={m.userId}>
                <td><b style={{ fontWeight: 500 }}>{m.name}</b>{m.email && <div style={{ color: "var(--leise)", fontSize: ".78rem" }}>{m.email}</div>}</td>
                <td>
                  {darfMitgliederVerwalten && m.userId !== eigeneUserId ? (
                    <select className="feld" aria-label={t.og_rolleAendern} value={m.rolle} disabled={laeuft[m.userId]}
                      onChange={e => void rolleAendern(m.userId, e.target.value as OrgRolle)}>
                      {ORG_ROLLEN.filter(r => r === m.rolle || darfRolleVergeben(eigeneRolle, r)).map(r => (
                        <option key={r} value={r}>{t["og_rolle_" + r]}</option>
                      ))}
                    </select>
                  ) : t["og_rolle_" + m.rolle]}
                </td>
                <td>{m.isActive ? t.og_zustandAktiv : "—"}</td>
                <td style={{ color: "var(--leise)", fontSize: ".82rem" }}>{m.createdAt.slice(0, 10)}</td>
                {darfMitgliederVerwalten && (
                  <td>
                    {m.userId !== eigeneUserId && (
                      <button type="button" className="knopf leise" disabled={laeuft[m.userId]} onClick={() => void entfernen(m.userId)}>{t.og_entfernen}</button>
                    )}
                    {fehler[m.userId] && <div role="alert" style={{ color: "var(--warn)", fontSize: ".76rem", marginTop: 4 }}>{fehler[m.userId]}</div>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {darfMitgliederVerwalten && (
        <>
          <h3 style={{ fontSize: ".95rem", marginTop: 30 }}>{t.og_einladungenTitel}</h3>
          {einladungen.length === 0 ? (
            <p style={{ color: "var(--leise)", marginTop: 10 }}>{t.og_einladungenLeer}</p>
          ) : (
            <div className="org-tabelle-wrap">
              <table className="org-tabelle">
                <thead>
                  <tr>
                    <th scope="col">{t.og_thEmail}</th>
                    <th scope="col">{t.og_thRolle}</th>
                    <th scope="col">{t.og_thLaeuftAb}</th>
                    <th scope="col">{t.og_thAktionen}</th>
                  </tr>
                </thead>
                <tbody>
                  {einladungen.map(e => (
                    <tr key={e.id}>
                      <td>{e.email}</td>
                      <td>{t["og_rolle_" + e.rolle]}</td>
                      <td style={{ color: "var(--leise)", fontSize: ".82rem" }}>{e.expiresAt.slice(0, 10)}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" className="knopf leise" disabled={laeuft[e.id]} onClick={() => void einladen(e.email, e.rolle, e.id)}>{t.og_erneutEinladen}</button>
                          <button type="button" className="knopf leise" disabled={laeuft[e.id]} onClick={() => void widerrufen(e.id)}>{t.og_widerrufen}</button>
                        </div>
                        {fehler[e.id] && <div role="alert" style={{ color: "var(--warn)", fontSize: ".76rem", marginTop: 4 }}>{fehler[e.id]}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <EinladeFormular slug={slug} eigeneRolle={eigeneRolle} t={t} onEinladen={einladen} />
        </>
      )}
    </div>
  );
}

function EinladeFormular({ eigeneRolle, t, onEinladen }: {
  slug: string; eigeneRolle: OrgRolle; t: Texte; onEinladen: (email: string, rolle: OrgRolle, k: string) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [email, setEmail] = useState("");
  const [rolle, setRolle] = useState<OrgRolle>("agent");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gesendet, setGesendet] = useState(false);
  const einladbareRollen = ORG_ROLLEN.filter(r => r !== "owner" || darfRolleVergeben(eigeneRolle, "owner")).filter(r => darfRolleVergeben(eigeneRolle, r));

  async function senden(e: React.FormEvent) {
    e.preventDefault();
    setLaeuft(true); setFehler(null); setGesendet(false);
    const ergebnis = await onEinladen(email.trim(), rolle, "neu");
    setLaeuft(false);
    if (ergebnis.ok) { setEmail(""); setGesendet(true); } else { setFehler(ergebnis.message ?? "—"); }
  }

  return (
    <form className="fld" onSubmit={senden} noValidate style={{ marginTop: 20 }}>
      <h3 style={{ fontSize: ".95rem" }}>{t.og_einladenTitel}</h3>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginTop: 10 }}>
        <div className="fld" style={{ margin: 0 }}>
          <label htmlFor="teamEmail">{t.og_thEmail}</label>
          <input className="feld" id="teamEmail" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="fld" style={{ margin: 0 }}>
          <label htmlFor="teamRolle">{t.og_thRolle}</label>
          <select className="feld" id="teamRolle" value={rolle} onChange={e => setRolle(e.target.value as OrgRolle)}>
            {einladbareRollen.map(r => <option key={r} value={r}>{t["og_rolle_" + r]}</option>)}
          </select>
        </div>
        <button className="knopf voll" type="submit" disabled={laeuft}>{laeuft ? "…" : t.og_einladenKnopf}</button>
      </div>
      {fehler && <p role="alert" style={{ color: "var(--warn)", fontSize: ".82rem", marginTop: 10 }}>{fehler}</p>}
      {gesendet && !fehler && <p role="status" style={{ color: "var(--leise)", fontSize: ".82rem", marginTop: 10 }}>{t.og_einladenGesendet}</p>}
    </form>
  );
}
