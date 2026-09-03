import { useEffect, useState } from 'react';
import { SURVEY_CATEGORIES, type SurveySubmission } from '../../domain/models.ts';
import type { SurveyStoragePort } from '../../domain/ports.ts';
import { Link } from '../../app/router.tsx';

export interface StatisticsPageProps {
  readonly storage: SurveyStoragePort;
}

export function StatisticsPage({ storage }: StatisticsPageProps) {
  const [records, setRecords] = useState<readonly SurveySubmission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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

  const total = records.length;

  // Average Rating
  const totalRating = records.reduce((sum, r) => sum + r.surveyData.conditionRating, 0);
  const avgRating = total > 0 ? (totalRating / total).toFixed(1) : '0.0';
  const avgRatingNum = Number(avgRating);
  const roundedStars = Math.round(avgRatingNum);
  const starDisplay = '★'.repeat(roundedStars) + '☆'.repeat(5 - roundedStars);

  // By Condition Rating (5 down to 1)
  const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of records) {
    ratingCounts[r.surveyData.conditionRating] = (ratingCounts[r.surveyData.conditionRating] || 0) + 1;
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

  const syncedCount = records.filter((r) => r.syncStatus === 'SYNCED').length;
  const pendingCount = records.filter(
    (r) => r.syncStatus === 'PENDING_SYNC' || r.syncStatus === 'SYNCING'
  ).length;

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
            Statistics and distribution charts will appear here automatically as surveys are completed.
          </p>
          <Link href="/survey" className="btn-primary-action">
            Start First Survey &rarr;
          </Link>
        </div>
      ) : (
        <div className="stats-content">
          {/* Top Key Metrics */}
          <div className="stats-summary-grid">
            <div className="stat-card">
              <span className="stat-label">Total Inspections</span>
              <span className="stat-num">{total}</span>
              <span className="stat-sub">recorded locally</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Average Condition</span>
              <div className="avg-rating-row">
                <span className="stat-stars">{starDisplay}</span>
                <span className="stat-num-compact">{avgRating}</span>
              </div>
              <span className="stat-sub">out of 5.0</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Sync Progress</span>
              <span className="stat-num">
                {syncedCount} <small className="stat-small">/ {total}</small>
              </span>
              <span className="stat-sub">
                {pendingCount > 0 ? `${pendingCount} pending sync` : 'All synced to Sheet'}
              </span>
            </div>
          </div>

          {/* By Condition Rating */}
          <div className="stats-section-card">
            <h3 className="card-section-title">Inspections by Condition Rating</h3>
            <div className="chart-bar-list">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = ratingCounts[rating] || 0;
                const percent = total > 0 ? (count / total) * 100 : 0;
                const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);

                return (
                  <div key={rating} className="chart-row">
                    <span className="chart-stars-label" title={`${rating} Stars`}>
                      {stars}
                    </span>
                    <div className="chart-track">
                      <div
                        className="chart-fill"
                        style={{ width: `${percent}%` }}
                        aria-valuenow={count}
                        aria-valuemin={0}
                        aria-valuemax={total}
                      />
                    </div>
                    <span className="chart-count-label">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By Equipment Category */}
          <div className="stats-section-card">
            <h3 className="card-section-title">Inspections by Equipment Category</h3>
            <div className="chart-bar-list">
              {SURVEY_CATEGORIES.map((cat) => {
                const count = categoryCounts[cat] || 0;
                const percent = total > 0 ? (count / total) * 100 : 0;

                return (
                  <div key={cat} className="chart-row category-row">
                    <span className="chart-name-label">{cat}</span>
                    <div className="chart-track">
                      <div
                        className="chart-fill fill-category"
                        style={{ width: `${percent}%` }}
                        aria-valuenow={count}
                        aria-valuemin={0}
                        aria-valuemax={total}
                      />
                    </div>
                    <span className="chart-count-label">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By Campus Zone */}
          <div className="stats-section-card">
            <h3 className="card-section-title">Inspections by Campus Zone</h3>
            <div className="zone-summary-grid">
              <div className="zone-stat-box">
                <span className="zone-badge">K</span>
                <span className="zone-title">Khu Hàn</span>
                <span className="zone-count">{countZoneK}</span>
                <span className="zone-ratio">
                  {total > 0 ? Math.round((countZoneK / total) * 100) : 0}%
                </span>
              </div>

              <div className="zone-stat-box">
                <span className="zone-badge badge-v">V</span>
                <span className="zone-title">Khu Việt</span>
                <span className="zone-count">{countZoneV}</span>
                <span className="zone-ratio">
                  {total > 0 ? Math.round((countZoneV / total) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
