import { formatFullRoomIdentifier, type SubmissionOutcome, type SurveySubmission } from '../../domain/models.ts';
import type { SubmissionGateway } from '../../domain/ports.ts';

export interface GoogleSheetsSubmissionGatewayOptions {
  readonly endpointUrl?: string;
  readonly clientToken?: string;
  readonly timeoutMs?: number;
  readonly fetchFn?: typeof fetch;
}

export interface GoogleSheetsSubmissionDto {
  readonly submissionId: string;
  readonly submittedAt: string;
  readonly zone: string;
  readonly building: string;
  readonly roomNumber: string;
  readonly roomIdentifier: string;
  readonly category: string;
  readonly conditionRating: number;
  readonly defectNotes: string;
  readonly photoId: string | null;
  readonly photoCapturedAt: string | null;
  readonly clientToken?: string;
}

interface AppsScriptResponse {
  readonly ok?: boolean;
  readonly acknowledged?: boolean;
  readonly submissionId?: string;
  readonly duplicate?: boolean;
  readonly message?: string;
  readonly error?: {
    readonly code?: string;
    readonly message?: string;
  };
}

export const DEFAULT_SUBMISSION_TIMEOUT_MS = 15_000;

/**
 * Concrete implementation of SubmissionGateway that dispatches
 * survey submissions to a Google Apps Script Web App backing a private Google Sheet.
 */
export class GoogleSheetsSubmissionGateway implements SubmissionGateway {
  private readonly endpointUrl?: string;
  private readonly clientToken?: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options?: GoogleSheetsSubmissionGatewayOptions) {
    this.endpointUrl = options?.endpointUrl?.trim();
    this.clientToken = options?.clientToken?.trim();
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_SUBMISSION_TIMEOUT_MS;
    this.fetchFn = options?.fetchFn ?? fetch.bind(globalThis);
  }

  async sendSubmission(submission: SurveySubmission): Promise<SubmissionOutcome> {
    if (!this.endpointUrl || this.endpointUrl === '') {
      return {
        outcome: 'RETRYABLE_FAILURE',
        reason: 'Google Sheets submission endpoint URL (VITE_SUBMISSION_ENDPOINT) is not configured.',
      };
    }

    const payload = this.mapToDto(submission);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // NOTE on Content-Type for Google Apps Script Web Apps:
      // Sending 'text/plain;charset=utf-8' prevents CORS preflight OPTIONS failures in browsers
      // while allowing Google Apps Script e.postData.contents to parse the exact JSON string.
      const response = await this.fetchFn(this.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        redirect: 'follow',
      });

      if (!response.ok) {
        if (response.status >= 500) {
          return {
            outcome: 'RETRYABLE_FAILURE',
            reason: `Backend server error: HTTP ${response.status}`,
          };
        }
        return {
          outcome: 'REQUIRES_ATTENTION',
          reason: `HTTP ${response.status} from submission endpoint.`,
        };
      }

      let data: AppsScriptResponse;
      try {
        data = (await response.json()) as AppsScriptResponse;
      } catch (jsonErr) {
        return {
          outcome: 'RETRYABLE_FAILURE',
          reason: `Malformed JSON response from submission backend: ${jsonErr instanceof Error ? jsonErr.message : 'Parse error'}`,
        };
      }

      // Valid positive acknowledgement
      if (data.ok === true && data.acknowledged === true) {
        return {
          outcome: 'ACKNOWLEDGED',
          acknowledgementToken: data.submissionId ?? submission.id,
        };
      }

      // Explicit error response from Apps Script
      if (data.ok === false) {
        const errorCode = data.error?.code;
        const errorMessage = data.error?.message ?? 'Backend rejected submission.';

        // Permanent validation failures require human attention
        if (errorCode === 'INVALID_PAYLOAD' || errorCode === 'UNAUTHORIZED') {
          return {
            outcome: 'REQUIRES_ATTENTION',
            reason: `Backend rejection (${errorCode}): ${errorMessage}`,
          };
        }

        // Concurrency lock timeouts, transient sheet errors are retryable
        return {
          outcome: 'RETRYABLE_FAILURE',
          reason: `Backend transient failure (${errorCode ?? 'UNKNOWN'}): ${errorMessage}`,
        };
      }

      // If response lacks acknowledged: true, never assume success
      return {
        outcome: 'RETRYABLE_FAILURE',
        reason: 'Backend response did not contain positive acknowledgement.',
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return {
          outcome: 'RETRYABLE_FAILURE',
          reason: `Submission request timed out after ${this.timeoutMs}ms.`,
        };
      }

      return {
        outcome: 'RETRYABLE_FAILURE',
        reason: `Network dispatch failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Transforms a domain SurveySubmission into the transport DTO.
   * Note: Photo binary Blob is NEVER serialized into the payload.
   * Only lightweight photo metadata (photoId, photoCapturedAt) is included.
   */
  mapToDto(submission: SurveySubmission): GoogleSheetsSubmissionDto {
    const data = submission.surveyData;
    const derivedRoomIdentifier =
      formatFullRoomIdentifier(data) ?? `${data.zone}.${data.building}-${data.roomNumber}`;

    return {
      submissionId: submission.id,
      submittedAt: submission.timestamp,
      zone: data.zone,
      building: data.building,
      roomNumber: data.roomNumber,
      roomIdentifier: derivedRoomIdentifier,
      category: data.category,
      conditionRating: data.conditionRating,
      defectNotes: data.defectNotes,
      photoId: data.photo?.id ?? null,
      photoCapturedAt: data.photo?.capturedAt ?? null,
      ...(this.clientToken ? { clientToken: this.clientToken } : {}),
    };
  }
}
