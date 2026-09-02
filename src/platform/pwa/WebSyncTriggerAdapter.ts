import { requestBackgroundSync, VKU_SYNC_TAG } from './backgroundSync.ts';

export type SyncTriggerSource = 'ONLINE_EVENT' | 'VISIBILITY_CHANGE' | 'BACKGROUND_SYNC' | 'MANUAL';

export interface WebSyncTriggerDependencies {
  readonly onTrigger: (source: SyncTriggerSource) => Promise<void> | void;
  readonly targetWindow?: Window;
  readonly targetDocument?: Document;
  readonly serviceWorkerContainer?: ServiceWorkerContainer;
}

/**
 * WebSyncTriggerAdapter listens to browser-level connectivity signals and routes them
 * to the shared synchronization invocation boundary.
 *
 * Invariants enforced:
 * 1. window.ononline is purely an attempt trigger — never marks items SYNCED.
 * 2. document.visibilitychange is a restrained fallback for browser resume.
 * 3. In-flight triggers do not pile up duplicate runs.
 * 4. Cross-context correctness relies on durable storage claiming, not in-memory singletons.
 * 5. Feature detection ensures graceful degradation when Background Sync is unavailable.
 */
export class WebSyncTriggerAdapter {
  private readonly onTrigger: (source: SyncTriggerSource) => Promise<void> | void;
  private readonly targetWindow: Window | undefined;
  private readonly targetDocument: Document | undefined;
  private readonly serviceWorkerContainer: ServiceWorkerContainer | undefined;
  private isDestroyed = false;
  private isInFlight = false;

  private readonly handleOnline: () => void;
  private readonly handleVisibility: () => void;
  private readonly handleMessage: (event: MessageEvent) => void;

  constructor(deps: WebSyncTriggerDependencies) {
    this.onTrigger = deps.onTrigger;
    this.targetWindow = deps.targetWindow ?? (typeof window !== 'undefined' ? window : undefined);
    this.targetDocument =
      deps.targetDocument ?? (typeof document !== 'undefined' ? document : undefined);
    this.serviceWorkerContainer =
      deps.serviceWorkerContainer ??
      (typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        ? navigator.serviceWorker
        : undefined);

    this.handleOnline = () => {
      void this.dispatchTrigger('ONLINE_EVENT');
    };

    this.handleVisibility = () => {
      if (this.targetDocument?.visibilityState === 'visible') {
        void this.dispatchTrigger('VISIBILITY_CHANGE');
      }
    };

    this.handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'VKU_SYNC_TRIGGER') {
        void this.dispatchTrigger('BACKGROUND_SYNC');
      }
    };

    this.attach();
  }

  private attach(): void {
    if (this.targetWindow) {
      this.targetWindow.addEventListener('online', this.handleOnline);
    }
    if (this.targetDocument) {
      this.targetDocument.addEventListener('visibilitychange', this.handleVisibility);
    }
    if (this.serviceWorkerContainer) {
      this.serviceWorkerContainer.addEventListener('message', this.handleMessage);
    }
  }

  public async dispatchTrigger(source: SyncTriggerSource): Promise<void> {
    if (this.isDestroyed) {
      return;
    }
    // Restrained in-flight guard to avoid noisy storms of triggers
    // Durable claiming remains the ultimate cross-context correctness boundary
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

  public async requestBackgroundSync(): Promise<boolean> {
    return requestBackgroundSync(VKU_SYNC_TAG, this.targetWindow);
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.targetWindow) {
      this.targetWindow.removeEventListener('online', this.handleOnline);
    }
    if (this.targetDocument) {
      this.targetDocument.removeEventListener('visibilitychange', this.handleVisibility);
    }
    if (this.serviceWorkerContainer) {
      this.serviceWorkerContainer.removeEventListener('message', this.handleMessage);
    }
  }
}
