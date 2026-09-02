export const SURVEY_CATEGORIES = [
  'Hardware',
  'Projector',
  'AC',
  'Electrical',
  'Furniture',
] as const;

export type SurveyCategory = (typeof SURVEY_CATEGORIES)[number];

export const CONDITION_RATINGS = [1, 2, 3, 4, 5] as const;

export type ConditionRating = (typeof CONDITION_RATINGS)[number];

export type SyncStatus = 'PENDING_SYNC' | 'SYNCING' | 'SYNCED' | 'SYNC_FAILED';

export type Uuid = string;
export type IsoTimestamp = string;

export interface PhotoAttachment {
  readonly id: Uuid;
  readonly displayUri?: string;
  readonly binaryData: Blob;
  readonly capturedAt: IsoTimestamp;
}

export type CampusZone = 'K' | 'V';

interface InspectionFields {
  readonly zone: CampusZone | null;
  readonly building: string;
  readonly roomNumber: string;
  readonly defectNotes: string;
  readonly photo: PhotoAttachment | null;
}

export interface InspectionDraft extends InspectionFields {
  readonly id: Uuid;
  readonly category: SurveyCategory | null;
  readonly conditionRating: ConditionRating | null;
  readonly lastModifiedAt: IsoTimestamp;
}

export interface InspectionSnapshot {
  readonly zone: CampusZone;
  readonly building: string;
  readonly roomNumber: string;
  readonly category: SurveyCategory;
  readonly conditionRating: ConditionRating;
  readonly defectNotes: string;
  readonly photo: PhotoAttachment | null;
}

/**
 * Derives the canonical VKU full room identifier: Zone.Building-RoomNumber (e.g. K.A-205, V.A-505).
 * Returns null if any required component is missing or blank.
 * This identifier is dynamically formatted and not persisted redundantly.
 */
export function formatFullRoomIdentifier(location: {
  readonly zone: CampusZone | null;
  readonly building: string;
  readonly roomNumber: string;
}): string | null {
  if (!location.zone) {
    return null;
  }
  const trimmedBuilding = location.building.trim();
  const trimmedRoom = location.roomNumber.trim();
  if (!trimmedBuilding || !trimmedRoom) {
    return null;
  }
  return `${location.zone}.${trimmedBuilding}-${trimmedRoom}`;
}

export type FailureDisposition = 'RETRYABLE' | 'REQUIRES_ATTENTION';

export interface SurveySubmission {
  readonly id: Uuid;
  readonly timestamp: IsoTimestamp;
  readonly surveyData: InspectionSnapshot;
  readonly syncStatus: SyncStatus;
  readonly lastErrorMessage?: string;
  readonly failureDisposition?: FailureDisposition;
}

export interface ClaimedSubmission {
  readonly submission: SurveySubmission;
  readonly claimToken: string;
  readonly claimedAt: IsoTimestamp;
}

export type SubmissionOutcome =
  | {
      readonly outcome: 'ACKNOWLEDGED';
      readonly acknowledgementToken?: string;
    }
  | {
      readonly outcome: 'RETRYABLE_FAILURE';
      readonly reason: string;
    }
  | {
      readonly outcome: 'REQUIRES_ATTENTION';
      readonly reason: string;
    };
