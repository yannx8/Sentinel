import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from '../components/ui/toast';
import { useT } from '../i18n';

/** Registers the service worker and offers the reload when a new version is waiting. Renders nothing. */
export function PwaUpdates() {
  const { t } = useT();
  const { needRefresh, updateServiceWorker } = useRegisterSW();
  const waiting = needRefresh[0];
  useEffect(() => {
    if (!waiting) return;
    toast.info(t('pwa.updateAvailable'), {
      action: { label: t('pwa.reload'), onClick: () => void updateServiceWorker(true) },
    });
  }, [waiting, t, updateServiceWorker]);
  return null;
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as InstallEvent;
    listeners.forEach((listener) => listener());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((listener) => listener());
  });
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
// iPadOS reports itself as a Mac with touch.
const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1);

/** Android and desktop Chrome install through the saved prompt; iOS only through Share, Add to Home Screen. */
export function useInstall() {
  const [, rerender] = useState(0);
  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    listeners.add(listener);
    return () => void listeners.delete(listener);
  }, []);
  const installed = isStandalone();
  return {
    canPrompt: !installed && deferred !== null,
    showIosHelp: !installed && isIos(),
    install: async () => {
      const event = deferred;
      if (!event) return;
      await event.prompt();
      await event.userChoice;
      deferred = null;
      listeners.forEach((listener) => listener());
    },
  };
}
