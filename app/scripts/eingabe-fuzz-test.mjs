#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Eingabe-Fuzz über wichtige Mutationen (P5.10 §13)

   Greift die wichtigsten schreibenden Routen mit übergrossen Bodies,
   unerwarteten (mass-assignment-kritischen) Feldern, ungültigen Enums,
   verschachtelten Objekten statt Strings, Unicode-Grenzfällen, HTML/Skript,
   SQL-artigen Eingaben, ungültigem JSON, falschem Content-Type, doppelter
   Einreichung und fehlenden Pflichtfeldern an. Erwartungen leiten sich aus
   den jeweiligen Zod-Schemata ab (`.strict()` = unbekannte Felder → 422;
   ohne `.strict()` = unbekannte Felder werden stillschweigend entfernt).

   Aufruf:
     set -a; . ./.env.local; set +a
     FW_TEST_MOD_EMAIL=... FW_TEST_MOD_PASSWORT=... node scripts/eingabe-fuzz-test.mjs [Basis-URL]

   Schreibt eine Tabelle je Endpunkt × Angriff auf stdout und
   var/eingabe-fuzz-bericht.json. Jeder 5xx ist ein Fund und macht die
   betroffene Zeile zu FEHLER. Exit 1, sobald irgendeine Prüfung FEHLER
   meldet. Räumt eigene Testzeilen am Ende auf (Präfix "ef+").
   ============================================================ */
import postgres from "postgres";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mailquelle, testadresse } from "./lib/mailquelle.mjs";

const HIER = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HIER, "..");
const BASIS = (process.argv[2] || "http://localhost:3007").replace(/\/$/, "");
const TIMEOUT_MS = 60_000;
const TS = Date.now();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL fehlt (set -a; . ./.env.local; set +a)"); process.exit(2); }
const sql = postgres(DATABASE_URL, { max: 4, onnotice: () => {} });

const MOD_EMAIL = process.env.FW_TEST_MOD_EMAIL;
const MOD_PASSWORT = process.env.FW_TEST_MOD_PASSWORT;
if (!MOD_EMAIL || !MOD_PASSWORT) {
  console.error("FW_TEST_MOD_EMAIL und FW_TEST_MOD_PASSWORT fehlen — Zugangsdaten des Moderationskontos kommen aus der Umgebung, nie aus dem Skript.");
  process.exit(2);
}

const PASSWORT = "Fuzz-" + randomBytes(12).toString("base64url");

const ergebnisse = [];
function assertTrue(bedingung, meldung) { if (!bedingung) throw new Error(meldung); }
function assertGleich(ist, soll, feld) {
  if (ist !== soll) throw new Error(`${feld}: erwartet ${JSON.stringify(soll)}, erhalten ${JSON.stringify(ist)}`);
}
async function schritt(bez, titel, fn) {
  try {
    const detail = (await fn()) || "ok";
    ergebnisse.push({ bez, titel, status: "OK", detail });
    console.log(`OK      ${String(bez).padEnd(7)} ${titel}`);
  } catch (e) {
    const detail = e && e.message ? e.message : String(e);
    ergebnisse.push({ bez, titel, status: "FEHLER", detail });
    console.log(`FEHLER  ${String(bez).padEnd(7)} ${titel} — ${detail}`);
  }
}

/* ---------- x-forwarded-for je Zweck ---------- */
const RUNSEED = Math.floor(Math.random() * 200) + 10;
const xffMap = new Map();
function xff(tag) {
  if (!xffMap.has(tag)) xffMap.set(tag, `10.${RUNSEED}.${xffMap.size + 1}.53`);
  return xffMap.get(tag);
}

/* ---------- HTTP ---------- */
async function api(method, pfad, { cookie, origin, xffTag, body, raw, contentType, headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const h = { ...headers };
    if (cookie) h["cookie"] = cookie;
    if (origin !== undefined) h["origin"] = origin;
    if (xffTag) h["x-forwarded-for"] = xff(xffTag);
    let payload;
    if (raw !== undefined) { payload = raw; if (contentType !== null) h["content-type"] = contentType ?? "application/json"; }
    else if (body !== undefined) { h["content-type"] = contentType ?? "application/json"; payload = JSON.stringify(body); }
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

/* Nie 500 — der eine Prüfpunkt, der über jede Einzelbewertung hinaus für
   JEDE Anfrage in diesem Skript gilt. */
function assertNie500(r, kontext) {
  assertTrue(r.status < 500, `${kontext}: 5xx erhalten (${r.status}) — ${JSON.stringify(r.json ?? r.text?.slice(0, 200))}`);
}

/* ---------- Mail / Registrieren / Anmelden (wie in den Schwesterskripten) ---------- */
const MAILQUELLE = mailquelle();
function mailAdresseFuer(email) {
  let h = 0; for (const c of String(email)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `10.${(h >>> 16) & 255}.${(h >>> 8) & 255}.${(h & 253) + 1}`;
}
/* Umgebungsbefund (P5.10, alle drei Skripte betroffen): Auf demselben Rechner
   pollt neben diesem Dev-Server (:3007) noch ein zweiter, unabhängiger
   Next-Prozess (:3008, H7-Leistungsmessung, eigener Standalone-Build unter
   einem eigenen Scratch-Pfad) instrumentation.ts gegen DIESELBE
   DATABASE_URL/mail_outbox. `FOR UPDATE SKIP LOCKED` verhindert Doppelversand,
   aber welcher der beiden Prozesse eine Zeile zieht, ist Zufall — zieht sie
   der fremde Prozess, schreibt er die Mail in SEIN EIGENES var/mail, nicht in
   unseres, und unsere Wartezeit läuft ins Leere, obwohl mail_outbox.status
   bereits 'accepted' zeigt. Deshalb: kurze Wartezeit, bei Fehlschlag über
   /api/auth/send-verification-email neu anfordern (neue Outbox-Zeile, neuer
   Zufallszug) — bis zu drei Versuche, statt einmal lange zu warten. */
async function bestaetigeMail(email, seitMs = null) {
  const VERSUCHE = 3;
  let letzterFehler;
  for (let versuch = 1; versuch <= VERSUCHE; versuch++) {
    try {
      const mail = await MAILQUELLE.warte(email, seitMs, 20_000);
      if (!mail) throw new Error(`Keine Mail für ${email} über Mailquelle "${MAILQUELLE.name}" gefunden (Versuch ${versuch}/${VERSUCHE})`);
      const treffer = mail.text.match(/https?:\/\/\S+/);
      if (!treffer) throw new Error(`Keine URL in der Mail an ${email} gefunden`);
      const res = await fetch(treffer[0], { redirect: "manual", headers: { "x-forwarded-for": mailAdresseFuer(email) } });
      return res.status;
    } catch (e) {
      letzterFehler = e;
      if (versuch < VERSUCHE) {
        seitMs = Date.now();
        await fetch(BASIS + "/api/auth/send-verification-email", {
          method: "POST",
          headers: { "content-type": "application/json", origin: BASIS, "x-forwarded-for": mailAdresseFuer(email + versuch) },
          body: JSON.stringify({ email, callbackURL: "/" })
        }).catch(() => {});
      }
    }
  }
  throw letzterFehler;
}
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
async function moderatorAnmelden(tagPrefix) {
  let r = await anmelden(MOD_EMAIL, MOD_PASSWORT, `${tagPrefix}-auth`);
  let modEmail = MOD_EMAIL;
  if (r.status !== 200 || !r.cookie) {
    modEmail = `${tagPrefix}mod+${TS}@fourwalls.example`;
    const su = await registrieren(modEmail, MOD_PASSWORT, "Moderatorin (Fuzz)", `${tagPrefix}-signup`);
    assertGleich(su.status, 200, "sign-up Moderatorin (Rückfall)");
    await bestaetigeMail(modEmail);
    execFileSync(process.execPath, [join(APP_ROOT, "scripts", "rolle.mjs"), modEmail, "moderator"], { stdio: "inherit", env: process.env });
    r = await anmelden(modEmail, MOD_PASSWORT, `${tagPrefix}-auth`);
    assertGleich(r.status, 200, "sign-in Moderatorin (Rückfall)");
  }
  return { email: modEmail, cookie: r.cookie, id: r.json.user.id };
}

const BILD_PFAD = join(APP_ROOT, "public", "media", "zurich-altbau-1-960.jpg");
const { readFileSync } = await import("node:fs");
async function uploadDatei(cookie, pfad, dateiname, mime) {
  const fd = new FormData();
  fd.append("datei", new Blob([readFileSync(pfad)], { type: mime }), dateiname);
  const res = await fetch(BASIS + "/api/medien", { method: "POST", headers: { origin: BASIS, cookie }, body: fd, redirect: "manual" });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* kein JSON */ }
  return { status: res.status, json };
}

/* ---------- gemeinsame Angriffs-Payloads ---------- */
const UNICODE_GRENZFALL = "Test 🏠 مرحبا​Zero​Width Null" + "х".repeat(10_000);
const HTML_PAYLOAD = "<script>alert(1)</script><img src=x onerror=alert(1)>";
const SQL_PAYLOAD_1 = "' OR 1=1 --";
const SQL_PAYLOAD_2 = "; DROP TABLE listing; --";
const GROSSER_TEXT = "A".repeat(1_100_000); // > 1 MB

const eigeneEmails = [];
const eigeneAnliegenRefs = [];
const eigeneEntwurfRefs = [];
const eigeneOrgSlugs = [];

async function aufraeumen() {
  try {
    if (eigeneAnliegenRefs.length) {
      const z = await sql`DELETE FROM service_lead WHERE public_ref = ANY(${eigeneAnliegenRefs}) RETURNING id`;
      console.log(`Aufgeräumt: ${z.length} Test-Anliegen gelöscht.`);
    }
    if (eigeneOrgSlugs.length) {
      const orgRows = await sql`SELECT id FROM organization WHERE slug = ANY(${eigeneOrgSlugs})`;
      const orgIds = orgRows.map(r => r.id);
      if (orgIds.length) {
        await sql`DELETE FROM org_invitation WHERE organization_id = ANY(${orgIds})`;
        await sql`DELETE FROM org_membership WHERE organization_id = ANY(${orgIds})`;
        await sql`DELETE FROM organization WHERE id = ANY(${orgIds})`;
      }
      console.log(`Aufgeräumt: ${orgIds.length} Test-Organisation(en) gelöscht.`);
    }
    if (eigeneEmails.length) {
      /* Wer eine Rolle im audit_log spielt (actor_user_id) oder dessen
         Testinserate dort als Entität stehen (entity_id), darf erst danach
         entfernt werden — sonst verletzt DELETE die Fremdschlüssel
         audit_log_actor_user_id_fkey/entity_id (echter Befund aus einem
         früheren Lauf dieses Skripts). */
      const zeilen = await sql`SELECT id FROM app_user WHERE email = ANY(${eigeneEmails})`;
      const ids = zeilen.map(z => z.id);
      const entwurfIds = eigeneEntwurfRefs.length
        ? (await sql`SELECT id FROM listing WHERE public_ref = ANY(${eigeneEntwurfRefs})`).map(z => z.id)
        : [];
      if (ids.length || entwurfIds.length) {
        await sql`DELETE FROM audit_log WHERE actor_user_id = ANY(${ids}) OR entity_id = ANY(${entwurfIds})`;
      }
      if (ids.length) {
        await sql`DELETE FROM media_variant WHERE asset_id IN (SELECT id FROM media_asset WHERE uploaded_by = ANY(${ids}))`;
        await sql`DELETE FROM listing_image WHERE asset_id IN (SELECT id FROM media_asset WHERE uploaded_by = ANY(${ids}))`;
        await sql`DELETE FROM media_asset WHERE uploaded_by = ANY(${ids})`;
      }
      if (entwurfIds.length) await sql`DELETE FROM listing WHERE id = ANY(${entwurfIds})`;
      if (ids.length) {
        await sql`DELETE FROM auth_session WHERE user_id = ANY(${ids})`;
        await sql`DELETE FROM auth_account WHERE user_id = ANY(${ids})`;
      }
      const z2 = await sql`DELETE FROM app_user WHERE email = ANY(${eigeneEmails}) RETURNING id`;
      console.log(`Aufgeräumt: ${z2.length} Testkonten gelöscht (Präfix ef+).`);
    }
  } catch (e) {
    console.error("Aufräumen fehlgeschlagen:", e.message || e);
  }
}

const START = Date.now();
console.log(`Basis: ${BASIS}  —  Eingabe-Fuzz startet (TS=${TS})`);

let A, MOD;
const EMAIL_A = testadresse("ef-a", TS);
eigeneEmails.push(EMAIL_A);

try {
  A = await personAnlegen(EMAIL_A, "a-auth", "Person A (Fuzz)");
  MOD = await moderatorAnmelden("ef");

  /* ============================================================
     1. REGISTRIERUNG — was auth-haertung-test.mjs nicht schon abdeckt
     ============================================================ */
  await schritt("1.1", "sign-up/email: Body > 1 MB → kein 5xx (better-auth/JSON-Body-Parser)", async () => {
    const r = await post("/api/auth/sign-up/email", { origin: BASIS, xffTag: "reg-big", raw: JSON.stringify({ email: testadresse("ef-big", TS), password: PASSWORT, name: GROSSER_TEXT }) });
    assertNie500(r, "sign-up gross");
    return `status=${r.status}`;
  });
  await schritt("1.2", "sign-up/email: ungültiges JSON → 4xx, kein 5xx", async () => {
    const r = await post("/api/auth/sign-up/email", { origin: BASIS, xffTag: "reg-badjson", raw: "{ das ist kein json" });
    assertTrue(r.status >= 400 && r.status < 500, `erwartet 4xx, erhalten ${r.status}`);
    return `status=${r.status}`;
  });
  await schritt("1.3", "sign-up/email: falscher Content-Type (text/plain) mit gültigem JSON-Text — dokumentiertes Verhalten", async () => {
    const email = testadresse("ef-ct", TS);
    const r = await post("/api/auth/sign-up/email", { origin: BASIS, xffTag: "reg-ct", contentType: "text/plain", raw: JSON.stringify({ email, password: PASSWORT, name: "CT" }) });
    assertNie500(r, "sign-up falscher content-type");
    if (r.status === 200) eigeneEmails.push(email);
    return `status=${r.status} (allowedMediaTypes in better-auth: json/x-www-form-urlencoded)`;
  });

  /* ============================================================
     2. LOGIN
     ============================================================ */
  await schritt("2.1", "sign-in/email: Body > 1 MB → kein 5xx", async () => {
    const r = await post("/api/auth/sign-in/email", { origin: BASIS, xffTag: "login-big", raw: JSON.stringify({ email: EMAIL_A, password: GROSSER_TEXT }) });
    assertNie500(r, "sign-in gross");
    return `status=${r.status}`;
  });
  await schritt("2.2", "sign-in/email: ungültiges JSON → 4xx", async () => {
    const r = await post("/api/auth/sign-in/email", { origin: BASIS, xffTag: "login-badjson", raw: "{{{" });
    assertTrue(r.status >= 400 && r.status < 500, `erwartet 4xx, erhalten ${r.status}`);
    return `status=${r.status}`;
  });
  await schritt("2.3", "sign-in/email: fehlendes Pflichtfeld (password) → 4xx", async () => {
    const r = await post("/api/auth/sign-in/email", { origin: BASIS, xffTag: "login-missing", body: { email: EMAIL_A } });
    assertTrue(r.status >= 400 && r.status < 500, `erwartet 4xx, erhalten ${r.status}`);
    return `status=${r.status}`;
  });

  /* ============================================================
     3. OBJEKTANFRAGE /api/inquiries (server/inquiries.ts:AnfrageSchema, .strict())
     ============================================================ */
  const [{ public_ref: PUBLISHED_REF }] = await sql`SELECT public_ref FROM listing WHERE status IN ('published','reserved') LIMIT 1`;
  assertTrue(!!PUBLISHED_REF, "kein veröffentlichtes Inserat für /api/inquiries-Fuzz gefunden");
  const anfrageBasis = () => ({ publicRef: PUBLISHED_REF, art: "listing_question", name: "Fuzz Person", email: testadresse("ef-inq", TS + Math.floor(Math.random() * 1e6)), nachricht: "Eine ganz normale Nachricht für den Fuzz-Test." });

  await schritt("3.1", "inquiries: Body > 8 KB (MAX_BYTES) → 422, kein 5xx", async () => {
    const r = await post("/api/inquiries", { origin: BASIS, xffTag: "inq-big", raw: JSON.stringify({ ...anfrageBasis(), nachricht: "A".repeat(20_000) }) });
    assertNie500(r, "inquiries gross");
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("3.2", "inquiries: unerwartetes Feld (userId, mass-assignment) → 422 (.strict())", async () => {
    const r = await post("/api/inquiries", { origin: BASIS, xffTag: "inq-mass", body: { ...anfrageBasis(), userId: A.id } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("3.3", "inquiries: ungültiges Enum (art) → 422", async () => {
    const r = await post("/api/inquiries", { origin: BASIS, xffTag: "inq-enum", body: { ...anfrageBasis(), art: "nicht-existent" } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("3.4", "inquiries: verschachteltes Objekt statt String (name) → 422", async () => {
    const r = await post("/api/inquiries", { origin: BASIS, xffTag: "inq-nested", body: { ...anfrageBasis(), name: { a: 1 } } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("3.5", "inquiries: Unicode-Grenzfall in nachricht — angenommen und gespeichert oder 422, nie 5xx", async () => {
    const email = testadresse("ef-inq-uni", TS);
    const r = await post("/api/inquiries", { origin: BASIS, xffTag: "inq-uni", body: { ...anfrageBasis(), email, nachricht: UNICODE_GRENZFALL } });
    assertNie500(r, "inquiries unicode");
    return `status=${r.status}`;
  });
  await schritt("3.6", "inquiries: HTML/Skript in nachricht — als Text gespeichert, nie ausgeführt (Empfänger ist eine interne Mail, kein HTML-Rendering)", async () => {
    const email = testadresse("ef-inq-xss", TS);
    const r = await post("/api/inquiries", { origin: BASIS, xffTag: "inq-xss", body: { ...anfrageBasis(), email, nachricht: HTML_PAYLOAD + " normaler Text." } });
    assertGleich(r.status, 201, "status");
    const [row] = await sql`SELECT message FROM inquiry WHERE sender_email = ${email} ORDER BY created_at DESC LIMIT 1`;
    assertTrue(!!row, "keine inquiry-Zeile gefunden");
    assertTrue(row.message.includes("<script>"), "Nachricht sollte unverändert als Text gespeichert sein (kein serverseitiges Stripping nötig, da nie als HTML ausgeliefert)");
    return `status=${r.status}, als Text in DB gespeichert`;
  });
  await schritt("3.7", "inquiries: SQL-artige Eingabe in nachricht — harmlos gespeichert (parametrisierte Queries), Tabellen unverändert", async () => {
    const email = testadresse("ef-inq-sql", TS);
    const [{ count: vor }] = await sql`SELECT count(*)::int AS count FROM listing`;
    const r = await post("/api/inquiries", { origin: BASIS, xffTag: "inq-sql", body: { ...anfrageBasis(), email, nachricht: SQL_PAYLOAD_1 + " " + SQL_PAYLOAD_2 } });
    assertGleich(r.status, 201, "status");
    const [{ count: nach }] = await sql`SELECT count(*)::int AS count FROM listing`;
    assertGleich(nach, vor, "listing-Anzahl unverändert");
    return `status=${r.status}, listing-Anzahl unverändert (${vor})`;
  });
  await schritt("3.8", "inquiries: ungültiges JSON → 422 (route liest den Body selbst, siehe app/api/inquiries/route.ts)", async () => {
    const r = await post("/api/inquiries", { origin: BASIS, xffTag: "inq-badjson", raw: "{nope" });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("3.9", "inquiries: fehlendes Pflichtfeld (nachricht) → 422", async () => {
    const { nachricht, ...ohne } = anfrageBasis();
    const r = await post("/api/inquiries", { origin: BASIS, xffTag: "inq-missing", body: ohne });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });

  /* ============================================================
     4. ANLIEGEN /api/anliegen (domain/anliegen.ts:AnliegenSchema, .strict())
     ============================================================ */
  const anliegenBasis = (email) => ({
    dienst: "sell", kontakt: { name: "Fuzz Eigentümerin", email: email ?? testadresse("ef-anl", TS + Math.floor(Math.random() * 1e6)) },
    objekt: { ortId: "ort-zuerich", typ: "wohnung" }, sprache: "de", herkunft: { seite: "/de/verkaufen" }, firma: ""
  });

  await schritt("4.1", "anliegen: Body > 32 KB (MAX_BYTES) → 422", async () => {
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "anl-big", raw: JSON.stringify({ ...anliegenBasis(), objekt: { ...anliegenBasis().objekt, nachricht: "A".repeat(40_000) } }) });
    assertNie500(r, "anliegen gross");
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("4.2", "anliegen: unerwartete Felder (status/assignedStaffId/userId/notes/score/platform_role) → je 422, keine Zeile", async () => {
    const felder = [{ status: "closed" }, { assignedStaffId: MOD.id }, { userId: A.id }, { notes: "geheim" }, { score: 99 }, { platform_role: "admin" }];
    for (const zusatz of felder) {
      const schluessel = Object.keys(zusatz)[0];
      const email = testadresse("ef-anl-mass-" + schluessel, TS);
      const r = await post("/api/anliegen", { origin: BASIS, xffTag: `anl-mass-${schluessel}`, body: { ...anliegenBasis(email), ...zusatz } });
      assertGleich(r.status, 422, `status (${schluessel})`);
      const [row] = await sql`SELECT id FROM service_lead WHERE contact_email = ${email}`;
      assertTrue(!row, `trotz 422 eine Zeile für ${schluessel} angelegt`);
    }
    return "alle sechs Felder → 422, keine Zeile angelegt";
  });
  await schritt("4.3", "anliegen: ungültiges Enum (dienst) → 422", async () => {
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "anl-enum", body: { ...anliegenBasis(), dienst: "erfunden" } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("4.4", "anliegen: verschachteltes Objekt statt String (kontakt.name) → 422", async () => {
    const b = anliegenBasis();
    b.kontakt = { ...b.kontakt, name: { a: 1 } };
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "anl-nested", body: b });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("4.5", "anliegen: Unicode-Grenzfall in kontakt.name — angenommen (201) oder 422, nie 5xx", async () => {
    const b = anliegenBasis();
    b.kontakt = { ...b.kontakt, name: UNICODE_GRENZFALL.slice(0, 118) };
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "anl-uni", body: b });
    assertNie500(r, "anliegen unicode");
    if (r.status === 201) eigeneAnliegenRefs.push(r.json.publicRef);
    return `status=${r.status}`;
  });
  await schritt("4.6", "anliegen: HTML/Skript in objekt.nachricht — als Text gespeichert (interne Mail, kein HTML-Rendering)", async () => {
    const email = testadresse("ef-anl-xss", TS);
    const b = anliegenBasis(email);
    b.objekt = { ...b.objekt, nachricht: HTML_PAYLOAD };
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "anl-xss", body: b });
    assertGleich(r.status, 201, "status");
    eigeneAnliegenRefs.push(r.json.publicRef);
    const [row] = await sql`SELECT message FROM service_lead WHERE public_ref = ${r.json.publicRef}`;
    assertTrue(!!row, "keine service_lead-Zeile gefunden");
    return `status=${r.status}, publicRef=${r.json.publicRef}`;
  });
  await schritt("4.7", "anliegen: SQL-artige Eingabe in kontakt.name — harmlos gespeichert, Tabellen unverändert", async () => {
    const email = testadresse("ef-anl-sql", TS);
    const b = anliegenBasis(email);
    b.kontakt = { ...b.kontakt, name: "Frau " + SQL_PAYLOAD_1 };
    const [{ count: vor }] = await sql`SELECT count(*)::int AS count FROM app_user`;
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "anl-sql", body: b });
    assertGleich(r.status, 201, "status");
    eigeneAnliegenRefs.push(r.json.publicRef);
    const [{ count: nach }] = await sql`SELECT count(*)::int AS count FROM app_user`;
    assertGleich(nach, vor, "app_user-Anzahl unverändert");
    return `status=${r.status}, app_user-Anzahl unverändert (${vor})`;
  });
  await schritt("4.8", "anliegen: ungültiges JSON → 422", async () => {
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "anl-badjson", raw: "not json at all" });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("4.9", "anliegen: fehlendes Pflichtfeld (kontakt) → 422", async () => {
    const { kontakt, ...ohne } = anliegenBasis();
    const r = await post("/api/anliegen", { origin: BASIS, xffTag: "anl-missing", body: ohne });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("4.10", "anliegen: doppelte Einreichung derselben E-Mail — 3/24h-Grenze greift ab dem 4. Versuch (429)", async () => {
    const email = testadresse("ef-anl-dup", TS);
    let letzter;
    for (let i = 1; i <= 4; i++) {
      letzter = await post("/api/anliegen", { origin: BASIS, xffTag: `anl-dup-${i}`, body: anliegenBasis(email) });
      if (i < 4) { assertGleich(letzter.status, 201, `versuch ${i}`); eigeneAnliegenRefs.push(letzter.json.publicRef); }
    }
    assertGleich(letzter.status, 429, "4. Versuch (gleiche Mail) sollte 429 sein (server/anliegen.ts: 3/24h je Mail-Hash)");
    return `4. Versuch mit derselben Mail → ${letzter.status}`;
  });

  /* ============================================================
     5. INSERATS-ASSISTENT /api/entwuerfe* (domain/entwurf.ts:EntwurfSchema, .strict())
     ============================================================ */
  let entwurfRef, entwurfVersion;
  await schritt("5.1", "entwuerfe anlegen: Body > 1 MB → kein 5xx (jsonLesen Standardgrenze 64 KB)", async () => {
    const r = await post("/api/entwuerfe", { origin: BASIS, cookie: A.cookie, raw: JSON.stringify({ daten: { titel: GROSSER_TEXT } }) });
    assertNie500(r, "entwurf anlegen gross");
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("5.2", "entwuerfe anlegen: leerer Entwurf → 201 (kein Pflichtfeld beim Anlegen selbst)", async () => {
    const r = await post("/api/entwuerfe", { origin: BASIS, cookie: A.cookie, body: {} });
    assertGleich(r.status, 201, "status");
    entwurfRef = r.json.publicRef; entwurfVersion = r.json.version;
    eigeneEntwurfRefs.push(entwurfRef);
    return `publicRef=${entwurfRef}`;
  });
  await schritt("5.3", "entwuerfe patch: unerwartete/mass-assignment-Felder (status, ownerId, userId, platform_role) im daten-Objekt → 422, DB unverändert", async () => {
    const felder = [{ status: "published" }, { ownerId: MOD.id }, { userId: MOD.id }, { platform_role: "admin" }];
    for (const zusatz of felder) {
      const schluessel = Object.keys(zusatz)[0];
      const [vor] = await sql`SELECT status FROM listing WHERE public_ref = ${entwurfRef}`;
      const r = await patch(`/api/entwuerfe/${entwurfRef}`, { origin: BASIS, cookie: A.cookie, body: { version: entwurfVersion, daten: zusatz } });
      assertGleich(r.status, 422, `status (${schluessel})`);
      const [nach] = await sql`SELECT status FROM listing WHERE public_ref = ${entwurfRef}`;
      assertGleich(nach.status, vor.status, `status in DB nach ${schluessel}`);
    }
    return "status/ownerId/userId/platform_role je 422, listing.status unverändert";
  });
  await schritt("5.4", "entwuerfe patch: ungültiges Enum (trans) → 422", async () => {
    const r = await patch(`/api/entwuerfe/${entwurfRef}`, { origin: BASIS, cookie: A.cookie, body: { version: entwurfVersion, daten: { trans: "erfunden" } } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("5.5", "entwuerfe patch: verschachteltes Objekt statt String (titel) → 422", async () => {
    const r = await patch(`/api/entwuerfe/${entwurfRef}`, { origin: BASIS, cookie: A.cookie, body: { version: entwurfVersion, daten: { titel: { a: 1 } } } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("5.6", "entwuerfe patch: Unicode-Grenzfall in beschreibung — angenommen (max 4000 Zeichen) oder 422, nie 5xx", async () => {
    const r = await patch(`/api/entwuerfe/${entwurfRef}`, { origin: BASIS, cookie: A.cookie, body: { version: entwurfVersion, daten: { beschreibung: UNICODE_GRENZFALL.slice(0, 3999) } } });
    assertNie500(r, "entwurf patch unicode");
    if (r.status === 200) entwurfVersion = r.json.version;
    return `status=${r.status}`;
  });
  await schritt("5.7", "entwuerfe patch: HTML/Skript im Titel — 200, als Text gespeichert (siehe sicherheit-test.mjs F32 für die Ausgabe-Seite)", async () => {
    const r = await patch(`/api/entwuerfe/${entwurfRef}`, { origin: BASIS, cookie: A.cookie, body: { version: entwurfVersion, daten: { titel: HTML_PAYLOAD.slice(0, 70) } } });
    assertGleich(r.status, 200, "status");
    entwurfVersion = r.json.version;
    /* Vor dem Einreichen lebt der Titel nur in listing.draft_data (JSONB) —
       server/entwuerfe.ts materialisiert ihn erst beim Einreichen in die
       Spalte listing.title (dort prüft F32 in sicherheit-test.mjs das
       Escaping der öffentlichen Ausgabe). */
    const [row] = await sql`SELECT draft_data->>'titel' AS titel FROM listing WHERE public_ref = ${entwurfRef}`;
    assertTrue(row.titel.includes("<script>"), "Titel sollte unverändert als Text in draft_data stehen");
    return `status=${r.status}, unescaped in draft_data (Ausgabe wird beim Veröffentlichen escaped, siehe sicherheit-test.mjs F32)`;
  });
  await schritt("5.8", "entwuerfe patch: SQL-artige Eingabe im Titel — harmlos gespeichert, listing-Tabelle unverändert", async () => {
    const [{ count: vor }] = await sql`SELECT count(*)::int AS count FROM listing`;
    const r = await patch(`/api/entwuerfe/${entwurfRef}`, { origin: BASIS, cookie: A.cookie, body: { version: entwurfVersion, daten: { titel: ("Titel " + SQL_PAYLOAD_1).slice(0, 70) } } });
    assertGleich(r.status, 200, "status");
    entwurfVersion = r.json.version;
    const [{ count: nach }] = await sql`SELECT count(*)::int AS count FROM listing`;
    assertGleich(nach, vor, "listing-Anzahl unverändert");
    return `status=${r.status}, listing-Anzahl unverändert (${vor})`;
  });
  await schritt("5.9", "entwuerfe patch: ungültiges JSON → 422", async () => {
    const r = await patch(`/api/entwuerfe/${entwurfRef}`, { origin: BASIS, cookie: A.cookie, raw: "{ bad" });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("5.10", "entwuerfe patch: fehlendes Pflichtfeld (version) → 422", async () => {
    const r = await patch(`/api/entwuerfe/${entwurfRef}`, { origin: BASIS, cookie: A.cookie, body: { daten: { titel: "Ohne Version" } } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("5.11", "entwuerfe aktion: unbekannte Absicht → 422 (Erlaubnisliste im Route-Handler, kein Enum-Schema)", async () => {
    const r = await post(`/api/entwuerfe/${entwurfRef}/aktion`, { origin: BASIS, cookie: A.cookie, body: { absicht: "erfundene-aktion" } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("5.12", "entwuerfe aktion: Body > 1 MB → kein 5xx", async () => {
    const r = await post(`/api/entwuerfe/${entwurfRef}/aktion`, { origin: BASIS, cookie: A.cookie, raw: JSON.stringify({ absicht: "einreichen", fuellstoff: GROSSER_TEXT }) });
    assertNie500(r, "entwurf aktion gross");
    return `status=${r.status}`;
  });
  await schritt("5.13", "entwuerfe aktion: doppelte Einreichung (zweimal 'einreichen' auf demselben unvollständigen Entwurf) — beide 422 (Vollständigkeit fehlt), idempotent kein Duplikat", async () => {
    const einmal = await post(`/api/entwuerfe/${entwurfRef}/aktion`, { origin: BASIS, cookie: A.cookie, body: { absicht: "einreichen" } });
    const zweimal = await post(`/api/entwuerfe/${entwurfRef}/aktion`, { origin: BASIS, cookie: A.cookie, body: { absicht: "einreichen" } });
    assertNie500(einmal, "einreichen 1"); assertNie500(zweimal, "einreichen 2");
    assertGleich(einmal.status, zweimal.status, "beide Versuche gleicher Status (unvollständiger Entwurf)");
    return `1.=${einmal.status}, 2.=${zweimal.status}`;
  });

  /* ============================================================
     6. ORGANISATION ANLEGEN /api/org (server/organisationen.ts:OrganisationAnlegenSchema, .strict())
     ============================================================ */
  const orgBasis = (n) => ({ displayName: `Fuzz Immobilien ${n}`, kind: "agency", locale: "de" });

  await schritt("6.1", "org anlegen: Body > 1 MB → 422, kein 5xx", async () => {
    const r = await post("/api/org", { origin: BASIS, cookie: A.cookie, raw: JSON.stringify({ ...orgBasis(TS), description: GROSSER_TEXT }) });
    assertNie500(r, "org anlegen gross");
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("6.2", "org anlegen: unerwartetes Feld (id, mass-assignment) → 422 (.strict())", async () => {
    const r = await post("/api/org", { origin: BASIS, cookie: A.cookie, body: { ...orgBasis(TS + 1), id: "00000000-0000-0000-0000-000000000000" } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("6.3", "org anlegen: ungültiges Enum (kind) → 422", async () => {
    const r = await post("/api/org", { origin: BASIS, cookie: A.cookie, body: { ...orgBasis(TS + 2), kind: "erfunden" } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("6.4", "org anlegen: verschachteltes Objekt statt String (displayName) → 422", async () => {
    const r = await post("/api/org", { origin: BASIS, cookie: A.cookie, body: { ...orgBasis(TS + 3), displayName: { a: 1 } } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  let orgSlug;
  await schritt("6.5", "org anlegen: gültiger Body mit Unicode im Namen → 201, Slug ohne Sonderzeichen erzeugt", async () => {
    const r = await post("/api/org", { origin: BASIS, cookie: A.cookie, body: { ...orgBasis(TS + 4), displayName: "Fuzz Immo 🏠 & Söhne" } });
    assertGleich(r.status, 201, "status");
    orgSlug = r.json.slug; eigeneOrgSlugs.push(orgSlug);
    assertTrue(/^[a-z0-9-]+$/.test(orgSlug), "slug enthält Zeichen ausserhalb [a-z0-9-]");
    return `status=${r.status}, slug=${orgSlug}`;
  });
  await schritt("6.6", "org anlegen: ungültiges JSON → 422", async () => {
    const r = await post("/api/org", { origin: BASIS, cookie: A.cookie, raw: "{ nope" });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("6.7", "org anlegen: fehlendes Pflichtfeld (kind) → 422", async () => {
    const { kind, ...ohne } = orgBasis(TS + 5);
    const r = await post("/api/org", { origin: BASIS, cookie: A.cookie, body: ohne });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });

  /* ============================================================
     7. EINLADUNG /api/org/:slug/mitglieder (server/einladungen.ts:EinladenSchema, .strict())
     ============================================================ */
  await schritt("7.1", "einladen: unerwartetes Feld (userId, mass-assignment) → 422", async () => {
    const r = await post(`/api/org/${orgSlug}/mitglieder`, { origin: BASIS, cookie: A.cookie, body: { email: testadresse("ef-inv1", TS), rolle: "viewer", userId: MOD.id } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("7.2", "einladen: ungültiges Enum (rolle) → 422", async () => {
    const r = await post(`/api/org/${orgSlug}/mitglieder`, { origin: BASIS, cookie: A.cookie, body: { email: testadresse("ef-inv2", TS), rolle: "superadmin" } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("7.3", "einladen: verschachteltes Objekt statt String (email) → 422", async () => {
    const r = await post(`/api/org/${orgSlug}/mitglieder`, { origin: BASIS, cookie: A.cookie, body: { email: { a: 1 }, rolle: "viewer" } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("7.4", "einladen: HTML/Skript im lokalen Teil der Adresse — von z.email() abgelehnt → 422", async () => {
    const r = await post(`/api/org/${orgSlug}/mitglieder`, { origin: BASIS, cookie: A.cookie, body: { email: `${HTML_PAYLOAD}@example.com`, rolle: "viewer" } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("7.5", "einladen: Body > 1 MB → 422, kein 5xx", async () => {
    const r = await post(`/api/org/${orgSlug}/mitglieder`, { origin: BASIS, cookie: A.cookie, raw: JSON.stringify({ email: testadresse("ef-inv3", TS), rolle: "viewer", fuellstoff: GROSSER_TEXT }) });
    assertNie500(r, "einladen gross");
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("7.6", "einladen: gültiger Body → 201", async () => {
    const r = await post(`/api/org/${orgSlug}/mitglieder`, { origin: BASIS, cookie: A.cookie, body: { email: testadresse("ef-inv-ok", TS), rolle: "viewer" } });
    assertGleich(r.status, 201, "status");
    return `status=${r.status}`;
  });
  await schritt("7.7", "einladen: ungültiges JSON → 422", async () => {
    const r = await post(`/api/org/${orgSlug}/mitglieder`, { origin: BASIS, cookie: A.cookie, raw: "{{{" });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("7.8", "einladen: fehlendes Pflichtfeld (rolle) → 422", async () => {
    const r = await post(`/api/org/${orgSlug}/mitglieder`, { origin: BASIS, cookie: A.cookie, body: { email: testadresse("ef-inv4", TS) } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });

  /* ============================================================
     8. ANBIETERPROFIL PATCH /api/org/:slug (server/organisationen.ts:ProfilAendernSchema, .strict())
     ============================================================ */
  await schritt("8.1", "profil ändern: unerwartetes Feld (verificationState, mass-assignment) → 422, DB unverändert", async () => {
    const [vor] = await sql`SELECT verification_state FROM organization WHERE slug = ${orgSlug}`;
    const r = await patch(`/api/org/${orgSlug}`, { origin: BASIS, cookie: A.cookie, body: { verificationState: "verified" } });
    assertGleich(r.status, 422, "status");
    const [nach] = await sql`SELECT verification_state FROM organization WHERE slug = ${orgSlug}`;
    assertGleich(nach.verification_state, vor.verification_state, "verification_state in DB");
    return `status=${r.status}, verification_state unverändert`;
  });
  await schritt("8.2", "profil ändern: logoAssetId eines fremden Kontos → 403 (Eigentumsprüfung, keine Zod-Sache)", async () => {
    const fremdesBild = await uploadDatei(MOD.cookie, BILD_PFAD, "logo-fremd.jpg", "image/jpeg");
    assertGleich(fremdesBild.status, 201, "upload durch MOD");
    const r = await patch(`/api/org/${orgSlug}`, { origin: BASIS, cookie: A.cookie, body: { logoAssetId: fremdesBild.json.id } });
    assertGleich(r.status, 403, "status");
    await sql`DELETE FROM media_asset WHERE id = ${fremdesBild.json.id}`;
    return `status=${r.status}`;
  });
  await schritt("8.3", "profil ändern: ungültiges Enum (locale) → 422", async () => {
    const r = await patch(`/api/org/${orgSlug}`, { origin: BASIS, cookie: A.cookie, body: { locale: "xx" } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("8.4", "profil ändern: verschachteltes Objekt statt String (displayName) → 422", async () => {
    const r = await patch(`/api/org/${orgSlug}`, { origin: BASIS, cookie: A.cookie, body: { displayName: { a: 1 } } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("8.5", "profil ändern: HTML/Skript in description — gespeichert als Text", async () => {
    const r = await patch(`/api/org/${orgSlug}`, { origin: BASIS, cookie: A.cookie, body: { description: HTML_PAYLOAD } });
    assertGleich(r.status, 200, "status");
    const [row] = await sql`SELECT description FROM organization WHERE slug = ${orgSlug}`;
    assertTrue(row.description.includes("<script>"), "description sollte unverändert als Text gespeichert sein");
    return `status=${r.status}`;
  });
  await schritt("8.6", "profil ändern: Body > 1 MB → 422", async () => {
    const r = await patch(`/api/org/${orgSlug}`, { origin: BASIS, cookie: A.cookie, raw: JSON.stringify({ description: GROSSER_TEXT }) });
    assertNie500(r, "profil ändern gross");
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("8.7", "profil ändern: ungültiges JSON → 422", async () => {
    const r = await patch(`/api/org/${orgSlug}`, { origin: BASIS, cookie: A.cookie, raw: "nope{" });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });

  /* ============================================================
     9. CSV-IMPORT /api/org/:slug/import (docs/IMPORT-ADAPTER.md)
     ============================================================ */
  await schritt("9.1", "csv import: Body > MAX_BYTES (1 MiB + 4 KiB) → 422, kein 5xx", async () => {
    const r = await post(`/api/org/${orgSlug}/import`, { origin: BASIS, cookie: A.cookie, contentType: "text/csv", raw: "a,b,c\n" + "1,2,3\n".repeat(200_000) });
    assertNie500(r, "csv import gross");
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("9.2", "csv import: JSON-Hülle ohne csv-Feld (mass-assignment-Versuch) → 422", async () => {
    const r = await post(`/api/org/${orgSlug}/import`, { origin: BASIS, cookie: A.cookie, contentType: "application/json", body: { userId: A.id, ownerId: A.id } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("9.3", "csv import: HTML/Skript und SQL-artige Eingabe in einer Spalte — nie 5xx (Import-Zeile scheitert oder wird als Text übernommen)", async () => {
    const r = await post(`/api/org/${orgSlug}/import`, { origin: BASIS, cookie: A.cookie, contentType: "text/csv", raw: `titel,typ\n${HTML_PAYLOAD} ${SQL_PAYLOAD_1},wohnung\n` });
    assertNie500(r, "csv import xss/sql");
    return `status=${r.status}`;
  });
  await schritt("9.4", "csv import: ungültiger JSON-Body mit application/json → 422", async () => {
    const r = await post(`/api/org/${orgSlug}/import`, { origin: BASIS, cookie: A.cookie, contentType: "application/json", raw: "{ kaputt" });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("9.5", "csv import: leerer Body → kein 5xx", async () => {
    const r = await post(`/api/org/${orgSlug}/import`, { origin: BASIS, cookie: A.cookie, contentType: "text/csv", raw: "" });
    assertNie500(r, "csv import leer");
    return `status=${r.status}`;
  });

  /* ============================================================
     10. SUCHABO ANLEGEN /api/suchabo (BodySchema nicht .strict() → unbekannte Felder werden ignoriert)
     ============================================================ */
  const suchaboBasis = () => ({ query: { trans: "buy", ort: "ort-zuerich" }, frequency: "weekly", label: "Fuzz-Suche" });

  await schritt("10.1", "suchabo: unerwartetes Top-Level-Feld (userId, mass-assignment) — von Zod stillschweigend entfernt, kein Fehler, keine Wirkung", async () => {
    const r = await post("/api/suchabo", { origin: BASIS, cookie: A.cookie, body: { ...suchaboBasis(), userId: MOD.id } });
    assertGleich(r.status, 201, "status (Feld wird ignoriert, kein Validierungsfehler)");
    const [row] = await sql`SELECT user_id FROM saved_search WHERE user_id = ${A.id} ORDER BY created_at DESC LIMIT 1`;
    assertTrue(!!row, "keine saved_search-Zeile für A gefunden");
    assertGleich(String(row.user_id), A.id, "user_id sollte A sein, nicht das mitgeschickte userId");
    return `status=${r.status}, user_id korrekt A, userId aus dem Body ignoriert`;
  });
  await schritt("10.2", "suchabo: ungültiges Enum (frequency) → 422", async () => {
    const r = await post("/api/suchabo", { origin: BASIS, cookie: A.cookie, body: { ...suchaboBasis(), frequency: "stuendlich" } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("10.3", "suchabo: verschachteltes Objekt statt String (label) → 422", async () => {
    const r = await post("/api/suchabo", { origin: BASIS, cookie: A.cookie, body: { ...suchaboBasis(), label: { a: 1 } } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("10.4", "suchabo: HTML/Skript im Label — gespeichert als Text, query.bounds mit unsinnigen Werten in der verschachtelten Suchanfrage → verworfen statt geraten", async () => {
    const r = await post("/api/suchabo", { origin: BASIS, cookie: A.cookie, body: { query: { trans: "buy", bounds: { n: 999, s: -999, o: 999, w: -999 } }, frequency: "daily", label: HTML_PAYLOAD } });
    assertNie500(r, "suchabo xss/bounds");
    return `status=${r.status}`;
  });
  await schritt("10.5", "suchabo: Body > 1 MB → 4xx, kein 5xx", async () => {
    const r = await post("/api/suchabo", { origin: BASIS, cookie: A.cookie, raw: JSON.stringify({ ...suchaboBasis(), label: GROSSER_TEXT }) });
    assertNie500(r, "suchabo gross");
    assertTrue(r.status >= 400 && r.status < 500, `erwartet 4xx, erhalten ${r.status}`);
    return `status=${r.status}`;
  });
  await schritt("10.6", "suchabo: ungültiges JSON → 422", async () => {
    const r = await post("/api/suchabo", { origin: BASIS, cookie: A.cookie, raw: "kaputt{{" });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("10.7", "suchabo: fehlendes Pflichtfeld (frequency) → 422", async () => {
    const { frequency, ...ohne } = suchaboBasis();
    const r = await post("/api/suchabo", { origin: BASIS, cookie: A.cookie, body: ohne });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });

  /* ============================================================
     11. FAVORIT /api/favoriten (KippenSchema, ein Feld, ein strenges Regex)
     ============================================================ */
  await schritt("11.1", "favoriten: ungültiges Format (kein FWL-Muster) → 422", async () => {
    const r = await post("/api/favoriten", { origin: BASIS, cookie: A.cookie, body: { publicRef: "erfunden-123" } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("11.2", "favoriten: SQL-artige Eingabe als publicRef → 422 (Regex lässt es gar nicht erst durch)", async () => {
    const r = await post("/api/favoriten", { origin: BASIS, cookie: A.cookie, body: { publicRef: `${PUBLISHED_REF}' OR 1=1--` } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("11.3", "favoriten: verschachteltes Objekt statt String → 422", async () => {
    const r = await post("/api/favoriten", { origin: BASIS, cookie: A.cookie, body: { publicRef: { a: 1 } } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("11.4", "favoriten: unerwartetes Zusatzfeld (userId) — ignoriert, kein Fehler, keine Wirkung", async () => {
    const r = await post("/api/favoriten", { origin: BASIS, cookie: A.cookie, body: { publicRef: PUBLISHED_REF, userId: MOD.id } });
    assertGleich(r.status, 200, "status");
    const [row] = await sql`SELECT user_id FROM favorite f JOIN listing l ON l.id = f.listing_id WHERE l.public_ref = ${PUBLISHED_REF} AND f.user_id = ${A.id}`;
    assertTrue(!!row, "favorite-Zeile für A erwartet");
    return `status=${r.status}, user_id korrekt A`;
  });
  await schritt("11.5", "favoriten: doppelte Einreichung (gleicher Body zweimal) — Kippschalter, kein Duplikat (zweiter Aufruf entfernt statt anlegt)", async () => {
    const zurueck = await post("/api/favoriten", { origin: BASIS, cookie: A.cookie, body: { publicRef: PUBLISHED_REF } });
    assertGleich(zurueck.status, 200, "status");
    assertGleich(zurueck.json.gemerkt, false, "zweiter Aufruf sollte entmerken (Kippschalter), kein zweiter Datensatz");
    const anzahl = await sql`SELECT count(*)::int AS n FROM favorite f JOIN listing l ON l.id = f.listing_id WHERE l.public_ref = ${PUBLISHED_REF} AND f.user_id = ${A.id}`;
    assertGleich(anzahl[0].n, 0, "keine favorite-Zeile mehr für A/dieses Inserat");
    return "Kippschalter bestätigt: kein Duplikat";
  });
  await schritt("11.6", "favoriten: ungültiges JSON → 422", async () => {
    const r = await post("/api/favoriten", { origin: BASIS, cookie: A.cookie, raw: "{oops" });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });

  /* ============================================================
     12. VERGLEICH-API /api/vergleich (nur GET, keine Sitzung)
     ============================================================ */
  await schritt("12.1", "vergleich: SQL-artige Eingabe im refs-Parameter — kein Treffer, kein 5xx", async () => {
    const r = await get(`/api/vergleich?refs=${encodeURIComponent("' OR 1=1--,FWL-2026-000001")}`, { xffTag: "vergleich-sql" });
    assertNie500(r, "vergleich sql");
    assertGleich(r.status, 200, "status");
    assertGleich(r.json.treffer.length, 0, "kein Treffer für ungültige Referenzen erwartet");
    return `status=${r.status}, treffer=${r.json.treffer.length}`;
  });
  await schritt("12.2", "vergleich: HTML/Skript im refs-Parameter — kein 5xx, keine Ausführung", async () => {
    const r = await get(`/api/vergleich?refs=${encodeURIComponent(HTML_PAYLOAD)}`, { xffTag: "vergleich-xss" });
    assertNie500(r, "vergleich xss");
    assertGleich(r.status, 200, "status");
    return `status=${r.status}`;
  });
  await schritt("12.3", "vergleich: mehr als vier Referenzen — auf vier begrenzt, kein 5xx", async () => {
    const viele = Array.from({ length: 20 }, (_, i) => `FWL-2026-${String(i).padStart(6, "0")}`).join(",");
    const r = await get(`/api/vergleich?refs=${encodeURIComponent(viele)}`, { xffTag: "vergleich-viele" });
    assertNie500(r, "vergleich viele refs");
    assertGleich(r.status, 200, "status");
    return `status=${r.status}`;
  });
  await schritt("12.4", "vergleich: übergrosser refs-Parameter (100 000 Zeichen) — kein 5xx", async () => {
    const r = await get(`/api/vergleich?refs=${encodeURIComponent("A".repeat(100_000))}`, { xffTag: "vergleich-gross" });
    assertTrue(r.status < 500, `erwartet <500, erhalten ${r.status}`);
    return `status=${r.status}`;
  });

  /* ============================================================
     13. KONTOLÖSCHUNG /api/konto/loeschen (LoeschenSchema, .strict())
     ============================================================ */
  const EMAIL_LOESCHEN = testadresse("ef-del", TS);
  eigeneEmails.push(EMAIL_LOESCHEN);
  const DEL_PW = "Loesch-" + randomBytes(10).toString("base64url");
  const DEL = await personAnlegen(EMAIL_LOESCHEN, "del-auth", "Zu löschen (Fuzz)");

  await schritt("13.1", "konto loeschen: unerwartetes Feld (userId, mass-assignment) → 422", async () => {
    const r = await post("/api/konto/loeschen", { origin: BASIS, cookie: DEL.cookie, body: { passwort: PASSWORT, bestaetigung: "LÖSCHEN", userId: MOD.id } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("13.2", "konto loeschen: falsches Bestätigungswort → 422, Konto besteht weiter", async () => {
    const r = await post("/api/konto/loeschen", { origin: BASIS, cookie: DEL.cookie, body: { passwort: PASSWORT, bestaetigung: "vielleicht" } });
    assertGleich(r.status, 422, "status");
    const [row] = await sql`SELECT id FROM app_user WHERE email = ${EMAIL_LOESCHEN} AND deleted_at IS NULL`;
    assertTrue(!!row, "konto sollte noch existieren");
    return `status=${r.status}`;
  });
  await schritt("13.3", "konto loeschen: falsches Passwort → 4xx, Konto besteht weiter", async () => {
    const r = await post("/api/konto/loeschen", { origin: BASIS, cookie: DEL.cookie, body: { passwort: "definitiv-falsch-123", bestaetigung: "LÖSCHEN" } });
    assertTrue(r.status >= 400 && r.status < 500, `erwartet 4xx, erhalten ${r.status}`);
    const [row] = await sql`SELECT id FROM app_user WHERE email = ${EMAIL_LOESCHEN} AND deleted_at IS NULL`;
    assertTrue(!!row, "konto sollte noch existieren");
    return `status=${r.status}`;
  });
  await schritt("13.4", "konto loeschen: verschachteltes Objekt statt String (bestaetigung) → 422", async () => {
    const r = await post("/api/konto/loeschen", { origin: BASIS, cookie: DEL.cookie, body: { passwort: PASSWORT, bestaetigung: { a: 1 } } });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("13.5", "konto loeschen: ungültiges JSON → 422", async () => {
    const r = await post("/api/konto/loeschen", { origin: BASIS, cookie: DEL.cookie, raw: "{ kaputt" });
    assertGleich(r.status, 422, "status");
    return `status=${r.status}`;
  });
  await schritt("13.6", "konto loeschen: gültiger Aufruf löscht das Konto wirklich (räumt sich damit selbst auf)", async () => {
    const r = await post("/api/konto/loeschen", { origin: BASIS, cookie: DEL.cookie, body: { passwort: PASSWORT, bestaetigung: "LÖSCHEN" } });
    assertGleich(r.status, 200, "status");
    /* Die Löschung anonymisiert die Adresse (Tombstone, siehe
       server/konto-loeschung.ts:personAnonymisieren) — danach über die ID
       nachschauen, nicht mehr über die ursprüngliche E-Mail. */
    const [row] = await sql`SELECT deleted_at, email FROM app_user WHERE id = ${DEL.id}`;
    assertTrue(!!row?.deleted_at, "app_user.deleted_at sollte gesetzt sein");
    assertTrue(row.email !== EMAIL_LOESCHEN, "die Adresse sollte anonymisiert (Tombstone) worden sein");
    return `status=${r.status}, deleted_at gesetzt, Adresse anonymisiert`;
  });

  /* ============================================================
     14. EXPORT /api/konto/export (GET, kein Body — Grenzfälle in Kopfzeilen/Query)
     ============================================================ */
  await schritt("14.1", "export: fremde Query-Parameter werden ignoriert, kein 5xx", async () => {
    const r = await get(`/api/konto/export?userId=${MOD.id}&format=${encodeURIComponent(HTML_PAYLOAD)}`, { cookie: A.cookie, origin: BASIS });
    assertNie500(r, "export query");
    assertGleich(r.status, 200, "status");
    const daten = JSON.parse(r.text);
    assertGleich(daten?.person?.id ?? daten?.id ?? A.id, A.id, "export sollte die eigenen Daten liefern (userId aus der Query ignoriert)");
    return `status=${r.status}`;
  });
  await schritt("14.2", "export: fremde Origin → 403 (herkunftPruefen auch bei GET, siehe app/api/konto/export/route.ts)", async () => {
    const r = await get("/api/konto/export", { cookie: A.cookie, origin: "https://boese.example" });
    assertGleich(r.status, 403, "status");
    return `status=${r.status}`;
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
  const w1 = 7;
  const w2 = Math.max(20, ...ergebnisse.map(e => e.titel.length));
  const w3 = 6;
  const zeile = (a, b, c, d) => `${String(a).padEnd(w1)}  ${String(b).padEnd(w2)}  ${String(c).padEnd(w3)}  ${d}`;
  console.log("\n" + zeile("Nr", "Prüfung", "Status", "Detail"));
  console.log("-".repeat(w1 + w2 + w3 + 10));
  for (const e of ergebnisse) console.log(zeile(e.bez, e.titel, e.status, e.detail));
}
tabelle();

const fehlerAnzahl = ergebnisse.filter(e => e.status === "FEHLER").length;
console.log(`\n${ergebnisse.length} Prüfungen, ${fehlerAnzahl} FEHLER, ${ergebnisse.length - fehlerAnzahl} OK — Dauer ${(dauerMs / 1000).toFixed(1)}s`);
if (fehlerAnzahl > 0) {
  console.log("\nFEHLER im Detail:");
  for (const e of ergebnisse.filter(e => e.status === "FEHLER")) console.log(`  ${e.bez} (${e.titel}): ${e.detail}`);
}

const bericht = { basis: BASIS, zeit: new Date().toISOString(), ergebnisse };
const berichtPfad = join(APP_ROOT, "var", "eingabe-fuzz-bericht.json");
await import("node:fs/promises").then(fs => fs.writeFile(berichtPfad, JSON.stringify(bericht, null, 2)));
console.log(`Bericht geschrieben: ${berichtPfad}`);

process.exit(fehlerAnzahl > 0 ? 1 : 0);
