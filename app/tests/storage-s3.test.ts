import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { erzeugeS3Storage } from "../services/storage-s3.ts";

const endpoint = process.env.S3_ENDPOINT;

test("S3-Speicher: privat/öffentlich, Kopieren, signierte und dauerhafte Adressen", async (t) => {
  if (!endpoint) { t.skip("S3_ENDPOINT nicht gesetzt — Integrationstest übersprungen"); return; }

  const storage = erzeugeS3Storage({
    endpoint,
    region: process.env.S3_REGION ?? "ch-gva-2",
    bucketPrivat: process.env.S3_BUCKET_PRIVATE ?? "",
    bucketOeffentlich: process.env.S3_BUCKET_PUBLIC ?? "",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "ja",
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL
  });

  const jpeg = new Uint8Array(readFileSync("public/media/zurich-altbau-1-480.jpg"));
  const uuid = crypto.randomUUID();
  const origKey = `orig/${uuid}.jpg`;
  const pubKey = `pub/${uuid}/960.jpg`;

  try {
    await storage.speichern(origKey, jpeg, "image/jpeg");

    const gelesen = await storage.lesen(origKey);
    assert.ok(gelesen, "privates Objekt muss lesbar sein");
    assert.deepEqual(gelesen, jpeg, "gelesene Bytes müssen identisch sein");

    assert.throws(() => storage.publicUrl(origKey), "publicUrl für privates Objekt muss werfen");

    const signiert = await storage.signedUrl(origKey, 900);
    const antwortSigniert = await fetch(signiert);
    assert.equal(antwortSigniert.status, 200, "signierte Adresse muss 200 liefern");
    const bytesSigniert = new Uint8Array(await antwortSigniert.arrayBuffer());
    assert.deepEqual(bytesSigniert, jpeg, "signierte Adresse muss dieselben Bytes liefern");

    await storage.kopieren(origKey, pubKey);

    const oeffentlicheAdresse = storage.publicUrl(pubKey);
    const antwortOeffentlich = await fetch(oeffentlicheAdresse);
    assert.equal(antwortOeffentlich.status, 200, "öffentliche Adresse muss anonym 200 liefern");

    /* Adresse des PRIVATEN Objekts nach demselben Muster wie publicUrl, aber
       für den privaten Behälter — muss anonym mit 403 verweigert werden. */
    const privateAdresseAnonym = oeffentlicheAdresse
      .replace(process.env.S3_BUCKET_PUBLIC ?? "", process.env.S3_BUCKET_PRIVATE ?? "")
      .replace(pubKey, origKey);
    const antwortPrivatAnonym = await fetch(privateAdresseAnonym);
    assert.equal(antwortPrivatAnonym.status, 403, "privates Objekt darf anonym nicht lesbar sein");
  } finally {
    await storage.loeschen(origKey);
    await storage.loeschen(pubKey);
  }

  assert.equal(await storage.lesen(origKey), null, "gelöschtes privates Objekt liefert null");
  assert.equal(await storage.lesen(pubKey), null, "gelöschtes öffentliches Objekt liefert null");
});
