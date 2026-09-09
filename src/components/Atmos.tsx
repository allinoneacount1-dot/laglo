/**
 * Atmospheric plate behind a section.
 *
 * Purely environmental: it sits below the content's stacking context, is
 * aria-hidden, and lazy-loads. If it never arrives the section simply stays as
 * dark as it was before — nothing depends on it.
 *
 * Framing is section-aware, but done in CSS (`object-position` on the
 * `.atmos--*` modifier) rather than by shipping a crop per section, so both
 * plates are downloaded once and reused down the page.
 */
const WIDTHS = [780, 1280, 1672];

export function Atmos({ plate, variant }: { plate: 'a' | 'b'; variant: string }) {
  const set = (ext: 'avif' | 'webp') =>
    WIDTHS.map((w) => `/atmos/${plate}-${w}.${ext} ${w}w`).join(', ');

  return (
    <div className={`atmos atmos--${variant}`} aria-hidden="true">
      <picture>
        <source type="image/avif" srcSet={set('avif')} sizes="100vw" />
        <source type="image/webp" srcSet={set('webp')} sizes="100vw" />
        <img
          src={`/atmos/${plate}.jpg`}
          alt=""
          width={1672}
          height={941}
          loading="lazy"
          decoding="async"
        />
      </picture>
    </div>
  );
}
