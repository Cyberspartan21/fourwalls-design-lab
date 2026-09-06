import "server-only";
import { sql } from "./db";
import { listeFavoriten } from "./favoriten";
import { meineSuchen } from "./gespeicherteSuchen";
import { meineAnfragen } from "./inquiries";
import { meineAnliegen } from "./anliegen";
import { meineInserate } from "./entwuerfe";
import { meineOrganisationen } from "./org-kontext";
import type { Person } from "@/domain/rechte";

/* Export der eigenen Daten (P5.10 §12, DSGVO/DSG-Auskunftsrecht).

   Ausdrücklich NUR die eigenen Daten der anfragenden Person — keine fremden
   Daten, keine Passwort-Hashes, keine internen Datenbank-Kennungen (die
   öffentliche Referenz FWL-…/FWS-… ist keine interne Kennung, sie steht schon
   auf der Objektseite). Wo eine bestehende Funktion mehr zurückgibt, als in
   den Export gehört (z. B. `meineInserate` mit dem vollständigen
   Assistentenstand), wird hier auf das öffentlich Relevante plus Status
   verkürzt — kein interner Entwurfszustand, keine Kontaktfelder in voller
   Rohform, obwohl es die eigenen wären: der Export zeigt, was ein Inserat
   nach aussen ausmacht, nicht das gesamte Formular. */

export interface KontoExport {
  erstelltAm: string;
  profil: { email: string; name: string; telefon: string | null; sprache: string; erstelltAm: string };
  favoriten: string[];
  gespeicherteSuchen: { label: string | null; anfrage: unknown; haeufigkeit: string; bestaetigt: boolean; erstelltAm: string }[];
  zuletztAngesehen: { publicRef: string; angesehenAm: string }[];
  eigeneInserate: { publicRef: string; status: string; titel: string | null; transaktion: string | null; preis: number | null; ort: string | null; aktualisiertAm: string }[];
  anfragen: { publicRef: string; art: string; status: string; nachricht: string; erstelltAm: string; inserat: { publicRef: string; titel: string } | null }[];
  anliegen: { publicRef: string; dienst: string; status: string; ort: string | null; nachricht: string | null; erstelltAm: string }[];
  organisationsmitgliedschaften: { organisation: string; rolle: string }[];
}

export async function kontoExportieren(person: Person, email: string): Promise<KontoExport> {
  const [profilZeile] = await sql`SELECT display_name, phone, locale, created_at FROM app_user WHERE id = ${person.id} LIMIT 1`;
  const alsZeit = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

  const [favoriten, suchen, verlauf, inserate, anfragen, anliegen, organisationen] = await Promise.all([
    listeFavoriten(person.id),
    meineSuchen(person.id),
    sql`SELECT l.public_ref, rv.viewed_at
          FROM recently_viewed rv JOIN listing l ON l.id = rv.listing_id
         WHERE rv.user_id = ${person.id} ORDER BY rv.viewed_at DESC LIMIT 200`,
    meineInserate(person),
    meineAnfragen(person.id),
    meineAnliegen(person.id),
    meineOrganisationen(person.id)
  ]);

  return {
    erstelltAm: new Date().toISOString(),
    profil: {
      email,
      name: String(profilZeile?.display_name ?? ""),
      telefon: profilZeile?.phone != null ? String(profilZeile.phone) : null,
      sprache: String(profilZeile?.locale ?? "de"),
      erstelltAm: profilZeile?.created_at ? alsZeit(profilZeile.created_at) : ""
    },
    favoriten,
    gespeicherteSuchen: suchen.map(s => ({
      label: s.label, anfrage: s.query, haeufigkeit: s.alert.frequency,
      bestaetigt: s.alert.confirmedAt != null, erstelltAm: s.createdAt
    })),
    zuletztAngesehen: verlauf.map(r => ({ publicRef: String(r.public_ref), angesehenAm: alsZeit(r.viewed_at) })),
    eigeneInserate: inserate.map(i => ({
      publicRef: i.publicRef, status: i.status, titel: i.daten.titel,
      transaktion: i.daten.trans, preis: i.daten.preis, ort: i.daten.ortId,
      aktualisiertAm: i.aktualisiert
    })),
    anfragen: anfragen.map(a => ({
      publicRef: a.publicRef, art: a.kind, status: a.status, nachricht: a.message, erstelltAm: a.createdAt,
      inserat: a.listing ? { publicRef: a.listing.publicRef, titel: a.listing.title } : null
    })),
    anliegen: anliegen.map(a => ({
      publicRef: a.publicRef, dienst: a.service, status: a.status, ort: a.ort, nachricht: a.nachricht, erstelltAm: a.createdAt
    })),
    organisationsmitgliedschaften: organisationen.map(o => ({ organisation: o.org.displayName, rolle: o.rolle }))
  };
}
