/* Das Bereitschaftsmodell — reine Ableitung, kein fs/db (P5.10 §3/§4).

   Vier Tore, die NIE zu einem einzigen Boolean verschmelzen:
     TECH      kann die Anwendung technisch produktiv laufen?
     BUSINESS  hat der Inhaber die öffentlichen Geschäftsaussagen entschieden?
     LEGAL     sind die Rechtstexte freigegeben?
     INFRA     ist die Infrastruktur (Domain, Mail, Speicher, Backup) produktionsreif?

   `launchReady` ist wahr, wenn ALLE VIER wahr sind — sonst nie. Ein Tor
   allein „ready" zu nennen sagt nichts über den Start aus; das ist Absicht,
   nicht eine fehlende Abkürzung.

   Diese Datei liest nichts selbst (kein fs, kein db, kein „server-only"):
   config/bereitschaft.ts sammelt die Tatsachen (Migrationen, env(), Dateien)
   und ruft `bereitschaftAus()` mit ihnen auf. So bleibt die Ableitungslogik
   unter node --test prüfbar (siehe tests/bereitschaft.test.ts), ohne eine
   echte Datenbank oder einen Next.js-Prozess zu brauchen. */

export type BereitschaftStatus = "ok" | "fehlt" | "unentschieden";

export type Punkt = {
  id: string;
  titel: string;
  status: BereitschaftStatus;
  blocker: boolean;
  beleg: string;
};

export type FirmenfeldStand = "bestaetigt" | "platzhalter" | "offen";

export type BereitschaftsEingaben = {
  tech: {
    migrationenAktuell: boolean; migrationenBeleg: string;
    envGueltig: boolean; envBeleg: string;
    outboxAktiv: boolean; outboxBeleg: string;
    speicherKonfiguriert: boolean; speicherBeleg: string;
    sitemapRobotsVorhanden: boolean; sitemapRobotsBeleg: string;
    ciSuitesVorhanden: boolean; ciSuitesBeleg: string;
  };
  business: {
    firmenfelder: { feld: string; titel: string; stand: FirmenfeldStand }[];
    offeneAussagen: { schluessel: string; hatEntscheid: boolean }[];
  };
  legal: {
    rechtsseiten: { key: string; titel: string; freigegeben: boolean }[];
  };
  infra: {
    appEnvProduktion: boolean;
    siteUrlOk: boolean;
    mailOk: boolean;
    storageOk: boolean;
    datenbankOk: boolean;
    backupNachweisVorhanden: boolean; backupNachweisBeleg: string;
  };
};

export type BereitschaftsErgebnis = {
  techReady: boolean;
  businessReady: boolean;
  legalReady: boolean;
  infraReady: boolean;
  launchReady: boolean;
  tore: { tech: Punkt[]; business: Punkt[]; legal: Punkt[]; infra: Punkt[] };
};

/* Ein Tor ist bereit, wenn kein blockierender Punkt fehlt oder unentschieden ist. */
const torBereit = (punkte: Punkt[]) => punkte.every(p => p.status === "ok" || !p.blocker);

export function bereitschaftAus(e: BereitschaftsEingaben): BereitschaftsErgebnis {
  const tech: Punkt[] = [
    { id: "migrationen", titel: "Datenbankmigrationen aktuell", status: e.tech.migrationenAktuell ? "ok" : "fehlt", blocker: true, beleg: e.tech.migrationenBeleg },
    { id: "umgebung", titel: "Umgebungsschema gültig", status: e.tech.envGueltig ? "ok" : "fehlt", blocker: true, beleg: e.tech.envBeleg },
    { id: "outbox", titel: "Outbox-Arbeiter aktiv", status: e.tech.outboxAktiv ? "ok" : "fehlt", blocker: true, beleg: e.tech.outboxBeleg },
    { id: "speicher", titel: "Speicher-Provider konfiguriert", status: e.tech.speicherKonfiguriert ? "ok" : "fehlt", blocker: true, beleg: e.tech.speicherBeleg },
    { id: "sitemap_robots", titel: "Sitemap/robots vorhanden", status: e.tech.sitemapRobotsVorhanden ? "ok" : "fehlt", blocker: true, beleg: e.tech.sitemapRobotsBeleg },
    { id: "ci_suites", titel: "CI-Testsuiten vorhanden", status: e.tech.ciSuitesVorhanden ? "ok" : "fehlt", blocker: true, beleg: e.tech.ciSuitesBeleg }
  ];

  const business: Punkt[] = [
    ...e.business.firmenfelder.map((f): Punkt => ({
      id: `firma_${f.feld}`,
      titel: f.titel,
      status: f.stand === "bestaetigt" ? "ok" : f.stand === "offen" ? "unentschieden" : "fehlt",
      blocker: f.stand !== "bestaetigt",
      beleg: f.stand === "bestaetigt" ? "bestätigt" : f.stand === "offen" ? "offen — nichts hinterlegt" : "Platzhalter, noch nicht bestätigt"
    })),
    ...e.business.offeneAussagen.map((a): Punkt => ({
      id: `aussage_${a.schluessel}`,
      titel: `Geschäftsaussage: ${a.schluessel}`,
      status: a.hatEntscheid ? "ok" : "unentschieden",
      blocker: !a.hatEntscheid,
      beleg: a.hatEntscheid ? "Geschäftsentscheid getroffen" : "ohne Geschäftsentscheid"
    }))
  ];

  const legal: Punkt[] = [
    ...e.legal.rechtsseiten.map((r): Punkt => ({
      id: `recht_${r.key}`,
      titel: r.titel,
      status: r.freigegeben ? "ok" : "unentschieden",
      blocker: !r.freigegeben,
      beleg: r.freigegeben ? "freigegeben" : "LEGAL_REVIEW_REQUIRED"
    })),
    { id: "retention", titel: "Aufbewahrung/Löschfristen", status: "unentschieden", blocker: true, beleg: "UNDECIDED / LEGAL REVIEW REQUIRED (P5.10)" }
  ];

  const infra: Punkt[] = [
    { id: "app_env", titel: "Umgebung auf production gesetzt", status: e.infra.appEnvProduktion ? "ok" : "fehlt", blocker: true, beleg: e.infra.appEnvProduktion ? "Umgebung ist production." : "Umgebung ist nicht production." },
    { id: "site_url", titel: "Öffentliche Adresse produktionsreif", status: e.infra.siteUrlOk ? "ok" : "fehlt", blocker: true, beleg: e.infra.siteUrlOk ? "Öffentliche Adresse ist https und nicht lokal." : "Öffentliche Adresse ist lokal oder nicht https." },
    { id: "mail", titel: "Mailversand produktionsreif", status: e.infra.mailOk ? "ok" : "fehlt", blocker: true, beleg: e.infra.mailOk ? "Mailversand: Produktionsanbieter." : "Mailversand: Entwicklungssenke." },
    { id: "speicher_infra", titel: "Objektspeicher produktionsreif", status: e.infra.storageOk ? "ok" : "fehlt", blocker: true, beleg: e.infra.storageOk ? "Objektspeicher: externer Anbieter." : "Objektspeicher: lokal oder kein externer Endpunkt." },
    { id: "datenbank", titel: "Datenbank produktionsreif", status: e.infra.datenbankOk ? "ok" : "fehlt", blocker: true, beleg: e.infra.datenbankOk ? "Datenbank ist keine lokale Adresse." : "Datenbank ist eine lokale Adresse." },
    { id: "backup", titel: "Backup-Nachweis vorhanden", status: e.infra.backupNachweisVorhanden ? "ok" : "fehlt", blocker: true, beleg: e.infra.backupNachweisBeleg },
    { id: "domain_dns_https", titel: "Domain/DNS/HTTPS geprüft", status: "fehlt", blocker: true, beleg: "Kein Nachweis geprüft (kein Netzaufruf im Bereitschaftscheck)." }
  ];

  const techReady = torBereit(tech), businessReady = torBereit(business), legalReady = torBereit(legal), infraReady = torBereit(infra);

  return {
    techReady, businessReady, legalReady, infraReady,
    launchReady: techReady && businessReady && legalReady && infraReady,
    tore: { tech, business, legal, infra }
  };
}
