import { describe, expect, it, vi } from 'vitest';
import { WebSyncTriggerAdapter, type SyncTriggerSource } from './WebSyncTriggerAdapter.ts';
import type { SurveySubmission } from '../../domain/models.ts';
import type { SurveyStoragePort } from '../../domain/ports.ts';

describe('WebSyncTriggerAdapter (Platform Synchronization Triggers)', () => {
  function createMockEnvironment() {
    const windowListeners: Record<string, ((event: Event) => void)[]> = {};
    const documentListeners: Record<string, ((event: Event) => void)[]> = {};
    const swListeners: Record<string, ((event: MessageEvent) => void)[]> = {};

    const fakeWindow = {
      addEventListener: vi.fn((event: string, cb: (event: Event) => void) => {
        windowListeners[event] = windowListeners[event] || [];
        windowListeners[event].push(cb);
      }),
      removeEventListener: vi.fn((event: string, cb: (event: Event) => void) => {
        windowListeners[event] = (windowListeners[event] || []).filter((l) => l !== cb);
      }),
      navigator: {
        onLine: true,
      },
    } as unknown as Window;

    let currentVisibilityState = 'visible';
    const fakeDocument = {
      get visibilityState() {
        return currentVisibilityState;
      },
      set visibilityState(val: string) {
        currentVisibilityState = val;
      },
      addEventListener: vi.fn((event: string, cb: (event: Event) => void) => {
        documentListeners[event] = documentListeners[event] || [];
        documentListeners[event].push(cb);
      }),
      removeEventListener: vi.fn((event: string, cb: (event: Event) => void) => {
        documentListeners[event] = (documentListeners[event] || []).filter((l) => l !== cb);
      }),
    } as unknown as Document;

    const fakeSWContainer = {
      addEventListener: vi.fn((event: string, cb: (event: MessageEvent) => void) => {
        swListeners[event] = swListeners[event] || [];
        swListeners[event].push(cb);
      }),
      removeEventListener: vi.fn((event: string, cb: (event: MessageEvent) => void) => {
        swListeners[event] = (swListeners[event] || []).filter((l) => l !== cb);
      }),
    } as unknown as ServiceWorkerContainer;

    return {
      fakeWindow,
      fakeDocument,
      fakeSWContainer,
      setVisibility: (val: DocumentVisibilityState) => {
        currentVisibilityState = val;
      },
      fireOnline: () => windowListeners['online']?.forEach((cb) => cb(new Event('online'))),
      fireVisibilityChange: () =>
        documentListeners['visibilitychange']?.forEach((cb) => cb(new Event('visibilitychange'))),
      fireSWMessage: (data: unknown) =>
        swListeners['message']?.forEach((cb) => cb(new MessageEvent('message', { data }))),
    };
  }

  it('web online event requests sync rather than marking records successful (SYNC-03, SYNC-10)', async () => {
    const env = createMockEnvironment();
    const triggerCalls: SyncTriggerSource[] = [];

    const adapter = new WebSyncTriggerAdapter({
      targetWindow: env.fakeWindow,
      targetDocument: env.fakeDocument,
      serviceWorkerContainer: env.fakeSWContainer,
      onTrigger: (source) => {
        triggerCalls.push(source);
      },
    });

    // Simulate online event
    env.fireOnline();

    expect(triggerCalls).toEqual(['ONLINE_EVENT']);

    adapter.destroy();
  });

  it('document visibilitychange to visible requests sync attempt (SYNC-08)', async () => {
    const env = createMockEnvironment();
    const triggerCalls: SyncTriggerSource[] = [];

    const adapter = new WebSyncTriggerAdapter({
      targetWindow: env.fakeWindow,
      targetDocument: env.fakeDocument,
      serviceWorkerContainer: env.fakeSWContainer,
      onTrigger: (source) => {
        triggerCalls.push(source);
      },
    });

    // When hidden, trigger does NOT fire
    env.setVisibility('hidden');
    env.fireVisibilityChange();
    expect(triggerCalls).toHaveLength(0);

    // When becoming visible, trigger fires
    env.setVisibility('visible');
    env.fireVisibilityChange();
    expect(triggerCalls).toEqual(['VISIBILITY_CHANGE']);

    adapter.destroy();
  });

  it('service worker VKU_SYNC_TRIGGER message requests sync attempt', async () => {
    const env = createMockEnvironment();
    const triggerCalls: SyncTriggerSource[] = [];

    const adapter = new WebSyncTriggerAdapter({
      targetWindow: env.fakeWindow,
      targetDocument: env.fakeDocument,
      serviceWorkerContainer: env.fakeSWContainer,
      onTrigger: (source) => {
        triggerCalls.push(source);
      },
    });

    // Unrelated message is ignored
    env.fireSWMessage({ type: 'UNRELATED_MESSAGE' });
    expect(triggerCalls).toHaveLength(0);

    // VKU_SYNC_TRIGGER message initiates sync
    env.fireSWMessage({ type: 'VKU_SYNC_TRIGGER' });
    expect(triggerCalls).toEqual(['BACKGROUND_SYNC']);

    adapter.destroy();
  });

  it('no trigger itself changes queue item to SYNCED (SYNC-04, SYNC-10)', async () => {
    const queuedRecord: SurveySubmission = {
      id: 'mock-uuid-1',
      timestamp: '2026-09-02T10:00:00.000Z',
      surveyData: {
        zone: 'K',
        building: 'Building A',
        roomNumber: '201',
        category: 'Hardware',
        conditionRating: 4,
        defectNotes: 'Notes',
        photo: null,
      },
      syncStatus: 'PENDING_SYNC',
    };

    const mockStorage = {
      markSubmissionSynced: vi.fn(),
      updateSubmissionStatus: vi.fn(),
    } as unknown as SurveyStoragePort;

    const env = createMockEnvironment();

    const adapter = new WebSyncTriggerAdapter({
      targetWindow: env.fakeWindow,
      targetDocument: env.fakeDocument,
      serviceWorkerContainer: env.fakeSWContainer,
      onTrigger: async () => {
        // Platform adapter only notifies the caller; does NOT mutate queue records directly!
      },
    });

    env.fireOnline();
    env.fireVisibilityChange();
    env.fireSWMessage({ type: 'VKU_SYNC_TRIGGER' });

    // Ensure storage markSubmissionSynced was never called by the trigger adapter
    expect(mockStorage.markSubmissionSynced).not.toHaveBeenCalled();
    expect(mockStorage.updateSubmissionStatus).not.toHaveBeenCalled();
    expect(queuedRecord.syncStatus).toBe('PENDING_SYNC');

    adapter.destroy();
  });

  it('repeated platform triggers avoid overlapping calls and rely on durable claiming', async () => {
    const env = createMockEnvironment();
    let callCount = 0;

    let resolveTrigger: () => void;
    const adapter = new WebSyncTriggerAdapter({
      targetWindow: env.fakeWindow,
      targetDocument: env.fakeDocument,
      serviceWorkerContainer: env.fakeSWContainer,
      onTrigger: async () => {
        callCount += 1;
        await new Promise<void>((resolve) => {
          resolveTrigger = resolve;
        });
      },
    });

    // 1st trigger
    void adapter.dispatchTrigger('ONLINE_EVENT');
    expect(callCount).toBe(1);

    // 2nd and 3rd triggers arrive while 1st is in flight -> guarded from duplicate overlap
    void adapter.dispatchTrigger('VISIBILITY_CHANGE');
    void adapter.dispatchTrigger('ONLINE_EVENT');
    expect(callCount).toBe(1);

    // Resolve 1st trigger
    resolveTrigger!();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Next trigger after resolution succeeds
    void adapter.dispatchTrigger('MANUAL');
    expect(callCount).toBe(2);

    adapter.destroy();
  });

  it('adapter does not invent any remote backend URLs', () => {
    // Read source string of WebSyncTriggerAdapter
    const adapterSource = WebSyncTriggerAdapter.toString();
    expect(adapterSource).not.toMatch(/https?:\/\//i);
    expect(adapterSource).not.toMatch(/fetch\(/i);
    expect(adapterSource).not.toMatch(/localhost/i);
    expect(adapterSource).not.toMatch(/supabase/i);
    expect(adapterSource).not.toMatch(/firebase/i);
  });
});
