import { useCallback, useEffect, useState } from 'react';
import { SURVEY_CATEGORIES, type SurveySubmission } from '../../domain/models.ts';
import type { SurveyStoragePort } from '../../domain/ports.ts';
import { aggregateSubmissions, ZERO_STATUS_COUNTS } from '../../domain/submissionAggregation.ts';
import { globalSyncEventHub } from '../../domain/syncEvents.ts';
import { Link } from '../../app/router.tsx';

export interface StatisticsPageProps {
  readonly storage: SurveyStoragePort;
}

export function StatisticsPage({ storage }: StatisticsPageProps) {
  const [records, setRecords] = useState<readonly SurveySubmission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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

  const counts = records.length > 0 ? aggregateSubmissions(records) : ZERO_STATUS_COUNTS;
  const total = counts.total;

  // Average Rating
  const totalRating = records.reduce((sum, r) => sum + r.surveyData.conditionRating, 0);
  const avgRating = total > 0 ? (totalRating / total).toFixed(1) : '0.0';
  const avgRatingNum = Number(avgRating);
  const roundedStars = Math.round(avgRatingNum);
  const starDisplay = '★'.repeat(roundedStars) + '☆'.repeat(5 - roundedStars);

  // By Condition Rating (5 down to 1)
  const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of records) {
    ratingCounts[r.surveyData.conditionRating] =
      (ratingCounts[r.surveyData.conditionRating] || 0) + 1;
  }

  // By Category
  const categoryCounts: Record<string, number> = {};
  for (const cat of SURVEY_CATEGORIES) {
    categoryCounts[cat] = 0;
  }
  for (const r of records) {
    categoryCounts[r.surveyData.category] = (categoryCounts[r.surveyData.category] || 0) + 1;
  }

  // By Campus Zone
  let countZoneK = 0;
  let countZoneV = 0;
  for (const r of records) {
    if (r.surveyData.zone === 'K') countZoneK++;
    if (r.surveyData.zone === 'V') countZoneV++;
  }

  const syncPercent = total > 0 ? Math.round((counts.synced / total) * 100) : 0;

  return (
    <div className="page-container statistics-page">
      <div className="page-header-block">
        <h2 className="page-title">Field Inspection Statistics</h2>
        <p className="page-subtitle">
          Real-time summary of room equipment condition assessments recorded on this device.
        </p>
      </div>

      {loading ? (
        <div className="loading-card">Calculating inspection statistics...</div>
      ) : total === 0 ? (
        <div className="empty-state-card">
          <span className="empty-icon" aria-hidden="true">
            📊
          </span>
          <p className="empty-title">No inspection statistics yet</p>
          <p className="empty-desc">
            Statistics and distribution charts will appear here automatically as surveys are
            completed.
          </p>
          <Link href="/survey" className="btn-primary-action">
            Start First Survey &rarr;
          </Link>
        </div>
      ) : (
        <div className="stats-content">
          {/* Top Key Metrics Grid (2x2 responsive layout) */}
          <div className="stats-summary-grid">
            <div className="stat-card">
              <span className="stat-label">Total Surveys</span>
              <span className="stat-num">{total}</span>
              <span className="stat-sub">on this device</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Avg Condition</span>
              <div className="avg-rating-row">
                <span className="stat-num">{avgRating}</span>
                <span className="stat-stars-small" aria-label={`${avgRating} out of 5 stars`}>
                  {starDisplay}
                </span>
              </div>
              <span className="stat-sub">out of 5.0</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Sync Progress</span>
              <span className="stat-num">
                {counts.synced} / {total}
              </span>
              <span className="stat-sub">{syncPercent}% uploaded to sheet</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Queue Status</span>
              <div className="stat-queue-row">
                {counts.failed > 0 && (
                  <span className="badge-chip chip-failed">{counts.failed} failed</span>
                )}
                {counts.pending > 0 && (
                  <span className="badge-chip chip-pending">{counts.pending} pending</span>
                )}
                {counts.syncing > 0 && (
                  <span className="badge-chip chip-syncing">{counts.syncing} syncing</span>
                )}
                {counts.needsAttention === 0 && (
                  <span className="badge-chip chip-synced">All up to date</span>
                )}
              </div>
              <span className="stat-sub">
                {counts.needsAttention > 0
                  ? `${counts.needsAttention} item(s) awaiting sync`
                  : 'All records synchronized'}
              </span>
            </div>
          </div>

          {/* Condition Rating Distribution */}
          <section className="stats-section" aria-label="Condition Rating Breakdown">
            <h3 className="section-title">Condition Rating Distribution</h3>
            <div className="distribution-list">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = ratingCounts[stars] || 0;
                const percent = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={stars} className="dist-row">
                    <span className="dist-label">{stars} ★</span>
                    <div className="dist-track">
                      <div className="dist-fill" style={{ width: `${percent}%` }} />
                    </div>
                    <span className="dist-count">
                      {count} ({Math.round(percent)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Equipment Category Breakdown */}
          <section className="stats-section" aria-label="Equipment Category Breakdown">
            <h3 className="section-title">Equipment by Category</h3>
            <div className="category-stats-list">
              {SURVEY_CATEGORIES.map((cat) => {
                const count = categoryCounts[cat] || 0;
                const percent = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={cat} className="dist-row">
                    <span className="dist-label-cat">{cat}</span>
                    <div className="dist-track">
                      <div
                        className="dist-fill category-fill"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="dist-count">{count}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Campus Zone Breakdown */}
          <section className="stats-section" aria-label="Campus Zone Distribution">
            <h3 className="section-title">Campus Zone Breakdown</h3>
            <div className="zone-stats-grid">
              <div className="zone-stat-card">
                <span className="zone-tag">Khu Hàn (K)</span>
                <span className="zone-num">{countZoneK}</span>
                <span className="zone-sub">
                  {total > 0 ? Math.round((countZoneK / total) * 100) : 0}% of surveys
                </span>
              </div>

              <div className="zone-stat-card">
                <span className="zone-tag">Khu Việt (V)</span>
                <span className="zone-num">{countZoneV}</span>
                <span className="zone-sub">
                  {total > 0 ? Math.round((countZoneV / total) * 100) : 0}% of surveys
                </span>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
