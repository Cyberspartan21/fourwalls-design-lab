import "server-only";
import { sql } from "./db";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/log";
import { EntwurfSchema, type Entwurf } from "@/domain/entwurf";
import { darfFreigeben, darfAenderungVerlangen, darfAblehnen, darfVeroeffentlichen, darfPausieren, darfPruefen, type Person, type Status } from "@/domain/rechte";

/* Moderation — Prüfen, Ändern verlangen, Ablehnen, Freigeben, Veröffentlichen.

   Drei Regeln, die jede Aktion hier einhält:

   1. Der Browser nennt eine Absicht, nie einen Zustand. Es gibt kein
      «status = published», das man mitschicken könnte — nur `freigeben()`,
      `veroeffentlichen()` und so fort (§42).
   2. Freigabe und Veröffentlichung sind zwei Übergänge, weil das Schema sie
      trennt. Wer beides zugleich auslöst, durchläuft beide — im Protokoll
      stehen zwei Zeilen, nicht eine (§44).
   3. Eine Moderatorin darf ihr eigenes Inserat nicht freigeben. Das entscheidet
      `domain/rechte.ts`, nicht die Oberfläche (§74).

   Jeder Übergang läuft in einer Transaktion mit gesetztem `app.actor_id` und
   `app.reason`; der Trigger aus P5.1 schreibt daraus das Audit-Protokoll (§47). */

export type ModerationsGrund = "spam" | "fraud_suspected" | "duplicate" | "wrong_location" | "stolen_images" | "misleading_price" | "prohibited_content" | "incomplete" | "other";
export const GRUENDE: ModerationsGrund[] = ["incomplete", "misleading_price", "wrong_location", "prohibited_content", "stolen_images", "duplicate", "spam", "fraud_suspected", "other"];

export interface WarteEintrag {
  publicRef: string; status: Status; titel: string | null; eingereicht: string | null;
  ort: string | null; typ: string | null; trans: string; preis: number | null;
  herausgeber: string; herausgeberEmail: string; bilder: number; genauigkeit: string;
  durchgang: number;
}

/* ---------- Warteschlange ---------- */
export async function warteschlange(person: Person): Promise<WarteEintrag[]> {
  const z = await sql`
    SELECT l.public_ref, l.status, l.title, l.submitted_at, l.transaction, l.price_chf, l.rent_net_chf,
           l.draft_data, p.city, p.geo_precision, p.kind,
           u.display_name AS herausgeber, u.email AS herausgeber_email,
           (SELECT count(*)::int FROM listing_image li WHERE li.listing_id = l.id) AS bilder,
           (SELECT count(*)::int FROM moderation_case m WHERE m.listing_id = l.id) AS durchgang
      FROM listing l
      JOIN property p ON p.id = l.property_id
      LEFT JOIN app_user u ON u.id = l.published_by_user_id
     WHERE l.status IN ('submitted', 'in_review')
     ORDER BY l.submitted_at NULLS LAST, l.public_ref`;
  void person;
  return z.map(r => {
    const d = EntwurfSchema.parse(r.draft_data ?? {});
    return {
      publicRef: String(r.public_ref), status: r.status as Status, titel: r.title ?? d.titel,
      eingereicht: r.submitted_at instanceof Date ? r.submitted_at.toISOString() : (r.submitted_at ? String(r.submitted_at) : null),
      ort: r.city || null, typ: r.kind ?? null, trans: String(r.transaction),
      preis: r.price_chf != null ? Number(r.price_chf) / 100 : (r.rent_net_chf != null ? Number(r.rent_net_chf) / 100 : null),
      herausgeber: String(r.herausgeber ?? "—"), herausgeberEmail: String(r.herausgeber_email ?? "—"),
      bilder: Number(r.bilder), genauigkeit: String(r.geo_precision), durchgang: Number(r.durchgang)
    };
  });
}

/* ---------- Ein Fall ---------- */
export interface Fall {
  publicRef: string; status: Status; version: number; daten: Entwurf;
  herausgeber: { name: string; email: string; bestaetigt: boolean; inserate: number };
  eingereicht: string | null; ort: string | null; genauigkeit: string; bilder: { id: string; url: string }[];
  verlauf: { zeit: string; aktion: string; von: string | null; nach: string | null; grund: string | null; wer: string | null }[];
}

async function fallLaden(publicRef: string) {
  if (!/^FWL-\d{4}-\d{6}$/.test(publicRef)) return null;
  const z = await sql`
    SELECT l.id, l.public_ref, l.status, l.version, l.draft_data, l.published_by_user_id, l.submitted_at,
           p.city, p.geo_precision,
           u.display_name, u.email, u.email_verified,
           (SELECT count(*)::int FROM listing l2 WHERE l2.published_by_user_id = l.published_by_user_id) AS inserate
      FROM listing l JOIN property p ON p.id = l.property_id
      LEFT JOIN app_user u ON u.id = l.published_by_user_id
     WHERE l.public_ref = ${publicRef} LIMIT 1`;
  return z[0] ?? null;
}

export async function fallLesen(person: Person, publicRef: string): Promise<Fall> {
  const r = await fallLaden(publicRef);
  if (!r) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");
  const inserat = { ownerId: r.published_by_user_id ? String(r.published_by_user_id) : null, status: r.status as Status };
  /* Zur Ansicht genügt das Prüfrecht — auch für bereits freigegebene oder
     veröffentlichte Inserate, damit die Moderation ihre Entscheide nachsehen kann. */
  const pruefbar = darfPruefen(person, inserat).erlaubt || darfVeroeffentlichen(person, inserat).erlaubt || darfPausieren(person, inserat).erlaubt;
  if (!pruefbar) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");

  const [bilder, verlauf] = await Promise.all([
    sql`SELECT a.id, v.storage_key FROM listing_image li JOIN media_asset a ON a.id = li.asset_id
          LEFT JOIN media_variant v ON v.asset_id = a.id AND v.width = 960 AND v.format = 'jpeg'
         WHERE li.listing_id = ${r.id} ORDER BY li.sort_order`,
    sql`SELECT al.created_at, al.action, al.previous_state, al.new_state, al.reason, u.display_name
          FROM audit_log al LEFT JOIN app_user u ON u.id = al.actor_user_id
         WHERE al.entity_type = 'listing' AND al.entity_id = ${r.id}
         ORDER BY al.created_at DESC LIMIT 50`
  ]);

  return {
    publicRef: String(r.public_ref), status: r.status as Status, version: Number(r.version),
    daten: EntwurfSchema.parse(r.draft_data ?? {}),
    herausgeber: { name: String(r.display_name ?? "—"), email: String(r.email ?? "—"), bestaetigt: Boolean(r.email_verified), inserate: Number(r.inserate) },
    eingereicht: r.submitted_at instanceof Date ? r.submitted_at.toISOString() : (r.submitted_at ? String(r.submitted_at) : null),
    ort: r.city || null, genauigkeit: String(r.geo_precision),
    bilder: bilder.map(b => ({ id: String(b.id), url: b.storage_key ? "/media/" + String(b.storage_key).replace(/^demo\//, "") : "" })),
    verlauf: verlauf.map(v => ({
      zeit: v.created_at instanceof Date ? v.created_at.toISOString() : String(v.created_at),
      aktion: String(v.action), von: v.previous_state ?? null, nach: v.new_state ?? null,
      grund: v.reason ?? null, wer: v.display_name ?? null
    }))
  };
}

/* ---------- Übergänge ---------- */
type Absicht = "freigeben" | "aenderung" | "ablehnen" | "veroeffentlichen" | "pausieren";

async function pruefeUndLade(person: Person, publicRef: string, absicht: Absicht) {
  const r = await fallLaden(publicRef);
  if (!r) throw new AppError("NOT_FOUND", "Dieses Inserat gibt es nicht");
  const inserat = { ownerId: r.published_by_user_id ? String(r.published_by_user_id) : null, status: r.status as Status };
  const e = { freigeben: darfFreigeben, aenderung: darfAenderungVerlangen, ablehnen: darfAblehnen,
    veroeffentlichen: darfVeroeffentlichen, pausieren: darfPausieren }[absicht](person, inserat);
  if (!e.erlaubt) {
    if (e.grund === "kein-recht") throw new AppError("FORBIDDEN", "Dafür fehlt Ihnen die Berechtigung");
    if (e.grund === "eigenes-inserat") throw new AppError("FORBIDDEN", "Ihr eigenes Inserat kann jemand anderes prüfen");
    throw new AppError("CONFLICT", "Dieses Inserat ist nicht im passenden Zustand");
  }
  return r;
}

/* Freigeben: geprüft und in Ordnung — aber noch nicht öffentlich. */
export async function freigeben(person: Person, publicRef: string, notiz?: string): Promise<void> {
  const r = await pruefeUndLade(person, publicRef, "freigeben");
  await sql.begin(async tx => {
    await tx`SELECT set_config('app.actor_id', ${person.id}, true), set_config('app.reason', 'geprüft und freigegeben', true)`;
    await tx`UPDATE listing SET status = 'in_review' WHERE id = ${r.id} AND status = 'submitted'`;
    await tx`UPDATE listing SET status = 'approved' WHERE id = ${r.id}`;
    await tx`UPDATE moderation_case SET assigned_to = ${person.id}, notes = ${notiz ?? null}, outcome = 'freigegeben'
              WHERE listing_id = ${r.id} AND closed_at IS NULL`;
  });
  log.info("moderation.freigegeben", { listing: publicRef, actor: person.id });
}

/* Änderung verlangen: geht zurück an die Eigentümerin, mit Begründung.
   Ohne Nachricht keine Rückgabe — eine leere Absage hilft niemandem (§45). */
export async function aenderungVerlangen(person: Person, publicRef: string, nachricht: string, grund: ModerationsGrund): Promise<void> {
  const text = String(nachricht ?? "").trim();
  if (text.length < 10) throw new AppError("VALIDATION", "Bitte schreiben Sie, was geändert werden soll", { nachricht: "zu kurz" });
  if (text.length > 2000) throw new AppError("VALIDATION", "Die Rückmeldung ist zu lang", { nachricht: "zu lang" });
  if (!GRUENDE.includes(grund)) throw new AppError("VALIDATION", "Unbekannter Grund", { grund: "ungültig" });
  const r = await pruefeUndLade(person, publicRef, "aenderung");
  await sql.begin(async tx => {
    await tx`SELECT set_config('app.actor_id', ${person.id}, true), set_config('app.reason', ${"Änderung verlangt: " + grund}, true)`;
    await tx`UPDATE listing SET status = 'in_review' WHERE id = ${r.id} AND status = 'submitted'`;
    await tx`UPDATE listing SET status = 'changes_required' WHERE id = ${r.id}`;
    await tx`UPDATE moderation_case SET assigned_to = ${person.id}, message_to_owner = ${text}, reason = ${grund},
                    outcome = 'aenderung_verlangt', closed_at = now()
              WHERE listing_id = ${r.id} AND closed_at IS NULL`;
  });
  log.info("moderation.aenderung", { listing: publicRef, actor: person.id, grund });
}

/* Ablehnen: nicht löschen, sondern kennzeichnen — der Verlauf bleibt (§46). */
export async function ablehnen(person: Person, publicRef: string, nachricht: string, grund: ModerationsGrund): Promise<void> {
  const text = String(nachricht ?? "").trim();
  if (text.length < 10) throw new AppError("VALIDATION", "Eine Ablehnung braucht eine Begründung", { nachricht: "zu kurz" });
  if (!GRUENDE.includes(grund)) throw new AppError("VALIDATION", "Unbekannter Grund", { grund: "ungültig" });
  const r = await pruefeUndLade(person, publicRef, "ablehnen");
  await sql.begin(async tx => {
    await tx`SELECT set_config('app.actor_id', ${person.id}, true), set_config('app.reason', ${"Abgelehnt: " + grund}, true)`;
    await tx`UPDATE listing SET status = 'in_review' WHERE id = ${r.id} AND status = 'submitted'`;
    await tx`UPDATE listing SET status = 'rejected' WHERE id = ${r.id}`;
    await tx`UPDATE moderation_case SET assigned_to = ${person.id}, message_to_owner = ${text}, reason = ${grund},
                    outcome = 'abgelehnt', closed_at = now()
              WHERE listing_id = ${r.id} AND closed_at IS NULL`;
  });
  log.info("moderation.abgelehnt", { listing: publicRef, actor: person.id, grund });
}

/* Veröffentlichen: der Übergang, der das Inserat in den Marktplatz stellt.
   Slug, Veröffentlichungszeit und Indexierbarkeit entstehen hier — alles in
   einer Transaktion, damit es kein halb veröffentlichtes Inserat gibt (§77). */
export async function veroeffentlichen(person: Person, publicRef: string): Promise<void> {
  const r = await pruefeUndLade(person, publicRef, "veroeffentlichen");
  const d = EntwurfSchema.parse(r.draft_data ?? {});
  await sql.begin(async tx => {
    await tx`SELECT set_config('app.actor_id', ${person.id}, true), set_config('app.reason', 'veröffentlicht', true)`;
    const slug = await freierSlug(tx, d.titel ?? "inserat", String(r.id));
    await tx`INSERT INTO listing_slug (slug, listing_id, is_current) VALUES (${slug}, ${r.id}, true)
             ON CONFLICT (slug) DO NOTHING`;
    await tx`UPDATE listing SET slug = ${slug}, status = 'published', published_at = now(), is_indexable = true
              WHERE id = ${r.id}`;
    await tx`UPDATE moderation_case SET assigned_to = ${person.id}, outcome = 'veröffentlicht', closed_at = now()
              WHERE listing_id = ${r.id} AND closed_at IS NULL`;
  });
  log.info("moderation.veroeffentlicht", { listing: publicRef, actor: person.id });
}

export async function pausieren(person: Person, publicRef: string, grund?: string): Promise<void> {
  const r = await pruefeUndLade(person, publicRef, "pausieren");
  await sql.begin(async tx => {
    await tx`SELECT set_config('app.actor_id', ${person.id}, true), set_config('app.reason', ${grund ?? "pausiert"}, true)`;
    await tx`UPDATE listing SET status = 'paused', is_indexable = false WHERE id = ${r.id}`;
  });
  log.info("moderation.pausiert", { listing: publicRef, actor: person.id });
}

/* Ein lesbarer, eindeutiger Slug. Die öffentliche Referenz bleibt der
   Schlüssel — der Slug ist Lesbarkeit und darf sich ändern (§53). */
type Tx = typeof sql;
async function freierSlug(tx: Tx, titel: string, listingId: string): Promise<string> {
  const basis = titel.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ä/gi, "ae").replace(/ö/gi, "oe").replace(/ü/gi, "ue").replace(/ß/g, "ss")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "inserat";
  for (let i = 0; i < 30; i++) {
    const kandidat = i === 0 ? basis : `${basis}-${i + 1}`;
    const belegt = await tx`SELECT listing_id FROM listing_slug WHERE slug = ${kandidat} LIMIT 1`;
    if (!belegt[0] || String(belegt[0].listing_id) === listingId) return kandidat;
  }
  return `${basis}-${Date.now().toString(36)}`;
}
