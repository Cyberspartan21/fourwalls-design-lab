import "server-only";
import { sql } from "./db";
import { env } from "./env";
import { einreihen } from "./outbox";
import { mailtext } from "@/lib/mailtext";
import { AppError, asAppError } from "@/lib/errors";
import { log } from "@/lib/log";
import { AnliegenSchema, fehlend, DIENST_LABEL, type Anliegen, type Objekt } from "@/domain/anliegen";
import { TYP_ZU_KIND, KIND_ZU_TYP } from "@/domain/marktplatz";
import { darf, type Person } from "@/domain/rechte";

/* Anliegen von Eigentümerinnen an FOURWALLS (P5.8 §6–§9, §26–§28, §40, §77).

   `anliegenAnnehmen` ist die einzige Schreiboperation ohne Sitzung: Kontakt,
   Objektkontext (alles optional) und Herkunft kommen aus dem Formular —
   Inserat, Ort und Dienstbezeichnung werden serverseitig aufgelöst, nie aus
   dem Formular übernommen. Reihenfolge, die zählt: Honigtopf → Schema →
   Vollständigkeit → Inserat/Ort auflösen → Zeile → Protokoll → zwei Mails,
   alles in einer Transaktion. */

type MailLocale = "de" | "fr" | "it" | "en";
const alsLocale = (v: unknown): MailLocale => (v === "fr" || v === "it" || v === "en" ? v : "de");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Steuerzeichen und Zeilenumbrüche in Namen/Telefonnummern sind nie gewollt. */
const glatt = (s: string) => s.replace(/[\x00-\x1f\x7f]+/g, " ").replace(/\s+/g, " ").trim();

/* Kurze Faktenzeile für die interne Meldung — kein Dokument, keine Tabelle,
   nur was ein erstes Gespräch vorbereitet (§11/§43). */
function faktenZeile(o?: Objekt): string {
  if (!o) return "–";
  const teile: string[] = [];
  if (o.typ) teile.push(`Typ: ${o.typ}`);
  if (o.zimmer != null) teile.push(`Zimmer: ${o.zimmer}`);
  if (o.flaeche != null) teile.push(`Wohnfläche: ${o.flaeche} m²`);
  if (o.grundstueck != null) teile.push(`Grundstück: ${o.grundstueck} m²`);
  if (o.baujahr != null) teile.push(`Baujahr: ${o.baujahr}`);
  if (o.einheiten != null) teile.push(`Einheiten: ${o.einheiten}`);
  if (o.zustand) teile.push(`Zustand: ${o.zustand}`);
  if (o.belegung) teile.push(`Belegung: ${o.belegung}`);
  if (o.zeitpunkt) teile.push(`Zeitpunkt: ${o.zeitpunkt}`);
  if (o.leistungen?.length) teile.push(`Leistungen: ${o.leistungen.join(", ")}`);
  return teile.length ? teile.join(" · ") : "–";
}

export async function anliegenAnnehmen(eingabe: unknown, herkunft: { ipHash: string; uaHash: string | null }, person: Person | null): Promise<{ publicRef: string }> {
  /* Honigtopf zuerst, auf der rohen Eingabe: ein Skript, das das unsichtbare
     Feld füllt, bekommt keinen anderen Hinweis als eine ganz normale
     Annahme — nichts wird gespeichert (§?). Absichtlich VOR dem Schema, das
     ein gefülltes `firma` sonst als gewöhnlichen Validierungsfehler abwiese. */
  const roh = eingabe as { firma?: unknown } | null | undefined;
  if (roh && typeof roh === "object" && typeof roh.firma === "string" && roh.firma.length > 0) {
    log.warn("anliegen.honigtopf");
    return { publicRef: "FWS-0000-000000" };
  }

  const geparst = AnliegenSchema.safeParse(eingabe);
  if (!geparst.success) throw asAppError(geparst.error);
  const a: Anliegen = geparst.data;

  const mangel = fehlend(a);
  if (mangel.length) {
    throw new AppError("VALIDATION", "Bitte prüfen Sie Ihre Angaben", Object.fromEntries(mangel.map(f => [f, "Pflichtfeld"])));
  }

  /* Ein Inserat verknüpfen — nur das eigene oder ein öffentlich sichtbares.
     Nie ein fremdes, unveröffentlichtes Inserat (IDOR). */
  let listingId: string | null = null;
  if (a.objekt?.inseratRef) {
    const z = await sql`SELECT id, published_by_user_id, status FROM listing WHERE public_ref = ${a.objekt.inseratRef} LIMIT 1`;
    const r = z[0];
    if (r) {
      const eigenes = person != null && r.published_by_user_id != null && String(r.published_by_user_id) === person.id;
      const oeffentlich = r.status === "published" || r.status === "reserved";
      if (eigenes || oeffentlich) listingId = String(r.id);
    }
  }

  /* Ein Ort nur, wenn er wirklich im Index steht und eine Gemeinde oder
     Postleitzahl ist — nie eine erfundene Kennung. */
  let placeKey: string | null = null;
  if (a.objekt?.ortId) {
    const z = await sql`SELECT key FROM place WHERE key = ${a.objekt.ortId} AND kind IN ('municipality','postal_code') LIMIT 1`;
    if (z[0]) placeKey = String(z[0].key);
  }

  const propertyKind = a.objekt?.typ ? TYP_ZU_KIND[a.objekt.typ] : null;
  const sprache = alsLocale(a.sprache);
  const inboxLocale: MailLocale = "de";

  const publicRef = await sql.begin(async tx => {
    const zeilen = await tx`
      INSERT INTO service_lead (
        service, user_id, contact_name, contact_email, contact_phone, preferred_channel, preferred_date, preferred_window, locale,
        listing_id, place_key, property_kind, rooms, living_area_m2, plot_area_m2, built_year, units, condition, occupancy, timing,
        already_listed, other_broker, services_wanted, message, source_page, campaign, ip_hash, user_agent_hash
      ) VALUES (
        ${a.dienst}, ${person?.id ?? null}, ${glatt(a.kontakt.name)}, ${a.kontakt.email}, ${a.kontakt.telefon ? glatt(a.kontakt.telefon) : null},
        ${a.kontakt.kanal}, ${a.kontakt.wunschdatum ?? null}, ${a.kontakt.wunschfenster ?? null}, ${sprache},
        ${listingId}, ${placeKey}, ${propertyKind}, ${a.objekt?.zimmer ?? null}, ${a.objekt?.flaeche ?? null}, ${a.objekt?.grundstueck ?? null},
        ${a.objekt?.baujahr ?? null}, ${a.objekt?.einheiten ?? null}, ${a.objekt?.zustand ?? null}, ${a.objekt?.belegung ?? null}, ${a.objekt?.zeitpunkt ?? null},
        ${a.objekt?.bereitsInseriert ?? null}, ${a.objekt?.andererMakler ?? null}, ${a.objekt?.leistungen ?? []},
        ${a.objekt?.nachricht ? a.objekt.nachricht.replace(/\r\n?/g, "\n") : null},
        ${a.herkunft.seite}, ${a.herkunft.kampagne ?? null}, ${herkunft.ipHash}, ${herkunft.uaHash}
      )
      RETURNING id, public_ref`;
    const zeile = zeilen[0]!;
    const id = String(zeile.id);
    const ref = String(zeile.public_ref);

    await tx`INSERT INTO audit_log (actor_user_id, actor_role, action, entity_type, entity_id)
             VALUES (${person?.id ?? null}, ${person?.rolle ?? null}, 'service_lead.created', 'service_lead', ${id})`;

    /* Ortsname für die interne Meldung — Gemeinde/PLZ, wenn bekannt. */
    let ortLabel = "–";
    if (placeKey) {
      const p = await tx`SELECT name_de FROM place WHERE key = ${placeKey} LIMIT 1`;
      if (p[0]?.name_de) ortLabel = String(p[0].name_de);
    }

    const url = `${env().NEXT_PUBLIC_SITE_URL}/${sprache}/intern/anliegen/${ref}`;
    const { betreff: bIntern, text: tIntern } = mailtext("service_lead_intern", inboxLocale, {
      dienst: DIENST_LABEL[inboxLocale][a.dienst], referenz: ref, name: glatt(a.kontakt.name), email: a.kontakt.email,
      telefon: a.kontakt.telefon ? glatt(a.kontakt.telefon) : "–", ort: ortLabel,
      fakten: faktenZeile(a.objekt), nachricht: a.objekt?.nachricht ?? "–", url
    });
    const posteingang = env().SERVICE_LEAD_INBOX ?? env().MAIL_DEV_SINK;
    await einreihen(tx, { an: posteingang, betreff: bIntern, text: tIntern, locale: inboxLocale, art: "service_lead_intern", bezug: { art: "service_lead", kennung: ref } });

    /* Bestätigung an die Person, in ihrer Sprache — ehrlich: erhalten, wir
       melden uns. Kein «geprüft», keine Frist, kein Preis (§40). */
    const { betreff: bBest, text: tBest } = mailtext("service_lead_bestaetigung", sprache, {
      name: glatt(a.kontakt.name), dienst: DIENST_LABEL[sprache][a.dienst], referenz: ref
    });
    await einreihen(tx, { an: a.kontakt.email, betreff: bBest, text: tBest, locale: sprache, art: "service_lead_bestaetigung", bezug: { art: "service_lead", kennung: ref } });

    return ref;
  });

  log.info("anliegen.angenommen", { anliegen: publicRef, dienst: a.dienst });
  return { publicRef };
}

/* ---------- Die eigenen Anliegen einer angemeldeten Person ---------- */
export interface MeinAnliegen {
  publicRef: string; service: string; status: string; createdAt: string;
  ort: string | null; typ: string | null; nachricht: string | null;
}
export async function meineAnliegen(personId: string): Promise<MeinAnliegen[]> {
  const z = await sql`
    SELECT sl.public_ref, sl.service, sl.status, sl.created_at, p.name_de AS ort, sl.property_kind, sl.message
      FROM service_lead sl LEFT JOIN place p ON p.key = sl.place_key
     WHERE sl.user_id = ${personId}
     ORDER BY sl.created_at DESC LIMIT 100`;
  return z.map(r => ({
    publicRef: String(r.public_ref), service: String(r.service), status: String(r.status),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    ort: r.ort ? String(r.ort) : null,
    typ: r.property_kind ? (KIND_ZU_TYP[r.property_kind as keyof typeof KIND_ZU_TYP] ?? String(r.property_kind)) : null,
    nachricht: r.message ? String(r.message) : null
  }));
}

/* ---------- Intern: Übersicht ---------- */
const STATUS_WERTE = ["new", "contacted", "qualified", "closed", "declined"] as const;
type LeadStatus = (typeof STATUS_WERTE)[number];
const DIENST_WERTE = ["sell", "let", "valuation", "property_management", "owner_consultation"] as const;
const LOCALE_WERTE = ["de", "fr", "it", "en"] as const;

export interface LeadFilter {
  status?: string; service?: string; locale?: string; ortId?: string; q?: string; seite: number; proSeite?: number;
}
export interface LeadZeile {
  publicRef: string; service: string; status: string; createdAt: string;
  contactName: string; contactEmail: string; ort: string | null; typ: string | null;
  assignedStaff: { id: string; name: string } | null;
}

export async function leadListe(filter: LeadFilter): Promise<{ zeilen: LeadZeile[]; total: number; seite: number; proSeite: number; hatMehr: boolean }> {
  const proSeite = filter.proSeite ?? 25;
  const seite = Math.max(1, Math.floor(Number(filter.seite) || 1));
  const offset = (seite - 1) * proSeite;
  const status = filter.status && (STATUS_WERTE as readonly string[]).includes(filter.status) ? filter.status : null;
  const service = filter.service && (DIENST_WERTE as readonly string[]).includes(filter.service) ? filter.service : null;
  const locale = filter.locale && (LOCALE_WERTE as readonly string[]).includes(filter.locale) ? filter.locale : null;
  const ortId = filter.ortId?.trim().slice(0, 60) || null;
  const q = filter.q?.trim().slice(0, 120) || null;

  const wo = sql`
    WHERE 1=1
      ${status ? sql`AND sl.status = ${status}` : sql``}
      ${service ? sql`AND sl.service = ${service}` : sql``}
      ${locale ? sql`AND sl.locale = ${locale}` : sql``}
      ${ortId ? sql`AND sl.place_key = ${ortId}` : sql``}
      ${q ? sql`AND (sl.contact_name ILIKE ${"%" + q + "%"} OR sl.contact_email ILIKE ${"%" + q + "%"} OR sl.public_ref ILIKE ${"%" + q + "%"})` : sql``}`;

  const [zeilen, zaehlung] = await Promise.all([
    sql`
      SELECT sl.public_ref, sl.service, sl.status, sl.created_at, sl.contact_name, sl.contact_email,
             p.name_de AS ort, sl.property_kind, sl.assigned_staff_id, u.display_name AS assigned_name
        FROM service_lead sl
        LEFT JOIN place p ON p.key = sl.place_key
        LEFT JOIN app_user u ON u.id = sl.assigned_staff_id
        ${wo}
       ORDER BY sl.created_at DESC
       LIMIT ${proSeite} OFFSET ${offset}`,
    sql`SELECT count(*)::int AS n FROM service_lead sl ${wo}`
  ]);
  const total = Number(zaehlung[0]?.n ?? 0);
  return {
    zeilen: zeilen.map(r => ({
      publicRef: String(r.public_ref), service: String(r.service), status: String(r.status),
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      contactName: String(r.contact_name), contactEmail: String(r.contact_email),
      ort: r.ort ? String(r.ort) : null,
      typ: r.property_kind ? (KIND_ZU_TYP[r.property_kind as keyof typeof KIND_ZU_TYP] ?? String(r.property_kind)) : null,
      assignedStaff: r.assigned_staff_id ? { id: String(r.assigned_staff_id), name: String(r.assigned_name ?? "—") } : null
    })),
    total, seite, proSeite, hatMehr: offset + zeilen.length < total
  };
}

/* ---------- Intern: ein Anliegen ---------- */
export interface LeadDetail {
  publicRef: string; service: string; status: string; createdAt: string; closedAt: string | null;
  contact: { name: string; email: string; phone: string | null; channel: string; wunschdatum: string | null; wunschfenster: string | null };
  objekt: {
    ort: string | null; typ: string | null; zimmer: number | null; flaeche: number | null; grundstueck: number | null;
    baujahr: number | null; einheiten: number | null; zustand: string | null; belegung: string | null; zeitpunkt: string | null;
    bereitsInseriert: boolean | null; andererMakler: boolean | null; leistungen: string[]; nachricht: string | null; listingRef: string | null;
  };
  locale: string;
  herkunft: { seite: string | null; kampagne: string | null };
  assignedStaff: { id: string; name: string } | null;
  verlauf: { zeit: string; aktion: string; von: string | null; nach: string | null; wer: string | null }[];
}

export async function leadLesen(publicRef: string): Promise<LeadDetail> {
  if (!/^FWS-\d{4}-\d{6}$/.test(publicRef)) throw new AppError("NOT_FOUND", "Dieses Anliegen gibt es nicht");
  const z = await sql`
    SELECT sl.*, p.name_de AS ort_name, l.public_ref AS listing_ref, u.display_name AS assigned_name
      FROM service_lead sl
      LEFT JOIN place p ON p.key = sl.place_key
      LEFT JOIN listing l ON l.id = sl.listing_id
      LEFT JOIN app_user u ON u.id = sl.assigned_staff_id
     WHERE sl.public_ref = ${publicRef} LIMIT 1`;
  const r = z[0];
  if (!r) throw new AppError("NOT_FOUND", "Dieses Anliegen gibt es nicht");

  const verlauf = await sql`
    SELECT al.created_at, al.action, al.previous_state, al.new_state, u2.display_name
      FROM audit_log al LEFT JOIN app_user u2 ON u2.id = al.actor_user_id
     WHERE al.entity_type = 'service_lead' AND al.entity_id = ${r.id}
     ORDER BY al.created_at DESC LIMIT 50`;

  return {
    publicRef: String(r.public_ref), service: String(r.service), status: String(r.status),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    closedAt: r.closed_at ? (r.closed_at instanceof Date ? r.closed_at.toISOString() : String(r.closed_at)) : null,
    contact: {
      name: String(r.contact_name), email: String(r.contact_email), phone: r.contact_phone ? String(r.contact_phone) : null,
      channel: String(r.preferred_channel), wunschdatum: r.preferred_date ? String(r.preferred_date) : null,
      wunschfenster: r.preferred_window ? String(r.preferred_window) : null
    },
    objekt: {
      ort: r.ort_name ? String(r.ort_name) : null,
      typ: r.property_kind ? (KIND_ZU_TYP[r.property_kind as keyof typeof KIND_ZU_TYP] ?? String(r.property_kind)) : null,
      zimmer: r.rooms != null ? Number(r.rooms) : null, flaeche: r.living_area_m2 != null ? Number(r.living_area_m2) : null,
      grundstueck: r.plot_area_m2 != null ? Number(r.plot_area_m2) : null, baujahr: r.built_year != null ? Number(r.built_year) : null,
      einheiten: r.units != null ? Number(r.units) : null, zustand: r.condition ? String(r.condition) : null,
      belegung: r.occupancy ? String(r.occupancy) : null, zeitpunkt: r.timing ? String(r.timing) : null,
      bereitsInseriert: r.already_listed != null ? Boolean(r.already_listed) : null,
      andererMakler: r.other_broker != null ? Boolean(r.other_broker) : null,
      leistungen: Array.isArray(r.services_wanted) ? r.services_wanted.map(String) : [],
      nachricht: r.message ? String(r.message) : null,
      listingRef: r.listing_ref ? String(r.listing_ref) : null
    },
    locale: String(r.locale),
    herkunft: { seite: r.source_page ? String(r.source_page) : null, kampagne: r.campaign ? String(r.campaign) : null },
    assignedStaff: r.assigned_staff_id ? { id: String(r.assigned_staff_id), name: String(r.assigned_name ?? "—") } : null,
    verlauf: verlauf.map(v => ({
      zeit: v.created_at instanceof Date ? v.created_at.toISOString() : String(v.created_at),
      aktion: String(v.action), von: v.previous_state ?? null, nach: v.new_state ?? null, wer: v.display_name ?? null
    }))
  };
}

/* ---------- Intern: Übergänge ----------
   Nur Zustände, die das System wirklich trägt (wie bei der Moderation):
   new → contacted | declined | closed
   contacted → qualified | closed | declined
   qualified → closed | declined
   Jeder andere Wechsel ist ein Konflikt, kein Validierungsfehler — der
   Zustand existiert, der Übergang nicht (§26). */
export const UEBERGAENGE: Record<LeadStatus, LeadStatus[]> = {
  new: ["contacted", "declined", "closed"],
  contacted: ["qualified", "closed", "declined"],
  qualified: ["closed", "declined"],
  closed: [],
  declined: []
};

export async function statusSetzen(person: Person, publicRef: string, status: string): Promise<{ status: string }> {
  /* Das Recht wird hier erneut geprüft — die Route hat es zwar schon
     verlangt, aber diese Funktion soll ohne eine vertrauende Aufruferin
     nicht falsch benutzt werden können. */
  if (!darf(person.rolle, "MANAGE_SERVICE_LEADS")) throw new AppError("FORBIDDEN", "Dafür fehlt Ihnen die Berechtigung");
  if (!(STATUS_WERTE as readonly string[]).includes(status)) throw new AppError("VALIDATION", "Unbekannter Status", { status: "ungültig" });
  const naechster = status as LeadStatus;

  const z = await sql`SELECT id, status FROM service_lead WHERE public_ref = ${publicRef} LIMIT 1`;
  const r = z[0];
  if (!r) throw new AppError("NOT_FOUND", "Dieses Anliegen gibt es nicht");
  const vorher = String(r.status) as LeadStatus;
  const erlaubt = UEBERGAENGE[vorher] ?? [];
  if (!erlaubt.includes(naechster)) throw new AppError("CONFLICT", "Dieser Statuswechsel ist nicht möglich");

  const schliesst = naechster === "closed" || naechster === "declined";
  await sql.begin(async tx => {
    if (schliesst) await tx`UPDATE service_lead SET status = ${naechster}, closed_at = now() WHERE id = ${r.id}`;
    else await tx`UPDATE service_lead SET status = ${naechster} WHERE id = ${r.id}`;
    await tx`INSERT INTO audit_log (actor_user_id, actor_role, action, entity_type, entity_id, previous_state, new_state)
             VALUES (${person.id}, ${person.rolle}, 'service_lead.status_changed', 'service_lead', ${r.id}, ${vorher}, ${naechster})`;
  });
  log.info("anliegen.status_geaendert", { anliegen: publicRef, von: vorher, nach: naechster, actor: person.id });
  return { status: naechster };
}

/* ---------- Intern: Personal für die Zuweisung ----------
   Nur FOURWALLS-Personal (staff/admin), nie gelöschte Konten — dieselbe
   Bedingung wie in `zuweisen()`, hier für die Auswahlliste im Formular. */
export interface PersonalEintrag { id: string; name: string }
export async function personalListe(): Promise<PersonalEintrag[]> {
  const z = await sql`
    SELECT id, display_name FROM app_user
     WHERE platform_role IN ('staff', 'admin') AND deleted_at IS NULL
     ORDER BY display_name`;
  return z.map(r => ({ id: String(r.id), name: String(r.display_name ?? "—") }));
}

export async function zuweisen(person: Person, publicRef: string, staffUserId: string | null): Promise<{ assignedStaffId: string | null }> {
  if (!darf(person.rolle, "ASSIGN_SERVICE_LEAD")) throw new AppError("FORBIDDEN", "Dafür fehlt Ihnen die Berechtigung");

  const z = await sql`SELECT id FROM service_lead WHERE public_ref = ${publicRef} LIMIT 1`;
  const r = z[0];
  if (!r) throw new AppError("NOT_FOUND", "Dieses Anliegen gibt es nicht");

  if (staffUserId != null) {
    if (!UUID.test(staffUserId)) throw new AppError("VALIDATION", "Ungültige Kennung", { assignedStaffId: "ungültig" });
    const u = await sql`SELECT platform_role FROM app_user WHERE id = ${staffUserId} AND deleted_at IS NULL LIMIT 1`;
    if (!u[0] || !["staff", "admin"].includes(String(u[0].platform_role))) {
      throw new AppError("VALIDATION", "Diese Person gehört nicht zum FOURWALLS-Team", { assignedStaffId: "ungültig" });
    }
  }

  await sql.begin(async tx => {
    await tx`UPDATE service_lead SET assigned_staff_id = ${staffUserId} WHERE id = ${r.id}`;
    await tx`INSERT INTO audit_log (actor_user_id, actor_role, action, entity_type, entity_id, new_state)
             VALUES (${person.id}, ${person.rolle}, 'service_lead.assigned', 'service_lead', ${r.id}, ${staffUserId})`;
  });
  log.info("anliegen.zugewiesen", { anliegen: publicRef, an: staffUserId, actor: person.id });
  return { assignedStaffId: staffUserId };
}
