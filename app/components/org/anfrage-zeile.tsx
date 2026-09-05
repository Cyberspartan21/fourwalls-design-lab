"use client";
import { useState } from "react";
import type { OrgAnfrageZeile } from "@/server/organfragen";

/* Eine Zeile im Posteingang einer Organisation (P5.7 §6) — Nachricht
   gekürzt, aufklappbar. Kein erfundener Status: was `inquiry.status` nicht
   hergibt, zeigt diese Zeile auch nicht (§35). */

type Texte = {
  og_thObjekt: string; og_thDatum: string; og_thAbsender: string; og_thNachricht: string;
  og_mehrLesen: string; og_wenigerLesen: string; og_objektNichtVerfuegbar: string; og_thZugewiesen: string;
};

const AUSZUG_LAENGE = 160;
function auszug(text: string): string {
  const glatt = text.replace(/\s+/g, " ").trim();
  return glatt.length > AUSZUG_LAENGE ? glatt.slice(0, AUSZUG_LAENGE) + "…" : glatt;
}

export function AnfrageZeile({ a, objektHref, t }: { a: OrgAnfrageZeile; objektHref: string | null; t: Texte }) {
  const [offen, setOffen] = useState(false);
  const gekuerzt = a.message.replace(/\s+/g, " ").trim().length > AUSZUG_LAENGE;

  return (
    <li style={{ borderTop: "1px solid var(--linie)", padding: "16px 0" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        {objektHref
          ? <a href={objektHref} style={{ fontSize: "1.02rem", fontWeight: 500 }}>{a.listing!.title || a.listing!.publicRef}</a>
          : <b style={{ fontSize: "1.02rem", fontWeight: 500, color: "var(--leise)" }}>{t.og_objektNichtVerfuegbar}</b>}
        <span style={{ color: "var(--leise)", fontSize: ".78rem" }}>{a.createdAt.slice(0, 10)}</span>
      </div>
      <div style={{ marginTop: 6, color: "var(--leise)", fontSize: ".86rem" }}>
        {a.senderName} · {a.senderEmail}{a.senderPhone ? ` · ${a.senderPhone}` : ""}
        {a.zugewiesen && <span> · {t.og_thZugewiesen}: {a.zugewiesen.name}</span>}
      </div>
      <p style={{ marginTop: 8 }}>{offen ? a.message : auszug(a.message)}</p>
      {gekuerzt && (
        <button type="button" className="knopf leise" style={{ marginTop: 6, padding: 0 }} onClick={() => setOffen(v => !v)}>
          {offen ? t.og_wenigerLesen : t.og_mehrLesen}
        </button>
      )}
    </li>
  );
}
