import { VKU_SYNC_TAG } from './backgroundSync.ts';
import type { SubmissionGateway, SurveyStoragePort } from '../../domain/ports.ts';
import { synchronizeSubmissions } from '../../domain/syncOrchestrator.ts';

export interface ServiceWorkerClientsProvider {
  matchAll(
    options?: ClientQueryOptions
  ): Promise<ReadonlyArray<{ postMessage(message: unknown): void }>>;
}

/**
 * Broadcasts a sync trigger message to all controlled and uncontrolled window clients.
 */
export async function notifyClientsToSync(
  clientsProvider: ServiceWorkerClientsProvider,
  source: string
): Promise<void> {
  const clients = await clientsProvider.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  for (const client of clients) {
    client.postMessage({
      type: 'VKU_SYNC_TRIGGER',
      source,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Handles the Service Worker 'sync' event.
 *
 * Invariants:
 * 1. Only handles approved tag 'vku-survey-sync'. Unrelated tags return false.
 * 2. Notifies active browser window clients via postMessage to trigger page-side sync.
 * 3. When storage and gateway are injected (e.g. in background headless execution),
 *    delegates directly to the M6 synchronizeSubmissions use case.
 * 4. Never invents a fake backend endpoint or claims remote success prematurely.
 */
export async function handleSyncEvent(
  tag: string,
  clientsProvider?: ServiceWorkerClientsProvider,
  gateway?: SubmissionGateway,
  storage?: SurveyStoragePort
): Promise<boolean> {
  if (tag !== VKU_SYNC_TAG) {
    // Unrelated tags are strictly ignored per requirement R.5
    return false;
  }

  if (clientsProvider) {
    await notifyClientsToSync(clientsProvider, 'BACKGROUND_SYNC');
  }

  if (gateway && storage) {
    await synchronizeSubmissions({ storage, gateway });
  }

  return true;
}
