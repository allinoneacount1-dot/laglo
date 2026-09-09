import { Nav } from './components/Nav';
import { Hero } from './sections/Hero';
import { WhatIsLaglo } from './sections/WhatIsLaglo';
import { Missing } from './sections/Missing';
import { Reactions } from './sections/Reactions';
import { MemeEngine } from './sections/MemeEngine';
import { Lore, Universe, Almosts, Final } from './sections/Closing';

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">skip to content</a>
      <Nav />
      <main id="main">
        <Hero />
        <WhatIsLaglo />
        <Missing />
        <Reactions />
        <MemeEngine />
        <Lore />
        <Universe />
        <Almosts />
      </main>
      <Final />
      <div className="grain" aria-hidden="true" />
    </>
  );
}
