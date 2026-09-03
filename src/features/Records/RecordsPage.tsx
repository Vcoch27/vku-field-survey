import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SURVEY_CATEGORIES,
  type SurveySubmission,
  type SyncStatus,
  formatFullRoomIdentifier,
} from '../../domain/models.ts';
import type { SurveyStoragePort } from '../../domain/ports.ts';
import type { SyncOrchestrator } from '../../domain/syncOrchestrator.ts';
import { aggregateSubmissions, ZERO_STATUS_COUNTS } from '../../domain/submissionAggregation.ts';
import { deleteLocalSubmission, retrySubmission } from '../../domain/submissionActions.ts';
import { globalSyncEventHub } from '../../domain/syncEvents.ts';
import { Link } from '../../app/router.tsx';
import { useRouter } from '../../app/routerContext.ts';

export interface RecordsPageProps {
  readonly storage: SurveyStoragePort;
  readonly orchestrator?: SyncOrchestrator;
}

type FilterTab = 'ALL' | 'PENDING' | 'SYNCED' | 'FAILED';
type SortOrder = 'newest' | 'oldest';

export function RecordsPage({ storage, orchestrator }: RecordsPageProps) {
  const { navigate } = useRouter();
  const [records, setRecords] = useState<readonly SurveySubmission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadRecords = useCallback(() => {
    void storage
      .getAllSubmissions()
      .then((items) => {
        setRecords(items);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [storage]);

  useEffect(() => {
    loadRecords();
    const unsub = globalSyncEventHub.subscribeStorage(() => {
      loadRecords();
    });
    return unsub;
  }, [loadRecords]);

  // Centralized aggregation for tab counters
  const counts = records.length > 0 ? aggregateSubmissions(records) : ZERO_STATUS_COUNTS;

  // Filter and Sort Pipeline
  const displayedRecords = useMemo(() => {
    return records
      .filter((r) => {
        // Tab status filter
        if (activeTab === 'PENDING') return r.syncStatus === 'PENDING_SYNC';
        if (activeTab === 'SYNCED') return r.syncStatus === 'SYNCED';
        if (activeTab === 'FAILED') return r.syncStatus === 'SYNC_FAILED';
        return true;
      })
      .filter((r) => {
        // Category filter
        if (selectedCategory === 'ALL') return true;
        return r.surveyData.category === selectedCategory;
      })
      .filter((r) => {
        // Keyword search filter
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        const roomId = (formatFullRoomIdentifier(r.surveyData) ?? '').toLowerCase();
        const building = r.surveyData.building.toLowerCase();
        const roomNumber = r.surveyData.roomNumber.toLowerCase();
        const category = r.surveyData.category.toLowerCase();
        const notes = r.surveyData.defectNotes.toLowerCase();

        return (
          roomId.includes(query) ||
          building.includes(query) ||
          roomNumber.includes(query) ||
          category.includes(query) ||
          notes.includes(query)
        );
      })
      .sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
      });
  }, [records, activeTab, selectedCategory, searchQuery, sortOrder]);

  const handleRetry = async (record: SurveySubmission, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!orchestrator) {
      setActionError('Sync orchestrator is unavailable in current runtime.');
      return;
    }

    setActionError(null);
    setRetryingId(record.id);

    try {
      const result = await retrySubmission(record.id, storage, orchestrator);
      if (!result.success && result.error) {
        setActionError(result.error);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unknown retry failure');
    } finally {
      setRetryingId(null);
      loadRecords();
    }
  };

  const handleDelete = async (record: SurveySubmission, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const roomId =
      formatFullRoomIdentifier(record.surveyData) ??
      `${record.surveyData.zone}.${record.surveyData.building}-${record.surveyData.roomNumber}`;

    const isSynced = record.syncStatus === 'SYNCED';
    const confirmMsg = isSynced
      ? `Delete local copy of ${roomId}?\n\nThis removes the local copy only. The synchronized Google Sheet row will remain in remote history.`
      : `Are you sure you want to permanently delete inspection for ${roomId}? This cannot be undone.`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      await deleteLocalSubmission(record.id, storage);
      loadRecords();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete record');
    }
  };

  const getStatusLabel = (status: SyncStatus) => {
    switch (status) {
      case 'SYNCED':
        return 'Synced';
      case 'PENDING_SYNC':
        return 'Pending sync';
      case 'SYNCING':
        return 'Syncing...';
      case 'SYNC_FAILED':
        return 'Sync failed';
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="page-container records-page">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Survey Records</h2>
          <p className="page-subtitle">Review durable local inspections stored in this device.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/survey')}
          className="btn-new-record"
          aria-label="New Survey"
        >
          + New
        </button>
      </div>

      {actionError && (
        <div className="alert-box alert-error" role="alert">
          <span>{actionError}</span>
          <button type="button" className="alert-close" onClick={() => setActionError(null)}>
            ×
          </button>
        </div>
      )}

      {/* Filter Tabs using Strict Centralized Aggregation */}
      <div className="filter-tabs" role="tablist" aria-label="Filter records by status">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ALL'}
          className={`filter-tab ${activeTab === 'ALL' ? 'active' : ''}`}
          onClick={() => setActiveTab('ALL')}
        >
          All ({counts.total})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'PENDING'}
          className={`filter-tab ${activeTab === 'PENDING' ? 'active' : ''}`}
          onClick={() => setActiveTab('PENDING')}
        >
          Pending ({counts.pending})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'SYNCED'}
          className={`filter-tab ${activeTab === 'SYNCED' ? 'active' : ''}`}
          onClick={() => setActiveTab('SYNCED')}
        >
          Synced ({counts.synced})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'FAILED'}
          className={`filter-tab ${activeTab === 'FAILED' ? 'active' : ''}`}
          onClick={() => setActiveTab('FAILED')}
        >
          Failed ({counts.failed})
        </button>
      </div>

      {/* Filter & Sorting Controls */}
      <div className="records-controls-row">
        <div className="records-search-bar">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by room (e.g. K.A-205), notes..."
            className="search-input"
            aria-label="Search survey records"
          />
        </div>

        <div className="records-filter-group">
          <label htmlFor="category-select" className="sr-only">
            Filter by category
          </label>
          <select
            id="category-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="filter-select"
            aria-label="Filter by category"
          >
            <option value="ALL">All Categories</option>
            {SURVEY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <label htmlFor="sort-select" className="sr-only">
            Sort records by time
          </label>
          <select
            id="sort-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="filter-select"
            aria-label="Sort records by time"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      {/* Records List / Empty State */}
      {loading ? (
        <div className="records-loading">
          <p>Loading local records...</p>
        </div>
      ) : displayedRecords.length === 0 ? (
        <div className="records-empty-card">
          <span className="empty-icon" aria-hidden="true">
            📋
          </span>
          <h3 className="empty-title">
            {records.length === 0
              ? 'No survey records yet'
              : activeTab === 'FAILED'
              ? 'No failed syncs'
              : activeTab === 'PENDING'
              ? 'All local submissions are up to date'
              : selectedCategory !== 'ALL'
              ? `No ${selectedCategory} records found`
              : 'No matching records found'}
          </h3>
          <p className="empty-desc">
            {records.length === 0
              ? 'Inspections completed on this device will be stored securely offline and listed here.'
              : 'Try selecting a different filter tab or adjusting your search keyword.'}
          </p>
          {records.length === 0 && (
            <button type="button" onClick={() => navigate('/survey')} className="btn-outline-small">
              Start First Survey
            </button>
          )}
        </div>
      ) : (
        <div className="records-list" role="feed" aria-label="Survey records list">
          {displayedRecords.map((record) => {
            const data = record.surveyData;
            const roomId =
              formatFullRoomIdentifier(data) ?? `${data.zone}.${data.building}-${data.roomNumber}`;
            const stars = '★'.repeat(data.conditionRating) + '☆'.repeat(5 - data.conditionRating);
            const isFailed = record.syncStatus === 'SYNC_FAILED';
            const isRetrying = retryingId === record.id;
            const isAttention = record.failureDisposition === 'REQUIRES_ATTENTION';

            return (
              <div
                key={record.id}
                className={`record-item-card ${isFailed ? 'card-failed' : ''}`}
              >
                <Link
                  href={`/records/${record.id}`}
                  className="record-card-link"
                  aria-label={`Inspection for ${roomId} ${data.category}, ${getStatusLabel(record.syncStatus)}`}
                >
                  <div className="record-header">
                    <div className="record-room-pill">{roomId}</div>
                    <span className={`status-pill ${record.syncStatus.toLowerCase()}`}>
                      {getStatusLabel(record.syncStatus)}
                    </span>
                  </div>

                  <div className="record-body">
                    <div className="record-category-line">
                      <span className="record-category">{data.category}</span>
                      <span className="record-stars" title={`Rating: ${data.conditionRating}/5`}>
                        {stars}
                      </span>
                    </div>

                    {data.defectNotes && <p className="record-defect-preview">{data.defectNotes}</p>}

                    {isFailed && record.lastErrorMessage && (
                      <div className="record-error-snippet" title={record.lastErrorMessage}>
                        ⚠️ {record.lastErrorMessage}
                      </div>
                    )}
                  </div>

                  <div className="record-footer">
                    <span className="record-time">{formatDate(record.timestamp)}</span>
                    <div className="record-meta-right">
                      {data.photo && (
                        <span className="has-photo-badge" title="Photo attached">
                          📷 Photo
                        </span>
                      )}
                      <span className="view-link">Details &rsaquo;</span>
                    </div>
                  </div>
                </Link>

                {/* Action Row for Failed or Synced Records */}
                <div className="record-action-bar">
                  {isFailed && (
                    <button
                      type="button"
                      className="btn-action-retry"
                      disabled={isRetrying || isAttention}
                      onClick={(e) => handleRetry(record, e)}
                      title={
                        isAttention
                          ? 'This failure requires surveyor review and cannot be retried automatically'
                          : 'Retry synchronization now'
                      }
                      aria-label={`Retry synchronization for ${roomId}`}
                    >
                      {isRetrying ? 'Retrying...' : isAttention ? 'Needs Review' : '🔄 Retry Sync'}
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn-action-delete"
                    onClick={(e) => handleDelete(record, e)}
                    aria-label={`Delete record for ${roomId}`}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
