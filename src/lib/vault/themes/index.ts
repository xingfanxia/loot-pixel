import { cyber } from './cyber';
import type { Theme } from './types';
import { vault } from './vault';

export type { Theme } from './types';

/** Every selectable theme, in switch order. */
export const THEMES: Theme[] = [vault, cyber];
export const DEFAULT_THEME = 'vault';
/** localStorage key of the viewer's last choice (a convenience: `?theme=<id>` wins over it). */
export const THEME_KEY = 'loot-pixel-theme';

export const themeById = (id: string | null | undefined): Theme => THEMES.find(t => t.id === id) ?? THEMES.find(t => t.id === DEFAULT_THEME)!;
