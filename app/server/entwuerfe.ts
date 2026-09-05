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
import { darfEntwurfBearbeiten, darfEntwurfSehen, darfEinreichen, darfZurueckziehen, darfZuweisen, type Person, type Status } from "@/domain/rechte";
import { mitgliedFuerInserat, type OrgKontext } from "./org-kontext";

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
  /* Organisationsinserat (P5.7): gehört der Organisation, nicht der
     anlegenden Person. null bei Privatinseraten. */
  orgId: string | null;
  assignedUserId: string | null;
  externalRef: string | null;
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
           l.published_by_org_id, l.assigned_user_id, l.external_ref,
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
  orgId: r.published_by_org_id ? String(r.published_by_org_id) : null,
  assignedUserId: r.assigned_user_id ? String(r.assigned_user_id) : null,
  externalRef: r.external_ref ? String(r.external_ref) : null,
  aktualisiert: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  eingereicht: r.submitted_at ? (r.submitted_at instanceof Date ? r.submitted_at.toISOString() : String(r.submitted_at)) : null,
  rueckmeldung: (r.rueckmeldung as EntwurfZeile["rueckmeldung"]) ?? null
});

/* Das Inserat für die Rechteprüfung — samt der Organisationszugehörigkeit der
   handelnden Person (null bei Privatinseraten oder Fremden). */
async function alsRechteInserat(person: Person, r: Record<string, unknown>) {
  const orgId = r.published_by_org_id ? String(r.published_by_org_id) : null;
  const m = await mitgliedFuerInserat(person.id, orgId);
  return { inserat: { ownerId: r.published_by_user_id ? String(r.published_by_user_id) : null, orgId, status: r.status as Status }, m };
}

/* ---------- Anlegen ----------
   Ein Entwurf ist sofort ein echtes Inserat im Zustand `draft`. Die
   Liegenschaft daneben trägt vorerst leere Pflichtfelder — sie bekommt ihre
   Werte beim Einreichen aus den Assistentendaten. Sichtbar ist davon nichts:
   `listing_public` kennt nur veröffentlichte Zustände. */
export async function entwurfAnlegen(person: Person, uebernehmen?: Entwurf, org?: { kontext: OrgKontext }): Promise<EntwurfZeile> {
  const daten = uebernehmen ? EntwurfSchema.parse(uebernehmen) : LEERER_ENTWURF;

  /* Ein Organisationsinserat: der Aufrufer hat bereits `verlangeOrgRecht(...,
     "CREATE_LISTING")` geprüft. Herausgeberin ist nie «fourwalls» — das
     bleibt der eigenen Vertretung vorbehalten (§42/§26). */
  if (org && org.kontext.org.kind === "fourwalls") {
    throw new AppError("VALIDATION", "Diese Organisation kann kein Inserat als Anbieterin herausgeben");
  }
  const orgKind = org ? org.kontext.org.kind : null;
  const orgId = org ? org.kontext.org.id : null;
  /* Standard: wer selbst im Team arbeitet, ist zuständig — sonst bleibt die
     Zuweisung offen und wird später gesetzt (§24). */
  const zustaendig = org && (["agent", "admin", "owner"] as string[]).includes(org.kontext.mitglied.rolle) ? person.id : null;

  const zeile = await sql.begin(async tx => {
    await tx`SELECT set_config('app.actor_id', ${person.id}, true), set_config('app.reason', 'entwurf-angelegt', true)`;
    const p = await tx`
      INSERT INTO property (kind, postal_code, city, canton, geo_precision, geo_radius_m)
      VALUES ('apartment', '', '', '', 'approximate', 450) RETURNING id`;

    /* Vorbelegung aus dem öffentlichen Profil der Organisation (§23) — der
       Assistent zeigt sie, die Person darf sie überschreiben. */
    let vorbelegung = daten;
    if (org) {
      const [o] = await tx`SELECT display_name, public_email, public_phone FROM organization WHERE id = ${orgId}`;
      vorbelegung = EntwurfSchema.parse({
        ...daten,
        name: daten.name ?? o?.display_name ?? null,
        email: daten.email ?? o?.public_email ?? null,
        telefon: daten.telefon ?? o?.public_phone ?? null
      });
    }

    const l = await tx`
      INSERT INTO listing (property_id, transaction, publisher_kind, published_by_user_id, published_by_org_id,
                           contact_user_id, assigned_user_id, content_locale, price_on_request, available_immediately, is_demo, draft_data)
      VALUES (${p[0]!.id}, 'sale', ${orgKind ?? "private_person"}, ${person.id}, ${orgId},
              ${org ? null : person.id}, ${zustaendig},
              ${vorbelegung.sprache}, false, false, false, ${sql.json(vorbelegung)})
      RETURNING public_ref, status, version, draft_data, published_by_user_id, published_by_org_id, assigned_user_id, external_ref, updated_at, submitted_at`;
    return l[0]!;
  });
  log.info("entwurf.angelegt", { listing: String(zeile.public_ref), actor: person.id, org: orgId });
  return alsZeile({ ...zeile, rueckmeldung: null });
}

/* ---------- Lesen ---------- */
export async function entwurfLesen(person: Person, publicRef: string): Promise<EntwurfZeile> {
  const r = await laden(publicRef);
  if (!r) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");
  const { inserat, m } = await alsRechteInserat(person, r);
  const e = darfEntwurfSehen(person, inserat, m);
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
  const { inserat, m } = await alsRechteInserat(person, r);
  if (!darfEntwurfSehen(person, inserat, m).erlaubt) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");
  const e = darfEntwurfBearbeiten(person, inserat, m);
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
     RETURNING public_ref, status, version, draft_data, published_by_user_id, published_by_org_id, assigned_user_id, external_ref, updated_at, submitted_at`;
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
     WHERE l.published_by_user_id = ${person.id} AND l.published_by_org_id IS NULL
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
  const { inserat, m } = await alsRechteInserat(person, r);
  if (!darfEntwurfSehen(person, inserat, m).erlaubt) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");
  const e = darfEinreichen(person, inserat, m);
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
    await materialisieren(tx, r.id as string, r.property_id as string, d, person, inserat.orgId);
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
async function materialisieren(tx: Tx, listingId: string, propertyId: string, d: Entwurf, person: Person, orgId: string | null = null) {
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
      /* Organisationsinserate routen über die Organisation, nie über eine
         einzelne Person (§34/§42); represented_by_org_id bleibt unberührt —
         die Exclusive-Vertretung setzt nie der Anbieter selbst (§42). */
      contact_user_id = ${orgId ? null : person.id}
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
  const { inserat, m } = await alsRechteInserat(person, r);
  if (!darfEntwurfSehen(person, inserat, m).erlaubt) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");
  if (!darfZurueckziehen(person, inserat, m).erlaubt) throw new AppError("FORBIDDEN", "Sie können dieses Inserat nicht zurückziehen");
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

/* ---------- Zuweisen ----------
   Operative Verantwortung im Team wechselt — die Herausgeberschaft bleibt bei
   der Organisation (§24). Nur ein aktives Mitglied DERSELBEN Organisation
   kann Ziel sein; ein fremdes Inserat sieht wie ein nicht vorhandenes aus. */
export async function zuweisen(person: Person, publicRef: string, zielUserId: string | null): Promise<EntwurfZeile> {
  const r = await laden(publicRef);
  if (!r) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");
  const { inserat, m } = await alsRechteInserat(person, r);
  const e = darfZuweisen(inserat, m);
  if (!e.erlaubt) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");

  if (zielUserId) {
    const ziel = await sql`
      SELECT 1 FROM org_membership WHERE organization_id = ${inserat.orgId} AND user_id = ${zielUserId} AND is_active LIMIT 1`;
    if (!ziel[0]) throw new AppError("VALIDATION", "Diese Person ist kein aktives Mitglied dieser Organisation", { userId: "unbekannt" });
  }

  await sql.begin(async tx => {
    await tx`SELECT set_config('app.actor_id', ${person.id}, true), set_config('app.reason', 'zuweisung geändert', true)`;
    await tx`UPDATE listing SET assigned_user_id = ${zielUserId} WHERE id = ${r.id}`;
    await tx`INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, previous_state, new_state)
             VALUES (${person.id}, 'listing.assigned', 'listing', ${r.id},
                     ${r.assigned_user_id ? String(r.assigned_user_id) : null}, ${zielUserId})`;
  });
  log.info("entwurf.zugewiesen", { listing: publicRef, actor: person.id, ziel: zielUserId });
  const nach = await laden(publicRef);
  return alsZeile(nach!);
}

/* Für die Demo-Abgrenzung: in der Produktion erscheinen Demo-Inserate nicht.
   Selbst erstellte Inserate sind nie Demo. */
export const istProduktion = () => env().APP_ENV === "production";
