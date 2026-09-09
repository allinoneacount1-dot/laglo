import { useReveal } from '../lib/useReveal';
import { Atmos } from '../components/Atmos';

/* Oversized editorial type, not a card. The list reveals as you arrive,
   one line at a time, each a little slower than feels comfortable. */
const ALMOSTS = ['almost rich.', 'almost productive.', 'almost asleep.', 'almost over it.', 'almost there.'];

export function WhatIsLaglo() {
  const ref = useReveal<HTMLElement>(0.35);

  return (
    <section className="sec what" id="what" ref={ref} aria-labelledby="what-h">
      <Atmos plate="a" variant="what" />
      <div className="shell">
        <p className="meta">01 — what is laglo</p>
        <h2 className="display what__lead" id="what-h" data-reveal>
          everything<br />is almost<br />done.
        </h2>
        <ul className="what__list">
          {ALMOSTS.map((a, i) => (
            <li key={a} data-reveal style={{ transitionDelay: `${i * 90}ms` }}>{a}</li>
          ))}
        </ul>
        <p className="what__end display" data-reveal>99%.</p>
        <p className="what__note lede">
          he is not broken. he is not fixed either.<br />
          he is the small permanent gap between nearly and done.
        </p>
      </div>
    </section>
  );
}
