import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * THE MISSING 1% — the second attempt.
 *
 * The hero gives you the real 3D piece. This is the deliberate, close-up
 * version: you take the fragment in your hand and try to seat it. The closer
 * you get, the harder it resists, and it never arrives. Pointer, touch and
 * keyboard all work.
 */
/** Travel is measured from the track, not hard-coded: a fixed 300px pushed the
 *  piece off the left edge on a 390px screen. */
const MAX_TRAVEL = 300;   // desktop ceiling
const MIN_TRAVEL = 130;
const FLOOR = 34;         // it can never be closer than this
const PIECE_RIGHT = 52;   // must match .missing__piece right offset
const PIECE_W = 86;

export function Missing() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [max, setMax] = useState(MAX_TRAVEL);
  const [d, setD] = useState(MAX_TRAVEL);  // distance from the slot, px
  const [held, setHeld] = useState(false);
  const [slipped, setSlipped] = useState(false);
  const [keying, setKeying] = useState(false);
  /** the un-resisted input value; nothing renders from it, so it is a ref */
  const rawRef = useRef(MAX_TRAVEL);
  const raf = useRef(0);
  const keyTimer = useRef(0);

  /** resistance: linear input, asymptotic output. it approaches FLOOR only. */
  const resist = useCallback((raw: number) => {
    const k = Math.max(0, Math.min(1, (raw - FLOOR) / (max - FLOOR)));
    return FLOOR + (max - FLOOR) * Math.pow(k, 0.55);
  }, [max]);

  const progress = 99 + (1 - (d - FLOOR) / (max - FLOOR)) * 0.9;

  // keep the travel inside the track at every width
  useEffect(() => {
    const measure = () => {
      const t = trackRef.current;
      if (!t) return;
      const room = t.clientWidth - PIECE_RIGHT - PIECE_W - 8;
      const next = Math.round(Math.max(MIN_TRAVEL, Math.min(MAX_TRAVEL, room)));
      setMax((prev) => (prev === next ? prev : next));
      setD((cur) => Math.min(cur, next));
      rawRef.current = Math.min(rawRef.current, next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    window.addEventListener('resize', measure, { passive: true });
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  const move = useCallback((clientX: number) => {
    const t = trackRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    // the slot sits at the right end of the track
    const raw = Math.max(0, Math.min(max, r.right - PIECE_RIGHT - clientX));
    rawRef.current = raw;
    setD(resist(raw));
  }, [max, resist]);

  useEffect(() => {
    if (!held) return;
    const onMove = (e: PointerEvent) => move(e.clientX);
    const onUp = () => {
      setHeld(false);
      setSlipped(true);
      window.setTimeout(() => setSlipped(false), 1800);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [held, move]);

  /* released: it drifts back out to rest, slowly, like it changed its mind.
     Paused briefly after a key press, so keyboard users are not fighting the
     animation for control of the piece. */
  useEffect(() => {
    if (held || keying) return;
    const tick = () => {
      setD((cur) => { const n = cur >= max - 0.5 ? max : cur + (max - cur) * 0.045 + 0.15; rawRef.current = n; return n; });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [held, keying, max]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = e.key === 'ArrowRight' ? -30 : 30;
    setKeying(true);
    window.clearTimeout(keyTimer.current);
    keyTimer.current = window.setTimeout(() => {
      setKeying(false);
      setSlipped(true);
      window.setTimeout(() => setSlipped(false), 1800);
    }, 1400);
    // step against the raw input, not the resisted output, or each press
    // would buy less and less until the keyboard stops working entirely
    const next = Math.max(0, Math.min(max, rawRef.current + step));
    rawRef.current = next;
    setD(resist(next));
  };

  const near = 1 - (d - FLOOR) / (max - FLOOR);

  return (
    <section className="sec missing" id="missing" aria-labelledby="missing-h">
      <div className="shell">
        <p className="meta">02 — the missing 1%</p>
        <h2 className="display missing__h" id="missing-h">put it<br />back.</h2>

        <div className="missing__stage">
          <div className="missing__track" ref={trackRef}>
            {/* the slot: an incomplete circle, waiting */}
            <div className="missing__slot" style={{ ['--near' as string]: near.toFixed(3) }}>
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle className="missing__ring" cx="50" cy="50" r="38"
                  pathLength={100} strokeDasharray="88 12" strokeDashoffset="-6" />
              </svg>
            </div>

            <button
              type="button"
              className="missing__piece"
              style={{ transform: `translateX(${-d}px)` }}
              onPointerDown={(e) => { e.preventDefault(); setHeld(true); move(e.clientX); }}
              onKeyDown={onKey}
              aria-label="the missing one percent. drag or use arrow keys to try to fit it."
              data-held={held ? 'yes' : 'no'}
            />
          </div>

          <div className="missing__readout glass glass--acid" data-refract="on">
            <span className="missing__pct">{progress.toFixed(1)}%</span>
            <span className="missing__word">
              {slipped ? 'almost.' : near > 0.94 ? 'nearly.' : held ? 'still loading.' : 'try it.'}
            </span>
          </div>
        </div>

        <p className="missing__note lede">
          nobody knows what is inside it. completion, maybe. or nothing.
          he has never been close enough to check.
        </p>
      </div>
    </section>
  );
}
