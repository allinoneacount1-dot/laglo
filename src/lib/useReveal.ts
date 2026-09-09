import { useEffect, useRef } from 'react';

/**
 * Scroll reveals, as progressive enhancement.
 *
 * The hidden state is applied only once this hook has run, by arming a flag on
 * <html>. Without that, `[data-reveal]` content sits at opacity 0 in the
 * stylesheet and stays invisible forever if JS fails or IntersectionObserver is
 * missing - which is exactly the kind of thing that hides a whole section.
 */
export function useReveal<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nodes = Array.from(el.querySelectorAll('[data-reveal]'));
    if (!nodes.length) return;

    const showAll = () => nodes.forEach((n) => n.setAttribute('data-in', 'yes'));

    // Constructing the observer must never be able to take the page down with
    // it: this is an optional enhancement, and a throw here previously escaped
    // the effect and unmounted the whole tree, rendering a blank document.
    let io: IntersectionObserver;
    try {
      io = new IntersectionObserver(
        (entries) => entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.setAttribute('data-in', 'yes');
          io.unobserve(e.target);
        }),
        { threshold, rootMargin: '0px 0px -6% 0px' },
      );
      nodes.forEach((n) => io.observe(n));
    } catch {
      showAll();
      return;
    }
    document.documentElement.dataset.revealArmed = 'yes';

    // Safety net: anything the observer never reached is shown anyway once the
    // user has clearly scrolled past it. Content is never withheld.
    const sweep = () => {
      const vh = window.innerHeight;
      nodes.forEach((n) => {
        if (n.getAttribute('data-in') === 'yes') return;
        if (n.getBoundingClientRect().top < vh * 0.9) {
          n.setAttribute('data-in', 'yes');
          io.unobserve(n);
        }
      });
    };
    window.addEventListener('scroll', sweep, { passive: true });
    const settle = window.setTimeout(sweep, 1200);

    return () => {
      io.disconnect();
      window.removeEventListener('scroll', sweep);
      window.clearTimeout(settle);
    };
  }, [threshold]);

  return ref;
}
