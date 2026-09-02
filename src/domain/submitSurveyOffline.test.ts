import { describe, expect, it, vi } from 'vitest';
import type { InspectionDraft, PhotoAttachment } from './models.ts';
import { submitSurveyOffline } from './submitSurveyOffline.ts';

describe('submitSurveyOffline', () => {
  const mockUuid = '11112222-3333-4444-5555-666677778888';
  const mockTimestamp = '2026-09-02T16:00:00.000Z';

  const defaultDependencies = {
    uuidGenerator: { generateUuid: vi.fn(() => mockUuid) },
    clock: { now: vi.fn(() => mockTimestamp) },
  };

  it('valid draft creates an immutable submission with PENDING_SYNC status and calls atomic enqueueSubmissionAndClearDraft', async () => {
    const draft: InspectionDraft = {
      id: 'draft-uuid-1',
      zone: 'K',
      building: 'Building A',
      roomNumber: 'A301',
      category: 'Hardware',
      conditionRating: 4,
      defectNotes: 'Loose cable',
      photo: null,
      lastModifiedAt: '2026-09-02T15:55:00.000Z',
    };

    const storage = {
      enqueueSubmissionAndClearDraft: vi.fn().mockResolvedValue(undefined),
    };

    const result = await submitSurveyOffline(draft, {
      ...defaultDependencies,
      storage,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.submission.id).toBe(mockUuid);
    expect(result.submission.timestamp).toBe(mockTimestamp);
    expect(result.submission.syncStatus).toBe('PENDING_SYNC');
    expect(result.submission.surveyData.zone).toBe('K');
    expect(result.submission.surveyData).toEqual({
      zone: 'K',
      building: 'Building A',
      roomNumber: 'A301',
      category: 'Hardware',
      conditionRating: 4,
      defectNotes: 'Loose cable',
      photo: null,
    });
    // Explicit invariant: snapshot contains no floor property
    expect('floor' in result.submission.surveyData).toBe(false);

    expect(storage.enqueueSubmissionAndClearDraft).toHaveBeenCalledWith(
      result.submission,
      'draft-uuid-1'
    );
  });

  it('zone is required for offline submission and returns validation error if null or invalid', async () => {
    const draftWithoutZone: InspectionDraft = {
      id: 'draft-no-zone',
      zone: null,
      building: 'Building A',
      roomNumber: 'A301',
      category: 'Hardware',
      conditionRating: 4,
      defectNotes: '',
      photo: null,
      lastModifiedAt: '2026-09-02T15:55:00.000Z',
    };

    const storage = {
      enqueueSubmissionAndClearDraft: vi.fn().mockResolvedValue(undefined),
    };

    const result = await submitSurveyOffline(draftWithoutZone, {
      ...defaultDependencies,
      storage,
    });

    expect(result.success).toBe(false);
    if (result.success || result.errorType !== 'VALIDATION_ERROR') return;

    expect(result.errorType).toBe('VALIDATION_ERROR');
    expect(result.validationErrors.zone).toBe('Please select a campus zone (Khu Hàn or Khu Việt).');
    expect(storage.enqueueSubmissionAndClearDraft).not.toHaveBeenCalled();
  });

  it('snapshot is immutable and does not mutate if draft fields are mutated later', async () => {
    const draft: InspectionDraft = {
      id: 'draft-uuid-2',
      zone: 'V',
      building: 'Building B',
      roomNumber: 'B101',
      category: 'Projector',
      conditionRating: 5,
      defectNotes: 'Working well',
      photo: null,
      lastModifiedAt: '2026-09-02T15:55:00.000Z',
    };

    const storage = {
      enqueueSubmissionAndClearDraft: vi.fn().mockResolvedValue(undefined),
    };

    const result = await submitSurveyOffline(draft, {
      ...defaultDependencies,
      storage,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Mutate the original draft object reference
    const mutableRecord = draft as unknown as Record<string, unknown>;
    mutableRecord.building = 'Mutated Building';
    mutableRecord.defectNotes = 'Mutated Notes';
    mutableRecord.zone = 'K';

    expect(result.submission.surveyData.building).toBe('Building B');
    expect(result.submission.surveyData.defectNotes).toBe('Working well');
    expect(result.submission.surveyData.zone).toBe('V');
  });

  it('preserves photo Blob attachment when present', async () => {
    const photoBlob = new Blob(['photo-binary'], { type: 'image/jpeg' });
    const photo: PhotoAttachment = {
      id: 'photo-1',
      displayUri: 'blob:http://localhost/test',
      binaryData: photoBlob,
      capturedAt: '2026-09-02T15:50:00.000Z',
    };

    const draft: InspectionDraft = {
      id: 'draft-uuid-3',
      zone: 'K',
      building: 'Building C',
      roomNumber: 'C202',
      category: 'AC',
      conditionRating: 2,
      defectNotes: 'Leaking water',
      photo,
      lastModifiedAt: '2026-09-02T15:55:00.000Z',
    };

    const storage = {
      enqueueSubmissionAndClearDraft: vi.fn().mockResolvedValue(undefined),
    };

    const result = await submitSurveyOffline(draft, {
      ...defaultDependencies,
      storage,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.submission.surveyData.photo).not.toBeNull();
    expect(result.submission.surveyData.photo?.id).toBe('photo-1');
    expect(result.submission.surveyData.photo?.binaryData).toBe(photoBlob);
  });

  it('returns validation error if category is missing or invalid', async () => {
    const draft: InspectionDraft = {
      id: 'draft-uuid-4',
      zone: 'K',
      building: 'Building D',
      roomNumber: 'D404',
      category: null,
      conditionRating: 3,
      defectNotes: '',
      photo: null,
      lastModifiedAt: '2026-09-02T15:55:00.000Z',
    };

    const storage = {
      enqueueSubmissionAndClearDraft: vi.fn().mockResolvedValue(undefined),
    };

    const result = await submitSurveyOffline(draft, {
      ...defaultDependencies,
      storage,
    });

    expect(result.success).toBe(false);
    if (result.success || result.errorType !== 'VALIDATION_ERROR') return;

    expect(result.errorType).toBe('VALIDATION_ERROR');
    expect(result.validationErrors.category).toBeDefined();
    expect(storage.enqueueSubmissionAndClearDraft).not.toHaveBeenCalled();
  });

  it('returns validation error if conditionRating is missing or outside 1-5', async () => {
    const draft: InspectionDraft = {
      id: 'draft-uuid-5',
      zone: 'K',
      building: 'Building D',
      roomNumber: 'D404',
      category: 'Electrical',
      conditionRating: null,
      defectNotes: '',
      photo: null,
      lastModifiedAt: '2026-09-02T15:55:00.000Z',
    };

    const storage = {
      enqueueSubmissionAndClearDraft: vi.fn().mockResolvedValue(undefined),
    };

    const result = await submitSurveyOffline(draft, {
      ...defaultDependencies,
      storage,
    });

    expect(result.success).toBe(false);
    if (result.success || result.errorType !== 'VALIDATION_ERROR') return;

    expect(result.errorType).toBe('VALIDATION_ERROR');
    expect(result.validationErrors.conditionRating).toBeDefined();
    expect(storage.enqueueSubmissionAndClearDraft).not.toHaveBeenCalled();
  });

  it('handles storage failure without throwing and returns typed error', async () => {
    const draft: InspectionDraft = {
      id: 'draft-uuid-6',
      zone: 'K',
      building: 'Building E',
      roomNumber: 'E101',
      category: 'Furniture',
      conditionRating: 1,
      defectNotes: 'Broken chair',
      photo: null,
      lastModifiedAt: '2026-09-02T15:55:00.000Z',
    };

    const storage = {
      enqueueSubmissionAndClearDraft: vi.fn().mockRejectedValue(new Error('Disk full')),
    };

    const result = await submitSurveyOffline(draft, {
      ...defaultDependencies,
      storage,
    });

    expect(result.success).toBe(false);
    if (result.success || result.errorType !== 'STORAGE_ERROR') return;

    expect(result.errorType).toBe('STORAGE_ERROR');
    expect(result.message).toBe('Disk full');
  });
});
