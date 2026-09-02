import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  CampusZone,
  ConditionRating,
  FailureDisposition,
  IsoTimestamp,
  PhotoAttachment,
  SurveyCategory,
  SyncStatus,
  Uuid,
} from '../domain/models.ts';

export const SURVEY_DATABASE_NAME = 'vku-field-survey';
export const SURVEY_DATABASE_VERSION = 1;

export const DRAFT_STORE = 'drafts';
export const SUBMISSION_STORE = 'submission_queue';

export const DRAFT_LAST_MODIFIED_INDEX = 'by-last-modified';
export const SUBMISSION_TIMESTAMP_INDEX = 'by-timestamp';
export const SUBMISSION_STATUS_INDEX = 'by-sync-status';

export interface StoredInspectionSnapshot {
  readonly zone?: CampusZone | null;
  readonly building: string;
  readonly roomNumber: string;
  readonly category: SurveyCategory;
  readonly conditionRating: ConditionRating;
  readonly defectNotes: string;
  readonly photo: PhotoAttachment | null;
  readonly floor?: string;
}

export interface StoredSubmissionRecord {
  readonly id: Uuid;
  readonly timestamp: IsoTimestamp;
  readonly surveyData: StoredInspectionSnapshot;
  readonly syncStatus: SyncStatus;
  readonly lastErrorMessage?: string;
  readonly failureDisposition?: FailureDisposition;
  readonly claimToken?: string;
  readonly claimedAt?: IsoTimestamp;
}

export interface StoredDraftRecord {
  readonly id: Uuid;
  readonly zone?: CampusZone | null;
  readonly building?: string;
  readonly roomNumber?: string;
  readonly category?: SurveyCategory | null;
  readonly conditionRating?: ConditionRating | null;
  readonly defectNotes?: string;
  readonly photo?: PhotoAttachment | null;
  readonly lastModifiedAt: IsoTimestamp;
  readonly floor?: string;
}

export interface SurveyDatabase extends DBSchema {
  drafts: {
    key: Uuid;
    value: StoredDraftRecord;
    indexes: {
      'by-last-modified': IsoTimestamp;
    };
  };
  submission_queue: {
    key: Uuid;
    value: StoredSubmissionRecord;
    indexes: {
      'by-timestamp': IsoTimestamp;
      'by-sync-status': SyncStatus;
    };
  };
}

export function openSurveyDatabase(
  databaseName = SURVEY_DATABASE_NAME
): Promise<IDBPDatabase<SurveyDatabase>> {
  return openDB<SurveyDatabase>(databaseName, SURVEY_DATABASE_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const drafts = database.createObjectStore(DRAFT_STORE, {
          keyPath: 'id',
        });
        drafts.createIndex(DRAFT_LAST_MODIFIED_INDEX, 'lastModifiedAt');

        const submissions = database.createObjectStore(SUBMISSION_STORE, {
          keyPath: 'id',
        });
        submissions.createIndex(SUBMISSION_TIMESTAMP_INDEX, 'timestamp');
        submissions.createIndex(SUBMISSION_STATUS_INDEX, 'syncStatus');
      }
    },
  });
}
