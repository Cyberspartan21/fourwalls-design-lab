/* UFER — gemeinsames Verhalten aller Seiten: Navigation, Erscheinung, Sprache, Blenden.
   Braucht core.js (window.FWP) davor. */
window.UFER = (function () {
  const $ = id => document.getElementById(id);
  const T = {
    de: { immobilien:"Immobilien", verkaufen:"Verkaufen", verwalten:"Verwalten", wissen:"Wissen", konto:"Konto",
      kaufen:"Kaufen", mieten:"Mieten", karte:"Karte", exclusive:"Fourwalls Exclusive", neubau:"Neubauprojekte", suchabo:"Suchabo",
      bewertung:"Kostenlose Bewertung", mitFW:"Mit Fourwalls verkaufen", selbst:"Gratis selbst inserieren", vermieten:"Vermieten",
      bewirtschaftung:"Bewirtschaftung", report:"Eigentümer-Report", erstvermietung:"Erstvermietung", offerte:"Offerte anfordern",
      ratgeber:"Ratgeber", tragbarkeit:"Tragbarkeit berechnen", nebenkosten:"Kaufnebenkosten", markt:"Marktbericht",
      gemerkt:"Gemerkt", inserieren:"Gratis inserieren", menue:"Menü", schliessen:"Schliessen", tag:"Tag", nacht:"Nacht",
      suchen:"Suchen", ortPh:"Ort, PLZ, Kanton oder Region", alle:"Alle Inserate",
      wegSuchen:"Immobilien suchen", wegSuchenS:"Kaufen und mieten, schweizweit", wegInser:"Gratis inserieren", wegInserS:"Selbst verkaufen oder vermieten",
      wegVerk:"Mit Fourwalls verkaufen", wegVerkS:"Mandat · kostenlose Bewertung", wegVerw:"Immobilien verwalten", wegVerwS:"Bewirtschaftung für Eigentümer" },
    fr: { immobilien:"Immobilier", verkaufen:"Vendre", verwalten:"Gérance", wissen:"Savoir", konto:"Compte",
      kaufen:"Acheter", mieten:"Louer", karte:"Carte", exclusive:"Fourwalls Exclusive", neubau:"Projets neufs", suchabo:"Alerte de recherche",
      bewertung:"Estimation gratuite", mitFW:"Vendre avec Fourwalls", selbst:"Publier moi-même, gratuit", vermieten:"Mettre en location",
      bewirtschaftung:"Gérance d'immeubles", report:"Rapport propriétaire", erstvermietung:"Première location", offerte:"Demander une offre",
      ratgeber:"Guides", tragbarkeit:"Calculer la capacité financière", nebenkosten:"Frais d'acquisition", markt:"Rapport de marché",
      gemerkt:"Favoris", inserieren:"Publier gratuitement", menue:"Menu", schliessen:"Fermer", tag:"Jour", nacht:"Nuit",
      suchen:"Rechercher", ortPh:"Lieu, NPA, canton ou région", alle:"Toutes les annonces",
      wegSuchen:"Chercher un bien", wegSuchenS:"Acheter et louer, dans toute la Suisse", wegInser:"Publier gratuitement", wegInserS:"Vendre ou louer soi-même",
      wegVerk:"Vendre avec Fourwalls", wegVerkS:"Mandat · estimation gratuite", wegVerw:"Gérer un immeuble", wegVerwS:"Gérance pour propriétaires" },
    it: { immobilien:"Immobili", verkaufen:"Vendere", verwalten:"Amministrazione", wissen:"Sapere", konto:"Conto",
      kaufen:"Comprare", mieten:"Affittare", karte:"Mappa", exclusive:"Fourwalls Exclusive", neubau:"Nuove costruzioni", suchabo:"Avviso di ricerca",
      bewertung:"Valutazione gratuita", mitFW:"Vendere con Fourwalls", selbst:"Pubblicare da soli, gratis", vermieten:"Affittare",
      bewirtschaftung:"Amministrazione stabili", report:"Rapporto proprietari", erstvermietung:"Prima locazione", offerte:"Richiedere un'offerta",
      ratgeber:"Guide", tragbarkeit:"Calcolare la sostenibilità", nebenkosten:"Spese accessorie d'acquisto", markt:"Rapporto di mercato",
      gemerkt:"Preferiti", inserieren:"Pubblica gratis", menue:"Menu", schliessen:"Chiudi", tag:"Giorno", nacht:"Notte",
      suchen:"Cerca", ortPh:"Località, NPA, cantone o regione", alle:"Tutti gli annunci",
      wegSuchen:"Cercare immobili", wegSuchenS:"Comprare e affittare in tutta la Svizzera", wegInser:"Pubblicare gratis", wegInserS:"Vendere o affittare da soli",
      wegVerk:"Vendere con Fourwalls", wegVerkS:"Mandato · valutazione gratuita", wegVerw:"Amministrare immobili", wegVerwS:"Amministrazione per proprietari" },
    en: { immobilien:"Properties", verkaufen:"Sell", verwalten:"Manage", wissen:"Knowledge", konto:"Account",
      kaufen:"Buy", mieten:"Rent", karte:"Map", exclusive:"Fourwalls Exclusive", neubau:"New developments", suchabo:"Search alert",
      bewertung:"Free valuation", mitFW:"Sell with Fourwalls", selbst:"List it yourself, free", vermieten:"Let",
      bewirtschaftung:"Property management", report:"Owner report", erstvermietung:"First letting", offerte:"Request a quote",
      ratgeber:"Guides", tragbarkeit:"Affordability calculator", nebenkosten:"Purchase costs", markt:"Market report",
      gemerkt:"Saved", inserieren:"List for free", menue:"Menu", schliessen:"Close", tag:"Day", nacht:"Night",
      suchen:"Search", ortPh:"Place, postcode, canton or region", alle:"All listings",
      wegSuchen:"Search properties", wegSuchenS:"Buy and rent, across Switzerland", wegInser:"List for free", wegInserS:"Sell or let it yourself",
      wegVerk:"Sell with Fourwalls", wegVerkS:"Mandate · free valuation", wegVerw:"Manage property", wegVerwS:"Management for owners" }
  };
  const u = k => (T[FWP.lang] && T[FWP.lang][k]) || T.de[k] || k;

  /* Informationsarchitektur: vier Gruppen, alles Weitere darunter (sichtbar, aber nicht gleichrangig) */
  const NAV = [
    { key:"immobilien", href:"portal.html", items:[
      ["kaufen","portal.html","sSuche","nKaufen"],
      ["mieten","portal.html?trans=rent","sSuche","nMieten"],
      ["karte","portal.html#karte","","nKarte"],
      ["exclusive","portal.html?quelle=fourwalls","sMandate","nExclusive"],
      ["neubau","portal.html?quelle=entwickler","","nNeubau"],
      ["suchabo","portal.html#konto","","nSuchabo"]] },
    { key:"verkaufen", href:"verkaufen.html", items:[
      ["bewertung","verkaufen.html#bewertung","sKostenlos","nBewertung"],
      ["mitFW","verkaufen.html","sMandat","nMitFW"],
      ["selbst","portal.html#neu","sKostenlos","nSelbst"],
      ["vermieten","verwalten.html#erstvermietung","","nVermieten"]] },
    { key:"verwalten", href:"verwalten.html", items:[
      ["bewirtschaftung","verwalten.html","","nBewirt"],
      ["report","verwalten.html#report","","nReport"],
      ["erstvermietung","verwalten.html#erstvermietung","","nErst"],
      ["offerte","verwalten.html#offerte","","nOfferte"]] },
    { key:"wissen", href:"wissen.html", items:[
      ["ratgeber","wissen.html","","nRatgeber"],
      ["tragbarkeit","wissen.html#tragbarkeit","sRechner","nTragbar"],
      ["nebenkosten","wissen.html#nebenkosten","sRechner","nNeben"],
      ["markt","wissen.html#markt","","nMarkt"]] }
  ];
  /* Eine Zeile je Eintrag — sie unterscheidet die Reisen: suchen, verkaufen lassen,
     selbst inserieren, bewerten, verwalten lassen. */
  const BESCHR = {
    nKaufen:{de:"Eigentum in der ganzen Schweiz",fr:"Propriétés dans toute la Suisse",it:"Proprietà in tutta la Svizzera",en:"Property across Switzerland"},
    nMieten:{de:"Wohnungen und Häuser zur Miete",fr:"Appartements et maisons à louer",it:"Appartamenti e case in affitto",en:"Homes to rent"},
    nKarte:{de:"Suchen, wo Sie wohnen wollen",fr:"Chercher là où vous voulez vivre",it:"Cercare dove volete vivere",en:"Search where you want to live"},
    nExclusive:{de:"Objekte, die wir selbst vertreten",fr:"Biens que nous représentons",it:"Oggetti che rappresentiamo noi",en:"Properties we represent ourselves"},
    nNeubau:{de:"Projekte von Bauträgern",fr:"Projets de promoteurs",it:"Progetti di costruttori",en:"Developer projects"},
    nSuchabo:{de:"Neue Treffer zuerst sehen",fr:"Voir les nouveautés en premier",it:"Vedere prima le novità",en:"See new matches first"},
    nBewertung:{de:"Was ist mein Objekt wert?",fr:"Quelle est la valeur de mon bien ?",it:"Quanto vale il mio immobile?",en:"What is my property worth?"},
    nMitFW:{de:"Wir übernehmen den ganzen Verkauf",fr:"Nous gérons toute la vente",it:"Gestiamo l'intera vendita",en:"We handle the entire sale"},
    nSelbst:{de:"Sie inserieren und betreuen selbst",fr:"Vous publiez et gérez vous-même",it:"Pubblicate e gestite voi stessi",en:"You publish and manage it yourself"},
    nVermieten:{de:"Mieterschaft finden und prüfen",fr:"Trouver et vérifier les locataires",it:"Trovare e verificare gli inquilini",en:"Find and vet tenants"},
    nBewirt:{de:"Laufende Betreuung Ihrer Liegenschaft",fr:"Gestion courante de votre immeuble",it:"Gestione corrente del vostro stabile",en:"Ongoing care for your property"},
    nReport:{de:"Ihr Haus in einer Seite, monatlich",fr:"Votre bien en une page, chaque mois",it:"Il vostro immobile in una pagina, ogni mese",en:"Your property on one page, monthly"},
    nErst:{de:"Erstvermietung mit Marktmiete",fr:"Première location au prix du marché",it:"Prima locazione a prezzo di mercato",en:"First letting at market rent"},
    nOfferte:{de:"Schriftlich, mit Leistungsumfang",fr:"Par écrit, avec le détail",it:"Per iscritto, con i dettagli",en:"In writing, with full scope"},
    nRatgeber:{de:"Kurz, geprüft, ohne Verkaufsdruck",fr:"Bref, vérifié, sans pression",it:"Breve, verificato, senza pressione",en:"Short, checked, no sales pressure"},
    nTragbar:{de:"Was darf mein Objekt kosten?",fr:"Quel prix puis-je me permettre ?",it:"Quanto posso permettermi?",en:"What can I afford?"},
    nNeben:{de:"Was neben dem Preis anfällt",fr:"Ce qui s'ajoute au prix",it:"Cosa si aggiunge al prezzo",en:"What comes on top of the price"},
    nMarkt:{de:"Preise und Tempo nach Region",fr:"Prix et rythme par région",it:"Prezzi e ritmo per regione",en:"Prices and pace by region"}
  };
  const beschr = k => k ? ((BESCHR[k] && (BESCHR[k][FWP.lang] || BESCHR[k].de)) || "") : "";

  const SUB = { sSuche:{de:"Suche",fr:"Recherche",it:"Ricerca",en:"Search"}, sMandate:{de:"Mandate",fr:"Mandats",it:"Mandati",en:"Mandates"}, sMandat:{de:"Mandat",fr:"Mandat",it:"Mandato",en:"Mandate"}, sKostenlos:{de:"kostenlos",fr:"gratuit",it:"gratis",en:"free"}, sRechner:{de:"Rechner",fr:"Calculateur",it:"Calcolatore",en:"Calculator"} };
  const sub = k => k ? (SUB[k] && (SUB[k][FWP.lang] || SUB[k].de)) || k : "";

  function kopfHTML(aktuell, opt) {
    opt = opt || {};
    const esc = FWP.esc;
    const nav = NAV.map(g => `<div><a href="${g.href}" data-grp="${g.key}" aria-haspopup="true" aria-expanded="false" ${aktuell===g.key?'aria-current="true"':''}>${esc(u(g.key))}</a>
      <div class="tafel" id="tafel-${g.key}"><div class="tk">${esc(u(g.key))}</div>${g.items.map(([k,h,s,b]) => `<a href="${h}"><span class="wa"><b>${esc(u(k))}</b>${b?`<em>${esc(beschr(b))}</em>`:""}</span>${s?`<small>${esc(sub(s))}</small>`:""}</a>`).join("")}</div></div>`).join("");
    return `<a href="index.html" class="fw" aria-label="Fourwalls"><i class="k"></i><i class="s"></i></a>
      <nav class="haupt" aria-label="Hauptnavigation">${nav}</nav>
      <div class="rechts">
        <div class="sprache" role="group" aria-label="Sprache">${["de","fr","it","en"].map(l => `<button data-l="${l}" aria-pressed="${FWP.lang===l}">${l.toUpperCase()}</button>`).join("")}</div>
        <a class="knopf" href="portal.html#konto"><span data-u="gemerkt">${esc(u("gemerkt"))}</span> <span class="zaehl" id="favZahl">${FWP.favs.alle().length}</span></a>
        <a class="knopf voll" href="portal.html#neu" data-u="inserieren">${esc(u("inserieren"))}</a>
        <div class="gt" role="group" aria-label="Erscheinung"><button id="gtHell" aria-pressed="false" title="${esc(u("tag"))}">T</button><button id="gtDunkel" aria-pressed="true" title="${esc(u("nacht"))}">N</button></div>
        <button class="burger" id="burger" aria-label="${esc(u("menue"))}" aria-expanded="false"><i></i></button>
      </div>`;
  }
  function blattHTML() {
    const esc = FWP.esc;
    return `<div class="bk"><span class="fw"><i class="k"></i><i class="s"></i></span><button class="knopf" id="blattZu">${esc(u("schliessen"))} ×</button></div>
      ${NAV.map(g => `<div class="gruppe"><div class="tk">${esc(u(g.key))}</div>${g.items.map(([k,h,s,b]) => `<a href="${h}"><span class="wa"><b>${esc(u(k))}</b>${b?`<em>${esc(beschr(b))}</em>`:""}</span>${s?`<small>${esc(sub(s))}</small>`:""}</a>`).join("")}</div>`).join("")}
      <div class="unten"><a class="knopf voll" href="portal.html#neu">${esc(u("inserieren"))}</a><a class="knopf" href="portal.html#konto">${esc(u("gemerkt"))}</a>
      <div class="sprache" style="display:flex;margin-left:auto">${["de","fr","it","en"].map(l => `<button data-l="${l}" aria-pressed="${FWP.lang===l}">${l.toUpperCase()}</button>`).join("")}</div></div>`;
  }
  function wegeHTML() {
    const esc = FWP.esc;
    return `<a href="portal.html"><b>${esc(u("wegSuchen"))}</b><span>${esc(u("wegSuchenS"))}</span></a>
      <a href="portal.html#neu"><b>${esc(u("wegInser"))}</b><span>${esc(u("wegInserS"))}</span></a>
      <a href="verkaufen.html" class="warm"><b>${esc(u("wegVerk"))}</b><span>${esc(u("wegVerkS"))}</span></a>
      <a href="verwalten.html"><b>${esc(u("wegVerw"))}</b><span>${esc(u("wegVerwS"))}</span></a>`;
  }
  function fussHTML(seite) {
    const esc = FWP.esc;
    const co = window.FWCO || {};
    return `<span class="fw band" aria-label="Fourwalls"><i class="k"></i><i class="s"></i></span>
      <div class="spalten">
        <div><b>${esc(u("immobilien"))}</b><a href="portal.html">${esc(u("kaufen"))}</a><a href="portal.html?trans=rent">${esc(u("mieten"))}</a><a href="portal.html?quelle=fourwalls">${esc(u("exclusive"))}</a><a href="portal.html#konto">${esc(u("suchabo"))}</a></div>
        <div><b>${esc(u("verkaufen"))}</b><a href="verkaufen.html#bewertung">${esc(u("bewertung"))}</a><a href="verkaufen.html">${esc(u("mitFW"))}</a><a href="portal.html#neu">${esc(u("selbst"))}</a></div>
        <div><b>${esc(u("verwalten"))} · ${esc(u("wissen"))}</b><a href="verwalten.html">${esc(u("bewirtschaftung"))}</a><a href="verwalten.html#report">${esc(u("report"))}</a><a href="wissen.html">${esc(u("ratgeber"))}</a><a href="wissen.html#tragbarkeit">${esc(u("tragbarkeit"))}</a></div>
        <div><b>${esc(co.name || "Fourwalls AG")}</b><span>${esc(co.strasse || "")} · ${esc(co.plzOrt || "")}</span><span>${esc(co.telefon || "")}</span><span>${esc(co.email || "")}</span><span>${esc((co.staedte || []).join(" · "))}</span></div>
      </div>
      <div class="fein"><span>${esc(seite||"")} · Prototyp mit fiktiven Objekt- und Firmendaten · © 2026 Fourwalls</span><span>Kontaktangaben sind Platzhalter</span></div>`;
  }

  /* ---------- Erscheinung: Tag / Nacht ---------- */
  const hooks = { modus:[] };
  function setzModus(m, merken) {
    document.body.dataset.mode = m;
    const bH = $("gtHell"), bD = $("gtDunkel");
    if (bH) { bH.setAttribute("aria-pressed", m === "hell"); bD.setAttribute("aria-pressed", m === "dunkel"); }
    if (merken) { try { localStorage.setItem("fw-ufer", m); } catch (e) {} }
    hooks.modus.forEach(f => f(m));
  }
  function startModus() {
    let start = "hell";
    const qm = new URLSearchParams(location.search).get("mode"), h0 = (location.hash || "").replace("#", "");
    if (qm === "hell" || qm === "dunkel") start = qm;
    else if (h0 === "hell" || h0 === "dunkel") start = h0;
    else { try { const v = localStorage.getItem("fw-ufer"); if (v) start = v; } catch (e) {} }
    setzModus(start, false);
    window.addEventListener("hashchange", () => { const x = (location.hash || "").replace("#", ""); if (x === "hell" || x === "dunkel") setzModus(x, true); });
  }

  /* ---------- Montage ---------- */
  function montiere(opt) {
    opt = opt || {};
    const kopf = document.querySelector(".kopf"), blatt = $("blatt"), wege = document.querySelector(".wege[data-auto]"), fuss = document.querySelector(".fuss");
    if (kopf) kopf.innerHTML = kopfHTML(opt.aktuell, opt);
    if (blatt) blatt.innerHTML = blattHTML();
    if (wege) wege.innerHTML = wegeHTML();
    if (fuss) fuss.innerHTML = fussHTML(opt.seite);
    // Sprache
    document.querySelectorAll(".sprache button").forEach(b => b.addEventListener("click", () => { FWP.sprache(b.dataset.l); montiere(opt); if (opt.onLang) opt.onLang(); }));
    // Erscheinung
    $("gtHell").addEventListener("click", () => setzModus("hell", true));
    $("gtDunkel").addEventListener("click", () => setzModus("dunkel", true));
    const m = document.body.dataset.mode || "dunkel"; $("gtHell").setAttribute("aria-pressed", m === "hell"); $("gtDunkel").setAttribute("aria-pressed", m === "dunkel");
    // Tafeln (Untermenüs): Hover mit Verzögerung, Klick/Tastatur, Escape
    const tafeln = [...kopf.querySelectorAll("nav.haupt > div")];
    let timer;
    const zu = () => tafeln.forEach(d => { d.querySelector(".tafel").classList.remove("an"); d.querySelector("a").setAttribute("aria-expanded", "false"); });
    tafeln.forEach(d => {
      const a = d.querySelector(":scope > a"), tf = d.querySelector(".tafel");
      const auf = () => { zu(); tf.classList.add("an"); a.setAttribute("aria-expanded", "true"); };
      d.addEventListener("mouseenter", () => { clearTimeout(timer); timer = setTimeout(auf, 120); });
      d.addEventListener("mouseleave", () => { clearTimeout(timer); timer = setTimeout(zu, 220); });
      a.addEventListener("click", e => { if (matchMedia("(hover:none)").matches || e.altKey) { e.preventDefault(); tf.classList.contains("an") ? zu() : auf(); } });
      a.addEventListener("keydown", e => { if (e.key === "ArrowDown" || e.key === " ") { e.preventDefault(); auf(); tf.querySelector("a").focus(); } });
      d.addEventListener("focusout", e => { if (!d.contains(e.relatedTarget)) zu(); });
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") { zu(); if (blatt && blatt.classList.contains("an")) blattZu(); } });
    // Mobiles Blatt
    function blattZu() { blatt.classList.remove("an"); $("burger").setAttribute("aria-expanded", "false"); document.body.style.overflow = ""; $("burger").focus(); }
    if (blatt) {
      $("burger").addEventListener("click", () => { blatt.classList.add("an"); $("burger").setAttribute("aria-expanded", "true"); document.body.style.overflow = "hidden"; $("blattZu").focus(); });
      $("blattZu").addEventListener("click", blattZu);
    }
    // Schwebender Kopf über dem Hero
    if (kopf.classList.contains("schwebt")) {
      const held = document.querySelector("[data-held]");
      const io = new IntersectionObserver(es => es.forEach(e => kopf.classList.toggle("gescrollt", !e.isIntersecting)), { rootMargin:"-64px 0px 0px 0px", threshold:0 });
      if (held) io.observe(held); else kopf.classList.add("gescrollt");
    }
    // Blenden
    blenden();
    // QA: ?nur=<selector>
    const nur = new URLSearchParams(location.search).get("nur");
    if (nur) document.querySelectorAll("main > section, .fuss").forEach(s => { if (!s.matches(nur)) s.style.display = "none"; });
  }
  function blenden(wurzel) {
    const els = (wurzel || document).querySelectorAll(".auf:not(.in),.blende:not(.in),.blende-v:not(.in),.bild-hinter:not(.in)");
    if (new URLSearchParams(location.search).get("intro") === "0" || matchMedia("(prefers-reduced-motion:reduce)").matches) { els.forEach(e => e.classList.add("in")); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold:.14, rootMargin:"0px 0px -4% 0px" });
    els.forEach(e => io.observe(e));
  }
  function favZahl() { const z = $("favZahl"); if (z) z.textContent = FWP.favs.alle().length; }

  return { T, u, NAV, montiere, blenden, setzModus, startModus, hooks, favZahl, kopfHTML, wegeHTML, fussHTML };
})();
