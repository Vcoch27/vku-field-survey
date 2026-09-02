// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App.tsx';
import type { AppRuntime } from './createRuntime.ts';
import type { SurveyStoragePort } from '../domain/ports.ts';
import type { WebSyncTriggerAdapter } from '../platform/pwa/WebSyncTriggerAdapter.ts';

describe('App Layout & Connectivity UI (PWA Integration)', () => {
  function createMockRuntime(isConnected = true): AppRuntime {
    const mockStorage = {
      getDraft: vi.fn().mockResolvedValue(null),
      saveDraft: vi.fn().mockResolvedValue(undefined),
      deleteDraft: vi.fn().mockResolvedValue(undefined),
      enqueueSubmission: vi.fn().mockResolvedValue(undefined),
      enqueueSubmissionAndClearDraft: vi.fn().mockResolvedValue(undefined),
      getPendingSubmissions: vi.fn().mockResolvedValue([]),
      atomicClaimNext: vi.fn().mockResolvedValue(null),
      recoverStaleClaims: vi.fn().mockResolvedValue(0),
      updateSubmissionStatus: vi.fn().mockResolvedValue(undefined),
      markSubmissionSynced: vi.fn().mockResolvedValue(undefined),
    } as unknown as SurveyStoragePort;

    const mockNetworkStatus = {
      getNetworkStatus: vi.fn().mockResolvedValue({ isConnected }),
      subscribe: vi.fn(() => () => undefined),
    };

    const mockSyncTriggerAdapter = {
      requestBackgroundSync: vi.fn().mockResolvedValue(true),
      dispatchTrigger: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
    };

    const mockCamera = {
      capturePhoto: vi.fn().mockResolvedValue(null),
    };

    return {
      storage: mockStorage,
      uuidGenerator: { generateUuid: () => 'app-test-uuid' },
      clock: { now: () => '2026-09-02T12:00:00.000Z' },
      networkStatus: mockNetworkStatus,
      camera: mockCamera,
      syncTriggerAdapter: mockSyncTriggerAdapter as unknown as WebSyncTriggerAdapter,
      isNative: false,
    };
  }

  it('renders application header with title and subtitle', async () => {
    const runtime = createMockRuntime(true);
    render(<App runtime={runtime} />);

    expect(screen.getByText('VKU Field Survey')).toBeTruthy();
    expect(screen.getByText('Campus Equipment & Facility Inspection')).toBeTruthy();

    // Online mode: offline badge is absent
    await waitFor(() => {
      expect(screen.queryByLabelText('Offline Mode')).toBeNull();
    });
  });

  it('renders offline indicator badge when network status is disconnected', async () => {
    const runtime = createMockRuntime(false);
    render(<App runtime={runtime} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Offline Mode')).toBeTruthy();
      expect(screen.getByText('Offline')).toBeTruthy();
    });
  });
});
