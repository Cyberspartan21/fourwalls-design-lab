import type { T } from "@/i18n";

/* Die Textschlüssel, die der Anliegen-Assistent (Client) tatsächlich braucht —
   einmal serverseitig zusammengestellt, wie bei AssistentSeite für den
   Inserats-Assistenten. Seiten-eigene Texte (Titel, Lead, Bewertungs-Erklärung)
   holt jede Seite selbst; hier steht nur, was quer durch die Formularschritte
   gebraucht wird. */
const SCHLUESSEL = [
  "w_schritt", "w_von", "w_zurueck", "w_weiter", "w_bitteWaehlen", "w_bitteAngeben",
  "w_ortLabel", "w_ortSuchen", "w_erkannt", "w_ortFehler", "w_typ",
  "w_zimmer", "w_wohnflaeche", "w_grundstueck", "w_baujahr", "w_name", "k_email", "w_telefon",
  "al_titel",
  "al_nav_objekt", "al_nav_situation", "al_nav_kontakt", "al_nav_pruefen",
  "al_h_objekt", "al_h_situation", "al_h_kontakt", "al_h_pruefen",
  "al_mehrAngaben", "al_zustandLabel", "al_zustand_new", "al_zustand_good", "al_zustand_renovation_needed", "al_zustand_unknown",
  "al_typFehler", "al_valuationNachrichtLabel", "al_valuationNachrichtHin",
  "al_zeitpunktLabel_sell", "al_zeitpunktLabel_let", "al_zeitpunktLabel_pm",
  "al_zeitpunkt_asap", "al_zeitpunkt_3m", "al_zeitpunkt_6m", "al_zeitpunkt_12m", "al_zeitpunkt_unsure",
  "al_belegungLabel", "al_belegung_owner", "al_belegung_rented", "al_belegung_vacant", "al_belegung_unknown",
  "al_bereitsInseriertLabel", "al_ja", "al_nein", "al_inseratRefLabel", "al_inseratRefHin", "al_andererMaklerLabel",
  "al_leistungenLabel", "al_leistung_tenant_search", "al_leistung_full_management", "al_leistung_accounting", "al_leistung_maintenance", "al_leistung_advice",
  "al_einheitenLabel", "al_nachrichtLabel", "al_nachrichtHin",
  "al_kanalLabel", "al_kanal_email", "al_kanal_phone", "al_kanal_whatsapp",
  "al_wunschterminLabel", "al_wunschterminHin", "al_wunschfensterLabel", "al_wunschfenster_morning", "al_wunschfenster_afternoon", "al_wunschfenster_evening",
  "al_datenschutzHin", "al_datenschutzLink", "al_nameFehler", "al_emailFehler",
  "al_bearbeiten",
  "al_senden", "al_erfolgVor", "al_erfolgNach", "al_fehlerAllgemein", "al_fehlerNetz", "al_fehlerRate", "al_fehlerFelder",
  "al_quer_sell", "al_quer_sell_link", "al_quer_let", "al_quer_let_link", "al_quer_valuation", "al_quer_valuation_link"
];
const TYPEN_SCHLUESSEL = ["wohnung", "haus", "villa", "chalet", "mfh", "gewerbe", "grundstueck", "parkplatz"].map(k => "w_typ_" + k);

export function anliegenTexte(t: T): Record<string, string> {
  const texte: Record<string, string> = {};
  for (const k of [...SCHLUESSEL, ...TYPEN_SCHLUESSEL]) texte[k] = t(k);
  return texte;
}
