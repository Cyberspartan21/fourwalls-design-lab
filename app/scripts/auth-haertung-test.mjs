#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Authentifizierungs-Härtung (P5.10 §7)

   Greift Better Auth 1.7.2 (server/auth.ts) und den eigenen Sitzungscode
   (server/sitzung.ts) mit HTTP an: Registrierung, Anmeldung, Abmeldung,
   Sitzungsablauf und -widerruf, Passwort-Zurücksetzen, Verifikation,
   parallele Sitzungen, veraltete/kaputte Cookies, Herkunft/CSRF und
   Ratenbegrenzung. Erwartungen leiten sich aus server/auth.ts und
   node_modules/better-auth/dist/api/** ab (Kommentare je Abschnitt).

   Aufruf:
     set -a; . ./.env.local; set +a
     FW_TEST_MOD_EMAIL=... FW_TEST_MOD_PASSWORT=... node scripts/auth-haertung-test.mjs [Basis-URL]

   Mailquelle (siehe scripts/lib/mailquelle.mjs): FW_TEST_MAIL_QUELLE=dev|mailpit|imap.

   Schreibt eine Tabelle auf stdout und var/auth-haertung-bericht.json.
   Exit 1, sobald irgendeine Prüfung FEHLER meldet. Räumt eigene Testzeilen
   am Ende auf (DELETE eigener app_user/auth_session-Zeilen per Präfix "ah+").
   ============================================================ */
import postgres from "postgres";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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

const PASSWORT = "Haert-" + randomBytes(12).toString("base64url");

const ergebnisse = [];
function assertTrue(bedingung, meldung) { if (!bedingung) throw new Error(meldung); }
function assertGleich(ist, soll, feld) {
  if (ist !== soll) throw new Error(`${feld}: erwartet ${JSON.stringify(soll)}, erhalten ${JSON.stringify(ist)}`);
}
async function schritt(bez, titel, fn) {
  try {
    const detail = (await fn()) || "ok";
    ergebnisse.push({ bez, titel, status: "OK", detail });
    console.log(`OK      ${String(bez).padEnd(6)} ${titel}`);
  } catch (e) {
    const detail = e && e.message ? e.message : String(e);
    ergebnisse.push({ bez, titel, status: "FEHLER", detail });
    console.log(`FEHLER  ${String(bez).padEnd(6)} ${titel} — ${detail}`);
  }
}

/* ---------- x-forwarded-for je Zweck: eigene Läufe sollen nicht in die
   eigenen Ratenlimits laufen (allgemein 30/min, sign-in 8/5min, sign-up
   5/h, reset 8/h, forget 5/h — server/auth.ts:rateLimit.customRules). ---------- */
const RUNSEED = Math.floor(Math.random() * 200) + 10;
const xffMap = new Map();
function xff(tag) {
  if (!xffMap.has(tag)) xffMap.set(tag, `10.${RUNSEED}.${xffMap.size + 1}.19`);
  return xffMap.get(tag);
}

/* ---------- HTTP ---------- */
async function api(method, pfad, { cookie, origin, secFetchSite, xffTag, ip, body, headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const h = { ...headers };
    if (cookie) h["cookie"] = cookie;
    if (origin !== undefined) h["origin"] = origin;
    if (secFetchSite) h["sec-fetch-site"] = secFetchSite;
    if (xffTag) h["x-forwarded-for"] = xff(xffTag);
    if (ip) h["x-forwarded-for"] = ip;
    let payload;
    if (body !== undefined) { h["content-type"] = "application/json"; payload = JSON.stringify(body); }
    const res = await fetch(BASIS + pfad, { method, headers: h, body: payload, redirect: "manual", signal: ctrl.signal });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* kein JSON */ }
    const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    return { status: res.status, json, text, setCookies };
  } finally { clearTimeout(timer); }
}
const get = (p, o) => api("GET", p, o);
const post = (p, o) => api("POST", p, o);

function cookieAus(setCookies) {
  const c = setCookies.find(c => c.startsWith("fw.session_token="));
  return c ? c.split(";")[0] : null;
}
/* Der reine Sitzungs-Token (vor dem Signaturpunkt) — für DB-Abgleich und für
   Better-Auth-Endpunkte, die den Token selbst im Body verlangen (revoke-session). */
function tokenAusCookie(cookie) {
  const roh = decodeURIComponent(cookie.split("=").slice(1).join("="));
  return roh.split(".")[0];
}

/* ---------- Mail ---------- */
const MAILQUELLE = mailquelle();
/* Bestätigungs-/Reset-Mail je Konto von einer eigenen Adresse abrufen: die
   allgemeine Auth-Ratenbegrenzung (30/min je IP) zählt sonst alle Mails der
   gesamten Kette auf 127.0.0.1 zusammen (Befund aus sicherheit-test.mjs). */
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
   `erneutAnfordern` eine neue Outbox-Zeile auslösen (neuer Zufallszug) — bis
   zu drei Versuche, statt einmal lange zu warten. */
async function linkAusMail(email, seitMs = null, erneutAnfordern = null) {
  const VERSUCHE = 3;
  let letzterFehler;
  for (let versuch = 1; versuch <= VERSUCHE; versuch++) {
    try {
      const mail = await MAILQUELLE.warte(email, seitMs, 20_000);
      if (!mail) throw new Error(`Keine Mail für ${email} über Mailquelle "${MAILQUELLE.name}" gefunden (Versuch ${versuch}/${VERSUCHE})`);
      const treffer = mail.text.match(/https?:\/\/\S+/);
      if (!treffer) throw new Error(`Keine URL in der Mail an ${email} gefunden`);
      return treffer[0];
    } catch (e) {
      letzterFehler = e;
      if (versuch < VERSUCHE && erneutAnfordern) { seitMs = Date.now(); await erneutAnfordern().catch(() => {}); }
    }
  }
  throw letzterFehler;
}
async function bestaetigeMail(email, seitMs = null) {
  const url = await linkAusMail(email, seitMs, () => fetch(BASIS + "/api/auth/send-verification-email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASIS, "x-forwarded-for": mailAdresseFuer(email) },
    body: JSON.stringify({ email, callbackURL: "/" })
  }));
  const res = await fetch(url, { redirect: "manual", headers: { "x-forwarded-for": mailAdresseFuer(email) } });
  return res.status;
}

/* ---------- Registrieren / Anmelden ---------- */
async function registrieren(email, passwort, name, xffTag, zusatz) {
  return post("/api/auth/sign-up/email", { origin: BASIS, xffTag, body: { email, password: passwort, name, ...(zusatz || {}) } });
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

/* ---------- Aufräumen ---------- */
const eigeneEmails = [];
async function aufraeumen() {
  try {
    if (!eigeneEmails.length) return;
    const zeilen = await sql`SELECT id FROM app_user WHERE email = ANY(${eigeneEmails})`;
    const ids = zeilen.map(z => z.id);
    if (ids.length) {
      await sql`DELETE FROM auth_session WHERE user_id = ANY(${ids})`;
      await sql`DELETE FROM auth_account WHERE user_id = ANY(${ids})`;
    }
    const z2 = await sql`DELETE FROM app_user WHERE email = ANY(${eigeneEmails}) RETURNING id`;
    console.log(`Aufgeräumt: ${z2.length} Testkonten gelöscht (Präfix ah+).`);
  } catch (e) {
    console.error("Aufräumen fehlgeschlagen:", e.message || e);
  }
}

const START = Date.now();
console.log(`Basis: ${BASIS}  —  Auth-Härtung startet (TS=${TS})`);

let A, B;
const EMAIL_A = testadresse("ah-a", TS);
const EMAIL_UNVERIFIED = testadresse("ah-unverified", TS);
eigeneEmails.push(EMAIL_A, EMAIL_UNVERIFIED);

try {
  /* ============================================================
     1. REGISTRIERUNG
     ============================================================ */
  await schritt("1.1", "Registrierung — Erfolg (200, kein Autosign-in, siehe autoSignIn:false)", async () => {
    A = await personAnlegen(EMAIL_A, "a-auth", "Person A (Auth-Härtung)");
    return `id=${A.id}`;
  });

  await schritt("1.2", "Registrierung mit vergebener Adresse — gleiche Antwortform wie Erfolg (kein Enumerationsleck)", async () => {
    /* server/auth.ts: autoSignIn:false → shouldReturnGenericDuplicateResponse
       ist wahr (better-auth/dist/api/routes/sign-up.mjs) — eine bereits
       vergebene Adresse bekommt eine SYNTHETISCHE 200-Antwort mit
       token:null, kein Fehler, keine zweite DB-Zeile. */
    const [{ count: vor }] = await sql`SELECT count(*)::int AS count FROM app_user WHERE email = ${EMAIL_A}`;
    const r = await registrieren(EMAIL_A, "ein-anderes-Passwort-99", "Dup A", "dup-signup");
    assertGleich(r.status, 200, "status (synthetische Antwort erwartet)");
    assertTrue(r.json && r.json.token === null, "token sollte null sein (kein Autosign-in, keine echte Sitzung)");
    const [{ count: nach }] = await sql`SELECT count(*)::int AS count FROM app_user WHERE email = ${EMAIL_A}`;
    assertGleich(nach, vor, "keine zweite app_user-Zeile für dieselbe Adresse");
    const nochGueltig = await anmelden(EMAIL_A, PASSWORT, "a-auth");
    assertGleich(nochGueltig.status, 200, "ursprüngliches Passwort funktioniert weiterhin");
    return `status=${r.status}, token=null, Konten=${nach}, ursprüngliches Passwort weiterhin gültig`;
  });

  /* ============================================================
     2. LOGIN
     ============================================================ */
  await schritt("2.1", "Login mit falschem Passwort → 401, generische Meldung", async () => {
    const r = await anmelden(EMAIL_A, "definitiv-falsches-Passwort-1", "b2-auth");
    assertGleich(r.status, 401, "status");
    return `status=${r.status}, code=${r.json?.code}`;
  });

  await schritt("2.2", "Login mit unbekannter Adresse — gleicher Status/Code wie falsches Passwort (Aufzählungsschutz)", async () => {
    const unbekannt = await anmelden(`ah-kein-konto-${TS}@example.com`, "irgendein-Passwort-1", "b2-auth");
    const falsch = await anmelden(EMAIL_A, "noch-ein-falsches-Passwort", "b2-auth");
    assertGleich(unbekannt.status, falsch.status, "Statuscode");
    assertGleich(unbekannt.json?.code, falsch.json?.code, "Fehlercode (INVALID_EMAIL_OR_PASSWORD erwartet für beide)");
    return `status=${unbekannt.status} für beide, code=${unbekannt.json?.code}`;
  });

  await schritt("2.3", "Login mit unbestätigter Adresse — erlaubt (requireEmailVerification:false, §16: Einreichen prüft das, nicht die Anmeldung)", async () => {
    const su = await registrieren(EMAIL_UNVERIFIED, PASSWORT, "Unbestätigt", "unv-signup");
    assertGleich(su.status, 200, "sign-up");
    const si = await anmelden(EMAIL_UNVERIFIED, PASSWORT, "unv-auth");
    assertGleich(si.status, 200, "sign-in trotz unbestätigter Adresse");
    const [row] = await sql`SELECT email_verified FROM app_user WHERE email = ${EMAIL_UNVERIFIED}`;
    assertGleich(row.email_verified, false, "email_verified sollte in der DB noch false sein");
    return `sign-in=${si.status}, email_verified=false — dokumentiertes Verhalten, kein Fund`;
  });

  /* ============================================================
     3. LOGOUT
     ============================================================ */
  let logoutCookie;
  await schritt("3.1", "Logout — 200", async () => {
    const frisch = await anmelden(EMAIL_A, PASSWORT, "a-auth");
    assertGleich(frisch.status, 200, "erneute Anmeldung vor Logout");
    logoutCookie = frisch.cookie;
    const r = await post("/api/auth/sign-out", { origin: BASIS, cookie: logoutCookie, body: {} });
    assertGleich(r.status, 200, "status");
    return `status=${r.status}`;
  });
  await schritt("3.2", "Nach Logout: dasselbe Cookie an /api/entwuerfe → 401", async () => {
    const r = await get("/api/entwuerfe", { cookie: logoutCookie });
    assertGleich(r.status, 401, "status");
    return `status=${r.status}`;
  });

  /* ============================================================
     4. SITZUNGSABLAUF
     ============================================================ */
  await schritt("4", "expires_at auf die Vergangenheit gesetzt → Cookie liefert danach 401", async () => {
    const frisch = await anmelden(EMAIL_A, PASSWORT, "a-auth");
    assertGleich(frisch.status, 200, "anmelden");
    const token = tokenAusCookie(frisch.cookie);
    const upd = await sql`UPDATE auth_session SET expires_at = now() - interval '1 day' WHERE token = ${token} RETURNING id`;
    assertGleich(upd.length, 1, "genau eine auth_session-Zeile aktualisiert");
    const r = await get("/api/entwuerfe", { cookie: frisch.cookie });
    assertGleich(r.status, 401, "status nach abgelaufener Sitzung");
    return `expires_at in Vergangenheit gesetzt, danach=${r.status}`;
  });

  /* ============================================================
     5. SITZUNGSWIDERRUF (zwei Geräte, eines widerruft das andere)
     ============================================================ */
  let geraetA, geraetB;
  await schritt("5.1", "Zwei Sitzungen derselben Person parallel anmelden (zwei 'Geräte')", async () => {
    const g1 = await anmelden(EMAIL_A, PASSWORT, "a-auth");
    const g2 = await anmelden(EMAIL_A, PASSWORT, "a-auth");
    assertGleich(g1.status, 200, "gerät A anmelden");
    assertGleich(g2.status, 200, "gerät B anmelden");
    assertTrue(g1.cookie !== g2.cookie, "beide Geräte sollten unterschiedliche Sitzungscookies bekommen");
    geraetA = g1; geraetB = g2;
    const beide = await Promise.all([
      get("/api/entwuerfe", { cookie: geraetA.cookie }),
      get("/api/entwuerfe", { cookie: geraetB.cookie })
    ]);
    assertGleich(beide[0].status, 200, "gerät A funktioniert");
    assertGleich(beide[1].status, 200, "gerät B funktioniert");
    return "beide Geräte gleichzeitig gültig (200)";
  });

  await schritt("5.2", "Gerät B widerruft Gerät A über POST /api/auth/revoke-session", async () => {
    const tokenA = tokenAusCookie(geraetA.cookie);
    const r = await post("/api/auth/revoke-session", { origin: BASIS, cookie: geraetB.cookie, body: { token: tokenA } });
    assertGleich(r.status, 200, "status");
    return `status=${r.status}`;
  });
  await schritt("5.3", "Gerät A danach → 401, Gerät B weiterhin → 200", async () => {
    const rA = await get("/api/entwuerfe", { cookie: geraetA.cookie });
    const rB = await get("/api/entwuerfe", { cookie: geraetB.cookie });
    assertGleich(rA.status, 401, "gerät A nach Widerruf");
    assertGleich(rB.status, 200, "gerät B nach Widerruf von A");
    return `A=${rA.status}, B=${rB.status}`;
  });

  /* ============================================================
     6. PASSWORT-ZURÜCKSETZEN
     (Endpunkt heisst in dieser better-auth-Version /request-password-reset,
     nicht /forget-password — siehe node_modules/better-auth/dist/api/routes/password.mjs) */
  /* ============================================================ */
  const ALTES_PASSWORT = PASSWORT;
  const NEUES_PASSWORT = "Neu-" + randomBytes(12).toString("base64url");
  let resetUrl, resetToken;
  await schritt("6.1", "request-password-reset für A → 200, generische Meldung", async () => {
    const seit = Date.now();
    const r = await post("/api/auth/request-password-reset", { origin: BASIS, xffTag: "reset-req", body: { email: EMAIL_A, redirectTo: "/" } });
    assertGleich(r.status, 200, "status");
    resetUrl = await linkAusMail(EMAIL_A, seit, () => post("/api/auth/request-password-reset", { origin: BASIS, xffTag: "reset-req", body: { email: EMAIL_A, redirectTo: "/" } }));
    const u = new URL(resetUrl);
    resetToken = u.pathname.split("/").pop();
    assertTrue(!!resetToken, "kein Token aus der Reset-URL extrahiert");
    return `status=${r.status}, token erhalten (${resetToken.length} Zeichen)`;
  });
  await schritt("6.2", "Reset-Link abrufen (GET, better-auth leitet mit ?token= weiter)", async () => {
    const r = await fetch(resetUrl, { redirect: "manual", headers: { "x-forwarded-for": mailAdresseFuer(EMAIL_A) } });
    assertGleich(r.status, 302, "status");
    const ziel = r.headers.get("location") || "";
    assertTrue(ziel.includes(`token=${resetToken}`), "Weiterleitung enthält nicht den Token");
    return `status=${r.status}, Ziel enthält token`;
  });
  await schritt("6.3", "POST /api/auth/reset-password mit neuem Passwort → 200", async () => {
    const r = await post("/api/auth/reset-password", { origin: BASIS, xffTag: "reset-do", body: { token: resetToken, newPassword: NEUES_PASSWORT } });
    assertGleich(r.status, 200, "status");
    return `status=${r.status}`;
  });
  await schritt("6.4", "Altes Passwort danach ungültig, neues Passwort gültig", async () => {
    const mitAlt = await anmelden(EMAIL_A, ALTES_PASSWORT, "reset-check");
    assertGleich(mitAlt.status, 401, "altes Passwort sollte nicht mehr funktionieren");
    const mitNeu = await anmelden(EMAIL_A, NEUES_PASSWORT, "reset-check");
    assertGleich(mitNeu.status, 200, "neues Passwort sollte funktionieren");
    return `altes=${mitAlt.status}, neues=${mitNeu.status}`;
  });
  await schritt("6.5", "revokeSessionsOnPasswordReset: alle vorherigen Sitzungen (Gerät B) sind nach dem Reset ungültig", async () => {
    const r = await get("/api/entwuerfe", { cookie: geraetB.cookie });
    assertGleich(r.status, 401, "gerät B sollte nach dem Passwort-Reset ungültig sein");
    return `status=${r.status}`;
  });
  await schritt("6.6", "Denselben Reset-Token erneut verwenden → 4xx (einmal verbraucht, consumeVerificationValue)", async () => {
    const r = await post("/api/auth/reset-password", { origin: BASIS, xffTag: "reset-reuse", body: { token: resetToken, newPassword: "Noch-ein-Passwort-1" } });
    assertTrue(r.status >= 400 && r.status < 500, `erwartet 4xx, erhalten ${r.status}`);
    return `status=${r.status}`;
  });
  await schritt("6.7", "Abgelaufener/gefälschter Token → 4xx, nie 500", async () => {
    const gefaelscht = await post("/api/auth/reset-password", { origin: BASIS, xffTag: "reset-forged", body: { token: "gefaelschter-token-" + randomBytes(8).toString("hex"), newPassword: "Noch-ein-Passwort-2" } });
    assertTrue(gefaelscht.status >= 400 && gefaelscht.status < 500, `erwartet 4xx, erhalten ${gefaelscht.status}`);
    return `status=${gefaelscht.status}`;
  });

  /* ============================================================
     7. VERIFIKATION
     ============================================================ */
  await schritt("7.1", "Login vor Bestätigung — bereits in 2.3 dokumentiert: erlaubt, keine Wiederholung nötig", async () => "siehe 2.3");
  await schritt("7.2", "Bestätigungslink zweimal aufrufen — zweites Mal harmlos (kein Fehler, kein doppelter Effekt)", async () => {
    const EMAIL_DBL = testadresse("ah-doppelt", TS);
    eigeneEmails.push(EMAIL_DBL);
    const seit = Date.now();
    const su = await registrieren(EMAIL_DBL, PASSWORT, "Doppelt", "dbl-signup");
    assertGleich(su.status, 200, "sign-up");
    const url = await linkAusMail(EMAIL_DBL, seit);
    const erstesMal = await fetch(url, { redirect: "manual", headers: { "x-forwarded-for": mailAdresseFuer(EMAIL_DBL) } });
    const zweitesMal = await fetch(url, { redirect: "manual", headers: { "x-forwarded-for": mailAdresseFuer(EMAIL_DBL) } });
    assertTrue(erstesMal.status < 500 && zweitesMal.status < 500, `kein 5xx (erstes=${erstesMal.status}, zweites=${zweitesMal.status})`);
    const [row] = await sql`SELECT email_verified FROM app_user WHERE email = ${EMAIL_DBL}`;
    assertGleich(row.email_verified, true, "Adresse sollte nach dem ersten Aufruf bestätigt sein");
    return `erstes=${erstesMal.status}, zweites=${zweitesMal.status}, email_verified=true`;
  });

  /* ============================================================
     8. MEHRERE SITZUNGEN PARALLEL (zwei neue Geräte, unabhängig von 5.)
     ============================================================ */
  await schritt("8", "Zwei neue, unabhängige Sitzungen (Geräte) gleichzeitig gültig", async () => {
    const g1 = await anmelden(EMAIL_A, NEUES_PASSWORT, "par-auth");
    const g2 = await anmelden(EMAIL_A, NEUES_PASSWORT, "par-auth");
    assertGleich(g1.status, 200, "gerät 1");
    assertGleich(g2.status, 200, "gerät 2");
    const [r1, r2] = await Promise.all([get("/api/entwuerfe", { cookie: g1.cookie }), get("/api/entwuerfe", { cookie: g2.cookie })]);
    assertGleich(r1.status, 200, "gerät 1 gültig");
    assertGleich(r2.status, 200, "gerät 2 gültig");
    return "beide neuen Geräte gleichzeitig gültig";
  });

  /* ============================================================
     9. STALE COOKIE (Cookie einer gelöschten Sitzung)
     ============================================================ */
  await schritt("9", "Sitzung direkt aus auth_session gelöscht (nicht über sign-out) → Cookie liefert 401", async () => {
    const frisch = await anmelden(EMAIL_A, NEUES_PASSWORT, "stale-auth");
    assertGleich(frisch.status, 200, "anmelden");
    const token = tokenAusCookie(frisch.cookie);
    const del = await sql`DELETE FROM auth_session WHERE token = ${token} RETURNING id`;
    assertGleich(del.length, 1, "genau eine auth_session-Zeile gelöscht");
    const r = await get("/api/entwuerfe", { cookie: frisch.cookie });
    assertGleich(r.status, 401, "status mit veraltetem Cookie");
    return `status=${r.status}`;
  });

  /* ============================================================
     10. MALFORMED COOKIE — nie 500
     ============================================================ */
  await schritt("10.1", "Zufällige Zeichen als Cookie-Wert → 401, kein 500", async () => {
    const r = await get("/api/entwuerfe", { cookie: `fw.session_token=${randomBytes(24).toString("hex")}` });
    assertTrue(r.status === 401, `erwartet 401, erhalten ${r.status}`);
    return `status=${r.status}`;
  });
  await schritt("10.2", "Überlanger Cookie-Wert (50 000 Zeichen) → kein 500", async () => {
    const r = await get("/api/entwuerfe", { cookie: `fw.session_token=${"a".repeat(50_000)}` });
    assertTrue(r.status < 500, `erwartet <500, erhalten ${r.status}`);
    return `status=${r.status}`;
  });
  await schritt("10.3", "Gültiger Token, manipulierte Signatur → 401, kein 500", async () => {
    const frisch = await anmelden(EMAIL_A, NEUES_PASSWORT, "sig-auth");
    assertGleich(frisch.status, 200, "anmelden");
    const roh = decodeURIComponent(frisch.cookie.split("=").slice(1).join("="));
    const [tok] = roh.split(".");
    const manipuliert = `fw.session_token=${encodeURIComponent(tok + ".manipulierteSignaturXXXXXXXXXXXXXXXXXXXXXX")}`;
    const r = await get("/api/entwuerfe", { cookie: manipuliert });
    assertTrue(r.status === 401, `erwartet 401, erhalten ${r.status}`);
    return `status=${r.status}`;
  });

  /* ============================================================
     11. CSRF/HERKUNFT
     Global über alle better-auth-Pfade (originCheckMiddleware, siehe
     node_modules/better-auth/dist/api/index.mjs: routerMiddleware "/**"):
     Ohne Cookie wird die Herkunft bei POST NICHT erzwungen (progressive
     enhancement für reine API-Clients) — mit Cookie IMMER (useCookies=true
     in validateOrigin). sign-out braucht ein Cookie, ist also der
     aussagekräftige Testfall. GET bleibt unter allen Umständen unbeeinflusst. */
  /* ============================================================ */
  await schritt("11.1", "POST /api/auth/sign-out MIT Cookie, OHNE Origin/Referer → 403 (MISSING_OR_NULL_ORIGIN)", async () => {
    const frisch = await anmelden(EMAIL_A, NEUES_PASSWORT, "csrf-auth");
    assertGleich(frisch.status, 200, "anmelden");
    const r = await post("/api/auth/sign-out", { cookie: frisch.cookie, body: {} }); // kein origin gesetzt
    assertGleich(r.status, 403, "status");
    return `status=${r.status}`;
  });
  await schritt("11.2", "POST /api/auth/sign-out MIT Cookie, fremde Origin → 403 (INVALID_ORIGIN)", async () => {
    const frisch = await anmelden(EMAIL_A, NEUES_PASSWORT, "csrf-auth");
    assertGleich(frisch.status, 200, "anmelden");
    const r = await post("/api/auth/sign-out", { origin: "https://boese.example", cookie: frisch.cookie, body: {} });
    assertGleich(r.status, 403, "status");
    /* Die Sitzung darf durch den blockierten Versuch nicht ungültig geworden sein. */
    const danach = await get("/api/entwuerfe", { cookie: frisch.cookie });
    assertGleich(danach.status, 200, "sitzung bleibt nach blockiertem CSRF-Versuch gültig");
    return `sign-out(fremd)=${r.status}, sitzung danach weiterhin gültig`;
  });
  await schritt("11.3", "POST /api/auth/sign-out MIT Cookie, korrekte Origin → 200", async () => {
    const frisch = await anmelden(EMAIL_A, NEUES_PASSWORT, "csrf-auth");
    assertGleich(frisch.status, 200, "anmelden");
    const r = await post("/api/auth/sign-out", { origin: BASIS, cookie: frisch.cookie, body: {} });
    assertGleich(r.status, 200, "status");
    return `status=${r.status}`;
  });
  await schritt("11.4", "GET /api/auth/get-session bleibt von Origin/Referer unbeeinflusst (fremde Origin ändert nichts an GET)", async () => {
    const frisch = await anmelden(EMAIL_A, NEUES_PASSWORT, "csrf-auth");
    assertGleich(frisch.status, 200, "anmelden");
    const r = await get("/api/auth/get-session", { cookie: frisch.cookie, origin: "https://boese.example" });
    assertGleich(r.status, 200, "GET mit fremder Origin sollte trotzdem funktionieren");
    return `status=${r.status}`;
  });
  await schritt("11.5", "POST /api/auth/sign-up/email OHNE Cookie, fremde Origin → 403 (formCsrfMiddleware validiert Origin, sobald sie gesetzt ist)", async () => {
    const email = testadresse("ah-csrf-signup", TS);
    const r = await post("/api/auth/sign-up/email", { origin: "https://boese.example", xffTag: "csrf-signup", body: { email, password: PASSWORT, name: "CSRF" } });
    assertGleich(r.status, 403, "status");
    const [row] = await sql`SELECT id FROM app_user WHERE email = ${email}`;
    assertTrue(!row, "trotz 403 wurde ein Konto angelegt");
    return `status=${r.status}, kein Konto angelegt`;
  });

  /* ============================================================
     12. RATENBEGRENZUNG
     ============================================================ */
  await schritt("12.1", "Login: 8 Versuche in 5 Minuten erlaubt, 9. → 429 (server/auth.ts: /sign-in/email max 8/300s)", async () => {
    const ip = `10.201.${RUNSEED}.90`;
    let letzter;
    for (let i = 1; i <= 9; i++) {
      letzter = await api("POST", "/api/auth/sign-in/email", { origin: BASIS, ip, body: { email: EMAIL_A, password: "immer-falsch-" + i } });
      if (i < 9) assertTrue(letzter.status === 401, `versuch ${i}: erwartet 401, erhalten ${letzter.status}`);
    }
    assertGleich(letzter.status, 429, "9. Versuch sollte 429 sein");
    return `9. Versuch → ${letzter.status}`;
  });
  await schritt("12.2", "Sign-up: 5 Registrierungen in einer Stunde erlaubt, 6. → 429 (server/auth.ts: /sign-up/email max 5/3600s)", async () => {
    const ip = `10.201.${RUNSEED}.91`;
    let letzter;
    for (let i = 1; i <= 6; i++) {
      const email = testadresse(`ah-ratesu-${i}`, TS);
      if (i <= 6) eigeneEmails.push(email);
      letzter = await api("POST", "/api/auth/sign-up/email", { origin: BASIS, ip, body: { email, password: PASSWORT, name: "Ratenlimit" } });
      if (i < 6) assertTrue(letzter.status === 200, `versuch ${i}: erwartet 200, erhalten ${letzter.status}`);
    }
    assertGleich(letzter.status, 429, "6. Versuch sollte 429 sein");
    return `6. Versuch → ${letzter.status}`;
  });

  /* ============================================================
     13. KONTO-AUFZÄHLUNG ÜBER PASSWORT-RESET
     ============================================================ */
  await schritt("13", "request-password-reset: bekannte vs. unbekannte Adresse — identischer Status/Body, ähnliche Antwortzeit, Mail nur bei bekannter Adresse", async () => {
    const unbekannteAdresse = `ah-kein-konto-reset-${TS}@example.com`;
    const t0 = Date.now();
    const bekannt = await post("/api/auth/request-password-reset", { origin: BASIS, xffTag: "enum-reset", body: { email: EMAIL_A, redirectTo: "/" } });
    const t1 = Date.now();
    const unbekannt = await post("/api/auth/request-password-reset", { origin: BASIS, xffTag: "enum-reset", body: { email: unbekannteAdresse, redirectTo: "/" } });
    const t2 = Date.now();
    assertGleich(bekannt.status, unbekannt.status, "Statuscode");
    assertGleich(bekannt.json?.message, unbekannt.json?.message, "Meldung");
    const dauerBekannt = t1 - t0, dauerUnbekannt = t2 - t1;
    const differenzMs = Math.abs(dauerBekannt - dauerUnbekannt);
    /* Beide Zweige machen serverseitig vergleichbare Arbeit (DB-Lookup +
       simulierter bzw. echter zweiter DB-Zugriff, siehe password.mjs) —
       eine grobe Toleranz genügt, um eine grobe Zeit-Aufzählung auszuschliessen. */
    const keineMail = await MAILQUELLE.neueste(unbekannteAdresse, t0);
    assertTrue(!keineMail, "für die unbekannte Adresse wurde trotzdem eine Mail gefunden");
    return `status=${bekannt.status} für beide, Δt=${differenzMs}ms (bekannt=${dauerBekannt}ms, unbekannt=${dauerUnbekannt}ms), keine Mail an unbekannte Adresse`;
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
  const w1 = 6;
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
const berichtPfad = join(APP_ROOT, "var", "auth-haertung-bericht.json");
await import("node:fs/promises").then(fs => fs.writeFile(berichtPfad, JSON.stringify(bericht, null, 2)));
console.log(`Bericht geschrieben: ${berichtPfad}`);

process.exit(fehlerAnzahl > 0 ? 1 : 0);
