import type {
  ClaimedSubmission,
  FailureDisposition,
  InspectionDraft,
  IsoTimestamp,
  PhotoAttachment,
  SubmissionOutcome,
  SurveySubmission,
  SyncStatus,
  Uuid,
} from './models.ts';

export interface SurveyStoragePort {
  saveDraft(draft: InspectionDraft): Promise<void>;
  getDraft(draftId?: Uuid): Promise<InspectionDraft | null>;
  clearDraft(draftId: Uuid): Promise<void>;
  enqueueSubmission(submission: SurveySubmission): Promise<void>;
  enqueueSubmissionAndClearDraft(submission: SurveySubmission, draftId?: Uuid): Promise<void>;
  getPendingSubmissions(): Promise<readonly SurveySubmission[]>;
  atomicClaimNext(options?: {
    readonly excludeIds?: ReadonlySet<Uuid>;
  }): Promise<ClaimedSubmission | null>;
  recoverStaleClaims(staleTimeoutMs: number): Promise<number>;
  updateSubmissionStatus(
    submissionId: Uuid,
    status: SyncStatus,
    errorMessage?: string,
    failureDisposition?: FailureDisposition
  ): Promise<void>;
  markSubmissionSynced(submissionId: Uuid, acknowledgementDetails?: unknown): Promise<void>;
}

export interface CameraPort {
  capturePhoto(): Promise<PhotoAttachment | null>;
}

export interface NetworkStatus {
  readonly isConnected: boolean;
}

export type Unsubscribe = () => void;

export interface NetworkStatusPort {
  getNetworkStatus(): Promise<NetworkStatus>;
  subscribe(listener: (status: NetworkStatus) => void): Unsubscribe;
}

export interface SubmissionGateway {
  sendSubmission(submission: SurveySubmission): Promise<SubmissionOutcome>;
}

export interface UuidGenerator {
  generateUuid(): Uuid;
}

export interface Clock {
  now(): IsoTimestamp;
}
