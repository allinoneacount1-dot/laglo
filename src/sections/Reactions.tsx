import { useState } from 'react';
import { Atmos } from '../components/Atmos';
import {
  REACTIONS, REACTION_PACKS, reactionSrc, reactionThumb, type ReactionPack,
} from '../lib/reactions';

/**
 * One dominant reaction, the rest queued alongside. Two supplied packs, and a
 * compact switch between them - not a tab bar, and not an editor.
 */
export function Reactions() {
  const [active, setActive] = useState(0);
  const [pack, setPack] = useState<ReactionPack>('a');
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
              /* keyed so a pack or state change remounts and crossfades */
              key={`${pack}-${cur.id}`}
              className="reactions__figure"
              src={reactionSrc(pack, cur.id)}
              alt={`LAGLO, ${cur.label}`}
              width={320}
              height={455}
              decoding="async"
            />
            <figcaption>
              <span className="reactions__say">{cur.say}</span>
              <span className="meta">{cur.label}</span>
            </figcaption>
          </figure>

          <div className="reactions__panel">
            <div className="reactions__switch" role="group" aria-label="reaction pack">
              {REACTION_PACKS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="reactions__set"
                  data-on={p === pack ? 'yes' : 'no'}
                  aria-pressed={p === pack}
                  onClick={() => setPack(p)}
                >
                  set {p}
                </button>
              ))}
            </div>

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
                    <img
                      src={reactionThumb(pack, r.id)}
                      alt=""
                      width={72}
                      height={100}
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="meta">{r.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
