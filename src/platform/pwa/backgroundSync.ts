export const VKU_SYNC_TAG = 'vku-survey-sync';

export interface BackgroundSyncRegistrationTarget {
  readonly sync?: {
    register(tag: string): Promise<void>;
  };
}

/**
 * Checks if Background Sync is supported on the authoritative ServiceWorkerRegistration capability boundary.
 * Does not depend on global SyncManager constructor presence.
 */
export async function isBackgroundSyncSupported(
  target: Window | ServiceWorkerRegistration | undefined = typeof window !== 'undefined' ? window : undefined
): Promise<boolean> {
  if (!target) {
    return false;
  }

  // If passed directly a ServiceWorkerRegistration instance
  if ('sync' in target) {
    const syncTarget = target as unknown as BackgroundSyncRegistrationTarget;
    return typeof syncTarget.sync?.register === 'function';
  }

  // If passed a Window instance
  const win = target as Window;
  if (!win.navigator?.serviceWorker) {
    return false;
  }

  try {
    const registration = await win.navigator.serviceWorker.ready;
    const syncTarget = registration as unknown as BackgroundSyncRegistrationTarget;
    return Boolean(syncTarget && 'sync' in syncTarget && typeof syncTarget.sync?.register === 'function');
  } catch {
    return false;
  }
}

/**
 * Authoritatively requests Background Sync on ServiceWorkerRegistration.sync.
 *
 * Sequence:
 * 1. verify navigator.serviceWorker exists
 * 2. await navigator.serviceWorker.ready
 * 3. verify 'sync' in registration
 * 4. call registration.sync.register(BACKGROUND_SYNC_TAG)
 *
 * Where unsupported or rejected, returns false safely without throwing.
 */
export async function requestBackgroundSync(
  tag: string = VKU_SYNC_TAG,
  targetWindow: Window | undefined = typeof window !== 'undefined' ? window : undefined
): Promise<boolean> {
  if (!targetWindow?.navigator?.serviceWorker) {
    return false;
  }

  try {
    const registration = await targetWindow.navigator.serviceWorker.ready;
    const syncTarget = registration as unknown as BackgroundSyncRegistrationTarget;
    if (syncTarget && 'sync' in syncTarget && typeof syncTarget.sync?.register === 'function') {
      await syncTarget.sync.register(tag);
      return true;
    }
    return false;
  } catch (error) {
    // Graceful degradation: never throw if registration fails
    console.warn('Background sync registration failed, falling back to window events:', error);
    return false;
  }
}
