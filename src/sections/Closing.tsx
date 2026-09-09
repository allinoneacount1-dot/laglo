import { useState } from 'react';
import { useReveal } from '../lib/useReveal';
import { Wordmark } from '../components/Wordmark';
import { Atmos } from '../components/Atmos';

/* ---- LORE: fragments, not paragraphs (section 15) ------------------ */
const FRAGMENTS = [
  'one browser tab.',
  'one loading bar.',
  '99%.',
  'the owner forgot.',
  'years passed.',
  'the machine died.',
  'something remained.',
];

export function Lore() {
  const ref = useReveal<HTMLElement>(0.3);

  return (
    <section className="sec lore" id="lore" ref={ref} aria-labelledby="lore-h">
      <Atmos plate="b" variant="lore" />
      <div className="shell">
        <p className="meta">05 — lore</p>
        <h2 className="sr-only" id="lore-h">Where LAGLO came from</h2>
        <ol className="lore__list">
          {FRAGMENTS.map((f, i) => (
            <li key={f} data-reveal className="lore__frag" style={{ transitionDelay: `${i * 60}ms` }}>
              {f}
            </li>
          ))}
        </ol>
        <p className="lore__out display" data-reveal>and it was<br />still loading.</p>
      </div>
    </section>
  );
}

/* ---- UNIVERSE: hints only. nothing is revealed yet (section 16) ---- */
const CAST = [
  { id: 'done', name: 'DONE', note: 'insufferably efficient.', glyph: 'M6 14l5 5 11-12' },
  { id: 'ping', name: 'PING', note: 'has news nobody asked for.', glyph: '' },
  { id: 'cache', name: 'CACHE', note: 'remembers what you deleted.', glyph: '' },
];

export function Universe() {
  return (
    <section className="sec universe" aria-labelledby="universe-h">
      <Atmos plate="b" variant="universe" />
      <div className="shell">
        <p className="meta">06 — elsewhere</p>
        <h2 className="display universe__h" id="universe-h">others exist.<br />not yet.</h2>
        <ul className="universe__row">
          {CAST.map((c) => (
            <li key={c.id} className="universe__card glass glass--frosted">
              <span className={`universe__glyph universe__glyph--${c.id}`} aria-hidden="true">
                {c.glyph ? (
                  <svg viewBox="0 0 28 28"><path d={c.glyph} /></svg>
                ) : null}
              </span>
              <span className="universe__name">{c.name}</span>
              <span className="universe__note">{c.note}</span>
              <span className="meta universe__status">status: not loaded</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---- THE ALMOSTS -------------------------------------------------- */
export function Almosts() {
  const [state, setState] = useState<'idle' | 'loading' | 'in'>('idle');

  const join = () => {
    if (state !== 'idle') return;
    setState('loading');
    // the button hesitates, then tells the truth: there is nowhere to go yet
    window.setTimeout(() => setState('in'), 900);
  };

  return (
    <section className="sec almosts" id="almosts" aria-labelledby="almosts-h">
      <Atmos plate="b" variant="almosts" />
      <div className="shell almosts__inner">
        <h2 className="display almosts__h" id="almosts-h">
          everyone is<br />almost something.
        </h2>
        <p className="lede almosts__lede">
          still loading together. that is the whole club.
        </p>
        <button type="button" className="almosts__cta" onClick={join} data-state={state}>
          {state === 'idle' && 'join the almosts'}
          {state === 'loading' && 'loading...'}
          {state === 'in' && 'almost in. 99%.'}
        </button>
        <p className="meta almosts__note">
          {state === 'in' ? 'links go here when there are links.' : 'no forms. no email. nothing to sign.'}
        </p>
      </div>
    </section>
  );
}

/* ---- FINAL 99% ---------------------------------------------------- */
export function Final() {
  return (
    <footer className="sec final" aria-labelledby="final-h">
      <Atmos plate="b" variant="final" />
      <div className="shell final__inner">
        <p className="display final__big" id="final-h">99%</p>
        <p className="final__say say">still loading.</p>
        <div className="final__foot">
          <Wordmark height={20} />
          <p className="meta">the almosts — 2025</p>
        </div>
      </div>
    </footer>
  );
}
