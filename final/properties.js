/* FOURWALLS – Demo-Portfolio. FIKTIVE DEMO-DATEN, keine realen Objekte.
   Schema deckt Brief §15 ab; CMS-ready. Bilder werden vom Inliner als data-URIs unter window.FW_IMG[key] bereitgestellt. */
window.FW = (function () {
  const t = {
    rooms: { de: "Zimmer", en: "rooms", fr: "pièces", it: "locali" },
    livingArea: { de: "Wohnfläche", en: "Living area", fr: "Surface habitable", it: "Superficie abitabile" },
    plotArea: { de: "Grundstück", en: "Plot", fr: "Terrain", it: "Terreno" },
    floor: { de: "Etage", en: "Floor", fr: "Étage", it: "Piano" },
    yearBuilt: { de: "Baujahr", en: "Built", fr: "Construction", it: "Anno di costruzione" },
    yearRenovated: { de: "Renoviert", en: "Renovated", fr: "Rénové", it: "Ristrutturato" },
    availability: { de: "Verfügbar", en: "Available", fr: "Disponible", it: "Disponibile" },
    reference: { de: "Referenz", en: "Reference", fr: "Référence", it: "Riferimento" },
    price: { de: "Kaufpreis", en: "Price", fr: "Prix", it: "Prezzo" },
    rentNet: { de: "Nettomiete", en: "Net rent", fr: "Loyer net", it: "Affitto netto" },
    rentNK: { de: "Nebenkosten", en: "Service charges", fr: "Charges", it: "Spese accessorie" },
    perMonth: { de: "/ Monat", en: "/ month", fr: "/ mois", it: "/ mese" },
    onRequest: { de: "Preis auf Anfrage", en: "Price on request", fr: "Prix sur demande", it: "Prezzo su richiesta" },
    buy: { de: "Kaufen", en: "Buy", fr: "Acheter", it: "Comprare" },
    rent: { de: "Mieten", en: "Rent", fr: "Louer", it: "Affittare" },
    grossYield: { de: "Bruttorendite", en: "Gross yield", fr: "Rendement brut", it: "Rendimento lordo" },
    newBuild: { de: "Neubau", en: "New build", fr: "Construction neuve", it: "Nuova costruzione" },
    investment: { de: "Renditeobjekt", en: "Investment", fr: "Immeuble de rendement", it: "Investimento" },
    immediately: { de: "sofort", en: "immediately", fr: "de suite", it: "subito" },
    byArrangement: { de: "nach Vereinbarung", en: "by arrangement", fr: "à convenir", it: "da concordare" },
    demo: { de: "Demo-Objekt (fiktiv)", en: "Demo listing (fictional)", fr: "Objet de démonstration (fictif)", it: "Oggetto dimostrativo (fittizio)" },
    minTransit: { de: "ÖV", en: "Transit", fr: "TP", it: "TP" },
    minSchool: { de: "Schule", en: "School", fr: "École", it: "Scuola" },
    minShop: { de: "Einkauf", en: "Shops", fr: "Commerces", it: "Negozi" },
    minStation: { de: "Bahnhof", en: "Station", fr: "Gare", it: "Stazione" },
    features: {
      lift: { de: "Lift", en: "Lift", fr: "Ascenseur", it: "Ascensore" },
      balcony: { de: "Balkon", en: "Balcony", fr: "Balcon", it: "Balcone" },
      terrace: { de: "Terrasse", en: "Terrace", fr: "Terrasse", it: "Terrazza" },
      garden: { de: "Garten", en: "Garden", fr: "Jardin", it: "Giardino" },
      garage: { de: "Garage", en: "Garage", fr: "Garage", it: "Garage" },
      parking: { de: "Parkplatz", en: "Parking", fr: "Place de parc", it: "Posteggio" },
      minergie: { de: "Minergie", en: "Minergie", fr: "Minergie", it: "Minergie" },
      lakeview: { de: "Seeblick", en: "Lake view", fr: "Vue lac", it: "Vista lago" },
      mountainview: { de: "Bergsicht", en: "Mountain view", fr: "Vue montagnes", it: "Vista montagne" },
      fireplace: { de: "Cheminée", en: "Fireplace", fr: "Cheminée", it: "Camino" },
      parquet: { de: "Parkett", en: "Parquet", fr: "Parquet", it: "Parquet" },
      floorheating: { de: "Bodenheizung", en: "Underfloor heating", fr: "Chauffage au sol", it: "Riscaldamento a pavimento" },
      cellar: { de: "Keller", en: "Cellar", fr: "Cave", it: "Cantina" },
      washtower: { de: "Waschturm", en: "Laundry", fr: "Colonne de lavage", it: "Lavatrice/asciugatrice" },
      pool: { de: "Pool", en: "Pool", fr: "Piscine", it: "Piscina" },
      sauna: { de: "Sauna", en: "Sauna", fr: "Sauna", it: "Sauna" },
      evcharging: { de: "E-Ladestation", en: "EV charging", fr: "Borne de recharge", it: "Ricarica EV" },
      concierge: { de: "Concierge", en: "Concierge", fr: "Conciergerie", it: "Portineria" }
    },
    docs: {
      dossier: { de: "Verkaufsdokumentation (PDF)", en: "Sales documentation (PDF)", fr: "Dossier de vente (PDF)", it: "Documentazione di vendita (PDF)" },
      grundriss: { de: "Grundrisse (PDF)", en: "Floor plans (PDF)", fr: "Plans (PDF)", it: "Piante (PDF)" },
      factsheet: { de: "Factsheet (PDF)", en: "Factsheet (PDF)", fr: "Factsheet (PDF)", it: "Factsheet (PDF)" }
    }
  };

  const brokers = [
    { id: "lf", name: "Lena Furrer", role: { de: "Leitung Verkauf Zürich", en: "Head of Sales Zurich", fr: "Responsable ventes Zurich", it: "Responsabile vendite Zurigo" }, phone: "+41 44 555 01 01", email: "lena.furrer@fourwalls.example", langs: ["DE", "EN"] },
    { id: "ma", name: "Marc Aebischer", role: { de: "Verkauf Bern & Mittelland", en: "Sales Bern & Mittelland", fr: "Ventes Berne & Plateau", it: "Vendite Berna" }, phone: "+41 31 555 01 02", email: "marc.aebischer@fourwalls.example", langs: ["DE", "FR"] },
    { id: "cr", name: "Camille Roud", role: { de: "Verkauf Romandie", en: "Sales Romandie", fr: "Ventes Suisse romande", it: "Vendite Romandia" }, phone: "+41 21 555 01 03", email: "camille.roud@fourwalls.example", langs: ["FR", "EN"] },
    { id: "gc", name: "Giulia Conti", role: { de: "Verkauf Ticino", en: "Sales Ticino", fr: "Ventes Tessin", it: "Vendite Ticino" }, phone: "+41 91 555 01 04", email: "giulia.conti@fourwalls.example", langs: ["IT", "DE", "EN"] },
    { id: "jb", name: "Jonas Berger", role: { de: "Leitung Bewirtschaftung", en: "Head of Property Management", fr: "Responsable gérance", it: "Responsabile amministrazione" }, phone: "+41 44 555 01 05", email: "jonas.berger@fourwalls.example", langs: ["DE", "EN"] }
  ];

  /* img: keys into window.FW_IMG (data-URIs injected by tools/inline.js) */
  const properties = [
    {
      id: "FW-2026-001", slug: "seehaus-walensee", status: "active", transactionType: "buy", propertyType: "house",
      title: { de: "Seehaus Walensee", en: "Seehaus Walensee", fr: "Seehaus Walensee", it: "Seehaus Walensee" },
      tagline: { de: "Beton, Glas und ein See, der die Wände färbt.", en: "Concrete, glass, and a lake that colours the walls.", fr: "Béton, verre et un lac qui teinte les murs.", it: "Cemento, vetro e un lago che colora le pareti." },
      street: "Seestrasse 41", postalCode: "8883", city: "Quarten", canton: "SG", country: "CH", lat: 47.1132, lng: 9.2151,
      price: 5480000, priceOnRequest: false, rooms: 5.5, bedrooms: 4, bathrooms: 3, livingArea: 289, plotArea: 1120,
      yearBuilt: 2019, floor: null, parking: 3,
      blurb: {
        de: "Ein stilles Haus über dem Walensee: zwei auskragende Geschosse, raumhohes Glas gegen Süden, Sichtbeton, Eiche und ein Garten, der direkt in den Abend übergeht.",
        en: "A quiet house above Lake Walen: two cantilevered floors, full-height glazing to the south, exposed concrete, oak, and a garden that runs straight into the evening.",
        fr: "Une maison silencieuse au-dessus du lac de Walenstadt : deux niveaux en porte-à-faux, vitrages toute hauteur au sud, béton apparent et chêne.",
        it: "Una casa silenziosa sopra il lago di Walenstadt: due piani a sbalzo, vetrate a tutta altezza verso sud, cemento a vista e rovere."
      },
      description: {
        de: "Das Seehaus wurde 2019 von einem Zürcher Architekturbüro als privater Rückzugsort gebaut. Der Grundriss folgt dem Licht: Küche und Essbereich öffnen sich nach Osten zur Morgensonne, der Wohnraum mit Cheminée liegt gegen den See, das Hauptschlafzimmer mit Ankleide und Bad besetzt das gesamte Obergeschoss-Südende. Materialien: geschliffener Sichtbeton, Eichenparkett, Naturstein in den Bädern. Die Umgebung bleibt bewusst zurückhaltend – Wiese, acht Obstbäume, ein Badeplatz am Ufer in drei Gehminuten. Technik: Wärmepumpe mit Erdsonde, PV-Anlage 12 kWp, E-Ladestationen, Minergie-zertifiziert.",
        en: "Seehaus was built in 2019 by a Zurich practice as a private retreat. The plan follows the light: kitchen and dining open east to the morning sun, the living room with fireplace faces the lake, and the main bedroom with dressing room and bath occupies the entire southern end upstairs. Materials: polished exposed concrete, oak parquet, natural stone bathrooms. The grounds stay deliberately quiet – meadow, eight fruit trees, a swimming spot three minutes on foot. Ground-source heat pump, 12 kWp PV, EV charging, Minergie-certified.",
        fr: "Construite en 2019 par un bureau zurichois comme refuge privé, la maison suit la lumière : cuisine et salle à manger ouvertes à l'est, séjour avec cheminée face au lac, chambre principale avec dressing occupant tout le sud de l'étage. Béton poli, parquet en chêne, pierre naturelle. Pompe à chaleur géothermique, photovoltaïque 12 kWp, certification Minergie.",
        it: "Costruita nel 2019 da uno studio zurighese come rifugio privato, la casa segue la luce: cucina e pranzo aperti a est, soggiorno con camino verso il lago, camera principale con cabina armadio su tutto il lato sud del piano superiore. Cemento levigato, parquet di rovere, pietra naturale. Pompa di calore geotermica, fotovoltaico 12 kWp, certificazione Minergie."
      },
      highlights: {
        de: ["Unverbaubarer Seeblick", "Architektur 2019, Minergie", "1'120 m² Umschwung", "3 Min. zum Badeplatz"],
        en: ["Unobstructable lake view", "2019 architecture, Minergie", "1,120 m² grounds", "3 min to swimming spot"],
        fr: ["Vue lac imprenable", "Architecture 2019, Minergie", "1 120 m² de terrain", "Baignade à 3 min"],
        it: ["Vista lago non edificabile", "Architettura 2019, Minergie", "1'120 m² di terreno", "Riva a 3 minuti"]
      },
      features: ["lakeview", "mountainview", "fireplace", "parquet", "floorheating", "minergie", "garage", "terrace", "garden", "evcharging"],
      images: ["lakeside-villa-1", "lakeside-villa-2", "penthouse-2", "kitchen-1", "interior-bright-1"], heroMedia: "lakeside-villa-1",
      roomsBreakdown: [["Wohnen/Essen", 68], ["Küche", 24], ["Hauptschlafzimmer", 32], ["Schlafzimmer 2", 18], ["Schlafzimmer 3", 16], ["Schlafzimmer 4", 15], ["Bad 1", 12], ["Bad 2", 9], ["Bad 3", 6], ["Arbeiten", 14], ["Keller/Technik", 42]],
      documents: ["dossier", "grundriss", "factsheet"], energyData: { geak: "A", heating: { de: "Erdsonden-Wärmepumpe", en: "Ground-source heat pump", fr: "PAC géothermique", it: "Pompa di calore geotermica" } },
      availability: "byArrangement", distances: { transit: 4, school: 9, shop: 6, station: 8 },
      broker: "lf", featured: true, newDevelopment: false, investmentProperty: false,
      createdAt: "2026-05-12", updatedAt: "2026-08-20", demo: true
    },
    {
      id: "FW-2026-002", slug: "stadthaus-enge", status: "active", transactionType: "buy", propertyType: "apartment",
      title: { de: "Altbau in der Enge", en: "Altbau in Enge", fr: "Ancien à Enge", it: "Epoca a Enge" },
      tagline: { de: "Hohe Räume, Fischgrat, und die Stadt vor der Tür.", en: "High ceilings, herringbone floors, the city at your door.", fr: "Hauts plafonds, point de Hongrie, la ville à la porte.", it: "Soffitti alti, spina di pesce, la città alla porta." },
      street: "Bederstrasse 88", postalCode: "8002", city: "Zürich", canton: "ZH", country: "CH", lat: 47.3626, lng: 8.5312,
      price: 1690000, priceOnRequest: false, rooms: 3.5, bedrooms: 2, bathrooms: 1, livingArea: 96, plotArea: null,
      yearBuilt: 1912, yearRenovated: 2021, floor: 3, parking: 0,
      blurb: {
        de: "Sandstein-Altbau von 1912, 2021 sorgfältig erneuert: 3.5 Zimmer im dritten Obergeschoss mit Fischgratparkett, Stuck und Morgensonne im Erker.",
        en: "A 1912 sandstone building, carefully renewed in 2021: 3.5 rooms on the third floor with herringbone parquet, stucco and morning sun in the bay window.",
        fr: "Immeuble en grès de 1912, rénové avec soin en 2021 : 3,5 pièces au troisième étage, parquet en point de Hongrie et stucs.",
        it: "Palazzo in arenaria del 1912, rinnovato con cura nel 2021: 3.5 locali al terzo piano con parquet a spina di pesce e stucchi."
      },
      description: {
        de: "Die Wohnung liegt im dritten Obergeschoss eines gepflegten Jugendstilhauses zwischen Rieterpark und Bahnhof Enge. Erneuert wurden Küche, Bad, Elektro und Fenster; erhalten blieben Fischgratparkett, Flügeltüren und Stuckprofile. Der Erker gegen Osten macht das Wohnzimmer zum hellsten Raum des Hauses. Keller und Veloraum vorhanden, ÖV in zwei Gehminuten.",
        en: "The flat sits on the third floor of a well-kept Art Nouveau building between Rieterpark and Enge station. Kitchen, bath, wiring and windows were renewed; herringbone parquet, double doors and stucco remain. The east-facing bay window makes the living room the brightest in the house.",
        fr: "Au troisième étage d'un immeuble Art nouveau soigné entre le Rieterpark et la gare d'Enge. Cuisine, salle de bains, électricité et fenêtres rénovées ; parquet, portes à deux battants et stucs conservés.",
        it: "Al terzo piano di una curata casa liberty tra il Rieterpark e la stazione di Enge. Cucina, bagno, impianti e finestre rinnovati; parquet, porte a due ante e stucchi conservati."
      },
      highlights: { de: ["Erker mit Morgensonne", "Kernsanierung 2021", "2 Min. zum Bahnhof Enge"], en: ["Bay window, morning sun", "Fully renewed 2021", "2 min to Enge station"], fr: ["Bow-window au levant", "Rénovation 2021", "Gare d'Enge à 2 min"], it: ["Bovindo al mattino", "Risanamento 2021", "Stazione a 2 min"] },
      features: ["parquet", "lift", "cellar", "washtower"],
      images: ["zurich-altbau-1", "interior-bright-1", "kitchen-1"], heroMedia: "zurich-altbau-1",
      documents: ["dossier", "grundriss"], energyData: { geak: "C" },
      availability: "byArrangement", distances: { transit: 2, school: 6, shop: 3, station: 2 },
      broker: "lf", featured: true, newDevelopment: false, investmentProperty: false,
      createdAt: "2026-06-02", updatedAt: "2026-08-18", demo: true
    },
    {
      id: "FW-2026-003", slug: "penthouse-zuerichberg", status: "active", transactionType: "buy", propertyType: "apartment",
      title: { de: "Penthouse am Zürichberg", en: "Zürichberg Penthouse", fr: "Attique au Zürichberg", it: "Attico allo Zürichberg" },
      tagline: { de: "Die Stadt als Lichtermeer, der See als Horizont.", en: "The city as a sea of lights, the lake as horizon.", fr: "La ville en nappe de lumières, le lac en horizon.", it: "La città come mare di luci, il lago come orizzonte." },
      street: "Bergstrasse 152", postalCode: "8032", city: "Zürich", canton: "ZH", country: "CH", lat: 47.3767, lng: 8.5623,
      price: 4850000, priceOnRequest: false, rooms: 4.5, bedrooms: 3, bathrooms: 2, livingArea: 187, plotArea: null,
      yearBuilt: 2016, floor: 6, parking: 2,
      blurb: {
        de: "4.5-Zimmer-Attika mit 62 m² umlaufender Terrasse: Walnuss, Naturstein, raumhohe Verglasung – und abends liegt Zürich zu Füssen.",
        en: "A 4.5-room attic with a 62 m² wrap-around terrace: walnut, stone, full-height glazing – and at night Zurich lies at your feet.",
        fr: "Attique de 4,5 pièces, terrasse filante de 62 m² : noyer, pierre, vitrages toute hauteur – Zurich à vos pieds le soir.",
        it: "Attico di 4.5 locali con terrazza di 62 m²: noce, pietra, vetrate a tutta altezza – e la sera Zurigo ai vostri piedi."
      },
      description: {
        de: "Oberstes Geschoss eines Sechsfamilienhauses von 2016 in zweiter Bauline am Zürichberg. Offene Küche mit Kochinsel in Naturstein, Wohnbereich mit Cheminée, Hauptschlafzimmer mit Ankleide und en-suite Bad. Lift direkt in die Wohnung, Doppelgarage, Weinkeller.",
        en: "Top floor of a six-unit 2016 building on Zürichberg. Open kitchen with stone island, living area with fireplace, main bedroom with dressing and en-suite. Lift opens into the flat; double garage, wine cellar.",
        fr: "Dernier étage d'un immeuble de 2016 au Zürichberg. Cuisine ouverte avec îlot en pierre, séjour avec cheminée, suite parentale. Ascenseur privatif, double garage, cave à vin.",
        it: "Ultimo piano di una palazzina del 2016 allo Zürichberg. Cucina aperta con isola in pietra, soggiorno con camino, camera padronale en-suite. Ascensore privato, doppio garage, cantina vini."
      },
      highlights: { de: ["62 m² Terrasse", "Lift in die Wohnung", "See- und Stadtblick"], en: ["62 m² terrace", "Private lift access", "Lake & city views"], fr: ["Terrasse de 62 m²", "Ascenseur privatif", "Vue lac et ville"], it: ["Terrazza di 62 m²", "Ascensore privato", "Vista lago e città"] },
      features: ["lakeview", "terrace", "fireplace", "lift", "garage", "floorheating", "cellar"],
      images: ["penthouse-1", "penthouse-2", "kitchen-1"], heroMedia: "penthouse-1",
      documents: ["dossier", "grundriss", "factsheet"], energyData: { geak: "B" },
      availability: "byArrangement", distances: { transit: 3, school: 8, shop: 5, station: 12 },
      broker: "lf", featured: true, newDevelopment: false, investmentProperty: false,
      createdAt: "2026-04-28", updatedAt: "2026-08-25", demo: true
    },
    {
      id: "FW-2026-004", slug: "neubau-zug", status: "active", transactionType: "buy", propertyType: "apartment",
      title: { de: "Parkresidenz Zug", en: "Parkresidenz Zug", fr: "Parkresidenz Zoug", it: "Parkresidenz Zugo" },
      tagline: { de: "Neubau mit Haltung: Beton, Grün und Zuger Pragmatismus.", en: "A new build with a spine: concrete, greenery, Zug pragmatism.", fr: "Du neuf avec du caractère : béton, verdure, pragmatisme zougois.", it: "Nuova costruzione con carattere: cemento, verde, pragmatismo zughese." },
      street: "Chamerstrasse 21", postalCode: "6300", city: "Zug", canton: "ZG", country: "CH", lat: 47.1723, lng: 8.5089,
      price: 2350000, priceOnRequest: false, rooms: 4.5, bedrooms: 3, bathrooms: 2, livingArea: 132, plotArea: null,
      yearBuilt: 2027, floor: 4, parking: 1,
      blurb: {
        de: "4.5 Zimmer im Erstbezug: durchgesteckter Grundriss, 18 m² Loggia mit Bepflanzung, Minergie-P – Bezug Frühjahr 2027.",
        en: "First occupancy, 4.5 rooms: through-plan layout, 18 m² planted loggia, Minergie-P – ready spring 2027.",
        fr: "Premier emménagement, 4,5 pièces : plan traversant, loggia végétalisée de 18 m², Minergie-P – printemps 2027.",
        it: "Prima occupazione, 4.5 locali: pianta passante, loggia verde di 18 m², Minergie-P – primavera 2027."
      },
      description: {
        de: "Die Parkresidenz ersetzt ein Gewerbehaus durch 14 Eigentumswohnungen um einen gemeinsamen Hof. Wohnung 4.02 liegt durchgesteckt Ost-West, mit offener Küche, zwei Nasszellen und begrünter Loggia. Käuferinnen wählen bis Oktober 2026 Parkett und Küchenfronten. Minergie-P, Erdsonden, PV, E-Ladestationen in der Einstellhalle.",
        en: "Parkresidenz replaces a commercial building with 14 condominiums around a shared courtyard. Unit 4.02 runs east–west with open kitchen, two bathrooms and a planted loggia. Buyers choose parquet and kitchen fronts until October 2026. Minergie-P, ground loops, PV, EV charging.",
        fr: "14 appartements en PPE autour d'une cour commune. Le lot 4.02, traversant est-ouest, offre cuisine ouverte, deux salles d'eau et loggia végétalisée. Choix des finitions jusqu'en octobre 2026. Minergie-P.",
        it: "14 appartamenti PPP attorno a una corte comune. L'unità 4.02, passante est-ovest, offre cucina aperta, due bagni e loggia verde. Finiture a scelta fino a ottobre 2026. Minergie-P."
      },
      highlights: { de: ["Erstbezug Frühjahr 2027", "Ausbau wählbar bis Okt. 2026", "Minergie-P"], en: ["First occupancy spring 2027", "Finishes selectable to Oct 2026", "Minergie-P"], fr: ["Livraison printemps 2027", "Finitions au choix", "Minergie-P"], it: ["Consegna primavera 2027", "Finiture a scelta", "Minergie-P"] },
      features: ["minergie", "lift", "balcony", "floorheating", "evcharging", "cellar"],
      images: ["condo-modern-1", "condo-modern-2", "interior-bright-2"], heroMedia: "condo-modern-1",
      documents: ["dossier", "grundriss", "factsheet"], energyData: { geak: "A" },
      availability: "2027", distances: { transit: 3, school: 7, shop: 4, station: 9 },
      broker: "lf", featured: false, newDevelopment: true, investmentProperty: false,
      createdAt: "2026-07-01", updatedAt: "2026-08-22", demo: true
    },
    {
      id: "FW-2026-005", slug: "seeblick-luzern", status: "active", transactionType: "buy", propertyType: "apartment",
      title: { de: "Seeblick Luzern", en: "Seeblick Lucerne", fr: "Vue lac Lucerne", it: "Vista lago Lucerna" },
      tagline: { de: "Pilatus links, Rigi rechts, dazwischen Ihr Abend.", en: "Pilatus to the left, Rigi to the right, your evening in between.", fr: "Le Pilate à gauche, la Rigi à droite, votre soirée entre les deux.", it: "Il Pilatus a sinistra, la Rigi a destra, la vostra sera nel mezzo." },
      street: "Haldenstrasse 9", postalCode: "6006", city: "Luzern", canton: "LU", country: "CH", lat: 47.0571, lng: 8.3245,
      price: 2380000, priceOnRequest: false, rooms: 4.5, bedrooms: 3, bathrooms: 2, livingArea: 141, plotArea: null,
      yearBuilt: 1998, yearRenovated: 2023, floor: 5, parking: 1,
      blurb: {
        de: "4.5 Zimmer im fünften Stock mit Blick über das Seebecken: 2023 vollständig erneuert, mit offener Küche in Eiche und Bad in Travertin.",
        en: "4.5 rooms on the fifth floor overlooking the lake basin: fully renewed in 2023 with an oak kitchen and travertine bath.",
        fr: "4,5 pièces au cinquième avec vue sur la baie : entièrement rénové en 2023, cuisine en chêne, salle de bains en travertin.",
        it: "4.5 locali al quinto piano con vista sul golfo: rinnovato nel 2023, cucina in rovere, bagno in travertino."
      },
      description: {
        de: "Die Wohnung liegt an der Haldenstrasse, wenige Schritte vom See. Der Wohnraum öffnet sich über Eckverglasung zum Wasser; die Loggia ist windgeschützt und abends sonnig. Erneuert 2023: Küche, Bäder, Böden, Storen. Einstellhallenplatz inbegriffen.",
        en: "Steps from the lake on Haldenstrasse. The living room opens to the water through corner glazing; the loggia is sheltered and catches the evening sun. Renewed 2023: kitchen, baths, floors, blinds. Garage space included.",
        fr: "À quelques pas du lac. Le séjour s'ouvre sur l'eau par un vitrage d'angle ; loggia abritée, ensoleillée le soir. Rénové en 2023. Place de garage incluse.",
        it: "A pochi passi dal lago. Il soggiorno si apre sull'acqua con vetrata d'angolo; loggia riparata e soleggiata la sera. Rinnovato nel 2023. Posto auto incluso."
      },
      highlights: { de: ["Seeblick aus allen Wohnräumen", "Renovation 2023", "Einstellhallenplatz inklusive"], en: ["Lake view from every room", "2023 renovation", "Garage space included"], fr: ["Vue lac de toutes les pièces", "Rénovation 2023", "Garage inclus"], it: ["Vista lago da ogni stanza", "Rinnovo 2023", "Garage incluso"] },
      features: ["lakeview", "mountainview", "balcony", "lift", "parquet", "cellar"],
      images: ["penthouse-2", "interior-bright-2", "kitchen-1"], heroMedia: "penthouse-2",
      documents: ["dossier", "grundriss"], energyData: { geak: "C" },
      availability: "byArrangement", distances: { transit: 2, school: 9, shop: 4, station: 14 },
      broker: "lf", featured: false, newDevelopment: false, investmentProperty: false,
      createdAt: "2026-06-19", updatedAt: "2026-08-15", demo: true
    },
    {
      id: "FW-2026-006", slug: "familienhaus-koeniz", status: "active", transactionType: "buy", propertyType: "house",
      title: { de: "Familienhaus Köniz", en: "Family house Köniz", fr: "Maison familiale Köniz", it: "Casa familiare Köniz" },
      tagline: { de: "Lärchenholz, Apfelbäume und Platz zum Grosswerden.", en: "Larch wood, apple trees, and room to grow up in.", fr: "Mélèze, pommiers et de la place pour grandir.", it: "Larice, meli e spazio per crescere." },
      street: "Sonnhaldeweg 14", postalCode: "3098", city: "Köniz", canton: "BE", country: "CH", lat: 46.9244, lng: 7.4147,
      price: 1450000, priceOnRequest: false, rooms: 5.5, bedrooms: 4, bathrooms: 2, livingArea: 172, plotArea: 640,
      yearBuilt: 2011, floor: null, parking: 2,
      blurb: {
        de: "Holzelementbau von 2011 mit gedeckter Veranda, 640 m² Garten und Schulweg ohne Strassenquerung – zehn Minuten vor Bern.",
        en: "A 2011 timber-element house with covered veranda, a 640 m² garden and a walk to school without crossing a road – ten minutes from Bern.",
        fr: "Maison à ossature bois de 2011, véranda couverte, jardin de 640 m², école accessible sans traverser de route – à dix minutes de Berne.",
        it: "Casa in legno del 2011 con veranda coperta, giardino di 640 m² e scuola raggiungibile senza attraversare strade – a dieci minuti da Berna."
      },
      description: {
        de: "Das Haus steht am Südrand eines ruhigen Quartiers: Küche/Essen/Wohnen im Erdgeschoss als ein Raum mit Ausgang zur Veranda, vier Zimmer und zwei Bäder im Obergeschoss, ausgebauter Hobbyraum im Untergeschoss. Pelletheizung, Regenwassertank, Doppelcarport mit E-Anschluss.",
        en: "On the southern edge of a quiet neighbourhood: kitchen/dining/living as one ground-floor space opening to the veranda, four rooms and two baths upstairs, finished hobby room below. Pellet heating, rainwater tank, double carport with EV outlet.",
        fr: "En lisière sud d'un quartier calme : cuisine/séjour d'un seul tenant ouvrant sur la véranda, quatre chambres et deux salles d'eau à l'étage. Chauffage à pellets, carport double avec prise EV.",
        it: "Al margine sud di un quartiere tranquillo: cucina/soggiorno unico aperto sulla veranda, quattro camere e due bagni al piano. Riscaldamento a pellet, doppio carport con presa EV."
      },
      highlights: { de: ["Sicherer Schulweg", "640 m² Garten", "Veranda gegen Abendsonne"], en: ["Safe walk to school", "640 m² garden", "Evening-sun veranda"], fr: ["Chemin d'école sûr", "Jardin de 640 m²", "Véranda au couchant"], it: ["Percorso scuola sicuro", "Giardino di 640 m²", "Veranda al tramonto"] },
      features: ["garden", "terrace", "parking", "fireplace", "cellar", "evcharging"],
      images: ["family-house-1", "family-house-2", "kitchen-1"], heroMedia: "family-house-1",
      documents: ["dossier", "grundriss"], energyData: { geak: "B" },
      availability: "2026-12-01", distances: { transit: 5, school: 4, shop: 6, station: 11 },
      broker: "ma", featured: false, newDevelopment: false, investmentProperty: false,
      createdAt: "2026-07-14", updatedAt: "2026-08-19", demo: true
    },
    {
      id: "FW-2026-007", slug: "stalban-basel", status: "active", transactionType: "buy", propertyType: "apartment",
      title: { de: "St. Alban, Basel", en: "St. Alban, Basel", fr: "St. Alban, Bâle", it: "St. Alban, Basilea" },
      tagline: { de: "Altbaucharme im Gundeldinger Gegenlicht.", en: "Period charm in Basel's low evening light.", fr: "Charme ancien dans la lumière du soir bâloise.", it: "Fascino d'epoca nella luce serale di Basilea." },
      street: "St. Alban-Ring 33", postalCode: "4052", city: "Basel", canton: "BS", country: "CH", lat: 47.5502, lng: 7.6067,
      price: 1120000, priceOnRequest: false, rooms: 3.5, bedrooms: 2, bathrooms: 1, livingArea: 88, plotArea: null,
      yearBuilt: 1926, yearRenovated: 2019, floor: 2, parking: 0,
      blurb: {
        de: "3.5 Zimmer im zweiten Obergeschoss: Riemenparkett, hohe Fenster, ruhiger Innenhof – zwischen Rhein und St. Alban-Tor.",
        en: "3.5 rooms on the second floor: strip parquet, tall windows, a quiet courtyard – between the Rhine and St. Alban gate.",
        fr: "3,5 pièces au deuxième : parquet, hautes fenêtres, cour calme – entre le Rhin et la porte de St. Alban.",
        it: "3.5 locali al secondo piano: parquet, finestre alte, corte tranquilla – tra il Reno e la porta di St. Alban."
      },
      description: {
        de: "Gepflegtes Mehrfamilienhaus von 1926 mit renovierter Gebäudehülle (2019). Die Wohnung behält ihre Substanz – Parkett, Türfüllungen, hohe Decken – und erhält eine neue offene Küche. Estrich- und Kellerabteil, Veloraum im Hof.",
        en: "A well-kept 1926 building with a renewed envelope (2019). The flat keeps its substance – parquet, panel doors, high ceilings – and gains a new open kitchen. Attic and cellar compartments, courtyard bike room.",
        fr: "Immeuble soigné de 1926, enveloppe rénovée en 2019. L'appartement garde sa substance et gagne une cuisine ouverte neuve. Galetas et cave.",
        it: "Palazzina curata del 1926, involucro rinnovato nel 2019. L'appartamento conserva la sua sostanza e guadagna una nuova cucina aperta. Solaio e cantina."
      },
      highlights: { de: ["Ruhiger Innenhof", "Rhein in 5 Minuten", "Substanz von 1926"], en: ["Quiet courtyard", "Rhine in 5 minutes", "1926 substance"], fr: ["Cour calme", "Rhin à 5 minutes", "Substance de 1926"], it: ["Corte tranquilla", "Reno a 5 minuti", "Sostanza del 1926"] },
      features: ["parquet", "cellar", "washtower"],
      images: ["zurich-altbau-2", "interior-bright-1", "kitchen-1"], heroMedia: "zurich-altbau-2",
      documents: ["dossier", "grundriss"], energyData: { geak: "D" },
      availability: "immediately", distances: { transit: 3, school: 7, shop: 4, station: 10 },
      broker: "ma", featured: false, newDevelopment: false, investmentProperty: false,
      createdAt: "2026-08-01", updatedAt: "2026-08-24", demo: true
    },
    {
      id: "FW-2026-008", slug: "champel-geneve", status: "active", transactionType: "buy", propertyType: "apartment",
      title: { de: "Résidence Champel", en: "Résidence Champel", fr: "Résidence Champel", it: "Résidence Champel" },
      tagline: { de: "Genfer Bürgerlichkeit mit Schmiedeeisen und Abendlicht.", en: "Geneva grandeur with wrought iron and evening light.", fr: "L'élégance genevoise, fer forgé et lumière du soir.", it: "Eleganza ginevrina, ferro battuto e luce della sera." },
      street: "Avenue de Champel 47", postalCode: "1206", city: "Genève", canton: "GE", country: "CH", lat: 46.1943, lng: 6.1541,
      price: 2250000, priceOnRequest: false, rooms: 4, bedrooms: 2, bathrooms: 2, livingArea: 118, plotArea: null,
      yearBuilt: 1904, yearRenovated: 2017, floor: 3, parking: 1,
      blurb: {
        de: "4 pièces im dritten Stock eines Steinhauses von 1904: Balkone mit Schmiedeeisen, 3.2 m Raumhöhe, Lift und Garage.",
        en: "A 4-pièces on the third floor of a 1904 stone building: wrought-iron balconies, 3.2 m ceilings, lift and garage.",
        fr: "4 pièces au troisième étage d'un immeuble en pierre de 1904 : balcons en fer forgé, 3,2 m sous plafond, ascenseur et garage.",
        it: "4 locali al terzo piano di un palazzo in pietra del 1904: balconi in ferro battuto, soffitti di 3,2 m, ascensore e garage."
      },
      description: {
        de: "Champel bleibt Genfs ruhigstes Stadtquartier. Die Wohnung – Genfer Zählweise, entspricht 3.5 Zimmern Deutschschweizer Lesart – verbindet Salon und Esszimmer über Flügeltüren; beide öffnen auf den Balkon gegen die Allee.",
        en: "Champel remains Geneva's calmest urban quarter. The flat – Geneva counting, roughly a Swiss-German 3.5 – joins salon and dining room through double doors, both opening onto the tree-lined avenue balcony.",
        fr: "Champel reste le quartier le plus paisible de Genève. Salon et salle à manger communiquent par portes à deux battants et ouvrent sur le balcon côté allée.",
        it: "Champel resta il quartiere più tranquillo di Ginevra. Salone e sala da pranzo comunicano con porte a due ante e si aprono sul balcone alberato."
      },
      highlights: { de: ["3.2 m Raumhöhe", "Garage im Haus", "Parc Bertrand in 4 Min."], en: ["3.2 m ceilings", "In-house garage", "Parc Bertrand 4 min"], fr: ["3,2 m sous plafond", "Garage dans l'immeuble", "Parc Bertrand à 4 min"], it: ["Soffitti di 3,2 m", "Garage nello stabile", "Parc Bertrand a 4 min"] },
      features: ["balcony", "lift", "garage", "parquet", "fireplace"],
      images: ["geneva-facade-1", "interior-bright-2", "kitchen-1"], heroMedia: "geneva-facade-1",
      documents: ["dossier", "grundriss"], energyData: { geak: "D" },
      availability: "byArrangement", distances: { transit: 3, school: 5, shop: 4, station: 12 },
      broker: "cr", featured: true, newDevelopment: false, investmentProperty: false,
      createdAt: "2026-05-30", updatedAt: "2026-08-21", demo: true
    },
    {
      id: "FW-2026-009", slug: "ouchy-lausanne", status: "active", transactionType: "buy", propertyType: "apartment",
      title: { de: "Sous-gare, Lausanne", en: "Sous-gare, Lausanne", fr: "Sous-gare, Lausanne", it: "Sous-gare, Losanna" },
      tagline: { de: "Helle Zimmer zwischen Bahnhof und Ouchy.", en: "Bright rooms between the station and Ouchy.", fr: "Des pièces claires entre la gare et Ouchy.", it: "Stanze luminose tra la stazione e Ouchy." },
      street: "Avenue d'Ouchy 28", postalCode: "1006", city: "Lausanne", canton: "VD", country: "CH", lat: 46.5122, lng: 6.6301,
      price: 1240000, priceOnRequest: false, rooms: 3.5, bedrooms: 2, bathrooms: 1, livingArea: 92, plotArea: null,
      yearBuilt: 1958, yearRenovated: 2022, floor: 4, parking: 0,
      blurb: {
        de: "3.5 pièces im vierten Stock, 2022 hell und präzise erneuert; der Léman liegt acht Gehminuten talwärts.",
        en: "A 3.5-pièces on the fourth floor, renewed brightly and precisely in 2022; Lake Geneva is eight minutes downhill.",
        fr: "3,5 pièces au quatrième, rénové avec précision en 2022 ; le Léman est à huit minutes à pied.",
        it: "3.5 locali al quarto piano, rinnovato nel 2022; il Lemano è a otto minuti a piedi."
      },
      description: {
        de: "Klassische Lausanner Wohnlage sous-gare: Metro M2 vor der Tür, Ouchy und Seepromenade in acht Minuten. Die Renovation 2022 brachte offene Küche, neues Bad und Eichenböden.",
        en: "Classic sous-gare Lausanne: the M2 metro at the door, Ouchy and the lakeside in eight minutes. The 2022 renewal added an open kitchen, new bath and oak floors.",
        fr: "Situation classique sous-gare : le M2 au pied de l'immeuble, Ouchy à huit minutes. Rénovation 2022 : cuisine ouverte, salle de bains neuve, chêne au sol.",
        it: "Posizione classica sous-gare: la M2 sotto casa, Ouchy a otto minuti. Rinnovo 2022: cucina aperta, bagno nuovo, rovere a terra."
      },
      highlights: { de: ["M2 vor der Haustür", "Renovation 2022", "8 Min. zum See"], en: ["M2 at the door", "2022 renovation", "8 min to the lake"], fr: ["M2 au pied de l'immeuble", "Rénovation 2022", "Lac à 8 min"], it: ["M2 sotto casa", "Rinnovo 2022", "Lago a 8 min"] },
      features: ["balcony", "lift", "parquet", "cellar"],
      images: ["interior-bright-2", "zurich-altbau-2", "kitchen-1"], heroMedia: "interior-bright-2",
      documents: ["dossier", "grundriss"], energyData: { geak: "C" },
      availability: "immediately", distances: { transit: 1, school: 6, shop: 3, station: 6 },
      broker: "cr", featured: false, newDevelopment: false, investmentProperty: false,
      createdAt: "2026-07-22", updatedAt: "2026-08-17", demo: true
    },
    {
      id: "FW-2026-010", slug: "villa-collina-doro", status: "active", transactionType: "buy", propertyType: "villa",
      title: { de: "Villa Collina d'Oro", en: "Villa Collina d'Oro", fr: "Villa Collina d'Oro", it: "Villa Collina d'Oro" },
      tagline: { de: "Granit, Palmen und der Luganersee im Torbogen.", en: "Granite, palms, and Lake Lugano framed in an archway.", fr: "Granit, palmiers et le lac de Lugano dans une arche.", it: "Granito, palme e il Ceresio incorniciato da un arco." },
      street: "Via Collina 6", postalCode: "6926", city: "Montagnola", canton: "TI", country: "CH", lat: 45.9803, lng: 8.9201,
      price: 3200000, priceOnRequest: false, rooms: 6.5, bedrooms: 4, bathrooms: 3, livingArea: 248, plotArea: 950,
      yearBuilt: 1962, yearRenovated: 2015, floor: null, parking: 3,
      blurb: {
        de: "Tessiner Villa von 1962, 2015 behutsam erweitert: Arkadenterrasse mit Seeblick, Granitmauern, Kamin und ein Garten voller Kamelien.",
        en: "A 1962 Ticino villa, carefully extended in 2015: arcaded lake-view terrace, granite walls, fireplace and a garden full of camellias.",
        fr: "Villa tessinoise de 1962, agrandie en 2015 : terrasse à arcades vue lac, murs de granit, cheminée, jardin de camélias.",
        it: "Villa ticinese del 1962, ampliata con cura nel 2015: terrazza ad arcate vista lago, muri in granito, camino e un giardino di camelie."
      },
      description: {
        de: "Auf der Collina d'Oro über dem Luganersee: Wohnräume im Erdgeschoss um die Arkadenterrasse, vier Schlafzimmer oben, Studio mit separatem Eingang. Pool im Garten, Doppelgarage plus Aussenplatz.",
        en: "On the Collina d'Oro above Lake Lugano: living rooms around the arcaded terrace, four bedrooms upstairs, a studio with its own entrance. Garden pool, double garage plus outdoor space.",
        fr: "Sur la Collina d'Oro : pièces de vie autour de la terrasse à arcades, quatre chambres à l'étage, studio indépendant. Piscine, double garage.",
        it: "Sulla Collina d'Oro: zona giorno attorno alla terrazza ad arcate, quattro camere al piano, studio con entrata separata. Piscina, doppio garage."
      },
      highlights: { de: ["Arkadenterrasse mit Seeblick", "Pool im Garten", "Studio mit Separateingang"], en: ["Arcaded lake-view terrace", "Garden pool", "Studio, own entrance"], fr: ["Terrasse à arcades vue lac", "Piscine", "Studio indépendant"], it: ["Terrazza ad arcate vista lago", "Piscina", "Studio indipendente"] },
      features: ["lakeview", "pool", "garden", "terrace", "fireplace", "garage"],
      images: ["ticino-villa-2", "ticino-villa-1", "kitchen-1"], heroMedia: "ticino-villa-2",
      documents: ["dossier", "grundriss", "factsheet"], energyData: { geak: "C" },
      availability: "byArrangement", distances: { transit: 6, school: 8, shop: 7, station: 15 },
      broker: "gc", featured: true, newDevelopment: false, investmentProperty: false,
      createdAt: "2026-06-10", updatedAt: "2026-08-23", demo: true
    },
    {
      id: "FW-2026-011", slug: "chalet-anniviers", status: "active", transactionType: "buy", propertyType: "chalet",
      title: { de: "Chalet Val d'Anniviers", en: "Chalet Val d'Anniviers", fr: "Chalet Val d'Anniviers", it: "Chalet Val d'Anniviers" },
      tagline: { de: "Altholz, Ofenwärme und Sterne, die man wieder sieht.", en: "Aged timber, stove warmth, and stars you can see again.", fr: "Vieux bois, chaleur du poêle et des étoiles qu'on revoit.", it: "Legno antico, calore della stufa e stelle che si rivedono." },
      street: "Chemin des Mélèzes 3", postalCode: "3961", city: "Grimentz", canton: "VS", country: "CH", lat: 46.1786, lng: 7.5744,
      price: 1390000, priceOnRequest: false, rooms: 4.5, bedrooms: 3, bathrooms: 2, livingArea: 128, plotArea: 420,
      yearBuilt: 2008, floor: null, parking: 2,
      blurb: {
        de: "Bewohnbares Chalet von 2008 in Grimentz: Lärche aussen, Arve innen, Skibus vor der Tür – als Erst- oder Zweitwohnsitz bewilligt.",
        en: "A 2008 chalet in Grimentz: larch outside, stone pine inside, ski bus at the door – approved as first or second home.",
        fr: "Chalet de 2008 à Grimentz : mélèze dehors, arolle dedans, navette ski devant la porte – résidence principale ou secondaire autorisée.",
        it: "Chalet del 2008 a Grimentz: larice fuori, cirmolo dentro, skibus davanti alla porta – ammesso come prima o seconda casa."
      },
      description: {
        de: "Das Chalet steht am oberen Dorfrand von Grimentz mit freiem Blick ins Tal. Wohnraum mit Specksteinofen, offene Küche, drei Schlafzimmer, Ski- und Trockenraum. Hinweis für ausländische Käufer: Lex-Koller-Bestimmungen beachten.",
        en: "At the upper edge of Grimentz with an open view down the valley. Living room with soapstone stove, open kitchen, three bedrooms, ski room. Note for foreign buyers: Lex Koller rules apply.",
        fr: "En lisière haute de Grimentz, vue dégagée sur la vallée. Séjour avec poêle en pierre ollaire, trois chambres, local à skis. Acheteurs étrangers : Lex Koller applicable.",
        it: "Al margine alto di Grimentz con vista aperta sulla valle. Soggiorno con stufa in pietra ollare, tre camere, locale sci. Per acquirenti esteri: si applica la Lex Koller."
      },
      highlights: { de: ["Specksteinofen", "Skibus vor der Tür", "Erst- oder Zweitwohnsitz"], en: ["Soapstone stove", "Ski bus at the door", "First or second home"], fr: ["Poêle en pierre ollaire", "Navette ski", "Résidence 1re ou 2e"], it: ["Stufa in pietra ollare", "Skibus alla porta", "Prima o seconda casa"] },
      features: ["mountainview", "fireplace", "terrace", "parking", "cellar", "sauna"],
      images: ["chalet-1", "kitchen-1", "interior-bright-1"], heroMedia: "chalet-1",
      documents: ["dossier", "grundriss"], energyData: { geak: "C" },
      availability: "2026-11-01", distances: { transit: 2, school: 6, shop: 4, station: 35 },
      broker: "cr", featured: false, newDevelopment: false, investmentProperty: false,
      createdAt: "2026-08-05", updatedAt: "2026-08-26", demo: true
    },
    {
      id: "FW-2026-012", slug: "chalet-andermatt", status: "active", transactionType: "buy", propertyType: "chalet",
      title: { de: "Chalet Gütsch, Andermatt", en: "Chalet Gütsch, Andermatt", fr: "Chalet Gütsch, Andermatt", it: "Chalet Gütsch, Andermatt" },
      tagline: { de: "Ein Haus für den Winter, gebaut wie ein Versprechen.", en: "A house for winter, built like a promise.", fr: "Une maison pour l'hiver, bâtie comme une promesse.", it: "Una casa per l'inverno, costruita come una promessa." },
      street: "Gütschweg 2", postalCode: "6490", city: "Andermatt", canton: "UR", country: "CH", lat: 46.6356, lng: 8.5931,
      price: null, priceOnRequest: true, rooms: 6.5, bedrooms: 5, bathrooms: 4, livingArea: 240, plotArea: 780,
      yearBuilt: 2022, floor: null, parking: 4,
      blurb: {
        de: "Neues Chalet über Andermatt: fünf Schlafzimmer, Spa mit Sauna und Aussenbad, Blick auf den Gemsstock. Verkauf diskret; Dossier auf Anfrage.",
        en: "A new chalet above Andermatt: five bedrooms, spa with sauna and outdoor bath, Gemsstock views. Discreet sale; dossier on request.",
        fr: "Chalet neuf au-dessus d'Andermatt : cinq chambres, spa avec sauna et bain extérieur. Vente discrète ; dossier sur demande.",
        it: "Chalet nuovo sopra Andermatt: cinque camere, spa con sauna e bagno esterno. Vendita discreta; dossier su richiesta."
      },
      description: {
        de: "Auf Wunsch der Eigentümerschaft erfolgt der Verkauf diskret: Lage, Preis und Dossier werden nach persönlicher Vorqualifikation offengelegt. Das Chalet (2022) verbindet Altholz und Beton, mit Spa-Geschoss, Weinraum und Doppelgarage plus Lift.",
        en: "At the owners' request the sale is discreet: location details, price and dossier are shared after personal pre-qualification. The 2022 chalet pairs aged timber with concrete – spa level, wine room, double garage, lift.",
        fr: "À la demande des propriétaires, vente discrète : prix et dossier communiqués après préqualification. Chalet 2022, vieux bois et béton, étage spa, cave à vin, ascenseur.",
        it: "Su richiesta della proprietà la vendita è discreta: prezzo e dossier dopo prequalifica personale. Chalet 2022, legno antico e cemento, piano spa, cantina vini, ascensore."
      },
      highlights: { de: ["Diskreter Verkauf", "Spa mit Aussenbad", "Ski-in in 4 Minuten"], en: ["Discreet sale", "Spa with outdoor bath", "Ski-in 4 minutes"], fr: ["Vente discrète", "Spa avec bain extérieur", "Ski-in à 4 minutes"], it: ["Vendita discreta", "Spa con bagno esterno", "Ski-in a 4 minuti"] },
      features: ["mountainview", "sauna", "pool", "fireplace", "garage", "lift", "terrace"],
      images: ["chalet-2", "penthouse-1", "kitchen-1"], heroMedia: "chalet-2",
      documents: ["dossier"], energyData: { geak: "B" },
      availability: "byArrangement", distances: { transit: 3, school: 7, shop: 5, station: 6 },
      broker: "lf", featured: false, newDevelopment: false, investmentProperty: false,
      createdAt: "2026-08-10", updatedAt: "2026-08-27", demo: true
    },
    {
      id: "FW-2026-013", slug: "mfh-winterthur", status: "active", transactionType: "buy", propertyType: "multifamily",
      title: { de: "Mehrfamilienhaus Winterthur", en: "Apartment building Winterthur", fr: "Immeuble de rendement Winterthour", it: "Palazzina di reddito Winterthur" },
      tagline: { de: "Sechs Wohnungen, eine Rechnung, die aufgeht.", en: "Six flats, and the numbers add up.", fr: "Six logements, un calcul qui tient.", it: "Sei appartamenti, un conto che torna." },
      street: "Tösstalstrasse 112", postalCode: "8400", city: "Winterthur", canton: "ZH", country: "CH", lat: 47.4913, lng: 8.7396,
      price: 4150000, priceOnRequest: false, rooms: null, bedrooms: null, bathrooms: null, livingArea: 486, plotArea: 720,
      yearBuilt: 1934, yearRenovated: 2018, floor: null, parking: 4,
      blurb: {
        de: "MFH von 1934 mit sechs vermieteten Wohnungen (2× 2.5, 3× 3.5, 1× 4.5 Zi). Soll-Mietertrag CHF 157'800 p.a., Bruttorendite 3.8%.",
        en: "A 1934 building with six let flats (2× 2.5, 3× 3.5, 1× 4.5). Target rent CHF 157,800 p.a., gross yield 3.8%.",
        fr: "Immeuble de 1934, six logements loués. État locatif CHF 157'800 p.a., rendement brut 3,8%.",
        it: "Stabile del 1934 con sei appartamenti locati. Reddito CHF 157'800 p.a., rendimento lordo 3,8%."
      },
      description: {
        de: "Solide Substanz mit erneuerter Hülle (Fenster/Dach 2018) und moderatem Mietzinsniveau – Potenzial bei Mieterwechseln. Heizung Gas 2016, Leitungen teilerneuert. Vollvermietet, Mieterspiegel im Dossier. Nettorendite nach Unterhalt ca. 3.1%.",
        en: "Solid substance with renewed envelope (windows/roof 2018) and moderate rents – upside at tenant turnover. Gas heating 2016. Fully let; rent roll in the dossier. Net yield after maintenance approx. 3.1%.",
        fr: "Substance solide, enveloppe rénovée (2018), loyers modérés – potentiel à la relocation. Entièrement loué ; état locatif dans le dossier. Rendement net env. 3,1%.",
        it: "Sostanza solida, involucro rinnovato (2018), affitti moderati – potenziale alla rilocazione. Interamente locato; stato locativo nel dossier. Rendimento netto ca. 3,1%."
      },
      highlights: { de: ["Bruttorendite 3.8%", "Vollvermietet", "Hülle erneuert 2018"], en: ["Gross yield 3.8%", "Fully let", "Envelope renewed 2018"], fr: ["Rendement brut 3,8%", "Entièrement loué", "Enveloppe 2018"], it: ["Rendimento lordo 3,8%", "Interamente locato", "Involucro 2018"] },
      features: ["garden", "cellar", "parking"],
      images: ["mfh-winterthur-1", "zurich-altbau-2"], heroMedia: "mfh-winterthur-1",
      yield: { gross: 3.8, net: 3.1, rentPa: 157800 },
      documents: ["dossier", "factsheet"], energyData: { geak: "D" },
      availability: "byArrangement", distances: { transit: 2, school: 5, shop: 3, station: 9 },
      broker: "lf", featured: false, newDevelopment: false, investmentProperty: true,
      createdAt: "2026-07-08", updatedAt: "2026-08-16", demo: true
    },
    {
      id: "FW-2026-014", slug: "miete-kreis5", status: "active", transactionType: "rent", propertyType: "apartment",
      title: { de: "Loftwohnung im Kreis 5", en: "Loft flat, Kreis 5", fr: "Loft au Kreis 5", it: "Loft nel Kreis 5" },
      tagline: { de: "Industriefenster, Morgenlicht, Limmat in Gehweite.", en: "Factory windows, morning light, the Limmat within reach.", fr: "Fenêtres d'atelier, lumière du matin, la Limmat à pied.", it: "Finestre industriali, luce del mattino, la Limmat a piedi." },
      street: "Heinrichstrasse 200", postalCode: "8005", city: "Zürich", canton: "ZH", country: "CH", lat: 47.3876, lng: 8.5232,
      price: null, priceOnRequest: false, rentNet: 2950, rentNK: 240, rooms: 3.5, bedrooms: 2, bathrooms: 1, livingArea: 84, plotArea: null,
      yearBuilt: 2004, floor: 2, parking: 0,
      blurb: {
        de: "3.5-Zimmer-Loft im ehemaligen Industriebau: 3.4 m Raumhöhe, offene Küche, Bad mit Tageslicht. Bezug ab 1. November 2026.",
        en: "A 3.5-room loft in a former industrial building: 3.4 m ceilings, open kitchen, daylight bathroom. From 1 November 2026.",
        fr: "Loft de 3,5 pièces dans un ancien bâtiment industriel : 3,4 m sous plafond. Dès le 1er novembre 2026.",
        it: "Loft di 3.5 locali in un ex edificio industriale: soffitti di 3,4 m. Dal 1° novembre 2026."
      },
      description: {
        de: "Umgenutzter Industriebau an der Heinrichstrasse: Die Wohnung behält Stahlstützen und Industriefenster, die Küche ist zur Esszone geöffnet. Nettomiete CHF 2'950.–, Nebenkosten akonto CHF 240.–. Haustiere nach Absprache.",
        en: "A converted industrial building on Heinrichstrasse: the flat keeps its steel columns and factory windows. Net rent CHF 2,950, service charges on account CHF 240. Pets by arrangement.",
        fr: "Bâtiment industriel reconverti : piliers d'acier et fenêtres d'atelier conservés. Loyer net CHF 2'950.–, charges CHF 240.–. Animaux sur accord.",
        it: "Edificio industriale riconvertito: pilastri d'acciaio e finestre originali conservati. Affitto netto CHF 2'950.–, spese CHF 240.–. Animali su accordo."
      },
      highlights: { de: ["3.4 m Raumhöhe", "Tram in 3 Minuten", "Haustiere nach Absprache"], en: ["3.4 m ceilings", "Tram in 3 minutes", "Pets by arrangement"], fr: ["3,4 m sous plafond", "Tram à 3 minutes", "Animaux sur accord"], it: ["Soffitti di 3,4 m", "Tram a 3 minuti", "Animali su accordo"] },
      features: ["lift", "washtower", "cellar"],
      images: ["interior-bright-1", "kitchen-1", "zurich-altbau-1"], heroMedia: "interior-bright-1",
      documents: ["factsheet"], energyData: { geak: "C" },
      availability: "2026-11-01", distances: { transit: 3, school: 8, shop: 2, station: 7 },
      broker: "jb", featured: false, newDevelopment: false, investmentProperty: false,
      createdAt: "2026-08-12", updatedAt: "2026-08-27", demo: true
    },
    {
      id: "FW-2026-015", slug: "miete-laenggasse", status: "active", transactionType: "rent", propertyType: "apartment",
      title: { de: "Länggasse, Bern", en: "Länggasse, Bern", fr: "Länggasse, Berne", it: "Länggasse, Berna" },
      tagline: { de: "Kompakt, hell und fünf Minuten von der Uni.", en: "Compact, bright, five minutes from the university.", fr: "Compact, lumineux, à cinq minutes de l'université.", it: "Compatto, luminoso, a cinque minuti dall'università." },
      street: "Mittelstrasse 59", postalCode: "3012", city: "Bern", canton: "BE", country: "CH", lat: 46.9524, lng: 7.4306,
      price: null, priceOnRequest: false, rentNet: 1780, rentNK: 180, rooms: 2.5, bedrooms: 1, bathrooms: 1, livingArea: 58, plotArea: null,
      yearBuilt: 1968, yearRenovated: 2020, floor: 1, parking: 0,
      blurb: {
        de: "2.5 Zimmer mit neuer Küche in Eiche und ruhigem Hofbalkon, mitten in der Länggasse. Bezug ab sofort.",
        en: "2.5 rooms with a new oak kitchen and a quiet courtyard balcony, in the middle of Länggasse. Available now.",
        fr: "2,5 pièces, cuisine neuve en chêne, balcon sur cour calme. Libre de suite.",
        it: "2.5 locali con cucina nuova in rovere e balcone sulla corte. Libero subito."
      },
      description: {
        de: "Die Länggasse bleibt Berns lebendigstes Quartier: Cafés, Buchhandlungen, Uni. Die Wohnung wurde 2020 erneuert; der Balkon liegt zum ruhigen Innenhof. Nettomiete CHF 1'780.–, Nebenkosten akonto CHF 180.–.",
        en: "Länggasse remains Bern's liveliest quarter: cafés, bookshops, the university. Renewed in 2020; the balcony faces the quiet courtyard. Net rent CHF 1,780, charges CHF 180.",
        fr: "La Länggasse reste le quartier le plus vivant de Berne. Rénové en 2020 ; balcon sur cour. Loyer net CHF 1'780.–, charges CHF 180.–.",
        it: "La Länggasse resta il quartiere più vivace di Berna. Rinnovato nel 2020; balcone sulla corte. Affitto netto CHF 1'780.–, spese CHF 180.–."
      },
      highlights: { de: ["Küche 2020", "Hofbalkon", "Uni in 5 Minuten"], en: ["2020 kitchen", "Courtyard balcony", "University 5 min"], fr: ["Cuisine 2020", "Balcon sur cour", "Uni à 5 min"], it: ["Cucina 2020", "Balcone sulla corte", "Università a 5 min"] },
      features: ["balcony", "cellar", "washtower"],
      images: ["kitchen-1", "interior-bright-2"], heroMedia: "kitchen-1",
      documents: ["factsheet"], energyData: { geak: "D" },
      availability: "immediately", distances: { transit: 2, school: 4, shop: 2, station: 12 },
      broker: "jb", featured: false, newDevelopment: false, investmentProperty: false,
      createdAt: "2026-08-14", updatedAt: "2026-08-26", demo: true
    }
  ];

  function fmtPrice(p, lang) {
    if (p == null) return t.onRequest[lang || "de"];
    return "CHF " + String(p).replace(/\B(?=(\d{3})+(?!\d))/g, "’") + ".–";
  }
  function fmtRent(pr, lang) {
    return "CHF " + String(pr.rentNet).replace(/\B(?=(\d{3})+(?!\d))/g, "’") + ".– " + t.perMonth[lang || "de"];
  }
  function priceLabel(pr, lang) {
    if (pr.transactionType === "rent") return fmtRent(pr, lang);
    if (pr.priceOnRequest) return t.onRequest[lang || "de"];
    return fmtPrice(pr.price, lang);
  }
  function roomsLabel(pr, lang) {
    if (pr.rooms == null) return "6 " + { de: "Wohnungen", en: "flats", fr: "logements", it: "appartamenti" }[lang || "de"];
    return String(pr.rooms).replace(".", lang === "de" ? "." : ",") + " " + t.rooms[lang || "de"];
  }
  return { t: t, brokers: brokers, properties: properties, fmtPrice: fmtPrice, fmtRent: fmtRent, priceLabel: priceLabel, roomsLabel: roomsLabel };
})();
