'use client';
import { useEffect, useState } from 'react';
import { Download, Share } from 'lucide-react';

type InstallChoice = { outcome: 'accepted' | 'dismissed'; platform?: string };
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<InstallChoice> };
const DISMISSED_KEY = 'moneta-install-dismissed';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

export function PwaInstallButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosSafari, setIosSafari] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIosSafari(ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua));
    setInstalled(isStandalone());
    setDismissed(localStorage.getItem(DISMISSED_KEY) === '1');
    if (window.monetaInstallPrompt) setPrompt(window.monetaInstallPrompt);

    const onPromptAvailable = () => {
      if (window.monetaInstallPrompt) setPrompt(window.monetaInstallPrompt);
    };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const onDisplayMode = () => setInstalled(isStandalone());
    window.addEventListener('moneta-install-ready', onPromptAvailable);
    window.addEventListener('appinstalled', onInstalled);
    displayMode.addEventListener?.('change', onDisplayMode);
    return () => {
      window.removeEventListener('moneta-install-ready', onPromptAvailable);
      window.removeEventListener('appinstalled', onInstalled);
      displayMode.removeEventListener?.('change', onDisplayMode);
    };
  }, []);

  const install = async () => {
    if (iosSafari) { setShowInstructions(true); return; }
    if (!prompt || dismissed) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setPrompt(null);
    if (choice.outcome === 'accepted') setInstalled(true);
    else {
      localStorage.setItem(DISMISSED_KEY, '1');
      setDismissed(true);
    }
  };

  if (installed) return <p className="ft-install-status" role="status">Moneta is installed on this device.</p>;
  const canPrompt = !!prompt && !dismissed;
  return (
    <div className="ft-install">
      {(canPrompt || iosSafari) && (
        <button type="button" className="ft-button ft-primary" onClick={() => void install()}>
          {iosSafari ? <Share size={16} /> : <Download size={16} />}Add to Home Screen
        </button>
      )}
      {!canPrompt && !iosSafari && (
        <p className="ft-install-status">
          {dismissed
            ? 'You can install Moneta later from your browser menu.'
            : 'To install, open your browser menu and choose “Install app” or “Add to Home Screen”.'}
        </p>
      )}
      {showInstructions && (
        <div className="ft-install-instructions" role="status">
          <b>Add Moneta to your Home Screen</b>
          <span>In Safari, tap <Share size={14} aria-label="Share" /> Share, then choose “Add to Home Screen”.</span>
          <button type="button" className="ft-link" onClick={() => setShowInstructions(false)}>Got it</button>
        </div>
      )}
    </div>
  );
}
