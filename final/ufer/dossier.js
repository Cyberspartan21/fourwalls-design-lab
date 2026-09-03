/* ============================================================
   UFER — Dossier-Ableitung
   Macht aus jedem Inserat ein Objektdossier. Grundregel:
   ES WERDEN KEINE FAKTEN ERFUNDEN. Abgeleitet wird nur, was in den
   Inseratsdaten steht (Merkmale, Flächen, Baujahr, Quelle, Verfügbarkeit).
   Fehlt eine Angabe, fehlt der Block — kein Platzhalter, kein «keine Daten».
   Handgeschriebene Dossiers in FWD haben immer Vorrang.
   ============================================================ */
window.FWDOS = (function () {
  /* Merkmal → Zielblock. Nur Merkmale, die tatsächlich am Inserat hängen. */
  const AUS = { parquet:["boeden","Parkett"], floorheating:["boeden","Bodenheizung"], fireplace:["cheminee","Vorhanden"],
                lift:["lift","Vorhanden"], washtower:["waschen","Waschturm in der Wohnung"], cellar:["stauraum","Kellerabteil"],
                sauna:["sauna","Vorhanden"], concierge:["service","Concierge im Haus"] };
  const AUSSEN = { balcony:["balkon","Vorhanden"], terrace:["terrasse","Vorhanden"], garden:["garten","Vorhanden"],
                   pool:["pool","Vorhanden"], lakeview:["aussicht","Seeblick"], mountainview:["aussicht","Bergsicht"] };
  const PARK = { garage:["garage","Vorhanden"], parking:["aussenplaetze","Vorhanden"], evcharging:["ladestation","Vorhanden"] };
  const ENERG = { minergie:["minergie","Minergie-zertifiziert"], floorheating:["verteilung","Bodenheizung"] };

  const L18 = {
    de:{ privat:"Privatinserat", agentur:"Makler", verwaltung:"Verwaltung", entwickler:"Bauträger", fourwalls:"Fourwalls",
         privatHin:"Diese Person inseriert selbst. Fourwalls hat das Objekt nicht besichtigt und vertritt es nicht.",
         profiHin:"Ein gewerblicher Anbieter inseriert dieses Objekt. Ihre Anfrage geht direkt dorthin.",
         fwHin:"Fourwalls vertritt die Verkäuferschaft.",
         schritte:["Besichtigung anfragen","Frage stellen","Finanzierung prüfen"],
         schritteM:["Besichtigung anfragen","Frage stellen","Unterlagen anfordern"],
         neubau:"Neubau", neuwertig:"Neuwertig", gepflegt:"Gepflegt", aelter:"Älterer Baubestand",
         objektdok:"Objektdokumentation", nachAnfrage:"Wird nach Ihrer Anfrage freigeschaltet", grundriss:"Grundriss" },
    fr:{ privat:"Annonce privée", agentur:"Courtier", verwaltung:"Gérance", entwickler:"Promoteur", fourwalls:"Fourwalls",
         privatHin:"Cette personne publie elle-même. Fourwalls n'a pas visité ce bien et ne le représente pas.",
         profiHin:"Un professionnel publie ce bien. Votre demande lui parvient directement.",
         fwHin:"Fourwalls représente la partie venderesse.",
         schritte:["Demander une visite","Poser une question","Vérifier le financement"],
         schritteM:["Demander une visite","Poser une question","Demander le dossier"],
         neubau:"Construction neuve", neuwertig:"Comme neuf", gepflegt:"Bien entretenu", aelter:"Bâti plus ancien",
         objektdok:"Documentation du bien", nachAnfrage:"Débloqué après votre demande", grundriss:"Plan" },
    it:{ privat:"Annuncio privato", agentur:"Agenzia", verwaltung:"Amministrazione", entwickler:"Costruttore", fourwalls:"Fourwalls",
         privatHin:"Questa persona pubblica da sé. Fourwalls non ha visitato l'oggetto e non lo rappresenta.",
         profiHin:"Un operatore professionale pubblica questo oggetto. La sua richiesta arriva direttamente a lui.",
         fwHin:"Fourwalls rappresenta la parte venditrice.",
         schritte:["Richiedere una visita","Fare una domanda","Verificare il finanziamento"],
         schritteM:["Richiedere una visita","Fare una domanda","Richiedere la documentazione"],
         neubau:"Nuova costruzione", neuwertig:"Come nuovo", gepflegt:"Ben tenuto", aelter:"Costruzione più datata",
         objektdok:"Documentazione dell'immobile", nachAnfrage:"Sbloccato dopo la vostra richiesta", grundriss:"Planimetria" },
    en:{ privat:"Private listing", agentur:"Agency", verwaltung:"Management", entwickler:"Developer", fourwalls:"Fourwalls",
         privatHin:"This person is advertising directly. Fourwalls has not inspected or represented this property.",
         profiHin:"A professional advertiser published this property. Your enquiry goes straight to them.",
         fwHin:"Fourwalls represents the seller.",
         schritte:["Request a viewing","Ask a question","Check financing"],
         schritteM:["Request a viewing","Ask a question","Request documents"],
         neubau:"New build", neuwertig:"Like new", gepflegt:"Well maintained", aelter:"Older building stock",
         objektdok:"Property documentation", nachAnfrage:"Unlocked after your inquiry", grundriss:"Floor plan" }
  };
  const s = k => (L18[FWP.lang] || L18.de)[k];

  /* Zustand aus Baujahr — als Ableitung gekennzeichnet, nicht als Besichtigungsbefund */
  function zustand(jahr) {
    if (!jahr) return null;
    const alter = 2026 - jahr;
    if (alter <= 3)  return s("neubau");
    if (alter <= 15) return s("neuwertig");
    if (alter <= 40) return s("gepflegt");
    return s("aelter");
  }

  function bauen(l) {
    if (!l) return null;
    const eigen = (window.FWD || {})[l.slug];
    if (eigen) return eigen;                       // handgeschriebenes Dossier gewinnt

    const q = l.listingSource || "privat";
    const profi = q !== "privat";
    const d = { stufe: q === "fourwalls" ? "exclusive" : profi ? "agentur" : "privat", abgeleitet: true };

    /* Quelle und Kontaktweg — wer antwortet, steht immer fest */
    d.quelle = {
      art: q, name: l.publisher || s(q),
      verifiziert: l.verificationStatus === "verified",
      hinweis: q === "fourwalls" ? s("fwHin") : profi ? s("profiHin") : s("privatHin")
    };

    /* Fakten: ausschliesslich vorhandene Werte */
    const f = {};
    if (l.rooms != null) f.zimmer = l.rooms;
    if (l.livingArea) f.wohnflaeche = l.livingArea;
    if (l.plotArea) f.grundstueck = l.plotArea;
    if (l.yearBuilt) f.baujahr = l.yearBuilt;
    if (l.floor != null) f.etage = FWP.etageLabel(l.floor);
    f.verfuegbar = FWP.verfuegbarLabel(l);
    if (Object.keys(f).length) d.fakten = f;

    /* Gebäude nur, wenn wenigstens ein echter Wert vorliegt */
    const g = {};
    if (l.yearBuilt) { g.baujahr = l.yearBuilt; const z = zustand(l.yearBuilt); if (z) g.zustand = z + " (aus dem Baujahr abgeleitet)"; }
    if (Object.keys(g).length) d.gebaeude = g;

    /* Ausstattung, Aussen, Parkieren, Energie — nur aus den Merkmalen des Inserats */
    const feat = l.features || [];
    const sam = (tabelle) => { const o = {}; feat.forEach(x => { const e = tabelle[x]; if (e) o[e[0]] = o[e[0]] ? o[e[0]] + ", " + e[1] : e[1]; }); return Object.keys(o).length ? o : null; };
    const a = sam(AUS); if (a) d.ausstattung = a;
    const au = sam(AUSSEN); if (au) d.aussen = au;
    const p = sam(PARK); if (p) d.parkieren = p;
    const en = sam(ENERG); if (en) d.energie = en;

    /* Medien: nur die tatsächlich vorhandenen Bilder */
    const bilder = (l.bilder && l.bilder.length ? l.bilder : [l.img]).filter(Boolean);
    d.medien = { bilder: bilder.map(k => ({ key:k, text:"", kat:"wohnen" })) };

    /* Beschreibung: der Inseratstext, nicht mehr */
    if (l.text || l.beschreibung) d.story = { titel:FWP.t("beschreibung"), absaetze:[l.text || l.beschreibung] };

    /* Lage: nur Verortung, keine erfundene Umgebung */
    d.lage = { gemeinde:l.city, kanton:FWP.KANTON_NAME[l.canton] || l.canton, plz:l.postalCode };

    /* Dokumente nur bei gewerblichen Anbietern — und nur solche, die es real gäbe */
    if (profi) {
      d.dokumente = [{ name:s("objektdok"), typ:"pdf", zugang:"anfrage", hinweis:s("nachAnfrage") }];
      if (l.propertyType !== "grundstueck" && l.propertyType !== "parkplatz")
        d.dokumente.push({ name:s("grundriss"), typ:"pdf", zugang:"anfrage" });
    }

    d.naechsteSchritte = l.transactionType === "rent" ? s("schritteM") : s("schritte");
    d.aehnliche = FWP.aehnliche(l).map(x => x.slug);
    return d;
  }

  return { bauen, zustand };
})();
