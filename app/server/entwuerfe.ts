import "server-only";
import { sql } from "./db";
import { env } from "./env";
import { einreihen } from "./outbox";
import { medienZurueckziehen } from "./medien";
import { mailtext } from "@/lib/mailtext";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/log";
import { EntwurfSchema, LEERER_ENTWURF, fehlend, type Entwurf } from "@/domain/entwurf";
import { TYP_ZU_KIND, type Typ } from "@/domain/marktplatz";
import { darfEntwurfBearbeiten, darfEntwurfSehen, darfEinreichen, darfZurueckziehen, type Person, type Status } from "@/domain/rechte";

/* Entwürfe — anlegen, lesen, speichern, einreichen.

   Jede Funktion hier beginnt gleich: Inserat laden, dann `domain/rechte.ts`
   fragen, ob DIESE Person mit DIESEM Objekt in DIESEM Zustand das darf. Erst
   danach wird geschrieben. Eine fremde Referenz führt zu NOT_FOUND, nicht zu
   FORBIDDEN — wer nichts sehen darf, soll auch nicht erfahren, dass es
   existiert (§13/§65).

   Geschrieben wird ausschliesslich, was `EntwurfSchema` kennt. Status,
   Eigentümerin, Veröffentlichungsdatum und Rollen stehen nicht darin und
   lassen sich deshalb über kein Formular setzen (§42/§67). */

export interface EntwurfZeile {
  publicRef: string;
  status: Status;
  version: number;
  daten: Entwurf;
  ownerId: string | null;
  aktualisiert: string;
  eingereicht: string | null;
  rueckmeldung: { nachricht: string; grund: string | null; zeit: string } | null;
}

const REF = /^FWL-\d{4}-\d{6}$/;

/* Inserat laden — roh, ohne Rechteentscheid. Wer das aufruft, entscheidet
   danach selbst, was die Person sehen darf. */
async function laden(publicRef: string) {
  if (!REF.test(publicRef)) return null;
  const z = await sql`
    SELECT l.id, l.public_ref, l.status, l.version, l.draft_data, l.published_by_user_id, l.property_id,
           l.updated_at, l.submitted_at, l.slug, l.content_locale,
           (SELECT json_build_object('nachricht', m.message_to_owner, 'grund', m.reason, 'zeit', m.closed_at)
              FROM moderation_case m
             WHERE m.listing_id = l.id AND m.message_to_owner IS NOT NULL
             ORDER BY m.opened_at DESC LIMIT 1) AS rueckmeldung
      FROM listing l WHERE l.public_ref = ${publicRef} LIMIT 1`;
  return z[0] ?? null;
}

const alsZeile = (r: Record<string, unknown>): EntwurfZeile => ({
  publicRef: String(r.public_ref),
  status: r.status as Status,
  version: Number(r.version),
  daten: EntwurfSchema.parse(r.draft_data ?? {}),
  ownerId: r.published_by_user_id ? String(r.published_by_user_id) : null,
  aktualisiert: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  eingereicht: r.submitted_at ? (r.submitted_at instanceof Date ? r.submitted_at.toISOString() : String(r.submitted_at)) : null,
  rueckmeldung: (r.rueckmeldung as EntwurfZeile["rueckmeldung"]) ?? null
});

/* ---------- Anlegen ----------
   Ein Entwurf ist sofort ein echtes Inserat im Zustand `draft`. Die
   Liegenschaft daneben trägt vorerst leere Pflichtfelder — sie bekommt ihre
   Werte beim Einreichen aus den Assistentendaten. Sichtbar ist davon nichts:
   `listing_public` kennt nur veröffentlichte Zustände. */
export async function entwurfAnlegen(person: Person, uebernehmen?: Entwurf): Promise<EntwurfZeile> {
  const daten = uebernehmen ? EntwurfSchema.parse(uebernehmen) : LEERER_ENTWURF;
  const zeile = await sql.begin(async tx => {
    await tx`SELECT set_config('app.actor_id', ${person.id}, true), set_config('app.reason', 'entwurf-angelegt', true)`;
    const p = await tx`
      INSERT INTO property (kind, postal_code, city, canton, geo_precision, geo_radius_m)
      VALUES ('apartment', '', '', '', 'approximate', 450) RETURNING id`;
    const l = await tx`
      INSERT INTO listing (property_id, transaction, publisher_kind, published_by_user_id, contact_user_id,
                           content_locale, price_on_request, available_immediately, is_demo, draft_data)
      VALUES (${p[0]!.id}, 'sale', 'private_person', ${person.id}, ${person.id},
              ${daten.sprache}, false, false, false, ${sql.json(daten)})
      RETURNING public_ref, status, version, draft_data, published_by_user_id, updated_at, submitted_at`;
    return l[0]!;
  });
  log.info("entwurf.angelegt", { listing: String(zeile.public_ref), actor: person.id });
  return alsZeile({ ...zeile, rueckmeldung: null });
}

/* ---------- Lesen ---------- */
export async function entwurfLesen(person: Person, publicRef: string): Promise<EntwurfZeile> {
  const r = await laden(publicRef);
  if (!r) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");
  const e = darfEntwurfSehen(person, { ownerId: r.published_by_user_id ? String(r.published_by_user_id) : null, status: r.status as Status });
  /* Fremdes Inserat: dieselbe Antwort wie ein nicht vorhandenes. */
  if (!e.erlaubt) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");
  return alsZeile(r);
}

/* ---------- Speichern (Autosave) ----------
   Optimistische Sperre über `listing.version`: Wer mit einer veralteten
   Version schreibt, bekommt CONFLICT und den aktuellen Stand zurück — statt
   die neuere Fassung stillschweigend zu überschreiben (§26). */
export async function entwurfSpeichern(person: Person, publicRef: string, teil: unknown, version: number): Promise<EntwurfZeile> {
  const r = await laden(publicRef);
  if (!r) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");
  const inserat = { ownerId: r.published_by_user_id ? String(r.published_by_user_id) : null, status: r.status as Status };
  if (!darfEntwurfSehen(person, inserat).erlaubt) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");
  const e = darfEntwurfBearbeiten(person, inserat);
  if (!e.erlaubt) {
    throw new AppError("FORBIDDEN", e.grund === "falscher-zustand"
      ? "Dieses Inserat ist gerade in Prüfung und kann nicht bearbeitet werden"
      : "Sie können dieses Inserat nicht bearbeiten");
  }

  /* Der Teilstand des Assistenten wird auf den gespeicherten gelegt — und
     durch das Schema geschickt. Unbekannte Felder werden abgewiesen. */
  const alt = EntwurfSchema.parse(r.draft_data ?? {});
  const neu = EntwurfSchema.parse({ ...alt, ...(typeof teil === "object" && teil ? teil : {}) });

  const z = await sql`
    UPDATE listing SET draft_data = ${sql.json(neu)}, content_locale = ${neu.sprache}
     WHERE public_ref = ${publicRef} AND version = ${version}
     RETURNING public_ref, status, version, draft_data, published_by_user_id, updated_at, submitted_at`;
  if (!z[0]) {
    const jetzt = await laden(publicRef);
    throw new AppError("CONFLICT", "Dieser Entwurf wurde inzwischen an anderer Stelle geändert", { version: String(jetzt?.version ?? "?") });
  }
  return alsZeile({ ...z[0], rueckmeldung: r.rueckmeldung });
}

/* ---------- Meine Inserate ---------- */
export async function meineInserate(person: Person): Promise<EntwurfZeile[]> {
  const z = await sql`
    SELECT l.public_ref, l.status, l.version, l.draft_data, l.published_by_user_id, l.updated_at, l.submitted_at, l.slug,
           (SELECT json_build_object('nachricht', m.message_to_owner, 'grund', m.reason, 'zeit', m.closed_at)
              FROM moderation_case m WHERE m.listing_id = l.id AND m.message_to_owner IS NOT NULL
             ORDER BY m.opened_at DESC LIMIT 1) AS rueckmeldung
      FROM listing l
     WHERE l.published_by_user_id = ${person.id}
     ORDER BY l.updated_at DESC LIMIT 100`;
  return z.map(alsZeile);
}

/* ---------- Einreichen ----------
   Der Server prüft die Vollständigkeit, materialisiert die Assistentendaten in
   Liegenschaft und Inserat und setzt den Zustand — alles in einer Transaktion.
   Bricht etwas ab, bleibt der Entwurf, wie er war (§77). */
export async function entwurfEinreichen(person: Person, publicRef: string): Promise<EntwurfZeile> {
  const r = await laden(publicRef);
  if (!r) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");
  const inserat = { ownerId: r.published_by_user_id ? String(r.published_by_user_id) : null, status: r.status as Status };
  if (!darfEntwurfSehen(person, inserat).erlaubt) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");
  const e = darfEinreichen(person, inserat);
  if (!e.erlaubt) {
    if (e.grund === "email-unbestaetigt") throw new AppError("FORBIDDEN", "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse");
    if (e.grund === "falscher-zustand") throw new AppError("CONFLICT", "Dieses Inserat wurde bereits eingereicht");
    throw new AppError("FORBIDDEN", "Sie können dieses Inserat nicht einreichen");
  }

  const d = EntwurfSchema.parse(r.draft_data ?? {});
  const maengel = fehlend(d);
  if (maengel.length) {
    throw new AppError("VALIDATION", "Dem Inserat fehlen noch Angaben",
      Object.fromEntries(maengel.map(m => [m.feld, String(m.schritt)])));
  }

  await sql.begin(async tx => {
    await tx`SELECT set_config('app.actor_id', ${person.id}, true), set_config('app.reason', 'eingereicht', true)`;
    await materialisieren(tx, r.id as string, r.property_id as string, d, person);
    /* Der Zustandsautomat der Datenbank lässt nur draft/changes_required/rejected → submitted zu. */
    await tx`UPDATE listing SET status = 'submitted', submitted_at = now() WHERE id = ${r.id}`;
    /* Ein offener Fall der Moderation: einer je Durchgang. */
    await tx`UPDATE moderation_case SET closed_at = now() WHERE listing_id = ${r.id} AND closed_at IS NULL`;
    await tx`INSERT INTO moderation_case (listing_id) VALUES (${r.id})`;

    /* Benachrichtigung an die Eigentümerin — in derselben Transaktion. */
    const [eigentuemerin] = await tx`SELECT email, locale FROM app_user WHERE id = ${person.id}`;
    if (eigentuemerin?.email) {
      const owLocale = eigentuemerin.locale === "fr" || eigentuemerin.locale === "it" || eigentuemerin.locale === "en" ? eigentuemerin.locale : "de";
      const { betreff, text } = mailtext("listing_submitted", owLocale, { titel: d.titel ?? "", referenz: publicRef });
      await einreihen(tx, { an: String(eigentuemerin.email), betreff, text, locale: owLocale, art: "listing_submitted", bezug: { art: "listing", kennung: publicRef } });
    }
  });
  log.info("entwurf.eingereicht", { listing: publicRef, actor: person.id });
  const nach = await laden(publicRef);
  return alsZeile(nach!);
}

/* Assistentendaten → Liegenschaft, Inserat, Inhalt, Merkmale, Bilder.
   Die exakte Koordinate ist die Mitte der gewählten Gemeinde: ohne
   Adressdienst gibt es keine genauere, und wir erfinden keine (§29). Der
   öffentliche Punkt entsteht daraus im Trigger — nie im Browser (§30). */
type Tx = typeof sql;
async function materialisieren(tx: Tx, listingId: string, propertyId: string, d: Entwurf, person: Person) {
  const ort = await tx`SELECT id, canton, name_de, postal_codes, ST_Y(centroid::geometry) AS lat, ST_X(centroid::geometry) AS lng
                         FROM place WHERE key = ${d.ortId!} AND kind = 'municipality' LIMIT 1`;
  const o = ort[0];
  if (!o) throw new AppError("VALIDATION", "Der gewählte Ort ist unbekannt", { ortId: "ort" });
  const plz = String((o.postal_codes as string[] | null)?.[0] ?? "");
  const rappen = (chf: number | null) => chf == null ? null : Math.round(chf * 100);
  const miete = d.trans === "rent";

  await tx`
    UPDATE property SET
      kind = ${TYP_ZU_KIND[d.typ as Typ]}, postal_code = ${plz}, city = ${String(o.name_de)}, canton = ${String(o.canton)},
      place_id = ${o.id},
      street = ${d.strasse}, house_number = ${d.hausnummer},
      geom_exact = ST_SetSRID(ST_MakePoint(${Number(o.lng)}, ${Number(o.lat)}), 4326)::geography,
      geo_precision = ${d.genauigkeit === "gemeinde" ? "municipality" : "approximate"},
      geo_radius_m = ${d.genauigkeit === "gemeinde" ? 2000 : 450},
      rooms = ${d.zimmer}, living_area_m2 = ${d.flaeche}, usable_area_m2 = ${d.nutzflaeche},
      plot_area_m2 = ${d.grundstueck}, built_year = ${d.baujahr}, floor = ${d.etage}, floors_total = ${d.geschosse},
      bedrooms = ${d.schlafzimmer}, bathrooms = ${d.badezimmer}
    WHERE id = ${propertyId}`;

  await tx`
    UPDATE listing SET
      transaction = ${miete ? "rent" : "sale"},
      title = ${d.titel}, description = ${d.beschreibung}, content_locale = ${d.sprache},
      price_chf = ${miete ? null : rappen(d.preis)},
      rent_net_chf = ${miete ? rappen(d.preis) : null},
      rent_extra_chf = ${miete ? rappen(d.nebenkosten) : null},
      deposit_max_chf = ${miete ? rappen(d.kaution) : null},
      price_on_request = ${d.preisAufAnfrage},
      available_immediately = ${d.sofortVerfuegbar},
      available_from = ${d.verfuegbarAb},
      contact_user_id = ${person.id}
    WHERE id = ${listingId}`;

  /* Merkmale und Bilder ersetzen, nicht anhäufen. */
  await tx`DELETE FROM property_feature WHERE property_id = ${propertyId}`;
  for (const f of d.merkmale) await tx`INSERT INTO property_feature (property_id, feature_key) VALUES (${propertyId}, ${f}) ON CONFLICT DO NOTHING`;

  await tx`DELETE FROM listing_image WHERE listing_id = ${listingId}`;
  for (const [i, assetId] of d.bilder.entries()) {
    /* Nur eigene Medien: ein fremder Bezeichner findet keine Zeile (§35). */
    const ok = await tx`SELECT 1 FROM media_asset WHERE id = ${assetId} AND uploaded_by = ${person.id}`;
    if (!ok[0]) throw new AppError("FORBIDDEN", "Ein gewähltes Bild gehört nicht zu Ihrem Konto");
    await tx`INSERT INTO listing_image (listing_id, asset_id, sort_order, category, is_cover)
             VALUES (${listingId}, ${assetId}, ${i}, 'wohnen', ${i === 0})`;
  }

  /* Inhalt in der Sprache, in der geschrieben wurde — keine automatische
     Übersetzung, die eine Autorschaft vortäuscht (§55). */
  await tx`
    INSERT INTO listing_content (listing_id, locale, title, sections)
    VALUES (${listingId}, ${d.sprache}, ${d.titel}, ${sql.json({ story: { titel: d.titel, absaetze: [d.beschreibung] } })})
    ON CONFLICT (listing_id, locale) DO UPDATE SET title = EXCLUDED.title, sections = EXCLUDED.sections, updated_at = now()`;
}

/* ---------- Zurückziehen ----------
   Kein Löschen: der Prüfweg bleibt nachvollziehbar (§46/§60). */
export async function entwurfZurueckziehen(person: Person, publicRef: string): Promise<void> {
  const r = await laden(publicRef);
  if (!r) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");
  const inserat = { ownerId: r.published_by_user_id ? String(r.published_by_user_id) : null, status: r.status as Status };
  if (!darfEntwurfSehen(person, inserat).erlaubt) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");
  if (!darfZurueckziehen(person, inserat).erlaubt) throw new AppError("FORBIDDEN", "Sie können dieses Inserat nicht zurückziehen");
  await sql.begin(async tx => {
    await tx`SELECT set_config('app.actor_id', ${person.id}, true), set_config('app.reason', 'zurueckgezogen', true)`;
    /* Aus jedem Zustand führt ein erlaubter Weg ins Archiv; die Zustandsprüfung
       der Datenbank entscheidet, ob ein Zwischenschritt nötig ist. */
    const s = r.status as Status;
    if (s === "published" || s === "reserved") {
      await tx`UPDATE listing SET status = 'paused' WHERE id = ${r.id}`;
      await medienZurueckziehen(tx, String(r.id));
    }
    if (s === "submitted" || s === "in_review") await tx`UPDATE listing SET status = 'changes_required' WHERE id = ${r.id}`;
    if (s === "approved") await tx`UPDATE listing SET status = 'archived' WHERE id = ${r.id}`;
    else await tx`UPDATE listing SET status = 'archived' WHERE id = ${r.id}`;
    await tx`UPDATE moderation_case SET closed_at = now(), outcome = 'zurueckgezogen' WHERE listing_id = ${r.id} AND closed_at IS NULL`;
  });
  log.info("entwurf.zurueckgezogen", { listing: publicRef, actor: person.id });
}

/* Für die Demo-Abgrenzung: in der Produktion erscheinen Demo-Inserate nicht.
   Selbst erstellte Inserate sind nie Demo. */
export const istProduktion = () => env().APP_ENV === "production";
