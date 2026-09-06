/* Ein Fehlermodell für die ganze Anwendung.
   Nach aussen geht nur der Code und eine knappe Meldung — nie ein Stack,
   nie ein SQL-Text. Was genau schiefging, steht im Serverprotokoll. */

export type ErrorCode =
  | "NOT_FOUND" | "VALIDATION" | "UNAUTHORIZED" | "FORBIDDEN"
  | "CONFLICT" | "RATE_LIMIT" | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  NOT_FOUND: 404, VALIDATION: 422, UNAUTHORIZED: 401, FORBIDDEN: 403,
  CONFLICT: 409, RATE_LIMIT: 429, INTERNAL: 500
};

/* Kurze Korrelations-Kennung: verbindet die Antwort an den Browser mit dem
   Protokolleintrag auf dem Server (§17/§42) — ohne dass die Antwort selbst
   irgendetwas über die Ursache verrät. Kein UUID-Format nötig, nur kurz und
   eindeutig genug für eine einzelne Anfrage. */
function neueRef(): string {
  return (crypto as { randomUUID?: () => string }).randomUUID?.().replace(/-/g, "").slice(0, 10)
    ?? Math.random().toString(36).slice(2, 12);
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /* Felder mit Prüfmeldungen bei VALIDATION — sonst leer. */
  readonly fields: Record<string, string>;
  /* Nur für INTERNAL nach aussen sichtbar (siehe toResponseBody) — für alle
     Codes gesetzt, damit fehlerAntwort() sie immer fürs Protokoll hat. */
  readonly ref: string;

  constructor(code: ErrorCode, message?: string, fields: Record<string, string> = {}) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.fields = fields;
    this.ref = neueRef();
  }

  /* Die Antwort an den Browser. Absichtlich ohne Details bei INTERNAL — dafür
     mit einer Korrelations-Kennung, mit der der Betrieb den zugehörigen
     Protokolleintrag findet (fehlerAntwort() loggt dieselbe ref). */
  toResponseBody(): { error: ErrorCode; message: string; fields?: Record<string, string> } | { error: { code: "INTERNAL"; message: string; ref: string } } {
    if (this.code === "INTERNAL") return { error: { code: "INTERNAL", message: "Interner Fehler", ref: this.ref } };
    const body: { error: ErrorCode; message: string; fields?: Record<string, string> } = { error: this.code, message: this.message };
    if (Object.keys(this.fields).length) body.fields = this.fields;
    return body;
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;

/* Ein fehlgeschlagener Schema-Abgleich ist ein Eingabefehler, kein Serverfehler:
   Zod-Fehler werden zu VALIDATION mit Feldnamen. Alles Übrige wird zu INTERNAL —
   ohne dass die Ursache nach aussen dringt. */
interface ZodAehnlich { name?: string; issues?: { path: (string | number)[]; message: string }[] }
export function asAppError(e: unknown): AppError {
  if (isAppError(e)) return e;
  const z = e as ZodAehnlich;
  if (z && Array.isArray(z.issues) && (z.name === "ZodError" || z.name === "$ZodError")) {
    const felder: Record<string, string> = {};
    for (const i of z.issues.slice(0, 20)) felder[i.path.join(".") || "_"] = i.message;
    return new AppError("VALIDATION", "Bitte prüfen Sie Ihre Angaben", felder);
  }
  return new AppError("INTERNAL");
}
