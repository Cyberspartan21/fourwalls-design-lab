/* ============================================================
   FOURWALLS — Firmenangaben, an einem Ort.

   Fourwalls ist für diesen Entwurf eine fiktive Firma. Alles hier ist
   Platzhalter: plausibel für die Darstellung, nicht verifiziert.

   ORDNUNG DER FELDER
     `bestaetigt`   — von der Firma geprüft, darf produktiv erscheinen.
     `platzhalter`  — sieht echt aus, damit der Entwurf vollständig wirkt.
     `null`         — noch nichts bekannt. Bleibt leer; es wird nichts erfunden.

   Ein Feld auf `null` ist keine Lücke im Code, sondern eine offene Frage an die
   Auftraggeberschaft. Die Oberfläche muss mit `null` umgehen können, ohne
   «undefined» anzuzeigen — deshalb liefert `feld()` immer einen sauberen Wert.

   KEINE GEHEIMNISSE HIER.
   Diese Datei geht unverändert an jeden Browser. Sie enthält öffentliche
   Geschäftsangaben und sonst nichts. SMTP-Zugänge, Datenbank-Passwörter,
   API-Schlüssel, Auth-Secrets, Webhook-Signaturen und Admin-Tokens gehören in
   die Server-Umgebung, niemals in diese oder eine andere Browser-Datei.
   ============================================================ */
window.FWCO = (function () {

  const daten = {
    /* --- Identität --- */
    markenname:      { wert:"Fourwalls",            stand:"platzhalter" },
    firmierung:      { wert:"Fourwalls AG",         stand:"platzhalter" },
    rechtsform:      { wert:"AG",                   stand:"platzhalter" },
    uid:             { wert:null,                   stand:"offen", hinweis:"CHE-Nummer aus dem Handelsregister" },
    mwstPflichtig:   { wert:null,                   stand:"offen", hinweis:"MWST-pflichtig? Nummer und Satz für Rechnungen" },

    /* --- Erreichbarkeit --- */
    strasse:         { wert:"Löwenstrasse 12",      stand:"platzhalter" },
    plzOrt:          { wert:"8001 Zürich",          stand:"platzhalter" },
    postadresse:     { wert:null,                   stand:"offen", hinweis:"nur nötig, wenn abweichend vom Sitz" },
    telefon:         { wert:"+41 44 555 01 01",     stand:"platzhalter" },
    email:           { wert:"hallo@fourwalls.example", stand:"platzhalter", hinweis:".example ist reserviert (RFC 2606) — kann nicht versehentlich echte Post erhalten" },
    whatsapp:        { wert:null,                   stand:"offen", hinweis:"P4 hat bewusst keine Nummer erfunden. Ohne echte Nummer kein WhatsApp-Knopf." },
    erreichbarkeit:  { wert:null,                   stand:"offen", hinweis:"Bürozeiten für die Kontaktseite" },

    /* --- Standorte --- */
    staedte:         { wert:["Zürich","Bern","Genf","Lugano"], stand:"platzhalter", hinweis:"Welche Standorte gibt es wirklich — und sind es Büros oder Einsatzgebiete?" },

    /* --- Aussenauftritt --- */
    profile:         { wert:null,                   stand:"offen", hinweis:"LinkedIn, Instagram — nur verlinken, was gepflegt wird" },

    /* --- Recht --- */
    impressumUrl:    { wert:null,                   stand:"offen" },
    datenschutzUrl:  { wert:null,                   stand:"offen" },
    agbUrl:          { wert:null,                   stand:"offen" },

    /* --- Mitgliedschaften --- */
    mitgliedschaften:{ wert:null,                   stand:"offen", hinweis:"P4 hat «Mitglied SVIT Schweiz» entfernt, weil unbelegt. Erst wieder aufnehmen, wenn belegt." }
  };

  /* Wert eines Feldes, oder der Ersatz, wenn nichts bekannt ist. */
  function feld(name, ersatz) {
    const d = daten[name];
    return (d && d.wert != null) ? d.wert : (ersatz != null ? ersatz : "");
  }
  const hat = name => { const d = daten[name]; return !!(d && d.wert != null); };

  function offeneFelder() {
    return Object.entries(daten)
      .filter(([, d]) => d.wert == null || d.stand === "platzhalter")
      .map(([k, d]) => ({ feld:k, stand:d.stand, hinweis:d.hinweis || "" }));
  }

  return {
    daten, feld, hat, offeneFelder,
    /* Bequemer Zugriff für die Oberfläche — bleibt rückwärtskompatibel zu P4. */
    get name()    { return feld("firmierung", "Fourwalls"); },
    get marke()   { return feld("markenname", "Fourwalls"); },
    get strasse() { return feld("strasse"); },
    get plzOrt()  { return feld("plzOrt"); },
    get telefon() { return feld("telefon"); },
    get email()   { return feld("email"); },
    get staedte() { return feld("staedte", []); },
    demo: true
  };
})();
