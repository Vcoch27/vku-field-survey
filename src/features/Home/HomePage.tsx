import { useCallback, useEffect, useState } from 'react';
import type { SurveySubmission } from '../../domain/models.ts';
import type { SurveyStoragePort } from '../../domain/ports.ts';
import { formatFullRoomIdentifier } from '../../domain/models.ts';
import { aggregateSubmissions, ZERO_STATUS_COUNTS } from '../../domain/submissionAggregation.ts';
import { globalSyncEventHub } from '../../domain/syncEvents.ts';
import { Link } from '../../app/router.tsx';
import { useRouter } from '../../app/routerContext.ts';

export interface HomePageProps {
  readonly storage: SurveyStoragePort;
  readonly isConnected: boolean;
}

export function HomePage({ storage, isConnected }: HomePageProps) {
  const { navigate } = useRouter();
  const [submissions, setSubmissions] = useState<readonly SurveySubmission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadSubmissions = useCallback(() => {
    void storage
      .getAllSubmissions()
      .then((items) => {
        setSubmissions(items);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [storage]);

  useEffect(() => {
    loadSubmissions();
    const unsub = globalSyncEventHub.subscribeStorage(() => {
      loadSubmissions();
    });
    return unsub;
  }, [loadSubmissions]);

  const counts = submissions.length > 0 ? aggregateSubmissions(submissions) : ZERO_STATUS_COUNTS;
  const totalCount = counts.total;
  const pendingCount = counts.pending;
  const syncedCount = counts.synced;
  const failedCount = counts.failed;

  const recentRecords = submissions.slice(0, 5);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="page-container home-page">
      {/* Surveyor Workspace Header */}
      <section className="home-hero">
        <div className="home-greeting-badge">
          <span className="greeting-icon">📋</span>
          <span>{getGreeting()}</span>
        </div>
        <h2 className="home-title">Field Inspection Workspace</h2>
        <p className="home-subtitle">
          Carry out room condition surveys and equipment checks across VKU campus.
        </p>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={() => navigate('/survey')}
          className="btn-start-survey"
          aria-label="Start New Survey"
        >
          <span className="btn-icon" aria-hidden="true">
            +
          </span>
          <span className="btn-text">Start New Survey</span>
        </button>
      </section>

      {/* Operational Metrics Cards (Real IndexedDB Data) */}
      <section className="home-metrics-section" aria-label="Local Survey Metrics">
        <h3 className="section-title">Local Queue Summary</h3>
        <div className="metrics-grid">
          <div className="metric-card">
            <span className="metric-label">Total</span>
            <span className="metric-value">{loading ? '—' : totalCount}</span>
            <span className="metric-desc">recorded</span>
          </div>

          <div className={`metric-card ${pendingCount > 0 ? 'highlight-pending' : ''}`}>
            <span className="metric-label">Pending</span>
            <span className="metric-value">{loading ? '—' : pendingCount}</span>
            <span className="metric-desc">needs sync</span>
          </div>

          <div className="metric-card highlight-synced">
            <span className="metric-label">Synced</span>
            <span className="metric-value">{loading ? '—' : syncedCount}</span>
            <span className="metric-desc">in sheet</span>
          </div>

          {failedCount > 0 && (
            <div className="metric-card highlight-failed">
              <span className="metric-label">Failed</span>
              <span className="metric-value">{loading ? '—' : failedCount}</span>
              <span className="metric-desc">retryable</span>
            </div>
          )}
        </div>
      </section>

      {/* Available Survey Forms */}
      <section className="home-forms-section">
        <div className="section-header-row">
          <h3 className="section-title">Available Forms</h3>
          <Link href="/forms" className="section-link">
            All forms &rarr;
          </Link>
        </div>

        <div className="form-card">
          <div className="form-card-badge">Active Form</div>
          <h4 className="form-card-title">Campus Equipment &amp; Facility Inspection</h4>
          <p className="form-card-desc">
            Classroom, lab &amp; office audit for Hardware, Projector, AC, Electrical &amp;
            Furniture across Khu Hàn (K) &amp; Khu Việt (V).
          </p>
          <div className="form-card-tags">
            <span className="tag">Hardware</span>
            <span className="tag">Projector</span>
            <span className="tag">AC</span>
            <span className="tag">Zone K &amp; V</span>
          </div>
          <Link href="/survey" className="btn-form-action">
            Open Form &rarr;
          </Link>
        </div>
      </section>

      {/* Recent Activity */}
      <section className="home-recent-section" aria-label="Recent Inspections">
        <div className="section-header-row">
          <h3 className="section-title">Recent Inspections</h3>
          {submissions.length > 0 && (
            <Link href="/records" className="section-link">
              View all ({submissions.length}) &rarr;
            </Link>
          )}
        </div>

        {loading ? (
          <div className="loading-card">Loading recent inspections...</div>
        ) : recentRecords.length === 0 ? (
          <div className="empty-state-card">
            <span className="empty-icon" aria-hidden="true">
              📭
            </span>
            <p className="empty-title">No inspections recorded yet</p>
            <p className="empty-desc">
              Your completed and pending inspection records will appear here automatically.
            </p>
            <button type="button" onClick={() => navigate('/survey')} className="btn-outline-small">
              Start First Survey
            </button>
          </div>
        ) : (
          <div className="recent-list">
            {recentRecords.map((record) => {
              const roomId =
                formatFullRoomIdentifier(record.surveyData) ??
                `${record.surveyData.zone}.${record.surveyData.building}-${record.surveyData.roomNumber}`;
              const stars =
                '★'.repeat(record.surveyData.conditionRating) +
                '☆'.repeat(5 - record.surveyData.conditionRating);

              return (
                <Link
                  key={record.id}
                  href={`/records/${record.id}`}
                  className="recent-item-card"
                  aria-label={`Inspection for room ${roomId}, category ${record.surveyData.category}`}
                >
                  <div className="recent-item-main">
                    <div className="recent-room-badge">{roomId}</div>
                    <div className="recent-details">
                      <span className="recent-category">{record.surveyData.category}</span>
                      <span
                        className="recent-stars"
                        title={`Rating: ${record.surveyData.conditionRating} of 5`}
                      >
                        {stars}
                      </span>
                    </div>
                  </div>

                  <div className="recent-item-status">
                    <span className={`status-pill ${record.syncStatus.toLowerCase()}`}>
                      {record.syncStatus === 'SYNCED'
                        ? 'Synced'
                        : record.syncStatus === 'PENDING_SYNC'
                          ? 'Pending'
                          : record.syncStatus === 'SYNCING'
                            ? 'Syncing...'
                            : 'Failed'}
                    </span>
                    <span className="item-arrow" aria-hidden="true">
                      &rsaquo;
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Network / Offline Banner Footer */}
      <section className="home-offline-context">
        <div className={`status-strip ${isConnected ? 'online' : 'offline'}`}>
          <span className="status-dot" aria-hidden="true" />
          <span>
            {isConnected
              ? 'Connected to campus network. Survey submissions sync automatically.'
              : 'Working in Offline Mode. All surveys are preserved durably in local device storage.'}
          </span>
        </div>
      </section>
    </div>
  );
}
