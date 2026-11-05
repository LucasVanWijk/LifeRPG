// Board themes: the wooden backdrop and note colours on the Quests screen.
// Each theme is a set of CSS variables in app.css, picked with <html data-board-theme="...">.
export const BOARD_THEMES = [
  { key: 'walnut', name: 'Dark Walnut', blurb: 'Deep brown, high contrast', swatch: ['#4b3209', '#3d2807', '#f6e3c4'] },
  { key: 'oak', name: 'Tavern Oak', blurb: 'Mid-tone oak, amber warmth', swatch: ['#6b4423', '#553419', '#f3dfb8'] },
  { key: 'honey', name: 'Honey Oak', blurb: 'Lighter, golden wood', swatch: ['#7a5a30', '#614522', '#f6e6c0'] },
] as const;

export type BoardTheme = (typeof BOARD_THEMES)[number]['key'];
const KEY = 'liferpg-board-theme';

export function loadBoardTheme(): BoardTheme {
  try {
    const v = localStorage.getItem(KEY);
    return BOARD_THEMES.some((t) => t.key === v) ? (v as BoardTheme) : 'walnut';
  } catch { return 'walnut'; }
}

export function applyBoardTheme(t: BoardTheme) {
  document.documentElement.dataset.boardTheme = t;
}

export function saveBoardTheme(t: BoardTheme) {
  applyBoardTheme(t);
  try { localStorage.setItem(KEY, t); } catch { /* private mode */ }
}
