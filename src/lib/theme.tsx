import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ThemeName } from '../db/types';
import { getSetting, setSetting } from '../db/settings';

export const THEMES: { id: ThemeName; label: string; hint: string }[] = [
  { id: 'light', label: 'Sun', hint: 'Black on white for bright daylight' },
  { id: 'dark', label: 'Dark', hint: 'Low glare for indoors and dusk' },
  { id: 'red', label: 'Night', hint: 'Red only, keeps your night vision' },
];

const THEME_COLOR: Record<ThemeName, string> = { light: '#ffffff', dark: '#0a0a0a', red: '#000000' };
const LS_KEY = 'np-theme';

interface ThemeCtx {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  cycleTheme: () => void;
}
const Ctx = createContext<ThemeCtx | null>(null);

function isTheme(v: unknown): v is ThemeName {
  return v === 'light' || v === 'dark' || v === 'red';
}

function apply(t: ThemeName) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[t]);
  try {
    localStorage.setItem(LS_KEY, t);
  } catch {
    /* storage blocked; theme still applies for this session */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const initial = document.documentElement.dataset.theme;
  const [theme, setThemeState] = useState<ThemeName>(isTheme(initial) ? initial : 'dark');

  // The database copy wins (it survives backup/restore); localStorage only avoids a flash on load.
  useEffect(() => {
    getSetting<unknown>('theme', null).then((t) => {
      if (isTheme(t)) {
        setThemeState(t);
        apply(t);
      }
    });
  }, []);

  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t);
    apply(t);
    void setSetting('theme', t);
  }, []);

  const cycleTheme = useCallback(() => {
    const i = THEMES.findIndex((x) => x.id === theme);
    setTheme(THEMES[(i + 1) % THEMES.length].id);
  }, [theme, setTheme]);

  return <Ctx.Provider value={{ theme, setTheme, cycleTheme }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme outside ThemeProvider');
  return c;
}
