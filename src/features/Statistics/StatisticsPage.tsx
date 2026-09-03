import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SurveySubmission } from '../../domain/models.ts';
import type { SurveyStoragePort } from '../../domain/ports.ts';
import { buildRecordsHref, createSubmissionViewModel } from '../../domain/submissionViewModel.ts';
import { globalSyncEventHub } from '../../domain/syncEvents.ts';
import { Link } from '../../app/router.tsx';

export interface StatisticsPageProps {
  readonly storage: SurveyStoragePort;
}

function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

export function StatisticsPage({ storage }: StatisticsPageProps) {
  const [records, setRecords] = useState<readonly SurveySubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecords = useCallback(() => {
    void storage.getAllSubmissions()
      .then(setRecords)
      .finally(() => setLoading(false));
  }, [storage]);

  useEffect(() => {
    loadRecords();
    return globalSyncEventHub.subscribeStorage(loadRecords);
  }, [loadRecords]);

  const view = useMemo(() => createSubmissionViewModel(records), [records]);

  if (loading) {
    return <div className="page-container"><div className="loading-card">Calculating inspection statistics…</div></div>;
  }

  if (view.status.total === 0) {
    return (
      <div className="page-container statistics-page">
        <header className="page-header-block">
          <p className="eyebrow">Coverage and condition</p>
          <h1 className="page-title">Statistics</h1>
        </header>
        <div className="empty-state-card">
          <p className="empty-title">No inspection statistics yet</p>
          <p className="empty-desc">Complete an inspection to start tracking campus coverage.</p>
          <Link href="/survey" className="btn-primary-action">Start First Survey</Link>
        </div>
      </div>
    );
  }

  const status = view.status;
  const allSynced = status.synced === status.total;

  return (
    <div className="page-container statistics-page">
      <header className="page-header-block">
        <p className="eyebrow">Coverage and condition</p>
        <h1 className="page-title">Statistics</h1>
        <p className="page-subtitle">Use actual submitted inspections to decide where to review next.</p>
      </header>

      <section className="stats-overview" aria-label="Inspection summary">
        <div className="stat-primary"><span>Total inspections</span><strong>{status.total}</strong></div>
        <div className="stat-primary"><span>Average condition</span><strong>{view.averageRating.toFixed(1)} <small>★</small></strong></div>
      </section>

      <section className={`sync-summary ${allSynced ? 'calm' : ''}`} aria-labelledby="sync-summary-title">
        <div>
          <h2 id="sync-summary-title">Synchronization</h2>
          <p>{allSynced ? 'All inspections synchronized' : `${status.needsAttention} ${status.needsAttention === 1 ? 'inspection needs' : 'inspections need'} attention`}</p>
        </div>
        <div className="sync-counts">
          <Link href={buildRecordsHref({ status: 'SYNCED' })}><strong>{status.synced}</strong><span>Synced</span></Link>
          <Link href={buildRecordsHref({ status: 'PENDING' })}><strong>{status.pending}</strong><span>Pending</span></Link>
          <Link href={buildRecordsHref({ status: 'SYNCING' })}><strong>{status.syncing}</strong><span>Syncing</span></Link>
          <Link href={buildRecordsHref({ status: 'FAILED' })}><strong>{status.failed}</strong><span>Failed</span></Link>
        </div>
      </section>

      {(status.failed > 0 || view.lowConditionCount > 0 || view.zoneDistribution.some((item) => item.count === 0)) && (
        <section className="insights-section" aria-labelledby="insights-title">
          <h2 className="section-title" id="insights-title">Needs attention</h2>
          <div className="insight-list">
            {status.failed > 0 && <Link href={buildRecordsHref({ status: 'FAILED' })}><span><strong>{status.failed}</strong> failed sync {status.failed === 1 ? 'requires' : 'require'} review</span><span>Review</span></Link>}
            {view.lowConditionCount > 0 && <Link href={buildRecordsHref({ poorConditionOnly: true })}><span><strong>{view.lowConditionCount}</strong> {view.lowConditionCount === 1 ? 'inspection is' : 'inspections are'} rated 2★ or below</span><span>Inspect</span></Link>}
            {view.zoneDistribution.filter((item) => item.count === 0).map((item) => (
              <Link key={item.key} href={buildRecordsHref({ zone: item.key })}><span><strong>{item.key}</strong> zone has no inspections yet</span><span>View gap</span></Link>
            ))}
          </div>
        </section>
      )}

      <section className="stats-section-card" aria-labelledby="rating-title">
        <div className="stats-section-heading"><h2 id="rating-title">Condition rating</h2><span>{status.total} total</span></div>
        <div className="chart-bar-list">
          {view.ratingDistribution.map((item) => (
            <div key={item.key} className="chart-row">
              <span className="chart-stars-label">{item.key} ★</span>
              <div className="chart-track" aria-hidden="true"><div className="chart-fill rating-fill" style={{ width: `${item.percent}%` }} /></div>
              <span className="chart-value"><strong>{item.count}</strong><small>{formatPercent(item.percent)}</small></span>
            </div>
          ))}
        </div>
      </section>

      <section className="stats-section-card" aria-labelledby="category-title">
        <div className="stats-section-heading"><h2 id="category-title">Equipment categories</h2><span>Most inspected first</span></div>
        <div className="chart-bar-list">
          {view.categoryDistribution.map((item) => (
            <Link key={item.key} href={buildRecordsHref({ category: item.key })} className="chart-row category-row" aria-label={`View ${item.count} ${item.key} records`}>
              <span className="chart-name-label">{item.key}</span>
              <div className="chart-track" aria-hidden="true"><div className="chart-fill category-fill" style={{ width: `${item.percent}%` }} /></div>
              <span className="chart-value"><strong>{item.count}</strong></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="stats-section-card" aria-labelledby="zone-title">
        <div className="stats-section-heading"><h2 id="zone-title">Campus coverage</h2><span>K / V distribution</span></div>
        <div className="zone-distribution">
          {view.zoneDistribution.map((item) => (
            <Link key={item.key} href={buildRecordsHref({ zone: item.key })} className="zone-row" aria-label={`View zone ${item.key} records`}>
              <span className={`zone-marker zone-${item.key.toLowerCase()}`}>{item.key}</span>
              <span className="zone-name">{item.key === 'K' ? 'Khu Hàn' : 'Khu Việt'}</span>
              <span className="zone-bar"><span style={{ width: `${item.percent}%` }} /></span>
              <strong>{item.count}</strong>
              <small>{formatPercent(item.percent)}</small>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
