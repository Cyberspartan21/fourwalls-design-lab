#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Seed fiktiver professioneller Anbieter (P5.7 §54/§55)

   Legt drei erfundene Organisationen mit vier erfundenen Personen und
   mindestens zehn veröffentlichten, fiktiven Inseraten an — Grundlage für
   die Prüfung der öffentlichen Anbieterseite (ZIEL A) ohne echte Kundendaten.

   Idempotent: ein zweiter Lauf legt nichts doppelt an. Erkennung über
   `organization.slug` (Organisationen, Inserate, Mitgliedschaften) und über
   `app_user.email` (Personen).

   Aufruf:
     set -a; . ./.env.local; set +a
     node scripts/seed-profis.mjs               anlegen (Standard)
     node scripts/seed-profis.mjs --entfernen    nur diese Demo-Organisationen
                                                  und ihre Inserate/Mitglied-
                                                  schaften wieder entfernen
                                                  (Konten bleiben bestehen)

   Umgebung:
     DATABASE_URL   Pflicht, verweigert in production
     Basis-URL      process.argv[3] oder http://localhost:3007 (Kontenanlage
                    läuft über die echte HTTP-API, siehe server/auth.ts)

   Mailquelle (P5.5 §53/§54/§63) — siehe scripts/lib/mailquelle.mjs:
     FW_TEST_MAIL_QUELLE   dev (Standard) | mailpit | imap

   Passwörter: zufällig erzeugt, NUR nach var/profis.local.json geschrieben
   (gitignored), NIE auf stdout ausgegeben. Existiert ein Konto schon, wird
   sein Passwort aus dieser Datei übernommen.
   ============================================================ */
import postgres from "postgres";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { mailquelle } from "./lib/mailquelle.mjs";

const HIER = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HIER, "..");
const VAR_DATEI = join(APP_ROOT, "var", "profis.local.json");

const ENTFERNEN = process.argv.includes("--entfernen");
const BASIS = (process.argv.find(a => a.startsWith("http")) || "http://localhost:3007").replace(/\/$/, "");
const TIMEOUT_MS = 60_000;

if (process.env.APP_ENV === "production") { console.error("seed-profis läuft nicht in production."); process.exit(2); }
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a)"); process.exit(2); }
const sql = postgres(DATABASE_URL, { max: 4, onnotice: () => {} });

const SEED = "00000000-0000-0000-0000-00000000dead";

/* ---------- Die drei Organisationen ---------- */
const ORGS = [
  {
    slug: "alpha-immobilien-ag-demo", kind: "agency", displayName: "Alpha Immobilien AG (Demo)",
    legalName: "Alpha Immobilien AG (Demo)", ort: "ort-zuerich", city: "Zürich", postalCode: "8001", canton: "ZH",
    verificationState: "unverified", locale: "de", publicEmail: "kontakt@alpha-demo.example",
    description: "Alpha Immobilien AG ist ein fiktives Maklerbüro in Zürich — angelegt für die Prüfung der öffentlichen Anbieterseite. Keine echte Firma, keine echten Objekte."
  },
  {
    slug: "seewind-verwaltung-gmbh-demo", kind: "property_manager", displayName: "Seewind Verwaltung GmbH (Demo)",
    legalName: "Seewind Verwaltung GmbH (Demo)", ort: "ort-luzern", city: "Luzern", postalCode: "6003", canton: "LU",
    verificationState: "unverified", locale: "de", publicEmail: "kontakt@seewind-demo.example",
    description: "Seewind Verwaltung GmbH ist eine fiktive Liegenschaftsverwaltung in Luzern — angelegt für Testzwecke, keine echte Firma."
  },
  {
    slug: "nordlicht-bautraeger-ag-demo", kind: "developer", displayName: "Nordlicht Bauträger AG (Demo)",
    legalName: "Nordlicht Bauträger AG (Demo)", ort: "ort-bern", city: "Bern", postalCode: "3011", canton: "BE",
    verificationState: "unverified", locale: "de", publicEmail: "kontakt@nordlicht-demo.example",
    description: "Nordlicht Bauträger AG ist ein fiktiver Bauträger in Bern — angelegt für Testzwecke, keine echte Firma, keine echten Neubauprojekte."
  }
];
const ORG_SLUGS = ORGS.map(o => o.slug);

/* ---------- Die vier Personen ---------- */
const PERSONEN = [
  { email: "alpha-owner@fourwalls.example", name: "Petra Iten", orgSlug: "alpha-immobilien-ag-demo", rolle: "owner" },
  { email: "alpha-agent@fourwalls.example", name: "Marco Suter", orgSlug: "alpha-immobilien-ag-demo", rolle: "agent" },
  { email: "seewind-admin@fourwalls.example", name: "Claudia Meier", orgSlug: "seewind-verwaltung-gmbh-demo", rolle: "owner" },
  { email: "nordlicht-dev@fourwalls.example", name: "Reto Baumann", orgSlug: "nordlicht-bautraeger-ag-demo", rolle: "owner" }
];

/* ---------- HTTP-Hilfsfunktionen (wie scripts/lieferkette-test.mjs) ---------- */
const RUNSEED = Math.floor(Math.random() * 200) + 10;
const xffMap = new Map();
function xff(tag) {
  if (!xffMap.has(tag)) xffMap.set(tag, `10.${RUNSEED}.${xffMap.size + 1}.21`);
  return xffMap.get(tag);
}
async function api(method, pfad, { origin, body, xffTag } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const h = {};
    if (origin !== undefined) h["origin"] = origin;
    if (xffTag) h["x-forwarded-for"] = xff(xffTag);
    let payload;
    if (body !== undefined) { h["content-type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await fetch(BASIS + pfad, { method, headers: h, body: payload, redirect: "manual", signal: ctrl.signal });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* kein JSON */ }
    return { status: res.status, json, text };
  } finally { clearTimeout(timer); }
}

const MAILQUELLE = mailquelle();
async function bestaetigeMail(email) {
  const mail = await MAILQUELLE.warte(email, null);
  if (!mail) throw new Error(`Keine Bestätigungsmail für ${email} über Mailquelle "${MAILQUELLE.name}" gefunden`);
  const treffer = mail.text.match(/https?:\/\/\S+/);
  if (!treffer) throw new Error(`Keine URL in der Mail an ${email} gefunden`);
  await fetch(treffer[0], { redirect: "manual" });
}

function zufallsPasswort() { return "Seed-" + randomBytes(12).toString("base64url"); }

/* ---------- var/profis.local.json ---------- */
function datenLesen() {
  if (!existsSync(VAR_DATEI)) return { personas: {} };
  try { return JSON.parse(readFileSync(VAR_DATEI, "utf8")); } catch { return { personas: {} }; }
}
function datenSchreiben(daten) {
  mkdirSync(dirname(VAR_DATEI), { recursive: true });
  writeFileSync(VAR_DATEI, JSON.stringify(daten, null, 2));
}

/* ---------- Personen anlegen (idempotent über app_user.email) ---------- */
async function personAnlegen(p, vorherigeDaten, xffTag) {
  const bestehend = await sql`SELECT id FROM app_user WHERE email = ${p.email} AND deleted_at IS NULL`;
  if (bestehend.length) {
    return { id: bestehend[0].id, neu: false, passwort: vorherigeDaten.personas?.[p.email]?.passwort ?? null };
  }
  const passwort = zufallsPasswort();
  const r = await api("POST", "/api/auth/sign-up/email", { origin: BASIS, xffTag, body: { email: p.email, password: passwort, name: p.name } });
  if (r.status !== 200) throw new Error(`Registrierung ${p.email} fehlgeschlagen: Status ${r.status} — ${r.text.slice(0, 300)}`);
  await bestaetigeMail(p.email);
  const nach = await sql`SELECT id FROM app_user WHERE email = ${p.email} AND deleted_at IS NULL`;
  if (!nach.length) throw new Error(`Nach der Registrierung kein app_user für ${p.email} gefunden`);
  return { id: nach[0].id, neu: true, passwort };
}

/* ---------- Organisationen anlegen (idempotent über organization.slug) ---------- */
async function organisationAnlegen(o) {
  const bestehend = await sql`SELECT id FROM organization WHERE slug = ${o.slug}`;
  if (bestehend.length) return { id: bestehend[0].id, neu: false };
  const platzId = (await sql`SELECT id FROM place WHERE key = ${o.ort}`)[0]?.id ?? null;
  const row = await sql`
    INSERT INTO organization (slug, kind, legal_name, display_name, city, postal_code, verification_state, locale, public_email, description, created_by)
    VALUES (${o.slug}, ${o.kind}, ${o.legalName}, ${o.displayName}, ${o.city}, ${o.postalCode}, ${o.verificationState}, ${o.locale}, ${o.publicEmail}, ${o.description}, ${SEED})
    RETURNING id`;
  return { id: row[0].id, neu: true, placeId: platzId };
}

/* ---------- Mitgliedschaft (idempotent über den Primärschlüssel) ---------- */
async function mitgliedschaftSicherstellen(orgId, userId, rolle) {
  await sql`
    INSERT INTO org_membership (organization_id, user_id, role) VALUES (${orgId}, ${userId}, ${rolle})
    ON CONFLICT (organization_id, user_id) DO NOTHING`;
}

/* ---------- Veröffentlichen über die Zustandsmaschine (wie import-demo.mjs) ---------- */
async function veroeffentlichen(listingId, publishedAt) {
  for (const s of ["submitted", "in_review", "approved"]) await sql`UPDATE listing SET status = ${s} WHERE id = ${listingId}`;
  await sql`UPDATE listing SET status = 'published', published_at = ${publishedAt}, is_indexable = true WHERE id = ${listingId}`;
}

/* ---------- Ein fiktives Inserat samt Liegenschaft anlegen (idempotent über den Slug) ---------- */
async function inseratAnlegen(l, bilder) {
  const vorhanden = await sql`SELECT listing_id FROM listing_slug WHERE slug = ${l.slug}`;
  if (vorhanden.length) return { neu: false };

  const platz = await sql`SELECT id, ST_X(centroid::geometry) AS lng, ST_Y(centroid::geometry) AS lat FROM place WHERE key = ${l.ort}`;
  const p = platz[0];
  if (!p) throw new Error(`Ort ${l.ort} nicht gefunden — läuft der Demo-Import (scripts/import-demo.mjs)?`);

  const prop = await sql`
    INSERT INTO property (kind, postal_code, city, canton, place_id, geom_exact, geo_precision, geo_radius_m, rooms, living_area_m2, built_year)
    VALUES (${l.propertyKind}, ${l.postalCode}, ${l.city}, ${l.canton}, ${p.id},
            ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326)::geography, 'municipality', 2000,
            ${l.rooms}, ${l.livingArea}, ${l.builtYear ?? null})
    RETURNING id`;
  const propertyId = prop[0].id;

  const ins = await sql`
    INSERT INTO listing (property_id, transaction, publisher_kind, published_by_org_id, published_by_user_id, assigned_user_id,
        title, description, content_locale, price_chf, rent_net_chf, rent_extra_chf, slug, is_demo)
    VALUES (${propertyId}, ${l.transaction}, ${l.publisherKind}, ${l.orgId}, ${l.ownerUserId}, ${l.assignedUserId ?? null},
            ${l.title}, ${l.description}, 'de', ${l.priceChf ?? null}, ${l.rentNetChf ?? null}, ${l.rentExtraChf ?? null}, ${l.slug}, true)
    RETURNING id`;
  const listingId = ins[0].id;
  await sql`INSERT INTO listing_slug (slug, listing_id, is_current) VALUES (${l.slug}, ${listingId}, true)`;

  const asset = bilder[l.bildIndex % bilder.length];
  if (asset) await sql`INSERT INTO listing_image (listing_id, asset_id, sort_order, category, is_cover) VALUES (${listingId}, ${asset}, 0, 'wohnen', true)`;

  await veroeffentlichen(listingId, l.publishedAt ?? "2026-08-01");
  return { neu: true };
}

/* ---------- Die elf fiktiven Inserate ---------- */
function inserate(orgIds, userIds) {
  const rp = chf => Math.round(chf * 100);
  const alpha = orgIds["alpha-immobilien-ag-demo"], seewind = orgIds["seewind-verwaltung-gmbh-demo"], nordlicht = orgIds["nordlicht-bautraeger-ag-demo"];
  const alphaOwner = userIds["alpha-owner@fourwalls.example"], alphaAgent = userIds["alpha-agent@fourwalls.example"];
  const seewindOwner = userIds["seewind-admin@fourwalls.example"], nordlichtOwner = userIds["nordlicht-dev@fourwalls.example"];
  return [
    { slug: "alpha-wohnung-zuerich-altstetten-demo", ort: "ort-zuerich", postalCode: "8048", city: "Zürich", canton: "ZH", propertyKind: "apartment", rooms: 3.5, livingArea: 88, builtYear: 1998, transaction: "sale", publisherKind: "agency", orgId: alpha, ownerUserId: alphaOwner, assignedUserId: alphaAgent, title: "Moderne 3.5-Zimmer-Wohnung am Stadtrand (Demo)", description: "Fiktives Demo-Inserat: helle 3.5-Zimmer-Wohnung mit Balkon in Zürich-Altstetten. Keine echte Liegenschaft.", priceChf: rp(890000), bildIndex: 0 },
    { slug: "alpha-attika-zuerich-demo", ort: "ort-zuerich", postalCode: "8002", city: "Zürich", canton: "ZH", propertyKind: "apartment", rooms: 4.5, livingArea: 140, builtYear: 2015, transaction: "sale", publisherKind: "agency", orgId: alpha, ownerUserId: alphaOwner, assignedUserId: alphaAgent, title: "Lichtdurchflutete Attikawohnung mit Seesicht (Demo)", description: "Fiktives Demo-Inserat: grosszügige Attikawohnung mit Dachterrasse und Seesicht. Keine echte Liegenschaft.", priceChf: rp(2450000), bildIndex: 1 },
    { slug: "alpha-einfamilienhaus-zuerich-demo", ort: "ort-zuerich", postalCode: "8055", city: "Zürich", canton: "ZH", propertyKind: "house", rooms: 5.5, livingArea: 165, builtYear: 1985, transaction: "sale", publisherKind: "agency", orgId: alpha, ownerUserId: alphaOwner, assignedUserId: alphaAgent, title: "Charmantes Einfamilienhaus mit Garten (Demo)", description: "Fiktives Demo-Inserat: gepflegtes Einfamilienhaus mit grossem Garten in ruhiger Lage. Keine echte Liegenschaft.", priceChf: rp(1980000), bildIndex: 2 },
    { slug: "alpha-wohnung-zuerich-west-demo", ort: "ort-zuerich", postalCode: "8005", city: "Zürich", canton: "ZH", propertyKind: "apartment", rooms: 4.5, livingArea: 118, builtYear: 2008, transaction: "sale", publisherKind: "agency", orgId: alpha, ownerUserId: alphaOwner, title: "Grosszügige 4.5-Zimmer-Wohnung, Zürich West (Demo)", description: "Fiktives Demo-Inserat: grosszügige Wohnung im aufstrebenden Zürich West. Keine echte Liegenschaft.", priceChf: rp(1650000), bildIndex: 3 },
    { slug: "alpha-haus-zuerich-weitsicht-demo", ort: "ort-zuerich", postalCode: "8053", city: "Zürich", canton: "ZH", propertyKind: "house", rooms: 6.5, livingArea: 210, builtYear: 1979, transaction: "sale", publisherKind: "agency", orgId: alpha, ownerUserId: alphaOwner, title: "Freistehendes Haus mit Weitsicht (Demo)", description: "Fiktives Demo-Inserat: freistehendes Haus mit Weitsicht und grossem Umschwung. Keine echte Liegenschaft.", priceChf: rp(2650000), bildIndex: 4 },

    { slug: "seewind-wohnung-luzern-1-demo", ort: "ort-luzern", postalCode: "6005", city: "Luzern", canton: "LU", propertyKind: "apartment", rooms: 2.5, livingArea: 62, builtYear: 2001, transaction: "rent", publisherKind: "property_manager", orgId: seewind, ownerUserId: seewindOwner, title: "Helle 2.5-Zimmer-Wohnung zur Miete (Demo)", description: "Fiktives Demo-Inserat: helle 2.5-Zimmer-Mietwohnung nahe dem See. Keine echte Liegenschaft.", rentNetChf: rp(1650), rentExtraChf: rp(180), bildIndex: 5 },
    { slug: "seewind-wohnung-luzern-2-demo", ort: "ort-luzern", postalCode: "6006", city: "Luzern", canton: "LU", propertyKind: "apartment", rooms: 3, livingArea: 78, builtYear: 2010, transaction: "rent", publisherKind: "property_manager", orgId: seewind, ownerUserId: seewindOwner, title: "Moderne 3-Zimmer-Wohnung nahe Vierwaldstättersee (Demo)", description: "Fiktives Demo-Inserat: moderne Mietwohnung nahe dem Vierwaldstättersee. Keine echte Liegenschaft.", rentNetChf: rp(2100), rentExtraChf: rp(200), bildIndex: 0 },
    { slug: "seewind-wohnung-luzern-3-demo", ort: "ort-luzern", postalCode: "6014", city: "Luzern", canton: "LU", propertyKind: "apartment", rooms: 4, livingArea: 95, builtYear: 1995, transaction: "rent", publisherKind: "property_manager", orgId: seewind, ownerUserId: seewindOwner, title: "Ruhige 4-Zimmer-Wohnung mit Balkon (Demo)", description: "Fiktives Demo-Inserat: ruhige Mietwohnung mit Balkon in Luzern. Keine echte Liegenschaft.", rentNetChf: rp(2450), rentExtraChf: rp(220), bildIndex: 1 },

    { slug: "nordlicht-neubau-bern-1-demo", ort: "ort-bern", postalCode: "3013", city: "Bern", canton: "BE", propertyKind: "apartment", rooms: 3.5, livingArea: 92, builtYear: 2027, transaction: "sale", publisherKind: "developer", orgId: nordlicht, ownerUserId: nordlichtOwner, title: "Neubau: 3.5-Zimmer-Wohnung mit Balkon (Demo)", description: "Fiktives Demo-Inserat: Neubauwohnung mit Balkon, Erstbezug voraussichtlich 2027. Keine echte Liegenschaft, kein echtes Projekt.", priceChf: rp(1150000), bildIndex: 2 },
    { slug: "nordlicht-neubau-bern-2-demo", ort: "ort-bern", postalCode: "3013", city: "Bern", canton: "BE", propertyKind: "apartment", rooms: 4.5, livingArea: 135, builtYear: 2027, transaction: "sale", publisherKind: "developer", orgId: nordlicht, ownerUserId: nordlichtOwner, title: "Neubau: 4.5-Zimmer-Attikawohnung (Demo)", description: "Fiktives Demo-Inserat: Neubau-Attikawohnung mit Dachterrasse, Erstbezug voraussichtlich 2027. Keine echte Liegenschaft, kein echtes Projekt.", priceChf: rp(1780000), bildIndex: 3 },
    { slug: "nordlicht-neubau-bern-3-demo", ort: "ort-bern", postalCode: "3014", city: "Bern", canton: "BE", propertyKind: "apartment", rooms: 2.5, livingArea: 68, builtYear: 2027, transaction: "sale", publisherKind: "developer", orgId: nordlicht, ownerUserId: nordlichtOwner, title: "Neubau: 2.5-Zimmer-Wohnung, Erstbezug (Demo)", description: "Fiktives Demo-Inserat: kompakte Neubauwohnung, Erstbezug voraussichtlich 2027. Keine echte Liegenschaft, kein echtes Projekt.", priceChf: rp(690000), bildIndex: 4 }
  ];
}

/* ---------- Entfernen ---------- */
async function entfernen() {
  const orgs = await sql`SELECT id, slug FROM organization WHERE slug = ANY(${ORG_SLUGS})`;
  if (!orgs.length) { console.log("Keine der Seed-Organisationen vorhanden — nichts zu entfernen."); return; }
  const orgIds = orgs.map(o => o.id);

  const listings = await sql`SELECT id, property_id FROM listing WHERE published_by_org_id = ANY(${orgIds})`;
  const listingIds = listings.map(l => l.id);
  const propertyIds = listings.map(l => l.property_id);

  await sql.begin(async tx => {
    if (listingIds.length) {
      await tx`DELETE FROM inquiry WHERE listing_id = ANY(${listingIds})`;
      await tx`DELETE FROM listing WHERE id = ANY(${listingIds})`;
    }
    if (propertyIds.length) await tx`DELETE FROM property WHERE id = ANY(${propertyIds})`;
    await tx`DELETE FROM org_membership WHERE organization_id = ANY(${orgIds})`;
    await tx`DELETE FROM organization WHERE id = ANY(${orgIds})`;
  });
  console.log(`Entfernt: ${orgs.length} Organisation(en), ${listingIds.length} Inserat(e). Konten (app_user) bleiben bestehen.`);
}

/* ---------- Anlegen ---------- */
async function anlegen() {
  const vorherigeDaten = datenLesen();
  const personas = { ...vorherigeDaten.personas };

  console.log("Personen …");
  const userIds = {};
  for (const [i, p] of PERSONEN.entries()) {
    const r = await personAnlegen(p, vorherigeDaten, `profis-${i}`);
    userIds[p.email] = r.id;
    if (r.neu) { personas[p.email] = { passwort: r.passwort }; console.log(`  neu:       ${p.email}`); }
    else console.log(`  vorhanden: ${p.email}`);
  }
  datenSchreiben({ generiertAm: new Date().toISOString(), personas });

  console.log("Organisationen …");
  const orgIds = {};
  for (const o of ORGS) {
    const r = await organisationAnlegen(o);
    orgIds[o.slug] = r.id;
    console.log(`  ${r.neu ? "neu:      " : "vorhanden:"} ${o.slug}`);
  }

  console.log("Mitgliedschaften …");
  for (const p of PERSONEN) await mitgliedschaftSicherstellen(orgIds[p.orgSlug], userIds[p.email], p.rolle);

  console.log("Inserate …");
  const bilder = (await sql`SELECT id FROM media_asset WHERE storage_key LIKE 'demo/%-1600.jpg' ORDER BY storage_key`).map(r => r.id);
  if (!bilder.length) console.warn("  Achtung: keine Demo-Bild-Assets gefunden (scripts/import-demo.mjs vorher laufen lassen?) — Inserate ohne Bild.");
  const zaehlerVorher = {};
  for (const slug of ORG_SLUGS) zaehlerVorher[slug] = 0;

  let neuAngelegt = 0;
  for (const l of inserate(orgIds, userIds)) {
    const r = await inseratAnlegen(l, bilder);
    if (r.neu) neuAngelegt++;
  }
  console.log(`  ${neuAngelegt} neu angelegt (Rest bereits vorhanden).`);

  const tabelle = await sql`
    SELECT o.display_name AS organisation, count(l.id)::int AS anzahl_inserate
      FROM organization o LEFT JOIN listing l ON l.published_by_org_id = o.id AND l.status = 'published'
     WHERE o.slug = ANY(${ORG_SLUGS})
     GROUP BY o.display_name ORDER BY o.display_name`;
  console.log("\n=== Organisation → veröffentlichte Inserate ===");
  console.table(tabelle.map(r => ({ Organisation: r.organisation, "Inserate (veröffentlicht)": r.anzahl_inserate })));
}

try {
  if (ENTFERNEN) await entfernen();
  else await anlegen();
} finally {
  await sql.end();
}
