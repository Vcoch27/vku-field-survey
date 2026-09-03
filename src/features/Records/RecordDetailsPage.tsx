import { useCallback, useEffect, useState } from 'react';
import type { SurveySubmission } from '../../domain/models.ts';
import type { SurveyStoragePort } from '../../domain/ports.ts';
import { formatFullRoomIdentifier } from '../../domain/models.ts';
import type { SyncOrchestrator } from '../../domain/syncOrchestrator.ts';
import { deleteLocalSubmission, retrySubmission } from '../../domain/submissionActions.ts';
import { globalSyncEventHub } from '../../domain/syncEvents.ts';
import { Link } from '../../app/router.tsx';
import { useRouter } from '../../app/routerContext.ts';

export interface RecordDetailsPageProps {
  readonly recordId: string;
  readonly storage: SurveyStoragePort;
  readonly orchestrator?: SyncOrchestrator;
}

export function RecordDetailsPage({ recordId, storage, orchestrator }: RecordDetailsPageProps) {
  const { navigate } = useRouter();
  const [record, setRecord] = useState<SurveySubmission | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadRecord = useCallback(() => {
    void storage
      .getSubmissionById(recordId)
      .then((item) => {
        setRecord(item);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [recordId, storage]);

  useEffect(() => {
    loadRecord();
    const unsub = globalSyncEventHub.subscribeStorage(() => {
      loadRecord();
    });
    return unsub;
  }, [loadRecord]);

  const handleRetry = async () => {
    if (!orchestrator || !record) return;
    setIsRetrying(true);
    setActionError(null);
    try {
      const res = await retrySubmission(record.id, storage, orchestrator);
      if (!res.success && res.error) {
        setActionError(res.error);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unknown retry failure');
    } finally {
      setIsRetrying(false);
      loadRecord();
    }
  };

  const handleDelete = async () => {
    if (!record) return;
    const roomId =
      formatFullRoomIdentifier(record.surveyData) ??
      `${record.surveyData.zone}.${record.surveyData.building}-${record.surveyData.roomNumber}`;

    const isSynced = record.syncStatus === 'SYNCED';
    const confirmMsg = isSynced
      ? `Delete local copy of ${roomId}?\n\nThis removes the local copy only. The synchronized Google Sheet row will remain in remote history.`
      : `Are you sure you want to permanently delete this inspection for ${roomId}? This cannot be undone.`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      await deleteLocalSubmission(record.id, storage);
      navigate('/records');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete record');
    }
  };

  // Object URL lifecycle management for photo Blob
  useEffect(() => {
    let active = true;
    if (record?.surveyData.photo?.binaryData) {
      const url = URL.createObjectURL(record.surveyData.photo.binaryData);
      queueMicrotask(() => {
        if (active) {
          setPhotoUrl(url);
        }
      });

      return () => {
        active = false;
        URL.revokeObjectURL(url);
      };
    } else {
      queueMicrotask(() => {
        if (active) {
          setPhotoUrl(null);
        }
      });
      return () => {
        active = false;
      };
    }
  }, [record]);

  if (loading) {
    return (
      <div className="page-container record-details-page">
        <div className="loading-card">Loading inspection details...</div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="page-container record-details-page">
        <div className="empty-state-card">
          <span className="empty-icon" aria-hidden="true">
            🔍
          </span>
          <p className="empty-title">Record not found</p>
          <p className="empty-desc">
            No inspection record with ID &ldquo;{recordId}&rdquo; was found in this device&apos;s
            local storage.
          </p>
          <Link href="/records" className="btn-primary-action">
            &larr; Back to Records
          </Link>
        </div>
      </div>
    );
  }

  const data = record.surveyData;
  const roomId =
    formatFullRoomIdentifier(data) ?? `${data.zone}.${data.building}-${data.roomNumber}`;
  const stars = '★'.repeat(data.conditionRating) + '☆'.repeat(5 - data.conditionRating);

  const getStatusBadge = () => {
    switch (record.syncStatus) {
      case 'SYNCED':
        return <span className="status-pill synced">Synced to Google Sheet</span>;
      case 'PENDING_SYNC':
        return <span className="status-pill pending_sync">Saved offline — Pending sync</span>;
      case 'SYNCING':
        return <span className="status-pill syncing">Syncing now...</span>;
      case 'SYNC_FAILED':
        return <span className="status-pill sync_failed">Sync Failed</span>;
    }
  };

  return (
    <div className="page-container record-details-page">
      {/* Navigation header */}
      <div className="details-nav-row">
        <button
          type="button"
          onClick={() => navigate('/records')}
          className="btn-back"
          aria-label="Back to records"
        >
          &larr; Records
        </button>
        {getStatusBadge()}
      </div>

      {actionError && (
        <div className="alert-box alert-error" role="alert">
          <span>{actionError}</span>
          <button type="button" className="alert-close" onClick={() => setActionError(null)}>
            ×
          </button>
        </div>
      )}

      <div className="details-card">
        {/* Room Header */}
        <div className="details-header">
          <span className="room-badge-large">{roomId}</span>
          <span className="details-category">{data.category}</span>
        </div>

        {/* Location Section */}
        <div className="details-section">
          <h3 className="section-heading">Location</h3>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Campus Zone</span>
              <span className="detail-value">
                {data.zone === 'K' ? 'K — Khu Hàn' : 'V — Khu Việt'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Building</span>
              <span className="detail-value">{data.building}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Room Number</span>
              <span className="detail-value">{data.roomNumber}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Canonical Room ID</span>
              <span className="detail-value">{roomId}</span>
            </div>
          </div>
        </div>

        {/* Assessment Section */}
        <div className="details-section">
          <h3 className="section-heading">Equipment Assessment</h3>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Equipment Category</span>
              <span className="detail-value">{data.category}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Condition Rating</span>
              <span className="detail-value stars-value">
                {stars} ({data.conditionRating} / 5)
              </span>
            </div>
          </div>

          <div className="detail-item full-width">
            <span className="detail-label">Defect Notes &amp; Observations</span>
            <div className="defect-notes-box">
              {data.defectNotes ? (
                data.defectNotes
              ) : (
                <em className="muted">No defect notes entered.</em>
              )}
            </div>
          </div>
        </div>

        {/* Photo Attachment Section */}
        <div className="details-section">
          <h3 className="section-heading">Photo Evidence</h3>
          {photoUrl ? (
            <div className="photo-preview-container">
              <img
                src={photoUrl}
                alt={`Photo evidence for inspection ${roomId}`}
                className="inspection-photo"
              />
              <div className="photo-caption">
                Captured:{' '}
                {data.photo?.capturedAt ? new Date(data.photo.capturedAt).toLocaleString() : 'N/A'}
              </div>
            </div>
          ) : (
            <div className="no-photo-box">
              <span className="no-photo-icon" aria-hidden="true">
                📷
              </span>
              <span>No photo attached to this survey.</span>
            </div>
          )}
        </div>

        {/* Sync & Persistence Metadata */}
        <div className="details-section metadata-section">
          <h3 className="section-heading">Record Metadata</h3>
          <div className="metadata-list">
            <div className="meta-row">
              <span className="meta-k">Submission ID:</span>
              <span className="meta-v code-text">{record.id}</span>
            </div>
            <div className="meta-row">
              <span className="meta-k">Recorded At:</span>
              <span className="meta-v">{new Date(record.timestamp).toLocaleString()}</span>
            </div>
            <div className="meta-row">
              <span className="meta-k">Sync Status:</span>
              <span className="meta-v">{record.syncStatus}</span>
            </div>
            {record.lastErrorMessage && (
              <div className="meta-row error-meta">
                <span className="meta-k">Last Sync Note:</span>
                <span className="meta-v">{record.lastErrorMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Operational Actions */}
        <div className="details-actions-bar">
          {record.syncStatus === 'SYNC_FAILED' && (
            <button
              type="button"
              className="btn-details-retry"
              disabled={isRetrying || record.failureDisposition === 'REQUIRES_ATTENTION'}
              onClick={handleRetry}
            >
              {isRetrying
                ? 'Retrying Sync...'
                : record.failureDisposition === 'REQUIRES_ATTENTION'
                ? 'Review Required'
                : '🔄 Retry Sync Now'}
            </button>
          )}

          <button type="button" className="btn-details-delete" onClick={handleDelete}>
            🗑️ Delete Local Record
          </button>
        </div>
      </div>
    </div>
  );
}
