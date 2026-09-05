/* Hintergrundarbeiter: die Mail-Outbox (server/outbox.ts, P5.5 §25–§33).

   `register()` läuft einmal je Serverinstanz. Nur im Node-Laufzeitprozess —
   nicht im Edge-Runtime — wird ein Intervall gestartet, das fällige
   Outbox-Zeilen an den Mailanbieter übergibt. Ein Fehler dabei geht nie nach
   aussen: er landet im Protokoll, der Prozess läuft weiter. `unref()` sorgt
   dafür, dass der Timer den Prozess nicht am Beenden hindert. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { verarbeiten } = await import("@/server/outbox");
  const { env } = await import("@/server/env");
  const { log } = await import("@/lib/log");

  const lauf = async () => {
    try {
      await verarbeiten();
    } catch (e) {
      log.error("outbox.arbeiterFehler", e);
    }
  };

  const ersterLauf = setTimeout(lauf, 3000);
  ersterLauf.unref();

  const intervall = setInterval(lauf, env().OUTBOX_INTERVAL_MS);
  intervall.unref();

  /* Zweiter, unabhängiger Hintergrundarbeiter: die Suchabo-Alarmprüfung
     (server/suchabo-matching.ts, P5.6). Eigenes Intervall, eigener
     Fehlerpfad — ein Fehler hier stört den Outbox-Arbeiter oben nicht. */
  const { alarmeVerarbeiten } = await import("@/server/suchabo-matching");
  const alarmLauf = async () => {
    try {
      await alarmeVerarbeiten();
    } catch (e) {
      log.error("suchabo.alarm.arbeiterFehler", e);
    }
  };

  const ersterAlarmLauf = setTimeout(alarmLauf, 5000);
  ersterAlarmLauf.unref();

  const alarmIntervall = setInterval(alarmLauf, env().ALERT_INTERVAL_MS);
  alarmIntervall.unref();
}
