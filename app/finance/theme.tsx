'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { SakugaButton } from './SakugaButton';

export type MonetaTheme = 'dark' | 'light';
const STORAGE_KEY = 'moneta-theme';
const CHANGE_EVENT = 'moneta-theme-change';

function currentTheme(): MonetaTheme {
  if (typeof document !== 'undefined') {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  }
  return 'dark';
}

export function setMonetaTheme(theme: MonetaTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColor) themeColor.content = theme === 'dark' ? '#111113' : '#f2eee4';
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* Storage can be unavailable in private browsing. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function useMonetaTheme() {
  const [theme, setTheme] = useState<MonetaTheme>(currentTheme);
  useEffect(() => {
    const sync = () => setTheme(currentTheme());
    window.addEventListener(CHANGE_EVENT, sync);
    sync();
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);
  return theme;
}

export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const theme = useMonetaTheme();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const Icon = nextTheme === 'light' ? Sun : Moon;
  return <SakugaButton
    type="button"
    className={`ft-button ft-theme-toggle${withLabel ? ' with-label' : ''}`}
    onClick={() => setMonetaTheme(nextTheme)}
    aria-label={`Switch to ${nextTheme} mode`}
    aria-pressed={theme === 'light'}
    title={`Switch to ${nextTheme} mode`}
  ><Icon size={16}/>{withLabel && <span>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>}</SakugaButton>;
}

export function ThemeSettings() {
  const theme = useMonetaTheme();
  return <article className="ft-card ft-settings-card ft-theme-settings">
    <span className="ft-eyebrow">APPEARANCE</span>
    <h2>Theme</h2>
    <p>Choose the Moneta colour theme for this device. Your selection is remembered.</p>
    <div className="ft-theme-setting-row"><span className="ft-theme-current">Current theme <b>{theme === 'dark' ? 'Dark' : 'Light'}</b></span><ThemeToggle withLabel/></div>
  </article>;
}
