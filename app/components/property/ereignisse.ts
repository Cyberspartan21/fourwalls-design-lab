/* Kleine Verabredungen zwischen Inseln der Seite — ohne globalen Zustand.
   Server-Markup (Held, Mobil-CTA) löst aus, Client-Komponenten hören zu. */
export type LichtWunsch = { index: number } | { medium: "video" | "360" | "3d" | "sonne" };
export const lichtAuf = (w: LichtWunsch) => window.dispatchEvent(new CustomEvent("fw:licht", { detail: w }));
export const anfrageAuf = (frage: boolean) => window.dispatchEvent(new CustomEvent("fw:anfrage", { detail: { frage } }));
export const zumAnker = (id: string) => {
  const z = document.getElementById("d-" + id);
  if (z) z.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth", block: "start" });
};
