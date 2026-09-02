import type { InspectionDraft, Uuid } from './models.ts'
import type { SurveyStoragePort } from './ports.ts'

type DraftReader = Pick<SurveyStoragePort, 'getDraft'>

export function recoverDraft(
  storage: DraftReader,
  draftId?: Uuid,
): Promise<InspectionDraft | null> {
  return storage.getDraft(draftId)
}
