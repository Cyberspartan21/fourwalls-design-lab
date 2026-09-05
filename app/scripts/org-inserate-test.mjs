#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Organisationsinserate, Team, Zuweisung, Posteingang,
   CSV-Import (P5.7)

   Prüft über HTTP, dass ein Inserat einer Organisation gehört, das Team
   daran arbeitet, die Zuweisung das Team respektiert, Anfragen zur
   Organisation laufen, die Übersicht serverseitig blättert und der
   CSV-Import eine wiederholbare, dokumentierte Grenze ist.

   Organisationen und Mitgliedschaften legt dieses Skript DIREKT per SQL an
   (wie scripts/import-demo.mjs) — die HTTP-Verwaltungsrouten dafür sind
   Teil eines anderen Auftrags. Konten entstehen über die öffentliche API,
   wie in scripts/lieferkette-test.mjs.

   Aufruf:
     set -a; . ./.env.local; set +a
     FW_TEST_MOD_EMAIL=... FW_TEST_MOD_PASSWORT=... node scripts/org-inserate-test.mjs [Basis-URL]

   Exit 1 bei irgendeinem FEHLER, sonst 0. Räumt seine Testorganisationen und
   -inserate am Ende immer auf (auch bei einem Fehler mittendrin).
   ============================================================ */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mailquelle, testadresse } from "./lib/mailquelle.mjs";

const HIER = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HIER, "..");
const BASIS = (process.argv[2] || "http://localhost:3007").replace(/\/$/, "");
const TIMEOUT_MS = 60_000;
const TS = Date.now();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a)"); process.exit(2); }
const sql = postgres(DATABASE_URL, { max: 4, onnotice: () => {} });

const MOD_EMAIL_STANDARD = process.env.FW_TEST_MOD_EMAIL;
const MOD_PASSWORT_STANDARD = process.env.FW_TEST_MOD_PASSWORT;
if (!MOD_EMAIL_STANDARD || !MOD_PASSWORT_STANDARD) {
  console.error("FW_TEST_MOD_EMAIL und FW_TEST_MOD_PASSWORT fehlen — Zugangsdaten des Moderationskontos kommen aus der Umgebung, nie aus dem Skript.");
  process.exit(2);
}

const PASSWORT = "Orgtest-" + randomBytes(12).toString("base64url");
const EMAIL_A = testadresse("oia", TS);   // owner Alpha
const EMAIL_B = testadresse("oib", TS);   // agent Alpha
const EMAIL_C = testadresse("oic", TS);   // owner Beta
const EMAIL_D = testadresse("oid", TS);   // Kunde, keine Mitgliedschaft
const BILD_PFAD = join(APP_ROOT, "public", "media", "zurich-altbau-1-960.jpg");
const ORT_ID = "ort-bern";
const TITEL = `Alpha-Teamwohnung ${TS}`;
const BESCHREIBUNG = "Eine gepflegte Wohnung im Teamportfolio der Organisation — automatisierte Prüfung, bitte ignorieren.";
const PFAD = { de: { immobilien: "immobilien", kaufen: "kaufen", mieten: "mieten" } };

const ergebnisse = [];
function assertTrue(bedingung, meldung) { if (!bedingung) throw new Error(meldung); }
function assertGleich(ist, soll, feld) {
  if (ist !== soll) throw new Error(`${feld}: erwartet ${JSON.stringify(soll)}, erhalten ${JSON.stringify(ist)}`);
}
async function schritt(bez, titel, fn) {
  try {
    const detail = (await fn()) || "ok";
    ergebnisse.push({ bez, titel, status: "OK", detail });
    console.log(`OK      ${String(bez).padStart(3)}  ${titel}`);
  } catch (e) {
    const detail = e && e.message ? e.message : String(e);
    ergebnisse.push({ bez, titel, status: "FEHLER", detail });
    console.log(`FEHLER  ${String(bez).padStart(3)}  ${titel} — ${detail}`);
  }
}

const RUNSEED = Math.floor(Math.random() * 200) + 10;
const xffMap = new Map();
function xff(tag) {
  if (!xffMap.has(tag)) xffMap.set(tag, `10.${RUNSEED}.${xffMap.size + 1}.21`);
  return xffMap.get(tag);
}

async function api(method, pfad, { cookie, origin, body, headers = {}, xffTag, roheBody, contentType } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const h = { ...headers };
    if (cookie) h["cookie"] = cookie;
    if (origin !== undefined) h["origin"] = origin;
    if (xffTag) h["x-forwarded-for"] = xff(xffTag);
    let payload;
    if (roheBody !== undefined) { payload = roheBody; if (contentType) h["content-type"] = contentType; }
    else if (body !== undefined) { h["content-type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await fetch(BASIS + pfad, { method, headers: h, body: payload, redirect: "manual", signal: ctrl.signal });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* kein JSON */ }
    const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    return { status: res.status, json, text, setCookies };
  } finally { clearTimeout(timer); }
}
const get = (p, o) => api("GET", p, o);
const post = (p, o) => api("POST", p, o);
const patch = (p, o) => api("PATCH", p, o);

function cookieAus(setCookies) {
  const c = setCookies.find(c => c.startsWith("fw.session_token="));
  return c ? c.split(";")[0] : null;
}

async function holenHtml(pfad, { cookie } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const h = {}; if (cookie) h["cookie"] = cookie;
    const res = await fetch(BASIS + pfad, { headers: h, redirect: "manual", signal: ctrl.signal });
    const text = await res.text().catch(() => "");
    return { status: res.status, text };
  } finally { clearTimeout(timer); }
}

async function uploadDatei(cookie, pfad, dateiname, mime) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const fd = new FormData();
    fd.append("datei", new Blob([readFileSync(pfad)], { type: mime }), dateiname);
    const res = await fetch(BASIS + "/api/medien", { method: "POST", headers: { origin: BASIS, cookie }, body: fd, redirect: "manual", signal: ctrl.signal });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* kein JSON */ }
    return { status: res.status, json };
  } finally { clearTimeout(timer); }
}

const MAILQUELLE = mailquelle();
async function bestaetigeMail(email) {
  const mail = await MAILQUELLE.warte(email, null);
  if (!mail) throw new Error(`Keine Mail für ${email} über Mailquelle "${MAILQUELLE.name}" gefunden`);
  const treffer = mail.text.match(/https?:\/\/\S+/);
  if (!treffer) throw new Error(`Keine URL in der Mail an ${email} gefunden`);
  const res = await fetch(treffer[0], { redirect: "manual" });
  return res.status;
}
async function registrieren(email, passwort, name, xffTag) {
  return post("/api/auth/sign-up/email", { origin: BASIS, xffTag, body: { email, password: passwort, name } });
}
async function anmelden(email, passwort, xffTag) {
  const r = await post("/api/auth/sign-in/email", { origin: BASIS, xffTag, body: { email, password: passwort } });
  return { ...r, cookie: cookieAus(r.setCookies) };
}
async function konto(email, passwort, name, xffTag) {
  const su = await registrieren(email, passwort, name, xffTag + "-signup");
  assertGleich(su.status, 200, `signup ${email}`);
  await bestaetigeMail(email);
  const an = await anmelden(email, passwort, xffTag + "-auth");
  assertGleich(an.status, 200, `signin ${email}`);
  return { email, cookie: an.cookie, id: an.json.user.id };
}

/* ---------- Aufräumen — läuft immer, auch nach einem Fehler ---------- */
let alphaId = null, betaId = null;
async function aufraeumen() {
  try {
    const ids = [alphaId, betaId].filter(Boolean);
    if (!ids.length) return;
    const props = await sql`SELECT property_id FROM listing WHERE published_by_org_id = ANY(${ids})`;
    await sql`DELETE FROM inquiry WHERE recipient_org_id = ANY(${ids})`;
    await sql`DELETE FROM listing WHERE published_by_org_id = ANY(${ids})`;
    const propIds = props.map(p => p.property_id).filter(Boolean);
    if (propIds.length) await sql`DELETE FROM property WHERE id = ANY(${propIds})`;
    await sql`DELETE FROM organization WHERE id = ANY(${ids})`;
    console.log(`Aufgeräumt: Organisationen ${ids.join(", ")} und ihre Testinserate gelöscht.`);
  } catch (e) {
    console.error("Aufräumen fehlgeschlagen:", e.message || e);
  }
}

const START = Date.now();
console.log(`Basis: ${BASIS}  —  Organisationsinserate-Prüfung startet (TS=${TS})`);

let A, B, C, D, MOD;
let refX, versionX, externalBestehend;

try {
  /* ---------- Vorbereitung: Konten, Organisationen, Mitgliedschaften ---------- */
  await schritt("V1", "Vier Konten anlegen (A, B, C, D)", async () => {
    A = await konto(EMAIL_A, PASSWORT, "Owner Alpha (Org-Test)", "oi-a");
    B = await konto(EMAIL_B, PASSWORT, "Agent Alpha (Org-Test)", "oi-b");
    C = await konto(EMAIL_C, PASSWORT, "Owner Beta (Org-Test)", "oi-c");
    D = await konto(EMAIL_D, PASSWORT, "Kunde ohne Team (Org-Test)", "oi-d");
    return `A=${A.id} B=${B.id} C=${C.id} D=${D.id}`;
  });

  await schritt("V2", "Organisationen Alpha/Beta und Mitgliedschaften per SQL anlegen", async () => {
    /* Rest eines abgebrochenen Laufs zuerst entfernen — Inserate und Anfragen
       vor der Organisation, sonst blockiert der Fremdschlüssel. */
    const alte = await sql`SELECT id FROM organization WHERE slug IN ('alpha', 'beta')`;
    if (alte.length) {
      const alteIds = alte.map(r => r.id);
      await sql`DELETE FROM inquiry WHERE recipient_org_id = ANY(${alteIds})`;
      await sql`DELETE FROM listing WHERE published_by_org_id = ANY(${alteIds})`;
      await sql`DELETE FROM organization WHERE id = ANY(${alteIds})`;
    }
    const [alpha] = await sql`
      INSERT INTO organization (slug, kind, legal_name, display_name, public_email, public_phone, email, phone, is_active)
      VALUES ('alpha', 'agency', 'Alpha Immobilien AG (Demo)', 'Alpha Immobilien AG (Demo)', ${testadresse("alpha-org", TS)}, '+41 44 111 22 33', ${testadresse("alpha-verwaltung", TS)}, '+41 44 111 22 33', true)
      RETURNING id`;
    const [beta] = await sql`
      INSERT INTO organization (slug, kind, legal_name, display_name, public_email, public_phone, email, phone, is_active)
      VALUES ('beta', 'agency', 'Beta Verwaltung AG (Demo)', 'Beta Verwaltung AG (Demo)', ${testadresse("beta-org", TS)}, '+41 44 222 33 44', ${testadresse("beta-verwaltung", TS)}, '+41 44 222 33 44', true)
      RETURNING id`;
    alphaId = alpha.id; betaId = beta.id;
    await sql`INSERT INTO org_membership (organization_id, user_id, role, is_active) VALUES (${alphaId}, ${A.id}, 'owner', true)`;
    await sql`INSERT INTO org_membership (organization_id, user_id, role, is_active) VALUES (${alphaId}, ${B.id}, 'agent', true)`;
    await sql`INSERT INTO org_membership (organization_id, user_id, role, is_active) VALUES (${betaId}, ${C.id}, 'owner', true)`;
    return `alpha=${alphaId}, beta=${betaId}`;
  });

  /* ---------- (1) Anlegen unter der Organisation ---------- */
  await schritt(1, "A legt ein Inserat unter Alpha an — publisher_kind=agency, published_by_org_id, assigned_user_id=A", async () => {
    const r = await post("/api/org/alpha/inserate", { origin: BASIS, cookie: A.cookie, body: {} });
    assertGleich(r.status, 201, "status");
    refX = r.json.publicRef; versionX = r.json.version;
    const [row] = await sql`SELECT status, publisher_kind, published_by_org_id, published_by_user_id, assigned_user_id, contact_user_id FROM listing WHERE public_ref = ${refX}`;
    assertGleich(row.status, "draft", "status");
    assertGleich(row.publisher_kind, "agency", "publisher_kind");
    assertGleich(String(row.published_by_org_id), String(alphaId), "published_by_org_id");
    assertGleich(String(row.assigned_user_id), String(A.id), "assigned_user_id");
    assertGleich(row.contact_user_id, null, "contact_user_id");
    return `publicRef=${refX}, publisher_kind=${row.publisher_kind}, assigned_user_id=${row.assigned_user_id}`;
  });

  /* ---------- (2) A speichert (Autosave) ---------- */
  await schritt(2, "A speichert Grunddaten per Autosave", async () => {
    const r = await patch(`/api/entwuerfe/${refX}`, {
      origin: BASIS, cookie: A.cookie,
      body: { version: versionX, daten: { trans: "sale", typ: "wohnung", ortId: ORT_ID, genauigkeit: "ungefaehr", zimmer: 3.5, flaeche: 85, preis: 640000 } }
    });
    assertGleich(r.status, 200, "status");
    versionX = r.json.version;
    return `status=${r.status}, version=${versionX}`;
  });

  /* ---------- (3) B (Team) bearbeitet dasselbe Inserat ---------- */
  await schritt(3, "B (agent im Team) bearbeitet dasselbe Inserat — 200", async () => {
    const r = await patch(`/api/entwuerfe/${refX}`, { origin: BASIS, cookie: B.cookie, body: { version: versionX, daten: { titel: TITEL, beschreibung: BESCHREIBUNG } } });
    assertGleich(r.status, 200, "status");
    versionX = r.json.version;
    return `status=${r.status}, version=${versionX}`;
  });

  /* ---------- (4) C (Beta) sieht/kann nichts von Alpha ---------- */
  await schritt(4, "C (owner Beta) ist bei Alpha ein Fremder — 404 überall", async () => {
    const rGet = await get(`/api/entwuerfe/${refX}`, { cookie: C.cookie });
    assertGleich(rGet.status, 404, "GET Entwurf");
    const rPatch = await patch(`/api/entwuerfe/${refX}`, { origin: BASIS, cookie: C.cookie, body: { version: versionX, daten: {} } });
    assertGleich(rPatch.status, 404, "PATCH Entwurf");
    const rListe = await get("/api/org/alpha/inserate", { cookie: C.cookie });
    assertGleich(rListe.status, 404, "GET org/alpha/inserate");
    const rNeu = await post("/api/org/alpha/inserate", { origin: BASIS, cookie: C.cookie, body: {} });
    assertGleich(rNeu.status, 404, "POST org/alpha/inserate");
    return "GET/PATCH Entwurf, GET/POST org/alpha/inserate — alle 404";
  });

  /* ---------- (5) Zuweisung ---------- */
  await schritt(5, "A weist B zu (200); C kann nicht zuweisen (404); B ohne ASSIGN weist sich selbst zu (403)", async () => {
    const rA = await post(`/api/org/alpha/inserate/${refX}/zuweisen`, { origin: BASIS, cookie: A.cookie, body: { userId: B.id } });
    assertGleich(rA.status, 200, "A weist B zu");
    /* Der Zuweisungs-Trigger (listing_version, 0004) erhöht `version` bei
       jeder Änderung der Zeile — die nächste Autosave-Version muss davon
       ausgehen, nicht von der vor der Zuweisung gelesenen. */
    versionX = rA.json.version;
    const [row] = await sql`SELECT assigned_user_id FROM listing WHERE public_ref = ${refX}`;
    assertGleich(String(row.assigned_user_id), String(B.id), "assigned_user_id in der DB");

    const rC = await post(`/api/org/alpha/inserate/${refX}/zuweisen`, { origin: BASIS, cookie: C.cookie, body: { userId: C.id } });
    assertGleich(rC.status, 404, "C versucht zuzuweisen");

    const rB = await post(`/api/org/alpha/inserate/${refX}/zuweisen`, { origin: BASIS, cookie: B.cookie, body: { userId: B.id } });
    assertGleich(rB.status, 403, "B (agent, ohne ASSIGN) weist sich selbst zu");
    return "A→200 (DB bestätigt), C→404, B→403";
  });

  /* ---------- (6) Body-Angriffe ---------- */
  await schritt(6, "Body-Angriffe beim Speichern: unbekannte/verbotene Felder → 422, DB unverändert", async () => {
    const [vor] = await sql`SELECT publisher_kind, published_by_org_id, status FROM listing WHERE public_ref = ${refX}`;
    const felder = [
      { publisher_kind: "fourwalls" },
      { represented_by_org_id: betaId },
      { published_by_org_id: betaId },
      { status: "published" }
    ];
    for (const zusatz of felder) {
      const r = await patch(`/api/entwuerfe/${refX}`, { origin: BASIS, cookie: B.cookie, body: { version: versionX, daten: { titel: TITEL, ...zusatz } } });
      assertGleich(r.status, 422, `PATCH mit ${Object.keys(zusatz)[0]}`);
    }
    const [nach] = await sql`SELECT publisher_kind, published_by_org_id, status FROM listing WHERE public_ref = ${refX}`;
    assertGleich(nach.publisher_kind, vor.publisher_kind, "publisher_kind unverändert");
    assertGleich(String(nach.published_by_org_id), String(vor.published_by_org_id), "published_by_org_id unverändert");
    assertGleich(nach.status, vor.status, "status unverändert");
    return "alle 4 Angriffe → 422, DB unverändert";
  });

  /* ---------- (7) Einreichen ---------- */
  await schritt(7, "B lädt das Bild hoch, vervollständigt und reicht ein — submitted; D ohne Mitgliedschaft → 404", async () => {
    const hoch = await uploadDatei(B.cookie, BILD_PFAD, "foto.jpg", "image/jpeg");
    assertGleich(hoch.status, 201, "bild hochladen (B)");
    const pBild = await patch(`/api/entwuerfe/${refX}`, { origin: BASIS, cookie: B.cookie, body: { version: versionX, daten: { bilder: [hoch.json.id] } } });
    assertGleich(pBild.status, 200, "PATCH bilder");
    versionX = pBild.json.version;

    const rD = await post(`/api/entwuerfe/${refX}/aktion`, { origin: BASIS, cookie: D.cookie, body: { absicht: "einreichen" } });
    assertGleich(rD.status, 404, "D (keine Mitgliedschaft) reicht ein");

    const rB = await post(`/api/entwuerfe/${refX}/aktion`, { origin: BASIS, cookie: B.cookie, body: { absicht: "einreichen" } });
    assertGleich(rB.status, 200, "B reicht ein");
    const [row] = await sql`SELECT status FROM listing WHERE public_ref = ${refX}`;
    assertGleich(row.status, "submitted", "status in der DB");
    return `D=404, B: status=${rB.status}, dbStatus=${row.status}`;
  });

  /* ---------- (8) Moderation, Suche, Objektseite ---------- */
  await schritt(8, "Moderator veröffentlicht — Suche listingSource=agentur, Objektseite zeigt die Organisation, nicht Fourwalls Exclusive", async () => {
    let r = await anmelden(MOD_EMAIL_STANDARD, MOD_PASSWORT_STANDARD, "mod-auth");
    let modEmail = MOD_EMAIL_STANDARD;
    if (r.status !== 200 || !r.cookie) {
      modEmail = `oimod+${TS}@fourwalls.example`;
      const su = await registrieren(modEmail, MOD_PASSWORT_STANDARD, "Moderator Org-Test", "mod-signup");
      assertGleich(su.status, 200, "sign-up Moderator (Fallback)");
      await bestaetigeMail(modEmail);
      r = await anmelden(modEmail, MOD_PASSWORT_STANDARD, "mod-auth");
      assertGleich(r.status, 200, "sign-in Moderator (Fallback)");
      execFileSync(process.execPath, [join(APP_ROOT, "scripts", "rolle.mjs"), modEmail, "moderator"], { stdio: "inherit", env: process.env });
    }
    const [modRow] = await sql`SELECT email_verified FROM app_user WHERE email = ${modEmail}`;
    if (modRow && !modRow.email_verified) {
      await post("/api/auth/send-verification-email", { origin: BASIS, body: { email: modEmail, callbackURL: "/" } });
      await bestaetigeMail(modEmail);
      r = await anmelden(modEmail, MOD_PASSWORT_STANDARD, "mod-auth");
    }
    MOD = { email: modEmail, cookie: r.cookie, id: r.json.user.id };

    const rVer = await post(`/api/moderation/${refX}`, { origin: BASIS, cookie: MOD.cookie, body: { absicht: "freigeben-und-veroeffentlichen" } });
    assertGleich(rVer.status, 200, "freigeben-und-veroeffentlichen");
    const [row] = await sql`SELECT status, slug FROM listing WHERE public_ref = ${refX}`;
    assertGleich(row.status, "published", "status in der DB");

    const rSuche = await get(`/api/search?ref=${refX}`, {});
    assertGleich(rSuche.status, 200, "GET /api/search?ref=");
    const treffer = (rSuche.json?.treffer ?? [])[0];
    assertTrue(!!treffer, "kein Suchtreffer für refX");
    assertGleich(treffer.listingSource, "agentur", "listingSource");
    /* «Fourwalls Exclusive» ist auch ein globaler Navigationslink auf jeder
       Seite — der Text allein sagt nichts über DIESES Inserat. Der
       verlässliche Beleg ist listingTier, das nur für Fourwalls-Mandate
       "exclusive" wird (server/search.ts:alsTreffer). */
    assertTrue(treffer.listingTier !== "exclusive", `listingTier fälschlich "exclusive" (${treffer.listingTier})`);

    const art = treffer.transactionType === "rent" ? "mieten" : "kaufen";
    const pfad = `/de/${PFAD.de.immobilien}/${PFAD.de[art]}/${treffer.slug}`;
    const seite = await holenHtml(pfad);
    assertGleich(seite.status, 200, "Objektseite status");
    assertTrue(seite.text.includes("Alpha Immobilien AG (Demo)"), "Organisationsname nicht im HTML gefunden");
    return `dbStatus=${row.status}, listingSource=${treffer.listingSource}, Objektseite=${seite.status}`;
  });

  /* ---------- (9) Anfrage routet zur zugewiesenen Person + Organisation ---------- */
  let refInquiry;
  await schritt(9, "Anonyme Anfrage: recipient_org_id=Alpha, recipient_user_id=B (zugewiesen)", async () => {
    const r = await post("/api/inquiries", {
      origin: BASIS, xffTag: "org-inquiry",
      body: { publicRef: refX, art: "viewing_request", name: "Prüfperson Org-Test", email: `oiq+${TS}@example.com`, nachricht: "Automatisierte Org-Inserate-Prüfung — bitte ignorieren.", firma: "" }
    });
    assertGleich(r.status, 201, "status");
    refInquiry = r.json.publicRef;
    const [row] = await sql`SELECT recipient_org_id, recipient_user_id FROM inquiry WHERE public_ref = ${refInquiry}`;
    assertGleich(String(row.recipient_org_id), String(alphaId), "recipient_org_id");
    assertGleich(String(row.recipient_user_id), String(B.id), "recipient_user_id");
    return `recipient_org_id=${row.recipient_org_id}, recipient_user_id=${row.recipient_user_id}`;
  });

  /* ---------- (10) Posteingang der Organisation ---------- */
  await schritt(10, "A sieht die Anfrage im Posteingang von Alpha; C nicht (404)", async () => {
    const rA = await get("/api/org/alpha/anfragen", { cookie: A.cookie });
    assertGleich(rA.status, 200, "A GET anfragen");
    const drin = (rA.json?.zeilen ?? []).some(z => z.publicRef === refInquiry);
    assertTrue(drin, `${refInquiry} nicht im Posteingang gefunden`);
    const rC = await get("/api/org/alpha/anfragen", { cookie: C.cookie });
    assertGleich(rC.status, 404, "C GET anfragen");
    return `A findet ${refInquiry}, C=404`;
  });

  /* ---------- (11) Austritt aus dem Team ---------- */
  await schritt(11, "B verliert die Mitgliedschaft — Zuweisung wird entfernt, B verliert den Zugriff, Inserat bleibt öffentlich", async () => {
    await sql`UPDATE org_membership SET is_active = false WHERE organization_id = ${alphaId} AND user_id = ${B.id}`;
    await sql`UPDATE listing SET assigned_user_id = NULL WHERE assigned_user_id = ${B.id} AND published_by_org_id = ${alphaId}`;
    const rB = await get(`/api/entwuerfe/${refX}`, { cookie: B.cookie });
    assertGleich(rB.status, 404, "B GET Entwurf nach Austritt");
    const [row] = await sql`SELECT status, assigned_user_id FROM listing WHERE public_ref = ${refX}`;
    assertGleich(row.status, "published", "Inserat bleibt published");
    assertGleich(row.assigned_user_id, null, "assigned_user_id entfernt");
    const rSeite = await get(`/api/search?ref=${refX}`, {});
    const slug = rSeite.json?.treffer?.[0]?.slug;
    const seite = await holenHtml(`/de/${PFAD.de.immobilien}/${PFAD.de.kaufen}/${slug}`);
    assertGleich(seite.status, 200, "Objektseite weiterhin erreichbar");
    return "B=404 nach Austritt, Inserat bleibt published und erreichbar";
  });

  /* ---------- (12) CSV-Import ---------- */
  await schritt(12, "CSV-Import: gültig/Duplikat/ungültig — wiederholbar, alle bleiben Entwürfe", async () => {
    externalBestehend = `EXT-BESTEHEND-${TS}`;
    await sql`UPDATE listing SET external_ref = ${externalBestehend} WHERE public_ref = ${refX}`;
    const extNeu = `EXT-NEU-${TS}`;
    const extSchlecht = `EXT-SCHLECHT-${TS}`;
    const kopf = "external_ref,trans,typ,ortId,zimmer,flaeche,preis,titel,beschreibung,sprache";
    const zeile1 = `${extNeu},sale,wohnung,${ORT_ID},2.5,60,410000,"Neue Alpha-Wohnung ${TS}","Eine kompakte Wohnung aus dem CSV-Import, automatisierte Prüfung.",de`;
    const zeile2 = `${externalBestehend},sale,wohnung,${ORT_ID},2.5,60,410000,"Duplikat ${TS}","Diese Zeile dupliziert einen bestehenden external_ref, automatisierte Prüfung.",de`;
    const zeile3 = `${extSchlecht},sale,schloss,${ORT_ID},2.5,60,410000,"Ungültiger Typ ${TS}","Diese Zeile hat einen unbekannten Objekttyp, automatisierte Prüfung.",de`;
    const csv = [kopf, zeile1, zeile2, zeile3].join("\r\n");

    const r1 = await post("/api/org/alpha/import", { origin: BASIS, cookie: A.cookie, roheBody: csv, contentType: "text/csv" });
    assertGleich(r1.status, 200, "erster Import status");
    const e1 = r1.json.ergebnisse;
    assertGleich(e1.length, 3, "Anzahl Zeilenergebnisse");
    assertGleich(e1[0].status, "angelegt", "Zeile 1 (gültig)");
    assertGleich(e1[1].status, "uebersprungen", "Zeile 2 (Duplikat)");
    assertGleich(e1[2].status, "abgelehnt", "Zeile 3 (ungültiger Typ)");

    const [neu] = await sql`SELECT status, published_by_org_id FROM listing WHERE external_ref = ${extNeu} AND published_by_org_id = ${alphaId}`;
    assertTrue(!!neu, "importierte Zeile nicht in der DB gefunden");
    assertGleich(neu.status, "draft", "importierte Zeile bleibt draft");

    const r2 = await post("/api/org/alpha/import", { origin: BASIS, cookie: A.cookie, roheBody: csv, contentType: "text/csv" });
    assertGleich(r2.status, 200, "zweiter Import status");
    const angelegt2 = r2.json.ergebnisse.filter(z => z.status === "angelegt").length;
    assertGleich(angelegt2, 0, "zweiter Import legt nichts neu an");

    return `1. Import: angelegt/uebersprungen/abgelehnt, 2. Import: 0 angelegt (${JSON.stringify(r2.json.ergebnisse.map(z => z.status))})`;
  });

  /* ---------- (13) Übersicht: Filter und Paginierung ---------- */
  await schritt(13, "Übersicht: Filter nach Status/Suchtext trifft, Seite 2 ist leer (hatMehr=false)", async () => {
    const extNeu = `EXT-NEU-${TS}`;
    const rSuche = await get(`/api/org/alpha/inserate?status=draft&q=${encodeURIComponent(extNeu)}`, { cookie: A.cookie });
    assertGleich(rSuche.status, 200, "GET mit Filter");
    const treffer = (rSuche.json?.zeilen ?? []).find(z => z.externalRef === extNeu);
    assertTrue(!!treffer, `${extNeu} nicht in der gefilterten Übersicht gefunden`);

    const rSeite2 = await get("/api/org/alpha/inserate?seite=2", { cookie: A.cookie });
    assertGleich(rSeite2.status, 200, "GET Seite 2");
    assertGleich((rSeite2.json?.zeilen ?? []).length, 0, "Seite 2 ist leer");
    assertGleich(rSeite2.json?.hatMehr, false, "hatMehr auf Seite 2");
    return `Filtertreffer gefunden, Seite 2 leer (total=${rSeite2.json?.total})`;
  });
} finally {
  await aufraeumen();
  await sql.end({ timeout: 5 });
}

const fehlerhaft = ergebnisse.filter(e => e.status === "FEHLER");
console.log("");
console.log(`${ergebnisse.length} Schritte, ${fehlerhaft.length} FEHLER, ${ergebnisse.length - fehlerhaft.length} OK — Dauer ${((Date.now() - START) / 1000).toFixed(1)}s`);
const berichtPfad = join(APP_ROOT, "var", "org-inserate-bericht.json");
try {
  const { mkdirSync, writeFileSync } = await import("node:fs");
  mkdirSync(dirname(berichtPfad), { recursive: true });
  writeFileSync(berichtPfad, JSON.stringify({ ts: TS, basis: BASIS, ergebnisse }, null, 2));
  console.log(`Bericht geschrieben: ${berichtPfad}`);
} catch { /* Bericht ist optional */ }
process.exit(fehlerhaft.length ? 1 : 0);
