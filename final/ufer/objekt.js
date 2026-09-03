/* ============================================================
   UFER — Objektseite
   Übersicht zuerst, Tiefe auf Abruf. Eine Architektur, drei Tiefenstufen:
   privat · agentur · exclusive. Blöcke ohne Inhalt entstehen gar nicht.
   Braucht: core.js (FWP), detail-data.js (FWD), objekt.css
   ============================================================ */
window.UOBJ = (function () {
  const $ = id => document.getElementById(id);
  const { esc, t } = FWP;
  const FWD = () => window.FWD || {};
  let K = {};                       // Kontext aus portal.html
  let L = null, D = null, istEx = false, bilder = [], stationen = [];

  const HERZ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 20s-7-4.6-9.2-8.8C1.2 8 3 5 6.2 5c2 0 3.3 1 4.3 2.4h3c1-1.4 2.3-2.4 4.3-2.4 3.2 0 5 3 3.4 6.2C19 15.4 12 20 12 20Z"/></svg>';
  const fmt = n => n == null ? "" : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "’");
  const chf = n => "CHF " + fmt(n);

  const KAT = { alle:"Alle", aussen:"Aussen", wohnen:"Wohnen", kueche:"Küche", schlafen:"Schlafen", bad:"Bad", lage:"Lage", plan:"Grundriss" };
  const ZUG = { oeffentlich:["Herunterladen","frei"], konto:["Mit Konto",""], anfrage:["Nach Anfrage",""], besichtigung:["Nach Besichtigung",""], gesperrt:["Nach Einigung",""] };
  const ZUG_TEXT = "Was hier «Nach Anfrage» oder «Nach Besichtigung» heisst, ist nicht öffentlich abrufbar — auch nicht über Umwege. Wir schalten es frei, sobald der jeweilige Schritt getan ist.";

  /* ---------- Finanzlogik: Bankenpraxis, transparent gerechnet ---------- */
  function finanz(preis, ekAnteil, zins) {
    const ek = preis * ekAnteil, hyp = preis - ek, hyp2 = Math.max(0, hyp - preis * .65);
    const zinsM = hyp * zins / 12, amortM = hyp2 / 15 / 12, unterhM = preis * .01 / 12;
    const kalk = hyp * .05 / 12 + amortM + unterhM;
    const r = n => Math.round(n / 10) * 10;
    return { ek:r(ek), hyp:r(hyp), belehnung:Math.round(hyp / preis * 100), zinsM:r(zinsM), amortM:r(amortM), unterhM:r(unterhM),
      total:r(zinsM + amortM + unterhM), einkommen:r(kalk * 12 / .33) };
  }

  /* ---------- Bausteine ---------- */
  function abschnitt(id, titel, inhalt, klein) {
    if (!inhalt) return "";
    stationen.push([id, titel]);
    return `<section class="dabs" id="d-${id}"><h2>${esc(titel)}${klein ? `<small>${esc(klein)}</small>` : ""}</h2>${inhalt}</section>`;
  }
  function gruppe(titel, obj, labels) {
    if (!obj) return "";
    const zeilen = Object.entries(obj).filter(([k, v]) => v !== null && v !== undefined && v !== "" && v !== false && k !== "geakKlasse");
    if (!zeilen.length) return "";
    return `<div class="gruppe"><h3>${esc(titel)}</h3><dl>${zeilen.map(([k, v]) =>
      `<dt>${esc(labels[k] || k)}</dt><dd>${v === true ? "Ja" : esc(String(v))}</dd>`).join("")}</dl></div>`;
  }
  const LG = { bauweise:"Bauweise", dach:"Dach", fenster:"Fenster", zustand:"Zustand", ausrichtung:"Ausrichtung", volumen:"Volumen", qualitaet:"Qualität" };
  const LA = { kueche:"Küche", baeder:"Bäder", boeden:"Böden", geraete:"Geräte", waschen:"Waschen", cheminee:"Cheminée", lift:"Lift", smarthome:"Smart Home", stauraum:"Stauraum" };
  const LE = { heizung:"Heizung", energietraeger:"Energieträger", verteilung:"Wärmeverteilung", photovoltaik:"Photovoltaik", geak:"GEAK", minergie:"Minergie" };
  const LO = { balkon:"Balkon", terrasse:"Terrasse", garten:"Garten", pool:"Pool", aussicht:"Aussicht", privatsphaere:"Privatsphäre" };
  const LP = { garage:"Garage", tiefgarage:"Tiefgarage", aussenplaetze:"Aussenplätze", ladestation:"Ladestation" };

  /* ---------- Öffnen ---------- */
  function oeffne(slug, exclusive) {
    L = FWP.finde(slug);
    if (!L) { location.hash = "suche"; return; }
    D = FWD()[slug] || null;
    istEx = !!(exclusive || (L.listingTier === "exclusive" && L.fw));
    stationen = [];

    const med = (D && D.medien) || {};
    bilder = med.bilder ? med.bilder.map(b => typeof b === "string" ? { key:b, text:"", kat:"wohnen" } : b)
                        : (L.bilder || [L.img]).map(k => ({ key:k, text:"", kat:"wohnen" }));
    const quelle = (D && D.quelle) || { art:L.listingSource === "fourwalls" ? "fourwalls" : L.listingSource, name:L.publisher, verifiziert:L.verificationStatus === "verified" };
    const wirVertreten = quelle.art === "fourwalls";
    const fx = (D && D.fakten) || {};
    const kauf = L.transactionType === "buy" && !L.priceOnRequest && L.price;
    const m2 = FWP.proM2(L);
    const monat = kauf ? finanz(L.price, .2, .019) : null;
    const fav = FWP.favs.hat(L.id);

    /* --- Held --- */
    const held = istEx ? `
      <div class="dheld premiere" id="premiere">
        <div class="voll">${FWP.pic(bilder[0].key, { alt:bilder[0].text || L.title, sizes:"100vw", eager:true })}</div>
        <div class="flor"></div>
        <div class="wand" id="exWand"><div class="fenster" id="exFenster"><div class="medien" style="background-image:url(../img/${esc(bilder[0].key)}-960.jpg)"></div><div class="lichtzug"></div></div></div>
        <div class="txt">
          <div class="kick">${t("exclusive")} · ${esc(L.postalCode + " " + L.city)}</div>
          <h1>${esc(L.title)}</h1>
          ${L.tagline ? `<p class="tag">${esc(L.tagline)}</p>` : ""}
        </div>
      </div>`
      : `<div class="dheld">
        <div class="mosaik ${bilder.length === 1 ? "einzel" : bilder.length === 2 ? "zwei" : ""}">
          ${bilder.slice(0, 3).map((b, i) => `<figure data-li="${i}">${FWP.pic(b.key, { alt:b.text || (L.title + " " + (i + 1)), sizes:"(max-width:960px) 100vw, 60vw", eager:i === 0 })}</figure>`).join("")}
        </div>
        <div class="medienleiste">
          <button data-li="0"><b>${bilder.length}</b> Bilder</button>
          ${med.video ? `<button data-medium="video">Video</button>` : ""}
          ${med.tour360 ? `<button data-medium="360">360°</button>` : ""}
          ${(D && D.grundrisse && D.grundrisse.length) ? `<button data-anker="grundrisse">Grundrisse</button>` : ""}
        </div>
        ${quelle.verifiziert && !wirVertreten ? `<span class="quellband">Geprüftes Inserat</span>` : ""}
      </div>`;

    /* --- Titelzeile: Preis und Eckdaten ohne Scrollen --- */
    const eck = [
      (fx.zimmer ?? L.rooms) ? [fx.zimmer ?? L.rooms, "Zimmer"] : null,
      (fx.wohnflaeche ?? L.livingArea) ? [(fx.wohnflaeche ?? L.livingArea) + " m²", "Wohnfläche"] : null,
      (fx.grundstueck ?? L.plotArea) ? [(fx.grundstueck ?? L.plotArea) + " m²", "Grundstück"] : null,
      (fx.baujahr ?? L.yearBuilt) ? [fx.baujahr ?? L.yearBuilt, "Baujahr"] : null,
      fx.verfuegbar ? [fx.verfuegbar, "Verfügbar"] : null
    ].filter(Boolean);
    const titelzeile = `
      <div class="dtitel${istEx ? " kompakt" : ""}">
        ${istEx ? "" : `<div class="kick">${esc(FWL.typen[L.propertyType])} · ${esc(L.postalCode + " " + L.city)}</div>`}
        <div class="oben">
          <div>
            ${istEx ? "" : `<h1>${esc(L.title)}</h1>`}
            <div class="ort">${esc(L.city)} · ${esc(FWP.KANTON_NAME[L.canton] || L.canton)} · Genaue Adresse nach Kontakt</div>
          </div>
          <div class="preisblock">
            <div class="preis">${esc(FWP.preis(L))}</div>
            ${L.transactionType === "rent" ? `<div class="prosub">+ CHF ${L.rentNK} Nebenkosten</div>` : m2 ? `<div class="prosub">${fmt(m2)} ${t("proM2")}</div>` : ""}
            ${monat ? `<div class="monat">ab ${chf(monat.total)} / Monat<br><a href="#d-finanzierung" data-anker="finanzierung">Tragbarkeit rechnen</a></div>` : ""}
          </div>
        </div>
        <div class="eck">
          ${eck.map(([w, l]) => `<div><b>${esc(String(w))}</b> <span>${l}</span></div>`).join("")}
          <span class="quelle ${istEx ? "exkl" : ""}">${istEx ? t("exclusive") : esc(FWP.quelleLabel(L))}</span>
        </div>
      </div>`;

    /* --- Abschnitte --- */
    const story = D && D.story;
    const text = story ? story.absaetze.map(p => `<p>${esc(p)}</p>`).join("") : `<p>${esc(L.text || L.beschreibung || "")}</p>`;
    const lang = (story ? story.absaetze.join(" ") : (L.text || "")).length > 420;
    const hl = ((D && D.highlights) || L.highlights || []).slice(0, 6);
    const bUebersicht = `
      ${hl.length ? `<ul class="hl">${hl.map(h => `<li>${esc(h)}</li>`).join("")}</ul>` : ""}
      ${story ? `<h3 style="font-family:var(--d);font-weight:300;font-size:1.25rem;margin-bottom:10px">${esc(story.titel)}</h3>` : ""}
      <div class="dtext ${lang ? "kurz" : ""}" id="dText">${text}</div>
      ${lang ? `<button class="mehrtext" id="mehrText">Ganze Beschreibung</button>` : ""}`;

    const kats = ["alle", ...[...new Set(bilder.map(b => b.kat).filter(Boolean))]];
    const bMedien = bilder.length > 3 || med.video || med.tour360 ? `
      ${kats.length > 2 ? `<div class="katfilter" role="group" aria-label="Bildkategorien">${kats.map((k, i) => `<button data-kat="${k}" aria-pressed="${i === 0}">${esc(KAT[k] || k)}</button>`).join("")}</div>` : ""}
      <div class="gal" id="galGitter"></div>
      <div class="medienknoepfe">
        <button class="knopf" id="alleBilder">Alle ${bilder.length} Bilder</button>
        ${med.video ? `<button class="knopf" data-medium="video">${esc(med.video.titel || "Video")}${med.video.dauer ? " · " + esc(med.video.dauer) : ""}</button>` : ""}
        ${med.tour360 ? `<button class="knopf" data-medium="360">${esc(med.tour360.titel || "360°-Rundgang")}</button>` : ""}
        ${med.modell3d ? `<button class="knopf" data-medium="3d">${esc(med.modell3d.titel || "3D-Modell")}</button>` : ""}
      </div>` : "";

    const fakten = [
      ["Preis", FWP.preis(L)],
      (fx.zimmer ?? L.rooms) ? ["Zimmer", fx.zimmer ?? L.rooms] : null,
      (fx.wohnflaeche ?? L.livingArea) ? ["Wohnfläche", (fx.wohnflaeche ?? L.livingArea) + " m²"] : null,
      fx.nutzflaeche ? ["Nutzfläche", fx.nutzflaeche + " m²"] : null,
      (fx.grundstueck ?? L.plotArea) ? ["Grundstück", (fx.grundstueck ?? L.plotArea) + " m²"] : null,
      fx.schlafzimmer ? ["Schlafzimmer", fx.schlafzimmer] : null,
      fx.badezimmer ? ["Badezimmer", fx.badezimmer] : null,
      (fx.baujahr ?? L.yearBuilt) ? ["Baujahr", fx.baujahr ?? L.yearBuilt] : null,
      fx.renovation ? ["Renovation", fx.renovation] : null,
      fx.geschosse ? ["Geschosse", fx.geschosse] : null,
      fx.raumhoehe ? ["Raumhöhe", fx.raumhoehe + " m"] : null,
      fx.kubatur ? ["Kubatur", fmt(fx.kubatur) + " m³"] : null,
      (L.floor != null && !fx.geschosse) ? ["Etage", L.floor === 0 ? "EG" : L.floor + ". OG"] : null,
      m2 ? [t("proM2"), fmt(m2)] : null,
      fx.verfuegbar ? ["Verfügbar", fx.verfuegbar] : null,
      ["Referenz", L.id]
    ].filter(Boolean);
    const gr2 = D ? [gruppe("Gebäude", D.gebaeude, LG), gruppe("Ausstattung", D.ausstattung, LA), gruppe("Aussen", D.aussen, LO), gruppe("Parkieren", D.parkieren, LP), gruppe("Energie", D.energie, LE)].filter(Boolean) : [];
    const bEck = `
      <dl class="fakten">${fakten.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(String(v))}</dd></div>`).join("")}</dl>
      ${gr2.length ? `<div class="gruppen">${gr2.join("")}</div>` : ""}
      ${(D && D.energie && D.energie.geakKlasse) ? `<div class="geak"><b>${esc(D.energie.geakKlasse)}</b><span>GEAK-Klasse — Gebäudehülle und Gesamtenergieeffizienz</span></div>` : ""}
      ${L.features && L.features.length ? `<div class="dfeat">${L.features.map(f => `<span>${esc(FWP.FEAT_DE[f] || f)}</span>`).join("")}</div>` : ""}`;

    const gr = D && D.grundrisse;
    const bPlaene = gr && gr.length ? `
      <div class="plaene">
        <div class="tabs">
          ${gr.map((g, i) => `<button data-plan="${i}" aria-pressed="${i === 0}">${esc(g.geschoss)}${g.flaeche ? ` · ${g.flaeche} m²` : ""}</button>`).join("")}
          <div class="rechts">
            <button data-zoom="-" aria-label="Verkleinern">−</button><button data-zoom="+" aria-label="Vergrössern">+</button>
            <button data-zoom="v" aria-label="Vollbild">⛶</button>
            <a class="knopf leise" id="planLaden" download>PDF</a>
          </div>
        </div>
        <div class="planblatt" id="planBlatt"><div class="zeichnung" id="planZ"></div></div>
        <div class="raeume" id="planRaeume"></div>
      </div>` : "";

    const LA_ = D && D.lage;
    const POI = [["oev", "Öffentlicher Verkehr"], ["schulen", "Schulen"], ["einkauf", "Einkauf"], ["gesundheit", "Gesundheit"], ["freizeit", "Freizeit"], ["verkehr", "Verkehr"]];
    const poiDa = LA_ ? POI.filter(([k]) => LA_[k] && LA_[k].length) : [];
    const sonne = med.sonne;
    const bLage = `
      <div class="lagekarte"><canvas id="lageKarte"></canvas><button class="knopf voll" id="karteVoll">Vergrössern</button><div class="fein">Schematische Darstellung · Produktion: MapLibre</div></div>
      ${poiDa.length ? `<div class="poifilter" role="group" aria-label="Was in der Nähe angezeigt wird">${poiDa.map(([k, n], i) => `<button data-poi="${k}" aria-pressed="true" style="--pc:${["#5E8FB5", "#7FA97A", "#C08A6B", "#B0768E", "#8A8FB5", "#6E8A94"][i]}"><i style="background:${["#5E8FB5", "#7FA97A", "#C08A6B", "#B0768E", "#8A8FB5", "#6E8A94"][i]}"></i>${esc(n)}</button>`).join("")}</div>` : ""}
      ${LA_ ? `<p class="dtext">${esc(LA_.beschreibung)}</p>
        ${LA_.charakter ? `<p class="dtext" style="margin-top:12px"><i>${esc(LA_.charakter)}</i></p>` : ""}
        <div class="poispalten">${poiDa.map(([k, n]) => `<div class="poi" data-liste="${k}"><h4>${esc(n)}</h4><ul>${LA_[k].map(p => `<li>${esc(p.name)}<span>${esc(p.distanz || "")}${p.zeit ? " · " + esc(p.zeit) : ""}</span></li>`).join("")}</ul></div>`).join("")}</div>
        ${LA_.fahrzeiten ? `<div class="poi" style="margin-top:6px"><h4>Fahrzeiten mit dem Auto</h4><ul style="columns:2;column-gap:36px">${LA_.fahrzeiten.map(f => `<li>${esc(f.ziel)}<span>${esc(f.zeit)}</span></li>`).join("")}</ul></div>` : ""}
        <div class="lagefakt">${LA_.gemeinde ? `<span>Gemeinde <b>${esc(LA_.gemeinde)}</b></span>` : ""}${LA_.quartier ? `<span>Quartier <b>${esc(LA_.quartier)}</b></span>` : ""}${LA_.steuerfuss ? `<span>Steuerfuss <b>${esc(String(LA_.steuerfuss))}</b></span>` : ""}</div>`
      : `<p class="dtext">${esc(L.postalCode + " " + L.city)}, Kanton ${esc(FWP.KANTON_NAME[L.canton] || L.canton)}. Die genaue Adresse erhalten Sie nach Kontakt mit der Anbieterin oder dem Anbieter.</p>`}
      ${sonne ? `<div class="sonne">${kompass(sonne.ausrichtung)}<div class="txt"><b>Ausrichtung ${esc(sonne.ausrichtung)}</b><p>${esc(sonne.hauptraeume)}. ${esc(sonne.sonnenstunden)}.</p><p class="fein">${esc(sonne.grundlage)}.</p></div></div>` : ""}`;

    const FZ = D && D.finanzen;
    const bFinanz = kauf ? `
      <div class="finanz" id="finanzBox">
        <div>
          <label class="et">Kaufpreis</label><div class="wert"><span>Objektpreis</span><b>${esc(FWP.preis(L))}</b></div>
          <label class="et" for="fEk">Eigenmittel</label><input type="range" id="fEk" min="20" max="60" step="5" value="20">
          <div class="wert"><span id="fEkP">20 %</span><b id="fEkB"></b></div>
          <label class="et" for="fZins">Zinsmodell</label>
          <select class="feld" id="fZins" style="width:100%"><option value="0.016">SARON · 1.6 %</option><option value="0.019" selected>Festhypothek 5 Jahre · 1.9 %</option><option value="0.022">Festhypothek 10 Jahre · 2.2 %</option></select>
          <div class="wert" style="margin-top:14px"><span>Belehnung</span><b id="fBel"></b></div>
        </div>
        <div class="ausgabe">
          <span>Hypothek</span><b id="fHyp"></b>
          <span>Zins / Monat</span><b id="fZ"></b>
          <span>Amortisation / Monat</span><b id="fA"></b>
          <span>Unterhalt und Nebenkosten / Monat</span><b id="fU"></b>
          <span class="totalL">Total / Monat</span><b class="total" id="fT"></b>
          <span>Nötiges Haushaltseinkommen</span><b id="fE"></b>
        </div>
        <p class="fein">${FZ && FZ.nebenkosten ? esc(FZ.nebenkosten) + " " : ""}${FZ && FZ.preisM2Kontext ? esc(FZ.preisM2Kontext) + " " : ""}Richtwerte nach Bankenpraxis: Belehnung 80 %, zweite Hypothek in 15 Jahren amortisiert, Unterhalt 1 % pro Jahr, Tragbarkeit mit 5 % kalkulatorischem Zins bis höchstens einem Drittel des Einkommens. Das ist eine Orientierung und keine Finanzierungszusage — verbindlich rechnet Ihre Bank.</p>
      </div>` : "";

    const doks = (D && D.dokumente) || [];
    const bDoks = doks.length ? `
      <div class="doks">${doks.map(d => `<div class="dok"><div><b>${esc(d.name)}</b><small>${esc((d.typ || "pdf").toUpperCase())}${d.seiten ? " · " + d.seiten + " S." : ""}${d.groesse ? " · " + esc(d.groesse) : ""}${d.hinweis ? " — " + esc(d.hinweis) : ""}</small></div><span class="z ${d.zugang === "oeffentlich" ? "frei" : ""}">${(ZUG[d.zugang] || ZUG.anfrage)[0]}</span></div>`).join("")}</div>
      <p class="dokfein">${ZUG_TEXT}</p>` : "";

    const bFaq = (D && D.faq && D.faq.length) ? `<div class="faq">${D.faq.map(f => `<details><summary>${esc(f.frage)}</summary><p>${esc(f.antwort)}</p></details>`).join("")}</div>` : "";

    const schritte = (D && D.naechsteSchritte) || ["Besichtigung anfragen", "Frage stellen", "Finanzierung prüfen"];
    const kontaktKarte = (suffix) => `
      <div class="begleiter">
        <div class="wer">${wirVertreten ? '<span class="mark"></span>' : `<span class="av">${esc((quelle.person || quelle.name || "?").split(" ").map(x => x[0]).join("").slice(0, 2))}</span>`}
          <div><b>${esc(quelle.person || quelle.name || L.publisher)}</b><span>${esc(quelle.name && quelle.person ? quelle.name : FWP.quelleLabel(L))}${quelle.verifiziert ? " · " + t("geprueft") : ""}</span></div></div>
        <div class="vertrauen">${wirVertreten
          ? `<b>Fourwalls vertritt die Verkäuferschaft.</b> Ihre Anfrage geht an ${esc(quelle.person || "unser Team")}, nicht an Dritte.`
          : `Inseriert von <b>${esc(FWP.quelleLabel(L))}</b>. Ihre Anfrage geht direkt an diese Anbieterin oder diesen Anbieter. Fourwalls vertritt dieses Objekt nicht${quelle.verifiziert ? ", hat aber Identität und Inserat geprüft" : ""}.`}</div>
        <div class="cta">
          <button class="knopf voll" data-anfrage>${t("anfrage")}</button>
          <button class="knopf" data-frage>Frage stellen</button>
          ${(quelle.telefon || (L.contactOptions || []).includes("call")) ? `<a class="knopf leise" href="tel:${esc((quelle.telefon || "+41 44 555 01 01").replace(/\s/g, ""))}">${esc(quelle.telefon || "+41 44 555 01 01")}</a>` : ""}
        </div>
        <ul class="schritte">${schritte.map(s => `<li>${esc(s)}</li>`).join("")}</ul>
        <div class="dform" id="dForm${suffix}">
          <div class="paar"><input type="text" placeholder="Name" id="dfName${suffix}" aria-label="Name"><input type="email" placeholder="E-Mail" id="dfMail${suffix}" aria-label="E-Mail"></div>
          <textarea aria-label="Nachricht" id="dfText${suffix}">Guten Tag\nIch interessiere mich für dieses Objekt und würde es gerne besichtigen.</textarea>
          <label class="ab"><input type="checkbox" checked> Ähnliche Objekte per Suchabo erhalten</label>
          <button class="knopf voll" id="dfSenden${suffix}" style="width:100%">Anfrage senden</button>
          <p class="ok" id="dfOk${suffix}">Gesendet — ${esc(quelle.person || quelle.name || L.publisher)} meldet sich bei Ihnen.</p>
        </div>
        <div class="dmelde"><button id="dMelden${suffix}">${t("melden")}</button></div>
      </div>`;

    const aehn = ((D && D.aehnliche) ? D.aehnliche.map(FWP.finde).filter(Boolean)
      : FWP.filtern({ trans:L.transactionType, ort:"kt:" + L.canton, typ:L.propertyType }).filter(x => x.slug !== slug)).slice(0, 3);
    const bAehn = aehn.length ? `<div class="aehnlich">${aehn.map(K.kartenHTML).join("")}</div>` : "";

    const koerper = `
      ${abschnitt("uebersicht", "Übersicht", bUebersicht)}
      ${abschnitt("bilder", "Bilder und Medien", bMedien, bilder.length + " Bilder")}
      ${abschnitt("eckdaten", "Eckdaten", bEck)}
      ${abschnitt("grundrisse", "Grundrisse", bPlaene)}
      ${abschnitt("lage", "Lage", bLage)}
      ${abschnitt("finanzierung", "Finanzierung", bFinanz, "Richtwerte")}
      ${abschnitt("dokumente", "Dokumente", bDoks)}
      ${abschnitt("fragen", "Häufige Fragen", bFaq)}
      ${abschnitt("kontakt", "Kontakt", `<div class="nurmobil">${kontaktKarte("M")}</div>`)}
      ${abschnitt("aehnliche", "Ähnliche Objekte", bAehn)}`;

    const anker = `<nav class="anker" aria-label="Auf dieser Seite">${stationen.map(([id, ti]) => `<a href="#d-${id}" data-anker="${id}">${esc(ti)}</a>`).join("")}</nav>`;

    $("detail").innerHTML = `
      <div class="dkopf">
        <span class="z">${wirVertreten ? '<span class="mark"></span>' : ""}<b>${istEx ? t("exclusive") : esc(FWP.quelleLabel(L))}</b><span class="tt">${esc(L.title)}</span></span>
        <div class="aktionen">
          <button class="knopf" id="dMerken" aria-pressed="${fav}">${fav ? t("gemerktOk") : t("merken")}</button>
          <button class="knopf" id="dTeilen">${t("teilen")}</button>
          <button class="knopf" id="dZu">${t("schliessen")} ×</button>
        </div>
      </div>
      ${held}${titelzeile}${anker}
      <div class="dkoerper"><div class="dhaupt">${koerper}</div><aside class="dseite">${kontaktKarte("")}</aside></div>
      <div class="mobilcta"><div class="p">${esc(FWP.preis(L))}<small>${esc((L.rooms ? L.rooms + " Zi. · " : "") + (L.livingArea ? L.livingArea + " m² · " : "") + L.city)}</small></div><button class="knopf voll" data-anfrage>${t("anfrage")}</button></div>`;

    const det = $("detail");
    det.classList.add("an"); det.scrollTop = 0; document.body.style.overflow = "hidden";
    verdrahten(det, slug, gr, kauf);
  }

  /* ---------- Verdrahtung ---------- */
  function verdrahten(det, slug, gr, kauf) {
    $("dZu").addEventListener("click", () => location.hash = K.letzte());
    $("dZu").focus();
    $("dMerken").addEventListener("click", () => {
      const an = FWP.favs.kippen(L.id);
      $("dMerken").textContent = an ? t("gemerktOk") : t("merken");
      $("dMerken").setAttribute("aria-pressed", an); K.favZahl();
    });
    $("dTeilen").addEventListener("click", () => { try { navigator.clipboard.writeText(location.href); } catch (e) {} $("dTeilen").textContent = "Link kopiert ✓"; });
    const mehr = $("mehrText"); if (mehr) mehr.addEventListener("click", () => { $("dText").classList.remove("kurz"); mehr.remove(); });

    det.querySelectorAll("[data-anker]").forEach(a => a.addEventListener("click", e => {
      e.preventDefault();
      const z = $("d-" + a.dataset.anker);
      if (z) z.scrollIntoView({ behavior:matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth", block:"start" });
    }));
    const links = [...det.querySelectorAll(".anker a")], secs = stationen.map(([id]) => $("d-" + id));
    det.addEventListener("scroll", () => {
      let akt = 0; secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < 170) akt = i; });
      links.forEach((a, i) => a.setAttribute("aria-current", i === akt));
    }, { passive:true });

    /* Anfrage */
    const zeigeForm = frage => {
      const f = matchMedia("(max-width:960px)").matches ? ($("dFormM") || $("dForm")) : ($("dForm") || $("dFormM"));
      f.classList.add("an");
      if (frage) f.querySelector("textarea").value = "Guten Tag\nIch habe eine Frage zu diesem Objekt:\n";
      f.scrollIntoView({ behavior:"smooth", block:"center" });
      f.querySelector("input").focus();
    };
    det.querySelectorAll("[data-anfrage]").forEach(b => b.addEventListener("click", () => zeigeForm(false)));
    det.querySelectorAll("[data-frage]").forEach(b => b.addEventListener("click", () => zeigeForm(true)));
    ["", "M"].forEach(s => {
      const btn = $("dfSenden" + s); if (!btn) return;
      btn.addEventListener("click", () => {
        const n = $("dfName" + s), m = $("dfMail" + s);
        if (!n.value || !m.value.includes("@")) { (n.value ? m : n).style.borderColor = "var(--warn)"; (n.value ? m : n).focus(); return; }
        $("dfOk" + s).style.display = "block"; btn.disabled = true; btn.style.opacity = .5;
        try {
          const a = JSON.parse(localStorage.getItem("fw-anfragen") || "[]");
          a.push({ slug, titel:L.title, ort:L.city, datum:new Date().toISOString().slice(0, 10), status:"Gesendet" });
          localStorage.setItem("fw-anfragen", JSON.stringify(a));
        } catch (e) {}
      });
      const md = $("dMelden" + s); if (md) md.addEventListener("click", () => { md.textContent = "Gemeldet — danke, wir prüfen das."; md.disabled = true; });
    });

    /* Galerie */
    malGalerie("alle");
    det.querySelectorAll("[data-kat]").forEach(b => b.addEventListener("click", () => {
      det.querySelectorAll("[data-kat]").forEach(x => x.setAttribute("aria-pressed", x === b));
      malGalerie(b.dataset.kat);
    }));
    det.querySelectorAll("[data-li]").forEach(f => f.addEventListener("click", () => lichtAuf(+f.dataset.li)));
    const ab = $("alleBilder"); if (ab) ab.addEventListener("click", () => lichtAuf(0));
    det.querySelectorAll("[data-medium]").forEach(b => b.addEventListener("click", () => lichtMedium(b.dataset.medium)));

    if (gr && gr.length) grundrisse(gr);
    if (kauf) finanzRechner(L.price);
    K.verdrahte(det);
    requestAnimationFrame(() => { const c = $("lageKarte"); if (c) lageKarte(c); });

    /* Exclusive: das Fenster öffnet die Wand — Titel und Preis stehen von Anfang an */
    const wand = $("exWand");
    if (wand) {
      const fen = $("exFenster");
      if (matchMedia("(prefers-reduced-motion:reduce)").matches) wand.classList.add("aus");
      else {
        let start = null; const ease = x => x < .5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
        const auf = ts => {
          if (start === null) start = ts;
          const k = Math.min(1, (ts - start) / 900), e = ease(k);
          fen.style.setProperty("--ms", (100 + e * 2400) + "%");
          wand.style.opacity = 1 - Math.max(0, (k - .6) / .4);
          if (k < 1) requestAnimationFrame(auf); else wand.classList.add("aus");
        };
        setTimeout(() => requestAnimationFrame(auf), 700);
        /* Sicherheitsnetz: die Wand darf unter keinen Umständen stehen bleiben */
        setTimeout(() => wand.classList.add("aus"), 2600);
      }
    }
  }

  /* ---------- Galerie-Mosaik mit Kategorien ---------- */
  function malGalerie(kat) {
    const g = $("galGitter"); if (!g) return;
    const teil = bilder.map((b, i) => ({ b, i })).filter(x => kat === "alle" || x.b.kat === kat);
    g.innerHTML = teil.map((x, n) => `<figure class="g${n % 6}" data-li="${x.i}">${FWP.pic(x.b.key, { alt:x.b.text || L.title, sizes:"(max-width:960px) 100vw, 50vw" })}${x.b.text ? `<figcaption>${esc(x.b.text)}</figcaption>` : ""}</figure>`).join("");
    g.querySelectorAll("[data-li]").forEach(f => f.addEventListener("click", () => lichtAuf(+f.dataset.li)));
  }

  /* ---------- Lightbox ---------- */
  let lichtI = 0, lichtListe = [];
  function lichtAuf(i) {
    lichtListe = bilder.map((b, n) => n); lichtI = i;
    const kats = ["alle", ...[...new Set(bilder.map(b => b.kat).filter(Boolean))]];
    $("licht").innerHTML = `
      <div class="lk">
        <span id="lichtZ"></span>
        <div class="mitte">${kats.map((k, n) => `<button data-lkat="${k}" aria-pressed="${n === 0}">${esc(KAT[k] || k)}</button>`).join("")}</div>
        <button class="knopf" id="lichtZu">${t("schliessen")} ×</button>
      </div>
      <div class="lb"><button class="pf l" id="lichtL" aria-label="Vorheriges Bild">‹</button><img id="lichtImg" alt=""><button class="pf r" id="lichtR" aria-label="Nächstes Bild">›</button></div>
      <div class="bu" id="lichtBu"></div>
      <div class="lf" id="lichtF"></div>`;
    $("licht").classList.add("an");
    $("lichtZu").addEventListener("click", lichtZu);
    $("lichtL").addEventListener("click", () => sprung(-1));
    $("lichtR").addEventListener("click", () => sprung(1));
    $("licht").querySelectorAll("[data-lkat]").forEach(b => b.addEventListener("click", () => {
      $("licht").querySelectorAll("[data-lkat]").forEach(x => x.setAttribute("aria-pressed", x === b));
      const k = b.dataset.lkat;
      lichtListe = bilder.map((x, n) => n).filter(n => k === "alle" || bilder[n].kat === k);
      if (!lichtListe.includes(lichtI)) lichtI = lichtListe[0];
      malStreifen(); zeig();
    }));
    /* Wischen */
    let x0 = null;
    $("licht").addEventListener("touchstart", e => x0 = e.touches[0].clientX, { passive:true });
    $("licht").addEventListener("touchend", e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 46) sprung(dx < 0 ? 1 : -1);
      x0 = null;
    }, { passive:true });
    malStreifen(); zeig(); $("lichtZu").focus();
  }
  function malStreifen() {
    $("lichtF").innerHTML = lichtListe.map(n => `<button data-j="${n}" aria-current="${n === lichtI}" aria-label="Bild ${n + 1}"><img src="../img/${bilder[n].key}-480.jpg" alt="" loading="lazy"></button>`).join("");
    $("lichtF").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { lichtI = +b.dataset.j; zeig(); }));
  }
  function sprung(d) {
    const p = lichtListe.indexOf(lichtI);
    lichtI = lichtListe[(p + d + lichtListe.length) % lichtListe.length];
    zeig();
  }
  function zeig() {
    const b = bilder[lichtI];
    $("lichtImg").src = `../img/${b.key}-1600.jpg`;
    $("lichtImg").alt = b.text || L.title;
    $("lichtZ").textContent = `${lichtListe.indexOf(lichtI) + 1} / ${lichtListe.length}`;
    $("lichtBu").textContent = b.text || "";
    $("lichtF").querySelectorAll("button").forEach(x => x.setAttribute("aria-current", +x.dataset.j === lichtI));
    const akt = $("lichtF").querySelector('[aria-current="true"]');
    if (akt) akt.scrollIntoView({ block:"nearest", inline:"center", behavior:"smooth" });
  }
  function lichtMedium(art) {
    const med = (D && D.medien) || {};
    const M = {
      video:["Objektfilm", med.video ? `${med.video.hinweis}. Länge ${med.video.dauer}.` : "", "In Produktion läuft hier der Film als HLS-Stream, ohne Ton-Autoplay."],
      "360":["360°-Rundgang", med.tour360 ? med.tour360.hinweis + "." : "", "In Produktion wird hier der Rundgang eingebettet, mit Raumwahl an der Seite."],
      "3d":["3D-Modell", med.modell3d ? med.modell3d.hinweis + "." : "", "Erscheint nur bei Objekten, die digital vermessen wurden — kein nachgebautes Volumen."],
      sonne:["Ausrichtung", med.sonne ? `${med.sonne.hauptraeume}. ${med.sonne.sonnenstunden}.` : "", med.sonne ? med.sonne.grundlage + "." : ""]
    }[art];
    $("licht").innerHTML = `<div class="lk"><span>${esc(M[0])} · ${esc(L.title)}</span><button class="knopf" id="lichtZu">${t("schliessen")} ×</button></div>
      <div class="lb"><div class="buehne"><div><b>${esc(M[0])}</b>${esc(M[1])}<div class="fein">${esc(M[2])}</div></div></div></div>`;
    $("licht").classList.add("an"); $("lichtZu").addEventListener("click", lichtZu); $("lichtZu").focus();
  }
  function lichtPlan(svg, geschoss) {
    $("licht").innerHTML = `<div class="lk"><span>Grundriss · ${esc(geschoss)}</span><button class="knopf" id="lichtZu">${t("schliessen")} ×</button></div>
      <div class="lb"><div style="width:min(1100px,92vw);color:#EEF1F2">${svg}</div></div>`;
    $("licht").classList.add("an"); $("lichtZu").addEventListener("click", lichtZu); $("lichtZu").focus();
  }
  function lichtZu() { $("licht").classList.remove("an"); $("licht").innerHTML = ""; lichtListe = []; }

  /* ---------- Grundrisse ---------- */
  function grundrisse(gr) {
    let i = 0, z = 1;
    const blatt = $("planZ"), rae = $("planRaeume");
    async function zeige() {
      const g = gr[i]; $("planBlatt").scrollTo(0, 0);
      if (g.datei && /\.svg$/.test(g.datei)) {
        try { blatt.innerHTML = await (await fetch(g.datei)).text(); }
        catch (e) { blatt.innerHTML = `<div class="pdfplan">Plan konnte nicht geladen werden.</div>`; }
      } else {
        blatt.innerHTML = `<div class="pdfplan"><b style="font-family:var(--d);font-size:1.4rem;display:block;margin-bottom:8px;color:var(--ink)">${esc(g.geschoss)}</b>Plan liegt als PDF vor${g.datei ? ` (${esc(g.datei)})` : ""}. In Produktion wird die erste Seite als Vorschau gerendert.</div>`;
      }
      rae.innerHTML = (g.raeume || []).map(r => `<span><b>${esc(r.name)}</b> ${r.m2 ? r.m2 + " m²" : ""}</span>`).join("");
      document.querySelectorAll("[data-plan]").forEach(b => b.setAttribute("aria-pressed", +b.dataset.plan === i));
      const lk = $("planLaden"); if (lk) lk.href = g.datei || "#";
    }
    document.querySelectorAll("[data-plan]").forEach(b => b.addEventListener("click", () => { i = +b.dataset.plan; z = 1; blatt.style.transform = ""; zeige(); }));
    document.querySelectorAll("[data-zoom]").forEach(b => b.addEventListener("click", () => {
      const a = b.dataset.zoom;
      if (a === "v") { lichtPlan(blatt.innerHTML, gr[i].geschoss); return; }
      z = a === "+" ? Math.min(3, z * 1.4) : Math.max(1, z / 1.4);
      blatt.style.transform = `scale(${z})`;
    }));
    zeige();
  }

  /* ---------- Finanzrechner ---------- */
  function finanzRechner(preis) {
    const r = () => {
      const ek = +$("fEk").value / 100, zins = +$("fZins").value, f = finanz(preis, ek, zins);
      $("fEkP").textContent = Math.round(ek * 100) + " %";
      $("fEkB").textContent = chf(f.ek); $("fBel").textContent = f.belehnung + " %";
      $("fHyp").textContent = chf(f.hyp); $("fZ").textContent = chf(f.zinsM);
      $("fA").textContent = chf(f.amortM); $("fU").textContent = chf(f.unterhM);
      $("fT").textContent = chf(f.total); $("fE").textContent = chf(f.einkommen) + " / Jahr";
    };
    $("fEk").addEventListener("input", r); $("fZins").addEventListener("change", r); r();
  }

  /* ---------- Lagekarte: Objekt, Ringe, gefilterte Umgebung ---------- */
  const POI_FARBE = { oev:"#5E8FB5", schulen:"#7FA97A", einkauf:"#C08A6B", gesundheit:"#B0768E", freizeit:"#8A8FB5", verkehr:"#6E8A94" };
  let poiAn = null;
  function lageKarte(cv) {
    const LA_ = D && D.lage;
    if (!poiAn) { poiAn = {}; Object.keys(POI_FARBE).forEach(k => poiAn[k] = true); }
    const stil = n => getComputedStyle(document.body).getPropertyValue(n).trim();
    function mal() {
      const b = cv.parentElement.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = b.width * dpr; cv.height = b.height * dpr;
      const c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = b.width, h = b.height, cx = w / 2, cy = h / 2;
      c.fillStyle = stil("--tief"); c.fillRect(0, 0, w, h);
      /* Wasser als ruhige Bänder */
      c.strokeStyle = stil("--linie"); c.lineWidth = 1;
      for (let y = 0; y < h; y += 34) { c.globalAlpha = .35 + y / h * .5; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      c.globalAlpha = 1;
      /* Distanzringe: 500 m, 1 km, 3 km */
      const skala = Math.min(w, h) / 2 / 3.4;
      [[.5, "500 m"], [1, "1 km"], [3, "3 km"]].forEach(([km, txt]) => {
        c.beginPath(); c.arc(cx, cy, km * skala, 0, 7);
        c.strokeStyle = stil("--linie2"); c.setLineDash([3, 5]); c.stroke(); c.setLineDash([]);
        c.fillStyle = stil("--leise"); c.font = "9px 'Manrope',sans-serif";
        c.fillText(txt, cx + km * skala - 26, cy - 5);
      });
      /* Umgebung: gleichmässig verteilt, Distanz massstäblich */
      if (LA_) {
        let winkel = -Math.PI / 2;
        Object.keys(POI_FARBE).forEach(k => {
          if (!LA_[k] || !poiAn[k]) return;
          LA_[k].forEach(p => {
            const km = parseFloat(String(p.distanz).replace(",", ".")) * (String(p.distanz).includes(" m") && !String(p.distanz).includes("km") ? .001 : 1) || .8;
            const r = Math.min(km, 3.3) * skala;
            const x = cx + Math.cos(winkel) * r, y = cy + Math.sin(winkel) * r * .78;
            winkel += 2.399;
            c.beginPath(); c.arc(x, y, 4, 0, 7); c.fillStyle = POI_FARBE[k]; c.fill();
            c.fillStyle = stil("--ink"); c.font = "9px 'Manrope',sans-serif";
            const nm = p.name.length > 22 ? p.name.slice(0, 21) + "…" : p.name;
            c.fillText(nm, x + 7, y + 3);
          });
        });
      }
      /* Das Objekt */
      c.beginPath(); c.arc(cx, cy, 7, 0, 7); c.fillStyle = stil("--licht"); c.fill();
      c.beginPath(); c.arc(cx, cy, 15, 0, 7); c.strokeStyle = stil("--licht"); c.lineWidth = 1.4; c.stroke();
      c.fillStyle = stil("--ink"); c.font = "500 10px 'Manrope',sans-serif";
      c.fillText((L.postalCode + " " + L.city).toUpperCase(), cx + 22, cy + 3);
      c.fillStyle = stil("--leise"); c.font = "9px 'Manrope',sans-serif";
      c.fillText("UNGEFÄHRE LAGE · GENAUE ADRESSE NACH KONTAKT", 12, h - 26);
    }
    cv._mal = mal; mal();
    document.querySelectorAll("[data-poi]").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.poi, an = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", an); poiAn[k] = an;
      const li = document.querySelector(`[data-liste="${k}"]`); if (li) li.style.display = an ? "" : "none";
      mal();
    }));
    const vb = $("karteVoll");
    if (vb) vb.addEventListener("click", () => {
      const gross = vb.textContent === "Vergrössern";
      cv.parentElement.style.height = gross ? "min(78vh,760px)" : "";
      vb.textContent = gross ? "Verkleinern" : "Vergrössern";
      requestAnimationFrame(mal);
    });
    window.addEventListener("resize", () => { if ($("lageKarte")) mal(); });
  }

  /* ---------- Kompass: ehrliche Ausrichtung, keine Verschattungsstudie ---------- */
  function kompass(ausrichtung) {
    const G = { "Nord":0, "Nord-Ost":45, "Ost":90, "Süd-Ost":135, "Süd":180, "Süd-West":225, "West":270, "Nord-West":315 };
    const a = G[ausrichtung] != null ? G[ausrichtung] : 180;
    const rad = (a - 90) * Math.PI / 180, x = 59 + Math.cos(rad) * 38, y = 59 + Math.sin(rad) * 38;
    return `<svg viewBox="0 0 118 118" role="img" aria-label="Ausrichtung ${esc(ausrichtung)}">
      <circle cx="59" cy="59" r="46" fill="none" stroke="currentColor" stroke-opacity=".18"/>
      <circle cx="59" cy="59" r="30" fill="none" stroke="currentColor" stroke-opacity=".1"/>
      <path d="M59 59 L${x.toFixed(1)} ${y.toFixed(1)}" stroke="var(--licht)" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" fill="var(--licht)"/>
      <circle cx="59" cy="59" r="3" fill="currentColor"/>
      <text x="59" y="16" text-anchor="middle" font-size="9" fill="currentColor" opacity=".55" font-family="Manrope,sans-serif">N</text>
      <text x="59" y="110" text-anchor="middle" font-size="9" fill="currentColor" opacity=".55" font-family="Manrope,sans-serif">S</text>
      <text x="108" y="63" text-anchor="middle" font-size="9" fill="currentColor" opacity=".55" font-family="Manrope,sans-serif">O</text>
      <text x="10" y="63" text-anchor="middle" font-size="9" fill="currentColor" opacity=".55" font-family="Manrope,sans-serif">W</text>
    </svg>`;
  }

  /* ---------- Tastatur ---------- */
  document.addEventListener("keydown", e => {
    if ($("licht") && $("licht").classList.contains("an")) {
      if (e.key === "Escape") { lichtZu(); return; }
      if (!lichtListe.length) return;
      if (e.key === "ArrowRight") sprung(1);
      if (e.key === "ArrowLeft") sprung(-1);
    }
  });

  function schliessen() { const d = $("detail"); if (d) { d.classList.remove("an"); d.innerHTML = ""; } document.body.style.overflow = ""; }
  function init(kontext) { K = kontext; }
  function modusWechsel() { const c = $("lageKarte"); if (c && c._mal) c._mal(); }

  return { init, oeffne, schliessen, modusWechsel, lichtZu };
})();
