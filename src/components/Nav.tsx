import { useEffect, useRef, useState } from 'react';
import { Wordmark } from './Wordmark';

/* On mobile only the lockup, the one link worth jumping to, and the CTA
   survive. A four-item bar crammed into 390px is a collapsed desktop nav,
   not a designed one. */
const LINKS = [
  { href: '#what', label: 'laglo', wide: true },
  { href: '#missing', label: 'the 1%', wide: false },
  { href: '#reactions', label: 'reactions', wide: true },
  { href: '#lore', label: 'lore', wide: true },
];

export function Nav() {
  const [stuck, setStuck] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav ref={ref} className="nav glass glass--clear" data-stuck={stuck ? 'yes' : 'no'} data-refract="on">
      <a className="nav__home" href="#top" aria-label="LAGLO, home">
        <img className="nav__mark" src="/laglo/icon-180.png" alt="" width={30} height={30} />
        <Wordmark height={17} />
      </a>
      <div className="nav__links">
        {LINKS.map((l) => (
          <a key={l.href} className={`nav__link${l.wide ? ' nav__link--wide' : ''}`} href={l.href}>
            {l.label}
          </a>
        ))}
        <a className="nav__cta" href="#almosts">join the almosts</a>
      </div>
    </nav>
  );
}
