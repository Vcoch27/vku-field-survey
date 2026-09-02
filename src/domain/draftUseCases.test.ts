import { describe, expect, it, vi } from 'vitest';
import { autosaveDraft } from './autosaveDraft.ts';
import type { InspectionDraft } from './models.ts';
import { recoverDraft } from './recoverDraft.ts';

const draft: InspectionDraft = {
  id: 'draft-id',
  zone: null,
  building: '',
  roomNumber: '',
  category: null,
  conditionRating: null,
  defectNotes: '',
  photo: null,
  lastModifiedAt: '2026-09-02T15:00:00.000Z',
};

describe('draft use-case boundaries', () => {
  it('delegates autosave to the storage port', async () => {
    const saveDraft = vi.fn(async () => undefined);

    await autosaveDraft({ saveDraft }, draft);

    expect(saveDraft).toHaveBeenCalledWith(draft);
  });

  it('recovers a draft through the storage port', async () => {
    const getDraft = vi.fn(async () => draft);

    const recovered = await recoverDraft({ getDraft }, draft.id);

    expect(getDraft).toHaveBeenCalledWith(draft.id);
    expect(recovered).toBe(draft);
  });
});
