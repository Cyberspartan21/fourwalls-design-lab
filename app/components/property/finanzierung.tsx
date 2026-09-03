"use client";
import { useState } from "react";
import { finanz } from "@/domain/listing";
import { chf } from "@/i18n";

/* Tragbarkeitsrechner — dieselbe Bankenpraxis wie im Prototyp, transparent. */
export function Finanzierung({ preisRappen, preisText, fein, tx }: { preisRappen: number; preisText: string; fein: string; tx: Record<string, string> }) {
  const [ek, setEk] = useState(20);
  const [zins, setZins] = useState("0.019");
  const f = finanz(preisRappen, ek / 100, Number(zins));
  const c = (n: number) => chf(n * 100);
  return (
    <div className="finanz" id="finanzBox">
      <div>
        <label className="et">{tx.o_kaufpreis}</label><div className="wert"><span>{tx.o_objektpreis}</span><b>{preisText}</b></div>
        <label className="et" htmlFor="fEk">{tx.o_eigenmittel}</label><input type="range" id="fEk" min="20" max="60" step="5" value={ek} onChange={e => setEk(Number(e.target.value))} />
        <div className="wert"><span id="fEkP">{ek} %</span><b id="fEkB">{c(f.ek)}</b></div>
        <label className="et" htmlFor="fZins">{tx.o_zinsmodell}</label>
        <select className="feld" id="fZins" style={{ width: "100%" }} value={zins} onChange={e => setZins(e.target.value)}>
          <option value="0.016">{tx.o_saron}</option><option value="0.019">{tx.o_fest5}</option><option value="0.022">{tx.o_fest10}</option>
        </select>
        <div className="wert" style={{ marginTop: 14 }}><span>{tx.o_belehnung}</span><b id="fBel">{f.belehnung} %</b></div>
      </div>
      <div className="ausgabe">
        <span>{tx.o_hypothek}</span><b id="fHyp">{c(f.hyp)}</b>
        <span>{tx.o_zinsMonat}</span><b id="fZ">{c(f.zinsM)}</b>
        <span>{tx.o_amortMonat}</span><b id="fA">{c(f.amortM)}</b>
        <span>{tx.o_unterhMonat}</span><b id="fU">{c(f.unterhM)}</b>
        <span className="totalL">{tx.o_totalMonat}</span><b className="total" id="fT">{c(f.total)}</b>
        <span>{tx.o_noetHaushalt}</span><b id="fE">{c(f.einkommen)} {tx.o_proJahr}</b>
      </div>
      <p className="fein">{fein}</p>
    </div>
  );
}
