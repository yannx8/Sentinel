import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

export type PushStatus = 'unsupported' | 'denied' | 'off' | 'on';

const supported = () =>
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  typeof window !== 'undefined' &&
  'PushManager' in window &&
  'Notification' in window;

/** The browser wants the public key as bytes. */
function keyBytes(base64Url: string) {
  const padded = base64Url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(base64Url.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/** Push on this device: the server's public key (null when push is off there), the state, and the two switches. */
export function usePush() {
  const key = useQuery({
    queryKey: ['push-key'],
    queryFn: ({ signal }) => api.get<{ publicKey: string | null }>('/me/push/key', { signal }),
    staleTime: Infinity,
  });
  const [status, setStatus] = useState<PushStatus>(supported() ? 'off' : 'unsupported');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!supported()) return;
    if (Notification.permission === 'denied') return setStatus('denied');
    setStatus((await currentSubscription()) ? 'on' : 'off');
  }, []);
  useEffect(() => void refresh(), [refresh]);

  const enable = async () => {
    const publicKey = key.data?.publicKey;
    if (!publicKey) return;
    setBusy(true);
    try {
      if ((await Notification.requestPermission()) !== 'granted') return;
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(publicKey),
        }));
      await api.post('/me/push/subscriptions', subscription.toJSON());
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        await api.delete('/me/push/subscriptions', { body: { endpoint: subscription.endpoint } });
        await subscription.unsubscribe();
      }
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  return { available: !!key.data?.publicKey, status, busy, enable, disable };
}
