import { useState } from 'react';
import { Atmos } from '../components/Atmos';

/**
 * The reaction set, taken straight from the supplied model sheet — each cell
 * cut out of the owner's own render. Not a 3x3 grid: one dominant figure with
 * the rest queued alongside him, waiting their turn.
 */
const REACTIONS = [
  { id: 'neutral', label: 'neutral', say: '...' },
  { id: 'happy', label: 'happy-ish', say: 'almost.' },
  { id: 'confused', label: 'confused', say: 'huh?' },
  { id: 'thinking', label: 'thinking', say: 'loading...' },
  { id: 'panic', label: 'panic', say: '!!!' },
  { id: 'tired', label: 'tired', say: 'so close...' },
  { id: 'done-ish', label: 'done-ish', say: '99%' },
  { id: 'empty-brain', label: 'empty brain', say: '...' },
] as const;

export function Reactions() {
  const [active, setActive] = useState(0);
  const cur = REACTIONS[active];

  return (
    <section className="sec reactions" id="reactions" aria-labelledby="reactions-h">
      <Atmos plate="a" variant="reactions" />
      <div className="shell">
        <p className="meta">03 — reactions</p>
        <h2 className="display reactions__h" id="reactions-h">a whole<br />vocabulary<br />of nearly.</h2>

        <div className="reactions__stage">
          <figure className="reactions__hero">
            <img
              src={`/laglo/expr-${cur.id}.webp`}
              alt={`LAGLO, ${cur.label}`}
              width={360}
              height={420}
              loading="lazy"
              decoding="async"
            />
            <figcaption>
              <span className="reactions__say">{cur.say}</span>
              <span className="meta">{cur.label}</span>
            </figcaption>
          </figure>

          <ul className="reactions__rail" role="tablist" aria-label="LAGLO reactions">
            {REACTIONS.map((r, i) => (
              <li key={r.id}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  className="reactions__chip"
                  data-on={i === active ? 'yes' : 'no'}
                  onClick={() => setActive(i)}
                  onMouseEnter={() => setActive(i)}
                >
                  <img src={`/laglo/expr-${r.id}.webp`} alt="" width={72} height={84} loading="lazy" decoding="async" />
                  <span className="meta">{r.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
