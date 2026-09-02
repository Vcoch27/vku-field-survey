import type { InspectionSnapshot, SurveySubmission } from './models.ts'
import type { Clock, UuidGenerator } from './ports.ts'

export interface CreateSubmissionDependencies {
  readonly uuidGenerator: UuidGenerator
  readonly clock: Clock
}

export function createPendingSubmission(
  surveyData: InspectionSnapshot,
  dependencies: CreateSubmissionDependencies,
): SurveySubmission {
  return {
    id: dependencies.uuidGenerator.generateUuid(),
    timestamp: dependencies.clock.now(),
    surveyData,
    syncStatus: 'PENDING_SYNC',
  }
}
