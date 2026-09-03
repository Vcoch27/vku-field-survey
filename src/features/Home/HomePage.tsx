import { useCallback, useEffect, useMemo, useState } from 'react';
import type { InspectionDraft, SurveySubmission } from '../../domain/models.ts';
import { formatFullRoomIdentifier } from '../../domain/models.ts';
import type { SurveyStoragePort } from '../../domain/ports.ts';
import { buildRecordsHref, createSubmissionViewModel } from '../../domain/submissionViewModel.ts';
import { globalSyncEventHub } from '../../domain/syncEvents.ts';
import { Link } from '../../app/router.tsx';
import { useRouter } from '../../app/routerContext.ts';

export interface HomePageProps {
  readonly storage: SurveyStoragePort;
  readonly isConnected: boolean;
}

function hasDraftContent(draft: InspectionDraft | null): draft is InspectionDraft {
  return Boolean(
    draft &&
      (draft.zone || draft.building.trim() || draft.roomNumber.trim() || draft.category ||
        draft.conditionRating || draft.defectNotes.trim() || draft.photo)
  );
}

function relativeTime(timestamp: string): string {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - Date.parse(timestamp)) / 60_000));
  if (elapsedMinutes < 1) return 'just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function HomePage({ storage, isConnected }: HomePageProps) {
  const { navigate } = useRouter();
  const [submissions, setSubmissions] = useState<readonly SurveySubmission[]>([]);
  const [draft, setDraft] = useState<InspectionDraft | null>(null);
  const [loading, setLoading] = useState(true);

  const loadWorkspace = useCallback(() => {
    void Promise.all([storage.getAllSubmissions(), storage.getDraft()])
      .then(([items, activeDraft]) => {
        setSubmissions(items);
        setDraft(activeDraft);
      })
      .finally(() => setLoading(false));
  }, [storage]);

  useEffect(() => {
    loadWorkspace();
    return globalSyncEventHub.subscribeStorage(loadWorkspace);
  }, [loadWorkspace]);

  const view = useMemo(() => createSubmissionViewModel(submissions), [submissions]);
  const activeDraft = hasDraftContent(draft) ? draft : null;
  const recentRecords = view.records.slice(0, 4);

  const startNewSurvey = async () => {
    if (activeDraft && !window.confirm(
      'Start a new inspection? Your unfinished inspection will be removed from this device.'
    )) return;
    if (activeDraft) await storage.clearDraft(activeDraft.id);
    navigate('/survey');
  };

  return (
    <div className="page-container home-page">
      <section className="home-intro" aria-labelledby="home-title">
        <p className="eyebrow">Today&apos;s field work</p>
        <h1 className="home-title" id="home-title">What needs attention next?</h1>
        <p className="home-subtitle">Capture inspections, protect work offline, and confirm delivery.</p>
      </section>

      {activeDraft && (
        <section className="workflow-section" aria-labelledby="continue-title">
          <h2 className="section-title" id="continue-title">Continue work</h2>
          <Link href="/survey" className="continue-card">
            <div className="continue-card-main">
              <span className="continue-label">Unfinished inspection</span>
              <strong>{formatFullRoomIdentifier(activeDraft) ?? 'Location not completed'}</strong>
              <span>{activeDraft.category ?? 'Category not selected'} · Edited {relativeTime(activeDraft.lastModifiedAt)}</span>
            </div>
            <span className="continue-action">Resume</span>
          </Link>
        </section>
      )}

      <button type="button" onClick={startNewSurvey} className="btn-start-survey">
        <span aria-hidden="true">+</span><span>Start New Survey</span>
      </button>

      {!loading && view.status.needsAttention > 0 && (
        <section className="workflow-section" aria-labelledby="attention-title">
          <h2 className="section-title" id="attention-title">Needs attention</h2>
          <div className="attention-list">
            {view.status.failed > 0 && (
              <Link href={buildRecordsHref({ status: 'FAILED' })} className="attention-row danger">
                <span><strong>{view.status.failed}</strong> failed {view.status.failed === 1 ? 'sync' : 'syncs'}</span><span>Review</span>
              </Link>
            )}
            {view.status.pending > 0 && (
              <Link href={buildRecordsHref({ status: 'PENDING' })} className="attention-row">
                <span><strong>{view.status.pending}</strong> waiting to sync</span><span>View</span>
              </Link>
            )}
            {view.status.syncing > 0 && (
              <Link href={buildRecordsHref({ status: 'SYNCING' })} className="attention-row">
                <span><strong>{view.status.syncing}</strong> syncing now</span><span>View</span>
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="workflow-section" aria-labelledby="recent-title">
        <div className="section-header-row">
          <h2 className="section-title" id="recent-title">Recent activity</h2>
          {recentRecords.length > 0 && <Link href="/records" className="section-link">All records</Link>}
        </div>
        {loading ? (
          <div className="loading-card">Loading recent inspections…</div>
        ) : recentRecords.length === 0 ? (
          <div className="empty-state-card compact-empty">
            <p className="empty-title">No inspections recorded yet</p>
            <p className="empty-desc">Start with the room you are currently inspecting.</p>
          </div>
        ) : (
          <div className="recent-list">
            {recentRecords.map((record) => {
              const room = formatFullRoomIdentifier(record.surveyData) ?? 'Unknown room';
              return (
                <Link key={record.id} href={`/records/${record.id}`} className="recent-item-card">
                  <div className="recent-item-main">
                    <strong className="recent-room-badge">{room}</strong>
                    <span className="recent-category">{record.surveyData.category} · {record.surveyData.conditionRating}★</span>
                  </div>
                  <div className="recent-item-status">
                    <span className={`status-pill ${record.syncStatus.toLowerCase()}`}>
                      {record.syncStatus === 'SYNCED' ? 'Synced' : record.syncStatus === 'SYNC_FAILED' ? 'Failed' : record.syncStatus === 'SYNCING' ? 'Syncing' : 'Pending'}
                    </span>
                    <span className="recent-time">{relativeTime(record.timestamp)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <p className={`connection-note ${isConnected ? 'online' : 'offline'}`} role="status">
        <span aria-hidden="true" />
        {isConnected ? 'Online · synchronization runs automatically' : 'Offline · inspections remain saved on this device'}
      </p>
    </div>
  );
}
