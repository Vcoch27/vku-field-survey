import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';
import { VKU_SYNC_TAG } from './platform/pwa/backgroundSync.ts';
import { handleSyncEvent } from './platform/pwa/swSyncHandler.ts';

declare let self: ServiceWorkerGlobalScope;

// 1. Clean up outdated caches from older versions
cleanupOutdatedCaches();

// 2. Precache App Shell resources injected by vite-plugin-pwa (HTML, JS, CSS, icons)
precacheAndRoute(self.__WB_MANIFEST);

// 3. Register navigation fallback for offline SPA boot and reload (PWA-05, PWA-06)
// Serves cached index.html for all page navigations except /api/ or other non-navigation requests
const navigationHandler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(navigationHandler, {
  denylist: [/^\/api\//],
});
registerRoute(navigationRoute);

// 4. Service Worker activation lifecycle
self.skipWaiting();
clientsClaim();

interface SyncEvent extends Event {
  readonly tag: string;
  waitUntil(promise: Promise<unknown>): void;
}

// Background Sync event listener
self.addEventListener('sync', (event: Event) => {
  const syncEvent = event as SyncEvent;
  if (syncEvent.tag === VKU_SYNC_TAG) {
    syncEvent.waitUntil(handleSyncEvent(syncEvent.tag, self.clients));
  }
});

// Update / message event listener
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});
