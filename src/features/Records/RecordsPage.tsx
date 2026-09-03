import { useEffect, useState } from 'react';
import type { SurveySubmission, SyncStatus } from '../../domain/models.ts';
import type { SurveyStoragePort } from '../../domain/ports.ts';
import { formatFullRoomIdentifier } from '../../domain/models.ts';
import { Link } from '../../app/router.tsx';
import { useRouter } from '../../app/routerContext.ts';

export interface RecordsPageProps {
  readonly storage: SurveyStoragePort;
}

type FilterTab = 'ALL' | 'PENDING' | 'SYNCED' | 'FAILED';

export function RecordsPage({ storage }: RecordsPageProps) {
  const { navigate } = useRouter();
  const [records, setRecords] = useState<readonly SurveySubmission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    void storage
      .getAllSubmissions()
      .then((items) => {
        if (mounted) {
          setRecords(items);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [storage]);

  // Tab Filtering
  const tabFiltered = records.filter((r) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'PENDING') {
      return r.syncStatus === 'PENDING_SYNC' || r.syncStatus === 'SYNCING';
    }
    if (activeTab === 'SYNCED') {
      return r.syncStatus === 'SYNCED';
    }
    if (activeTab === 'FAILED') {
      return r.syncStatus === 'SYNC_FAILED';
    }
    return true;
  });

  // Search Query Filtering
  const query = searchQuery.trim().toLowerCase();
  const filteredRecords = tabFiltered.filter((r) => {
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
  });

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

  const pendingCount = records.filter(
    (r) => r.syncStatus === 'PENDING_SYNC' || r.syncStatus === 'SYNCING'
  ).length;
  const syncedCount = records.filter((r) => r.syncStatus === 'SYNCED').length;
  const failedCount = records.filter((r) => r.syncStatus === 'SYNC_FAILED').length;

  return (
    <div className="page-container records-page">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Survey Records</h2>
          <p className="page-subtitle">
            Review durable local inspections stored in this device.
          </p>
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

      {/* Filter Tabs */}
      <div className="filter-tabs-container" role="tablist" aria-label="Filter records by status">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ALL'}
          className={`filter-tab ${activeTab === 'ALL' ? 'active' : ''}`}
          onClick={() => setActiveTab('ALL')}
        >
          All ({records.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'PENDING'}
          className={`filter-tab ${activeTab === 'PENDING' ? 'active' : ''}`}
          onClick={() => setActiveTab('PENDING')}
        >
          Pending ({pendingCount})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'SYNCED'}
          className={`filter-tab ${activeTab === 'SYNCED' ? 'active' : ''}`}
          onClick={() => setActiveTab('SYNCED')}
        >
          Synced ({syncedCount})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'FAILED'}
          className={`filter-tab ${activeTab === 'FAILED' ? 'active' : ''}`}
          onClick={() => setActiveTab('FAILED')}
        >
          Failed ({failedCount})
        </button>
      </div>

      {/* Search Bar */}
      <div className="search-bar-wrapper">
        <input
          type="search"
          placeholder="Search by room (e.g. K.A-205), category, note..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
          aria-label="Search survey records"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="search-clear-btn"
            aria-label="Clear search"
          >
            &times;
          </button>
        )}
      </div>

      {/* Records List */}
      {loading ? (
        <div className="loading-card">Loading survey records from device storage...</div>
      ) : filteredRecords.length === 0 ? (
        <div className="empty-state-card">
          <span className="empty-icon" aria-hidden="true">
            📋
          </span>
          <p className="empty-title">
            {records.length === 0
              ? 'No survey records on this device yet'
              : 'No records match your filter criteria'}
          </p>
          <p className="empty-desc">
            {records.length === 0
              ? 'Inspections you complete will remain stored safely here even when completely offline.'
              : 'Try selecting a different status tab or adjusting your search keyword.'}
          </p>
          {records.length === 0 && (
            <button
              type="button"
              onClick={() => navigate('/survey')}
              className="btn-outline-small"
            >
              Start First Survey
            </button>
          )}
        </div>
      ) : (
        <div className="records-list" role="feed" aria-label="Survey records list">
          {filteredRecords.map((record) => {
            const data = record.surveyData;
            const roomId =
              formatFullRoomIdentifier(data) ?? `${data.zone}.${data.building}-${data.roomNumber}`;
            const stars = '★'.repeat(data.conditionRating) + '☆'.repeat(5 - data.conditionRating);

            return (
              <Link
                key={record.id}
                href={`/records/${record.id}`}
                className="record-item-card"
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

                  {data.defectNotes && (
                    <p className="record-defect-preview">{data.defectNotes}</p>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
