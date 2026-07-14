// ============================================================
// Settings — 统一设置管理
// ============================================================

const KEYS = {
  apiKey: 'workbench_deepseek_api_key',
  apiUrl: 'workbench_api_url',
  model: 'workbench_model',
  debugEnabled: 'workbench_debug_enabled',
  theme: 'workbench_theme',
} as const;

export const DEFAULT_API_URL = 'https://api.deepseek.com/chat/completions';
export const DEFAULT_MODEL = 'deepseek-chat';

// ── Theme ──

export type ThemeId = 'default' | 'warm' | 'sage';

export function getTheme(): ThemeId {
  if (typeof window === 'undefined') return 'default';
  try {
    const v = localStorage.getItem(KEYS.theme);
    if (v === 'warm' || v === 'sage') return v;
    return 'default';
  } catch { return 'default'; }
}

export function setTheme(theme: ThemeId): void {
  try {
    localStorage.setItem(KEYS.theme, theme);
    document.documentElement.setAttribute('data-theme', theme);
  } catch { /* SSR */ }
}

export const THEMES: { id: ThemeId; name: string; desc: string }[] = [
  { id: 'default', name: '经典蓝', desc: '明亮清晰，默认配色' },
  { id: 'warm', name: '暖阳米白', desc: '暖色调，低对比不刺眼' },
  { id: 'sage', name: '森系灰绿', desc: '低饱和绿色，舒缓护眼' },
];

// ── API Key ──

export function getApiKey(): string {
  if (typeof window === 'undefined') return '';
  try { return localStorage.getItem(KEYS.apiKey) ?? ''; }
  catch { return ''; }
}

export function setApiKey(key: string): void {
  try {
    if (key) localStorage.setItem(KEYS.apiKey, key);
    else localStorage.removeItem(KEYS.apiKey);
  } catch { /* SSR */ }
}

// ── API URL ──

export function getApiUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_API_URL;
  try { return localStorage.getItem(KEYS.apiUrl) ?? DEFAULT_API_URL; }
  catch { return DEFAULT_API_URL; }
}

export function setApiUrl(url: string): void {
  try {
    if (url && url !== DEFAULT_API_URL) localStorage.setItem(KEYS.apiUrl, url);
    else localStorage.removeItem(KEYS.apiUrl);
  } catch { /* SSR */ }
}

// ── Model ──

export function getModel(): string {
  if (typeof window === 'undefined') return DEFAULT_MODEL;
  try { return localStorage.getItem(KEYS.model) ?? DEFAULT_MODEL; }
  catch { return DEFAULT_MODEL; }
}

export function setModel(model: string): void {
  try {
    if (model && model !== DEFAULT_MODEL) localStorage.setItem(KEYS.model, model);
    else localStorage.removeItem(KEYS.model);
  } catch { /* SSR */ }
}

// ── Debug Enabled ──

export function getDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(KEYS.debugEnabled) === 'true'; }
  catch { return false; }
}

export function setDebugEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(KEYS.debugEnabled, 'true');
    else localStorage.removeItem(KEYS.debugEnabled);
  } catch { /* SSR */ }
}

// ── Clear All ──

export function clearAllData(): void {
  try {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    if (typeof indexedDB !== 'undefined') {
      indexedDB.databases?.().then(dbs => {
        dbs.forEach(db => { if (db.name) indexedDB.deleteDatabase(db.name); });
      }).catch(() => {});
    }
  } catch { /* noop */ }
}

// ── Helpers ──

export function getApiUrlOrDefault(): string {
  return getApiUrl() || DEFAULT_API_URL;
}

export function getModelOrDefault(): string {
  return getModel() || DEFAULT_MODEL;
}
