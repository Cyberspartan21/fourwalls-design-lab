import type { Dienst, KontaktDaten, ObjektDaten, Schritt } from "./typen";

/* Letzter Schritt vor dem Senden — Zusammenfassung mit Bearbeiten-Links, die
   zum jeweiligen Schritt zurückspringen. Zeigt nur, was tatsächlich
   eingegeben wurde (dieselbe Filterregel wie im Inserats-Assistenten:
   leere Werte erscheinen nicht). */

export function PruefenBlock({ dienst, objekt, kontakt, t, geheZu, zeigtObjekt, zeigtSituation }:
  { dienst: Dienst; objekt: ObjektDaten; kontakt: KontaktDaten; t: Record<string, string>;
    geheZu: (schritt: Schritt) => void; zeigtObjekt: boolean; zeigtSituation: boolean }) {
  /* Übersetzer, der immer eine konkrete Zeichenkette liefert (Schlüssel als
     letzter Rückfall) — wie t() aus i18n/index.ts, nur auf dem fertigen
     Textbündel der Seite statt dem vollen Katalog. */
  const L = (k: string): string => t[k] ?? k;
  const zeitpunktLabel = dienst === "sell" ? L("al_zeitpunktLabel_sell") : dienst === "let" ? L("al_zeitpunktLabel_let") : L("al_zeitpunktLabel_pm");

  const objektEintraege: [string, string | null][] = zeigtObjekt ? [
    [L("w_ortLabel"), objekt.ortLabel || null],
    [L("w_typ"), objekt.typ ? L("w_typ_" + objekt.typ) : null],
    [L("w_zimmer"), objekt.zimmer || null],
    [L("w_wohnflaeche"), objekt.flaeche ? objekt.flaeche + " m²" : null],
    [L("w_grundstueck"), objekt.grundstueck ? objekt.grundstueck + " m²" : null],
    [L("w_baujahr"), objekt.baujahr || null],
    [L("al_zustandLabel"), objekt.zustand ? L("al_zustand_" + objekt.zustand) : null]
  ] : [];

  const situationEintraege: [string, string | null][] = (zeigtSituation || dienst === "valuation" || dienst === "owner_consultation") ? [
    ...(dienst === "property_management" ? [[L("al_einheitenLabel"), objekt.einheiten || null] as [string, string | null]] : []),
    ...(dienst !== "valuation" && dienst !== "owner_consultation" ? [[zeitpunktLabel, objekt.zeitpunkt ? L("al_zeitpunkt_" + objekt.zeitpunkt) : null] as [string, string | null]] : []),
    ...(dienst === "sell" || dienst === "let" || dienst === "property_management" ? [[L("al_belegungLabel"), objekt.belegung ? L("al_belegung_" + objekt.belegung) : null] as [string, string | null]] : []),
    ...(dienst === "sell" ? [
      [L("al_bereitsInseriertLabel"), objekt.bereitsInseriert == null ? null : (objekt.bereitsInseriert ? L("al_ja") : L("al_nein"))] as [string, string | null],
      [L("al_andererMaklerLabel"), objekt.andererMakler == null ? null : (objekt.andererMakler ? L("al_ja") : L("al_nein"))] as [string, string | null]
    ] : []),
    ...(objekt.leistungen.length > 0 ? [[L("al_leistungenLabel"), objekt.leistungen.map(l => L("al_leistung_" + l)).join(", ")] as [string, string | null]] : []),
    [dienst === "owner_consultation" ? L("al_nachrichtLabel") : L("al_valuationNachrichtLabel"), objekt.nachricht.trim() || null]
  ] : [];

  const kontaktEintraege: [string, string | null][] = [
    [L("w_name"), kontakt.name || null],
    [L("k_email"), kontakt.email || null],
    [L("w_telefon"), kontakt.telefon || null],
    [L("al_kanalLabel"), L("al_kanal_" + kontakt.kanal)],
    [L("al_wunschterminLabel"), kontakt.wunschdatum ? kontakt.wunschdatum + (kontakt.wunschfenster ? " · " + L("al_wunschfenster_" + kontakt.wunschfenster) : "") : null]
  ];

  return (
    <>
      {zeigtObjekt && (
        <Abschnitt titel={L("al_h_objekt")} eintraege={objektEintraege} bearbeiten={() => geheZu("objekt")} bearbeitenText={L("al_bearbeiten")} />
      )}
      {situationEintraege.length > 0 && (
        <Abschnitt titel={dienst === "owner_consultation" ? L("al_nachrichtLabel") : L("al_h_situation")}
          eintraege={situationEintraege} bearbeiten={() => geheZu(dienst === "owner_consultation" ? "kontakt" : (zeigtSituation ? "situation" : "objekt"))}
          bearbeitenText={L("al_bearbeiten")} />
      )}
      <Abschnitt titel={L("al_h_kontakt")} eintraege={kontaktEintraege} bearbeiten={() => geheZu("kontakt")} bearbeitenText={L("al_bearbeiten")} />
    </>
  );
}

function Abschnitt({ titel, eintraege, bearbeiten, bearbeitenText }:
  { titel: string; eintraege: [string, string | null][]; bearbeiten: () => void; bearbeitenText: string }) {
  const sichtbar = eintraege.filter(([, v]) => v != null && v !== "");
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ fontSize: ".85rem", fontWeight: 500 }}>{titel}</h3>
        <button type="button" className="knopf leise" onClick={bearbeiten}>{bearbeitenText}</button>
      </div>
      {sichtbar.length > 0 ? (
        <dl className="fakten" style={{ marginTop: 10 }}>
          {sichtbar.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      ) : null}
    </div>
  );
}
