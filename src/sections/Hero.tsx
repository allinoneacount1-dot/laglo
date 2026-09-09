import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react';
// three.js is the heaviest thing on the page and nothing above the fold needs
// it. The plate and the copy paint first; he loads in after. On brand.
const Stage = lazy(() => import('../laglo3d/Stage'));
import { hud } from '../laglo3d/hud';
import { CROPS, pickLayout, srcSet, type LayoutKey } from '../laglo3d/framing';
import { hasWebGL, pickQuality, prefersReducedMotion, type Quality } from '../lib/capability';
import { Wordmark } from '../components/Wordmark';

export function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const capRef = useRef<HTMLParagraphElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const [layout, setLayout] = useState<LayoutKey>(() =>
    pickLayout(typeof window === 'undefined' ? 1440 : window.innerWidth));
  const [webgl] = useState(hasWebGL);
  const [quality] = useState<Quality>(pickQuality);
  const [reduced, setReduced] = useState(prefersReducedMotion);
  const [plateLoaded, setPlateLoaded] = useState(false);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMq = () => setReduced(mq.matches);
    mq.addEventListener('change', onMq);

    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setLayout(pickLayout(window.innerWidth)));
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      mq.removeEventListener('change', onMq);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  /* ---- boot readout (section 22) -------------------------------------
     Counts real readiness. It never stalls for comedy: the moment the
     plate is decoded we hand over to the scene. */
  useEffect(() => {
    if (!plateLoaded) return;
    const id = window.setTimeout(() => setBooted(true), 260);
    return () => window.clearTimeout(id);
  }, [plateLoaded]);

  /* ---- HUD: read the render loop without re-rendering React ---------- */
  useEffect(() => {
    let raf = 0;
    let lastCap: string | null | undefined;
    const tick = () => {
      const p = hud.progress;
      if (pctRef.current) pctRef.current.textContent = Number.isInteger(p) ? String(p) : p.toFixed(1);
      if (barRef.current) barRef.current.style.setProperty('--p', String(p));
      if (capRef.current && hud.caption !== lastCap) {
        lastCap = hud.caption;
        capRef.current.textContent = hud.caption ?? '';
        capRef.current.dataset.on = hud.caption ? 'yes' : 'no';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ---- pointer + scroll parallax on the plate only ------------------- */
  const onPointer = useCallback((e: PointerEvent) => {
    if (!plateRef.current) return;
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = (e.clientY / window.innerHeight) * 2 - 1;
    plateRef.current.style.setProperty('--px', `${(-x * 3).toFixed(2)}px`);
    plateRef.current.style.setProperty('--py', `${(-y * 2).toFixed(2)}px`);
  }, []);

  useEffect(() => {
    if (reduced) return;
    window.addEventListener('pointermove', onPointer, { passive: true });
    const onScroll = () => {
      if (!plateRef.current) return;
      const k = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight || 1)));
      plateRef.current.style.setProperty('--sc', String(1 + k * 0.03));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', onScroll);
    };
  }, [onPointer, reduced]);

  const crop = CROPS[layout];

  return (
    <section className="hero" id="top" ref={heroRef} aria-label="LAGLO">
      {/* -- layer 0: the supplied plate, art-directed per breakpoint ---- */}
      <div className="hero__plate" ref={plateRef}>
        <picture>
          <source type="image/avif" srcSet={srcSet(layout, 'avif')} sizes="100vw" />
          <source type="image/webp" srcSet={srcSet(layout, 'webp')} sizes="100vw" />
          <img
            src={`/scene/${crop.jpg}`}
            width={crop.width}
            height={crop.height}
            alt=""
            decoding="async"
            fetchPriority="high"
            onLoad={() => setPlateLoaded(true)}
            // decorative: if it cannot load, leave no broken-image marker behind
            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; setPlateLoaded(true); }}
          />
        </picture>
      </div>

      {/* -- layer 1: atmosphere. readability only, never a black wash --- */}
      <div className="hero__atmos" data-layout={layout} aria-hidden="true" />

      {/* -- layer 2: the real character ------------------------------- */}
      <div className="hero__stage">
        {webgl ? (
          <Suspense fallback={null}>
            <Stage layout={layout} reduced={reduced} quality={quality} />
          </Suspense>
        ) : (
          <img className="hero__fallback" src="/scene/laglo-fallback.png" alt="LAGLO" width={420} height={642} />
        )}
      </div>

      {/* -- layer 3: glass and LAGLO's own language -------------------- */}
      <div className="hero__ui">
        <div className="hero__copy">
          <Wordmark className="hero__mark" />
          <p className="hero__tag meta">still loading.</p>
          <p className="hero__lede">
            a small internet entity<br />permanently stuck at 99%.
          </p>

          <div className="hero__readout glass glass--acid" data-refract="on">
            <div className="hero__bar" ref={barRef}>
              <span className="hero__fill" />
            </div>
            <span className="hero__pct">
              <span ref={pctRef}>99</span>%
            </span>
          </div>

          <p className="hero__caption" ref={capRef} data-on="no" aria-live="polite" />
        </div>

        <p className="hero__hint meta">
          {webgl ? 'drag the green piece' : 'still loading.'}
        </p>
      </div>

      {/* -- boot: real readiness, not theatre -------------------------- */}
      {!booted && (
        <div className="hero__boot" aria-hidden="true">
          <span className="hero__boot-n">{plateLoaded ? 99 : 97}</span>
          <span className="hero__boot-u">%</span>
        </div>
      )}
    </section>
  );
}
