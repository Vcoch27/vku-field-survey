import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import {
  SURVEY_CATEGORIES,
  type CampusZone,
  type SurveyCategory,
  type SurveySubmission,
  type SyncStatus,
  formatFullRoomIdentifier,
} from '../../domain/models.ts';
import type { SurveyStoragePort } from '../../domain/ports.ts';
import type { SyncOrchestrator } from '../../domain/syncOrchestrator.ts';
import {
  createSubmissionViewModel,
  DEFAULT_RECORD_FILTERS,
  filterSubmissionRecords,
  groupRecordsByRecency,
  type RecordFilters,
  type RecordSortOrder,
  type RecordStatusFilter,
} from '../../domain/submissionViewModel.ts';
import { deleteLocalSubmission, retrySubmission } from '../../domain/submissionActions.ts';
import { globalSyncEventHub } from '../../domain/syncEvents.ts';
import { Link } from '../../app/router.tsx';
import { useRouter } from '../../app/routerContext.ts';

export interface RecordsPageProps {
  readonly storage: SurveyStoragePort;
  readonly orchestrator?: SyncOrchestrator;
  readonly initialQuery?: string;
}

const STATUS_OPTIONS: readonly { value: RecordStatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SYNCING', label: 'Syncing' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'SYNCED', label: 'Synced' },
];

function parseFilters(query = ''): RecordFilters {
  const params = new URLSearchParams(query);
  const status = params.get('status');
  const category = params.get('category');
  const zone = params.get('zone');
  return {
    status: STATUS_OPTIONS.some((item) => item.value === status)
      ? status as RecordStatusFilter
      : 'ALL',
    category: SURVEY_CATEGORIES.includes(category as SurveyCategory)
      ? category as SurveyCategory
      : 'ALL',
    zone: zone === 'K' || zone === 'V' ? zone : 'ALL',
    poorConditionOnly: params.get('condition') === 'poor',
    sort: params.get('sort') === 'oldest' ? 'oldest' : 'newest',
  };
}

function statusLabel(status: SyncStatus): string {
  if (status === 'PENDING_SYNC') return 'Pending';
  if (status === 'SYNCING') return 'Syncing';
  if (status === 'SYNC_FAILED') return 'Sync failed';
  return 'Synced';
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function RecordsPage({ storage, orchestrator, initialQuery }: RecordsPageProps) {
  const { navigate } = useRouter();
  const [records, setRecords] = useState<readonly SurveySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<RecordFilters>(() => parseFilters(initialQuery));
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadRecords = useCallback(() => {
    void storage.getAllSubmissions().then(setRecords).finally(() => setLoading(false));
  }, [storage]);

  useEffect(() => {
    loadRecords();
    return globalSyncEventHub.subscribeStorage(loadRecords);
  }, [loadRecords]);

  const view = useMemo(() => createSubmissionViewModel(records), [records]);
  const displayedRecords = useMemo(() => filterSubmissionRecords(records, filters), [records, filters]);
  const groups = useMemo(() => groupRecordsByRecency(displayedRecords), [displayedRecords]);
  const activeFilterLabels = [
    filters.zone !== 'ALL' ? `Zone ${filters.zone}` : null,
    filters.category !== 'ALL' ? filters.category : null,
    filters.status !== 'ALL' ? STATUS_OPTIONS.find((item) => item.value === filters.status)?.label : null,
    filters.poorConditionOnly ? 'Poor condition' : null,
  ].filter((label): label is string => Boolean(label));

  const setFilter = <K extends keyof RecordFilters>(key: K, value: RecordFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const handleRetry = async (record: SurveySubmission, event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (!orchestrator) {
      setActionError('Synchronization is unavailable in the current runtime.');
      return;
    }
    setActionError(null);
    setRetryingId(record.id);
    try {
      const result = await retrySubmission(record.id, storage, orchestrator);
      if (!result.success) setActionError(result.error ?? 'Unable to retry this inspection.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to retry this inspection.');
    } finally {
      setRetryingId(null);
      loadRecords();
    }
  };

  const handleDelete = async (record: SurveySubmission, event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const room = formatFullRoomIdentifier(record.surveyData) ?? 'this inspection';
    const message = record.syncStatus === 'SYNCED'
      ? `Delete the local copy of ${room}?\n\nThis removes the local record only. The synchronized Google Sheet entry will remain.`
      : `Delete the local record for ${room}? This unsynchronized inspection cannot be recovered.`;
    if (!window.confirm(message)) return;
    try {
      await deleteLocalSubmission(record.id, storage);
      loadRecords();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to delete this record.');
    }
  };

  return (
    <div className="page-container records-page">
      <header className="page-header-row">
        <div>
          <p className="eyebrow">Inspection history</p>
          <h1 className="page-title">Records</h1>
          <p className="page-subtitle">Review submitted inspections and resolve delivery issues.</p>
        </div>
        <button type="button" onClick={() => navigate('/survey')} className="btn-new-record">+ New</button>
      </header>

      {actionError && <div className="alert-box alert-error" role="alert"><span>{actionError}</span><button type="button" className="alert-close" aria-label="Dismiss error" onClick={() => setActionError(null)}>×</button></div>}

      <div className="status-filter-row" role="group" aria-label="Filter records by status">
        {STATUS_OPTIONS.map((option) => {
          const count = option.value === 'ALL' ? view.status.total
            : option.value === 'PENDING' ? view.status.pending
              : option.value === 'SYNCING' ? view.status.syncing
                : option.value === 'FAILED' ? view.status.failed : view.status.synced;
          return <button key={option.value} type="button" aria-pressed={filters.status === option.value} className={filters.status === option.value ? 'active' : ''} onClick={() => setFilter('status', option.value)}>{option.label}<span>{count}</span></button>;
        })}
      </div>

      <div className="record-filter-toolbar">
        <details className="filter-disclosure">
          <summary>Filters{activeFilterLabels.length > 0 ? ` (${activeFilterLabels.length})` : ''}</summary>
          <div className="filter-panel">
            <label>Campus zone<select aria-label="Filter by campus zone" value={filters.zone} onChange={(event) => setFilter('zone', event.target.value as CampusZone | 'ALL')}><option value="ALL">All Zones</option><option value="K">K — Khu Hàn</option><option value="V">V — Khu Việt</option></select></label>
            <label>Category<select aria-label="Filter by category" value={filters.category} onChange={(event) => setFilter('category', event.target.value as SurveyCategory | 'ALL')}><option value="ALL">All Categories</option>{SURVEY_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
            <label className="poor-filter"><input type="checkbox" checked={filters.poorConditionOnly} onChange={(event) => setFilter('poorConditionOnly', event.target.checked)} />Poor condition (1–2★)</label>
          </div>
        </details>
        <label className="sort-control"><span className="sr-only">Sort records by time</span><select aria-label="Sort records by time" value={filters.sort} onChange={(event) => setFilter('sort', event.target.value as RecordSortOrder)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
      </div>

      {activeFilterLabels.length > 0 && (
        <div className="active-filter-summary" role="status"><span>{activeFilterLabels.join(' · ')} <strong>{displayedRecords.length} {displayedRecords.length === 1 ? 'record' : 'records'}</strong></span><button type="button" onClick={() => setFilters(DEFAULT_RECORD_FILTERS)}>Clear filters</button></div>
      )}

      {loading ? <div className="loading-card">Loading local records…</div>
        : displayedRecords.length === 0 ? (
          <div className="empty-state-card compact-empty"><p className="empty-title">{records.length === 0 ? 'No survey records yet' : 'No records match these filters'}</p><p className="empty-desc">{records.length === 0 ? 'Completed inspections will appear here.' : 'Clear or change a filter to see more inspections.'}</p>{records.length === 0 && <button type="button" onClick={() => navigate('/survey')} className="btn-primary-action">Start First Survey</button>}</div>
        ) : (
          <div className="record-groups" role="feed" aria-label="Survey records list">
            {groups.map((group) => (
              <section key={group.label} className="record-date-group" aria-labelledby={`group-${group.label.toLowerCase()}`}>
                <h2 id={`group-${group.label.toLowerCase()}`}>{group.label}</h2>
                <div className="records-list">
                  {group.records.map((record) => {
                    const data = record.surveyData;
                    const room = formatFullRoomIdentifier(data) ?? 'Unknown room';
                    const retryBlocked = record.failureDisposition === 'REQUIRES_ATTENTION';
                    return (
                      <article key={record.id} className={`record-item-card ${record.syncStatus === 'SYNC_FAILED' ? 'card-failed' : ''}`}>
                        <Link href={`/records/${record.id}`} className="record-card-link" aria-label={`Open inspection ${room}, ${data.category}, ${statusLabel(record.syncStatus)}`}>
                          <div className="record-header"><strong className="record-room-pill">{room}</strong><span className={`status-pill ${record.syncStatus.toLowerCase()}`}>{statusLabel(record.syncStatus)}</span></div>
                          <div className="record-summary-line"><span>{data.category}</span><span className="record-stars" aria-label={`${data.conditionRating} out of 5 stars`}>{'★'.repeat(data.conditionRating)}{'☆'.repeat(5 - data.conditionRating)}</span></div>
                          {data.defectNotes && <p className="record-defect-preview">“{data.defectNotes}”</p>}
                          {record.syncStatus === 'SYNC_FAILED' && record.lastErrorMessage && <p className="record-error-snippet">{record.lastErrorMessage}</p>}
                          <div className="record-footer"><time dateTime={record.timestamp}>{formatTimestamp(record.timestamp)}</time>{data.photo && <span className="photo-indicator" title="Photo attached" aria-label="Photo attached">▣</span>}</div>
                        </Link>
                        <details className="record-menu"><summary aria-label={`More actions for ${room}`}>⋯</summary><div className="record-menu-popover">{record.syncStatus === 'SYNC_FAILED' && <button type="button" disabled={retryingId === record.id || retryBlocked} onClick={(event) => handleRetry(record, event)}>{retryingId === record.id ? 'Retrying…' : retryBlocked ? 'Review required' : 'Retry sync'}</button>}<button type="button" className="danger-action" onClick={(event) => handleDelete(record, event)}>{record.syncStatus === 'SYNCED' ? 'Delete local copy' : 'Delete local record'}</button></div></details>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
    </div>
  );
}
