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
  if (lat >= 15.970 && lat <= 15.982 && lng >= 108.248 && lng <= 108.258) {
    return 'Khuôn viên ĐH Việt - Hàn (VKU)';
  }
  if (lat >= 15.90 && lat <= 16.25 && lng >= 108.10 && lng <= 108.45) {
    return 'TP. Đà Nẵng';
  }
  return 'Tọa độ thực địa';
}

function getAccuracyDetails(accuracy?: number | null): { label: string; className: string } {
  if (accuracy === undefined || accuracy === null) {
    return { label: 'Chuẩn', className: 'acc-normal' };
  }
  const rounded = Math.round(accuracy);
  if (rounded <= 10) {
    return { label: `±${rounded}m (Cao)`, className: 'acc-high' };
  }
  if (rounded <= 30) {
    return { label: `±${rounded}m (Tốt)`, className: 'acc-medium' };
  }
  return { label: `±${rounded}m`, className: 'acc-low' };
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
      // Fallback
    }
  };

  if (!gps) {
    if (editable) {
      return (
        <div className="gps-visual-block empty">
          <div className="gps-empty-row">
            <div className="gps-empty-text">
              <span className="gps-status-dot inactive" aria-hidden="true" />
              <div className="gps-empty-titles">
                <strong className="gps-empty-heading">Định vị GPS thực địa</strong>
                <span className="gps-empty-sub">Gắn tọa độ để xác thực vị trí phòng học</span>
              </div>
            </div>
            <button
              type="button"
              className="btn-gps-get"
              onClick={onCapture}
              disabled={isLocating}
              aria-label="Lấy vị trí GPS"
            >
              {isLocating ? 'Đang định vị…' : 'Lấy vị trí GPS'}
            </button>
          </div>
          {error && <div className="gps-error-line" role="alert">{error}</div>}
        </div>
      );
    }

    return (
      <div className="gps-empty-readonly">
        <span className="gps-status-dot inactive" aria-hidden="true" />
        <span>Chưa ghi nhận tọa độ GPS cho bản ghi này.</span>
      </div>
    );
  }

  const locationContext = getLocationContext(gps.latitude, gps.longitude);
  const accuracy = getAccuracyDetails(gps.accuracy);
  const mapUrl = `https://maps.google.com/maps?q=${gps.latitude},${gps.longitude}&hl=vi&z=17&output=embed`;
  const externalMapUrl = `https://www.google.com/maps?q=${gps.latitude},${gps.longitude}`;

  return (
    <div className="gps-visual-block verified">
      {/* Top Bar: Location context & Status */}
      <div className="gps-block-header">
        <div className="gps-header-left">
          <span className="gps-status-dot active" aria-hidden="true" />
          <span className="gps-location-name">{locationContext}</span>
          <span className={`gps-accuracy-tag ${accuracy.className}`}>
            {accuracy.label}
          </span>
        </div>

        {editable && (
          <div className="gps-header-actions">
            <button
              type="button"
              className="btn-ghost-sm"
              onClick={onCapture}
              disabled={isLocating}
              title="Lấy lại vị trí GPS"
              aria-label="Lấy lại vị trí GPS"
            >
              {isLocating ? 'Đang lấy…' : 'Lấy lại'}
            </button>
            {onRemove && (
              <button
                type="button"
                className="btn-ghost-sm danger"
                onClick={onRemove}
                title="Xóa tọa độ GPS"
                aria-label="Xóa tọa độ GPS"
              >
                Xóa
              </button>
            )}
          </div>
        )}
      </div>

      {/* Embedded Map directly visible */}
      <div className="gps-map-wrapper">
        <iframe
          title={`Bản đồ tọa độ ${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}`}
          src={mapUrl}
          className="gps-map-frame"
          loading="lazy"
          allowFullScreen
        />
      </div>

      {/* Bottom Bar: Coordinates + Quick Copy / Open Maps */}
      <div className="gps-block-footer">
        <div className="gps-coords-display">
          <code className="gps-coords-code">
            {gps.latitude.toFixed(6)}°, {gps.longitude.toFixed(6)}°
          </code>
        </div>

        <div className="gps-footer-actions">
          <button
            type="button"
            className="btn-ghost-sm"
            onClick={handleCopy}
            title="Sao chép tọa độ"
          >
            {copied ? '✓ Đã chép' : 'Sao chép'}
          </button>
          <a
            href={externalMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost-sm"
            title="Mở Google Maps"
          >
            Google Maps ↗
          </a>
        </div>
      </div>
    </div>
  );
}
