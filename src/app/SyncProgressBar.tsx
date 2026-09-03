import { useEffect, useState } from 'react';
import { globalSyncEventHub, type SyncProgressState } from '../domain/syncEvents.ts';

export function SyncProgressBar() {
  const [syncState, setSyncState] = useState<SyncProgressState>(() =>
    globalSyncEventHub.getState()
  );
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = globalSyncEventHub.subscribeSync((newState) => {
      setSyncState(newState);
      if (newState.active) {
        setIsDismissed(false);
      }
    });
    return unsubscribe;
  }, []);

  // Auto-dismiss completed status after 4 seconds
  useEffect(() => {
    if (!syncState.active && (syncState.phase === 'completed' || syncState.phase === 'failed')) {
      const timer = setTimeout(() => {
        setIsDismissed(true);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [syncState.active, syncState.phase]);

  if (isDismissed || syncState.phase === 'idle') {
    return null;
  }

  const percent =
    syncState.total > 0
      ? Math.min(100, Math.round(((syncState.completed + syncState.failed) / syncState.total) * 100))
      : 0;

  const isComplete = !syncState.active && syncState.phase === 'completed';
  const isFailed = !syncState.active && syncState.phase === 'failed';

  return (
    <aside
      className={`sync-banner ${isComplete ? 'sync-banner-success' : ''} ${isFailed ? 'sync-banner-error' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Synchronization progress"
    >
      <div className="sync-banner-inner">
        <div className="sync-banner-content">
          <div className="sync-banner-header">
            <span className="sync-banner-indicator" aria-hidden="true">
              {syncState.active ? '🔄' : isComplete ? '✅' : '⚠️'}
            </span>
            <span className="sync-banner-title">
              {syncState.active
                ? `Syncing inspections (${syncState.completed + syncState.failed} of ${syncState.total})`
                : isComplete
                ? 'Sync Complete'
                : 'Sync Finished with Issues'}
            </span>
            <button
              type="button"
              className="sync-banner-dismiss"
              onClick={() => setIsDismissed(true)}
              aria-label="Hide sync progress"
            >
              Hide
            </button>
          </div>

          {syncState.active && (
            <div className="sync-progress-track" aria-hidden="true">
              <div
                className="sync-progress-fill"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}

          <p className="sync-banner-message">{syncState.message}</p>
        </div>
      </div>
    </aside>
  );
}
