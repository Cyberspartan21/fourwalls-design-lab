/* Behälter für den S3-kompatiblen Objektspeicher einrichten (idempotent).

   Legt PRIVATE und PUBLIC an, falls sie fehlen; setzt auf PUBLIC eine enge
   Policy (anonymes Lesen nur unter pub/ und demo/) sowie CORS; schaltet auf
   PRIVATE die Versionierung ein; prüft, dass PRIVATE keine öffentliche
   Policy trägt.

   node scripts/s3-buckets.mjs

   Liest die Umgebungsvariablen direkt aus process.env — dies ist ein
   eigenständiges Betriebsskript, kein Teil der Anwendung (dort gilt env()
   aus server/env.ts). */
import {
  S3Client,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  PutBucketCorsCommand,
  PutBucketVersioningCommand,
  GetBucketPolicyCommand
} from "@aws-sdk/client-s3";

function pflicht(name) {
  const wert = process.env[name];
  if (!wert) { console.error(`${name} fehlt`); process.exit(1); }
  return wert;
}

const endpoint = pflicht("S3_ENDPOINT");
const region = process.env.S3_REGION || "ch-gva-2";
const bucketPrivat = pflicht("S3_BUCKET_PRIVATE");
const bucketOeffentlich = pflicht("S3_BUCKET_PUBLIC");
const accessKeyId = pflicht("S3_ACCESS_KEY_ID");
const secretAccessKey = pflicht("S3_SECRET_ACCESS_KEY");
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "ja";
const siteUrl = pflicht("NEXT_PUBLIC_SITE_URL");

if (bucketPrivat === bucketOeffentlich) {
  console.error("privater und öffentlicher Behälter müssen verschieden sein");
  process.exit(1);
}

const client = new S3Client({
  endpoint,
  region,
  forcePathStyle,
  credentials: { accessKeyId, secretAccessKey }
});

async function sicherstellenBucket(bucket) {
  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`✓ Behälter angelegt: ${bucket}`);
  } catch (fehler) {
    if (fehler?.name === "BucketAlreadyOwnedByYou") {
      console.log(`✓ Behälter vorhanden: ${bucket}`);
    } else if (fehler?.name === "BucketAlreadyExists") {
      /* Manche Endpunkte melden dies auch für den eigenen Besitz. */
      console.log(`✓ Behälter vorhanden: ${bucket}`);
    } else {
      throw new Error(`Anlegen von ${bucket} fehlgeschlagen: ${fehler?.name ?? fehler}`);
    }
  }
}

async function setzePolicyOeffentlich(bucket) {
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "OeffentlichesLesenNurAbleitungenUndDemo",
        Effect: "Allow",
        Principal: "*",
        Action: "s3:GetObject",
        Resource: [`arn:aws:s3:::${bucket}/pub/*`, `arn:aws:s3:::${bucket}/demo/*`]
      }
    ]
  };
  await client.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: JSON.stringify(policy) }));
  console.log(`✓ Policy gesetzt (anonymes Lesen nur pub/ und demo/): ${bucket}`);
}

async function setzeCors(bucket) {
  try {
    await client.send(new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedMethods: ["GET", "HEAD"],
            AllowedOrigins: [siteUrl],
            AllowedHeaders: ["*"],
            MaxAgeSeconds: 3600
          }
        ]
      }
    }));
    console.log(`✓ CORS gesetzt (Herkunft ${siteUrl}): ${bucket}`);
  } catch (fehler) {
    /* MinIO kennt CORS nur serverweit, nicht je Behälter (501 NotImplemented).
       Das ist in der Entwicklung hinnehmbar und wird gemeldet; jeder andere
       Fehler bleibt ein Abbruch. Der Zielendpunkt (SOS) unterstützt CORS je
       Behälter — dort muss dieser Schritt gelingen. */
    if (fehler?.name === "NotImplemented" || fehler?.$metadata?.httpStatusCode === 501) {
      console.warn(`! CORS je Behälter wird von diesem Endpunkt nicht unterstützt (${bucket}) — nur in der Entwicklung hinnehmbar`);
      return;
    }
    throw new Error(`CORS für ${bucket} fehlgeschlagen: ${fehler?.name ?? fehler}`);
  }
}

async function setzeVersionierung(bucket) {
  try {
    await client.send(new PutBucketVersioningCommand({
      Bucket: bucket,
      VersioningConfiguration: { Status: "Enabled" }
    }));
    console.log(`✓ Versionierung eingeschaltet: ${bucket}`);
  } catch (fehler) {
    throw new Error(`Versionierung für ${bucket} fehlgeschlagen (Endpunkt unterstützt dies evtl. nicht): ${fehler?.name ?? fehler}`);
  }
}

async function pruefeKeinePolicyAufPrivat(bucket) {
  try {
    await client.send(new GetBucketPolicyCommand({ Bucket: bucket }));
    console.error(`Abbruch: ${bucket} trägt eine Bucket Policy — der private Behälter darf keine haben`);
    process.exit(1);
  } catch (fehler) {
    if (fehler?.name === "NoSuchBucketPolicy") {
      console.log(`✓ Keine öffentliche Policy auf privatem Behälter: ${bucket}`);
    } else {
      throw new Error(`Prüfung der Policy auf ${bucket} fehlgeschlagen: ${fehler?.name ?? fehler}`);
    }
  }
}

async function main() {
  await sicherstellenBucket(bucketPrivat);
  await sicherstellenBucket(bucketOeffentlich);
  await setzePolicyOeffentlich(bucketOeffentlich);
  await setzeCors(bucketOeffentlich);
  await setzeVersionierung(bucketPrivat);
  await pruefeKeinePolicyAufPrivat(bucketPrivat);
  console.log("Fertig.");
}

main().catch(fehler => {
  console.error(fehler?.message ?? String(fehler));
  process.exit(1);
});
