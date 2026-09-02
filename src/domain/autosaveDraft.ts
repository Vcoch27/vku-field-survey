import type { InspectionDraft } from './models.ts'
import type { SurveyStoragePort } from './ports.ts'

type DraftWriter = Pick<SurveyStoragePort, 'saveDraft'>

export function autosaveDraft(
  storage: DraftWriter,
  draft: InspectionDraft,
): Promise<void> {
  return storage.saveDraft(draft)
}
