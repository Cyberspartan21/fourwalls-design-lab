import { headers } from "next/headers";
import { DEFAULT_LOCALE, istLocale } from "@/i18n";

export default async function NichtGefunden() {
  /* not-found kennt keine params — die Sprache steckt im Pfad. */
  const h = await headers();
  const pfad = h.get("x-invoke-path") ?? h.get("next-url") ?? "";
  const seg = pfad.split("/")[1] ?? "";
  const locale = istLocale(seg) ? seg : DEFAULT_LOCALE;
  const TXT = { de: ["Diese Seite gibt es nicht.", "Das Inserat wurde vielleicht zurückgezogen, oder die Adresse stimmt nicht."], fr: ["Cette page n'existe pas.", "L'annonce a peut-être été retirée, ou l'adresse est erronée."], it: ["Questa pagina non esiste.", "L'annuncio potrebbe essere stato ritirato, oppure l'indirizzo non è corretto."], en: ["This page does not exist.", "The listing may have been withdrawn, or the address is wrong."] } as const;
  const [titel, text] = TXT[locale];
  return (
    <main id="inhalt" style={{ padding: "clamp(48px,10vh,120px) var(--pad)", minHeight: "60vh" }}>
      <p style={{ fontSize: ".62rem", letterSpacing: ".18em", textTransform: "uppercase", color: "var(--leise)" }}>404</p>
      <h1 style={{ fontFamily: "var(--d)", fontWeight: 300, fontSize: "clamp(1.8rem,4vw,2.8rem)", margin: "12px 0 18px" }}>{titel}</h1>
      <p style={{ maxWidth: "56ch", color: "var(--leise)" }}>{text}</p>
      <p style={{ marginTop: 24 }}><a className="knopf" href={`/${locale}`}>Fourwalls</a></p>
    </main>
  );
}
