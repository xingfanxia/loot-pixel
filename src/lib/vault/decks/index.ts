import { TIERS } from '../tiers';
import { buildClTeam, CL_TEAM_TIERS, type ClTeamSource } from './cl-team';
import { classic } from './classic';
import type { Deck, DeckTier } from './types';

export type { Deck } from './types';

/** Data a deck needs from the server (art-track files), keyed by deck id. */
export interface DeckSources { 'cl-team': ClTeamSource }

export const DEFAULT_DECK = 'cl-team';
/** Every selectable deck: how to build it from the server sources, and its tiers for the picker before load. */
const DECKS: Record<string, { build: (s: DeckSources) => Deck; tiers: DeckTier[] }> = {
  classic: { build: () => classic, tiers: classic.tiers },
  'cl-team': { build: s => buildClTeam(s['cl-team']), tiers: CL_TEAM_TIERS },
};

/** `?deck=<id>`; unknown ids fall back to the default deck. */
export const deckIdFrom = (search: string) => { const id = new URLSearchParams(search).get('deck') || DEFAULT_DECK; return id in DECKS ? id : DEFAULT_DECK; };

export function resolveDeck(id: string, sources: DeckSources): Deck {
  return (DECKS[id] ?? DECKS[DEFAULT_DECK]).build(sources);
}

/** Rarity picker options for a deck: Random (-1) then one pill per tier. */
export function forceOptions(deck: Deck | string) {
  const tiers = typeof deck === 'string' ? (DECKS[deck] ?? DECKS[DEFAULT_DECK]).tiers : deck.tiers;
  return [{ value: -1, label: 'Random' }, ...tiers.map(t => ({ value: t.tier as number, label: TIERS[t.tier].short }))];
}
