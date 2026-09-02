import { App, type AppState } from '@capacitor/app';
import { Network, type ConnectionStatus } from '@capacitor/network';
import type { PluginListenerHandleLike } from '../network/CapacitorNetworkAdapter.ts';

export type NativeSyncTriggerSource =
  | 'NATIVE_NETWORK_RECONNECT'
  | 'APP_RESUME'
  | 'VISIBILITY_CHANGE'
  | 'ONLINE_EVENT'
  | 'MANUAL';

export interface AppPluginLike {
  addListener(
    eventName: 'appStateChange',
    listenerFunc: (state: AppState) => void
  ): Promise<PluginListenerHandleLike>;
}

export interface NetworkPluginLike {
  addListener(
    eventName: 'networkStatusChange',
    listenerFunc: (status: ConnectionStatus) => void
  ): Promise<PluginListenerHandleLike>;
}

export interface NativeSyncTriggerDependencies {
  readonly onTrigger: (source: NativeSyncTriggerSource) => Promise<void> | void;
  readonly appPlugin?: AppPluginLike;
  readonly networkPlugin?: NetworkPluginLike;
  readonly targetWindow?: Window;
  readonly targetDocument?: Document;
}

/**
 * NativeSyncTriggerAdapter listens to Capacitor native connectivity and lifecycle signals
 * and routes them to the single logical synchronization invocation boundary.
 *
 * Invariants:
 * 1. Native reconnection and app resume are attempt triggers only.
 * 2. They never directly mutate submission status to SYNCED.
 * 3. In-flight flag prevents overlapping trigger storms.
 * 4. Cross-context correctness relies on durable claiming in IndexedDB.
 */
export class NativeSyncTriggerAdapter {
  private readonly onTrigger: (source: NativeSyncTriggerSource) => Promise<void> | void;
  private readonly appPlugin: AppPluginLike;
  private readonly networkPlugin: NetworkPluginLike;
  private readonly targetWindow: Window | undefined;
  private readonly targetDocument: Document | undefined;

  private isDestroyed = false;
  private isInFlight = false;
  private appListenerHandle: PluginListenerHandleLike | null = null;
  private networkListenerHandle: PluginListenerHandleLike | null = null;

  private readonly handleOnline: () => void;
  private readonly handleVisibility: () => void;

  constructor(deps: NativeSyncTriggerDependencies) {
    this.onTrigger = deps.onTrigger;
    this.appPlugin = deps.appPlugin ?? App;
    this.networkPlugin = deps.networkPlugin ?? Network;
    this.targetWindow = deps.targetWindow ?? (typeof window !== 'undefined' ? window : undefined);
    this.targetDocument =
      deps.targetDocument ?? (typeof document !== 'undefined' ? document : undefined);

    this.handleOnline = () => {
      void this.dispatchTrigger('ONLINE_EVENT');
    };

    this.handleVisibility = () => {
      if (this.targetDocument?.visibilityState === 'visible') {
        void this.dispatchTrigger('VISIBILITY_CHANGE');
      }
    };

    this.attach();
  }

  private attach(): void {
    // 1. Native Network reconnection listener
    void this.networkPlugin
      .addListener('networkStatusChange', (status) => {
        if (status.connected) {
          void this.dispatchTrigger('NATIVE_NETWORK_RECONNECT');
        }
      })
      .then((handle) => {
        if (this.isDestroyed) {
          void handle.remove();
        } else {
          this.networkListenerHandle = handle;
        }
      })
      .catch((err) => {
        console.warn('Could not register native network listener:', err);
      });

    // 2. Native App Resume listener
    void this.appPlugin
      .addListener('appStateChange', (state) => {
        if (state.isActive) {
          void this.dispatchTrigger('APP_RESUME');
        }
      })
      .then((handle) => {
        if (this.isDestroyed) {
          void handle.remove();
        } else {
          this.appListenerHandle = handle;
        }
      })
      .catch((err) => {
        console.warn('Could not register native appStateChange listener:', err);
      });

    // 3. Fallback window/document listeners in WebView
    if (this.targetWindow) {
      this.targetWindow.addEventListener('online', this.handleOnline);
    }
    if (this.targetDocument) {
      this.targetDocument.addEventListener('visibilitychange', this.handleVisibility);
    }
  }

  public async dispatchTrigger(source: NativeSyncTriggerSource): Promise<void> {
    if (this.isDestroyed) {
      return;
    }
    if (this.isInFlight) {
      return;
    }

    this.isInFlight = true;
    try {
      await this.onTrigger(source);
    } finally {
      this.isInFlight = false;
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.networkListenerHandle) {
      void this.networkListenerHandle.remove();
      this.networkListenerHandle = null;
    }
    if (this.appListenerHandle) {
      void this.appListenerHandle.remove();
      this.appListenerHandle = null;
    }
    if (this.targetWindow) {
      this.targetWindow.removeEventListener('online', this.handleOnline);
    }
    if (this.targetDocument) {
      this.targetDocument.removeEventListener('visibilitychange', this.handleVisibility);
    }
  }
}
