/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>;
};

// The page asks for the update (see PwaUpdates), so a waiting worker waits until it is told to take over.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//, /^\/print\//] }));

/* Push: the server sends the event type and the incident reference, never names or text. */

type PushData = { type?: string; reference?: string | null; orgId?: string };

const french = (self.navigator.language || 'en').toLowerCase().startsWith('fr');
const text = {
  INCIDENT_CREATED: french ? 'Nouvel incident signalé' : 'New incident reported',
  ASSIGNED: french ? 'Un incident vous a été assigné' : 'An incident was assigned to you',
  other: french ? 'Un incident a été mis à jour' : 'An incident was updated',
};

self.addEventListener('push', (event) => {
  const data = (event.data?.json() ?? {}) as PushData;
  const body = data.type === 'INCIDENT_CREATED' || data.type === 'ASSIGNED' ? text[data.type] : text.other;
  event.waitUntil(
    self.registration.showNotification('Sentinel', {
      body: data.reference ? `${data.reference}: ${body}` : body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      tag: data.reference ?? data.type,
      data,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data as PushData;
  // Supervisors work in the console; everyone else opens the case file in its own organization.
  const target =
    data.type === 'INCIDENT_CREATED' || data.type === 'REASSIGNMENT_REQUESTED'
      ? `/app/incidents${data.reference ? `?incident=${encodeURIComponent(data.reference)}` : ''}`
      : data.reference
        ? `/field/incidents/${encodeURIComponent(data.reference)}${data.orgId ? `?org=${data.orgId}` : ''}`
        : '/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows[0];
      if (open) {
        await open.focus();
        await open.navigate(target);
      } else {
        await self.clients.openWindow(target);
      }
    })(),
  );
});
