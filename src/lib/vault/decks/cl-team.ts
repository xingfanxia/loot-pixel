import { fitLayout } from '../geometry';
import { TIERS, tierByKey, type TierName } from '../tiers';
import { CL_MARK } from './cl-mark';
import type { CardLayout, Deck, DeckCard, DeckTier, PityRule } from './types';

/** One card spec from art/cl-team/slots/<slot>.json (concept stays in the art track; hook becomes the card's note). */
export interface ClTeamCardSpec { tier: TierName; n: number; title: string; hook?: string }
export interface ClTeamSlotSource { id: string; short: string; fullName: string; role?: string; cards: ClTeamCardSpec[] }
/** Built on the server from art/cl-team (see sources.server.ts) and handed to the client. */
export interface ClTeamSource { slots: ClTeamSlotSource[] }

/**
 * Portrait geometry, matching the sizes locked in art/cl-team/style.md (64x72 art, 24px icon).
 * Change these numbers and the card (76x122 here, with a 2-line title bar), chains, bars, bag and scene all re-derive.
 * PNGs in public/decks/cl-team/ must match `art` and `icon` exactly.
 */
export const CL_TEAM_SIZE = { art: { w: 64, h: 72 }, icon: 24 };
// style.md: 24px is the smallest face crop that stays recognisable, so phones wrap the bag rather than shrink it
export const CL_TEAM_LAYOUT: CardLayout = { ...fitLayout('portrait', CL_TEAM_SIZE.art, CL_TEAM_SIZE.icon, ['PWR'], 2), minIcon: CL_TEAM_SIZE.icon };

/**
 * Draw odds, COMMON to LEGENDARY, on Genshin's standard banner: LEGENDARY is the 5-star (0.6% base),
 * EPIC the 4-star (5.1%), and the 3-star 94.3% is split over COMMON / UNCOMMON / RARE as before (42:28:17).
 */
export const CL_TEAM_TIERS: DeckTier[] = [
  { tier: 0, odds: .455 }, { tier: 1, odds: .304 }, { tier: 2, odds: .184 }, { tier: 3, odds: .051 }, { tier: 4, odds: .006 },
];
/** Genshin's pity: soft from pull 74 (+6% a pull), LEGENDARY by pull 90, EPIC or better every 10 pulls (about 1.6% LEGENDARY overall). */
export const CL_TEAM_PITY: PityRule = { soft: 74, step: .06, hard: 90, epic: 10 };

/** A card pack of the team: its own cards, art directory (public/decks/<id>/, art/<id>/) and bag. */
export interface ClTeamPack { id: string; title: string; bagKey: string }
export const CL_TEAM: ClTeamPack = { id: 'cl-team', title: 'Compute Labs', bagKey: 'loot-pixel-bag-cl-team-v1' };
/** The cyber theme's pack: the same people as cyberpunk characters (art/cl-team-cyber/). */
export const CL_TEAM_CYBER: ClTeamPack = { id: 'cl-team-cyber', title: 'Compute Labs: Cyber', bagKey: 'loot-pixel-bag-cl-team-cyber-v1' };

export function buildClTeam(src: ClTeamSource, pack: ClTeamPack = CL_TEAM): Deck {
  const cards: DeckCard[] = [];
  src.slots.forEach((s, slot) => {
    for (const c of s.cards) {
      const t = tierByKey(c.tier); if (!t) continue;
      const id = `${s.id}-${t.key}-${c.n}`, base = `/decks/${pack.id}/${id}`;
      cards.push({ id, slot, tier: t.id, n: c.n, name: s.short, title: c.title, label: `${s.fullName}, ${c.title}`, note: c.hook,
        art: { kind: 'image', src: `${base}.png`, icon: `${base}-icon.png` } });
    }
  });
  cards.sort((a, b) => a.slot - b.slot || a.tier - b.tier || a.n - b.n);
  return {
    id: pack.id,
    title: pack.title,
    // a tier nobody has a card for yet cannot be drawn
    tiers: CL_TEAM_TIERS.filter(t => cards.some(c => c.tier === t.tier)),
    slots: src.slots.map(({ id, short, fullName, role }) => ({ id, short, fullName, role })),
    cards,
    layout: CL_TEAM_LAYOUT,
    bagKey: pack.bagKey,
    emblem: CL_MARK,
    pity: CL_TEAM_PITY,
  };
}

/** Placeholder ladder for a slot whose card list is not written yet: `counts[tier]` cards per tier. */
export function placeholderCards(counts: number[]): ClTeamCardSpec[] {
  return TIERS.flatMap(t => Array.from({ length: counts[t.id] || 0 }, (_, i) => ({ tier: t.key, n: i + 1, title: `${t.name} ${i + 1}` })));
}
