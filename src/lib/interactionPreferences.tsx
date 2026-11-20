'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'moneta-interaction-sounds';
interface InteractionPreferences { soundsEnabled: boolean; setSoundsEnabled: (enabled: boolean) => void }
const PreferencesContext = createContext<InteractionPreferences | null>(null);

export function InteractionPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [soundsEnabled, setSoundsEnabled] = useState(false);
  const enabledRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) === 'true';
      enabledRef.current = stored;
      setSoundsEnabled(stored);
    } catch { /* Keep the default off if browser storage is unavailable. */ }
  }, []);

  useEffect(() => {
    const playClick = (event: MouseEvent) => {
      if (!enabledRef.current) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest('button, a[role="button"]');
      if (!control || control.hasAttribute('data-silent')) return;
      try {
        const AudioContextClass = window.AudioContext;
        if (!AudioContextClass) return;
        const context = audioRef.current ?? (audioRef.current = new AudioContextClass());
        if (context.state === 'suspended') void context.resume();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(660, context.currentTime);
        gain.gain.setValueAtTime(0.012, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.025);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.03);
      } catch { /* Sound is optional and never blocks an interaction. */ }
    };
    document.addEventListener('click', playClick, true);
    return () => document.removeEventListener('click', playClick, true);
  }, []);

  const updateSounds = (enabled: boolean) => {
    enabledRef.current = enabled;
    setSoundsEnabled(enabled);
    try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch { /* Preference remains in memory. */ }
  };
  const value = useMemo(() => ({ soundsEnabled, setSoundsEnabled: updateSounds }), [soundsEnabled]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function useInteractionPreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('useInteractionPreferences must be used inside InteractionPreferencesProvider.');
  return value;
}
