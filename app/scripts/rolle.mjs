#!/usr/bin/env node
/* ============================================================
   FOURWALLS — Rollen vergeben (P5.4 §48/§49)

   Eine Moderatorin entsteht nicht durch Registrierung und nicht durch ein
   verstecktes Häkchen im Formular. Sie entsteht hier: bewusst, an der Konsole,
   mit Protokolleintrag.

   Aufruf:
     node scripts/rolle.mjs <email> moderator
     node scripts/rolle.mjs <email> admin
     node scripts/rolle.mjs --liste

   In der Produktion verweigert das Skript den Dienst, solange nicht
   FW_ALLOW_ROLE_BOOTSTRAP=ja gesetzt ist UND es noch keine Person mit
   erhöhter Rolle gibt. So lässt sich der erste Zugang einmalig einrichten;
   danach führt der Weg über eine Person, die das Recht bereits hat.

   Produktionsstrategie (Bericht §49): Der erste Admin wird beim Aufsetzen der
   Umgebung mit gesetzter Variable angelegt, die Variable danach entfernt.
   Weitere Rollen vergibt ein Admin über die Anwendung — diese Oberfläche
   gehört zu P5.5/P5.6, nicht zu P5.4.
   ============================================================ */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL fehlt"); process.exit(2); }
const appEnv = process.env.APP_ENV ?? "development";
const sql = postgres(url, { max: 1, onnotice: () => {} });

const ROLLEN = ["user", "staff", "moderator", "admin"];
const argv = process.argv.slice(2);

async function liste() {
  const z = await sql`SELECT email, display_name, platform_role, email_verified FROM app_user
                       WHERE platform_role <> 'user' AND deleted_at IS NULL ORDER BY platform_role, email`;
  if (!z.length) console.log("Keine Person mit erhöhter Rolle.");
  for (const r of z) console.log(`${String(r.platform_role).padEnd(10)} ${String(r.email).padEnd(38)} ${r.email_verified ? "bestätigt" : "unbestätigt"}  ${r.display_name ?? ""}`);
}

async function setzen(email, rolle) {
  if (!ROLLEN.includes(rolle)) { console.error(`Rolle muss eine von ${ROLLEN.join(", ")} sein`); process.exit(2); }

  if (appEnv === "production") {
    const erlaubt = process.env.FW_ALLOW_ROLE_BOOTSTRAP === "ja";
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM app_user WHERE platform_role IN ('moderator','admin') AND deleted_at IS NULL`;
    if (!erlaubt) { console.error("In der Produktion gesperrt. Zum einmaligen Einrichten FW_ALLOW_ROLE_BOOTSTRAP=ja setzen."); process.exit(3); }
    if (n > 0) { console.error(`Es gibt bereits ${n} Person(en) mit erhöhter Rolle — weitere Rollen vergibt ein Admin in der Anwendung.`); process.exit(3); }
  }

  const z = await sql`SELECT id, platform_role FROM app_user WHERE email = ${email} AND deleted_at IS NULL LIMIT 1`;
  if (!z[0]) { console.error(`Kein Konto mit ${email}. Zuerst registrieren, dann die Rolle setzen.`); process.exit(4); }
  const vorher = z[0].platform_role;
  if (vorher === rolle) { console.log(`${email} hat die Rolle ${rolle} bereits.`); return; }

  await sql.begin(async tx => {
    await tx`UPDATE app_user SET platform_role = ${rolle} WHERE id = ${z[0].id}`;
    /* Rollenwechsel gehören ins Protokoll — mit Person, vorher, nachher (§71). */
    await tx`INSERT INTO audit_log (actor_user_id, actor_role, action, entity_type, entity_id, previous_state, new_state, reason)
             VALUES (${z[0].id}, ${rolle}, 'role.changed', 'app_user', ${z[0].id}, ${vorher}, ${rolle}, 'Konsole: scripts/rolle.mjs')`;
  });
  console.log(`${email}: ${vorher} → ${rolle}`);
}

try {
  if (argv[0] === "--liste") await liste();
  else if (argv.length >= 2) await setzen(argv[0], argv[1]);
  else { console.error("Aufruf: node scripts/rolle.mjs <email> <moderator|admin>  |  --liste"); process.exit(2); }
} finally { await sql.end(); }
