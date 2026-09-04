#!/usr/bin/env node
/* ============================================================
   FOURWALLS — DEMO-IMPORTER (P5.3)

   Liest den massgeblichen Demo-Bestand des Prototyps und überführt ihn in das
   Produktionsschema. Das ist der Migrationseingang für ERFUNDENE Daten — nicht
   der spätere Weg echter Inserate (Assistent, Herausgeber-Werkzeuge, Admin).

   Quellen (nur hier gelesen, nirgends zur Laufzeit der Anwendung):
     final/listings.js        320 synthetische Inserate (FWL)
     final/properties.js      15 Fourwalls-Mandate in vier Sprachen (FW)
     final/ufer/detail-data.js  3 handgeschriebene Dossiers (FWD)
     final/ufer/geo.js        Orte, Kantone, Regionen (FWGEO)

   Der Prototyp zeigt nicht alle 320: FWP.alle() ersetzt die 31 synthetischen
   «Exclusive» durch die 15 echten Mandate → 289 + 15 = 304 Inserate. Genau
   diese 304 sind der Vergleichsmassstab; dazu drei kleine Testinserate.

   Eigenschaften: deterministisch (feste Referenzen aus der Altkennung),
   wiederholbar (räumt seinen eigenen Bestand zuerst weg), eine Transaktion
   (ein Fehler → nichts importiert), validiert, mit Qualitätsbericht.

   Aufruf:  node scripts/import-demo.mjs [--bericht var/import-bericht.json]
   Umgebung: DATABASE_URL (verweigert in production)

   ---------------------------------------------------------------
   ABBILDUNG (die Entscheide stehen hier, nicht versteckt im Code)
   ---------------------------------------------------------------
   Kennungen     FWL-1000..1319  → listing FWL-2026-10NNNN, property FWI-2026-10NNNN
                 FW-2026-001..15 → listing FWL-2026-20000N, property FWI-2026-20000N
                 Ausnahme: seehaus-walensee behält FWL-2026-000142 / FWI-DEMO-000001
                 (Referenz aus P5.2, in Berichten und Massstäben verankert).
   Objektart     wohnung→apartment, haus→house, villa, chalet, mfh→multi_family,
                 gewerbe→commercial, grundstueck→land, parkplatz→parking
   Transaktion   buy→sale, rent→rent
   Herausgeber   listingSource privat→private_person (app_user, kein org),
                 agentur→agency, verwaltung→property_manager, entwickler→developer,
                 fourwalls→fourwalls (org «fourwalls»). Je Anbietername eine
                 Organisation (slug demo-…), je Privatperson ein app_user.
                 Alle Adressen @…example — Demo, keine echten Personen.
   Exclusive     Mandate mit featured=true → represented_by_org = Fourwalls
                 (die Anwendung liest daraus «Exclusive»); übrige Fourwalls-
                 Inserate → published_by Fourwalls, nicht vertreten («verified»).
   Prüfstatus    verificationStatus=verified → organization.verified_at (je Org,
                 wenn mindestens ein Inserat geprüft; Abweichungen im Bericht).
   Lage          geo.lat/lng (interne, gestreute Lage) → property.geom_exact
                 (verlässt den Server nie). geo.genauigkeit exakt→exact/0 m,
                 ungefaehr→approximate/anzeige.genauigkeitM, gemeinde→
                 municipality/2000 m. geom_public erzeugt der Trigger durch
                 Rasterung — NICHT die anzeige-Koordinaten des Prototyps:
                 das Produktionsmodell gilt (§10).
                 Strasse wird NIE importiert (auch nicht bei Mandaten).
   Ort           geo.gemeindeId → place.key (ort-…); place-Tabelle wird aus
                 geo.js befüllt: 38 Gemeinden, 26 Kantone, 9 Regionen.
   Preise        CHF → Rappen (×100). kautionMax → deposit_max_chf.
   Verfügbarkeit sofort→available_immediately, datum→available_from,
                 vereinbarung→beides leer; reserviert→status reserved,
                 verkauft→sold, vermietet→rented; publicationStatus
                 archiviert→archived. Statusweg immer über die Zustandsmaschine
                 (draft→submitted→in_review→approved→published→…).
   Inhalt        title/beschreibung → listing.title/description (de),
                 listing_content je Sprache: synthetische Inserate erhalten
                 ABGELEITETE Abschnitte nach den Regeln von dossier.js (keine
                 erfundenen Fakten: nur Merkmale, Baujahr, Quelle); Mandate
                 vier Sprachen aus properties.js; FWD-Dossiers vollständig.
   Merkmale      features[] → property_feature (Schlüssel identisch).
   Medien        img / images[] → media_asset je Bildschlüssel (Fixture in
                 public/media, echte Byte-Grössen) + 6 Varianten; listing_image
                 je Inserat, erstes = Titelbild.
   Grundrisse    nur FWD-Dossiers (eigene SVG-Zeichnungen, public).
   Dokumente     dossier.js-Regel: gewerbliche Anbieter → «Objektdokumentation»
                 und «Grundriss» (on_request); FWD-Dossiers ihre eigenen.
   Verworfen     views, favoritesCount, inquiryCount (Schaufensterzahlen ohne
                 Tabelle), sellerType (redundant zu listingSource), kautionMax
                 nur bei Miete, neu (abgeleitet zur Laufzeit aus published_at).
   Demo          jedes Inserat is_demo=true; in production nie sichtbar.
   ============================================================ */
import postgres from "postgres";
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(hier, "..", "..");                 // fourwalls/
const FINAL = join(WURZEL, "final");
const MEDIEN = join(hier, "..", "public", "media");
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const BERICHT = arg("--bericht", join(hier, "..", "var", "import-bericht.json"));

if (process.env.APP_ENV === "production") { console.error("Der Demo-Importer läuft nicht in production."); process.exit(2); }
const url = process.env.DATABASE_URL;
const sql = url ? postgres(url, { max: 1, onnotice: () => {} }) : null;

/* ---------- Quellen im Sandkasten laden (kein window in Node) ---------- */
function ladeQuelle(rel, vorher = {}) {
  const ctx = { window: { ...vorher }, performance: { now: () => 0 }, document: undefined, console };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(FINAL, rel), "utf8"), ctx, { filename: rel });
  return ctx.window;
}
const wL = ladeQuelle("listings.js");
const wP = ladeQuelle("properties.js");
const wD = ladeQuelle("ufer/detail-data.js");
const wG = ladeQuelle("ufer/geo.js", { FWP: { lang: "de" } });
const L = wL.FWL.listings, MANDATE = wP.FW.properties, BROKER = wP.FW.brokers || wP.FW.team || [], FWD = wD.FWD, GEO = wG.FWGEO;

/* Drei Orte, die der Prototyp-Ortsindex nicht kennt, obwohl Mandate dort liegen
   (P5.4 §2B). Koordinaten sind öffentlich bekannte Ortsmitten, keine Adressen.
   Montagnola und Grimentz sind Ortsteile grösserer Gemeinden (Collina d'Oro TI,
   Anniviers VS); sie stehen hier auf der Gemeindeebene, weil der Ortsindex diese
   Ebene für Ortsnamen führt. Ein amtliches Gemeindeverzeichnis bildet das später
   genauer ab. */
const ORTE_ERGAENZUNG = [
  { id: "ort-montagnola", name: "Montagnola", kt: "TI", plz: ["6926"], lat: 45.9736, lng: 8.9319, gemeinde: "Collina d'Oro" },
  { id: "ort-grimentz",   name: "Grimentz",   kt: "VS", plz: ["3961"], lat: 46.1806, lng: 7.5722, gemeinde: "Anniviers" },
  { id: "ort-andermatt",  name: "Andermatt",  kt: "UR", plz: ["6490"], lat: 46.6339, lng: 8.5942 }
];

/* ---------- Abbildungstabellen ---------- */
const ART = { wohnung: "apartment", haus: "house", villa: "villa", chalet: "chalet", mfh: "multi_family", gewerbe: "commercial", grundstueck: "land", parkplatz: "parking" };
const ART_MANDAT = { apartment: "apartment", house: "house", villa: "villa", chalet: "chalet", multifamily: "multi_family", "multi-family": "multi_family", commercial: "commercial", land: "land" };
const HERAUSGEBER = { privat: "private_person", agentur: "agency", verwaltung: "property_manager", entwickler: "developer", fourwalls: "fourwalls" };
const PRAEZISION = { exakt: ["exact", 0], ungefaehr: ["approximate", null], gemeinde: ["municipality", 2000] };
const slugify = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const rp = chf => chf == null ? null : Math.round(chf * 100);

/* ---------- Dossier-Ableitung (Port von dossier.js — KEINE erfundenen Fakten) ---------- */
const AUS = { parquet: ["boeden", "Parkett"], floorheating: ["boeden", "Bodenheizung"], fireplace: ["cheminee", "Vorhanden"], lift: ["lift", "Vorhanden"], washtower: ["waschen", "Waschturm in der Wohnung"], cellar: ["stauraum", "Kellerabteil"], sauna: ["sauna", "Vorhanden"], concierge: ["service", "Concierge im Haus"] };
const AUSSEN = { balcony: ["balkon", "Vorhanden"], terrace: ["terrasse", "Vorhanden"], garden: ["garten", "Vorhanden"], pool: ["pool", "Vorhanden"], lakeview: ["aussicht", "Seeblick"], mountainview: ["aussicht", "Bergsicht"] };
const PARK = { garage: ["garage", "Vorhanden"], parking: ["aussenplaetze", "Vorhanden"], evcharging: ["ladestation", "Vorhanden"] };
const ENERG = { minergie: ["minergie", "Minergie-zertifiziert"], floorheating: ["verteilung", "Bodenheizung"] };
const L18 = {
  de: { schritte: ["Besichtigung anfragen", "Frage stellen", "Finanzierung prüfen"], schritteM: ["Besichtigung anfragen", "Frage stellen", "Unterlagen anfordern"], neubau: "Neubau", neuwertig: "Neuwertig", gepflegt: "Gepflegt", aelter: "Älterer Baubestand", abgeleitet: "aus dem Baujahr abgeleitet", objektdok: "Objektdokumentation", grundriss: "Grundriss", beschreibung: "Beschreibung" },
  fr: { schritte: ["Demander une visite", "Poser une question", "Vérifier le financement"], schritteM: ["Demander une visite", "Poser une question", "Demander le dossier"], neubau: "Construction neuve", neuwertig: "Comme neuf", gepflegt: "Bien entretenu", aelter: "Bâti plus ancien", abgeleitet: "déduit de l'année de construction", objektdok: "Documentation du bien", grundriss: "Plan", beschreibung: "Description" },
  it: { schritte: ["Richiedere una visita", "Fare una domanda", "Verificare il finanziamento"], schritteM: ["Richiedere una visita", "Fare una domanda", "Richiedere la documentazione"], neubau: "Nuova costruzione", neuwertig: "Come nuovo", gepflegt: "Ben tenuto", aelter: "Costruzione più datata", abgeleitet: "dedotto dall'anno di costruzione", objektdok: "Documentazione dell'immobile", grundriss: "Planimetria", beschreibung: "Descrizione" },
  en: { schritte: ["Request a viewing", "Ask a question", "Check financing"], schritteM: ["Request a viewing", "Ask a question", "Request documents"], neubau: "New build", neuwertig: "Like new", gepflegt: "Well maintained", aelter: "Older building stock", abgeleitet: "derived from the construction year", objektdok: "Property documentation", grundriss: "Floor plan", beschreibung: "Description" }
};
function zustand(jahr, T) { if (!jahr) return null; const a = 2026 - jahr; return a <= 3 ? T.neubau : a <= 15 ? T.neuwertig : a <= 40 ? T.gepflegt : T.aelter; }
function abgeleiteteAbschnitte(l, locale) {
  const T = L18[locale]; const s = {};
  const g = {}; if (l.yearBuilt) { g.baujahr = l.yearBuilt; const z = zustand(l.yearBuilt, T); if (z) g.zustand = `${z} (${T.abgeleitet})`; }
  if (Object.keys(g).length) s.gebaeude = g;
  const feat = l.features || [];
  const sam = tab => { const o = {}; feat.forEach(x => { const e = tab[x]; if (e) o[e[0]] = o[e[0]] ? o[e[0]] + ", " + e[1] : e[1]; }); return Object.keys(o).length ? o : null; };
  const a = sam(AUS); if (a) s.ausstattung = a;
  const au = sam(AUSSEN); if (au) s.aussen = au;
  const p = sam(PARK); if (p) s.parkieren = p;
  const en = sam(ENERG); if (en) s.energie = en;
  if (l.beschreibung) s.story = { titel: T.beschreibung, absaetze: [l.beschreibung] };
  s.naechsteSchritte = l.transactionType === "rent" ? T.schritteM : T.schritte;
  return s;
}

/* ---------- Bilder: Fixture-Grössen ---------- */
function bildVarianten(key) {
  const v = [];
  for (const w of [480, 960, 1600]) for (const [ext, fmt] of [["jpg", "jpeg"], ["webp", "webp"]]) {
    const p = join(MEDIEN, `${key}-${w}.${ext}`); if (existsSync(p)) v.push({ key: `demo/${key}-${w}.${ext}`, w, fmt, bytes: statSync(p).size });
  }
  return v;
}

/* ---------- Bericht ---------- */
const bericht = { zeit: new Date().toISOString(), quellen: { listings: L.length, mandate: MANDATE.length, dossiers: Object.keys(FWD).length }, importiert: {}, qualitaet: {}, warnungen: [] };
const warn = (kat, text) => { bericht.qualitaet[kat] = (bericht.qualitaet[kat] || 0) + 1; if (bericht.warnungen.length < 400) bericht.warnungen.push(`${kat}: ${text}`); };
const zaehl = (obj, k) => { obj[k] = (obj[k] || 0) + 1; };

/* ---------- Der Bestand des Prototyps: 289 synthetische + 15 Mandate ---------- */
const synthetisch = L.filter(l => !(l.listingTier === "exclusive" && l.listingSource === "fourwalls"));
/* Handgeschriebene Dossiers bestimmen Quelle und Anbieter (wie portal.html) */
for (const [slug, d] of Object.entries(FWD)) {
  const l = synthetisch.find(x => x.slug === slug);
  if (l && d.quelle) { if (d.quelle.art === "agentur" || d.quelle.art === "privat") l.listingSource = d.quelle.art; l.publisher = d.quelle.name || l.publisher; l.verificationStatus = d.quelle.verifiziert ? "verified" : "none"; }
}

const SEED = "00000000-0000-0000-0000-00000000dead";
const FW_ORG = "b1000000-0000-4000-8000-000000000001";
const LENA = "a1000000-0000-4000-8000-000000000001";

async function main() {
  if (!sql) { console.error("DATABASE_URL fehlt"); process.exit(2); }
  const t0 = Date.now();
  await sql.begin(async sql => {
    await sql`SELECT set_config('app.actor_id', ${SEED}, true)`;
    await sql`SELECT set_config('app.reason', 'import-demo', true)`;

    /* ---- Aufräumen: nur, was dieser Importer selbst angelegt hat ---- */
    /* Reihenfolge folgt den Fremdschlüsseln. Anfragen zu Demo-Inseraten sind Testdaten und gehen mit. */
    await sql`DELETE FROM inquiry WHERE listing_id IN (SELECT id FROM listing WHERE is_demo)`;
    await sql`DELETE FROM listing WHERE is_demo`;
    await sql`DELETE FROM property WHERE public_ref LIKE 'FWI-2026-1%' OR public_ref LIKE 'FWI-2026-2%' OR public_ref LIKE 'FWI-DEMO-%'`;
    await sql`DELETE FROM media_asset WHERE storage_key LIKE 'demo/%'`;
    await sql`DELETE FROM organization WHERE slug LIKE 'demo-%' OR slug = 'fourwalls'`;
    /* Das Systemkonto bleibt: das Audit-Protokoll verweist darauf. */
    await sql`DELETE FROM app_user WHERE (email LIKE '%@demo.fourwalls.example' OR email LIKE '%@fourwalls.example') AND id <> ${SEED}`;
    await sql`DELETE FROM place WHERE key LIKE 'ort-%' OR key LIKE 'kt-%' OR key LIKE 'rg-%'`;

    /* ---- Systemkonto und Fourwalls ---- */
    await sql`INSERT INTO app_user (id, email, display_name, platform_role, locale) VALUES (${SEED}, 'seed@fourwalls.example', 'Seed', 'admin', 'de') ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO organization (id, slug, kind, legal_name, display_name, phone, email, verified_at, verified_by)
              VALUES (${FW_ORG}, 'fourwalls', 'fourwalls', 'Fourwalls AG (Demo)', 'Fourwalls AG', '+41 44 555 01 01', 'hallo@fourwalls.example', now(), ${SEED})`;
    const brokerId = {};
    for (const b of BROKER) {
      const id = b.id === "lf" ? LENA : (await sql`SELECT gen_random_uuid() AS id`)[0].id;
      brokerId[b.id] = id;
      await sql`INSERT INTO app_user (id, email, display_name, platform_role, locale) VALUES (${id}, ${b.email}, ${b.name}, 'staff', 'de')`;
      await sql`INSERT INTO org_membership (organization_id, user_id, role, public_title) VALUES (${FW_ORG}, ${id}, ${b.id === "lf" ? "owner" : "agent"}, ${b.role?.de ?? null})`;
    }
    if (!brokerId.lf) { await sql`INSERT INTO app_user (id, email, display_name, platform_role, locale) VALUES (${LENA}, 'lena.furrer@fourwalls.example', 'Lena Furrer', 'staff', 'de')`;
      await sql`INSERT INTO org_membership (organization_id, user_id, role, public_title) VALUES (${FW_ORG}, ${LENA}, 'owner', 'Leitung Verkauf Zürich')`; brokerId.lf = LENA; }

    /* ---- Merkmale ---- */
    const FEAT = [["balcony", "Balkon", "Balcon", "Balcone", "Balcony"], ["terrace", "Terrasse", "Terrasse", "Terrazza", "Terrace"], ["garden", "Garten", "Jardin", "Giardino", "Garden"], ["parking", "Parkplatz", "Place de parc", "Posto auto", "Parking space"], ["garage", "Garage", "Garage", "Garage", "Garage"], ["lift", "Lift", "Ascenseur", "Ascensore", "Lift"], ["lakeview", "Seeblick", "Vue sur le lac", "Vista lago", "Lake view"], ["mountainview", "Bergsicht", "Vue sur les montagnes", "Vista montagna", "Mountain view"], ["fireplace", "Cheminée", "Cheminée", "Camino", "Fireplace"], ["parquet", "Parkett", "Parquet", "Parquet", "Parquet flooring"], ["floorheating", "Bodenheizung", "Chauffage au sol", "Riscaldamento a pavimento", "Underfloor heating"], ["minergie", "Minergie", "Minergie", "Minergie", "Minergie"], ["cellar", "Keller", "Cave", "Cantina", "Cellar"], ["washtower", "Waschturm", "Colonne de lavage", "Torre di lavaggio", "Washer-dryer tower"], ["pool", "Pool", "Piscine", "Piscina", "Pool"], ["sauna", "Sauna", "Sauna", "Sauna", "Sauna"], ["evcharging", "E-Ladestation", "Borne de recharge", "Colonnina di ricarica", "EV charging"], ["concierge", "Concierge", "Conciergerie", "Portineria", "Concierge"]];
    for (const [i, f] of FEAT.entries()) await sql`INSERT INTO feature (key, name_de, name_fr, name_it, name_en, sort_order) VALUES (${f[0]}, ${f[1]}, ${f[2]}, ${f[3]}, ${f[4]}, ${(i + 1) * 10}) ON CONFLICT (key) DO NOTHING`;

    /* ---- Orte aus geo.js: Regionen, Kantone, Gemeinden ---- */
    const placeId = {};
    const boxWkt = b => `POLYGON((${b[3]} ${b[1]},${b[2]} ${b[1]},${b[2]} ${b[0]},${b[3]} ${b[0]},${b[3]} ${b[1]}))`; // [n,s,o,w]
    for (const [id, r] of Object.entries(GEO.REGIONEN)) {
      const row = await sql`INSERT INTO place (key, kind, canton, name_de, name_fr, name_it, name_en, aliases, postal_codes, centroid, bbox)
        VALUES (${"rg-" + id}, 'region', null, ${r.n.de}, ${r.n.fr}, ${r.n.it}, ${r.n.en}, ${r.kantone}, '{}',
                ST_SetSRID(ST_MakePoint(${(r.box[2] + r.box[3]) / 2}, ${(r.box[0] + r.box[1]) / 2}), 4326)::geography, ST_GeogFromText(${boxWkt(r.box)})) RETURNING id`;
      placeId["rg-" + id] = row[0].id;
    }
    for (const [kt, k] of Object.entries(GEO.KANTONE)) {
      const region = Object.entries(GEO.REGIONEN).find(([, r]) => r.kantone.includes(kt))?.[0];
      const row = await sql`INSERT INTO place (key, kind, canton, name_de, name_fr, name_it, name_en, aliases, postal_codes, centroid, bbox, parent_id)
        VALUES (${"kt-" + kt}, 'canton', ${kt}, ${GEO.kantonName(kt, "de")}, ${GEO.kantonName(kt, "fr")}, ${GEO.kantonName(kt, "it")}, ${GEO.kantonName(kt, "en")}, ${[kt.toLowerCase()]}, '{}',
                ST_SetSRID(ST_MakePoint(${k.mitte[1]}, ${k.mitte[0]}), 4326)::geography, ST_GeogFromText(${boxWkt(k.box)}), ${region ? placeId["rg-" + region] : null}) RETURNING id`;
      placeId["kt-" + kt] = row[0].id;
    }
    for (const o of [...GEO.ORTE, ...ORTE_ERGAENZUNG]) {
      const n = o.n || {};
      const row = await sql`INSERT INTO place (key, kind, canton, name_de, name_fr, name_it, name_en, aliases, postal_codes, centroid, parent_id)
        VALUES (${o.id}, 'municipality', ${o.kt}, ${o.name}, ${n.fr ?? null}, ${n.it ?? null}, ${n.en ?? null}, ${Array.from(new Set(o.alt || []))}, ${o.plz},
                ST_SetSRID(ST_MakePoint(${o.lng}, ${o.lat}), 4326)::geography, ${placeId["kt-" + o.kt]}) RETURNING id`;
      placeId[o.id] = row[0].id;
    }
    bericht.importiert.orte = Object.keys(placeId).length;

    /* ---- Medien: ein Asset je Bildschlüssel ---- */
    const assetId = {};
    async function asset(key) {
      if (assetId[key]) return assetId[key];
      const v = bildVarianten(key);
      if (v.length < 6) { warn("bild-unvollstaendig", `${key}: ${v.length}/6 Varianten`); if (!v.length) return null; }
      const gross = v.find(x => x.w === 1600 && x.fmt === "jpeg") ?? v[v.length - 1];
      const row = await sql`INSERT INTO media_asset (storage_key, mime_type, byte_size, width, exif_stripped, uploaded_by) VALUES (${gross.key}, 'image/jpeg', ${gross.bytes}, ${gross.w}, true, ${SEED}) RETURNING id`;
      for (const x of v) await sql`INSERT INTO media_variant (asset_id, storage_key, width, format, byte_size) VALUES (${row[0].id}, ${x.key}, ${x.w}, ${x.fmt}, ${x.bytes})`;
      assetId[key] = row[0].id; return row[0].id;
    }

    /* ---- Anbieter: Organisationen und Privatpersonen ---- */
    const orgId = {}, userId = {};
    async function anbieter(l) {
      const kind = HERAUSGEBER[l.listingSource]; if (!kind) throw new Error(`Unbekannte Quelle ${l.listingSource} bei ${l.id}`);
      if (kind === "fourwalls") return { org: FW_ORG, user: null };
      const name = l.publisher || "Unbekannt";
      if (kind === "private_person") {
        if (!userId[name]) {
          const row = await sql`INSERT INTO app_user (email, display_name, platform_role, locale) VALUES (${slugify(name) + "@demo.fourwalls.example"}, ${name}, 'user', 'de') RETURNING id`;
          userId[name] = row[0].id;
        }
        return { org: null, user: userId[name] };
      }
      if (!orgId[name]) {
        const slug = "demo-" + slugify(name);
        const geprueft = synthetisch.some(x => x.publisher === name && x.verificationStatus === "verified");
        const row = await sql`INSERT INTO organization (slug, kind, legal_name, display_name, email, verified_at, verified_by)
          VALUES (${slug}, ${kind}, ${name + " (Demo)"}, ${name}, ${"kontakt@" + slug.slice(5) + ".example"}, ${geprueft ? sql`now()` : null}, ${geprueft ? SEED : null}) RETURNING id`;
        orgId[name] = row[0].id;
        const arten = new Set(synthetisch.filter(x => x.publisher === name).map(x => x.listingSource));
        if (arten.size > 1) warn("anbieter-mehrere-quellen", `${name}: ${[...arten].join(",")}`);
        const status = new Set(synthetisch.filter(x => x.publisher === name).map(x => x.verificationStatus));
        if (status.size > 1) warn("anbieter-pruefstatus-uneinheitlich", `${name}: ${[...status].join(",")} → Organisation gilt als geprüft`);
      }
      return { org: orgId[name], user: null };
    }

    /* ---- Statusweg über die Zustandsmaschine ---- */
    async function veroeffentlichen(id, publishedAt, endstatus) {
      for (const s of ["submitted", "in_review", "approved"]) await sql`UPDATE listing SET status = ${s} WHERE id = ${id}`;
      await sql`UPDATE listing SET status = 'published', published_at = ${publishedAt}, is_indexable = true WHERE id = ${id}`;
      if (endstatus && endstatus !== "published") await sql`UPDATE listing SET status = ${endstatus}, is_indexable = false WHERE id = ${id}`;
    }

    const stat = { quelle: {}, transaktion: {}, art: {}, status: {}, praezision: {}, exklusiv: 0, sprachen: {} };
    const nachher = (l, statusEnd, prz) => { zaehl(stat.quelle, l.listingSource); zaehl(stat.transaktion, l.transactionType); zaehl(stat.art, l.propertyType); zaehl(stat.status, statusEnd); zaehl(stat.praezision, prz); };

    /* ---- Datenqualität: technische Prüfungen VOR dem Schreiben ---- */
    const slugs = new Set();
    for (const l of synthetisch) {
      if (slugs.has(l.slug)) throw new Error(`Doppelter Slug ${l.slug}`); slugs.add(l.slug);
      if (!ART[l.propertyType]) throw new Error(`Unbekannte Objektart ${l.propertyType} bei ${l.id}`);
      if (!GEO.ORTE.some(o => o.id === l.geo.gemeindeId)) warn("ort-unbekannt", `${l.id}: ${l.geo.gemeindeId}`);
      if (l.transactionType === "buy" && l.price == null && !l.priceOnRequest) warn("preis-fehlt", l.id);
      if (l.transactionType === "rent" && l.rentNet == null) warn("miete-fehlt", l.id);
      if (l.transactionType === "rent" && l.price != null) warn("transaktion-inkonsistent", `${l.id}: Miete mit Kaufpreis`);
      if (!l.livingArea && !["grundstueck", "parkplatz"].includes(l.propertyType)) warn("flaeche-fehlt", `${l.id} (${l.propertyType})`);
      if (!l.yearBuilt && !["grundstueck", "parkplatz"].includes(l.propertyType)) warn("baujahr-fehlt", `${l.id} (${l.propertyType})`);
      if (l.rooms != null && (l.rooms <= 0 || l.rooms > 20 || Math.round(l.rooms * 2) !== l.rooms * 2)) warn("zimmer-ungueltig", `${l.id}: ${l.rooms}`);
      if (l.rooms == null && ["wohnung", "haus", "villa", "chalet"].includes(l.propertyType)) warn("zimmer-fehlt", `${l.id} (${l.propertyType})`);
      if (l.floor != null && !["wohnung", "gewerbe"].includes(l.propertyType)) warn("etage-bei-typ-ohne-etage", `${l.id} (${l.propertyType})`);
      if (!bildVarianten(l.img).length) warn("bild-fehlt", `${l.id}: ${l.img}`);
      if (l.publicationStatus === "archiviert" && ["reserviert", "verkauft", "vermietet"].includes(l.availability.art)) warn("status-doppelt", `${l.id}: archiviert + ${l.availability.art}`);
    }

    /* ---- Synthetische Inserate ---- */
    let n = 0;
    for (const l of synthetisch) {
      const nr = String(l.id).replace(/\D/g, "").padStart(6, "0").slice(-4);
      const refL = `FWL-2026-10${nr}`, refP = `FWI-2026-10${nr}`;
      const [prz, radiusFix] = PRAEZISION[l.geo.genauigkeit] || PRAEZISION.gemeinde;
      const radius = radiusFix ?? (l.geo.anzeige?.genauigkeitM || 450);
      const anb = await anbieter(l);
      const prop = await sql`INSERT INTO property (public_ref, kind, postal_code, city, canton, place_id, geom_exact, geo_precision, geo_radius_m, rooms, living_area_m2, plot_area_m2, floor, built_year)
        VALUES (${refP}, ${ART[l.propertyType]}, ${l.postalCode}, ${l.city}, ${l.canton}, ${placeId[l.geo.gemeindeId] ?? null},
                ST_SetSRID(ST_MakePoint(${l.geo.lng}, ${l.geo.lat}), 4326)::geography, ${prz}, ${radius},
                ${l.rooms}, ${l.livingArea}, ${l.plotArea}, ${l.floor}, ${l.yearBuilt}) RETURNING id`;
      const pid = prop[0].id;
      for (const f of new Set(l.features || [])) await sql`INSERT INTO property_feature (property_id, feature_key) VALUES (${pid}, ${f}) ON CONFLICT DO NOTHING`;
      const a = l.availability || { art: "vereinbarung" };
      const ins = await sql`INSERT INTO listing (public_ref, property_id, transaction, publisher_kind, published_by_user_id, published_by_org_id, represented_by_org_id, contact_user_id,
          title, description, content_locale, price_chf, rent_net_chf, rent_extra_chf, deposit_max_chf, price_on_request, available_from, available_immediately, slug, is_demo)
        VALUES (${refL}, ${pid}, ${l.transactionType === "rent" ? "rent" : "sale"}, ${HERAUSGEBER[l.listingSource]}, ${anb.user}, ${anb.org}, ${null}, ${anb.user ?? (l.listingSource === "fourwalls" ? LENA : null)},
                ${l.title}, ${l.beschreibung ?? null}, 'de', ${l.transactionType === "rent" ? null : rp(l.price)}, ${rp(l.rentNet)}, ${rp(l.rentNK)}, ${l.transactionType === "rent" ? rp(l.kautionMax) : null},
                ${!!l.priceOnRequest}, ${a.art === "datum" && a.datum ? a.datum : null}, ${a.art === "sofort"}, ${l.slug}, true) RETURNING id`;
      const lid = ins[0].id;
      await sql`INSERT INTO listing_slug (slug, listing_id, is_current) VALUES (${l.slug}, ${lid}, true)`;
      /* Inhalt: handgeschriebenes Dossier hat Vorrang (bringt seine eigenen Bilder mit), sonst Ableitung */
      const eigen = FWD[l.slug];
      if (!eigen) { const aid = await asset(l.img); if (aid) await sql`INSERT INTO listing_image (listing_id, asset_id, sort_order, category, caption, is_cover) VALUES (${lid}, ${aid}, 0, 'wohnen', null, true)`; }
      if (eigen) { await dossierSchreiben(lid, l.title, eigen); }
      else for (const loc of ["de", "fr", "it", "en"]) {
        await sql`INSERT INTO listing_content (listing_id, locale, title, tagline, sections) VALUES (${lid}, ${loc}, ${l.title}, null, ${sql.json(abgeleiteteAbschnitte(l, loc))})`;
        /* Dokumente nur bei gewerblichen Anbietern — je Sprache dieselben Zeilen wären doppelt; die Namen stehen auf Deutsch (content_locale) */
      }
      if (!eigen && l.listingSource !== "privat") {
        await sql`INSERT INTO listing_document (listing_id, name, doc_type, access, sort_order) VALUES (${lid}, ${L18.de.objektdok}, 'pdf', 'on_request', 0)`;
        if (!["grundstueck", "parkplatz"].includes(l.propertyType)) await sql`INSERT INTO listing_document (listing_id, name, doc_type, access, sort_order) VALUES (${lid}, ${L18.de.grundriss}, 'pdf', 'on_request', 1)`;
      }
      const end = l.publicationStatus === "archiviert" ? "archived" : a.art === "reserviert" ? "reserved" : a.art === "verkauft" ? "sold" : a.art === "vermietet" ? "rented" : "published";
      await veroeffentlichen(lid, l.publishedAt, end);
      nachher(l, end, prz); n++;
    }
    bericht.importiert.synthetisch = n;

    /* ---- Mandate (properties.js): vier Sprachen ---- */
    let m = 0;
    for (const p of MANDATE) {
      const nr = String(p.id).replace(/\D/g, "").slice(-3).padStart(6, "0");
      const seehaus = p.slug === "seehaus-walensee";
      const refL = seehaus ? "FWL-2026-000142" : `FWL-2026-2${nr.slice(1)}`, refP = seehaus ? "FWI-DEMO-000001" : `FWI-2026-2${nr.slice(1)}`;
      const kind = ART_MANDAT[p.propertyType] || (p.rooms == null ? "multi_family" : "apartment");
      const ortsId = GEO.GeoProvider.ortNachName(p.city)?.id
        ?? ORTE_ERGAENZUNG.find(o => o.name.toLowerCase() === String(p.city).toLowerCase())?.id;
      if (!ortsId) warn("ort-unbekannt", `${p.id}: ${p.city}`);
      const prz = seehaus ? "approximate" : "approximate"; const radius = 450;
      const prop = await sql`INSERT INTO property (public_ref, kind, postal_code, city, canton, place_id, geom_exact, geo_precision, geo_radius_m, rooms, living_area_m2, usable_area_m2, plot_area_m2, volume_m3, bedrooms, bathrooms, floor, floors_total, built_year, ceiling_height_m)
        VALUES (${refP}, ${kind}, ${p.postalCode}, ${p.city}, ${p.canton}, ${ortsId ? placeId[ortsId] : null},
                ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography, ${prz}, ${radius},
                ${p.rooms ?? null}, ${p.livingArea ?? null}, ${seehaus ? 331 : null}, ${p.plotArea ?? null}, ${seehaus ? 1240 : null}, ${p.bedrooms ?? null}, ${p.bathrooms ?? null}, ${p.floor ?? null}, ${seehaus ? 2 : null}, ${p.yearBuilt ?? null}, ${seehaus ? 2.6 : null}) RETURNING id`;
      const pid = prop[0].id;
      for (const f of new Set(p.features || [])) await sql`INSERT INTO property_feature (property_id, feature_key) VALUES (${pid}, ${f}) ON CONFLICT DO NOTHING`;
      const kontakt = brokerId[p.broker] ?? LENA;
      const ins = await sql`INSERT INTO listing (public_ref, property_id, transaction, publisher_kind, published_by_org_id, represented_by_org_id, contact_user_id,
          title, description, content_locale, price_chf, rent_net_chf, rent_extra_chf, price_on_request, available_immediately, slug, is_demo)
        VALUES (${refL}, ${pid}, ${p.transactionType === "rent" ? "rent" : "sale"}, 'fourwalls', ${FW_ORG}, ${p.featured ? FW_ORG : null}, ${kontakt},
                ${p.title.de}, ${p.blurb.de}, 'de', ${p.transactionType === "rent" ? null : rp(p.price)}, ${rp(p.rentNet)}, ${rp(p.rentNK)}, ${!!p.priceOnRequest}, false, ${p.slug}, true) RETURNING id`;
      const lid = ins[0].id;
      await sql`INSERT INTO listing_slug (slug, listing_id, is_current) VALUES (${p.slug}, ${lid}, true)`;
      if (seehaus) await sql`INSERT INTO listing_slug (slug, listing_id, is_current) VALUES ('villa-am-walensee', ${lid}, false)`;
      const eigen = FWD[p.slug];
      if (eigen) await dossierSchreiben(lid, p.title.de, eigen, p);
      else {
        const bilder = p.images?.length ? p.images : [p.heroMedia];
        for (const [i, k] of bilder.entries()) { const aid = await asset(k); if (aid) await sql`INSERT INTO listing_image (listing_id, asset_id, sort_order, category, caption, is_cover) VALUES (${lid}, ${aid}, ${i}, 'wohnen', null, ${i === 0})`; }
        for (const loc of ["de", "fr", "it", "en"]) {
          const s = { story: { titel: p.title[loc] ?? p.title.de, absaetze: [p.description[loc] ?? p.description.de] }, highlights: p.highlights?.[loc] ?? p.highlights?.de ?? [] };
          if (p.energyData?.geak) s.energie = { geak: p.energyData.geak, geakKlasse: p.energyData.geak, ...(p.energyData.heating ? { heizung: p.energyData.heating[loc] ?? p.energyData.heating.de } : {}) };
          if (p.roomsBreakdown?.length) s.raeume = p.roomsBreakdown.map(([name, m2]) => ({ name, m2 }));
          s.naechsteSchritte = L18[loc][p.transactionType === "rent" ? "schritteM" : "schritte"];
          await sql`INSERT INTO listing_content (listing_id, locale, title, tagline, sections) VALUES (${lid}, ${loc}, ${p.title[loc] ?? p.title.de}, ${p.tagline?.[loc] ?? p.tagline?.de ?? null}, ${sql.json(s)})`;
        }
        for (const [i, d] of (p.documents || []).entries()) await sql`INSERT INTO listing_document (listing_id, name, doc_type, access, sort_order) VALUES (${lid}, ${({ dossier: "Verkaufsdokumentation", grundriss: "Grundrisse", factsheet: "Factsheet" })[d] ?? d}, 'pdf', 'on_request', ${i})`;
        zaehl(stat.sprachen, "4");
      }
      await veroeffentlichen(lid, p.createdAt ?? "2026-08-01", "published");
      if (p.featured) stat.exklusiv++;
      nachher({ listingSource: "fourwalls", transactionType: p.transactionType, propertyType: Object.entries(ART).find(([, v]) => v === kind)?.[0] ?? kind }, "published", prz); m++;
    }
    bericht.importiert.mandate = m;

    /* ---- Handgeschriebene Dossiers (detail-data.js): vollständige Abschnitte, Bilder mit Kategorien, Grundrisse, Dokumente ---- */
    async function dossierSchreiben(lid, titel, D, p) {
      const ZUG = { oeffentlich: "public", konto: "authenticated", anfrage: "on_request", besichtigung: "after_viewing", gesperrt: "internal" };
      const sections = {};
      for (const k of ["story", "highlights", "gebaeude", "ausstattung", "energie", "aussen", "parkieren", "lage", "finanzen", "faq", "naechsteSchritte"]) if (D[k] != null) sections[k] = D[k];
      if (D.medien) { const { bilder, ...rest } = D.medien; sections.medien = rest; }
      if (D.grundrisse) sections.grundrisse = D.grundrisse;
      if (D.finanzen) sections.finanzen = { nebenkosten: D.finanzen.nebenkosten, preisM2Kontext: D.finanzen.preisM2Kontext };
      await sql`INSERT INTO listing_content (listing_id, locale, title, tagline, sections) VALUES (${lid}, 'de', ${p?.title?.de ?? titel}, ${p?.tagline?.de ?? null}, ${sql.json(sections)})`;
      if (p) for (const loc of ["fr", "it", "en"]) {
        const s = { story: { titel: p.title[loc] ?? p.title.de, absaetze: [p.description[loc] ?? p.description.de] }, highlights: p.highlights?.[loc] ?? [] };
        await sql`INSERT INTO listing_content (listing_id, locale, title, tagline, sections) VALUES (${lid}, ${loc}, ${p.title[loc] ?? p.title.de}, ${p.tagline?.[loc] ?? null}, ${sql.json(s)})`;
      }
      const bilder = (D.medien?.bilder || []).map(b => typeof b === "string" ? { key: b, text: "", kat: "wohnen" } : b);
      for (const [i, b] of bilder.entries()) { const aid = await asset(b.key); if (aid) await sql`INSERT INTO listing_image (listing_id, asset_id, sort_order, category, caption, is_cover) VALUES (${lid}, ${aid}, ${i}, ${b.kat || "wohnen"}, ${b.text || null}, ${i === 0}) ON CONFLICT (listing_id, asset_id) DO NOTHING`; }
      for (const [i, g] of (D.grundrisse || []).entries()) await sql`INSERT INTO floorplan (listing_id, level_label, area_m2, sort_order, access) VALUES (${lid}, ${g.geschoss}, ${g.flaeche ?? null}, ${i}, 'public')`;
      for (const [i, d] of (D.dokumente || []).entries()) await sql`INSERT INTO listing_document (listing_id, name, doc_type, pages, sort_order, access) VALUES (${lid}, ${d.name}, ${d.typ || "pdf"}, ${d.seiten ?? null}, ${i}, ${ZUG[d.zugang] || "on_request"})`;
      zaehl(stat.sprachen, p ? "4" : "1+dossier");
    }

    /* ---- Testinserate (aus P5.2): exakte Lage, Gemeindegenauigkeit bei Miete, ein Entwurf ---- */
    const test = async (refP, refL, kind, plz, city, kt, ort, lng, lat, prz, radius, felder, listing, publish) => {
      const prop = await sql`INSERT INTO property (id, public_ref, kind, postal_code, city, canton, place_id, geom_exact, geo_precision, geo_radius_m, rooms, living_area_m2, built_year)
        VALUES (${felder.pid}, ${refP}, ${kind}, ${plz}, ${city}, ${kt}, ${placeId[ort] ?? null}, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${prz}, ${radius}, ${felder.rooms}, ${felder.living}, ${felder.built}) RETURNING id`;
      const ins = await sql`INSERT INTO listing (id, public_ref, property_id, transaction, publisher_kind, published_by_org_id, contact_user_id, title, content_locale, price_chf, rent_net_chf, rent_extra_chf, slug, is_demo)
        VALUES (${listing.id}, ${refL}, ${prop[0].id}, ${listing.trans}, 'fourwalls', ${FW_ORG}, ${LENA}, ${listing.title}, 'de', ${listing.price ?? null}, ${listing.rent ?? null}, ${listing.nk ?? null}, ${listing.slug}, true) RETURNING id`;
      await sql`INSERT INTO listing_slug (slug, listing_id) VALUES (${listing.slug}, ${ins[0].id})`;
      if (publish) await veroeffentlichen(ins[0].id, "2026-08-25", "published");
    };
    await test("FWI-DEMO-000002", "FWL-2026-000143", "apartment", "8032", "Zürich", "ZH", "ort-zuerich", 8.56, 47.366, "exact", 0, { pid: "d1000000-0000-4000-8000-000000000002", rooms: 3.5, living: 96, built: 1911 }, { id: "e1000000-0000-4000-8000-000000000002", trans: "sale", title: "Altbau in der Enge (Demo)", price: 169000000, slug: "altbau-enge-demo" }, true);
    await test("FWI-DEMO-000003", "FWL-2026-000144", "apartment", "3011", "Bern", "BE", "ort-bern", 7.442, 46.951, "municipality", 2000, { pid: "d1000000-0000-4000-8000-000000000003", rooms: 2.5, living: 60, built: 1965 }, { id: "e1000000-0000-4000-8000-000000000003", trans: "rent", title: "2.5-Zimmer-Wohnung (Demo)", rent: 185000, nk: 22000, slug: "wohnung-bern-demo" }, true);
    await test("FWI-DEMO-000004", "FWL-2026-000145", "house", "8883", "Quarten", "SG", "ort-quarten", 9.22, 47.115, "approximate", 450, { pid: "d1000000-0000-4000-8000-000000000004", rooms: 4.5, living: 140, built: null }, { id: "e1000000-0000-4000-8000-000000000004", trans: "sale", title: "Entwurf, nicht veröffentlicht (Demo)", price: 99000000, slug: "entwurf-unsichtbar" }, false);
    bericht.importiert.testinserate = 3;

    /* ---- Validierung gegen die Datenbank ---- */
    const db = await sql`SELECT
        count(*) FILTER (WHERE is_demo) AS demo,
        count(*) FILTER (WHERE status='published') AS publiziert,
        count(*) FILTER (WHERE status='reserved') AS reserviert,
        count(*) FILTER (WHERE status IN ('sold','rented')) AS verkauft_vermietet,
        count(*) FILTER (WHERE status='archived') AS archiviert,
        count(*) FILTER (WHERE status='draft') AS entwurf,
        count(*) FILTER (WHERE represented_by_org_id = ${FW_ORG}) AS exklusiv
      FROM listing`;
    const prz = await sql`SELECT geo_precision, count(*)::int AS n FROM property p JOIN listing l ON l.property_id=p.id WHERE l.is_demo GROUP BY 1 ORDER BY 1`;
    /* Rasterpunkt = exakter Punkt kommt vor, wenn eine Lage genau auf dem Raster liegt.
       Das verrät nicht mehr als jeder andere Rasterpunkt (±halbe Zelle) — wird berichtet, nicht abgebrochen. */
    const gleich = await sql`SELECT public_ref FROM property WHERE geo_precision <> 'exact' AND ST_Equals(geom_exact::geometry, geom_public::geometry)`;
    for (const g of gleich) warn("lage-auf-rasterpunkt", g.public_ref);
    const leak = await sql`SELECT count(*)::int AS n FROM property WHERE geo_precision <> 'exact' AND geom_public IS NULL`;
    const orte = await sql`SELECT count(*)::int AS n FROM property p JOIN listing l ON l.property_id=p.id WHERE l.is_demo AND p.place_id IS NULL`;
    bericht.datenbank = { ...db[0], praezision: Object.fromEntries(prz.map(r => [r.geo_precision, r.n])), ohneOeffentlichePunkt: leak[0].n, ohneOrt: orte[0].n };
    bericht.verteilung = stat;
    const erwartet = synthetisch.length + MANDATE.length;
    if (Number(db[0].demo) !== erwartet + 3) throw new Error(`Erwartet ${erwartet + 3} Demo-Inserate, gefunden ${db[0].demo}`);
    if (leak[0].n > 0) throw new Error(`${leak[0].n} ungenaue Lagen ohne öffentlichen Punkt`);
  });

  bericht.dauerMs = Date.now() - t0;
  mkdirSync(dirname(BERICHT), { recursive: true });
  writeFileSync(BERICHT, JSON.stringify(bericht, null, 2));
  console.log(JSON.stringify({ importiert: bericht.importiert, datenbank: bericht.datenbank, verteilung: bericht.verteilung, qualitaet: bericht.qualitaet, dauerMs: bericht.dauerMs }, null, 2));
  console.log(`Bericht: ${BERICHT}`);
  await sql.end();
}

/* Als Skript ausgeführt: importieren. Importiert (Tests): nur die Abbildung bereitstellen. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async e => { console.error("IMPORT ABGEBROCHEN — nichts geschrieben:", e.message); await sql.end(); process.exit(1); });
} else if (sql) { await sql.end(); }
export { ORTE_ERGAENZUNG, ART, ART_MANDAT, HERAUSGEBER, PRAEZISION, abgeleiteteAbschnitte, slugify, rp, synthetisch, MANDATE, L };
