import type { Media } from "@/domain/listing";

/* <picture> genau wie FWP.pic() im Prototyp: WebP-Quelle, JPEG-Rückfall,
   drei Breiten. Keine Bildoptimierung durch das Framework — die Ausschnitte
   sind Teil des Entwurfs und bleiben, wie sie sind. */
export function Bild({ m, sizes = "(max-width: 700px) 100vw, 33vw", eager = false, alt, aspectRatio }: { m: Media; sizes?: string; eager?: boolean; alt?: string; aspectRatio?: string | undefined }) {
  const set = (l: { width: number; url: string }[]) => l.map(s => `${s.url} ${s.width}w`).join(", ");
  const mitte = m.sources.jpeg.find(s => s.width === 960) ?? m.sources.jpeg[m.sources.jpeg.length - 1];
  return (
    <picture>
      {m.sources.webp.length > 0 && <source type="image/webp" srcSet={set(m.sources.webp)} sizes={sizes} />}
      <img src={mitte?.url} srcSet={set(m.sources.jpeg)} sizes={sizes} alt={alt ?? m.alt}
        {...(aspectRatio ? { style: { aspectRatio } } : {})}
        {...(eager ? { loading: "eager" as const, fetchPriority: "high" as const } : { loading: "lazy" as const, decoding: "async" as const })} />
    </picture>
  );
}
