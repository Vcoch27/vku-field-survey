import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { createRuntime } from './createRuntime.ts';
import { WebNetworkStatusAdapter } from '../platform/network/WebNetworkStatusAdapter.ts';
import { CapacitorNetworkAdapter } from '../platform/network/CapacitorNetworkAdapter.ts';
import { WebCameraAdapter } from '../platform/camera/WebCameraAdapter.ts';
import { CapacitorCameraAdapter } from '../platform/camera/CapacitorCameraAdapter.ts';
import { WebSyncTriggerAdapter } from '../platform/pwa/WebSyncTriggerAdapter.ts';
import { NativeSyncTriggerAdapter } from '../platform/native/NativeSyncTriggerAdapter.ts';
import type { SubmissionGateway, SurveyStoragePort } from '../domain/ports.ts';

describe('Runtime Composition Root (createRuntime)', () => {
  it('9. web runtime selects web adapters when isNative is false', () => {
    const runtime = createRuntime({ isNative: false });

    expect(runtime.isNative).toBe(false);
    expect(runtime.networkStatus).toBeInstanceOf(WebNetworkStatusAdapter);
    expect(runtime.camera).toBeInstanceOf(WebCameraAdapter);
    expect(runtime.syncTriggerAdapter).toBeInstanceOf(WebSyncTriggerAdapter);

    runtime.syncTriggerAdapter.destroy();
  });

  it('10. native runtime selects Capacitor adapters when isNative is true', () => {
    const runtime = createRuntime({ isNative: true });

    expect(runtime.isNative).toBe(true);
    expect(runtime.networkStatus).toBeInstanceOf(CapacitorNetworkAdapter);
    expect(runtime.camera).toBeInstanceOf(CapacitorCameraAdapter);
    expect(runtime.syncTriggerAdapter).toBeInstanceOf(NativeSyncTriggerAdapter);

    runtime.syncTriggerAdapter.destroy();
  });

  it('dispatches sync workflow when gateway is configured', async () => {
    const mockStorage = {
      recoverStaleClaims: vi.fn().mockResolvedValue(0),
      atomicClaimNext: vi.fn().mockResolvedValue(null),
    } as unknown as SurveyStoragePort;

    const mockGateway = {
      sendSubmission: vi.fn(),
    } as unknown as SubmissionGateway;

    const runtime = createRuntime({
      isNative: false,
      storage: mockStorage,
      gateway: mockGateway,
    });

    await runtime.syncTriggerAdapter.dispatchTrigger('MANUAL');

    expect(mockStorage.atomicClaimNext).toHaveBeenCalled();

    runtime.syncTriggerAdapter.destroy();
  });
});
