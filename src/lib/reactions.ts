/**
 * The reaction vocabulary, shared by the reactions section and the meme
 * engine so there is one asset pipeline rather than two lists that drift.
 *
 * These illustrations are an expressive derivative layer. They do not
 * redefine the frozen real-time 3D model in the hero.
 */
export const REACTION_PACKS = ['a', 'b'] as const;
export type ReactionPack = (typeof REACTION_PACKS)[number];

export interface Reaction {
  id: string;
  label: string;
  /** what he would say, if he said things */
  say: string;
}

export const REACTIONS: Reaction[] = [
  { id: 'neutral', label: 'neutral', say: '...' },
  { id: 'happy-ish', label: 'happy-ish', say: 'almost.' },
  { id: 'confused', label: 'confused', say: 'huh?' },
  { id: 'thinking', label: 'thinking', say: 'loading...' },
  { id: 'panic', label: 'panic', say: '!!!' },
  { id: 'tired', label: 'tired', say: 'so close...' },
  { id: 'done-ish', label: 'done-ish', say: '99%' },
  { id: 'empty-brain', label: 'empty brain', say: '...' },
];

/** full-size asset for the dominant figure */
export const reactionSrc = (pack: ReactionPack, id: string) =>
  `/laglo/reactions/${pack}/${id}.webp`;

/** small derivative, so a chip never downloads the full asset */
export const reactionThumb = (pack: ReactionPack, id: string) =>
  `/laglo/reactions/${pack}/${id}-thumb.webp`;
