import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  const isIos =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as any).MSStream;

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(standalone);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (isInstalled) return null;
  if (!deferredPrompt && !isIos) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosHelp(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        className="flex items-center gap-1.5 px-3 py-2 rounded-control text-xs font-medium border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] hover:bg-[#eae7e0] dark:hover:bg-[#303030] transition-colors whitespace-nowrap cursor-pointer min-h-[38px]"
      >
        <Download className="w-3.5 h-3.5" />
        <span className={compact ? 'hidden md:inline' : ''}>Install App</span>
      </button>

      {showIosHelp && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-install-title"
        >
          <div className="w-full max-w-sm rounded-modal bg-[#f5f4f0] dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                <h3 id="ios-install-title" className="font-display font-bold text-base">
                  Install SWOOOSH
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIosHelp(false)}
                aria-label="Close install instructions"
                className="p-1.5 rounded-control hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="text-xs space-y-2 text-[#4e4c46] dark:text-[#c2bfb8] list-decimal pl-4">
              <li>Tap the Share icon at the bottom of Safari.</li>
              <li>Scroll down and tap &ldquo;Add to Home Screen&rdquo;.</li>
              <li>Tap &ldquo;Add&rdquo; to launch SWOOOSH full-screen.</li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
};
