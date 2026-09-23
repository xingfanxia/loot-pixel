import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TIERS, tierByKey } from '../tiers';
import { placeholderCards, type ClTeamCardSpec, type ClTeamSource } from './cl-team';
import type { DeckSources } from './index';

/**
 * Server-only: reads the art track's deck descriptions at build / request time so the client
 * gets a compact card list. art/cl-team/characters.json lists the slots and default tier counts;
 * art/cl-team/slots/<slot>.json holds a slot's final cards. A missing or malformed slot file falls
 * back to placeholder titles so the deck stays playable while the art track is in progress.
 */
export function loadDeckSources(root = process.cwd()): DeckSources {
  return { 'cl-team': loadClTeam(join(root, 'art', 'cl-team')) };
}

interface CharactersFile { tiers?: Record<string, { count?: number }>; slots: { id: string; short: string; fullName: string }[] }

function loadClTeam(dir: string): ClTeamSource {
  const chars = JSON.parse(readFileSync(join(dir, 'characters.json'), 'utf8')) as CharactersFile;
  const counts = TIERS.map(t => chars.tiers?.[t.key]?.count ?? 0);
  return { slots: chars.slots.map(s => ({ id: s.id, short: s.short, fullName: s.fullName, cards: readSlot(dir, s.id) ?? placeholderCards(counts) })) };
}

function readSlot(dir: string, id: string): ClTeamCardSpec[] | null {
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(join(dir, 'slots', `${id}.json`), 'utf8')); } catch { return null; }
  const cards = (raw as { cards?: unknown }).cards;
  if (!Array.isArray(cards)) return null;
  const out: ClTeamCardSpec[] = [];
  for (const c of cards as { tier?: unknown; n?: unknown; title?: unknown }[]) {
    const t = typeof c.tier === 'string' ? tierByKey(c.tier) : undefined;
    if (!t || !Number.isInteger(c.n) || typeof c.title !== 'string') { console.warn(`[decks] ${id}.json: skipping malformed card`, c); continue; }
    out.push({ tier: t.key, n: c.n as number, title: c.title.toUpperCase() });
  }
  return out.length ? out : null;
}
