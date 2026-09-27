import { useEffect, useState } from 'react';

export function useDark() {
  const q = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const [dark, setDark] = useState(q?.matches ?? false);
  useEffect(() => {
    if (!q) return;
    const f = (e: MediaQueryListEvent) => setDark(e.matches);
    q.addEventListener('change', f);
    return () => q.removeEventListener('change', f);
  }, [q]);
  return dark;
}

export function chartTheme(dark: boolean) {
  return dark
    ? { surface: '#1a1a19', grid: '#2c2c2a', axis: '#383835', muted: '#898781', untracked: '#3a3a37', other: '#7a7973' }
    : { surface: '#fcfcfb', grid: '#e1e0d9', axis: '#c3c2b7', muted: '#898781', untracked: '#e1e0d9', other: '#8f8d86' };
}
