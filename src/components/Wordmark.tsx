/**
 * The canonical flat wordmark, taken straight from the supplied logo sheet.
 *
 * It is rendered as two masks - the ink letterforms and the acid fragment on
 * the final O - so it can sit cream-on-dark or ink-on-cream without ever
 * recolouring, stretching or restyling the artwork itself (section 34).
 */
import type { CSSProperties } from 'react';

export function Wordmark({
  height,
  tone = 'cream',
  className = '',
}: {
  /** omit to let CSS size it via --wm-h, which is what the hero does */
  height?: number;
  tone?: 'cream' | 'ink';
  className?: string;
}) {
  return (
    <span
      className={`wordmark wordmark--${tone} ${className}`}
      style={height ? ({ '--wm-h': `${height}px` } as CSSProperties) : undefined}
      role="img"
      aria-label="LAGLO"
    >
      <span className="wordmark__ink" />
      <span className="wordmark__acid" />
    </span>
  );
}
