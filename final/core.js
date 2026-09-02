/* FOURWALLS Grand Final — geteilter Produktkern (Logik, keine Gestalt).
   Wird von beiden Finalisten (Spiegel, Vorhang) identisch geladen.
   Voraussetzungen: listings.js (window.FWL) und properties.js (window.FW) vorher geladen. */
window.FWP = (function () {
  /* ---------- Sprache ---------- */
  const I18N = {
    de: { immobilien:"Immobilien", karte:"Karte", verkaufen:"Verkaufen", verwalten:"Verwalten", inserieren:"Gratis inserieren",
      gemerkt:"Gemerkt", kaufen:"Kaufen", mieten:"Mieten", ort:"Ort, PLZ, Kanton oder Region", typ:"Alle Objekttypen",
      preisBis:"Preis bis", preisVon:"Preis von", zimmerAb:"Zimmer ab", mehrFilter:"Mehr Filter", filter:"Filter", sucheSpeichern:"Suche speichern",
      treffer:"Treffer", inserate:"Inserate", neuste:"Neuste zuerst", preisAuf:"Preis aufsteigend", preisAb:"Preis absteigend",
      flaeche:"Grösste Fläche", zimmer:"Meiste Zimmer", liste:"Liste", weitere:"Weitere anzeigen", zuruecksetzen:"Zurücksetzen",
      anwenden:"Anwenden", wohnflaeche:"Wohnfläche ab (m²)", anbieter:"Anbieter", ausstattung:"Ausstattung", preisChf:"Preis (CHF)",
      merken:"Merken", gemerktOk:"Gemerkt ✓", schliessen:"Schliessen", anfrage:"Besichtigung anfragen", melden:"Inserat melden",
      teilen:"Teilen", dokumente:"Dokumente", lage:"Lage", beschreibung:"Beschreibung", fakten:"Fakten", kontakt:"Kontakt",
      konto:"Ihr Bereich", merkliste:"Gemerkte Objekte", suchabos:"Suchabos", meine:"Meine Inserate", weiter:"Weiter", zurueck:"Zurück",
      veroeffentlichen:"Kostenlos veröffentlichen", exclusive:"Fourwalls Exclusive", privat:"Privatinserat", makler:"Makler",
      verwaltung:"Verwaltung", bautraeger:"Bauträger", neu:"Neu", geprueft:"geprüft", proM2:"CHF/m²", aufAnfrage:"Preis auf Anfrage",
      proMonat:"/ Mt.", nk:"+ NK", keineTreffer:"Für diese Kombination gibt es zurzeit kein Inserat.", suchabo:"Suchabo anlegen",
      selbst:"Selbst inserieren", mitFW:"Mit Fourwalls verkaufen", zeilen:"Zeilen", kacheln:"Kacheln", buehne:"Bühne" },
    fr: { immobilien:"Immobilier", karte:"Carte", verkaufen:"Vendre", verwalten:"Gérance", inserieren:"Publier gratuitement",
      gemerkt:"Favoris", kaufen:"Acheter", mieten:"Louer", ort:"Lieu, NPA, canton ou région", typ:"Tous les types",
      preisBis:"Prix jusqu'à", preisVon:"Prix dès", zimmerAb:"Pièces dès", mehrFilter:"Plus de filtres", filter:"Filtres", sucheSpeichern:"Enregistrer la recherche",
      treffer:"résultats", inserate:"annonces", neuste:"Plus récentes", preisAuf:"Prix croissant", preisAb:"Prix décroissant",
      flaeche:"Plus grande surface", zimmer:"Plus de pièces", liste:"Liste", weitere:"Afficher plus", zuruecksetzen:"Réinitialiser",
      anwenden:"Appliquer", wohnflaeche:"Surface habitable dès (m²)", anbieter:"Annonceur", ausstattung:"Équipement", preisChf:"Prix (CHF)",
      merken:"Enregistrer", gemerktOk:"Enregistré ✓", schliessen:"Fermer", anfrage:"Demander une visite", melden:"Signaler l'annonce",
      teilen:"Partager", dokumente:"Documents", lage:"Situation", beschreibung:"Description", fakten:"Caractéristiques", kontakt:"Contact",
      konto:"Votre espace", merkliste:"Objets enregistrés", suchabos:"Alertes", meine:"Mes annonces", weiter:"Continuer", zurueck:"Retour",
      veroeffentlichen:"Publier gratuitement", exclusive:"Fourwalls Exclusive", privat:"Annonce privée", makler:"Courtier",
      verwaltung:"Gérance", bautraeger:"Promoteur", neu:"Nouveau", geprueft:"vérifié", proM2:"CHF/m²", aufAnfrage:"Prix sur demande",
      proMonat:"/ mois", nk:"+ charges", keineTreffer:"Aucune annonce ne correspond actuellement à cette combinaison.", suchabo:"Créer une alerte",
      selbst:"Publier moi-même", mitFW:"Vendre avec Fourwalls", zeilen:"Lignes", kacheln:"Vignettes", buehne:"Scène" },
    it: { immobilien:"Immobili", karte:"Mappa", verkaufen:"Vendere", verwalten:"Amministrazione", inserieren:"Pubblica gratis",
      gemerkt:"Preferiti", kaufen:"Comprare", mieten:"Affittare", ort:"Località, NPA, cantone o regione", typ:"Tutti i tipi",
      preisBis:"Prezzo fino a", preisVon:"Prezzo da", zimmerAb:"Locali da", mehrFilter:"Altri filtri", filter:"Filtri", sucheSpeichern:"Salva ricerca",
      treffer:"risultati", inserate:"annunci", neuste:"Più recenti", preisAuf:"Prezzo crescente", preisAb:"Prezzo decrescente",
      flaeche:"Superficie maggiore", zimmer:"Più locali", liste:"Elenco", weitere:"Mostra altri", zuruecksetzen:"Reimposta",
      anwenden:"Applica", wohnflaeche:"Superficie abitabile da (m²)", anbieter:"Inserzionista", ausstattung:"Dotazione", preisChf:"Prezzo (CHF)",
      merken:"Salva", gemerktOk:"Salvato ✓", schliessen:"Chiudi", anfrage:"Richiedi visita", melden:"Segnala annuncio",
      teilen:"Condividi", dokumente:"Documenti", lage:"Posizione", beschreibung:"Descrizione", fakten:"Dati", kontakt:"Contatto",
      konto:"La sua area", merkliste:"Oggetti salvati", suchabos:"Avvisi di ricerca", meine:"I miei annunci", weiter:"Avanti", zurueck:"Indietro",
      veroeffentlichen:"Pubblica gratuitamente", exclusive:"Fourwalls Exclusive", privat:"Annuncio privato", makler:"Agenzia",
      verwaltung:"Amministrazione", bautraeger:"Costruttore", neu:"Nuovo", geprueft:"verificato", proM2:"CHF/m²", aufAnfrage:"Prezzo su richiesta",
      proMonat:"/ mese", nk:"+ spese", keineTreffer:"Al momento nessun annuncio corrisponde a questa combinazione.", suchabo:"Crea avviso",
      selbst:"Pubblicare da solo", mitFW:"Vendere con Fourwalls", zeilen:"Righe", kacheln:"Schede", buehne:"Scena" },
    en: { immobilien:"Properties", karte:"Map", verkaufen:"Sell", verwalten:"Management", inserieren:"List for free",
      gemerkt:"Saved", kaufen:"Buy", mieten:"Rent", ort:"Place, postcode, canton or region", typ:"All property types",
      preisBis:"Price up to", preisVon:"Price from", zimmerAb:"Rooms from", mehrFilter:"More filters", filter:"Filters", sucheSpeichern:"Save search",
      treffer:"results", inserate:"listings", neuste:"Newest first", preisAuf:"Price ascending", preisAb:"Price descending",
      flaeche:"Largest area", zimmer:"Most rooms", liste:"List", weitere:"Show more", zuruecksetzen:"Reset",
      anwenden:"Apply", wohnflaeche:"Living area from (m²)", anbieter:"Publisher", ausstattung:"Features", preisChf:"Price (CHF)",
      merken:"Save", gemerktOk:"Saved ✓", schliessen:"Close", anfrage:"Request a viewing", melden:"Report listing",
      teilen:"Share", dokumente:"Documents", lage:"Location", beschreibung:"Description", fakten:"Facts", kontakt:"Contact",
      konto:"Your area", merkliste:"Saved properties", suchabos:"Search alerts", meine:"My listings", weiter:"Continue", zurueck:"Back",
      veroeffentlichen:"Publish for free", exclusive:"Fourwalls Exclusive", privat:"Private listing", makler:"Agency",
      verwaltung:"Management", bautraeger:"Developer", neu:"New", geprueft:"verified", proM2:"CHF/m²", aufAnfrage:"Price on request",
      proMonat:"/ month", nk:"+ charges", keineTreffer:"No listing currently matches this combination.", suchabo:"Create alert",
      selbst:"List it myself", mitFW:"Sell with Fourwalls", zeilen:"Rows", kacheln:"Cards", buehne:"Stage" }
  };
  let LANG = "de";
  function sprache(l) { if (I18N[l]) LANG = l; try { localStorage.setItem("fw-lang", LANG); } catch (e) {} return LANG; }
  try { const v = localStorage.getItem("fw-lang"); if (v && I18N[v]) LANG = v; } catch (e) {}
  const t = k => (I18N[LANG] && I18N[LANG][k]) || I18N.de[k] || k;

  /* ---------- Datensatz: Marktplatz + Fourwalls-Mandate zusammenführen ---------- */
  const TYP_MAP = { apartment:"wohnung", house:"haus", villa:"villa", chalet:"chalet", multifamily:"mfh", "multi-family":"mfh", commercial:"gewerbe", land:"grundstueck" };
  function mandate() {
    if (mandate._c) return mandate._c;
    const FWp = (window.FW && window.FW.properties) || [];
    mandate._c = FWp.map(p => ({
      id: p.id, slug: p.slug, fw: true,
      transactionType: p.transactionType, propertyType: TYP_MAP[p.propertyType] || (p.rooms == null ? "mfh" : "wohnung"),
      title: p.title.de, city: p.city, postalCode: p.postalCode, canton: p.canton, lat: p.lat, lng: p.lng,
      price: p.price ?? null, priceOnRequest: !!p.priceOnRequest, rentNet: p.rentNet ?? null, rentNK: p.rentNK ?? null,
      rooms: p.rooms ?? null, livingArea: p.livingArea ?? null, plotArea: p.plotArea ?? null, yearBuilt: p.yearBuilt ?? null,
      floor: p.floor ?? null, features: p.features || [], img: p.heroMedia, bilder: p.images || [p.heroMedia],
      beschreibung: p.blurb.de, text: p.description.de, highlights: p.highlights.de, raeume: p.roomsBreakdown || null,
      tagline: p.tagline.de, listingSource: "fourwalls", sellerType: "fourwalls", listingTier: p.featured ? "exclusive" : "verified",
      verificationStatus: "verified", publicationStatus: "active", publishedAt: p.createdAt, neu: false,
      views: 900 + Math.floor((p.livingArea || 100) * 7), favoritesCount: 40, inquiryCount: 9,
      publisher: "Fourwalls AG", contactOptions: ["form","call"], broker: p.broker, demo: true
    }));
    return mandate._c;
  }
  function alle() {
    if (alle._c) return alle._c;
    const synth = window.FWL.listings.filter(l => l.listingTier !== "exclusive" || l.listingSource !== "fourwalls")
      .map(l => Object.assign({}, l, { bilder: [l.img] }));
    /* synthetische «exclusive» durch echte Mandate ersetzen; Rest der FW-Inserate bleibt «verified» */
    alle._c = mandate().concat(synth);
    return alle._c;
  }
  const finde = slug => alle().find(l => l.slug === slug);

  /* ---------- Bilder (responsiv, extern) ---------- */
  const IMG_BASE = (window.FW_IMG_BASE || "../img/");
  function pic(key, opt) {
    opt = opt || {};
    const sizes = opt.sizes || "(max-width: 700px) 100vw, 33vw";
    const set = f => [480, 960, 1600].map(w => `${IMG_BASE}${key}-${w}.${f} ${w}w`).join(", ");
    const lazy = opt.eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy" decoding="async"';
    return `<picture><source type="image/webp" srcset="${set("webp")}" sizes="${sizes}">` +
      `<img src="${IMG_BASE}${key}-960.jpg" srcset="${set("jpg")}" sizes="${sizes}" alt="${(opt.alt || "").replace(/"/g, "&quot;")}" ${lazy}${opt.cls ? ` class="${opt.cls}"` : ""}></picture>`;
  }

  /* ---------- Formatierung ---------- */
  function chf(n) { return "CHF " + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "’"); }
  function preis(l) {
    if (l.transactionType === "rent") return chf(l.rentNet) + ".– " + t("proMonat");
    if (l.priceOnRequest || l.price == null) return t("aufAnfrage");
    return chf(l.price) + ".–";
  }
  function preisKurz(l) {
    if (l.transactionType === "rent") return chf(l.rentNet).replace("CHF ", "") + ".–";
    if (l.priceOnRequest || l.price == null) return "a. A.";
    if (l.price >= 1e6) return (l.price / 1e6).toFixed(2).replace(/\.?0+$/, "") + " Mio.";
    return chf(l.price).replace("CHF ", "");
  }
  /* CHF/m² nur wo aussagekräftig: Kauf + Wohnfläche + Wohnobjekt. Miete/Land/Parkplatz/Gewerbe: null. */
  function proM2(l) {
    if (l.transactionType !== "buy" || l.priceOnRequest || !l.price || !l.livingArea) return null;
    if (!["wohnung","haus","villa","chalet"].includes(l.propertyType)) return null;
    return Math.round(l.price / l.livingArea / 100) * 100;
  }

  /* ---------- Orte, Kantone, Regionen ---------- */
  const KANTON_NAME = { ZH:"Zürich", BE:"Bern", LU:"Luzern", ZG:"Zug", BS:"Basel-Stadt", BL:"Basel-Landschaft", GE:"Genf", VD:"Waadt", VS:"Wallis", TI:"Tessin", SG:"St. Gallen", GR:"Graubünden", AG:"Aargau", SO:"Solothurn", FR:"Freiburg", NE:"Neuenburg", SH:"Schaffhausen", SZ:"Schwyz", UR:"Uri", OW:"Obwalden", NW:"Nidwalden", TG:"Thurgau", GL:"Glarus", AR:"Appenzell AR", AI:"Appenzell IR", JU:"Jura" };
  const REGIONEN = {
    zentralschweiz: { name:"Zentralschweiz", kantone:["LU","ZG","SZ","UR","OW","NW"] },
    zuerich:        { name:"Region Zürich", kantone:["ZH"] },
    ostschweiz:     { name:"Ostschweiz", kantone:["SG","TG","AR","AI","GL","SH"] },
    nordwestschweiz:{ name:"Nordwestschweiz", kantone:["BS","BL","AG","SO"] },
    mittelland:     { name:"Bern & Mittelland", kantone:["BE"] },
    romandie:       { name:"Romandie", kantone:["GE","VD","NE","JU","FR"] },
    wallis:         { name:"Wallis", kantone:["VS"] },
    tessin:         { name:"Tessin", kantone:["TI"] },
    graubuenden:    { name:"Graubünden", kantone:["GR"] }
  };
  function ortIndex() {
    if (ortIndex._c) return ortIndex._c;
    const st = new Map(), kt = new Map();
    for (const l of alle()) {
      if (!st.has(l.city)) st.set(l.city, { name:l.city, kanton:l.canton, plz:new Set(), n:0 });
      const s = st.get(l.city); s.n++; s.plz.add(l.postalCode);
      kt.set(l.canton, (kt.get(l.canton) || 0) + 1);
    }
    ortIndex._c = { staedte:[...st.values()], kantone:[...kt.entries()] };
    return ortIndex._c;
  }
  function ortLabel(wert) {
    if (!wert) return "";
    if (wert.startsWith("kt:")) return "Kanton " + (KANTON_NAME[wert.slice(3)] || wert.slice(3));
    if (wert.startsWith("rg:")) return (REGIONEN[wert.slice(3)] || {}).name || wert;
    return wert;
  }
  function vorschlaege(q) {
    q = (q || "").trim().toLowerCase();
    if (!q) return [];
    const idx = ortIndex(), out = [];
    for (const [k, r] of Object.entries(REGIONEN))
      if (r.name.toLowerCase().includes(q) || k.startsWith(q))
        out.push({ label:r.name, sub:"Region · " + r.kantone.join(", "), wert:"rg:" + k, art:"region" });
    for (const [kt, n] of idx.kantone) {
      const nm = KANTON_NAME[kt] || kt;
      if (nm.toLowerCase().startsWith(q) || kt.toLowerCase() === q)
        out.push({ label:"Kanton " + nm, sub:n + " " + t("inserate"), wert:"kt:" + kt, art:"kanton" });
    }
    for (const s of idx.staedte) {
      if (s.name.toLowerCase().startsWith(q)) out.push({ label:s.name, sub:(KANTON_NAME[s.kanton] || s.kanton) + " · " + s.n + " " + t("inserate"), wert:s.name, art:"ort" });
      else if ([...s.plz].some(p => p.startsWith(q))) out.push({ label:[...s.plz].find(p => p.startsWith(q)) + " " + s.name, sub:"PLZ", wert:s.name, art:"plz" });
    }
    return out.slice(0, 8);
  }

  /* ---------- Filtern & Sortieren ---------- */
  const LEER = { trans:"buy", ort:"", typ:"", pMin:null, pMax:null, ziMin:null, flMin:null, feat:[], quelle:"", sort:"neu" };
  function filtern(f) {
    const q = Object.assign({}, LEER, f || {});
    let res = alle().filter(l => l.publicationStatus === "active" && l.transactionType === q.trans);
    if (q.ort) {
      if (q.ort.startsWith("kt:")) { const kt = q.ort.slice(3); res = res.filter(l => l.canton === kt); }
      else if (q.ort.startsWith("rg:")) { const ks = (REGIONEN[q.ort.slice(3)] || { kantone:[] }).kantone; res = res.filter(l => ks.includes(l.canton)); }
      else { const o = q.ort.toLowerCase(); res = res.filter(l => l.city.toLowerCase() === o || l.postalCode.startsWith(o)); }
    }
    if (q.typ) res = res.filter(l => l.propertyType === q.typ);
    if (q.quelle) res = res.filter(l => q.quelle === "fourwalls" ? l.listingSource === "fourwalls" : l.listingSource === q.quelle);
    const w = l => l.transactionType === "rent" ? l.rentNet : l.price;
    if (q.pMin != null) res = res.filter(l => w(l) != null && w(l) >= q.pMin);
    if (q.pMax != null) res = res.filter(l => w(l) != null && w(l) <= q.pMax);
    if (q.ziMin != null) res = res.filter(l => l.rooms != null && l.rooms >= q.ziMin);
    if (q.flMin != null) res = res.filter(l => l.livingArea != null && l.livingArea >= q.flMin);
    for (const ft of q.feat) res = res.filter(l => l.features.includes(ft));
    return sortieren(res, q.sort);
  }
  function sortieren(arr, art) {
    const w = l => (l.transactionType === "rent" ? l.rentNet : l.price) ?? Infinity;
    const a = arr.slice();
    if (art === "preis-auf") a.sort((x, y) => w(x) - w(y));
    else if (art === "preis-ab") a.sort((x, y) => (w(y) === Infinity ? -1 : w(y)) - (w(x) === Infinity ? -1 : w(x)));
    else if (art === "flaeche") a.sort((x, y) => (y.livingArea || 0) - (x.livingArea || 0));
    else if (art === "zimmer") a.sort((x, y) => (y.rooms || 0) - (x.rooms || 0));
    else {
      a.sort((x, y) => y.publishedAt.localeCompare(x.publishedAt) || y.id.localeCompare(x.id));
      const ex = a.filter(l => l.listingTier === "exclusive").slice(0, 3);
      return ex.concat(a.filter(l => !ex.includes(l)));
    }
    return a;
  }
  function aktiveFilterZahl(f) {
    const q = Object.assign({}, LEER, f || {});
    return [q.typ, q.pMin != null, q.pMax != null, q.ziMin != null, q.flMin != null, q.quelle].filter(Boolean).length + q.feat.length;
  }
  function ausURL() {
    const p = new URLSearchParams(location.search), f = {};
    if (p.get("trans")) f.trans = p.get("trans");
    if (p.get("ort")) f.ort = p.get("ort");
    if (p.get("typ")) f.typ = p.get("typ");
    if (p.get("quelle")) f.quelle = p.get("quelle");
    if (p.get("pmin")) f.pMin = +p.get("pmin");
    if (p.get("pmax")) f.pMax = +p.get("pmax");
    if (p.get("zi")) f.ziMin = +p.get("zi");
    if (p.get("fl")) f.flMin = +p.get("fl");
    if (p.get("feat")) f.feat = p.get("feat").split(",").filter(Boolean);
    if (p.get("sort")) f.sort = p.get("sort");
    return f;
  }
  function inURL(f) {
    const p = new URLSearchParams(location.search);
    ["trans","ort","typ","quelle","pmin","pmax","zi","fl","feat","sort"].forEach(k => p.delete(k));
    const q = Object.assign({}, LEER, f || {});
    if (q.trans !== "buy") p.set("trans", q.trans);
    if (q.ort) p.set("ort", q.ort); if (q.typ) p.set("typ", q.typ); if (q.quelle) p.set("quelle", q.quelle);
    if (q.pMin != null) p.set("pmin", q.pMin); if (q.pMax != null) p.set("pmax", q.pMax);
    if (q.ziMin != null) p.set("zi", q.ziMin); if (q.flMin != null) p.set("fl", q.flMin);
    if (q.feat.length) p.set("feat", q.feat.join(",")); if (q.sort !== "neu") p.set("sort", q.sort);
    const s = p.toString();
    history.replaceState(null, "", location.pathname + (s ? "?" + s : "") + location.hash);
  }
  function beschreibeSuche(f) {
    const q = Object.assign({}, LEER, f || {});
    return [ortLabel(q.ort), q.trans === "rent" ? t("mieten") : t("kaufen"), q.typ ? window.FWL.typen[q.typ] : "",
      q.ziMin ? q.ziMin + "+ Zi." : "", q.pMax ? "≤ " + chf(q.pMax) : ""].filter(Boolean).join(" · ");
  }

  /* ---------- Persistenz (Prototyp: localStorage; Produktion: Konto-Backend) ---------- */
  const lsGet = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const favs = { alle:() => lsGet("fw-favoriten", []), hat:id => favs.alle().includes(id),
    kippen(id) { const a = favs.alle(); const i = a.indexOf(id); if (i >= 0) a.splice(i, 1); else a.push(id); lsSet("fw-favoriten", a); return i < 0; } };
  const suchen = { alle:() => lsGet("fw-suchabos", []),
    speichern(f, name) { const a = suchen.alle(); a.push({ id:Date.now().toString(36), name, filter:f, erstellt:new Date().toISOString().slice(0, 10) }); lsSet("fw-suchabos", a); },
    loeschen(id) { lsSet("fw-suchabos", suchen.alle().filter(s => s.id !== id)); } };
  const entwurf = { laden:() => lsGet("fw-inserat-entwurf", null), speichern:d => lsSet("fw-inserat-entwurf", d), verwerfen:() => lsSet("fw-inserat-entwurf", null),
    veroeffentlichte:() => lsGet("fw-inserate", []),
    veroeffentlichen(d) { const a = entwurf.veroeffentlichte(); a.push(Object.assign({}, d, { id:"MEIN-" + Date.now().toString(36), publiziert:new Date().toISOString().slice(0, 10), status:"In Prüfung" })); lsSet("fw-inserate", a); entwurf.verwerfen(); } };

  /* ---------- Karte: Projektion + Clustering (Prototyp-Renderer; Produktion: MapLibre) ---------- */
  const BOX = { latMin:45.7, latMax:47.95, lngMin:5.9, lngMax:10.6 };
  function projekt(lat, lng, w, h) {
    const kx = Math.cos(46.8 * Math.PI / 180), spanX = (BOX.lngMax - BOX.lngMin) * kx, spanY = BOX.latMax - BOX.latMin;
    const s = Math.min(w / spanX, h / spanY), ox = (w - spanX * s) / 2, oy = (h - spanY * s) / 2;
    return { x: ox + (lng - BOX.lngMin) * kx * s, y: oy + (BOX.latMax - lat) * s };
  }
  function cluster(items, w, h, radius, zoom, cx, cy) {
    const z = zoom || 1, grp = [];
    for (const l of items) {
      const p = projekt(l.lat, l.lng, w, h);
      const x = (p.x - (cx || w / 2)) * z + w / 2, y = (p.y - (cy || h / 2)) * z + h / 2;
      if (x < -40 || x > w + 40 || y < -40 || y > h + 40) continue;
      let ziel = null;
      for (const g of grp) { const dx = g.x - x, dy = g.y - y; if (dx * dx + dy * dy < radius * radius) { ziel = g; break; } }
      if (ziel) { const n = ziel.punkte.length; ziel.punkte.push({ l, x, y }); ziel.x = (ziel.x * n + x) / (n + 1); ziel.y = (ziel.y * n + y) / (n + 1); }
      else grp.push({ x, y, punkte:[{ l, x, y }] });
    }
    return grp;
  }

  /* ---------- Inserats-Wizard ---------- */
  const WIZARD = [
    { key:"absicht", titel:"Was möchten Sie inserieren?" }, { key:"typ", titel:"Um welche Art Objekt handelt es sich?" },
    { key:"ort", titel:"Wo befindet sich das Objekt?" }, { key:"fakten", titel:"Die wichtigsten Fakten" },
    { key:"preis", titel:"Preisvorstellung" }, { key:"text", titel:"Titel und Beschreibung" }, { key:"bilder", titel:"Fotos" },
    { key:"kontakt", titel:"Wie erreichen Interessenten Sie?" }, { key:"pruefen", titel:"Prüfen und veröffentlichen" } ];
  function wizardPruefen(k, d) {
    const f = {}; d = d || {};
    if (k === "absicht" && !d.trans) f.trans = "Bitte wählen Sie Verkaufen oder Vermieten.";
    if (k === "typ" && !d.typ) f.typ = "Bitte wählen Sie einen Objekttyp.";
    if (k === "ort") { if (!d.plz || !/^\d{4}$/.test(d.plz)) f.plz = "Vierstellige PLZ."; if (!d.stadt) f.stadt = "Ort fehlt."; }
    if (k === "fakten" && d.typ !== "grundstueck" && d.typ !== "parkplatz" && (!d.flaeche || +d.flaeche < 8)) f.flaeche = "Fläche in m².";
    if (k === "preis" && !d.preisAufAnfrage && (!d.preis || +d.preis <= 0)) f.preis = "Preis angeben oder «auf Anfrage» wählen.";
    if (k === "text") { if (!d.titel || d.titel.length < 8) f.titel = "Mindestens 8 Zeichen."; if (!d.beschreibung || d.beschreibung.length < 30) f.beschreibung = "Mindestens 30 Zeichen — Lage und Zustand beschreiben."; }
    if (k === "kontakt") { if (!d.name) f.name = "Name fehlt."; if (!d.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) f.email = "Gültige E-Mail-Adresse."; }
    return f;
  }
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
  const FEAT_DE = { balcony:"Balkon", terrace:"Terrasse", garden:"Garten", parking:"Parkplatz", garage:"Garage", lift:"Lift", lakeview:"Seeblick", mountainview:"Bergsicht", fireplace:"Cheminée", parquet:"Parkett", floorheating:"Bodenheizung", minergie:"Minergie", cellar:"Keller", washtower:"Waschturm", pool:"Pool", sauna:"Sauna", evcharging:"E-Ladestation", concierge:"Concierge" };
  const QUELLE = { fourwalls:"exclusive", privat:"privat", agentur:"makler", verwaltung:"verwaltung", entwickler:"bautraeger" };
  const quelleLabel = l => l.listingTier === "exclusive" ? t("exclusive") : t(QUELLE[l.listingSource] || "privat");

  return { I18N, sprache, t, get lang() { return LANG; }, alle, mandate, finde, pic, chf, preis, preisKurz, proM2,
    KANTON_NAME, REGIONEN, ortLabel, vorschlaege, filtern, sortieren, aktiveFilterZahl, ausURL, inURL, beschreibeSuche,
    favs, suchen, entwurf, projekt, cluster, WIZARD, wizardPruefen, esc, FEAT_DE, quelleLabel };
})();
