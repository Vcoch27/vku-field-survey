// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.tsx';
import type { AppRuntime } from './createRuntime.ts';
import type { SurveyStoragePort } from '../domain/ports.ts';
import type { SyncOrchestrator } from '../domain/syncOrchestrator.ts';
import type { WebSyncTriggerAdapter } from '../platform/pwa/WebSyncTriggerAdapter.ts';

describe('App Shell & Navigation Integration', () => {
  afterEach(() => {
    cleanup();
  });

  function createMockRuntime(isConnected = true): AppRuntime {
    const mockStorage = {
      getDraft: vi.fn().mockResolvedValue(null),
      saveDraft: vi.fn().mockResolvedValue(undefined),
      deleteDraft: vi.fn().mockResolvedValue(undefined),
      enqueueSubmission: vi.fn().mockResolvedValue(undefined),
      enqueueSubmissionAndClearDraft: vi.fn().mockResolvedValue(undefined),
      getPendingSubmissions: vi.fn().mockResolvedValue([]),
      getAllSubmissions: vi.fn().mockResolvedValue([]),
      getSubmissionById: vi.fn().mockResolvedValue(null),
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
      syncOrchestrator: {
        synchronize: vi.fn().mockResolvedValue({
          processedCount: 0,
          syncedCount: 0,
          failedCount: 0,
          recoveredStaleCount: 0,
          errors: [],
        }),
      } as unknown as SyncOrchestrator,
    };
  }

  it('renders application header with VKU logo, title, and workspace subtitle', async () => {
    const runtime = createMockRuntime(true);
    render(<App runtime={runtime} initialPath="/" />);

    expect(screen.getByText('VKU Field Survey')).toBeTruthy();
    expect(screen.getByText('Field Inspection')).toBeTruthy();
    expect(screen.getByAltText('VKU Field Survey Logo')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByLabelText('Online')).toBeTruthy();
    });
  });

  it('renders offline indicator badge when network status is disconnected', async () => {
    const runtime = createMockRuntime(false);
    render(<App runtime={runtime} initialPath="/" />);

    await waitFor(() => {
      expect(screen.getByLabelText('Offline')).toBeTruthy();
    });
  });

  it('navigates to Survey, Stats, and Records via navigation links', async () => {
    const user = userEvent.setup();
    const runtime = createMockRuntime(true);
    render(<App runtime={runtime} initialPath="/" />);

    // Starts on Home
    expect(screen.getByText('What needs attention next?')).toBeTruthy();

    // Click "Start New Survey" button on Home
    await user.click(screen.getByRole('button', { name: 'Start New Survey' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Submit Inspection' })).toBeTruthy();
    });

    // Click bottom nav "Stats"
    const statsNav = screen.getAllByLabelText('Statistics')[0];
    await user.click(statsNav);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Statistics' })).toBeTruthy();
    });

    // Click bottom nav "Records"
    const recordsNav = screen.getAllByLabelText('Records')[0];
    await user.click(recordsNav);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Records' })).toBeTruthy();
    });
  });
});
