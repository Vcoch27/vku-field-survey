import { Network, type ConnectionStatus } from '@capacitor/network';
import type { NetworkStatus, NetworkStatusPort, Unsubscribe } from '../../domain/ports.ts';

export interface PluginListenerHandleLike {
  remove(): Promise<void>;
}

export interface NetworkPluginLike {
  getStatus(): Promise<ConnectionStatus>;
  addListener(
    eventName: 'networkStatusChange',
    listenerFunc: (status: ConnectionStatus) => void
  ): Promise<PluginListenerHandleLike>;
}

export interface CapacitorNetworkAdapterDependencies {
  readonly networkPlugin?: NetworkPluginLike;
}

/**
 * Concrete native adapter implementing NetworkStatusPort using @capacitor/network.
 *
 * Enforces:
 * 1. Read initial status via Network.getStatus().
 * 2. Listen to native connectivity transitions via Network.addListener.
 * 3. Never mutates queue items directly to SYNCED.
 */
export class CapacitorNetworkAdapter implements NetworkStatusPort {
  private readonly networkPlugin: NetworkPluginLike;

  constructor(deps?: CapacitorNetworkAdapterDependencies) {
    this.networkPlugin = deps?.networkPlugin ?? Network;
  }

  async getNetworkStatus(): Promise<NetworkStatus> {
    try {
      const status = await this.networkPlugin.getStatus();
      return { isConnected: status.connected };
    } catch (error) {
      console.warn('Failed to retrieve Capacitor network status, defaulting to connected:', error);
      return { isConnected: true };
    }
  }

  subscribe(listener: (status: NetworkStatus) => void): Unsubscribe {
    let handle: PluginListenerHandleLike | null = null;
    let isCleanedUp = false;

    void this.networkPlugin
      .addListener('networkStatusChange', (status) => {
        listener({ isConnected: status.connected });
      })
      .then((h) => {
        if (isCleanedUp) {
          void h.remove();
        } else {
          handle = h;
        }
      })
      .catch((err) => {
        console.warn('Failed to attach Capacitor network status listener:', err);
      });

    return () => {
      isCleanedUp = true;
      if (handle) {
        void handle.remove();
        handle = null;
      }
    };
  }
}
