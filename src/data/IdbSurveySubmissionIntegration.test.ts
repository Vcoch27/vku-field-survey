import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IdbSurveyStorage } from './IdbSurveyStorage.ts';
import { submitSurveyOffline } from '../domain/submitSurveyOffline.ts';
import type { InspectionDraft, SurveySubmission } from '../domain/models.ts';

describe('IdbSurveySubmissionIntegration (Atomic Offline Submission)', () => {
  let databaseName: string;
  let storage: IdbSurveyStorage;

  beforeEach(() => {
    databaseName = `vku-field-survey-atomic-test-${crypto.randomUUID()}`;
    storage = new IdbSurveyStorage({
      databaseName,
      createClaimMetadata: () => ({
        claimToken: 'test-token',
        claimedAt: '2026-09-02T16:00:00.000Z',
      }),
    });
  });

  afterEach(async () => {
    await storage.close();
    indexedDB.deleteDatabase(databaseName);
  });

  it('atomic transition succeeds: submission is queued and original draft is removed', async () => {
    const draft: InspectionDraft = {
      id: 'draft-atomic-1',
      zone: 'K',
      building: 'Building A',
      roomNumber: '201',
      category: 'Hardware',
      conditionRating: 4,
      defectNotes: 'Loose cable',
      photo: null,
      lastModifiedAt: '2026-09-02T16:00:00.000Z',
    };

    await storage.saveDraft(draft);
    expect(await storage.getDraft(draft.id)).not.toBeNull();

    const uuid = 'sub-atomic-uuid-1';
    const timestamp = '2026-09-02T16:05:00.000Z';

    const result = await submitSurveyOffline(draft, {
      storage,
      uuidGenerator: { generateUuid: () => uuid },
      clock: { now: () => timestamp },
    });

    expect(result.success).toBe(true);

    // 1. Submission exists in submission_queue
    const pending = await storage.getPendingSubmissions();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(uuid);
    expect(pending[0].syncStatus).toBe('PENDING_SYNC');
    expect(pending[0].surveyData.building).toBe('Building A');
    expect(pending[0].surveyData.zone).toBe('K');

    // 2. Draft is completely removed from drafts store
    const remainingDraft = await storage.getDraft(draft.id);
    expect(remainingDraft).toBeNull();
  });

  it('atomic transition fails: submission does not remain partially queued and draft remains available', async () => {
    const existingSubmission: SurveySubmission = {
      id: 'collision-uuid',
      timestamp: '2026-09-02T15:00:00.000Z',
      surveyData: {
        zone: 'V',
        building: 'Old Building',
        roomNumber: '101',
        category: 'Projector',
        conditionRating: 3,
        defectNotes: 'Existing submission',
        photo: null,
      },
      syncStatus: 'PENDING_SYNC',
    };
    await storage.enqueueSubmission(existingSubmission);

    const draft: InspectionDraft = {
      id: 'draft-atomic-2',
      zone: 'K',
      building: 'Building B',
      roomNumber: 'B301',
      category: 'AC',
      conditionRating: 2,
      defectNotes: 'Air conditioner not cooling',
      photo: null,
      lastModifiedAt: '2026-09-02T16:00:00.000Z',
    };
    await storage.saveDraft(draft);

    // Attempt submit with duplicate UUID to trigger IndexedDB ConstraintError
    const result = await submitSurveyOffline(draft, {
      storage,
      uuidGenerator: { generateUuid: () => 'collision-uuid' },
      clock: { now: () => '2026-09-02T16:05:00.000Z' },
    });

    // Operation must report failure
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorType).toBe('STORAGE_ERROR');
    }

    // Submission was NOT partially queued (only the pre-existing submission remains)
    const pending = await storage.getPendingSubmissions();
    expect(pending).toHaveLength(1);
    expect(pending[0].surveyData.building).toBe('Old Building');

    // Draft remains durably available in drafts store
    const retainedDraft = await storage.getDraft(draft.id);
    expect(retainedDraft).not.toBeNull();
    expect(retainedDraft?.building).toBe('Building B');
    expect(retainedDraft?.defectNotes).toBe('Air conditioner not cooling');
  });

  it('retry after a failed atomic transaction produces exactly one queued submission', async () => {
    const existingSubmission: SurveySubmission = {
      id: 'collision-uuid-retry',
      timestamp: '2026-09-02T15:00:00.000Z',
      surveyData: {
        zone: 'K',
        building: 'Existing Place',
        roomNumber: '101',
        category: 'Electrical',
        conditionRating: 5,
        defectNotes: 'Working',
        photo: null,
      },
      syncStatus: 'PENDING_SYNC',
    };
    await storage.enqueueSubmission(existingSubmission);

    const draft: InspectionDraft = {
      id: 'draft-atomic-3',
      zone: 'V',
      building: 'Building C',
      roomNumber: 'C401',
      category: 'Furniture',
      conditionRating: 1,
      defectNotes: 'Broken desk',
      photo: null,
      lastModifiedAt: '2026-09-02T16:00:00.000Z',
    };
    await storage.saveDraft(draft);

    // First attempt fails due to collision
    const failedResult = await submitSurveyOffline(draft, {
      storage,
      uuidGenerator: { generateUuid: () => 'collision-uuid-retry' },
      clock: { now: () => '2026-09-02T16:05:00.000Z' },
    });
    expect(failedResult.success).toBe(false);

    // Retry with a unique UUID
    const retryResult = await submitSurveyOffline(draft, {
      storage,
      uuidGenerator: { generateUuid: () => 'unique-retry-uuid' },
      clock: { now: () => '2026-09-02T16:06:00.000Z' },
    });
    expect(retryResult.success).toBe(true);

    // Verify queue contains existing submission + exactly one newly queued submission
    const pending = await storage.getPendingSubmissions();
    expect(pending).toHaveLength(2);
    expect(pending.map((s) => s.id)).toEqual(['collision-uuid-retry', 'unique-retry-uuid']);

    // Draft is now removed
    expect(await storage.getDraft(draft.id)).toBeNull();
  });

  it('successful queue does not alter queued snapshot when the user later starts and edits a new inspection', async () => {
    const draft: InspectionDraft = {
      id: 'draft-atomic-4',
      zone: 'K',
      building: 'Original Building',
      roomNumber: '101',
      category: 'Hardware',
      conditionRating: 4,
      defectNotes: 'Original defect notes',
      photo: null,
      lastModifiedAt: '2026-09-02T16:00:00.000Z',
    };
    await storage.saveDraft(draft);

    const submissionUuid = 'submission-uuid-original';
    const result = await submitSurveyOffline(draft, {
      storage,
      uuidGenerator: { generateUuid: () => submissionUuid },
      clock: { now: () => '2026-09-02T16:05:00.000Z' },
    });
    expect(result.success).toBe(true);

    // Inspector starts a new inspection and saves it
    const newDraft: InspectionDraft = {
      id: 'draft-atomic-5-new',
      zone: 'V',
      building: 'Completely Different Building',
      roomNumber: '999',
      category: 'AC',
      conditionRating: 1,
      defectNotes: 'Brand new defect notes',
      photo: null,
      lastModifiedAt: '2026-09-02T16:10:00.000Z',
    };
    await storage.saveDraft(newDraft);

    // Verify queued submission snapshot in submission_queue is completely intact
    const [queued] = await storage.getPendingSubmissions();
    expect(queued.id).toBe(submissionUuid);
    expect(queued.surveyData.building).toBe('Original Building');
    expect(queued.surveyData.category).toBe('Hardware');
    expect(queued.surveyData.conditionRating).toBe(4);
    expect(queued.surveyData.defectNotes).toBe('Original defect notes');

    // Verify the new draft is independently saved in drafts store
    const savedNewDraft = await storage.getDraft(newDraft.id);
    expect(savedNewDraft?.building).toBe('Completely Different Building');
  });
});
