import { describe, expect, it, vi } from 'vitest';
import { handleSyncEvent, notifyClientsToSync } from './platform/pwa/swSyncHandler.ts';
import type { SubmissionGateway, SurveyStoragePort } from './domain/ports.ts';

describe('Service Worker Synchronization Handling (SYNC-09, PWA-REQ-06)', () => {
  const createMockClients = () => ({
    matchAll: vi.fn().mockResolvedValue([
      {
        postMessage: vi.fn(),
      },
    ]),
  });

  it('unrelated Service Worker sync tags are ignored (Requirement R.5)', async () => {
    const mockClients = createMockClients();
    const isHandled = await handleSyncEvent('unrelated-tag-123', mockClients);
    expect(isHandled).toBe(false);
  });

  it('handles approved tag vku-survey-sync and notifies window clients', async () => {
    const mockClients = createMockClients();
    const isHandled = await handleSyncEvent('vku-survey-sync', mockClients);
    expect(isHandled).toBe(true);

    expect(mockClients.matchAll).toHaveBeenCalledWith({
      type: 'window',
      includeUncontrolled: true,
    });
  });

  it('delegates to synchronizeSubmissions when gateway and storage are injected without duplicating state machine', async () => {
    const mockClients = createMockClients();
    const mockStorage = {
      recoverStaleClaims: vi.fn().mockResolvedValue(0),
      atomicClaimNext: vi.fn().mockResolvedValue(null),
    } as unknown as SurveyStoragePort;

    const mockGateway = {
      sendSubmission: vi.fn(),
    } as unknown as SubmissionGateway;

    const isHandled = await handleSyncEvent(
      'vku-survey-sync',
      mockClients,
      mockGateway,
      mockStorage
    );
    expect(isHandled).toBe(true);
    expect(mockStorage.atomicClaimNext).toHaveBeenCalled();
  });

  it('service worker code does not invent a backend URL', () => {
    const swSource = handleSyncEvent.toString() + notifyClientsToSync.toString();
    expect(swSource).not.toMatch(/https?:\/\//i);
    expect(swSource).not.toMatch(/localhost:\d+/i);
    expect(swSource).not.toMatch(/supabase/i);
    expect(swSource).not.toMatch(/firebase/i);
  });
});
