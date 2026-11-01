// Indstillinger i localStorage. Claude-nøglen ligger kun her, på telefonen.

export interface Settings {
  model: string;
  autoSpeak: boolean;
  theme: 'auto' | 'light' | 'dark';
}

export const MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5 (hurtig, standard)' },
  { id: 'claude-opus-5-5', label: 'Opus 5.5 (grundigere, dobbelt pris)' },
];

const DEFAULTS: Settings = { model: 'claude-sonnet-5-5', autoSpeak: false, theme: 'auto' };
const KEY = 'kik.settings';
const API_KEY = 'kik.claudeKey';

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

export function getSettings(): Settings {
  return safe(() => ({ ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }), DEFAULTS);
}

export function saveSettings(s: Settings) {
  safe(() => localStorage.setItem(KEY, JSON.stringify(s)), undefined);
  applyTheme(s.theme);
}

export const getApiKey = () => safe(() => localStorage.getItem(API_KEY) ?? '', '');
export const setApiKey = (k: string) => safe(() => (k ? localStorage.setItem(API_KEY, k.trim()) : localStorage.removeItem(API_KEY)), undefined);

export function applyTheme(t: Settings['theme']) {
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

// ---- Forbrug pr. måned (skøn ud fra listepriser) ----
export const DKK_PER_USD = 6.9;
const USAGE = 'kik.usage';

export function addUsage(usd: number) {
  const m = new Date().toISOString().slice(0, 7);
  const u = safe(() => JSON.parse(localStorage.getItem(USAGE) ?? '{}') as Record<string, number>, {});
  u[m] = (u[m] ?? 0) + usd;
  safe(() => localStorage.setItem(USAGE, JSON.stringify(u)), undefined);
}

export function monthUsage(): number {
  const m = new Date().toISOString().slice(0, 7);
  return safe(() => (JSON.parse(localStorage.getItem(USAGE) ?? '{}') as Record<string, number>)[m] ?? 0, 0);
}

/** "0,12 kr" */
export function krText(usd: number): string {
  const v = usd * DKK_PER_USD;
  if (v > 0 && v < 0.005) return 'under 1 øre';
  return `${v.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;
}
