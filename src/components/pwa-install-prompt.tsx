'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION_DAYS = 7; // Don't show again for 7 days after dismissal

function isDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  const dismissed = localStorage.getItem(DISMISS_KEY);
  if (!dismissed) return false;

  const dismissedAt = parseInt(dismissed, 10);
  const now = Date.now();
  const daysSinceDismissed = (now - dismissedAt) / (1000 * 60 * 60 * 24);

  return daysSinceDismissed < DISMISS_DURATION_DAYS;
}

function setDismissed(): void {
  localStorage.setItem(DISMISS_KEY, Date.now().toString());
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Don't show if user recently dismissed
    if (isDismissed()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      // User installed - never show again
      localStorage.setItem(DISMISS_KEY, 'installed');
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setDismissed();
    setShowPrompt(false);
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm bg-card border rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1">Install FitNotes</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Install this app on your device for quick access and a better experience.
          </p>
          <div className="flex gap-2">
            <Button onClick={handleInstall} size="sm" className="flex-1">
              Install
            </Button>
            <Button onClick={handleDismiss} size="sm" variant="outline">
              Not Now
            </Button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
