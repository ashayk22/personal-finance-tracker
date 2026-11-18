'use client';
import { useEffect } from 'react';

declare global {
  interface Window {
    monetaInstallPrompt?: Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
  }
}

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      window.monetaInstallPrompt = event as Window['monetaInstallPrompt'];
      window.dispatchEvent(new Event('moneta-install-ready'));
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error: unknown) => {
        console.error('Moneta service worker registration failed.', error);
      });
    }
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);
  return null;
}
