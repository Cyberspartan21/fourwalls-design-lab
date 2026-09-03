/* Routen-Falsifikation für den ganzen importierten Bestand — nicht nur
   Stichproben. Prüft für jedes Inserat aus der Datenbank per HTTP, ob die
   Anwendung genau das liefert, was das Routenschema verspricht:
   kanonische Adresse in allen vier Sprachen, 308 auf falschem Slug/falscher
   Transaktion, 404 für nicht-öffentliche Status, und keine Geo-Lecks bei
   ungenauer Präzision.

   node scripts/routen-test.mjs [basisUrl]   Standard: http://localhost:3007
   DATABASE_URL muss gesetzt sein (siehe scripts/migrate.mjs für das Muster). */
import postgres from "postgres";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
const wurzel = join(hier, "..");

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL fehlt"); process.exit(1); }
const basis = (process.argv[2] ?? "http://localhost:3007").replace(/\/$/, "");

const LOCALES = ["de", "fr", "it", "en"];
const PFAD = {
  de: { immobilien: "immobilien", kaufen: "kaufen", mieten: "mieten" },
  fr: { immobilien: "immobilier", kaufen: "acheter", mieten: "louer" },
  it: { immobilien: "immobili", kaufen: "comprare", mieten: "affittare" },
  en: { immobilien: "properties", kaufen: "buy", mieten: "rent" }
};

const sql = postgres(url, { max: 1, onnotice: () => {} });

/* Nebenläufigkeit begrenzen: max. 8 Anfragen gleichzeitig. */
async function pool(items, limit, worker) {
  const ergebnisse = new Array(items.length);
  let i = 0;
  async function next() {
    while (i < items.length) {
      const idx = i++;
      ergebnisse[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return ergebnisse;
}

async function anfrage(pfad) {
  const ctl = new AbortController();
  const timeout = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(basis + pfad, { redirect: "manual", signal: ctl.signal });
    const text = await res.text().catch(() => "");
    return { status: res.status, location: res.headers.get("location"), text };
  } catch (e) {
    return { status: 0, location: null, text: "", fehler: String(e && e.message || e) };
  } finally {
    clearTimeout(timeout);
  }
}

function kanonischerPfad(l, transaction, slug, publicRef) {
  const p = PFAD[l];
  const art = transaction === "rent" ? p.mieten : p.kaufen;
  return `/${l}/${p.immobilien}/${art}/${slug}-${publicRef.toLowerCase()}`;
}

function pfadTeil(locationHeader) {
  if (!locationHeader) return null;
  try {
    // absolute oder relative URL — nur den Pfad vergleichen.
    const u = new URL(locationHeader, basis);
    return u.pathname;
  } catch {
    return locationHeader;
  }
}

async function main() {
  const start = Date.now();
  const zeilen = await sql`
    SELECT l.public_ref, l.slug, l.transaction, l.status,
           ST_X(p.geom_exact::geometry) AS lng_exakt, ST_Y(p.geom_exact::geometry) AS lat_exakt,
           p.geo_precision
    FROM listing l JOIN property p ON p.id = l.property_id
    WHERE l.is_demo
    ORDER BY l.public_ref
  `;
  await sql.end();

  const oeffentlich = zeilen.filter(z => z.status === "published" || z.status === "reserved");
  const nichtOeffentlich = zeilen.filter(z => z.status !== "published" && z.status !== "reserved");

  const fehler = [];
  const zaehler = {
    kanonisch200: 0, inhaltVorhanden: 0, falscherSlug308: 0, falscheTransaktion308: 0,
    geoOk: 0, nichtOeffentlich404: 0, sonderfaelle404: 0
  };
  let serverfehler = 0;
  let geprueft = 0;

  function meldeFehler(eintrag) {
    if (fehler.length < 50) fehler.push(eintrag);
  }
  function pruefeServerfehler(ref, url, status) {
    if (status >= 500) serverfehler++;
  }

  function fortschritt() {
    geprueft++;
    if (geprueft % 50 === 0) process.stderr.write(`… ${geprueft} Inserate geprüft\n`);
  }

  // 1) Öffentliche Inserate: alle Prüfungen a–d.
  await pool(oeffentlich, 8, async (z) => {
    const kanon = {};
    for (const l of LOCALES) kanon[l] = kanonischerPfad(l, z.transaction, z.slug, z.public_ref);

    // a) kanonische Route in allen vier Sprachen → 200, <title>, d-uebersicht ODER d-eckdaten
    for (const l of LOCALES) {
      const pfad = kanon[l];
      const r = await anfrage(pfad);
      pruefeServerfehler(z.public_ref, pfad, r.status);
      if (r.status !== 200) {
        meldeFehler({ ref: z.public_ref, url: pfad, erwartet: "200", erhalten: String(r.status) });
      } else {
        zaehler.kanonisch200++;
        const hatTitle = /<title>/.test(r.text);
        const hatAbschnitt = /d-uebersicht/.test(r.text) || /d-eckdaten/.test(r.text);
        if (!hatTitle || !hatAbschnitt) {
          meldeFehler({ ref: z.public_ref, url: pfad, erwartet: "200 mit <title> und d-uebersicht/d-eckdaten", erhalten: "Inhalt fehlt" });
        } else {
          zaehler.inhaltVorhanden++;
        }
      }
    }

    // b) nur de: falscher Slug → 308 auf kanonisch
    {
      const pfad = `/de/immobilien/${z.transaction === "rent" ? PFAD.de.mieten : PFAD.de.kaufen}/falsch-${z.public_ref.toLowerCase()}`;
      const r = await anfrage(pfad);
      pruefeServerfehler(z.public_ref, pfad, r.status);
      const ziel = pfadTeil(r.location);
      if (r.status !== 308 || ziel !== kanon.de) {
        meldeFehler({ ref: z.public_ref, url: pfad, erwartet: `308 -> ${kanon.de}`, erhalten: `${r.status} -> ${ziel ?? "(kein location)"}` });
      } else {
        zaehler.falscherSlug308++;
      }
    }

    // c) nur de: falsches Transaktionssegment → 308 auf kanonisch
    {
      const falscheArt = z.transaction === "rent" ? PFAD.de.kaufen : PFAD.de.mieten;
      const pfad = `/de/immobilien/${falscheArt}/${z.slug}-${z.public_ref.toLowerCase()}`;
      const r = await anfrage(pfad);
      pruefeServerfehler(z.public_ref, pfad, r.status);
      const ziel = pfadTeil(r.location);
      if (r.status !== 308 || ziel !== kanon.de) {
        meldeFehler({ ref: z.public_ref, url: pfad, erwartet: `308 -> ${kanon.de}`, erhalten: `${r.status} -> ${ziel ?? "(kein location)"}` });
      } else {
        zaehler.falscheTransaktion308++;
      }
    }

    // d) Geo-Privatsphäre: bei geo_precision <> 'exact' dürfen lat/lng nicht im de-HTML stehen
    if (z.geo_precision !== "exact" && z.lat_exakt != null && z.lng_exakt != null) {
      const pfad = kanon.de;
      const r = await anfrage(pfad);
      pruefeServerfehler(z.public_ref, pfad, r.status);
      const lat = Number(z.lat_exakt).toFixed(4);
      const lng = Number(z.lng_exakt).toFixed(4);
      const reLat = new RegExp(`(?<![\\d.])${lat.replace(".", "\\.")}(?![\\d])`);
      const reLng = new RegExp(`(?<![\\d.])${lng.replace(".", "\\.")}(?![\\d])`);
      if (reLat.test(r.text) || reLng.test(r.text)) {
        meldeFehler({ ref: z.public_ref, url: pfad, erwartet: "kein geo-leck", erhalten: "exakte Koordinate im HTML gefunden" });
      } else {
        zaehler.geoOk++;
      }
    } else if (z.geo_precision !== "exact") {
      zaehler.geoOk++;
    }

    fortschritt();
  });

  // 2) Nicht-öffentliche Inserate: kanonische Route de → 404
  await pool(nichtOeffentlich, 8, async (z) => {
    const pfad = kanonischerPfad("de", z.transaction, z.slug, z.public_ref);
    const r = await anfrage(pfad);
    pruefeServerfehler(z.public_ref, pfad, r.status);
    if (r.status !== 404) {
      meldeFehler({ ref: z.public_ref, url: pfad, erwartet: "404", erhalten: String(r.status) });
    } else {
      zaehler.nichtOeffentlich404++;
    }
    fortschritt();
  });

  // 3) Sonderfälle: unbekannte Referenz, kein Regex-Treffer
  {
    const faelle = [
      "/de/immobilien/kaufen/foo-fwl-2026-999999",
      "/de/immobilien/kaufen/x"
    ];
    for (const pfad of faelle) {
      const r = await anfrage(pfad);
      pruefeServerfehler("(sonderfall)", pfad, r.status);
      if (r.status !== 404) {
        meldeFehler({ ref: "(sonderfall)", url: pfad, erwartet: "404", erhalten: String(r.status) });
      } else {
        zaehler.sonderfaelle404++;
      }
    }
  }

  const dauerMs = Date.now() - start;
  const bericht = {
    gesamt: zeilen.length,
    oeffentlich: oeffentlich.length,
    nichtOeffentlich: nichtOeffentlich.length,
    geprueft: zaehler,
    serverfehler,
    fehlerAnzahl: fehler.length,
    fehler,
    dauerMs
  };

  const varOrdner = join(wurzel, "var");
  mkdirSync(varOrdner, { recursive: true });
  writeFileSync(join(varOrdner, "routen-bericht.json"), JSON.stringify(bericht, null, 2));

  console.log(JSON.stringify(bericht, null, 2));

  process.exit(fehler.length > 0 || serverfehler > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
