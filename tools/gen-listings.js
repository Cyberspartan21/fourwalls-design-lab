#!/usr/bin/env node
/* Erzeugt data/listings.js — deterministischer Marktplatz-Datensatz (~240 fiktive Inserate).
   Felder gem. Portal-Brief §45: listingSource, sellerType, listingTier, verificationStatus,
   publicationStatus, publishedAt, views, favoritesCount, contactOptions, …
   Usage: node tools/gen-listings.js */
const fs = require("fs");
const path = require("path");

/* Deterministischer PRNG (mulberry32) — gleiche Ausgabe bei jedem Lauf */
function rng(seed){ let a = seed >>> 0; return function(){
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};}
const R = rng(4711);
const pick = arr => arr[Math.floor(R() * arr.length)];
const between = (a, b) => a + R() * (b - a);
const chance = p => R() < p;

/* Orte: name, plz, kanton, lat, lng, preisniveau (1=günstig … 3=teuer), gewicht */
const ORTE = [
  ["Zürich","8001","ZH",47.3769,8.5417,3,14],["Zürich","8032","ZH",47.3667,8.5636,3,8],
  ["Zürich","8045","ZH",47.3439,8.5103,3,6],["Winterthur","8400","ZH",47.4997,8.7241,2,7],
  ["Uster","8610","ZH",47.3471,8.7208,2,4],["Küsnacht","8700","ZH",47.3183,8.5836,3,4],
  ["Zug","6300","ZG",47.1662,8.5155,3,6],["Baar","6340","ZG",47.1963,8.5295,3,3],
  ["Luzern","6003","LU",47.0502,8.3093,2,7],["Kriens","6010","LU",47.0344,8.2782,2,3],
  ["Bern","3011","BE",46.9480,7.4474,2,9],["Köniz","3098","BE",46.9243,7.4145,2,4],
  ["Thun","3600","BE",46.7580,7.6280,2,4],["Interlaken","3800","BE",46.6863,7.8632,2,3],
  ["Basel","4051","BS",47.5596,7.5886,2,8],["Riehen","4125","BS",47.5786,7.6461,2,3],
  ["Genf","1204","GE",46.2044,6.1432,3,9],["Carouge","1227","GE",46.1817,6.1391,3,4],
  ["Lausanne","1003","VD",46.5197,6.6323,2,8],["Montreux","1820","VD",46.4312,6.9107,3,4],
  ["Nyon","1260","VD",46.3832,6.2396,3,3],["Sitten","1950","VS",46.2331,7.3606,1,4],
  ["Zermatt","3920","VS",46.0207,7.7491,3,3],["Crans-Montana","3963","VS",46.3082,7.4794,3,3],
  ["Lugano","6900","TI",46.0037,8.9511,2,7],["Locarno","6600","TI",46.1670,8.7943,2,4],
  ["Ascona","6612","TI",46.1541,8.7728,3,3],["St. Gallen","9000","SG",47.4245,9.3767,1,6],
  ["Rapperswil","8640","SG",47.2269,8.8187,2,3],["Quarten","8883","SG",47.1132,9.2151,2,2],
  ["Chur","7000","GR",46.8508,9.5320,1,4],["St. Moritz","7500","GR",46.4908,9.8355,3,3],
  ["Davos","7270","GR",46.8027,9.8360,2,3],["Aarau","5000","AG",47.3925,8.0442,1,5],
  ["Baden","5400","AG",47.4733,8.3059,2,4],["Solothurn","4500","SO",47.2088,7.5323,1,3],
  ["Fribourg","1700","FR",46.8065,7.1620,1,4],["Neuchâtel","2000","NE",46.9900,6.9293,1,3],
  ["Schaffhausen","8200","SH",47.6957,8.6349,1,3],["Schwyz","6430","SZ",47.0207,8.6530,2,2]
];

/* Objekttypen: key, Grundpreis kauf (CHF/m²) nach Niveau, Miete (CHF/m²/Jahr), Zimmerbereich, Flächenbereich */
const TYPEN = {
  wohnung:   { de:"Wohnung",              kauf:[7500,10500,15500], miete:[240,320,430], zi:[1.5,5.5], fl:[45,160],  bilder:["condo-modern-1","condo-modern-2","interior-bright-1","interior-bright-2","kitchen-1","zurich-altbau-1","zurich-altbau-2","penthouse-2"] },
  haus:      { de:"Einfamilienhaus",      kauf:[6800,9500,14000],  miete:[220,290,380], zi:[4.5,7.5], fl:[110,280], bilder:["family-house-1","family-house-2","lakeside-villa-2","chalet-2"] },
  villa:     { de:"Villa",                kauf:[11000,15000,22000],miete:[300,400,540], zi:[5.5,9.5], fl:[220,480], bilder:["lakeside-villa-1","ticino-villa-1","ticino-villa-2","penthouse-1"] },
  chalet:    { de:"Chalet",               kauf:[9000,12500,19000], miete:[280,370,500], zi:[3.5,6.5], fl:[90,240],  bilder:["chalet-1","chalet-2"] },
  mfh:       { de:"Mehrfamilienhaus",     kauf:[5200,7200,10500],  miete:[0,0,0],       zi:[0,0],     fl:[380,980], bilder:["mfh-winterthur-1","geneva-facade-1","zurich-altbau-1"] },
  gewerbe:   { de:"Gewerbe / Büro",       kauf:[5400,7800,11500],  miete:[210,300,420], zi:[0,0],     fl:[80,520],  bilder:["condo-modern-1","geneva-facade-1"] },
  grundstueck:{de:"Bauland",              kauf:[900,1900,3800],    miete:[0,0,0],       zi:[0,0],     fl:[420,1600],bilder:["aerial-lake-1"] },
  parkplatz: { de:"Parkplatz / Garage",   kauf:[0,0,0],            miete:[0,0,0],       zi:[0,0],     fl:[12,14],   bilder:["condo-modern-2"] }
};
const TYP_GEWICHT = [["wohnung",46],["haus",18],["villa",7],["chalet",5],["mfh",6],["gewerbe",7],["grundstueck",6],["parkplatz",5]];

const QUELLEN = [["privat",34],["agentur",36],["fourwalls",14],["verwaltung",9],["entwickler",7]];
const FEATURES = ["balcony","terrace","garden","parking","garage","lift","lakeview","mountainview","fireplace","parquet","floorheating","minergie","cellar","washtower","pool","sauna","evcharging","concierge"];
const AGENTUREN = ["Alpenblick Immobilien AG","Weber & Cie Immobilien","Domizil Treuhand GmbH","Rives du Lac SA","Casa Ticino Sagl","Bergwelt Real Estate AG","Stadtraum Immobilien","Lemania Properties SA"];
const VORNAMEN = ["Andrea","Beat","Claudia","Daniel","Esther","Franco","Gabriela","Heinz","Isabelle","Jürg","Katrin","Luca","Martina","Nicolas","Petra","Reto","Sandra","Thomas","Ursula","Valérie"];
const NACHNAMEN = ["Meier","Brunner","Rossi","Favre","Keller","Huber","Bianchi","Dubois","Steiner","Frei","Gerber","Marti","Moser","Widmer","Zbinden"];

const LAGE_SATZ = [
  "Ruhige Wohnlage, Einkauf und ÖV in Gehdistanz.",
  "Sonnige Südlage mit freiem Blick.",
  "Zentrale Lage, wenige Minuten zum Bahnhof.",
  "Familienfreundliches Quartier, Schulen in der Nähe.",
  "Erhöhte, unverbaubare Aussichtslage.",
  "Gepflegte Umgebung mit altem Baumbestand.",
  "Nahe Naherholungsgebiet und See.",
  "Gut erschlossen, Autobahnanschluss in 5 Minuten."
];
const ZUSTAND_SATZ = [
  "Gepflegter Originalzustand mit Potenzial.",
  "2021 umfassend renoviert.",
  "Neuwertiger Ausbaustandard.",
  "Frisch gestrichen, Küche 2019 erneuert.",
  "Erstbezug nach Sanierung.",
  "Solide Bausubstanz, Teilrenovation empfohlen.",
  "Hochwertiger Innenausbau mit Eichenparkett.",
  "Hell und grosszügig geschnitten."
];

function gewichtet(paare){
  const total = paare.reduce((s,p) => s + p[1], 0);
  let z = R() * total;
  for (const [k,w] of paare){ z -= w; if (z <= 0) return k; }
  return paare[0][0];
}
function rund(x, schritt){ return Math.round(x / schritt) * schritt; }

const N = parseInt(process.argv[3] || "238", 10);
const listings = [];
const slugZaehler = {};

for (let i = 0; i < N; i++){
  const ortIdx = gewichtet(ORTE.map((o,j) => [j, o[6]]));
  const [stadt, plz, kanton, lat0, lng0, niveau] = ORTE[ortIdx];
  const typKey = gewichtet(TYP_GEWICHT);
  const T = TYPEN[typKey];

  let trans = "buy";
  if (typKey === "wohnung") trans = chance(0.48) ? "rent" : "buy";
  else if (typKey === "gewerbe") trans = chance(0.6) ? "rent" : "buy";
  else if (typKey === "parkplatz") trans = chance(0.75) ? "rent" : "buy";
  else if (typKey === "haus" || typKey === "chalet") trans = chance(0.14) ? "rent" : "buy";

  const zi = T.zi[1] > 0 ? rund(between(T.zi[0], T.zi[1]), 0.5) : null;
  /* Fläche an Zimmerzahl koppeln, wo es Zimmer gibt (≈ 22–34 m² je Zimmer) */
  const fl = zi ? Math.round(zi * between(22, 34) / 5) * 5
               : Math.round(between(T.fl[0], T.fl[1]) / 5) * 5;

  let price = null, rentNet = null, rentNK = null;
  if (typKey === "parkplatz"){
    if (trans === "rent") rentNet = rund(between(120, 320), 10);
    else price = rund(between(28000, 65000), 1000);
  } else if (trans === "buy"){
    const proM2 = T.kauf[niveau - 1] * between(0.82, 1.24);
    price = rund(fl * proM2, 10000);
  } else {
    const proJahr = T.miete[niveau - 1] * between(0.85, 1.2);
    rentNet = rund(fl * proJahr / 12, 10);
    rentNK = rund(rentNet * between(0.08, 0.16), 10);
  }
  const aufAnfrage = trans === "buy" && typKey === "villa" && chance(0.25);

  const source = gewichtet(QUELLEN);
  const tier = source === "fourwalls" ? (chance(0.5) ? "exclusive" : "verified")
             : (source === "agentur" || source === "verwaltung") && chance(0.3) ? "verified"
             : "standard";
  const sellerType = { privat:"private", agentur:"agent", fourwalls:"fourwalls",
                       verwaltung:"management", entwickler:"developer" }[source];

  const feats = [];
  const featAnz = typKey === "grundstueck" || typKey === "parkplatz" ? 0 : 2 + Math.floor(R() * 5);
  const pool = FEATURES.slice();
  for (let f = 0; f < featAnz; f++) feats.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
  if ((stadt === "Zürich" || stadt === "Luzern" || stadt === "Montreux" || stadt === "Lugano") && chance(0.3) && !feats.includes("lakeview")) feats.push("lakeview");

  const jahr = typKey === "grundstueck" ? null
    : chance(0.14) ? 2024 + Math.floor(R() * 3)
    : 1920 + Math.floor(R() * 105);

  const basis = typKey + "-" + stadt.toLowerCase().replace(/[^a-z]/g, "");
  slugZaehler[basis] = (slugZaehler[basis] || 0) + 1;
  const slug = basis + "-" + slugZaehler[basis];

  const tage = Math.floor(R() * 90);
  const publishedAt = new Date(Date.UTC(2026, 7, 29) - tage * 86400000).toISOString().slice(0, 10);

  const agentur = (source === "agentur" || source === "verwaltung") ? pick(AGENTUREN) : null;
  const person = pick(VORNAMEN) + " " + pick(NACHNAMEN);

  const titelZusatz = feats.includes("lakeview") ? " mit Seeblick"
    : feats.includes("mountainview") ? " mit Bergsicht"
    : jahr && jahr >= 2024 ? " im Neubau"
    : feats.includes("garden") ? " mit Garten"
    : feats.includes("terrace") ? " mit Terrasse" : "";

  listings.push({
    id: "FWL-" + String(1000 + i),
    slug, transactionType: trans, propertyType: typKey,
    title: (zi ? String(zi).replace(".", ".") + "-Zi.-" : "") + T.de + titelZusatz,
    city: stadt, postalCode: plz, canton: kanton,
    lat: +(lat0 + between(-0.018, 0.018)).toFixed(5),
    lng: +(lng0 + between(-0.026, 0.026)).toFixed(5),
    price, priceOnRequest: aufAnfrage, rentNet, rentNK,
    rooms: zi, livingArea: typKey === "grundstueck" ? null : fl,
    plotArea: (typKey === "haus" || typKey === "villa" || typKey === "chalet") ? Math.round(fl * between(2.2, 5.5) / 10) * 10
            : typKey === "grundstueck" ? fl : null,
    yearBuilt: jahr, floor: typKey === "wohnung" ? Math.floor(R() * 6) : null,
    features: feats, img: pick(T.bilder),
    beschreibung: pick(LAGE_SATZ) + " " + pick(ZUSTAND_SATZ),
    listingSource: source, sellerType, listingTier: tier,
    verificationStatus: tier === "standard" ? "none" : "verified",
    publicationStatus: "active", publishedAt,
    neu: tage <= 7,
    views: 40 + Math.floor(R() * 2400),
    favoritesCount: Math.floor(R() * 90),
    inquiryCount: Math.floor(R() * 24),
    publisher: source === "fourwalls" ? "Fourwalls AG" : (agentur || person),
    contactOptions: source === "fourwalls" ? ["form","call"] : chance(0.7) ? ["form","call"] : ["form"],
    demo: true
  });
}

/* Ein paar bestehende FW-Objekte als Exclusive-Mandate referenzieren */
const EXKLUSIV = ["seehaus-walensee","penthouse-zuerichberg","villa-collina-doro","champel-geneve","chalet-andermatt","stadthaus-enge"];

const out = `/* FOURWALLS Marktplatz-Datensatz — GENERIERT von tools/gen-listings.js (Seed 4711).
   FIKTIVE DEMO-DATEN. Nicht von Hand editieren — Generator anpassen und neu laufen lassen. */
window.FWL = {
  exklusiv: ${JSON.stringify(EXKLUSIV)},
  typen: ${JSON.stringify(Object.fromEntries(Object.entries(TYPEN).map(([k,v]) => [k, v.de])))},
  quellen: { fourwalls:"Fourwalls", privat:"Privat", agentur:"Makler", verwaltung:"Verwaltung", entwickler:"Bauträger" },
  listings: ${JSON.stringify(listings)}
};
`;
fs.writeFileSync(process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, "..", "data", "listings.js"), out);
const stats = {};
for (const l of listings){ stats[l.transactionType] = (stats[l.transactionType] || 0) + 1; }
console.log("OK listings — " + listings.length + " Inserate", stats);
