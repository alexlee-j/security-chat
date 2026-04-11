import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'app-theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'auto';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'auto') {
    return stored;
  }
  return 'auto';
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  // 移除所有主题相关类
  root.classList.remove('light-mode', 'dark-mode', 'auto-mode');

  if (theme === 'auto') {
    root.removeAttribute('data-theme');
    root.classList.add('auto-mode');
  } else if (theme === 'light') {
    root.removeAttribute('data-theme');
    root.classList.add('light-mode');
  } else {
    root.setAttribute('data-theme', 'dark');
    root.classList.add('dark-mode');
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());

  // Apply theme on mount and when theme changes
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (theme !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('auto');
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const resolvedTheme = theme === 'auto' ? getSystemTheme() : theme;

  return { theme, setTheme, resolvedTheme };
}
