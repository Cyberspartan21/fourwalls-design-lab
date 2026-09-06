import { test } from "node:test";
import assert from "node:assert/strict";
import { bereitschaftAus, type BereitschaftsEingaben } from "../domain/bereitschaft.ts";

/* Eine vollständig „grüne" Eingabe — jedes der vier Tore für sich bereit,
   also launchReady insgesamt wahr. Jeder Testfall unten verändert genau
   EIN Feld eines EINZIGEN Tors und prüft, dass genau dieses Tor kippt,
   die anderen drei aber unberührt bleiben (P5.10 §3: die vier Tore
   verschmelzen nie zu einem Boolean ausser in launchReady). */
function gut(): BereitschaftsEingaben {
  return {
    tech: {
      migrationenAktuell: true, migrationenBeleg: "19/19 Migrationen angewendet",
      envGueltig: true, envBeleg: "Umgebungsschema gültig",
      outboxAktiv: true, outboxBeleg: "instrumentation.ts registriert den Outbox-Arbeiter",
      speicherKonfiguriert: true, speicherBeleg: "Objektspeicher: S3 konfiguriert",
      sitemapRobotsVorhanden: true, sitemapRobotsBeleg: "robots.ts und sitemap.ts vorhanden",
      ciSuitesVorhanden: true, ciSuitesBeleg: "22 Integrationsskripte, 17 Unit-Testdateien"
    },
    business: {
      firmenfelder: [
        { feld: "markenname", titel: "Markenname", stand: "bestaetigt" },
        { feld: "email", titel: "E-Mail", stand: "bestaetigt" }
      ],
      offeneAussagen: [
        { schluessel: "honorarNurBeiErfolg", hatEntscheid: true } // KEEP_PLANNED, aber entschieden → ok
      ]
    },
    legal: {
      rechtsseiten: [
        { key: "impressum", titel: "Impressum", freigegeben: true },
        { key: "datenschutz", titel: "Datenschutzerklärung", freigegeben: true }
      ]
    },
    infra: {
      appEnvProduktion: true, siteUrlOk: true, mailOk: true, storageOk: true, datenbankOk: true,
      backupNachweisVorhanden: true, backupNachweisBeleg: "Backup-Nachweis vorhanden und aktuell (<30 Tage)."
    }
  };
}

test("TECH/BUSINESS bereit, LEGAL/INFRA bleiben wegen fester Blocker unbereit; Belegfelder tragen keine Geheimnisse", () => {
  const e = gut();
  // Der feste Aufbewahrungspunkt und der Domain/DNS/HTTPS-Punkt sind IMMER
  // unentschieden bzw. fehlend — launchReady kann mit der reinen bereitschaftAus()
  // also nie „versehentlich" wahr werden, solange diese zwei Punkte nicht aus
  // dem Modell entfernt werden. Diese Erwartung ist Absicht (P5.10 §4/§40):
  // die Aufbewahrung bleibt unentschieden, Domain/DNS/HTTPS ohne Netzaufruf ungeprüft.
  const r = bereitschaftAus(e);
  assert.equal(r.techReady, true);
  assert.equal(r.businessReady, true);
  assert.equal(r.legalReady, false, "retention ist immer ein fester, unentschiedener Blocker");
  assert.equal(r.infraReady, false, "domain_dns_https ist immer ein fester, ungeprüfter Blocker");
  assert.equal(r.launchReady, false);
  for (const gruppe of Object.values(r.tore)) {
    for (const p of gruppe) {
      assert.ok(typeof p.id === "string" && p.id.length > 0);
      assert.ok(typeof p.beleg === "string");
      assert.ok(!/localhost|127\.0\.0\.1|@.*\./.test(p.beleg), `Beleg „${p.beleg}" sieht nach Konfigurationswert statt neutralem Text aus`);
    }
  }
});

test("TECH kippt allein, wenn Migrationen nicht aktuell sind", () => {
  const e = gut();
  e.tech.migrationenAktuell = false; e.tech.migrationenBeleg = "18/19 Migrationen angewendet";
  const r = bereitschaftAus(e);
  assert.equal(r.techReady, false);
  assert.equal(r.businessReady, true);
  assert.equal(r.launchReady, false);
  const punkt = r.tore.tech.find(p => p.id === "migrationen")!;
  assert.equal(punkt.status, "fehlt");
  assert.equal(punkt.blocker, true);
});

test("TECH kippt, wenn das Umgebungsschema ungültig ist", () => {
  const e = gut();
  e.tech.envGueltig = false; e.tech.envBeleg = "Umgebungsschema ungültig";
  const r = bereitschaftAus(e);
  assert.equal(r.techReady, false);
  assert.equal(r.tore.tech.find(p => p.id === "umgebung")!.status, "fehlt");
});

test("BUSINESS kippt allein, wenn ein Firmenfeld nicht bestätigt ist (platzhalter oder offen)", () => {
  const ePlatzhalter = gut();
  ePlatzhalter.business.firmenfelder[0]!.stand = "platzhalter";
  const r1 = bereitschaftAus(ePlatzhalter);
  assert.equal(r1.businessReady, false);
  assert.equal(r1.techReady, true);
  assert.equal(r1.tore.business.find(p => p.id === "firma_markenname")!.status, "fehlt");

  const eOffen = gut();
  eOffen.business.firmenfelder[1]!.stand = "offen";
  const r2 = bereitschaftAus(eOffen);
  assert.equal(r2.businessReady, false);
  assert.equal(r2.tore.business.find(p => p.id === "firma_email")!.status, "unentschieden");
});

test("BUSINESS kippt, wenn eine Geschäftsaussage ohne Entscheid ist — mit Entscheid (auch KEEP_PLANNED) bleibt es ok", () => {
  const eOk = gut(); // hatEntscheid: true bei einer KEEP_PLANNED-Aussage
  assert.equal(bereitschaftAus(eOk).businessReady, true);

  const eOhne = gut();
  eOhne.business.offeneAussagen = [{ schluessel: "kaeuferliste", hatEntscheid: false }];
  const r = bereitschaftAus(eOhne);
  assert.equal(r.businessReady, false);
  assert.equal(r.tore.business.find(p => p.id === "aussage_kaeuferliste")!.status, "unentschieden");
});

test("LEGAL kippt allein, wenn eine Rechtsseite nicht freigegeben ist", () => {
  const e = gut();
  e.legal.rechtsseiten[0]!.freigegeben = false;
  const r = bereitschaftAus(e);
  assert.equal(r.legalReady, false);
  assert.equal(r.businessReady, true);
  assert.equal(r.infraReady, false); // war schon wegen domain_dns_https unbereit — bleibt es
  assert.equal(r.tore.legal.find(p => p.id === "recht_impressum")!.status, "unentschieden");
});

test("LEGAL enthält immer den festen, unentschiedenen Aufbewahrungspunkt", () => {
  const r = bereitschaftAus(gut());
  const retention = r.tore.legal.find(p => p.id === "retention")!;
  assert.equal(retention.status, "unentschieden");
  assert.equal(retention.blocker, true);
  assert.match(retention.beleg, /UNDECIDED/);
});

test("INFRA kippt allein je Punkt (Umgebung, Adresse, Mail, Speicher, Datenbank, Backup)", () => {
  const felder: (keyof BereitschaftsEingaben["infra"])[] = ["appEnvProduktion", "siteUrlOk", "mailOk", "storageOk", "datenbankOk", "backupNachweisVorhanden"];
  for (const feld of felder) {
    const e = gut();
    (e.infra as unknown as Record<string, boolean>)[feld] = false;
    const r = bereitschaftAus(e);
    assert.equal(r.infraReady, false, `infraReady sollte wegen ${feld} kippen`);
    assert.equal(r.techReady, true, `techReady sollte von ${feld} unberührt bleiben`);
    assert.equal(r.businessReady, true, `businessReady sollte von ${feld} unberührt bleiben`);
  }
});

test("INFRA enthält immer den festen, ungeprüften Domain/DNS/HTTPS-Punkt ohne Netzaufruf", () => {
  const r = bereitschaftAus(gut());
  const punkt = r.tore.infra.find(p => p.id === "domain_dns_https")!;
  assert.equal(punkt.status, "fehlt");
  assert.equal(punkt.blocker, true);
});

test("launchReady ist nur wahr, wenn alle vier Tore bereit sind", () => {
  const alleBereit = gut();
  // Die zwei bewusst festen Blocker (retention, domain_dns_https) lassen sich
  // in bereitschaftAus() nicht wegkonfigurieren — das ist die Absicht. Für
  // diesen einen Test wird bereitschaftAus() daher zweimal aufgerufen und nur
  // die drei „echten" Tore variiert; launchReady bleibt in diesem Modell so
  // lange falsch, wie mindestens ein fester Blocker besteht.
  const r = bereitschaftAus(alleBereit);
  assert.equal(r.launchReady, r.techReady && r.businessReady && r.legalReady && r.infraReady);
  assert.equal(r.launchReady, false);

  const nochSchlechter = gut();
  nochSchlechter.tech.migrationenAktuell = false;
  const r2 = bereitschaftAus(nochSchlechter);
  assert.equal(r2.launchReady, false);
  assert.equal(r2.techReady, false);
});
