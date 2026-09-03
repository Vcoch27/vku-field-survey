import type { Uuid } from './models.ts';
import type { SyncResult } from './syncOrchestrator.ts';

export interface SyncProgressState {
  readonly active: boolean;
  readonly phase: 'idle' | 'preparing' | 'syncing' | 'completed' | 'failed';
  readonly total: number;
  readonly completed: number;
  readonly failed: number;
  readonly currentRoomIdentifier?: string;
  readonly message?: string;
}

export type SyncStateListener = (state: SyncProgressState) => void;
export type StorageChangeListener = () => void;

export class SyncEventHub {
  private currentState: SyncProgressState = {
    active: false,
    phase: 'idle',
    total: 0,
    completed: 0,
    failed: 0,
  };

  private readonly syncListeners = new Set<SyncStateListener>();
  private readonly storageListeners = new Set<StorageChangeListener>();

  getState(): SyncProgressState {
    return this.currentState;
  }

  subscribeSync(listener: SyncStateListener): () => void {
    this.syncListeners.add(listener);
    listener(this.currentState);
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  subscribeStorage(listener: StorageChangeListener): () => void {
    this.storageListeners.add(listener);
    return () => {
      this.storageListeners.delete(listener);
    };
  }

  notifyStorageChanged(): void {
    for (const listener of this.storageListeners) {
      try {
        listener();
      } catch (err) {
        console.error('Error in storage listener:', err);
      }
    }
  }

  notifySyncStart(total: number): void {
    this.currentState = {
      active: true,
      phase: total > 0 ? 'syncing' : 'preparing',
      total,
      completed: 0,
      failed: 0,
      message: total > 0 ? `Preparing to sync ${total} inspection(s)...` : 'Checking queue...',
    };
    this.emitSync();
  }

  notifyItemProgress(current: {
    submissionId: Uuid;
    roomIdentifier: string;
    action: 'uploading' | 'synced' | 'failed';
    completed: number;
    failed: number;
    total: number;
    error?: string;
  }): void {
    const total = Math.max(current.total, current.completed + current.failed);
    const msg =
      current.action === 'uploading'
        ? `Syncing ${current.roomIdentifier} (${current.completed + current.failed + 1} of ${total})...`
        : current.action === 'synced'
        ? `${current.roomIdentifier} uploaded successfully`
        : `${current.roomIdentifier} failed: ${current.error || 'Network error'}`;

    this.currentState = {
      active: true,
      phase: 'syncing',
      total,
      completed: current.completed,
      failed: current.failed,
      currentRoomIdentifier: current.roomIdentifier,
      message: msg,
    };
    this.emitSync();
  }

  notifySyncComplete(result: SyncResult): void {
    const hasFailures = result.failedCount > 0;
    this.currentState = {
      active: false,
      phase: hasFailures ? 'failed' : 'completed',
      total: result.processedCount,
      completed: result.syncedCount,
      failed: result.failedCount,
      message:
        result.processedCount === 0
          ? 'All local submissions are up to date.'
          : hasFailures
          ? `Sync completed: ${result.syncedCount} uploaded, ${result.failedCount} failed.`
          : `Sync complete: all ${result.syncedCount} inspection(s) uploaded!`,
    };
    this.emitSync();
    this.notifyStorageChanged();
  }

  private emitSync(): void {
    for (const listener of this.syncListeners) {
      try {
        listener(this.currentState);
      } catch (err) {
        console.error('Error in sync listener:', err);
      }
    }
  }
}

export const globalSyncEventHub = new SyncEventHub();
