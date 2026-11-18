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
  const [iosDevice, setIosDevice] = useState(false);
  const [iosSafari, setIosSafari] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [installHint, setInstallHint] = useState('');

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIosDevice(ios);
    setIosSafari(ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua));
    setInstalled(isStandalone());
    try { setDismissed(localStorage.getItem(DISMISSED_KEY) === '1'); } catch { /* Storage may be unavailable. */ }
    if (window.monetaInstallPrompt) setPrompt(window.monetaInstallPrompt);

    const onPromptAvailable = () => {
      if (window.monetaInstallPrompt) setPrompt(window.monetaInstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      window.monetaInstallPrompt = undefined;
    };
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
    if (iosSafari) {
      setInstallHint('In Safari, tap Share, then choose “Add to Home Screen”.');
      setShowInstructions(true);
      return;
    }
    if (prompt && !dismissed) {
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        window.monetaInstallPrompt = undefined;
        setPrompt(null);
        if (choice.outcome === 'accepted') setInstalled(true);
        else {
          try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* Storage may be unavailable. */ }
          setDismissed(true);
          setInstallHint('Installation was dismissed. You can install Moneta later from your browser menu.');
        }
      } catch {
        setInstallHint('Your browser could not open its install prompt. Use the browser menu to install Moneta.');
        setShowInstructions(true);
      }
      return;
    }

    if (!window.isSecureContext) {
      setInstallHint('Installation requires HTTPS. Localhost is allowed for development.');
    } else if (iosDevice) {
      setInstallHint('Use your browser’s Share or menu control, then choose “Add to Home Screen”.');
    } else if (dismissed) {
      setInstallHint('You can install Moneta later from your browser menu.');
    } else {
      setInstallHint('This browser has not offered its install prompt. Check the browser menu for “Install app” or “Add to Home Screen”.');
    }
    setShowInstructions(true);
  };

  if (installed) return <p className="ft-install-status" role="status">Moneta is installed on this device.</p>;
  return (
    <div className="ft-install">
      <button type="button" className="ft-button ft-primary" onClick={() => void install()}>
        {iosSafari ? <Share size={16} /> : <Download size={16} />}Add to Home Screen
      </button>
      {showInstructions && (
        <div className="ft-install-instructions" role="status">
          <b>Add Moneta to your Home Screen</b>
          <span>{installHint || 'Open your browser menu and choose “Install app” or “Add to Home Screen”.'}</span>
          {iosSafari && <span>On iOS Safari: tap <Share size={14} aria-label="Share" /> Share → Add to Home Screen.</span>}
          <button type="button" className="ft-link" onClick={() => setShowInstructions(false)}>Got it</button>
        </div>
      )}
    </div>
  );
}
