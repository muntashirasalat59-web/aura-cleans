import { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { AURA_DARK, AURA_LIGHT, AURA_SHELL, tokensToCssVars } from '../config/designTokens';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'aura-theme';

function applyCssVars(palette, dark = false) {
  const root = document.documentElement;
  const vars = tokensToCssVars(palette, { dark });
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  /* Quick Add follows theme primary (emerald) — not near-black shell */
  root.style.setProperty('--aura-shell-quick-add', palette.primary);
  root.style.setProperty('--aura-shell-quick-add-hover', palette.primaryHover);
}

function readStoredTheme() {
  if (typeof window === 'undefined') return 'light';
  return localStorage.getItem(STORAGE_KEY) || 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readStoredTheme);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const isDark = theme === 'dark';
    root.classList.toggle('dark', isDark);
    localStorage.setItem(STORAGE_KEY, theme);
    applyCssVars(isDark ? AURA_DARK : AURA_LIGHT, isDark);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      tokens: theme === 'dark' ? AURA_DARK : AURA_LIGHT,
      shell: AURA_SHELL,
      toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      setTheme,
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
