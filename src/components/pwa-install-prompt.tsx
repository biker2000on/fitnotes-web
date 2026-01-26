'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

function shouldShowPrompt(): boolean {
  if (typeof window === 'undefined') return false;

  const stored = localStorage.getItem(DISMISS_KEY);

  // Never dismissed - show prompt
  if (!stored) return true;

  // Permanently dismissed (installed or explicitly never)
  if (stored === 'never') return false;

  // Check if temporary dismissal has expired
  const dismissedAt = parseInt(stored, 10);
  if (isNaN(dismissedAt)) return false; // Invalid value, don't show

  const now = Date.now();
  return (now - dismissedAt) > DISMISS_DURATION_MS;
}

function dismissTemporarily(): void {
  localStorage.setItem(DISMISS_KEY, Date.now().toString());
}

function dismissPermanently(): void {
  localStorage.setItem(DISMISS_KEY, 'never');
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const handleBeforeInstallPrompt = useCallback((e: Event) => {
    e.preventDefault();

    // Double-check dismissal status in the handler too
    if (!shouldShowPrompt()) return;

    setDeferredPrompt(e as BeforeInstallPromptEvent);
    setShowPrompt(true);
  }, []);

  useEffect(() => {
    // Check if we should show on mount
    if (!shouldShowPrompt()) return;

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [handleBeforeInstallPrompt]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      dismissPermanently();
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    dismissTemporarily();
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
            Install this app on your device for quick access and offline use.
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
