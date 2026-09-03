import { useEffect, useState } from 'react';
import type { SurveySubmission } from '../../domain/models.ts';
import type { SurveyStoragePort } from '../../domain/ports.ts';
import { formatFullRoomIdentifier } from '../../domain/models.ts';
import { Link } from '../../app/router.tsx';
import { useRouter } from '../../app/routerContext.ts';

export interface RecordDetailsPageProps {
  readonly recordId: string;
  readonly storage: SurveyStoragePort;
}

export function RecordDetailsPage({ recordId, storage }: RecordDetailsPageProps) {
  const { navigate } = useRouter();
  const [record, setRecord] = useState<SurveySubmission | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void storage
      .getSubmissionById(recordId)
      .then((item) => {
        if (mounted) {
          setRecord(item);
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
  }, [recordId, storage]);

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
            No inspection record with ID &ldquo;{recordId}&rdquo; was found in this device&apos;s local storage.
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
              {data.defectNotes ? data.defectNotes : <em className="muted">No defect notes entered.</em>}
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
                Captured: {data.photo?.capturedAt ? new Date(data.photo.capturedAt).toLocaleString() : 'N/A'}
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
      </div>
    </div>
  );
}
