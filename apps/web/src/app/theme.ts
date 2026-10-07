import { useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
const KEY = 'sentinel.theme';

function read(): ThemePreference {
  try {
    const value = localStorage.getItem(KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // storage unavailable
  }
  return 'system';
}

function apply(preference: ThemePreference) {
  const dark = preference === 'dark' || (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

const listeners = new Set<(value: ThemePreference) => void>();

export function setTheme(preference: ThemePreference) {
  try {
    localStorage.setItem(KEY, preference);
  } catch {
    // storage unavailable
  }
  apply(preference);
  listeners.forEach((listener) => listener(preference));
}

export function useTheme(): [ThemePreference, (value: ThemePreference) => void] {
  const [preference, setPreference] = useState<ThemePreference>(read);
  useEffect(() => {
    listeners.add(setPreference);
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply(read());
    media.addEventListener('change', onChange);
    return () => {
      listeners.delete(setPreference);
      media.removeEventListener('change', onChange);
    };
  }, []);
  return [preference, setTheme];
}
