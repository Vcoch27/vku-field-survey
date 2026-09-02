import type { InspectionDraft, InspectionSnapshot, SurveySubmission } from './models.ts';
import type { Clock, SurveyStoragePort, UuidGenerator } from './ports.ts';
import { isCampusZone, isConditionRating, isSurveyCategory } from './validation.ts';
import { createPendingSubmission } from './createSubmission.ts';

export interface SubmitSurveyDependencies {
  readonly storage: Pick<SurveyStoragePort, 'enqueueSubmissionAndClearDraft'>;
  readonly uuidGenerator: UuidGenerator;
  readonly clock: Clock;
}

export interface SubmitSurveyValidationErrors {
  readonly zone?: string;
  readonly category?: string;
  readonly conditionRating?: string;
}

export type SubmitSurveyResult =
  | {
      readonly success: true;
      readonly submission: SurveySubmission;
    }
  | {
      readonly success: false;
      readonly errorType: 'VALIDATION_ERROR';
      readonly validationErrors: SubmitSurveyValidationErrors;
    }
  | {
      readonly success: false;
      readonly errorType: 'STORAGE_ERROR';
      readonly message: string;
    };

/**
 * Validates the draft (including required CampusZone), creates an immutable
 * SurveySubmission snapshot, assigns PENDING_SYNC status, and atomically enqueues it.
 */
export async function submitSurveyOffline(
  draft: InspectionDraft,
  dependencies: SubmitSurveyDependencies
): Promise<SubmitSurveyResult> {
  const validationErrors: { zone?: string; category?: string; conditionRating?: string } = {};

  if (!isCampusZone(draft.zone)) {
    validationErrors.zone = 'Please select a campus zone (Khu Hàn or Khu Việt).';
  }

  if (!isSurveyCategory(draft.category)) {
    validationErrors.category = 'Please select a valid equipment category.';
  }

  if (!isConditionRating(draft.conditionRating)) {
    validationErrors.conditionRating = 'Please select a condition rating from 1 to 5.';
  }

  if (
    validationErrors.zone !== undefined ||
    validationErrors.category !== undefined ||
    validationErrors.conditionRating !== undefined
  ) {
    return {
      success: false,
      errorType: 'VALIDATION_ERROR',
      validationErrors,
    };
  }

  // Guaranteed valid by guards above
  const zone = draft.zone!;
  const category = draft.category!;
  const conditionRating = draft.conditionRating!;

  // Create an immutable snapshot of the survey data (no floor property)
  const snapshot: InspectionSnapshot = {
    zone,
    building: draft.building,
    roomNumber: draft.roomNumber,
    defectNotes: draft.defectNotes,
    photo: draft.photo
      ? {
          id: draft.photo.id,
          displayUri: draft.photo.displayUri,
          binaryData: draft.photo.binaryData,
          capturedAt: draft.photo.capturedAt,
        }
      : null,
    category,
    conditionRating,
  };

  const submission = createPendingSubmission(snapshot, {
    uuidGenerator: dependencies.uuidGenerator,
    clock: dependencies.clock,
  });

  try {
    // Atomically enqueue the submission and clear the active draft in one transaction
    await dependencies.storage.enqueueSubmissionAndClearDraft(submission, draft.id);

    return {
      success: true,
      submission,
    };
  } catch (storageErr) {
    const message =
      storageErr instanceof Error
        ? storageErr.message
        : 'Failed to enqueue submission in persistent storage.';
    return {
      success: false,
      errorType: 'STORAGE_ERROR',
      message,
    };
  }
}
