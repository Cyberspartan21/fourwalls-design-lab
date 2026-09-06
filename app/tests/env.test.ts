import { test } from "node:test";
import assert from "node:assert/strict";
import { pruefe } from "../domain/env.ts";

/* Prüft domain/env.ts direkt mit selbstgebauten Objekten — nie process.env.
   server/env.ts trägt „server-only" und ist deshalb unter node --test nicht
   importierbar; die Prüflogik selbst liegt in domain/env.ts (rein). */

const BASIS_DEV = { APP_ENV: "development", DATABASE_URL: "postgres://u:p@localhost:5432/db" };

const BASIS_PROD = {
  APP_ENV: "production",
  DATABASE_URL: "postgres://u:p@db.example.internal:5432/fourwalls?sslmode=verify-full",
  NEXT_PUBLIC_SITE_URL: "https://www.fourwalls.ch",
  STORAGE_PROVIDER: "s3",
  MAIL_PROVIDER: "smtp",
  MAIL_FROM: "noreply@fourwalls.ch",
  SERVICE_LEAD_INBOX: "anliegen@fourwalls.ch",
  APP_SECRET: "a".repeat(32),
  DEMO_INHALTE: "aus",
  S3_ENDPOINT: "https://sos-ch-gva-2.exo.io",
  S3_BUCKET_PRIVATE: "fw-prod-privat",
  S3_BUCKET_PUBLIC: "fw-prod-oeffentlich",
  S3_ACCESS_KEY_ID: "x",
  S3_SECRET_ACCESS_KEY: "y",
  SMTP_HOST: "mail.infomaniak.com",
  SMTP_USER: "u",
  SMTP_PASSWORD: "p"
};

test("Entwicklung: minimale Angaben genügen, Defaults greifen", () => {
  const r = pruefe(BASIS_DEV);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.daten.STORAGE_PROVIDER, "local");
    assert.equal(r.daten.MAIL_PROVIDER, "dev");
    assert.equal(r.daten.DEMO_INHALTE, undefined);
  }
});

test("Produktion: vollständiger, gültiger Fall geht durch", () => {
  const r = pruefe(BASIS_PROD);
  assert.equal(r.ok, true, r.ok ? "" : r.fehler.join("; "));
});

test("Produktion ohne DEMO_INHALTE scheitert explizit", () => {
  const { DEMO_INHALTE, ...ohne } = BASIS_PROD;
  const r = pruefe(ohne);
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.fehler.some(f => f.includes("DEMO_INHALTE")));
});

test("Produktion ohne APP_SECRET scheitert; unter 32 Zeichen ebenfalls (Schema)", () => {
  const { APP_SECRET, ...ohne } = BASIS_PROD;
  const r = pruefe(ohne);
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.fehler.some(f => f.includes("APP_SECRET")));
  const rKurz = pruefe({ ...BASIS_PROD, APP_SECRET: "zu-kurz" });
  assert.equal(rKurz.ok, false);
});

test("Produktion mit bekanntem CI-/Build-Platzhalter als APP_SECRET scheitert", () => {
  const r1 = pruefe({ ...BASIS_PROD, APP_SECRET: "ci-only-nicht-geheim-0000000000000000" });
  assert.equal(r1.ok, false);
  const r2 = pruefe({ ...BASIS_PROD, APP_SECRET: "build-stufe-platzhalter-keine-echten-daten-00" });
  assert.equal(r2.ok, false);
});

test("Produktion mit http-Site-URL scheitert; https-localhost scheitert ebenfalls, https extern geht durch", () => {
  const r1 = pruefe({ ...BASIS_PROD, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" });
  assert.equal(r1.ok, false);
  const r2 = pruefe({ ...BASIS_PROD, NEXT_PUBLIC_SITE_URL: "https://localhost" });
  assert.equal(r2.ok, false);
  const r3 = pruefe(BASIS_PROD);
  assert.equal(r3.ok, true);
});

test("Produktion mit lokaler Datenbank scheitert; ohne sslmode=verify-full ebenfalls", () => {
  const r1 = pruefe({ ...BASIS_PROD, DATABASE_URL: "postgres://u:p@localhost:5432/db?sslmode=verify-full" });
  assert.equal(r1.ok, false);
  const r2 = pruefe({ ...BASIS_PROD, DATABASE_URL: "postgres://u:p@db.example.internal:5432/db" });
  assert.equal(r2.ok, false);
});

test("Produktion mit MAIL_PROVIDER=dev scheitert; STORAGE_PROVIDER=local scheitert", () => {
  const r1 = pruefe({ ...BASIS_PROD, MAIL_PROVIDER: "dev" });
  assert.equal(r1.ok, false);
  const r2 = pruefe({ ...BASIS_PROD, STORAGE_PROVIDER: "local" });
  assert.equal(r2.ok, false);
});

test("Produktion ohne SERVICE_LEAD_INBOX scheitert; mit .example-Domäne ebenfalls", () => {
  const { SERVICE_LEAD_INBOX, ...ohne } = BASIS_PROD;
  const r1 = pruefe(ohne);
  assert.equal(r1.ok, false);
  const r2 = pruefe({ ...BASIS_PROD, SERVICE_LEAD_INBOX: "anliegen@fourwalls.example" });
  assert.equal(r2.ok, false);
});

test("Produktion mit .example-Absenderadresse (MAIL_FROM) scheitert", () => {
  const r = pruefe({ ...BASIS_PROD, MAIL_FROM: "noreply@fourwalls.example" });
  assert.equal(r.ok, false);
});

test("Produktion mit Staging-Zugangsschleuse gesetzt scheitert; Staging ohne sie ebenfalls", () => {
  const rProd = pruefe({ ...BASIS_PROD, STAGING_GATE_USER: "u", STAGING_GATE_PASSWORD: "x".repeat(16) });
  assert.equal(rProd.ok, false);
  const rStaging = pruefe({ ...BASIS_PROD, APP_ENV: "staging" });
  assert.equal(rStaging.ok, false);
  const rStagingOk = pruefe({ ...BASIS_PROD, APP_ENV: "staging", STAGING_GATE_USER: "u", STAGING_GATE_PASSWORD: "x".repeat(16) });
  assert.equal(rStagingOk.ok, true, rStagingOk.ok ? "" : rStagingOk.fehler.join("; "));
});

test("S3 ohne https-Endpunkt scheitert in Produktion; gleicher Behälter für privat/öffentlich scheitert immer", () => {
  const r1 = pruefe({ ...BASIS_PROD, S3_ENDPOINT: "http://sos-ch-gva-2.exo.io" });
  assert.equal(r1.ok, false);
  const r2 = pruefe({ ...BASIS_PROD, S3_BUCKET_PUBLIC: BASIS_PROD.S3_BUCKET_PRIVATE });
  assert.equal(r2.ok, false);
});
