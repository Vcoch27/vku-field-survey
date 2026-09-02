import { describe, expect, it, vi } from 'vitest';
import { WebNetworkStatusAdapter } from './WebNetworkStatusAdapter.ts';
import type { NetworkStatus } from '../../domain/ports.ts';

describe('WebNetworkStatusAdapter', () => {
  it('reads initial connection status from navigator.onLine', async () => {
    const fakeWindow = {
      navigator: { onLine: true },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window;

    const adapter = new WebNetworkStatusAdapter(fakeWindow);
    const status = await adapter.getNetworkStatus();
    expect(status.isConnected).toBe(true);
  });

  it('notifies subscribers on online and offline events and cleans up on unsubscribe', () => {
    const listeners: Record<string, ((event: Event) => void)[]> = {};
    const fakeWindow = {
      navigator: { onLine: true },
      addEventListener: vi.fn((evt: string, cb: (event: Event) => void) => {
        listeners[evt] = listeners[evt] || [];
        listeners[evt].push(cb);
      }),
      removeEventListener: vi.fn((evt: string, cb: (event: Event) => void) => {
        listeners[evt] = (listeners[evt] || []).filter((l) => l !== cb);
      }),
    } as unknown as Window;

    const adapter = new WebNetworkStatusAdapter(fakeWindow);
    const events: NetworkStatus[] = [];
    const unsubscribe = adapter.subscribe((status) => {
      events.push(status);
    });

    // Fire offline
    listeners['offline']?.forEach((cb) => cb(new Event('offline')));
    expect(events).toEqual([{ isConnected: false }]);

    // Fire online
    listeners['online']?.forEach((cb) => cb(new Event('online')));
    expect(events).toEqual([{ isConnected: false }, { isConnected: true }]);

    // Unsubscribe
    unsubscribe();
    expect(fakeWindow.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(fakeWindow.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
  });
});
