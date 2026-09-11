import { useState } from 'react';
import type { GpsCoordinates } from '../../domain/models.ts';

export interface GpsVisualCardProps {
  readonly gps: GpsCoordinates | null;
  readonly isLocating?: boolean;
  readonly onCapture?: () => void;
  readonly onRemove?: () => void;
  readonly editable?: boolean;
  readonly error?: string | null;
}

function getLocationContext(lat: number, lng: number): string {
  // VKU Campus coordinates (~15.9752, 108.2523)
  if (lat >= 15.970 && lat <= 15.982 && lng >= 108.248 && lng <= 108.258) {
    return '🏫 Khuôn viên ĐH Việt - Hàn (VKU)';
  }
  if (lat >= 15.90 && lat <= 16.25 && lng >= 108.10 && lng <= 108.45) {
    return '📍 TP. Đà Nẵng';
  }
  return '📍 Vị trí thực địa';
}

function getAccuracyDetails(accuracy?: number | null): { label: string; className: string } {
  if (accuracy === undefined || accuracy === null) {
    return { label: 'Tọa độ chuẩn', className: 'acc-normal' };
  }
  const rounded = Math.round(accuracy);
  if (rounded <= 10) {
    return { label: `🟢 Chính xác cao (±${rounded}m)`, className: 'acc-high' };
  }
  if (rounded <= 30) {
    return { label: `🔵 Tốt (±${rounded}m)`, className: 'acc-medium' };
  }
  return { label: `🟡 Trung bình (±${rounded}m)`, className: 'acc-low' };
}

export function GpsVisualCard({
  gps,
  isLocating = false,
  onCapture,
  onRemove,
  editable = false,
  error,
}: GpsVisualCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!gps) return;
    try {
      const coordStr = `${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}`;
      await navigator.clipboard.writeText(coordStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
    }
  };

  if (!gps) {
    if (editable) {
      return (
        <div className="gps-card-empty-editable">
          <div className="gps-empty-header">
            <span className="gps-icon-large" aria-hidden="true">📡</span>
            <div className="gps-empty-texts">
              <strong className="gps-empty-title">Định vị thực địa GPS</strong>
              <p className="gps-empty-desc">
                Xác thực tọa độ chính xác của phòng học / thiết bị để tránh gian lận và hiển thị trực quan trên bản đồ.
              </p>
            </div>
          </div>

          {error && <div className="gps-error-banner" role="alert">⚠️ {error}</div>}

          <div className="gps-empty-actions">
            <button
              type="button"
              className="btn-gps-primary"
              onClick={onCapture}
              disabled={isLocating}
              aria-label="Lấy tọa độ GPS"
            >
              {isLocating ? '📡 Đang kết nối vệ tinh GPS…' : '📍 Lấy tọa độ GPS hiện tại'}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="gps-card-empty-readonly">
        <span className="gps-empty-readonly-icon" aria-hidden="true">📍</span>
        <span>Chưa có dữ liệu GPS cho bản ghi này (Khảo sát trước khi bật định vị vệ tinh).</span>
      </div>
    );
  }

  const locationContext = getLocationContext(gps.latitude, gps.longitude);
  const accuracy = getAccuracyDetails(gps.accuracy);
  const mapUrl = `https://maps.google.com/maps?q=${gps.latitude},${gps.longitude}&hl=vi&z=17&output=embed`;
  const externalMapUrl = `https://www.google.com/maps?q=${gps.latitude},${gps.longitude}`;

  return (
    <div className="gps-visual-card">
      {/* Visual Header */}
      <div className="gps-visual-header">
        <div className="gps-location-meta">
          <span className="gps-campus-label">{locationContext}</span>
          <span className={`gps-accuracy-badge ${accuracy.className}`}>{accuracy.label}</span>
        </div>

        {editable && (
          <div className="gps-edit-buttons">
            <button
              type="button"
              className="btn-gps-retake"
              onClick={onCapture}
              disabled={isLocating}
              title="Lấy lại tọa độ GPS"
              aria-label="Lấy lại tọa độ GPS"
            >
              {isLocating ? '📡 Đang lấy…' : '🔄 Lấy lại'}
            </button>
            {onRemove && (
              <button
                type="button"
                className="btn-gps-clear"
                onClick={onRemove}
                title="Xóa tọa độ GPS"
                aria-label="Xóa tọa độ GPS"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Embedded Map */}
      <div className="gps-map-container">
        <iframe
          title={`Bản đồ tọa độ ${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}`}
          src={mapUrl}
          className="gps-map-iframe"
          loading="lazy"
          allowFullScreen
        />
      </div>

      {/* Visual Coordinates & Actions */}
      <div className="gps-visual-footer">
        <div className="gps-coords-cluster">
          <span className="gps-pin-marker" aria-hidden="true">📍</span>
          <span className="gps-coords-digits">
            {gps.latitude.toFixed(6)}°, {gps.longitude.toFixed(6)}°
          </span>
          {gps.capturedAt && (
            <span className="gps-captured-time">
              (Lúc {new Date(gps.capturedAt).toLocaleTimeString()})
            </span>
          )}
        </div>

        <div className="gps-actions-cluster">
          <button
            type="button"
            className="btn-gps-copy"
            onClick={handleCopy}
            title="Sao chép tọa độ vào bộ nhớ tạm"
          >
            {copied ? '✓ Đã chép' : '📋 Sao chép'}
          </button>
          <a
            href={externalMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gps-external-map"
            title="Mở trên ứng dụng Google Maps"
          >
            🗺️ Mở Maps ↗
          </a>
        </div>
      </div>
    </div>
  );
}
