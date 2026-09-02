import { describe, expect, it, vi } from 'vitest';
import {
  isBackgroundSyncSupported,
  requestBackgroundSync,
  VKU_SYNC_TAG,
} from './backgroundSync.ts';

describe('Background Sync Capability Detection & Registration (PWA-REQ-06, SYNC-09, M7.1)', () => {
  it('1. no serviceWorker support → false', async () => {
    const fakeWindow = {
      navigator: {},
    } as unknown as Window;

    expect(await isBackgroundSyncSupported(fakeWindow)).toBe(false);
    expect(await requestBackgroundSync(VKU_SYNC_TAG, fakeWindow)).toBe(false);
  });

  it('2. Service Worker exists but registration lacks sync → false', async () => {
    const fakeRegistration = {}; // No sync property on registration
    const fakeWindow = {
      navigator: {
        serviceWorker: {
          ready: Promise.resolve(fakeRegistration),
        },
      },
    } as unknown as Window;

    expect(await isBackgroundSyncSupported(fakeWindow)).toBe(false);
    expect(await requestBackgroundSync(VKU_SYNC_TAG, fakeWindow)).toBe(false);
  });

  it('3. registration.sync exists → expected tag registered', async () => {
    const registerMock = vi.fn().mockResolvedValue(undefined);
    const fakeRegistration = {
      sync: {
        register: registerMock,
      },
    };

    const fakeWindow = {
      navigator: {
        serviceWorker: {
          ready: Promise.resolve(fakeRegistration),
        },
      },
    } as unknown as Window;

    expect(await isBackgroundSyncSupported(fakeWindow)).toBe(true);

    const result = await requestBackgroundSync(VKU_SYNC_TAG, fakeWindow);
    expect(result).toBe(true);
    expect(registerMock).toHaveBeenCalledWith('vku-survey-sync');
  });

  it('4. register rejection → false, no uncaught error', async () => {
    const fakeRegistration = {
      sync: {
        register: vi.fn().mockRejectedValue(new Error('PermissionDeniedError')),
      },
    };

    const fakeWindow = {
      navigator: {
        serviceWorker: {
          ready: Promise.resolve(fakeRegistration),
        },
      },
    } as unknown as Window;

    const result = await requestBackgroundSync(VKU_SYNC_TAG, fakeWindow);
    expect(result).toBe(false);
  });

  it('5. implementation does not depend on SyncManager in window', async () => {
    const registerMock = vi.fn().mockResolvedValue(undefined);
    const fakeRegistration = {
      sync: {
        register: registerMock,
      },
    };

    // Explicitly verify 'SyncManager' in fakeWindow is false
    const fakeWindow = {
      navigator: {
        serviceWorker: {
          ready: Promise.resolve(fakeRegistration),
        },
      },
    } as unknown as Window;

    expect('SyncManager' in fakeWindow).toBe(false);

    // Registration capability is authoritative regardless of global constructor presence
    expect(await isBackgroundSyncSupported(fakeWindow)).toBe(true);
    const result = await requestBackgroundSync(VKU_SYNC_TAG, fakeWindow);
    expect(result).toBe(true);
    expect(registerMock).toHaveBeenCalledWith('vku-survey-sync');
  });

  it('registration capability overrides deceptive SyncManager global when sync is missing on registration', async () => {
    // Edge case: window has SyncManager global, but registration lacks sync property
    const fakeWindow = {
      SyncManager: class {},
      navigator: {
        serviceWorker: {
          ready: Promise.resolve({}), // lacks sync
        },
      },
    } as unknown as Window;

    expect('SyncManager' in fakeWindow).toBe(true);
    // Authoritative check must report false because registration.sync is missing
    expect(await isBackgroundSyncSupported(fakeWindow)).toBe(false);
    expect(await requestBackgroundSync(VKU_SYNC_TAG, fakeWindow)).toBe(false);
  });
});
