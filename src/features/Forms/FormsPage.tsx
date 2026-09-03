import { Link } from '../../app/router.tsx';
import { SURVEY_CATEGORIES } from '../../domain/models.ts';

export function FormsPage() {
  return (
    <div className="page-container forms-page">
      <div className="page-header-block">
        <h2 className="page-title">Inspection Forms</h2>
        <p className="page-subtitle">
          Select an authorized field survey template to record room and asset inspections.
        </p>
      </div>

      <div className="forms-list">
        {/* Active Campus Equipment Inspection Form */}
        <div className="form-catalog-card active-form">
          <div className="catalog-header">
            <div className="catalog-icon" aria-hidden="true">
              📋
            </div>
            <div>
              <span className="status-pill synced">Active</span>
              <h3 className="catalog-title">Campus Equipment &amp; Facility Inspection</h3>
            </div>
          </div>

          <p className="catalog-desc">
            Standard VKU field inspection form for recording condition ratings, defect notes,
            and photo attachments for equipment across Khu Hàn (K) and Khu Việt (V).
          </p>

          <div className="catalog-meta">
            <div className="meta-item">
              <span className="meta-label">Location Scope:</span>
              <span className="meta-val">Khu Hàn (K), Khu Việt (V)</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Categories:</span>
              <div className="category-tags">
                {SURVEY_CATEGORIES.map((cat) => (
                  <span key={cat} className="category-tag">
                    {cat}
                  </span>
                ))}
              </div>
            </div>
            <div className="meta-item">
              <span className="meta-label">Features:</span>
              <span className="meta-val">Local draft autosave, camera capture, offline sync queue</span>
            </div>
          </div>

          <div className="catalog-actions">
            <Link href="/survey" className="btn-primary-action">
              Start Inspection Form &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
