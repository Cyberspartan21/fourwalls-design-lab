# FOURWALLS — Betriebsgrenzen (P5.10 §15–§18, §21, §22, §42)

Was diese Anwendung heute an Kopfzeilen, Fehlerbehandlung, 404-Verhalten,
Mail-Zuverlässigkeit, Ratenbegrenzung und Beobachtbarkeit tatsächlich tut —
und wo genau die Grenze der heutigen, einzelinstanz-tauglichen Fassung
liegt. Kein Werkzeug wird hier gebaut; wo eine Grenze eine Entscheidung für
den Produktions-Anlauf braucht, steht das ausdrücklich so da.

Betriebliche SOFORT-Massnahmen (Ausfälle, Rückstau, Rollback) stehen im
bestehenden `docs/RUNBOOK-INCIDENT.md` — dieses Dokument dupliziert sie
nicht, sondern verweist darauf und ergänzt, was dort fehlt.

## 1. Sicherheitsköpfe (§15/§16)

### 1.1 Inventar — wer setzt was

| Kopf | Quelle | Umgebung |
|---|---|---|
| `Content-Security-Policy` | `lib/sicherheitskoepfe.ts` → `csp()`, gesetzt in `proxy.ts` | alle, Inhalt hängt von `S3_PUBLIC_BASE_URL`/`APP_ENV` ab |
| `Strict-Transport-Security` | `lib/sicherheitskoepfe.ts` → `hsts()`, gesetzt in `proxy.ts` | nur `staging`/`production` |
| `X-Content-Type-Options: nosniff` | `next.config.ts` | alle |
| `X-Frame-Options: DENY` | `next.config.ts` — Rückfall für Browser ohne `frame-ancestors` | alle |
| `Referrer-Policy: strict-origin-when-cross-origin` | `next.config.ts` | alle |
| `Permissions-Policy` | `next.config.ts` | alle |
| `Cross-Origin-Opener-Policy: same-origin` | `next.config.ts` | alle |
| `x-robots-tag: noindex, nofollow, noarchive` | `proxy.ts` | nur `staging` |

Geprüft mit `scripts/header-test.mjs <Basis>` auf `/de`, `/api/health`, einer
echten Objektseite, der Kartenseite (`?ansicht=karte`) und einem statischen
Asset (`/fonts/petrona-latin-wght-normal.woff2`) — Karten und Schriften
brechen dabei nicht, weil beide seit P5.9 Entscheid 23 selbst gehostet sind
(`'self'` genügt für `font-src`, MapLibre-Kacheln laufen über `img-src`/
`connect-src` explizit auf `*.geo.admin.ch`/`tiles.openfreemap.org`).

### 1.2 In dieser Runde ergänzt

- `Permissions-Policy` fehlten `payment=()` und `usb=()` — ergänzt
  (`next.config.ts`).
- `Content-Security-Policy` bekam `upgrade-insecure-requests`, aber NUR bei
  `APP_ENV=production` (`lib/sicherheitskoepfe.ts`) — in der Entwicklung
  (`http://localhost`) würde die Anweisung den eigenen Server auf https
  umzuschreiben versuchen, was dort falsch wäre.

Vorher/nachher der CSP (Entwicklung, `APP_ENV` unbesetzt):

```
vorher:  default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
         font-src 'self'; img-src 'self' data: blob: https://*.geo.admin.ch https://tiles.openfreemap.org;
         connect-src 'self' https://*.geo.admin.ch https://tiles.openfreemap.org; worker-src 'self' blob:;
         frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'

nachher: (unverändert in der Entwicklung — upgrade-insecure-requests kommt nur in production hinzu)
```

### 1.3 CSP-Entscheid: Nonces NICHT eingeführt

Next 16 unterstützt Nonce-basierte CSP über `proxy.ts` (Nonce erzeugen, in
den `Content-Security-Policy`-Header UND `x-nonce` schreiben; Next hängt ihn
zur Serverzeit automatisch an eigene Skripte). Geprüft in
`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`:
die Dokumentation selbst nennt die Voraussetzung — **alle Seiten müssen
dynamisch gerendert werden**, statische Optimierung, ISR und PPR sind mit
Nonce-CSP unvereinbar (ein Nonce entsteht erst pro Anfrage).

Diese Anwendung ist auf das Gegenteil gebaut: die öffentlichen Marktplatz-
und Objektseiten sind für Suchmaschinen und schnelle Auslieferung als
statischer/cachefähiger Inhalt ausgelegt (P5.9-Phase B, SEO-Suite mit 71
geprüften Schritten). Nonces einzuführen hiesse, diese Seiten auf
dynamisches Rendern umzustellen — eine Architekturentscheidung mit Leistungs-
und SEO-Folgen weit über Kopfzeilen hinaus, keine reine Härtung einer
bestehenden Sicherheitsmassnahme. **Entscheid: `'unsafe-inline'` bleibt in
`script-src`**, mit dieser Begründung im Quelltext (`lib/sicherheitskoepfe.ts`)
und hier dokumentiert, statt stillschweigend belassen.

`style-src 'unsafe-inline'` bleibt aus einem eigenen, unabhängigen Grund:
`style={{...}}` in JSX erzeugt ein HTML-**Style-Attribut**, kein
`<style>`-Element. CSP Level 3 kennt dafür `style-src-attr` getrennt von
`style-src-elem`; ist `style-src-attr` nicht gesetzt, fällt es auf
`style-src` zurück, und ein Nonce wirkt ohnehin nur auf `<style nonce>`, nie
auf `style="…"`. Diese Anwendung nutzt `style="…"` durchgehend (berechnete
Kartenfarben, Layout-Feinheiten in vielen Komponenten) — ohne
`'unsafe-inline'` bräche das grossflächig, unabhängig von der
Nonce-Entscheidung oben.

**Beleg per CDP** (eigener, headless Chrome mit `--use-angle=swiftshader`
für Software-WebGL, Port 9611–9614, Profile `/tmp/fw-h5-<port>`, danach
beendet): Kartenseite (`/de/immobilien/mieten?ansicht=karte`) und eine echte
Objektseite (`/de/immobilien/mieten/wohnung-baden-3-fwl-2026-101177`) —
`document.querySelectorAll('canvas').length === 1` auf beiden (MapLibre
rendert), **keine** `Refused to`-Meldung in der Konsole auf beiden Seiten,
Modus-Umschalter (`location.hash = 'dunkel'` — derselbe Mechanismus wie
`components/site/modus-script.tsx`) wechselt `document.body.dataset.mode`
zuverlässig, ein echtes `fetch('/api/inquiries', …)` aus der Seite heraus
liefert `201 {"angenommen":true,…}` (die Test-Anfrage wurde danach aus
`inquiry`/`mail_outbox`/`var/mail` wieder entfernt).

Einzige Konsolenmeldung auf beiden Seiten (kein CSP-`Refused to`, keine
Funktionsstörung): React selbst meldet im Entwicklungsmodus `eval() is not
supported … make sure 'unsafe-eval' is included` — React nutzt `eval()`
NUR in der Entwicklung, um Stack-Traces über Umgebungsgrenzen hinweg
lesbar zu machen (siehe node_modules-Doku, Abschnitt „Development
Environment“ oben). Das ist die von Next selbst dokumentierte Nebenwirkung
einer CSP ohne `'unsafe-eval'` in der Entwicklung — betrifft nur die
Lesbarkeit von Fehlermeldungen im Entwicklungsmodus, nicht Produktion
(„React will never use eval() in production mode“) und nicht die geprüfte
Funktion (Karte rendert trotzdem, Formular sendet trotzdem). Kein
Handlungsbedarf, hier nur dokumentiert, damit es beim nächsten Blick in die
Entwicklungskonsole nicht als neuer Befund missverstanden wird.

### 1.4 Cookies (Better Auth)

`server/auth.ts` (`advanced`): `cookiePrefix: "fw"`, `useSecureCookies:
istProduktion()`, `httpOnly: true`, `sameSite: "lax"`, `path: "/"`. Better
Auth setzt bei sicheren Cookies automatisch den `__Secure-`-Vorsatz
(`node_modules/better-auth/dist/cookies/index.mjs`: `secureCookiePrefix =
SECURE_COOKIE_PREFIX` = `"__Secure-"`, sobald `useSecureCookies` oder https
erkannt wird) — in Produktion heissen die Cookies also z. B.
`__Secure-fw.session_token`.

**`__Host-` geprüft, NICHT risikolos möglich mit der heutigen Konfigurations-
fläche:** Better Auth kennt in dieser Version nur den automatischen
`__Secure-`-Vorsatz; es gibt keine Option, stattdessen `__Host-` zu wählen.
Der einzige Weg wäre, den Cookienamen über `advanced.cookies.<name>.name`
selbst mit `"__Host-…"` zu überschreiben — das würde aber mit der
automatischen `secureCookiePrefix`-Ergänzung kollidieren
(`"__Secure-__Host-fw.session_token"`, ungültig) und bräuchte einen Eingriff
in die Bibliothek selbst, nicht nur Konfiguration. Damit nicht risikolos im
Sinn dieser Härtungsrunde — bleibt bei `__Secure-`. `__Secure-` verlangt
bereits `Secure`; der praktische Unterschied zu `__Host-` (zusätzlich: kein
`Domain`-Attribut, `Path=/`) ist hier ohnehin gering, weil
`crossSubDomainCookies` nicht aktiviert ist und kein `Domain`-Attribut
gesetzt wird.

## 2. Fehlerbehandlung (§17)

`lib/errors.ts`/`lib/route-schutz.ts` (`fehlerAntwort`): 5xx-Antworten
enthalten nie `message`/Stack/SQL/Pfade. Neu in dieser Runde: jeder
`AppError` trägt eine kurze Korrelations-`ref` (`crypto.randomUUID()`,
gekürzt); bei `INTERNAL` steht sie in der Antwort UND im Protokolleintrag
(`fehlerAntwort()` loggt `{ref: err.ref}` mit demselben Wert) — die Form für
`INTERNAL` ist jetzt verschachtelt: `{"error":{"code":"INTERNAL","message":
"Interner Fehler","ref":"…"}}`. Alle anderen Codes (`VALIDATION`,
`UNAUTHORIZED`, `NOT_FOUND`, …) bleiben in der bestehenden, flachen Form
(`{"error":"VALIDATION","message":"…","fields":{...}}`) — das ist die Form,
die praktisch der gesamte Rest der Anwendung (Formulare, `assistent.tsx`,
`team.tsx`, …) heute schon konsumiert; sie umzustellen wäre eine
API-Vertragsänderung weit über diese Härtungsrunde hinaus und war nicht
verlangt (§17 nennt die verschachtelte Form ausdrücklich nur für den
INTERNAL-Fall).

Simulationen: `tests/fehler.test.ts` (DB-Fehlerobjekt mit `query`/
`parameters`, echter S3-Verbindungsfehler mit Endpunkt im Fehlertext,
Auth-ähnliches Fehlerobjekt, Formular-Validierung) und
`scripts/fehler-test.mjs <Basis>` (HTTP-seitig: fehlerhaftes JSON, unbekannte
API-Route, OPTIONS/HEAD, sehr langer Pfad, ungültige Sprache, ungültige
Ref-Formate — nie 500, nie `/Users/`, nie `node_modules`, nie `postgres` in
einer JSON-Fehlerantwort).

**Neu:** `app/api/[...pfad]/route.ts` — ein Auffangbecken für jeden
`/api/*`-Pfad, den keine andere Route bedient. Vorher lieferte ein solcher
Pfad die volle HTML-404-Seite (`app/global-not-found.tsx`) mit Status 404;
für einen API-Client ist das nicht sinnvoll (`scripts/fehler-test.mjs`
verlangt JSON). Next matcht literale Segmente immer vor diesem Catch-all,
bestehende Routen sind unberührt (geprüft: `/api/health`, `/api/ready`,
`/api/search`, `/api/orte` weiterhin 200).

`app/[locale]/error.tsx`: zeigt jetzt zusätzlich `error.digest` (Next fasst
Server-Component-Fehler zu einer generischen Meldung mit dieser Kennung
zusammen — dieselbe Rolle wie `ref`, nur vom Framework selbst vergeben) und
einen Link zur Startseite neben „Erneut versuchen“.

`app/global-error.tsx` (neu): Fehler im Wurzel-Layout selbst — dort greift
`app/[locale]/error.tsx` nicht, weil der Fehler das Layout betrifft, das ihn
umschliesst. Eigenes `<html>`/`<body>` mit denselben UFER-Stilen, wie bei
`app/global-not-found.tsx`, weil es an dieser Stelle kein anderes Layout
mehr gibt, das sie liefern könnte.

## 3. 404-Grenze (§18)

Drei Ebenen, unverändert seit P5.9, hier zusammengefasst (ausführlich:
Kopfkommentar `app/global-not-found.tsx`):

1. `proxy.ts` rewritet ein unbekanntes erstes Segment still auf `/de/<pfad>`
   — entscheidet NICHT über 404/200.
2. `app/global-not-found.tsx` — greift, wenn danach GAR KEINE Route matcht.
   Einzige Stelle mit serverseitig gerendertem Inhalt UND echtem
   404-Status für einen wirklich unbekannten Pfad. Eigenes `<html>`/`<body>`,
   hartcodiert Deutsch (keine dynamischen APIs verfügbar), mit Verweisen auf
   die drei anderen Sprachen.
3. `app/[locale]/not-found.tsx` — für Pfade, die in ein bekanntes
   dynamisches Segment fallen (`[bereich]/[art]`, `[slug]`, `anbieter/[slug]`,
   `wissen/[slug]`, …), dort aber `notFound()` auslösen (z. B. eine nicht
   existierende Inserate-Referenz).

**Grenze, die bleibt:** `notFound()` in einem dynamischen Segment rendert
über die React-Fehlergrenze — bei einer vollen Serveranfrage liefert Next
dafür korrekt Status 404; bei einer clientseitigen Navigation (Klick auf
einen internen Link) wechselt nur der Inhalt, ohne dass der Browser einen
neuen Statuscode "sieht" (das ist bei jeder App-Router-Navigation so, nicht
spezifisch für diese Anwendung). `app/[locale]/not-found.tsx` selbst zeigt
keine technischen Details (kein Pfad, keine Referenz im Text) und bietet
immer den Rückweg zur Startseite (`<a class="knopf" href="/${locale}">`).

## 4. Mail-Outbox (§21)

Architektur (`server/outbox.ts`, `db/migrations/0013_outbox.sql`):
`einreihen(tx, …)` schreibt in DERSELBEN Transaktion wie die fachliche
Änderung; `verarbeiten()` holt fällige Zeilen mit
`FOR UPDATE SKIP LOCKED` (mehrere Arbeiter dürfen gleichzeitig laufen, ohne
eine Nachricht doppelt zu verschicken), wiederholt bis zu vier Versuche
(`WARTEZEIT_MIN = [1, 5, 25]` Minuten), gibt danach mit `status='abandoned'`
auf — kein Endlosloop.

`tests/outbox.test.ts` (neu, gegen die echte Entwicklungsdatenbank, eigene
mit `ref_type='outbox-unittest'` markierte Wegwerfzeilen, im `after()`
aufgeräumt) belegt:

- Erfolg: `created` → `accepted`, `provider_id` gesetzt.
- Wiederholung mit Backoff: `attempts`/`next_attempt_at` folgen
  `WARTEZEIT_MIN`.
- Giftnachricht: nach vier Versuchen `abandoned`, danach von der
  Abhol-Bedingung (`status IN ('created','failed')`) für immer
  ausgeschlossen.
- Geschäftsaktion bleibt einmalig: eine fachliche Zeile entsteht genau
  einmal, unabhängig davon, wie oft der Versand scheitert.
- Neustart zwischen Persistieren und Senden: eine eingereihte Zeile bleibt
  bis zur nächsten Verarbeitung unverändert stehen (Haltbarkeit ist eine
  Postgres-Eigenschaft, keine des Anwendungsprozesses).
- Zwei gleichzeitige Arbeiter (zwei echte, parallele Verbindungen) bekommen
  nie dieselbe Zeile — Beleg für `FOR UPDATE SKIP LOCKED` über eine leere
  Schnittmenge der beiden beanspruchten Stapel.

`server/anliegen.ts`/`server/inquiries.ts` reihen jede Nachricht über
`einreihen(tx, …)` ein, rufen den Mailanbieter nie synchron auf — ein
Mailfehler kann die Annahme (`201`) darum architektonisch nicht blockieren
(geprüft am Quelltext in `tests/fehler.test.ts`, weil beide Module
`server-only` importieren und sich unter `node:test` nicht laden lassen).

Betriebs-Wiederherstellung (Rückstau ansehen, aufgegebene Zeilen erneut
einreihen): bereits vollständig in `docs/RUNBOOK-INCIDENT.md`, Abschnitt 3
("Mail-Rückstau") beschrieben — hier nicht dupliziert.

## 5. Ratenbegrenzung (§22)

### 5.1 Inventar

| Ort | Schlüssel | Fenster | Grenze | Speicher |
|---|---|---|---|---|
| `/api/inquiries` (Anfragen) | Herkunfts-Hash | 10 min | 5 | Prozess (`speicherLimiter`) |
| `/api/inquiries` je Inserat | `publicRef` | 60 min | 60 | Prozess |
| `/api/anliegen` | Herkunfts-Hash | 60 min | 5 | Prozess (`ratenPruefen`) |
| `/api/anliegen` (Mail-Ziel) | E-Mail-Hash | 24 h | 3 | Prozess |
| `/api/konto/export` | Personen-ID | 60 min | 3 | Prozess |
| `/api/konto/loeschen` | Personen-ID | 60 min | 8 | Prozess |
| `/api/einladungen/[token]` (lesen) | Herkunft | 60 min | 30 | Prozess |
| `/api/einladungen/[token]` (annehmen) | Personen-ID | 60 min | 10 | Prozess |
| `/api/medien` (Upload) | Personen-ID | 60 min | 80 | Prozess |
| `/api/entwuerfe/[ref]` (Autosave) | Personen-ID | 60 min | 600 | Prozess |
| `/api/entwuerfe` (neu) | Personen-ID | 60 min | 20 | Prozess |
| `/api/entwuerfe/[ref]/aktion` | Personen-ID | 60 min | 60 | Prozess |
| `/api/org` (anlegen) | Personen-ID | 60 min | 10 | Prozess |
| `/api/org/[slug]/*` (Profil/Team/Einladung/Rolle/Inserate/Import/Zuweisen) | Personen-ID | 60 min | 10–120 je Aktion | Prozess |
| `/api/favoriten*` | Personen-ID/Herkunft | 60 min | 10–120 | Prozess |
| `/api/vergleich` | Herkunft | 60 min | 60 | Prozess |
| `/api/suchabo*` | Personen-ID/Token | 60 min | 10–60 | Prozess |
| `/api/moderation/[ref]` | Personen-ID | 60 min | 300 | Prozess |
| Better Auth (global) | intern (IP/Session) | 60 s | 30 | Prozess (`storage: "memory"`, Vorgabe) |
| Better Auth `/sign-in/email` | dito | 300 s | 8 | Prozess |
| Better Auth `/sign-up/email` | dito | 3600 s | 5 | Prozess |
| Better Auth `/forget-password` | dito | 3600 s | 5 | Prozess |
| Better Auth `/reset-password` | dito | 3600 s | 8 | Prozess |
| Better Auth `/send-verification-email` | dito | 3600 s | 5 | Prozess |

Alle eigenen Limiter laufen über `lib/route-schutz.ts` → `limit()`/
`ratenPruefen()` → `lib/ratelimit.ts` → `speicherLimiter()`.

### 5.2 Produktionsgrenze — Prozess-Speicher

**Jeder der obigen Zähler lebt im Speicher EINER Node-Instanz.** Solange nur
eine Instanz läuft (heutiger Stand), ist das korrekt. Sobald mehr als eine
Instanz hinter demselben Host läuft (horizontale Skalierung,
Blue/Green-Deploy mit zwei kurzzeitig aktiven Prozessen), zählt jede Instanz
für sich — eine Person könnte das eigentliche Limit mit der Anzahl Instanzen
multiplizieren, weil jede Instanz ihr eigenes Kontingent führt. Das betrifft
gleichermassen die eigenen Limiter UND Better Auths `storage: "memory"`
(Vorgabewert, hier nicht verändert).

### 5.3 Adapter-Schnittstelle (neu, `lib/ratelimit.ts`)

`lib/ratelimit.ts` hatte keine austauschbare Speicher-Schnittstelle —
`speicherLimiter()` verwob Zählung und Fensterlogik in einer Funktion. Jetzt
extrahiert:

```ts
export interface RatenSpeicher {
  get(schluessel: string): Promise<{ zaehler: number; bis: number } | undefined>;
  increment(schluessel: string, fensterMs: number): Promise<{ zaehler: number; bis: number }>;
}
export function limiterAufSpeicher(speicher: RatenSpeicher, maxProFenster: number, fensterMs: number): RateLimiter;
export function speicherLimiter(maxProFenster: number, fensterMs: number): RateLimiter; // = limiterAufSpeicher(speicherRatenSpeicher(), …)
```

Verhalten unverändert (`tests/ratelimit.test.ts` weiterhin grün) — die
Änderung ist rein strukturell: ein künftiger Postgres- oder Redis-Speicher
muss nur `RatenSpeicher` erfüllen, `limiterAufSpeicher()` bleibt gleich.

### 5.4 Postgres-Adapter — Entwurf (NICHT gebaut, NICHT migriert)

Bewusst nur als Entwurf, nicht als Migration: ein Speicher, der bei jeder
Anfrage die Datenbank berührt, ändert Latenz und Verbindungsverbrauch unter
Last — eine Entscheidung für den Produktions-Anlauf, nicht etwas, das diese
Härtungsrunde nebenbei entscheiden sollte. Env-Schalter vorgesehen:
`RATE_LIMIT_STORE=memory|postgres` (Vorgabe `memory`).

```sql
CREATE TABLE rate_limit_bucket (
  key         text PRIMARY KEY,
  zaehler     int NOT NULL DEFAULT 1,
  bis         timestamptz NOT NULL
);
```

```ts
// Entwurf — nicht eingebaut. Eine Transaktion mit UPSERT + Fensterprüfung
// wäre nötig, damit "increment" unter Nebenläufigkeit atomar bleibt (analog
// zu server/outbox.ts: eine INSERT ... ON CONFLICT DO UPDATE mit
// Bedingung auf `bis`, kein separates SELECT-dann-UPDATE).
async function increment(schluessel: string, fensterMs: number) {
  const [z] = await sql`
    INSERT INTO rate_limit_bucket (key, zaehler, bis) VALUES (${schluessel}, 1, now() + make_interval(secs => ${fensterMs / 1000}))
    ON CONFLICT (key) DO UPDATE SET
      zaehler = CASE WHEN rate_limit_bucket.bis < now() THEN 1 ELSE rate_limit_bucket.zaehler + 1 END,
      bis     = CASE WHEN rate_limit_bucket.bis < now() THEN now() + make_interval(secs => ${fensterMs / 1000}) ELSE rate_limit_bucket.bis END
    RETURNING zaehler, bis`;
  return { zaehler: Number(z.zaehler), bis: new Date(z.bis).getTime() };
}
```

### 5.5 Better Auth: Speicherstrategie geprüft

`rateLimit.storage` unterstützt `"memory"` (Vorgabe, heute verkabelt),
`"database"` und `"secondary-storage"`
(`node_modules/better-auth/node_modules/@better-auth/core/dist/types/init-options.d.mts`).
**`"database"` ist NICHT ohne Weiteres kostenlos möglich:** Better Auth
braucht dafür eine eigene `rateLimit`-Tabelle (Modell `rateLimit`,
analog zu `auth_session`/`auth_account`/`auth_verification` aus
`db/migrations/0011_auth.sql`) — diese Tabelle existiert in dieser
Datenbank noch nicht. Der Umstieg bräuchte also eine neue Migration, nicht
nur eine Konfigurationszeile — das ist derselbe Grund, aus dem der
Postgres-Adapter oben ein Entwurf bleibt, nicht eine Änderung dieser Runde.
`secondaryStorage` (Redis o. ä.) ist gemäss Kostenfreiheits-Regel ohnehin
nicht vorgesehen.

## 6. Beobachtbarkeit (§42)

`lib/log.ts`: eine JSON-Zeile pro Ereignis (`t`, `level`, `ereignis`, …),
Fehler-Einträge zusätzlich mit `fehlerName`/`fehlerMeldung` (Stack nur
ausserhalb `APP_ENV=production`). Ein Feldname, der auf `secret|password|
passwort|token|authorization|cookie|database_url` passt, wird durch
`"[entfernt]"` ersetzt — das schützt vor Feldern wie `{password: …}`, aber
NICHT davor, ein Geheimnis versehentlich im WERT eines harmlos benannten
Feldes zu protokollieren (z. B. `log.info("x", {info: apiKey})`) — das
bleibt Sache der Aufrufstelle, wie bisher auch in `fehlermeldung()`
(`server/outbox.ts`) durch eine eigene Wort-Bereinigung des Fehlertexts
gelöst. IP-Adressen und E-Mail-Adressen werden an den Aufrufstellen bereits
VOR dem Protokollieren gehasht bzw. auf die Domain gekürzt
(`herkunftHash()`, `anDomain: n.an.split("@")[1]` in `server/outbox.ts`) —
das ist Konvention, keine Garantie von `lib/log.ts` selbst.

Neu: `fehlerAntwort()` (`lib/route-schutz.ts`) loggt bei `INTERNAL` jetzt
`{ref: err.ref}` zusätzlich zum Fehlerobjekt — derselbe Wert, der in der
Antwort an den Browser steht (`toResponseBody()`). Eine Person im Betrieb
kann damit von einer gemeldeten Fehlerkennung direkt zum passenden
Protokolleintrag springen (`grep '"ref":"<kennung>"'`), ohne Zeitstempel
oder Ereignistext raten zu müssen.

### Was Produktion später braucht (kein Werkzeug hier gebaut)

- **Log-Sammlung**: `lib/log.ts` schreibt nach stdout/stderr — ein
  Produktionsbetrieb braucht einen Sammler (z. B. den Log-Treiber des
  Containerlaufzeitsystems + einen Aggregator), der diese JSON-Zeilen
  einsammelt und durchsuchbar macht. Nicht Teil dieser Runde.
- **Alarm auf 5xx-Rate**: kein Alarmierungswerkzeug angebunden — ein
  Sammler mit einer Schwelle auf `level:"error"` (oder auf HTTP-5xx aus dem
  Reverse-Proxy-Protokoll) wäre die naheliegende erste Stufe.
- **Outbox-`failed`/`abandoned`-Zähler**: `zustand()` in `server/outbox.ts`
  liefert die Zahlen je Status bereits fertig aufbereitet — es fehlt nur die
  regelmässige Abfrage + Schwelle (z. B. „mehr als N `abandoned` in 24 h“)
  von aussen.
- **DB-Verbindungen**: `server/db.ts` hält den Pool bewusst klein (10 in
  Produktion) — ein Überwachungspunkt auf `pg_stat_activity`/den
  Verbindungszähler des Anbieters fehlt noch.
- **Speicherplatz**: weder Datenbank- noch Objektspeicher-Füllstand wird
  heute beobachtet.
- **Zertifikatsablauf**: liegt beim Reverse Proxy (`Caddyfile`,
  `docs/RUNBOOK-DEPLOY.md`) — keine eigene Prüfung in dieser Anwendung.

## 7. Offene Punkte für die Produktions-Runde

- CSP-Nonces: bewusst nicht eingeführt (Abschnitt 1.3) — falls sich die
  Static/SEO-Strategie einmal grundlegend ändert, neu bewerten.
- `__Host-`-Cookie-Vorsatz: nur mit einem Eingriff in Better Auth selbst
  möglich (Abschnitt 1.4) — nicht risikolos, nicht umgesetzt.
- Rate-Limiting bei mehreren Instanzen: `RatenSpeicher`-Schnittstelle steht
  (Abschnitt 5.3), ein Postgres-Adapter ist entworfen, aber nicht gebaut
  (Abschnitt 5.4) — nötig, sobald mehr als eine Instanz läuft.
- Better Auth `rateLimit.storage: "database"`: bräuchte eine neue Migration
  (Abschnitt 5.5) — nicht Teil dieser Runde.
- Beobachtbarkeit: Log-Sammlung, Alarmierung, Verbindungs-/Speicherplatz-
  Überwachung, Zertifikatsablauf — alles unbeobachtet bis zum
  Produktions-Anlauf (Abschnitt 6).
