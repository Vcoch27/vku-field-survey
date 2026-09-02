import { describe, expect, it, vi } from 'vitest';
import { CapacitorNetworkAdapter } from './CapacitorNetworkAdapter.ts';
import type { ConnectionStatus } from '@capacitor/network';

describe('CapacitorNetworkAdapter (NATIVE-05, NATIVE-06)', () => {
  it('6. Network adapter reports initial connection status', async () => {
    const mockPlugin = {
      getStatus: vi.fn().mockResolvedValue({
        connected: true,
        connectionType: 'wifi',
      } as ConnectionStatus),
      addListener: vi.fn(),
    };

    const adapter = new CapacitorNetworkAdapter({ networkPlugin: mockPlugin });
    const status = await adapter.getNetworkStatus();

    expect(mockPlugin.getStatus).toHaveBeenCalled();
    expect(status).toEqual({ isConnected: true });
  });

  it('reports offline initial status when disconnected', async () => {
    const mockPlugin = {
      getStatus: vi.fn().mockResolvedValue({
        connected: false,
        connectionType: 'none',
      } as ConnectionStatus),
      addListener: vi.fn(),
    };

    const adapter = new CapacitorNetworkAdapter({ networkPlugin: mockPlugin });
    const status = await adapter.getNetworkStatus();
    expect(status).toEqual({ isConnected: false });
  });

  it('subscribes to networkStatusChange and unsubscribes cleanly', async () => {
    let changeListener: ((status: ConnectionStatus) => void) | null = null;
    const removeMock = vi.fn().mockResolvedValue(undefined);

    const mockPlugin = {
      getStatus: vi
        .fn()
        .mockResolvedValue({ connected: true, connectionType: 'wifi' } as ConnectionStatus),
      addListener: vi
        .fn()
        .mockImplementation((_event: string, cb: (status: ConnectionStatus) => void) => {
          changeListener = cb;
          return Promise.resolve({ remove: removeMock });
        }),
    };

    const adapter = new CapacitorNetworkAdapter({ networkPlugin: mockPlugin });
    const receivedStatuses: boolean[] = [];

    const unsubscribe = adapter.subscribe((s) => {
      receivedStatuses.push(s.isConnected);
    });

    // Wait for addListener promise to settle
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockPlugin.addListener).toHaveBeenCalledWith(
      'networkStatusChange',
      expect.any(Function)
    );

    // Simulate transition to offline
    changeListener!({ connected: false, connectionType: 'none' });
    expect(receivedStatuses).toEqual([false]);

    // Simulate reconnection to online
    changeListener!({ connected: true, connectionType: 'cellular' });
    expect(receivedStatuses).toEqual([false, true]);

    // Clean up
    unsubscribe();
    expect(removeMock).toHaveBeenCalled();
  });
});
