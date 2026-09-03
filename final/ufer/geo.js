/* ============================================================
   UFER — Geografisches Modell und GeoProvider
   Eine geografische Wahrheit für Suche, Karte, Objektseite und Inserat.

   Grundsätze
   · Orte, Postleitzahlen, Kantone und Regionen sind Entitäten mit stabiler
     Kennung und übersetzten Namen — nicht Zeichenketten.
   · Koordinaten der Gemeinden sind echte Ortsmitten. Die Demo-Objekte liegen
     plausibel darum herum; sie zeigen auf kein reales Wohnhaus.
   · Der GeoProvider ist ein Adapter. Heute beantwortet ihn ein eingebauter
     Schweizer Ortsindex ohne fremden Dienst. Später kann ein Adressdienst
     dieselbe Schnittstelle bedienen, ohne dass Suche oder Karte sich ändern.
   ============================================================ */
window.FWGEO = (function () {

  /* ---------- Kantone: Mitte und Hüllrechteck (Nord, Süd, Ost, West) ---------- */
  const KANTONE = {
    ZH:{ mitte:[47.41,8.65], box:[47.69,47.16,8.99,8.36] }, BE:{ mitte:[46.87,7.62], box:[47.35,46.33,8.47,6.86] },
    LU:{ mitte:[47.08,8.13], box:[47.29,46.77,8.51,7.83] }, UR:{ mitte:[46.79,8.64], box:[47.02,46.53,8.98,8.34] },
    SZ:{ mitte:[47.05,8.72], box:[47.24,46.87,9.03,8.36] }, OW:{ mitte:[46.86,8.25], box:[47.02,46.68,8.53,8.03] },
    NW:{ mitte:[46.94,8.39], box:[47.03,46.77,8.61,8.24] }, GL:{ mitte:[46.99,9.06], box:[47.19,46.73,9.30,8.86] },
    ZG:{ mitte:[47.15,8.54], box:[47.25,47.06,8.71,8.40] }, FR:{ mitte:[46.72,7.11], box:[47.03,46.44,7.42,6.72] },
    SO:{ mitte:[47.32,7.60], box:[47.50,47.07,8.03,7.34] }, BS:{ mitte:[47.56,7.60], box:[47.60,47.51,7.68,7.55] },
    BL:{ mitte:[47.45,7.73], box:[47.57,47.32,8.05,7.34] }, SH:{ mitte:[47.70,8.60], box:[47.81,47.61,8.90,8.40] },
    AR:{ mitte:[47.38,9.28], box:[47.48,47.24,9.53,9.16] }, AI:{ mitte:[47.32,9.41], box:[47.40,47.22,9.58,9.28] },
    SG:{ mitte:[47.24,9.27], box:[47.55,46.87,9.68,8.79] }, GR:{ mitte:[46.66,9.63], box:[47.06,46.17,10.49,8.65] },
    AG:{ mitte:[47.39,8.15], box:[47.62,47.14,8.46,7.71] }, TG:{ mitte:[47.57,9.09], box:[47.70,47.37,9.55,8.66] },
    TI:{ mitte:[46.30,8.80], box:[46.63,45.82,9.16,8.38] }, VD:{ mitte:[46.60,6.63], box:[47.02,46.19,7.25,6.06] },
    VS:{ mitte:[46.21,7.62], box:[46.65,45.86,8.48,6.77] }, NE:{ mitte:[47.00,6.84], box:[47.16,46.84,7.06,6.44] },
    GE:{ mitte:[46.21,6.14], box:[46.32,46.13,6.31,5.96] }, JU:{ mitte:[47.35,7.14], box:[47.50,47.21,7.55,6.86] }
  };
  const KT_NAME = { ZH:"Zürich", BE:"Bern", LU:"Luzern", UR:"Uri", SZ:"Schwyz", OW:"Obwalden", NW:"Nidwalden",
    GL:"Glarus", ZG:"Zug", FR:"Freiburg", SO:"Solothurn", BS:"Basel-Stadt", BL:"Basel-Landschaft", SH:"Schaffhausen",
    AR:"Appenzell Ausserrhoden", AI:"Appenzell Innerrhoden", SG:"St. Gallen", GR:"Graubünden", AG:"Aargau",
    TG:"Thurgau", TI:"Tessin", VD:"Waadt", VS:"Wallis", NE:"Neuenburg", GE:"Genf", JU:"Jura" };
  const KT_NAME_FR = { FR:"Fribourg", GR:"Grisons", TI:"Tessin", VD:"Vaud", VS:"Valais", NE:"Neuchâtel", GE:"Genève",
    BE:"Berne", LU:"Lucerne", ZH:"Zurich", BS:"Bâle-Ville", BL:"Bâle-Campagne", SG:"Saint-Gall", SO:"Soleure",
    TG:"Thurgovie", AG:"Argovie", SH:"Schaffhouse", ZG:"Zoug", SZ:"Schwytz", OW:"Obwald", NW:"Nidwald", GL:"Glaris",
    UR:"Uri", AR:"Appenzell Rhodes-Extérieures", AI:"Appenzell Rhodes-Intérieures", JU:"Jura" };
  const KT_NAME_IT = { ZH:"Zurigo", BE:"Berna", LU:"Lucerna", FR:"Friburgo", SO:"Soletta", BS:"Basilea Città",
    BL:"Basilea Campagna", SH:"Sciaffusa", SG:"San Gallo", GR:"Grigioni", AG:"Argovia", TG:"Turgovia", TI:"Ticino",
    VD:"Vaud", VS:"Vallese", NE:"Neuchâtel", GE:"Ginevra", JU:"Giura", ZG:"Zugo", SZ:"Svitto", OW:"Obvaldo",
    NW:"Nidvaldo", GL:"Glarona", UR:"Uri", AR:"Appenzello Esterno", AI:"Appenzello Interno" };
  const KT_NAME_EN = Object.assign({}, KT_NAME, { ZH:"Zurich", BE:"Bern", LU:"Lucerne", GE:"Geneva", TI:"Ticino",
    VD:"Vaud", VS:"Valais", GR:"Grisons", FR:"Fribourg", NE:"Neuchâtel", BS:"Basel-Stadt", SO:"Solothurn" });

  /* ---------- Gemeinden: echte Ortsmitten ---------- */
  const ORTE = [
    { id:"ort-zuerich", name:"Zürich", kt:"ZH", plz:["8001","8032","8045"], lat:47.3769, lng:8.5417, alt:["zurich","zuerich","turitg", "zurich", "zurigo"] , n:{fr:"Zurich",it:"Zurigo",en:"Zurich"}},
    { id:"ort-winterthur", name:"Winterthur", kt:"ZH", plz:["8400"], lat:47.5001, lng:8.7501 },
    { id:"ort-uster", name:"Uster", kt:"ZH", plz:["8610"], lat:47.3474, lng:8.7208 },
    { id:"ort-kuesnacht", name:"Küsnacht", kt:"ZH", plz:["8700"], lat:47.3178, lng:8.5847, alt:["kuesnacht","kusnacht"] },
    { id:"ort-bern", name:"Bern", kt:"BE", plz:["3011"], lat:46.9480, lng:7.4474, alt:["berne","berna", "berne", "berna"] , n:{fr:"Berne",it:"Berna",en:"Bern"}},
    { id:"ort-koeniz", name:"Köniz", kt:"BE", plz:["3098"], lat:46.9245, lng:7.4147, alt:["koeniz","koniz"] , n:{fr:"Köniz",it:"Köniz",en:"Koeniz"}},
    { id:"ort-thun", name:"Thun", kt:"BE", plz:["3600"], lat:46.7580, lng:7.6280, alt:["thoune", "thoune"] , n:{fr:"Thoune",it:"Thun",en:"Thun"}},
    { id:"ort-interlaken", name:"Interlaken", kt:"BE", plz:["3800"], lat:46.6863, lng:7.8632 },
    { id:"ort-luzern", name:"Luzern", kt:"LU", plz:["6003"], lat:47.0502, lng:8.3093, alt:["lucerne","lucerna", "lucerne", "lucerna"] , n:{fr:"Lucerne",it:"Lucerna",en:"Lucerne"}},
    { id:"ort-kriens", name:"Kriens", kt:"LU", plz:["6010"], lat:47.0348, lng:8.2792 },
    { id:"ort-basel", name:"Basel", kt:"BS", plz:["4051"], lat:47.5596, lng:7.5886, alt:["bale","basle","basilea", "bale", "bâle", "basilea"] , n:{fr:"Bâle",it:"Basilea",en:"Basel"}},
    { id:"ort-riehen", name:"Riehen", kt:"BS", plz:["4125"], lat:47.5799, lng:7.6497 },
    { id:"ort-genf", name:"Genf", kt:"GE", plz:["1204"], lat:46.2044, lng:6.1432, alt:["geneve","geneva","ginevra","genf", "geneve", "genève", "ginevra", "geneva"] , n:{fr:"Genève",it:"Ginevra",en:"Geneva"}},
    { id:"ort-carouge", name:"Carouge", kt:"GE", plz:["1227"], lat:46.1817, lng:6.1394 },
    { id:"ort-lausanne", name:"Lausanne", kt:"VD", plz:["1003"], lat:46.5197, lng:6.6323, alt:["losanna"] },
    { id:"ort-montreux", name:"Montreux", kt:"VD", plz:["1820"], lat:46.4312, lng:6.9107 },
    { id:"ort-nyon", name:"Nyon", kt:"VD", plz:["1260"], lat:46.3833, lng:6.2394 },
    { id:"ort-lugano", name:"Lugano", kt:"TI", plz:["6900"], lat:46.0037, lng:8.9511 },
    { id:"ort-locarno", name:"Locarno", kt:"TI", plz:["6600"], lat:46.1712, lng:8.7994 },
    { id:"ort-ascona", name:"Ascona", kt:"TI", plz:["6612"], lat:46.1547, lng:8.7714 },
    { id:"ort-stgallen", name:"St. Gallen", kt:"SG", plz:["9000"], lat:47.4245, lng:9.3767, alt:["saint gall","san gallo","st gallen","sankt gallen", "saint-gall", "san gallo", "st gallen"] , n:{fr:"Saint-Gall",it:"San Gallo",en:"St. Gallen"}},
    { id:"ort-rapperswil", name:"Rapperswil", kt:"SG", plz:["8640"], lat:47.2266, lng:8.8180 },
    { id:"ort-quarten", name:"Quarten", kt:"SG", plz:["8883"], lat:47.1067, lng:9.2194 },
    { id:"ort-chur", name:"Chur", kt:"GR", plz:["7000"], lat:46.8508, lng:9.5320, alt:["coire","coira", "coire", "coira"] , n:{fr:"Coire",it:"Coira",en:"Chur"}},
    { id:"ort-stmoritz", name:"St. Moritz", kt:"GR", plz:["7500"], lat:46.4908, lng:9.8355, alt:["saint moritz","san murezzan", "saint-moritz", "san maurizio", "st moritz"] , n:{fr:"Saint-Moritz",it:"San Maurizio",en:"St. Moritz"}},
    { id:"ort-davos", name:"Davos", kt:"GR", plz:["7270"], lat:46.8027, lng:9.8360 },
    { id:"ort-zug", name:"Zug", kt:"ZG", plz:["6300"], lat:47.1662, lng:8.5155, alt:["zoug","zugo", "zoug", "zugo"] , n:{fr:"Zoug",it:"Zugo",en:"Zug"}},
    { id:"ort-baar", name:"Baar", kt:"ZG", plz:["6340"], lat:47.1958, lng:8.5292 },
    { id:"ort-aarau", name:"Aarau", kt:"AG", plz:["5000"], lat:47.3925, lng:8.0442 },
    { id:"ort-baden", name:"Baden", kt:"AG", plz:["5400"], lat:47.4735, lng:8.3063 },
    { id:"ort-sitten", name:"Sitten", kt:"VS", plz:["1950"], lat:46.2311, lng:7.3590, alt:["sion","sitten", "sion"] , n:{fr:"Sion",it:"Sion",en:"Sion"}},
    { id:"ort-cransmontana", name:"Crans-Montana", kt:"VS", plz:["3963"], lat:46.3122, lng:7.4808, alt:["crans","montana"] },
    { id:"ort-zermatt", name:"Zermatt", kt:"VS", plz:["3920"], lat:46.0207, lng:7.7491 },
    { id:"ort-fribourg", name:"Fribourg", kt:"FR", plz:["1700"], lat:46.8065, lng:7.1615, alt:["freiburg","friburgo"] , n:{fr:"Fribourg",it:"Friburgo",en:"Fribourg"}},
    { id:"ort-solothurn", name:"Solothurn", kt:"SO", plz:["4500"], lat:47.2088, lng:7.5323, alt:["soleure","soletta", "soleure", "soletta"] , n:{fr:"Soleure",it:"Soletta",en:"Solothurn"}},
    { id:"ort-schaffhausen", name:"Schaffhausen", kt:"SH", plz:["8200"], lat:47.6979, lng:8.6308, alt:["schaffhouse","sciaffusa", "schaffhouse", "sciaffusa"] , n:{fr:"Schaffhouse",it:"Sciaffusa",en:"Schaffhausen"}},
    { id:"ort-neuchatel", name:"Neuchâtel", kt:"NE", plz:["2000"], lat:46.9925, lng:6.9310, alt:["neuchatel","neuenburg"] , n:{fr:"Neuchâtel",it:"Neuchâtel",en:"Neuchâtel"}},
    { id:"ort-schwyz", name:"Schwyz", kt:"SZ", plz:["6430"], lat:47.0207, lng:8.6530, alt:["schwytz","svitto", "schwytz", "svitto"] , n:{fr:"Schwytz",it:"Svitto",en:"Schwyz"}}
  ];

  /* ---------- Regionen: benannte Gebiete, keine Kreise ---------- */
  const REGIONEN = {
    zentralschweiz:  { kantone:["LU","ZG","SZ","UR","OW","NW"], box:[47.29,46.53,9.03,7.83],
                       n:{de:"Zentralschweiz",fr:"Suisse centrale",it:"Svizzera centrale",en:"Central Switzerland"} },
    zuerich:         { kantone:["ZH"], box:[47.69,47.16,8.99,8.36],
                       n:{de:"Region Zürich",fr:"Région de Zurich",it:"Regione di Zurigo",en:"Zurich region"} },
    ostschweiz:      { kantone:["SG","TG","AR","AI","GL","SH"], box:[47.81,46.73,9.68,8.40],
                       n:{de:"Ostschweiz",fr:"Suisse orientale",it:"Svizzera orientale",en:"Eastern Switzerland"} },
    nordwestschweiz: { kantone:["BS","BL","AG","SO"], box:[47.62,47.07,8.46,7.34],
                       n:{de:"Nordwestschweiz",fr:"Suisse du Nord-Ouest",it:"Svizzera nordoccidentale",en:"North-western Switzerland"} },
    mittelland:      { kantone:["BE"], box:[47.35,46.33,8.47,6.86],
                       n:{de:"Bern & Mittelland",fr:"Berne et Plateau",it:"Berna e Altopiano",en:"Bern & Central Plateau"} },
    romandie:        { kantone:["GE","VD","NE","JU","FR"], box:[47.50,46.13,7.55,5.96],
                       n:{de:"Romandie",fr:"Suisse romande",it:"Svizzera romanda",en:"French-speaking Switzerland"} },
    wallis:          { kantone:["VS"], box:[46.65,45.86,8.48,6.77],
                       n:{de:"Wallis",fr:"Valais",it:"Vallese",en:"Valais"} },
    tessin:          { kantone:["TI"], box:[46.63,45.82,9.16,8.38],
                       n:{de:"Tessin",fr:"Tessin",it:"Ticino",en:"Ticino"} },
    graubuenden:     { kantone:["GR"], box:[47.06,46.17,10.49,8.65],
                       n:{de:"Graubünden",fr:"Grisons",it:"Grigioni",en:"Grisons"} }
  };

  const SCHWEIZ = { box:[47.81,45.82,10.49,5.96], mitte:[46.80,8.23] };

  /* ---------- Namen in der gewählten Sprache ---------- */
  function kantonName(kt, lang) {
    const l = lang || ((window.FWP && window.FWP.lang) || "de");
    return (l === "fr" ? KT_NAME_FR[kt] : l === "it" ? KT_NAME_IT[kt] : l === "en" ? KT_NAME_EN[kt] : KT_NAME[kt]) || kt;
  }
  /* Gemeinden mit gebräuchlichem Namen in mehreren Landessprachen */
  function ortName(o, lang) {
    if (!o) return "";
    const l = lang || ((window.FWP && window.FWP.lang) || "de");
    return (o.n && o.n[l]) || o.name;
  }
  const KT_WORT = { de:"Kanton", fr:"Canton", it:"Cantone", en:"Canton" };
  /* Beugungen wie «Canton de Genève» oder «du Valais» ersparen wir uns: der
     Zusatz nennt den Kanton, nicht einen Satz. Trägt eine Gemeinde denselben
     Namen wie ihr Kanton, hilft das Kürzel beim Auseinanderhalten. */
  function kantonZusatz(kt, lang, ortsname) {
    const l = lang || ((window.FWP && window.FWP.lang) || "de");
    const nm = kantonName(kt, l);
    return ortsname && ortsname === nm ? nm + " (" + kt + ")" : nm;
  }
  const kantonWort = lang => KT_WORT[lang || ((window.FWP && window.FWP.lang) || "de")] || KT_WORT.de;
  function regionName(id, lang) {
    const r = REGIONEN[id]; if (!r) return id;
    return r.n[lang || ((window.FWP && window.FWP.lang) || "de")] || r.n.de;
  }

  /* ---------- Normalisieren: Umlaute, Akzente, Schreibvarianten ---------- */
  function norm(s) {
    return String(s || "").toLowerCase().trim()
      .replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ").trim();
  }
  /* Toleranz für einen Tippfehler (Levenshtein bis 1), nur bei Wörtern ab fünf Zeichen */
  function nah(a, b) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1 || a.length < 5) return false;
    let i = 0, j = 0, f = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++f > 1) return false;
      if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; }
    }
    return f + (a.length - i) + (b.length - j) <= 1;
  }

  const ORT_INDEX = ORTE.map(o => ({ o,
    keys:[norm(o.name), ...Object.values(o.n || {}).map(norm), ...(o.alt || []).map(norm)] }));

  /* ---------- GeoProvider: heute lokaler Index, morgen ein Adressdienst ---------- */
  const GeoProvider = {
    quelle: "lokaler Schweizer Ortsindex (Gemeinden, Postleitzahlen, Kantone, Regionen)",
    kannAdressen: false,          // ein Adressdienst würde das auf true setzen

    /* Autocomplete über alle Entitätsarten */
    search(q, opt) {
      opt = opt || {};
      const roh = String(q || "").trim();
      if (!roh) return [];
      const n = norm(roh), lang = opt.lang || ((window.FWP && window.FWP.lang) || "de");
      const out = [];

      /* Postleitzahl */
      if (/^\d{4}$/.test(roh) || /^\d{2,3}$/.test(roh)) {
        for (const o of ORTE) for (const p of o.plz)
          if (p.startsWith(roh)) out.push({ typ:"plz", id:"plz-" + p, label:p + " " + ortName(o, lang),
            sub:kantonZusatz(o.kt, lang, ortName(o, lang)), ortId:o.id, kt:o.kt, lat:o.lat, lng:o.lng, treffer:100 - Math.abs(p.length - roh.length) });
        /* Vierstellige Eingabe ohne Treffer: den Postkreis anbieten, statt nichts */
        if (!out.length && roh.length === 4) {
          const kurz = roh.slice(0, 3);
          for (const o of ORTE) for (const p of o.plz)
            if (p.startsWith(kurz)) out.push({ typ:"plz", id:"plz-" + p, label:p + " " + ortName(o, lang),
              sub:kantonZusatz(o.kt, lang, ortName(o, lang)), ortId:o.id, kt:o.kt, lat:o.lat, lng:o.lng, treffer:70 });
        }
      }
      /* Region */
      for (const [id, r] of Object.entries(REGIONEN)) {
        const nm = norm(regionName(id, lang)), de = norm(r.n.de);
        if (nm.startsWith(n) || de.startsWith(n) || norm(id).startsWith(n))
          out.push({ typ:"region", id:"rg-" + id, label:regionName(id, lang),
            sub:r.kantone.join(", "), box:r.box, kantone:r.kantone, treffer:90 });
      }
      /* Kanton */
      for (const kt of Object.keys(KANTONE)) {
        const nm = norm(kantonName(kt, lang)), de = norm(KT_NAME[kt]);
        if (nm.startsWith(n) || de.startsWith(n) || norm(kt) === n)
          out.push({ typ:"kanton", id:"kt-" + kt, label:kantonName(kt, lang), sub:kantonWort(lang),
            kt, box:KANTONE[kt].box, lat:KANTONE[kt].mitte[0], lng:KANTONE[kt].mitte[1], treffer:85 });
      }
      /* Gemeinde — Anfang, enthalten, ein Tippfehler */
      for (const { o, keys } of ORT_INDEX) {
        let p = 0;
        for (const k of keys) {
          if (k === n) { p = Math.max(p, 100); break; }
          if (k.startsWith(n)) p = Math.max(p, 95);
          else if (k.includes(n) && n.length >= 3) p = Math.max(p, 70);
          else if (nah(k, n)) p = Math.max(p, 60);
        }
        if (p) out.push({ typ:"ort", id:o.id, label:ortName(o, lang), sub:kantonZusatz(o.kt, lang, ortName(o, lang)),
          kt:o.kt, plz:o.plz, lat:o.lat, lng:o.lng, treffer:p });
      }
      const rang = { ort:3, plz:2, kanton:1, region:0 };
      return out.sort((a, b) => b.treffer - a.treffer || rang[b.typ] - rang[a.typ]).slice(0, opt.limit || 8);
    },

    /* Eine Entität anhand ihrer Kennung */
    getPlace(id) {
      if (!id) return null;
      if (id.startsWith("rg-")) { const k = id.slice(3), r = REGIONEN[k];
        return r ? { typ:"region", id, label:regionName(k), box:r.box, kantone:r.kantone } : null; }
      if (id.startsWith("kt-")) { const kt = id.slice(3), k = KANTONE[kt];
        return k ? { typ:"kanton", id, kt, label:kantonName(kt), box:k.box, lat:k.mitte[0], lng:k.mitte[1] } : null; }
      if (id.startsWith("plz-")) { const p = id.slice(4), o = ORTE.find(x => x.plz.includes(p));
        return o ? { typ:"plz", id, label:p + " " + ortName(o), ortId:o.id, kt:o.kt, lat:o.lat, lng:o.lng } : null; }
      const o = ORTE.find(x => x.id === id);
      return o ? { typ:"ort", id, label:ortName(o), kt:o.kt, plz:o.plz, lat:o.lat, lng:o.lng } : null;
    },

    /* Freitext zu Entität — für Altlinks und getippte Eingaben */
    forward(text) {
      const t = this.search(text, { limit:1 });
      return t.length ? this.getPlace(t[0].id) : null;
    },

    /* Nächstgelegene Gemeinde zu einer Koordinate */
    reverse(lat, lng) {
      let best = null, bd = Infinity;
      for (const o of ORTE) { const d = km(lat, lng, o.lat, o.lng); if (d < bd) { bd = d; best = o; } }
      return best ? { typ:"ort", id:best.id, label:ortName(best), kt:best.kt, lat:best.lat, lng:best.lng, distanzKm:Math.round(bd * 10) / 10 } : null;
    },

    ort: id => ORTE.find(o => o.id === id) || null,
    ortNachName: name => { const n = norm(name); return ORTE.find(o => norm(o.name) === n || (o.alt || []).some(a => norm(a) === n)) || null; },
    kanton: kt => KANTONE[kt] ? { kt, ...KANTONE[kt], label:kantonName(kt) } : null,
    region: id => REGIONEN[id] ? { id, ...REGIONEN[id], label:regionName(id) } : null,
    ortName: (o, lang) => ortName(typeof o === "string" ? ORTE.find(x => x.id === o) : o, lang),
    alleOrte: () => ORTE, alleRegionen: () => Object.keys(REGIONEN), alleKantone: () => Object.keys(KANTONE),
    schweiz: () => SCHWEIZ
  };

  /* ---------- Geometrie ---------- */
  function km(lat1, lng1, lat2, lng2) {
    const R = 6371, r = Math.PI / 180;
    const dLa = (lat2 - lat1) * r, dLo = (lng2 - lng1) * r;
    const x = Math.sin(dLa / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const inBox = (lat, lng, b) => lat <= b[0] && lat >= b[1] && lng <= b[2] && lng >= b[3];
  function boxUm(lat, lng, radiusKm) {
    const dLat = radiusKm / 111, dLng = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
    return [lat + dLat, lat - dLat, lng + dLng, lng - dLng];
  }
  function boxVereinen(boxen) {
    return boxen.reduce((a, b) => a ? [Math.max(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.min(a[3], b[3])] : b.slice(), null);
  }
  /* Hüllrechteck einer Ergebnismenge, mit etwas Luft */
  function boxUmPunkte(punkte, luft) {
    if (!punkte.length) return SCHWEIZ.box.slice();
    let n = -90, s = 90, o = -180, w = 180;
    for (const p of punkte) { n = Math.max(n, p.lat); s = Math.min(s, p.lat); o = Math.max(o, p.lng); w = Math.min(w, p.lng); }
    const dl = Math.max(0.01, (n - s) * (luft || .12)), dg = Math.max(0.01, (o - w) * (luft || .12));
    return [n + dl, s - dl, o + dg, w - dg];
  }

  return { GeoProvider, KANTONE, ORTE, REGIONEN, SCHWEIZ, kantonName, regionName, norm, km, inBox, boxUm, boxVereinen, boxUmPunkte };
})();
