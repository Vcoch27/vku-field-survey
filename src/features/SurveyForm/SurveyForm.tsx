import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { CameraPort, Clock, SurveyStoragePort, UuidGenerator } from '../../domain/ports';
import {
  type CampusZone,
  type InspectionDraft,
  type PhotoAttachment,
  SURVEY_CATEGORIES,
  type SurveyCategory,
  CONDITION_RATINGS,
  type ConditionRating,
  type Uuid,
  formatFullRoomIdentifier,
} from '../../domain/models';
import { autosaveDraft } from '../../domain/autosaveDraft';
import { recoverDraft } from '../../domain/recoverDraft';
import { submitSurveyOffline } from '../../domain/submitSurveyOffline';
import './SurveyForm.css';

export interface SurveyFormProps {
  storage: SurveyStoragePort;
  uuidGenerator?: UuidGenerator;
  clock?: Clock;
  camera?: CameraPort;
  onSubmitted?: () => Promise<void> | void;
}

export function SurveyForm({
  storage,
  uuidGenerator,
  clock,
  camera,
  onSubmitted,
}: SurveyFormProps) {
  const [draftId, setDraftId] = useState<Uuid>('');
  const [zone, setZone] = useState<CampusZone | null>(null);
  const [building, setBuilding] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [category, setCategory] = useState<SurveyCategory | ''>('');
  const [conditionRating, setConditionRating] = useState<ConditionRating | ''>('');
  const [defectNotes, setDefectNotes] = useState('');
  const [photo, setPhoto] = useState<PhotoAttachment | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isInitializing, setIsInitializing] = useState(true);
  const [recoveryError, setRecoveryError] = useState(false);

  // M5 Offline Submission state
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'queued' | 'error'>(
    'idle'
  );
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    zone?: string;
    category?: string;
    conditionRating?: string;
  }>({});
  const isSubmittingRef = useRef(false);

  const generateUuid = useCallback(() => {
    return uuidGenerator !== undefined ? uuidGenerator.generateUuid() : crypto.randomUUID();
  }, [uuidGenerator]);

  const clockPort = clock ?? { now: () => new Date().toISOString() };

  // Initialization: Recover Draft
  useEffect(() => {
    let mounted = true;
    recoverDraft(storage)
      .then((draft) => {
        if (!mounted) return;
        if (draft) {
          setDraftId(draft.id);
          setZone(draft.zone);
          setBuilding(draft.building);
          setRoomNumber(draft.roomNumber);
          setCategory(draft.category ?? '');
          setConditionRating(draft.conditionRating ?? '');
          setDefectNotes(draft.defectNotes);
          if (draft.photo) {
            setPhoto(draft.photo);
          }
        } else {
          setDraftId(generateUuid());
        }
        setIsInitializing(false);
      })
      .catch((err) => {
        console.error('Failed to recover draft:', err);
        if (mounted) {
          setRecoveryError(true);
          setIsInitializing(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [storage, generateUuid]);

  // Object URL preview management with memory cleanup
  const previewUrl = useMemo(() => {
    if (!photo) return null;
    if (photo.displayUri) return photo.displayUri;
    if (typeof URL !== 'undefined' && photo.binaryData) {
      return URL.createObjectURL(photo.binaryData);
    }
    return null;
  }, [photo]);

  useEffect(() => {
    return () => {
      if (previewUrl && !photo?.displayUri && typeof URL !== 'undefined') {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, photo?.displayUri]);

  // Handle transitioning away from 'queued' when editing begins on a fresh inspection
  const onFieldEdit = () => {
    setPhotoError(null);
    if (submitStatus === 'queued') {
      setDraftId(generateUuid());
      setSubmitStatus('idle');
      setSubmitErrorMessage(null);
    }
  };

  // Autosave
  useEffect(() => {
    if (
      isInitializing ||
      recoveryError ||
      submitStatus === 'queued' ||
      submitStatus === 'submitting'
    ) {
      return;
    }

    const draft: InspectionDraft = {
      id: draftId,
      zone,
      building,
      roomNumber,
      category: category === '' ? null : category,
      conditionRating: conditionRating === '' ? null : conditionRating,
      defectNotes,
      photo,
      lastModifiedAt: new Date().toISOString(),
    };

    const timer = setTimeout(() => {
      setSaveStatus('saving');
      autosaveDraft(storage, draft)
        .then(() => setSaveStatus('saved'))
        .catch((err) => {
          console.error('Autosave failed:', err);
          setSaveStatus('error');
        });
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [
    isInitializing,
    recoveryError,
    submitStatus,
    storage,
    draftId,
    zone,
    building,
    roomNumber,
    category,
    conditionRating,
    defectNotes,
    photo,
  ]);

  // Submission handler with duplicate-click guard
  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;

    setValidationErrors({});
    setSubmitErrorMessage(null);

    // Validate required domain fields
    const errors: { zone?: string; category?: string; conditionRating?: string } = {};
    if (!zone) {
      errors.zone = 'Please select a campus zone (Khu Hàn or Khu Việt).';
    }
    if (category === '') {
      errors.category = 'Please select a valid equipment category.';
    }
    if (conditionRating === '') {
      errors.conditionRating = 'Please select a condition rating from 1 to 5.';
    }

    if (
      errors.zone !== undefined ||
      errors.category !== undefined ||
      errors.conditionRating !== undefined
    ) {
      setValidationErrors(errors);
      return;
    }

    isSubmittingRef.current = true;
    setSubmitStatus('submitting');

    const draft: InspectionDraft = {
      id: draftId,
      zone,
      building,
      roomNumber,
      category: category === '' ? null : category,
      conditionRating: conditionRating === '' ? null : conditionRating,
      defectNotes,
      photo,
      lastModifiedAt: new Date().toISOString(),
    };

    try {
      const result = await submitSurveyOffline(draft, {
        storage,
        uuidGenerator: { generateUuid },
        clock: clockPort,
      });

      if (result.success) {
        setSubmitStatus('queued');
        void onSubmitted?.();
      } else if (result.errorType === 'VALIDATION_ERROR') {
        setSubmitStatus('idle');
        setValidationErrors(result.validationErrors);
      } else {
        setSubmitStatus('error');
        setSubmitErrorMessage(result.message);
      }
    } catch (err) {
      setSubmitStatus('error');
      setSubmitErrorMessage(err instanceof Error ? err.message : 'Submission failed unexpectedly');
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleCapturePhoto = async () => {
    if (!camera || isCapturing) {
      return;
    }
    onFieldEdit();
    setPhotoError(null);
    setIsCapturing(true);
    try {
      const captured = await camera.capturePhoto();
      if (captured) {
        setPhoto(captured);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Camera capture failed';
      setPhotoError(message);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRemovePhoto = () => {
    onFieldEdit();
    setPhoto(null);
    setPhotoError(null);
  };

  const handleStartNewInspection = () => {
    setDraftId(generateUuid());
    setZone(null);
    setBuilding('');
    setRoomNumber('');
    setCategory('');
    setConditionRating('');
    setDefectNotes('');
    setPhoto(null);
    setPhotoError(null);
    setValidationErrors({});
    setSubmitStatus('idle');
    setSubmitErrorMessage(null);
    setSaveStatus('idle');
  };

  if (isInitializing) {
    return (
      <div className="survey-container loader" role="status" aria-live="polite">
        <div className="loader-spinner" aria-hidden="true" />
        <p className="loader-text">Loading...</p>
      </div>
    );
  }

  if (recoveryError) {
    return (
      <div className="survey-container error-state" role="alert">
        <div className="error-icon-bubble" aria-hidden="true">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="error-desc">Failed to recover your previous draft.</p>
        <button onClick={() => window.location.reload()} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  const roomIdentifier = formatFullRoomIdentifier({ zone, building, roomNumber });

  return (
    <div className="survey-container">
      {/* Status Bar */}
      <div className="status-bar-wrapper">
        <div className="status-bar" role="status" aria-live="polite">
          {submitStatus === 'submitting' && (
            <span className="status submitting">
              <span className="status-dot saving-dot" aria-hidden="true" />
              Queueing submission...
            </span>
          )}
          {submitStatus === 'queued' && (
            <span className="status queued">
              <span className="status-dot saved-dot" aria-hidden="true" />
              Saved offline — pending sync
            </span>
          )}
          {submitStatus === 'error' && (
            <span className="status error">
              <span className="status-dot error-dot" aria-hidden="true" />
              Queue failed
            </span>
          )}
          {submitStatus === 'idle' && (
            <>
              {saveStatus === 'saving' && (
                <span className="status saving">
                  <span className="status-dot saving-dot" aria-hidden="true" />
                  Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="status saved">
                  <span className="status-dot saved-dot" aria-hidden="true" />
                  Saved locally
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="status error">
                  <span className="status-dot error-dot" aria-hidden="true" />
                  Save failed
                </span>
              )}
              {saveStatus === 'idle' && (
                <span className="status idle">
                  <span className="status-dot idle-dot" aria-hidden="true" />
                  Ready
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <form className="survey-form" onSubmit={(e) => e.preventDefault()}>
        {/* Section: Location */}
        <section className="form-card">
          <div className="card-header">
            <div className="card-header-icon" aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div className="card-header-titles">
              <h2 className="card-title">Location</h2>
              <p className="card-subtitle">Specify campus zone, building, and room location</p>
            </div>
          </div>

          <div className="card-body-stack">
            {/* Campus Zone Segmented Radio Control */}
            <fieldset className="zone-fieldset">
              <legend className="field-label">
                Campus Zone <span className="field-required">*</span>
                <span className="field-hint">Required for VKU room ID</span>
              </legend>
              <div
                className="zone-options"
                role="radiogroup"
                aria-label="Campus Zone"
                aria-required="true"
              >
                <label className={`zone-card ${zone === 'K' ? 'is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="campusZone"
                    value="K"
                    checked={zone === 'K'}
                    onChange={() => {
                      onFieldEdit();
                      setZone('K');
                      if (validationErrors.zone) {
                        setValidationErrors((prev) => ({ ...prev, zone: undefined }));
                      }
                    }}
                    className="zone-radio-input"
                  />
                  <div className="zone-card-body">
                    <span className="zone-badge">K</span>
                    <span className="zone-name">Khu Hàn</span>
                  </div>
                </label>

                <label className={`zone-card ${zone === 'V' ? 'is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="campusZone"
                    value="V"
                    checked={zone === 'V'}
                    onChange={() => {
                      onFieldEdit();
                      setZone('V');
                      if (validationErrors.zone) {
                        setValidationErrors((prev) => ({ ...prev, zone: undefined }));
                      }
                    }}
                    className="zone-radio-input"
                  />
                  <div className="zone-card-body">
                    <span className="zone-badge">V</span>
                    <span className="zone-name">Khu Việt</span>
                  </div>
                </label>
              </div>
              {validationErrors.zone && (
                <p className="field-error" role="alert">
                  {validationErrors.zone}
                </p>
              )}
            </fieldset>

            {/* Building and Room Number Grid */}
            <div className="grid-location">
              <div className="input-field">
                <label htmlFor="building" className="field-label">
                  Building
                  <span className="field-hint">e.g. A, B, C, D1, D2, E1, E2</span>
                </label>
                <input
                  id="building"
                  type="text"
                  value={building}
                  onChange={(e) => {
                    onFieldEdit();
                    setBuilding(e.target.value);
                  }}
                  placeholder="e.g. A, B, C, D1, D2, E1, E2"
                  className="form-control"
                  autoComplete="off"
                />
              </div>

              <div className="input-field">
                <label htmlFor="roomNumber" className="field-label">
                  Room Number
                  <span className="field-hint">e.g. 205, 301</span>
                </label>
                <input
                  id="roomNumber"
                  type="text"
                  value={roomNumber}
                  onChange={(e) => {
                    onFieldEdit();
                    setRoomNumber(e.target.value);
                  }}
                  placeholder="e.g. 205, 301"
                  className="form-control"
                  aria-describedby="room-number-hint"
                  autoComplete="off"
                />
                <span id="room-number-hint" className="field-hint">
                  Floor is encoded in the room number.
                </span>
              </div>
            </div>

            {/* Live Room Identifier Preview */}
            <div className="room-identifier-preview" aria-live="polite">
              <span className="preview-label">Room Identifier</span>
              {roomIdentifier ? (
                <div className="preview-value ready">
                  <span className="preview-badge" data-testid="room-identifier-badge">
                    {roomIdentifier}
                  </span>
                  <span className="preview-status">VKU standard format</span>
                </div>
              ) : (
                <div className="preview-value pending">Select zone and enter building + room</div>
              )}
            </div>
          </div>
        </section>

        {/* Section: Equipment Details */}
        <section className="form-card">
          <div className="card-header">
            <div className="card-header-icon" aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div className="card-header-titles">
              <h2 className="card-title">Equipment Details</h2>
              <p className="card-subtitle">Asset category and physical condition assessment</p>
            </div>
          </div>

          <div className="card-body-stack">
            <div className="input-field">
              <label htmlFor="category" className="field-label">
                Category
              </label>
              <div className="select-wrapper">
                <select
                  id="category"
                  value={category}
                  onChange={(e) => {
                    onFieldEdit();
                    setCategory(e.target.value as SurveyCategory);
                    if (validationErrors.category) {
                      setValidationErrors((prev) => ({ ...prev, category: undefined }));
                    }
                  }}
                  className={`form-control form-select ${validationErrors.category ? 'has-error' : ''}`}
                >
                  <option value="">-- Select Category --</option>
                  {SURVEY_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              {validationErrors.category && (
                <p className="field-error-message" role="alert">
                  {validationErrors.category}
                </p>
              )}
            </div>

            <fieldset className="rating-group">
              <legend className="rating-legend">
                <span className="field-label">Condition Rating (1-5)</span>
                <span className="rating-hint" aria-live="polite">
                  {conditionRating ? `${conditionRating} of 5 stars selected` : 'Select rating'}
                </span>
              </legend>
              <div className="stars-container">
                {CONDITION_RATINGS.map((rating) => {
                  const isFilled = conditionRating !== '' && conditionRating >= rating;
                  return (
                    <label key={rating} className={`star-label ${isFilled ? 'is-filled' : ''}`}>
                      <input
                        type="radio"
                        name="conditionRating"
                        value={rating}
                        checked={conditionRating === rating}
                        onChange={() => {
                          onFieldEdit();
                          setConditionRating(rating);
                          if (validationErrors.conditionRating) {
                            setValidationErrors((prev) => ({
                              ...prev,
                              conditionRating: undefined,
                            }));
                          }
                        }}
                        className="sr-only"
                      />
                      <span className={`star ${isFilled ? 'selected' : ''}`} aria-hidden="true">
                        <svg
                          className="star-svg"
                          viewBox="0 0 24 24"
                          width="28"
                          height="28"
                          fill={isFilled ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth={isFilled ? '0' : '1.75'}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </span>
                      <span className="sr-only">{rating} Stars</span>
                    </label>
                  );
                })}
              </div>
              {validationErrors.conditionRating && (
                <p className="field-error-message" role="alert">
                  {validationErrors.conditionRating}
                </p>
              )}
            </fieldset>
          </div>
        </section>

        {/* Section: Defect Notes */}
        <section className="form-card">
          <div className="card-header">
            <div className="card-header-icon" aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div className="card-header-titles">
              <h2 className="card-title">Defect Notes</h2>
              <p className="card-subtitle">
                Document any damage, defect observations, or maintenance needs
              </p>
            </div>
          </div>

          <div className="input-field">
            <label htmlFor="defectNotes" className="field-label">
              Defect Notes
            </label>
            <textarea
              id="defectNotes"
              value={defectNotes}
              onChange={(e) => {
                onFieldEdit();
                setDefectNotes(e.target.value);
              }}
              placeholder="Describe physical condition, specific malfunctions, or replacement recommendations..."
              rows={4}
              className="form-control form-textarea"
            />
          </div>
        </section>

        {/* Section: Photo Documentation */}
        <section className="form-card">
          <div className="card-header">
            <div className="card-header-icon" aria-hidden="true">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <div className="card-header-titles">
              <h2 className="card-title">Photo Documentation</h2>
              <p className="card-subtitle">Visual photo attachment for field record</p>
            </div>
          </div>

          {photoError && (
            <div className="photo-error-banner" role="alert">
              <span>{photoError}</span>
            </div>
          )}

          {!photo ? (
            <div className="photo-capture-box">
              <div className="photo-placeholder-content">
                <div className="photo-icon-bubble" aria-hidden="true">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
                <p className="photo-placeholder-title">Attach Inspection Photo</p>
                <p className="photo-placeholder-desc">
                  Capture equipment condition or facility defect using device camera.
                </p>
                <button
                  type="button"
                  onClick={handleCapturePhoto}
                  disabled={isCapturing || !camera}
                  className="btn btn-secondary btn-capture"
                >
                  {isCapturing ? (
                    <>
                      <span className="btn-spinner" aria-hidden="true" />
                      Opening Camera...
                    </>
                  ) : (
                    <>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                      Capture Photo
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="photo-preview-container">
              {previewUrl && (
                <div className="photo-preview-image-wrap">
                  <img
                    src={previewUrl}
                    alt="Inspection capture preview"
                    className="photo-preview-image"
                  />
                </div>
              )}
              <div className="photo-preview-details">
                <span className="photo-timestamp">
                  Captured: {new Date(photo.capturedAt).toLocaleTimeString()}
                </span>
                <span className="photo-size">{(photo.binaryData.size / 1024).toFixed(1)} KB</span>
              </div>
              <div className="photo-preview-actions">
                <button
                  type="button"
                  onClick={handleCapturePhoto}
                  disabled={isCapturing}
                  className="btn btn-secondary btn-sm"
                >
                  Replace Photo
                </button>
                <button type="button" onClick={handleRemovePhoto} className="btn btn-danger btn-sm">
                  Remove Photo
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Submit Error Banner */}
        {submitErrorMessage && (
          <div className="submit-error-banner" role="alert">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{submitErrorMessage}</span>
          </div>
        )}

        {/* Form Actions: Submit Inspection */}
        <div className="form-actions">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitStatus === 'submitting'}
            className={`btn btn-primary btn-submit ${submitStatus === 'queued' ? 'btn-submitted' : ''}`}
          >
            {submitStatus === 'submitting' ? (
              <>
                <span className="btn-spinner" aria-hidden="true" />
                Submitting Inspection...
              </>
            ) : submitStatus === 'queued' ? (
              <>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Inspection Queued (Pending Sync)
              </>
            ) : (
              'Submit Inspection'
            )}
          </button>

          {submitStatus === 'queued' && (
            <button
              type="button"
              onClick={handleStartNewInspection}
              className="btn btn-secondary btn-new-inspection"
            >
              Start New Inspection
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
