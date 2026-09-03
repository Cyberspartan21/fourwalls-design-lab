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
  /* Etagenbezeichnung mit sprachgerechter Ordnungszahl statt einer zusammengesetzten Abkürzung */
  function etageText(floor) {
    if (floor === 0) return t("o_egKurz");
    const l = FWP.lang;
    if (l === "fr") return floor + (floor === 1 ? "er" : "e") + " étage";
    if (l === "it") return floor + "° piano";
    if (l === "en") return floor + (floor === 1 ? "st" : floor === 2 ? "nd" : floor === 3 ? "rd" : "th") + " floor";
    return floor + ". OG";
  }
  const chf = n => "CHF " + fmt(n);

  const KAT = () => ({ alle:t("o_katAlle"), aussen:t("o_katAussen"), wohnen:t("o_katWohnen"), kueche:t("o_katKueche"), schlafen:t("o_katSchlafen"), bad:t("o_katBad"), lage:t("o_katLage"), plan:t("o_katPlan") });
  const ZUG = () => ({ oeffentlich:[t("o_zugHerunterladen"),"frei"], konto:[t("o_zugMitKonto"),""], anfrage:[t("o_zugNachAnfrage"),""], besichtigung:[t("o_zugNachBesichtigung"),""], gesperrt:[t("o_zugNachEinigung"),""] });
  const ZUG_TEXT = () => t("o_zugText");

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
  const LG = () => ({ bauweise:t("o_lgBauweise"), dach:t("o_lgDach"), fenster:t("o_lgFenster"), zustand:t("o_lgZustand"), ausrichtung:t("o_lgAusrichtung"), volumen:t("o_lgVolumen"), qualitaet:t("o_lgQualitaet") });
  const LA = () => ({ kueche:t("o_laKueche"), baeder:t("o_laBaeder"), boeden:t("o_laBoeden"), geraete:t("o_laGeraete"), waschen:t("o_laWaschen"), cheminee:t("o_laCheminee"), lift:t("o_laLift"), smarthome:t("o_laSmarthome"), stauraum:t("o_laStauraum") });
  const LE = () => ({ heizung:t("o_leHeizung"), energietraeger:t("o_leEnergietraeger"), verteilung:t("o_leVerteilung"), photovoltaik:t("o_lePhotovoltaik"), geak:t("o_leGeak"), minergie:t("o_leMinergie") });
  const LO = () => ({ balkon:t("o_loBalkon"), terrasse:t("o_loTerrasse"), garten:t("o_loGarten"), pool:t("o_loPool"), aussicht:t("o_loAussicht"), privatsphaere:t("o_loPrivatsphaere") });
  const LP = () => ({ garage:t("o_lpGarage"), tiefgarage:t("o_lpTiefgarage"), aussenplaetze:t("o_lpAussenplaetze"), ladestation:t("o_lpLadestation") });

  /* ---------- Öffnen ---------- */
  function oeffne(slug, exclusive) {
    L = FWP.finde(slug);
    if (!L) { location.hash = "suche"; return; }
    D = (window.FWDOS ? window.FWDOS.bauen(L) : null) || FWD()[slug] || null;
    istEx = !!(exclusive || (L.listingTier === "exclusive" && L.fw));
    stationen = [];

    const med = (D && D.medien) || {};
    bilder = med.bilder ? med.bilder.map(b => typeof b === "string" ? { key:b, text:"", kat:"wohnen" } : b)
                        : (L.bilder || [L.img]).map(k => ({ key:k, text:"", kat:"wohnen" }));
    const quelle = (D && D.quelle) || { art:L.listingSource === "fourwalls" ? "fourwalls" : L.listingSource, name:L.publisher, verifiziert:L.verificationStatus === "verified" };
    const wirVertreten = quelle.art === "fourwalls";
    const fx = (D && D.fakten) || {};
    const kauf = FWP.monatlichMoeglich(L);
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
          <button data-li="0">${FWP.bildLabel(bilder.length)}</button>
          ${med.video ? `<button data-medium="video">${esc(t("o_video"))}</button>` : ""}
          ${med.tour360 ? `<button data-medium="360">360°</button>` : ""}
          ${(D && D.grundrisse && D.grundrisse.length) ? `<button data-anker="grundrisse">${esc(t("o_grundrisseBtn"))}</button>` : ""}
        </div>
        ${quelle.verifiziert && !wirVertreten ? `<span class="quellband">${esc(t("o_geprueft2"))}</span>` : ""}
      </div>`;

    /* --- Titelzeile: Preis und Eckdaten ohne Scrollen --- */
    const eck = [
      (fx.zimmer ?? L.rooms) ? [fx.zimmer ?? L.rooms, t("o_fZimmer")] : null,
      (fx.wohnflaeche ?? L.livingArea) ? [(fx.wohnflaeche ?? L.livingArea) + " m²", t("o_fWohnflaeche")] : null,
      (fx.grundstueck ?? L.plotArea) ? [(fx.grundstueck ?? L.plotArea) + " m²", t("o_fGrundstueck")] : null,
      (fx.baujahr ?? L.yearBuilt) ? [fx.baujahr ?? L.yearBuilt, t("o_fBaujahr")] : null,
      [FWP.verfuegbarLabel(L), t("verfuegbar")]
    ].filter(Boolean);
    const titelzeile = `
      <div class="dtitel${istEx ? " kompakt" : ""}">
        ${istEx ? "" : `<div class="kick">${esc(FWL.typen[L.propertyType])} · ${esc(L.postalCode + " " + L.city)}</div>`}
        <div class="oben">
          <div>
            ${istEx ? "" : `<h1>${esc(L.title)}</h1>`}
            <div class="ort">${esc(L.city)} · ${esc(FWP.KANTON_NAME[L.canton] || L.canton)} · ${esc(t("o_genaueAdresse"))}</div>
          </div>
          <div class="preisblock">
            <div class="preis">${esc(FWP.preis(L))}</div>
            ${L.transactionType === "rent" ? `<div class="prosub">+ ${L.rentNK ? chf(L.rentNK) + " " + t("nebenkosten") : t("nebenkosten")}</div>` : m2 ? `<div class="prosub">${fmt(m2)} ${t("proM2")}</div>` : ""}
            ${monat ? `<div class="monat">ab ${chf(monat.total)} / Monat<br><a href="#d-finanzierung" data-anker="finanzierung">${esc(t("o_tragbarkeitRechnen"))}</a></div>` : ""}
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
      ${lang ? `<button class="mehrtext" id="mehrText">${esc(t("o_ganzeBeschreibung"))}</button>` : ""}`;

    const kats = ["alle", ...[...new Set(bilder.map(b => b.kat).filter(Boolean))]];
    const bMedien = bilder.length > 3 || med.video || med.tour360 ? `
      ${kats.length > 2 ? `<div class="katfilter" role="group" aria-label="Bildkategorien">${kats.map((k, i) => `<button data-kat="${k}" aria-pressed="${i === 0}">${esc(KAT()[k] || k)}</button>`).join("")}</div>` : ""}
      <div class="gal" id="galGitter"></div>
      <div class="medienknoepfe">
        <button class="knopf" id="alleBilder">${t("zeigeAlle")} · ${FWP.bildLabel(bilder.length)}</button>
        ${med.video ? `<button class="knopf" data-medium="video">${esc(med.video.titel || t("o_video"))}${med.video.dauer ? " · " + esc(med.video.dauer) : ""}</button>` : ""}
        ${med.tour360 ? `<button class="knopf" data-medium="360">${esc(med.tour360.titel || "360°-Rundgang")}</button>` : ""}
        ${med.modell3d ? `<button class="knopf" data-medium="3d">${esc(med.modell3d.titel || "3D-Modell")}</button>` : ""}
      </div>` : "";

    const fakten = [
      [t("o_fPreis"), FWP.preis(L)],
      (fx.zimmer ?? L.rooms) ? [t("o_fZimmer"), fx.zimmer ?? L.rooms] : null,
      (fx.wohnflaeche ?? L.livingArea) ? [t("o_fWohnflaeche"), (fx.wohnflaeche ?? L.livingArea) + " m²"] : null,
      fx.nutzflaeche ? [t("o_fNutzflaeche"), fx.nutzflaeche + " m²"] : null,
      (fx.grundstueck ?? L.plotArea) ? [t("o_fGrundstueck"), (fx.grundstueck ?? L.plotArea) + " m²"] : null,
      fx.schlafzimmer ? [t("o_fSchlafzimmer"), fx.schlafzimmer] : null,
      fx.badezimmer ? [t("o_fBadezimmer"), fx.badezimmer] : null,
      (fx.baujahr ?? L.yearBuilt) ? [t("o_fBaujahr"), fx.baujahr ?? L.yearBuilt] : null,
      fx.renovation ? [t("o_fRenovation"), fx.renovation] : null,
      fx.geschosse ? [t("o_fGeschosse"), fx.geschosse] : null,
      fx.raumhoehe ? [t("o_fRaumhoehe"), fx.raumhoehe + " m"] : null,
      fx.kubatur ? [t("o_fKubatur"), fmt(fx.kubatur) + " m³"] : null,
      (L.floor != null && !fx.geschosse) ? [t("o_fEtage"), etageText(L.floor)] : null,
      m2 ? [t("proM2"), fmt(m2)] : null,
      [t("verfuegbar"), FWP.verfuegbarLabel(L)],
      [t("o_fReferenz"), L.id]
    ].filter(Boolean);
    const gr2 = D ? [gruppe(t("o_secGebaeude"), D.gebaeude, LG()), gruppe(t("ausstattung"), D.ausstattung, LA()), gruppe(t("o_secAussen"), D.aussen, LO()), gruppe(t("o_secParkieren"), D.parkieren, LP()), gruppe(t("o_secEnergie"), D.energie, LE())].filter(Boolean) : [];
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
            <button data-zoom="-" aria-label="${esc(t("o_verkleinern"))}">−</button><button data-zoom="+" aria-label="${esc(t("o_vergroessern"))}">+</button>
            <button data-zoom="v" aria-label="${esc(t("o_vollbild"))}">⛶</button>
            <a class="knopf leise" id="planLaden" download>PDF</a>
          </div>
        </div>
        <div class="planblatt" id="planBlatt"><div class="zeichnung" id="planZ"></div></div>
        <div class="raeume" id="planRaeume"></div>
      </div>` : "";

    const LA_ = D && D.lage;
    const POI = [["oev", t("o_poiOev")], ["schulen", t("o_poiSchulen")], ["einkauf", t("o_poiEinkauf")], ["gesundheit", t("o_poiGesundheit")], ["freizeit", t("o_poiFreizeit")], ["verkehr", t("o_poiVerkehr")]];
    const poiDa = LA_ ? POI.filter(([k]) => LA_[k] && LA_[k].length) : [];
    const sonne = med.sonne;
    const bLage = `
      <div class="lagekarte"><div id="lageMap"></div><canvas id="lageKarte"></canvas><button class="knopf voll" id="karteVoll">${esc(t("o_vergroessern"))}</button><div class="fein" id="lageHinweis">${esc(lageHinweisText())}</div></div>
      ${poiDa.length ? `<div class="poifilter" role="group" aria-label="Was in der Nähe angezeigt wird">${poiDa.map(([k, n], i) => `<button data-poi="${k}" aria-pressed="true" style="--pc:${["#5E8FB5", "#7FA97A", "#C08A6B", "#B0768E", "#8A8FB5", "#6E8A94"][i]}"><i style="background:${["#5E8FB5", "#7FA97A", "#C08A6B", "#B0768E", "#8A8FB5", "#6E8A94"][i]}"></i>${esc(n)}</button>`).join("")}</div>` : ""}
      ${LA_ ? `<p class="dtext">${esc(LA_.beschreibung)}</p>
        ${LA_.charakter ? `<p class="dtext" style="margin-top:12px"><i>${esc(LA_.charakter)}</i></p>` : ""}
        <div class="poispalten">${poiDa.map(([k, n]) => `<div class="poi" data-liste="${k}"><h4>${esc(n)}</h4><ul>${LA_[k].map(p => `<li>${esc(p.name)}<span>${esc(p.distanz || "")}${p.zeit ? " · " + esc(p.zeit) : ""}</span></li>`).join("")}</ul></div>`).join("")}</div>
        ${LA_.fahrzeiten ? `<div class="poi" style="margin-top:6px"><h4>${esc(t("o_fahrzeitenAuto"))}</h4><ul style="columns:2;column-gap:36px">${LA_.fahrzeiten.map(f => `<li>${esc(f.ziel)}<span>${esc(f.zeit)}</span></li>`).join("")}</ul></div>` : ""}
        <div class="lagefakt">${LA_.gemeinde ? `<span>${esc(t("o_gemeindeWort"))} <b>${esc(LA_.gemeinde)}</b></span>` : ""}${LA_.quartier ? `<span>${esc(t("o_quartierWort"))} <b>${esc(LA_.quartier)}</b></span>` : ""}${LA_.steuerfuss ? `<span>${esc(t("o_steuerfussWort"))} <b>${esc(String(LA_.steuerfuss))}</b></span>` : ""}</div>`
      : `<p class="dtext">${esc(L.postalCode + " " + L.city)}, ${esc(t("o_kantonWort"))} ${esc(FWP.KANTON_NAME[L.canton] || L.canton)}. ${esc(t("o_genAdresseNachKontaktSatz"))}</p>`}
      ${sonne ? `<div class="sonne">${kompass(sonne.ausrichtung)}<div class="txt"><b>${esc(t("o_ausrichtungWort"))} ${esc(sonne.ausrichtung)}</b><p>${esc(sonne.hauptraeume)}. ${esc(sonne.sonnenstunden)}.</p><p class="fein">${esc(sonne.grundlage)}.</p></div></div>` : ""}`;

    const FZ = D && D.finanzen;
    const bFinanz = kauf ? `
      <div class="finanz" id="finanzBox">
        <div>
          <label class="et">${esc(t("o_kaufpreis"))}</label><div class="wert"><span>${esc(t("o_objektpreis"))}</span><b>${esc(FWP.preis(L))}</b></div>
          <label class="et" for="fEk">${esc(t("o_eigenmittel"))}</label><input type="range" id="fEk" min="20" max="60" step="5" value="20">
          <div class="wert"><span id="fEkP">20 %</span><b id="fEkB"></b></div>
          <label class="et" for="fZins">${esc(t("o_zinsmodell"))}</label>
          <select class="feld" id="fZins" style="width:100%"><option value="0.016">${esc(t("o_saron"))}</option><option value="0.019" selected>${esc(t("o_fest5"))}</option><option value="0.022">${esc(t("o_fest10"))}</option></select>
          <div class="wert" style="margin-top:14px"><span>${esc(t("o_belehnung"))}</span><b id="fBel"></b></div>
        </div>
        <div class="ausgabe">
          <span>${esc(t("o_hypothek"))}</span><b id="fHyp"></b>
          <span>${esc(t("o_zinsMonat"))}</span><b id="fZ"></b>
          <span>${esc(t("o_amortMonat"))}</span><b id="fA"></b>
          <span>${esc(t("o_unterhMonat"))}</span><b id="fU"></b>
          <span class="totalL">${esc(t("o_totalMonat"))}</span><b class="total" id="fT"></b>
          <span>${esc(t("o_noetHaushalt"))}</span><b id="fE"></b>
        </div>
        <p class="fein">${FZ && FZ.nebenkosten ? esc(FZ.nebenkosten) + " " : ""}${FZ && FZ.preisM2Kontext ? esc(FZ.preisM2Kontext) + " " : ""}${esc(t("o_finanzFein"))}</p>
      </div>` : "";

    const doks = (D && D.dokumente) || [];
    const bDoks = doks.length ? `
      <div class="doks">${doks.map(d => `<div class="dok"><div><b>${esc(d.name)}</b><small>${esc((d.typ || "pdf").toUpperCase())}${d.seiten ? " · " + d.seiten + " " + esc(t("o_seitenAbk")) : ""}${d.groesse ? " · " + esc(d.groesse) : ""}${d.hinweis ? " — " + esc(d.hinweis) : ""}</small></div><span class="z ${d.zugang === "oeffentlich" ? "frei" : ""}">${(ZUG()[d.zugang] || ZUG().anfrage)[0]}</span></div>`).join("")}</div>
      <p class="dokfein">${ZUG_TEXT()}</p>` : "";

    const bFaq = (D && D.faq && D.faq.length) ? `<div class="faq">${D.faq.map(f => `<details><summary>${esc(f.frage)}</summary><p>${esc(f.antwort)}</p></details>`).join("")}</div>` : "";

    const schritte = (D && D.naechsteSchritte) || [t("o_naechsteBesichtigung"), t("o_naechsteFrage"), t("o_naechsteFinanzierung")];
    const kontaktKarte = (suffix) => `
      <div class="begleiter">
        <div class="wer">${wirVertreten ? '<span class="mark"></span>' : `<span class="av">${esc((quelle.person || quelle.name || "?").split(" ").map(x => x[0]).join("").slice(0, 2))}</span>`}
          <div><b>${esc(quelle.person || quelle.name || L.publisher)}</b><span>${esc(quelle.name && quelle.person ? quelle.name : FWP.quelleLabel(L))}${quelle.verifiziert ? " · " + t("geprueft") : ""}</span></div></div>
        <div class="vertrauen">${wirVertreten
          ? `<b>${esc(t("o_wirVertreten"))}</b> ${esc(t("o_anfrageGehtAn"))} ${esc(quelle.person || t("o_unserTeam"))}, ${esc(t("o_nichtAnDritte"))}`
          : `${esc(t("o_inseriertVon"))} <b>${esc(FWP.quelleLabel(L))}</b>. ${esc(t("o_anfrageDirekt"))} ${esc(t("o_vertrittNicht"))}${quelle.verifiziert ? esc(t("o_hatGeprueft")) : ""}.`}</div>
        <div class="cta">
          <button class="knopf voll" data-anfrage>${t("anfrage")}</button>
          <button class="knopf" data-frage>${esc(t("o_frageStellen"))}</button>
          ${(quelle.telefon || (L.contactOptions || []).includes("call")) ? `<a class="knopf leise" href="tel:${esc((quelle.telefon || (window.FWCO || {}).telefon || "").replace(/\s/g, ""))}">${esc(quelle.telefon || (window.FWCO || {}).telefon || "")}</a>` : ""}
        </div>
        <ul class="schritte">${schritte.map(s => `<li>${esc(s)}</li>`).join("")}</ul>
        <div class="dform" id="dForm${suffix}">
          <div class="paar"><input type="text" placeholder="${esc(t("o_name"))}" id="dfName${suffix}" aria-label="Name"><input type="email" placeholder="E-Mail" id="dfMail${suffix}" aria-label="E-Mail"></div>
          <textarea aria-label="Nachricht" id="dfText${suffix}">${esc(t("o_nachrichtStandard"))}</textarea>
          <label class="ab"><input type="checkbox" checked> ${esc(t("o_aehnlicheSuchabo"))}</label>
          <button class="knopf voll" id="dfSenden${suffix}" style="width:100%">${esc(t("o_anfrageSenden"))}</button>
          <p class="ok" id="dfOk${suffix}">${esc(t("o_gesendetPrefix"))} ${esc(quelle.person || quelle.name || L.publisher)} ${esc(t("o_gesendetAn"))}</p>
        </div>
        <div class="dmelde"><button id="dMelden${suffix}">${t("melden")}</button></div>
      </div>`;

    const aehn = ((D && D.aehnliche) ? D.aehnliche.map(FWP.finde).filter(Boolean) : FWP.aehnliche(L)).slice(0, 3);
    const bAehn = aehn.length ? `<div class="aehnlich">${aehn.map(K.kartenHTML).join("")}</div>` : "";

    const koerper = `
      ${abschnitt("uebersicht", t("o_secUebersicht"), bUebersicht)}
      ${abschnitt("bilder", t("bilderMedien"), bMedien, FWP.bildLabel(bilder.length))}
      ${abschnitt("eckdaten", t("o_secEckdaten"), bEck)}
      ${abschnitt("grundrisse", t("o_secGrundrisse"), bPlaene)}
      ${abschnitt("lage", t("o_secLage"), bLage)}
      ${abschnitt("finanzierung", t("o_secFinanzierung"), bFinanz, t("o_secRichtwerte"))}
      ${abschnitt("dokumente", t("o_secDokumente"), bDoks)}
      ${abschnitt("fragen", t("o_secFragen"), bFaq)}
      ${abschnitt("kontakt", t("o_secKontakt"), `<div class="nurmobil">${kontaktKarte("M")}</div>`)}
      ${abschnitt("aehnliche", t("o_secAehnliche"), bAehn)}`;

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
      <div class="mobilcta"><div class="p">${esc(FWP.preis(L))}<small>${esc((L.rooms ? L.rooms + " " + t("o_ziKurz") + " · " : "") + (L.livingArea ? L.livingArea + " m² · " : "") + L.city)}</small></div><button class="knopf voll" data-anfrage>${t("anfrage")}</button></div>`;

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
    $("dTeilen").addEventListener("click", () => { try { navigator.clipboard.writeText(location.href); } catch (e) {} $("dTeilen").textContent = t("o_linkKopiert"); });
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
      if (frage) f.querySelector("textarea").value = t("o_nachrichtFrage");
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
          a.push({ slug, titel:L.title, ort:L.city, datum:new Date().toISOString().slice(0, 10), status:t("o_gesendetStatus") });
          localStorage.setItem("fw-anfragen", JSON.stringify(a));
        } catch (e) {}
      });
      const md = $("dMelden" + s); if (md) md.addEventListener("click", () => { md.textContent = t("o_gemeldetDanke"); md.disabled = true; });
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
    requestAnimationFrame(() => { const c = $("lageKarte"); if (c) { lageKarte(c); echteLageKarte(); } });

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
        <div class="mitte">${kats.map((k, n) => `<button data-lkat="${k}" aria-pressed="${n === 0}">${esc(KAT()[k] || k)}</button>`).join("")}</div>
        <button class="knopf" id="lichtZu">${t("schliessen")} ×</button>
      </div>
      <div class="lb"><button class="pf l" id="lichtL" aria-label="${esc(t("o_vorherigesBild"))}">‹</button><img id="lichtImg" alt=""><button class="pf r" id="lichtR" aria-label="${esc(t("o_naechstesBild"))}">›</button></div>
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
    $("lichtF").innerHTML = lichtListe.map(n => `<button data-j="${n}" aria-current="${n === lichtI}" aria-label="${esc(t("o_bildWort"))} ${n + 1}"><img src="../img/${bilder[n].key}-480.jpg" alt="" loading="lazy"></button>`).join("");
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
      video:[t("o_objektfilm"), med.video ? `${med.video.hinweis}. Länge ${med.video.dauer}.` : "", t("o_videoProd")],
      "360":[t("o_rundgang"), med.tour360 ? med.tour360.hinweis + "." : "", t("o_rundgangProd")],
      "3d":[t("o_modell3d"), med.modell3d ? med.modell3d.hinweis + "." : "", t("o_modell3dHinweis")],
      sonne:[t("o_ausrichtungWort"), med.sonne ? `${med.sonne.hauptraeume}. ${med.sonne.sonnenstunden}.` : "", med.sonne ? med.sonne.grundlage + "." : ""]
    }[art];
    $("licht").innerHTML = `<div class="lk"><span>${esc(M[0])} · ${esc(L.title)}</span><button class="knopf" id="lichtZu">${t("schliessen")} ×</button></div>
      <div class="lb"><div class="buehne"><div><b>${esc(M[0])}</b>${esc(M[1])}<div class="fein">${esc(M[2])}</div></div></div></div>`;
    $("licht").classList.add("an"); $("lichtZu").addEventListener("click", lichtZu); $("lichtZu").focus();
  }
  function lichtPlan(svg, geschoss) {
    $("licht").innerHTML = `<div class="lk"><span>${esc(t("o_grundrissPrefix"))} ${esc(geschoss)}</span><button class="knopf" id="lichtZu">${t("schliessen")} ×</button></div>
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
        catch (e) { blatt.innerHTML = `<div class="pdfplan">${esc(t("o_planNichtGeladen"))}</div>`; }
      } else {
        blatt.innerHTML = `<div class="pdfplan"><b style="font-family:var(--d);font-size:1.4rem;display:block;margin-bottom:8px;color:var(--ink)">${esc(g.geschoss)}</b>${esc(t("o_planPdf1"))}${g.datei ? ` (${esc(g.datei)})` : ""}. ${esc(t("o_planPdf2"))}</div>`;
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
      $("fT").textContent = chf(f.total); $("fE").textContent = chf(f.einkommen) + " " + t("o_proJahr");
    };
    $("fEk").addEventListener("input", r); $("fZins").addEventListener("change", r); r();
  }

  /* Was die Karte zeigen darf, entscheidet der Datensatz — nicht die Optik. */
  function lageFreigabe() {
    const g = (L && L.geo) || {};
    const a = g.anzeige || {};
    const lat = a.lat != null ? a.lat : L.lat, lng = a.lng != null ? a.lng : L.lng;
    return { lat, lng, genauigkeitM:a.genauigkeitM || 0, stufe:g.genauigkeit || "ungefaehr" };
  }
  function lageHinweisText() {
    const f = lageFreigabe();
    const quelle = t("o_karteSwisstopo");
    if (f.stufe === "exakt") return t("o_lageExakt") + " · " + quelle;
    if (f.stufe === "gemeinde") return t("o_lageGemeinde") + " · " + t("o_genaueAdresse2") + " · " + quelle;
    const m = f.genauigkeitM;
    return t("o_lageUngefaehr") + (m ? " " + t("o_imUmkreisVon") + " " + (m >= 1000 ? (m / 1000) + " km" : m + " m") : "") +
           " · " + t("o_genaueAdresse2") + " · " + quelle;
  }

  /* Echte Karte über das Schema legen. Gelingt sie nicht, bleibt das Schema
     stehen — die Seite verliert nie ihren Lageteil. */
  let lageInstanz = null;
  async function echteLageKarte() {
    const el = $("lageMap"); if (!el || !window.UKARTE) return;
    const f = lageFreigabe();
    if (f.lat == null || f.lng == null) return;
    try {
      lageInstanz = await UKARTE.detail("lageMap", { lat:f.lat, lng:f.lng, genauigkeitM:f.genauigkeitM });
      el.classList.add("da");
      const c = $("lageKarte"); if (c) c.style.display = "none";
    } catch (e) { el.classList.remove("da"); console.error("Lagekarte konnte nicht laden:", e); }
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
      c.fillText(t("o_ungefaehreLageCanvas"), 12, h - 26);
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
      const gross = vb.textContent === t("o_vergroessern");
      cv.parentElement.style.height = gross ? "min(78vh,760px)" : "";
      vb.textContent = gross ? t("o_verkleinern") : t("o_vergroessern");
      requestAnimationFrame(() => { mal(); if (lageInstanz) lageInstanz.resize(); });
    });
    window.addEventListener("resize", () => { if ($("lageKarte")) mal(); });
  }

  /* ---------- Kompass: ehrliche Ausrichtung, keine Verschattungsstudie ---------- */
  function kompass(ausrichtung) {
    const G = { "Nord":0, "Nord-Ost":45, "Ost":90, "Süd-Ost":135, "Süd":180, "Süd-West":225, "West":270, "Nord-West":315 };
    const a = G[ausrichtung] != null ? G[ausrichtung] : 180;
    const rad = (a - 90) * Math.PI / 180, x = 59 + Math.cos(rad) * 38, y = 59 + Math.sin(rad) * 38;
    /* Achsbeschriftung: N/S bleiben überall gleich, O/W wechseln mit der Sprache
       (Ost/Ouest teilen sich das O, das englische East/West nicht). */
    const ACHSEN = { de:["N","S","O","W"], fr:["N","S","E","O"], it:["N","S","E","O"], en:["N","S","E","W"] };
    const [aN, aS, aO, aW] = ACHSEN[FWP.lang] || ACHSEN.de;
    return `<svg viewBox="0 0 118 118" role="img" aria-label="${esc(t("o_ausrichtungWort"))} ${esc(ausrichtung)}">
      <circle cx="59" cy="59" r="46" fill="none" stroke="currentColor" stroke-opacity=".18"/>
      <circle cx="59" cy="59" r="30" fill="none" stroke="currentColor" stroke-opacity=".1"/>
      <path d="M59 59 L${x.toFixed(1)} ${y.toFixed(1)}" stroke="var(--licht)" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" fill="var(--licht)"/>
      <circle cx="59" cy="59" r="3" fill="currentColor"/>
      <text x="59" y="16" text-anchor="middle" font-size="9" fill="currentColor" opacity=".55" font-family="Manrope,sans-serif">${aN}</text>
      <text x="59" y="110" text-anchor="middle" font-size="9" fill="currentColor" opacity=".55" font-family="Manrope,sans-serif">${aS}</text>
      <text x="108" y="63" text-anchor="middle" font-size="9" fill="currentColor" opacity=".55" font-family="Manrope,sans-serif">${aO}</text>
      <text x="10" y="63" text-anchor="middle" font-size="9" fill="currentColor" opacity=".55" font-family="Manrope,sans-serif">${aW}</text>
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
  function modusWechsel() {
    const c = $("lageKarte"); if (c && c._mal) c._mal();
    if (lageInstanz) { try { lageInstanz.remove(); } catch (e) {} lageInstanz = null;
      const el = $("lageMap"); if (el) { el.innerHTML = ""; el.classList.remove("da"); }
      if (c) c.style.display = "";
      echteLageKarte();
    }
  }

  return { init, oeffne, schliessen, modusWechsel, lichtZu };
})();
