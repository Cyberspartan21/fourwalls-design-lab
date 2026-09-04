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

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /* Felder mit Prüfmeldungen bei VALIDATION — sonst leer. */
  readonly fields: Record<string, string>;

  constructor(code: ErrorCode, message?: string, fields: Record<string, string> = {}) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.fields = fields;
  }

  /* Die Antwort an den Browser. Absichtlich ohne Details bei INTERNAL. */
  toResponseBody(): { error: ErrorCode; message: string; fields?: Record<string, string> } {
    if (this.code === "INTERNAL") return { error: "INTERNAL", message: "Ein interner Fehler ist aufgetreten." };
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
