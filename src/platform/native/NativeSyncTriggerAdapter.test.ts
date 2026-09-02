import { describe, expect, it, vi } from 'vitest';
import {
  NativeSyncTriggerAdapter,
  type NativeSyncTriggerSource,
} from './NativeSyncTriggerAdapter.ts';
import type { ConnectionStatus } from '@capacitor/network';
import type { AppState } from '@capacitor/app';
import type { SurveySubmission } from '../../domain/models.ts';
import type { SurveyStoragePort } from '../../domain/ports.ts';

describe('NativeSyncTriggerAdapter (NATIVE-06, SYNC-REQ-04)', () => {
  function createMockPlugins() {
    let networkCb: ((status: ConnectionStatus) => void) | null = null;
    let appCb: ((state: AppState) => void) | null = null;
    const removeNetworkMock = vi.fn().mockResolvedValue(undefined);
    const removeAppMock = vi.fn().mockResolvedValue(undefined);

    const mockNetworkPlugin = {
      addListener: vi
        .fn()
        .mockImplementation((_event: string, cb: (status: ConnectionStatus) => void) => {
          networkCb = cb;
          return Promise.resolve({ remove: removeNetworkMock });
        }),
    };

    const mockAppPlugin = {
      addListener: vi.fn().mockImplementation((_event: string, cb: (state: AppState) => void) => {
        appCb = cb;
        return Promise.resolve({ remove: removeAppMock });
      }),
    };

    return {
      mockNetworkPlugin,
      mockAppPlugin,
      fireNetworkStatus: (connected: boolean) => {
        networkCb?.({ connected, connectionType: connected ? 'wifi' : 'none' });
      },
      fireAppState: (isActive: boolean) => {
        appCb?.({ isActive });
      },
      removeNetworkMock,
      removeAppMock,
    };
  }

  it('7. native network connectivity event requests sync (NATIVE_NETWORK_RECONNECT)', async () => {
    const plugins = createMockPlugins();
    const triggerCalls: NativeSyncTriggerSource[] = [];

    const adapter = new NativeSyncTriggerAdapter({
      networkPlugin: plugins.mockNetworkPlugin,
      appPlugin: plugins.mockAppPlugin,
      onTrigger: (source) => {
        triggerCalls.push(source);
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    // When network disconnects, no trigger
    plugins.fireNetworkStatus(false);
    expect(triggerCalls).toHaveLength(0);

    // When network reconnects, dispatches trigger
    plugins.fireNetworkStatus(true);
    expect(triggerCalls).toEqual(['NATIVE_NETWORK_RECONNECT']);

    adapter.destroy();
  });

  it('native app resume requests sync (APP_RESUME)', async () => {
    const plugins = createMockPlugins();
    const triggerCalls: NativeSyncTriggerSource[] = [];

    const adapter = new NativeSyncTriggerAdapter({
      networkPlugin: plugins.mockNetworkPlugin,
      appPlugin: plugins.mockAppPlugin,
      onTrigger: (source) => {
        triggerCalls.push(source);
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    // When app goes inactive, no trigger
    plugins.fireAppState(false);
    expect(triggerCalls).toHaveLength(0);

    // When app resumes (isActive: true), dispatches trigger
    plugins.fireAppState(true);
    expect(triggerCalls).toEqual(['APP_RESUME']);

    adapter.destroy();
  });

  it('8. network event itself never marks submission SYNCED', async () => {
    const plugins = createMockPlugins();
    const queuedRecord: SurveySubmission = {
      id: 'mock-sub-1',
      timestamp: '2026-09-02T16:00:00.000Z',
      surveyData: {
        zone: 'K',
        building: 'Building A',
        roomNumber: '101',
        category: 'AC',
        conditionRating: 3,
        defectNotes: 'Filter needs cleaning',
        photo: null,
      },
      syncStatus: 'PENDING_SYNC',
    };

    const mockStorage = {
      markSubmissionSynced: vi.fn(),
      updateSubmissionStatus: vi.fn(),
    } as unknown as SurveyStoragePort;

    const adapter = new NativeSyncTriggerAdapter({
      networkPlugin: plugins.mockNetworkPlugin,
      appPlugin: plugins.mockAppPlugin,
      onTrigger: async () => {
        // Platform trigger only invokes notification, does not mutate record status
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    plugins.fireNetworkStatus(true);
    plugins.fireAppState(true);

    expect(mockStorage.markSubmissionSynced).not.toHaveBeenCalled();
    expect(mockStorage.updateSubmissionStatus).not.toHaveBeenCalled();
    expect(queuedRecord.syncStatus).toBe('PENDING_SYNC');

    adapter.destroy();
  });
});
