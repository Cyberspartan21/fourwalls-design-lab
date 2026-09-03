/* ============================================================
   UFER — Suchvertrag und Suchadapter
   Eine Anfrage, eine Antwort, eine Semantik. Liste, Karte, Objektseite und
   Inseratsformular sind Oberflächen über derselben Schnittstelle.

   Der Vertrag ist so geschnitten, dass ihn später ein Server erfüllt
   (PostgreSQL mit PostGIS: Umkreis über ST_DWithin, Kartenausschnitt über
   ST_MakeEnvelope, Gemeinde und Kanton über Flächen). Die Oberfläche merkt
   den Wechsel nicht — sie kennt nur SearchProvider.

   ANFRAGE (SearchQuery)
     trans      "buy" | "rent"
     ort        { typ:"ort"|"plz"|"kanton"|"region", id, label }   Entität, keine Zeichenkette
     umkreisKm  0 … 50            nur mit Mittelpunkt sinnvoll
     bounds     { n, s, o, w }    Kartenausschnitt, schliesst Umkreis aus
     typ, pMin, pMax, ziMin, ziMax, flMin, flMax, grMin, bjVon, bjBis,
     etage, verf, feat[], quelle, nurFrei
     sort       "empfohlen"|"neu"|"preis-auf"|"preis-ab"|"m2"|"flaeche"|"zimmer"
     seite, proSeite
     modus      "list" | "map"    map liefert Punkte statt Seiten

   ANTWORT (SearchResult)
     treffer[]  schlanke Zusammenfassungen — nur was Liste und Karte brauchen
     total, seite, proSeite, hatMehr
     geo        { interpretation, mittelpunkt, umkreisKm, bounds, label }
     facetten   { typ:{}, quelle:{} }   optional
   ============================================================ */
window.FWSUCHE = (function () {
  const G = () => window.FWGEO;

  /* ---------- Anfrage: Grundgestalt und Normalisierung ---------- */
  const LEER = {
    trans:"buy", ort:null, umkreisKm:0, bounds:null,
    typ:"", pMin:null, pMax:null, ziMin:null, ziMax:null, flMin:null, flMax:null, grMin:null,
    bjVon:null, bjBis:null, etage:"", verf:"", feat:[], quelle:"", nurFrei:true,
    sort:"neu", seite:1, proSeite:24, modus:"list"
  };
  const anfrage = teil => Object.assign({}, LEER, teil || {}, { feat:(teil && teil.feat) || [] });

  /* ---------- Zusammenfassung: bewusst schlank ---------- */
  function zusammenfassung(l) {
    const g = l.geo || {};
    const a = g.anzeige || { lat:l.lat, lng:l.lng, genauigkeitM:2000 };
    /* Die Feldnamen bleiben die des Inserats — die Oberfläche muss nichts umlernen.
       Schlank ist die Auswahl, nicht die Benennung: kein Galerie-Array, keine Dokumente,
       kein Beschreibungstext, keine technischen Merkmalgruppen. */
    return {
      id:l.id, slug:l.slug, transactionType:l.transactionType, propertyType:l.propertyType, title:l.title,
      city:l.city, postalCode:l.postalCode, canton:l.canton,
      lat:a.lat, lng:a.lng, genauigkeitM:a.genauigkeitM, genauigkeit:g.genauigkeit || "gemeinde",
      price:l.price ?? null, priceOnRequest:!!l.priceOnRequest, rentNet:l.rentNet ?? null, rentNK:l.rentNK ?? null,
      rooms:l.rooms ?? null, livingArea:l.livingArea ?? null, plotArea:l.plotArea ?? null,
      img:l.img, listingSource:l.listingSource, listingTier:l.listingTier,
      verificationStatus:l.verificationStatus, availability:l.availability || { art:"vereinbarung", datum:null },
      neu:!!l.neu, fw:!!l.fw, floor:l.floor ?? null, yearBuilt:l.yearBuilt ?? null
    };
  }

  /* ---------- Der lokale Adapter: erfüllt den Vertrag im Prototyp ---------- */
  const LocalSearchProvider = {
    name:"local",
    beschreibung:"Statischer Prototyp-Adapter. Erfüllt denselben Vertrag wie ein späterer Serverdienst.",

    async search(q) {
      const t0 = (performance || Date).now();
      const Q = anfrage(q), geo = G(), P = window.FWP;
      let res = P.alle().filter(l => l.publicationStatus !== "archiviert" && l.transactionType === Q.trans);
      if (Q.nurFrei) res = res.filter(P.verfuegbarFrei);

      /* --- Geografie: Ausschnitt schlägt Umkreis schlägt Gebiet --- */
      let interpretation = "schweiz", mittelpunkt = null, label = null, box = null;
      if (Q.bounds) {
        const b = [Q.bounds.n, Q.bounds.s, Q.bounds.o, Q.bounds.w];
        res = res.filter(l => geo.inBox(l.lat, l.lng, b));
        interpretation = "ausschnitt"; box = b;
      } else if (Q.ort) {
        const p = Q.ort.id ? geo.GeoProvider.getPlace(Q.ort.id) : Q.ort;
        label = p ? p.label : (Q.ort.label || "");
        if (p && Q.umkreisKm > 0 && p.lat != null) {
          mittelpunkt = { lat:p.lat, lng:p.lng };
          res = res.filter(l => geo.km(p.lat, p.lng, l.lat, l.lng) <= Q.umkreisKm);
          interpretation = "umkreis"; box = geo.boxUm(p.lat, p.lng, Q.umkreisKm * 1.15);
        } else if (p && p.typ === "region") {
          res = res.filter(l => p.kantone.includes(l.canton));
          interpretation = "region"; box = p.box;
        } else if (p && p.typ === "kanton") {
          res = res.filter(l => l.canton === p.kt);
          interpretation = "kanton"; box = p.box;
        } else if (p && p.typ === "plz") {
          const plz = p.id.slice(4);
          res = res.filter(l => l.postalCode === plz);
          interpretation = "plz"; mittelpunkt = { lat:p.lat, lng:p.lng };
        } else if (p && p.typ === "ort") {
          const o = geo.GeoProvider.ort(p.id);
          res = res.filter(l => l.city === (o ? o.name : p.label));
          interpretation = "gemeinde"; mittelpunkt = { lat:p.lat, lng:p.lng };
        }
      }

      /* --- Sachfilter --- */
      if (Q.typ) res = res.filter(l => l.propertyType === Q.typ);
      if (Q.quelle) res = res.filter(l => l.listingSource === Q.quelle);
      const w = l => l.transactionType === "rent" ? l.rentNet : l.price;
      if (Q.pMin != null) res = res.filter(l => w(l) != null && w(l) >= Q.pMin);
      if (Q.pMax != null) res = res.filter(l => w(l) != null && w(l) <= Q.pMax);
      if (Q.ziMin != null) res = res.filter(l => l.rooms != null && l.rooms >= Q.ziMin);
      if (Q.ziMax != null) res = res.filter(l => l.rooms != null && l.rooms <= Q.ziMax);
      if (Q.flMin != null) res = res.filter(l => l.livingArea != null && l.livingArea >= Q.flMin);
      if (Q.flMax != null) res = res.filter(l => l.livingArea != null && l.livingArea <= Q.flMax);
      if (Q.grMin != null) res = res.filter(l => l.plotArea != null && l.plotArea >= Q.grMin);
      if (Q.bjVon != null) res = res.filter(l => l.yearBuilt != null && l.yearBuilt >= Q.bjVon);
      if (Q.bjBis != null) res = res.filter(l => l.yearBuilt != null && l.yearBuilt <= Q.bjBis);
      if (Q.etage) res = res.filter(l => { if (l.floor == null) return false;
        if (Q.etage === "eg") return l.floor === 0;
        if (Q.etage === "nichteg") return l.floor > 0;
        if (Q.etage === "ab2") return l.floor >= 2;
        if (Q.etage === "dach") return l.floor >= 6; return true; });
      if (Q.verf) res = res.filter(l => { const a = (l.availability || {}).art;
        if (Q.verf === "sofort") return a === "sofort";
        if (Q.verf === "3mt") { if (a === "sofort") return true; if (a !== "datum") return false;
          return (new Date(l.availability.datum) - new Date()) / 86400000 <= 92; }
        return true; });
      for (const f of Q.feat) res = res.filter(l => (l.features || []).includes(f));

      const total = res.length;
      const facetten = { typ:{}, quelle:{} };
      for (const l of res) { facetten.typ[l.propertyType] = (facetten.typ[l.propertyType] || 0) + 1;
        facetten.quelle[l.listingSource] = (facetten.quelle[l.listingSource] || 0) + 1; }

      res = P.sortieren(res, Q.sort);

      /* Kartenmodus liefert alle Punkte des Ergebnisses, aber nur die Punktfelder */
      if (Q.modus === "map") {
        const punkte = res.map(zusammenfassung);
        return { treffer:punkte, total, seite:1, proSeite:total, hatMehr:false,
          geo:{ interpretation, mittelpunkt, umkreisKm:Q.umkreisKm, bounds:box || (punkte.length ? geo.boxUmPunkte(punkte) : geo.SCHWEIZ.box), label },
          facetten, dauerMs:Math.round(((performance || Date).now() - t0) * 100) / 100, quelle:"local" };
      }

      const von = (Q.seite - 1) * Q.proSeite;
      const seite = res.slice(0, von + Q.proSeite).map(zusammenfassung);
      return {
        treffer:seite, total, seite:Q.seite, proSeite:Q.proSeite, hatMehr:total > seite.length,
        geo:{ interpretation, mittelpunkt, umkreisKm:Q.umkreisKm,
              bounds:box || (seite.length ? geo.boxUmPunkte(seite) : geo.SCHWEIZ.box), label },
        facetten, dauerMs:Math.round(((performance || Date).now() - t0) * 100) / 100, quelle:"local"
      };
    },

    /* Das vollständige Objekt — bewusst ein zweiter Aufruf, nicht Teil der Trefferliste */
    async getListing(idOderSlug) {
      const l = window.FWP.finde(idOderSlug) || window.FWP.alle().find(x => x.id === idOderSlug);
      return l || null;
    },

    /* Ähnliche Objekte gehören zur Suchdomäne, nicht zur Darstellung */
    async aehnliche(idOderSlug, n) {
      const l = await this.getListing(idOderSlug);
      return l ? window.FWP.aehnliche(l, n || 3).map(zusammenfassung) : [];
    }
  };

  /* Austauschpunkt: hier hängt später der ServerSearchProvider */
  let aktiv = LocalSearchProvider;
  const SearchProvider = {
    get name() { return aktiv.name; },
    setzeAdapter(a) { aktiv = a; },
    search: q => aktiv.search(q),
    getListing: id => aktiv.getListing(id),
    aehnliche: (id, n) => aktiv.aehnliche(id, n)
  };

  return { SearchProvider, LocalSearchProvider, anfrage, zusammenfassung, LEER };
})();
