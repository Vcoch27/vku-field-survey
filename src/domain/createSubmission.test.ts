import { describe, expect, it, vi } from 'vitest';
import type { InspectionSnapshot } from './models.ts';
import { createPendingSubmission } from './createSubmission.ts';

describe('createPendingSubmission', () => {
  it('uses injected identity and starts in PENDING_SYNC', () => {
    const surveyData: InspectionSnapshot = {
      zone: 'K',
      building: 'Building A',
      roomNumber: '201',
      category: 'Hardware',
      conditionRating: 4,
      defectNotes: 'Test fixture only',
      photo: null,
    };
    const generateUuid = vi.fn(() => '550e8400-e29b-41d4-a716-446655440000');
    const now = vi.fn(() => '2026-09-02T15:00:00.000Z');

    const submission = createPendingSubmission(surveyData, {
      uuidGenerator: { generateUuid },
      clock: { now },
    });

    expect(submission).toEqual({
      id: '550e8400-e29b-41d4-a716-446655440000',
      timestamp: '2026-09-02T15:00:00.000Z',
      surveyData,
      syncStatus: 'PENDING_SYNC',
    });
    expect(generateUuid).toHaveBeenCalledOnce();
    expect(now).toHaveBeenCalledOnce();
  });
});
