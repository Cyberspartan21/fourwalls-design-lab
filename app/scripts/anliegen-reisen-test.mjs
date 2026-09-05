#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Anliegen: sieben Ende-zu-Ende-Reisen (P5.8 §60–§67)

   A  Anonym, sell Zürich → persistiert, zwei Mails (intern + Bestätigung),
      kein Konto.
   B  Angemeldet, sell → GET /api/konto/anliegen zeigt es, eine andere Person
      nicht.
   C  valuation → keine CHF-Zahl in der Bestätigungsmail (§40/§41).
   D  property_management (12 Einheiten) → service korrekt, interne Mail an
      den Posteingang.
   E  owner_consultation, nur Kontakt → 201.
   F  staff: Liste, Detail, Statuswechsel, Selbstzuweisung, Prüfspur — die
      Kundin sieht danach nur den neuen Status, keine interne Information.
   G  Mailausfall (§66): die Zeile bleibt, der nächste Outbox-Tick des
      laufenden Servers holt sie nach, kein Duplikat.
   H  Spam (§67): Honigtopf, Ratenlimit, zu grosser Body, fremde Origin —
      und die echten Leads dieses Laufs überleben all das.

   Aufruf:
     set -a; . ./.env.local; set +a
     FW_TEST_MOD_EMAIL=... FW_TEST_MOD_PASSWORT=... node scripts/anliegen-reisen-test.mjs [Basis-URL]

   Mailquelle (siehe scripts/lib/mailquelle.mjs): FW_TEST_MAIL_QUELLE=dev|mailpit|imap.

   Ausgabe: nummerierte Tabelle, Exit 1 bei irgendeinem FEHLER, sonst 0.
   Räumt seine Test-Anliegen am Ende immer auf (auch nach einem Fehler
   mittendrin).
   ============================================================ */
import postgres from "postgres";
import { randomBytes } from "node:crypto";
import { mailquelle, testadresse } from "./lib/mailquelle.mjs";

const BASIS = (process.argv[2] || "http://localhost:3007").replace(/\/$/, "");
const TIMEOUT_MS = 60_000;
const TS = Date.now();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a)"); process.exit(2); }
const sql = postgres(DATABASE_URL, { max: 4, onnotice: () => {} });

const PASSWORT = "Reis-" + randomBytes(12).toString("base64url");
const EMAIL_B1 = testadresse("arb1", TS);
const EMAIL_B2 = testadresse("arb2", TS);
const EMAIL_STAFF = testadresse("arstaff", TS);

const ergebnisse = [];
function assertTrue(bedingung, meldung) { if (!bedingung) throw new Error(meldung); }
function assertGleich(ist, soll, feld) {
  if (ist !== soll) throw new Error(`${feld}: erwartet ${JSON.stringify(soll)}, erhalten ${JSON.stringify(ist)}`);
}
async function schritt(bez, titel, fn) {
  try {
    const detail = (await fn()) || "ok";
    ergebnisse.push({ bez, titel, status: "OK", detail });
    console.log(`OK      ${String(bez).padStart(5)}  ${titel}`);
  } catch (e) {
    const detail = e && e.message ? e.message : String(e);
    ergebnisse.push({ bez, titel, status: "FEHLER", detail });
    console.log(`FEHLER  ${String(bez).padStart(5)}  ${titel} — ${detail}`);
  }
}

/* ---------- x-forwarded-for je Zweck ---------- */
const RUNSEED = Math.floor(Math.random() * 200) + 10;
const xffMap = new Map();
function xff(tag) {
  if (!xffMap.has(tag)) xffMap.set(tag, `10.${RUNSEED}.${xffMap.size + 1}.97`);
  return xffMap.get(tag);
}

/* ---------- HTTP ---------- */
async function api(method, pfad, { cookie, origin, body, xffTag, rohBody } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const h = {};
    if (cookie) h["cookie"] = cookie;
    if (origin !== undefined) h["origin"] = origin;
    if (xffTag) h["x-forwarded-for"] = xff(xffTag);
    let payload;
    if (rohBody !== undefined) { h["content-type"] = "application/json"; payload = rohBody; }
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

/* ---------- Mail ---------- */
const MAILQUELLE = mailquelle();
async function bestaetigeMail(email, seitMs = null) {
  const mail = await MAILQUELLE.warte(email, seitMs);
  if (!mail) throw new Error(`Keine Mail für ${email} über Mailquelle "${MAILQUELLE.name}" gefunden`);
  const treffer = mail.text.match(/https?:\/\/\S+/);
  if (!treffer) throw new Error(`Keine URL in der Mail an ${email} gefunden`);
  const res = await fetch(treffer[0], { redirect: "manual" });
  return res.status;
}

/* ---------- Registrieren / Anmelden ---------- */
async function registrieren(email, passwort, name, xffTag) {
  return post("/api/auth/sign-up/email", { origin: BASIS, xffTag, body: { email, password: passwort, name } });
}
async function anmelden(email, passwort, xffTag) {
  const r = await post("/api/auth/sign-in/email", { origin: BASIS, xffTag, body: { email, password: passwort } });
  return { ...r, cookie: cookieAus(r.setCookies) };
}
async function personAnlegen(email, xffTag, name) {
  const seit = Date.now();
  const su = await registrieren(email, PASSWORT, name, xffTag);
  assertGleich(su.status, 200, `sign-up (${email})`);
  const best = await bestaetigeMail(email, seit);
  assertGleich(best, 302, `bestätigung (${email})`);
  const si = await anmelden(email, PASSWORT, xffTag);
  assertGleich(si.status, 200, `sign-in (${email})`);
  assertTrue(!!si.cookie, `kein Sitzungscookie für ${email}`);
  return { email, cookie: si.cookie, id: si.json.user.id };
}

function formular(teile = {}) {
  return {
    dienst: "sell",
    kontakt: { name: "Prüfperson Reise", email: testadresse("arx", TS + Math.floor(Math.random() * 1e6)) },
    objekt: { ortId: "ort-zuerich", typ: "wohnung" },
    sprache: "de",
    herkunft: { seite: "/de/verkaufen" },
    firma: "",
    ...teile
  };
}

/* ---------- Aufräumen ---------- */
const leadRefs = [];
async function aufraeumen() {
  try {
    const echte = leadRefs.filter(Boolean);
    if (!echte.length) return;
    const z = await sql`DELETE FROM service_lead WHERE public_ref = ANY(${echte}) RETURNING id`;
    console.log(`Aufgeräumt: ${z.length} Test-Anliegen gelöscht (${echte.join(", ")}).`);
  } catch (e) {
    console.error("Aufräumen fehlgeschlagen:", e.message || e);
  }
}

const schlaf = ms => new Promise(r => setTimeout(r, ms));

const START = Date.now();
console.log(`Basis: ${BASIS}  —  Anliegen-Reisen starten (TS=${TS})`);

let refA, refB, refC, refD, refE, refF, refG;
let B1, B2, STAFF;

try {
  /* ---------- A: anonym, sell Zürich ---------- */
  await schritt("A.1", "Anonym sell Zürich + Wohnung → 201, persistiert, kein Konto", async () => {
    const kontakt = { name: "Reise A", email: testadresse("ara", TS) };
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "a", body: formular({ kontakt }) });
    assertGleich(r.status, 201, "status");
    refA = r.json.publicRef; leadRefs.push(refA);
    const [row] = await sql`SELECT user_id, service, place_key FROM service_lead WHERE public_ref = ${refA}`;
    assertTrue(row.user_id == null, "user_id ist nicht NULL");
    assertGleich(row.service, "sell", "service");
    assertGleich(row.place_key, "ort-zuerich", "place_key");
    return `publicRef=${refA}, user_id=NULL`;
  });
  await schritt("A.2", "Zwei Mails in der Mailquelle: interne Meldung + Bestätigung", async () => {
    const [row] = await sql`SELECT contact_email FROM service_lead WHERE public_ref = ${refA}`;
    const best = await MAILQUELLE.warte(String(row.contact_email), START);
    assertTrue(!!best, `keine Bestätigung an ${row.contact_email}`);
    assertTrue(best.text.includes(refA), "Referenz fehlt in der Bestätigung");
    const [outboxZeilen] = [await sql`SELECT kind FROM mail_outbox WHERE ref_type = 'service_lead' AND ref_id = ${refA}`];
    assertGleich(outboxZeilen.length, 2, "Anzahl Outbox-Zeilen");
    assertTrue(outboxZeilen.some(z => z.kind === "service_lead_intern"), "keine interne Meldung in der Outbox");
    assertTrue(outboxZeilen.some(z => z.kind === "service_lead_bestaetigung"), "keine Bestätigung in der Outbox");
    return "2 Outbox-Zeilen (intern + Bestätigung), Bestätigung enthält die Referenz";
  });

  /* ---------- B: angemeldet, sell ---------- */
  await schritt("B.1", "Person B1 registrieren, bestätigen, anmelden", async () => {
    B1 = await personAnlegen(EMAIL_B1, "b1-auth", "Reise B1");
    return `id=${B1.id}`;
  });
  await schritt("B.2", "Person B2 registrieren, bestätigen, anmelden", async () => {
    B2 = await personAnlegen(EMAIL_B2, "b2-auth", "Reise B2");
    return `id=${B2.id}`;
  });
  await schritt("B.3", "B1 sendet ein Anliegen angemeldet → in der eigenen Liste", async () => {
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "b1-anliegen", cookie: B1.cookie, body: formular({ kontakt: { name: "Reise B1", email: EMAIL_B1 } }) });
    assertGleich(r.status, 201, "status");
    refB = r.json.publicRef; leadRefs.push(refB);
    const liste = await get("/api/konto/anliegen", { cookie: B1.cookie });
    assertGleich(liste.status, 200, "status Liste");
    assertTrue(liste.json.anliegen.some(x => x.publicRef === refB), "nicht in B1's Liste gefunden");
    return `publicRef=${refB}, in B1's Liste gefunden`;
  });
  await schritt("B.4", "B2 sieht B1's Anliegen nicht", async () => {
    const r = await get("/api/konto/anliegen", { cookie: B2.cookie });
    assertGleich(r.status, 200, "status");
    assertTrue(!r.json.anliegen.some(x => x.publicRef === refB), "B2 sieht B1's Anliegen");
    return "B2 sieht refB nicht";
  });

  /* ---------- C: valuation ohne CHF-Zahl ---------- */
  await schritt("C", "valuation → service korrekt, keine CHF-Zahl in der Bestätigung", async () => {
    const kontakt = { name: "Reise C", email: testadresse("arc", TS) };
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "c", body: formular({ dienst: "valuation", kontakt }) });
    assertGleich(r.status, 201, "status");
    refC = r.json.publicRef; leadRefs.push(refC);
    const [row] = await sql`SELECT service FROM service_lead WHERE public_ref = ${refC}`;
    assertGleich(row.service, "valuation", "service");
    const best = await MAILQUELLE.warte(kontakt.email, START);
    assertTrue(!!best, `keine Bestätigung an ${kontakt.email}`);
    assertTrue(!/CHF\s*\d/.test(best.text), "eine CHF-Zahl steht in der Bestätigung");
    return `service=valuation, keine CHF-Zahl in der Bestätigung`;
  });

  /* ---------- D: property_management, 12 Einheiten ---------- */
  await schritt("D", "property_management (12 Einheiten) → service korrekt, interne Mail an den Posteingang", async () => {
    const kontakt = { name: "Reise D", email: testadresse("ard", TS) };
    const r = await post("/api/anliegen", {
      origin: BASIS, xffTag: "d",
      body: formular({ dienst: "property_management", kontakt, objekt: { ortId: "ort-zuerich", einheiten: 12 } })
    });
    assertGleich(r.status, 201, "status");
    refD = r.json.publicRef; leadRefs.push(refD);
    const [row] = await sql`SELECT service, units FROM service_lead WHERE public_ref = ${refD}`;
    assertGleich(row.service, "property_management", "service");
    assertGleich(Number(row.units), 12, "units");
    const [internMail] = await sql`SELECT recipient FROM mail_outbox WHERE ref_type = 'service_lead' AND ref_id = ${refD} AND kind = 'service_lead_intern'`;
    assertTrue(!!internMail, "keine interne Mail in der Outbox");
    return `service=property_management, units=12, interne Mail an ${internMail.recipient}`;
  });

  /* ---------- E: owner_consultation, nur Kontakt ---------- */
  await schritt("E", "owner_consultation, nur Kontakt → 201", async () => {
    const kontakt = { name: "Reise E", email: testadresse("are", TS) };
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "e", body: formular({ dienst: "owner_consultation", kontakt, objekt: undefined }) });
    assertGleich(r.status, 201, "status");
    refE = r.json.publicRef; leadRefs.push(refE);
    return `publicRef=${refE}`;
  });

  /* ---------- F: staff-Bearbeitung, Kundensicht danach ---------- */
  await schritt("F.1", "staff-Konto anlegen und hochstufen", async () => {
    STAFF = await personAnlegen(EMAIL_STAFF, "staff-auth", "Reise Staff");
    await sql`UPDATE app_user SET platform_role = 'staff' WHERE id = ${STAFF.id}`;
    return `id=${STAFF.id}`;
  });
  await schritt("F.2", "Ein frisches Anliegen von B1, damit die Kundensicht geprüft werden kann", async () => {
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "f-anlegen", cookie: B1.cookie, body: formular({ kontakt: { name: "Reise F", email: EMAIL_B1 } }) });
    assertGleich(r.status, 201, "status");
    refF = r.json.publicRef; leadRefs.push(refF);
    return `publicRef=${refF}`;
  });
  await schritt("F.3", "staff: Liste ?status=new enthält refF, Detail lesbar", async () => {
    const liste = await get("/api/intern/anliegen?status=new", { cookie: STAFF.cookie });
    assertGleich(liste.status, 200, "status Liste");
    assertTrue(liste.json.zeilen.every(z => z.status === "new"), "eine Zeile ist nicht 'new'");
    assertTrue(liste.json.zeilen.some(z => z.publicRef === refF), `${refF} nicht in der Liste`);
    const detail = await get(`/api/intern/anliegen/${refF}`, { cookie: STAFF.cookie });
    assertGleich(detail.status, 200, "status Detail");
    return `Liste enthält ${refF}, Detail lesbar`;
  });
  await schritt("F.4", "staff: Status new → contacted, zuweisen an sich selbst", async () => {
    const p1 = await patch(`/api/intern/anliegen/${refF}`, { origin: BASIS, cookie: STAFF.cookie, body: { status: "contacted" } });
    assertGleich(p1.status, 200, "status PATCH status");
    const p2 = await patch(`/api/intern/anliegen/${refF}`, { origin: BASIS, cookie: STAFF.cookie, body: { assignedStaffId: STAFF.id } });
    assertGleich(p2.status, 200, "status PATCH assignedStaffId");
    return "status=contacted, zugewiesen an staff";
  });
  await schritt("F.5", "Audit: service_lead.created/status_changed/assigned stehen im Protokoll", async () => {
    const [row] = await sql`SELECT id FROM service_lead WHERE public_ref = ${refF}`;
    const zeilen = await sql`SELECT action FROM audit_log WHERE entity_type = 'service_lead' AND entity_id = ${row.id} ORDER BY created_at`;
    const actions = new Set(zeilen.map(z => z.action));
    assertTrue(actions.has("service_lead.created"), "kein service_lead.created");
    assertTrue(actions.has("service_lead.status_changed"), "kein service_lead.status_changed");
    assertTrue(actions.has("service_lead.assigned"), "kein service_lead.assigned");
    return `Aktionen: ${[...actions].join(", ")}`;
  });
  await schritt("F.6", "B1 sieht danach nur den neuen Status, keine interne Information", async () => {
    const r = await get("/api/konto/anliegen", { cookie: B1.cookie });
    assertGleich(r.status, 200, "status");
    const eintrag = r.json.anliegen.find(x => x.publicRef === refF);
    assertTrue(!!eintrag, `${refF} nicht in B1's Liste`);
    assertGleich(eintrag.status, "contacted", "status in der Kundensicht");
    const roh = JSON.stringify(eintrag);
    assertTrue(!roh.includes("assignedStaff") && !roh.includes("verlauf") && !roh.includes("ip_hash"), "interne Information in der Kundensicht gefunden");
    return `status=contacted, keine interne Information (Felder: ${Object.keys(eintrag).join(", ")})`;
  });

  /* ---------- G: Mailausfall (§66) ---------- */
  await schritt("G.1", "Ein Anliegen anlegen, dessen zwei Outbox-Zeilen künstlich fehlschlagen lassen", async () => {
    const kontakt = { name: "Reise G", email: testadresse("arg", TS) };
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "g", body: formular({ kontakt }) });
    assertGleich(r.status, 201, "status");
    refG = r.json.publicRef; leadRefs.push(refG);
    const vorher = await sql`SELECT id, status FROM mail_outbox WHERE ref_type = 'service_lead' AND ref_id = ${refG}`;
    assertGleich(vorher.length, 2, "Anzahl Outbox-Zeilen vor dem Ausfall");
    await sql`UPDATE mail_outbox SET status = 'failed', attempts = 1, next_attempt_at = now() WHERE ref_type = 'service_lead' AND ref_id = ${refG}`;
    return `publicRef=${refG}, 2 Outbox-Zeilen künstlich auf 'failed' gesetzt`;
  });
  await schritt("G.2", "Der nächste Outbox-Tick des laufenden Servers holt beide Zeilen nach — kein Duplikat", async () => {
    let alleAngenommen = false;
    const frist = Date.now() + 60_000;
    while (Date.now() < frist) {
      const zeilen = await sql`SELECT status FROM mail_outbox WHERE ref_type = 'service_lead' AND ref_id = ${refG}`;
      if (zeilen.length === 2 && zeilen.every(z => z.status === "accepted")) { alleAngenommen = true; break; }
      await schlaf(2000);
    }
    assertTrue(alleAngenommen, "nicht beide Outbox-Zeilen wurden innert 60 s 'accepted'");
    const [row] = await sql`SELECT contact_email FROM service_lead WHERE public_ref = ${refG}`;
    const best = await MAILQUELLE.warte(String(row.contact_email), START);
    assertTrue(!!best, `keine Bestätigung an ${row.contact_email} in der Mailquelle gefunden`);
    const leadZeilen = await sql`SELECT id FROM service_lead WHERE public_ref = ${refG}`;
    assertGleich(leadZeilen.length, 1, "Anzahl service_lead-Zeilen (kein Duplikat)");
    return "beide Outbox-Zeilen 'accepted', in der Mailquelle sichtbar, kein Duplikat";
  });

  /* ---------- H: Spam (§67) ---------- */
  await schritt("H.1", "Honigtopf → 201, erfundene Referenz, keine Zeile", async () => {
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "h-honig", body: formular({ firma: "Bot GmbH" }) });
    assertGleich(r.status, 201, "status");
    assertGleich(r.json?.publicRef, "FWS-0000-000000", "publicRef");
    const [row] = await sql`SELECT id FROM service_lead WHERE public_ref = 'FWS-0000-000000'`;
    assertTrue(!row, "eine Zeile mit der erfundenen Referenz existiert");
    return "status=201, keine Zeile";
  });
  await schritt("H.2", "6 schnelle Anliegen derselben IP → 429 ab dem 6.", async () => {
    let letzte;
    for (let i = 0; i < 6; i++) {
      letzte = await post("/api/anliegen", { origin: BASIS, xffTag: "h-ip", body: formular({ kontakt: { name: "Spam IP", email: testadresse("h2-" + i, TS) } }) });
      if (letzte.status === 201) leadRefs.push(letzte.json?.publicRef);
    }
    assertGleich(letzte.status, 429, "status (6. Anfrage)");
    return "6. Anfrage → 429";
  });
  await schritt("H.3", "40 KB Body → 413/422", async () => {
    const gross = formular({ objekt: { ortId: "ort-zuerich", typ: "wohnung", nachricht: "x".repeat(39_000) } });
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "h-gross", rohBody: JSON.stringify(gross) });
    assertTrue(r.status === 413 || r.status === 422, `status erwartet 413 oder 422, erhalten ${r.status}`);
    return `status=${r.status}`;
  });
  await schritt("H.4", "Fremde Origin → 403", async () => {
    const r = await post("/api/anliegen", { origin: "https://boese-seite.example", xffTag: "h-origin", body: formular() });
    assertGleich(r.status, 403, "status");
    return "status=403";
  });
  await schritt("H.5", "Die echten Leads dieses Laufs überleben — kein Kollateralschaden", async () => {
    const echte = [refA, refB, refC, refD, refE, refF, refG].filter(Boolean);
    const zeilen = await sql`SELECT public_ref FROM service_lead WHERE public_ref = ANY(${echte})`;
    assertGleich(zeilen.length, echte.length, "Anzahl überlebender Leads");
    return `${zeilen.length}/${echte.length} Leads unverändert vorhanden`;
  });
} finally {
  await aufraeumen();
  await sql.end({ timeout: 5 });
}

/* ============================================================
   ABSCHLUSS
   ============================================================ */
const dauerMs = Date.now() - START;
function tabelle() {
  const w1 = 5;
  const w2 = Math.max(20, ...ergebnisse.map(e => e.titel.length));
  const w3 = 6;
  const zeile = (a, b, c, d) => `${String(a).padStart(w1)}  ${String(b).padEnd(w2)}  ${String(c).padEnd(w3)}  ${d}`;
  console.log("\n" + zeile("Nr", "Schritt", "Status", "Detail"));
  console.log("-".repeat(w1 + w2 + w3 + 10));
  for (const e of ergebnisse) console.log(zeile(e.bez, e.titel, e.status, e.detail));
}
tabelle();

const fehlerAnzahl = ergebnisse.filter(e => e.status === "FEHLER").length;
console.log(`\n${ergebnisse.length} Schritte, ${fehlerAnzahl} FEHLER, ${ergebnisse.length - fehlerAnzahl} OK — Dauer ${(dauerMs / 1000).toFixed(1)}s`);
if (fehlerAnzahl > 0) {
  console.log("\nFEHLER im Detail:");
  for (const e of ergebnisse.filter(e => e.status === "FEHLER")) console.log(`  Schritt ${e.bez} (${e.titel}): ${e.detail}`);
}

process.exit(fehlerAnzahl > 0 ? 1 : 0);
