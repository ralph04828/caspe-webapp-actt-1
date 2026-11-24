import { registerSW } from 'virtual:pwa-register';

type UpdateListener = (hasUpdate: boolean) => void;

const listeners = new Set<UpdateListener>();
let initialized = false;
let updateAvailable = false;
let updateSwFn: ((reloadPage?: boolean) => Promise<void>) | null = null;
let registrationRef: ServiceWorkerRegistration | null = null;

function notify() {
  for (const listener of listeners) {
    try {
      listener(updateAvailable);
    } catch {
      // ignore listener errors
    }
  }
}

export function subscribePwaUpdate(listener: UpdateListener): () => void {
  listeners.add(listener);
  listener(updateAvailable);
  return () => {
    listeners.delete(listener);
  };
}

export function dismissPwaUpdate(): void {
  updateAvailable = false;
  notify();
}

export async function applyPwaUpdate(): Promise<void> {
  try {
    if (registrationRef?.waiting) {
      registrationRef.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    if (updateSwFn) {
      await updateSwFn(true);
    }
  } catch (err) {
    console.warn('[PWA] Update apply fallback reload:', err);
  } finally {
    window.location.reload();
  }
}

export function initPwaUpdater(): void {
  if (initialized) return;
  initialized = true;
  if (!import.meta.env.PROD) return;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const hadController = Boolean(navigator.serviceWorker.controller);
  let controllerChangedFromExisting = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !controllerChangedFromExisting) {
      controllerChangedFromExisting = true;
      updateAvailable = true;
      notify();
    }
  });

  const checkForUpdates = () => {
    if (!registrationRef) return;
    registrationRef.update().catch(() => {
      // offline or transient check failure
    });
  };

  updateSwFn = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateAvailable = true;
      notify();
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      registrationRef = registration;

      if (registration.waiting && hadController) {
        updateAvailable = true;
        notify();
      }

      window.setInterval(checkForUpdates, 60_000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkForUpdates();
        }
      });
    },
    onRegisterError(error) {
      console.warn('[PWA] Service worker registration error:', error);
    },
  });
}
