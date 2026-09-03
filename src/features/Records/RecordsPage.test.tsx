// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from '../../app/router.tsx';
import { RecordsPage } from './RecordsPage.tsx';
import type { SurveySubmission } from '../../domain/models.ts';
import type { SurveyStoragePort } from '../../domain/ports.ts';
import type { SyncOrchestrator } from '../../domain/syncOrchestrator.ts';

function submission(overrides: Partial<SurveySubmission> = {}): SurveySubmission {
  return {
    id: 'rec-1', timestamp: '2026-09-03T08:30:00.000Z', syncStatus: 'PENDING_SYNC',
    surveyData: { zone: 'K', building: 'A', roomNumber: '205', category: 'Hardware', conditionRating: 4, defectNotes: 'Screen flickering', photo: null },
    ...overrides,
  };
}

const records: readonly SurveySubmission[] = [
  submission({ id: 'older', timestamp: '2026-09-01T08:00:00.000Z', surveyData: { ...submission().surveyData, roomNumber: '101', conditionRating: 2 } }),
  submission({ id: 'projector', timestamp: '2026-09-02T08:00:00.000Z', syncStatus: 'SYNCED', surveyData: { ...submission().surveyData, zone: 'V', roomNumber: '202', category: 'Projector' } }),
  submission({ id: 'failed', timestamp: '2026-09-03T08:00:00.000Z', syncStatus: 'SYNC_FAILED', failureDisposition: 'RETRYABLE', lastErrorMessage: 'Timeout', surveyData: { ...submission().surveyData, zone: 'V', roomNumber: '303', category: 'Projector' } }),
  submission({ id: 'newest', timestamp: '2026-09-03T10:00:00.000Z', syncStatus: 'SYNCING', surveyData: { ...submission().surveyData, zone: 'V', roomNumber: '404', category: 'Furniture' } }),
];

function storageFor(items = records) {
  return {
    getAllSubmissions: vi.fn().mockResolvedValue(items),
    getSubmissionById: vi.fn(async (id: string) => items.find((item) => item.id === id) ?? null),
    resetSubmissionToPending: vi.fn().mockResolvedValue(true),
    deleteSubmission: vi.fn().mockResolvedValue(true),
  } as unknown as SurveyStoragePort;
}

describe('RecordsPage', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('uses newest-first by default and supports oldest-first', async () => {
    const user = userEvent.setup();
    render(<RouterProvider initialPath="/records"><RecordsPage storage={storageFor()} /></RouterProvider>);
    await waitFor(() => expect(screen.getByText('V.A-404')).toBeTruthy());
    let links = screen.getAllByRole('link', { name: /Open inspection/ });
    expect(links[0].getAttribute('href')).toBe('/records/newest');
    await user.selectOptions(screen.getByLabelText('Sort records by time'), 'oldest');
    links = screen.getAllByRole('link', { name: /Open inspection/ });
    expect(links[0].getAttribute('href')).toBe('/records/older');
  });

  it('composes status, zone, category, and sort filters and clears them', async () => {
    const user = userEvent.setup();
    render(<RouterProvider initialPath="/records"><RecordsPage storage={storageFor()} /></RouterProvider>);
    await waitFor(() => expect(screen.getByText('V.A-303')).toBeTruthy());
    await user.click(screen.getByRole('button', { name: /Failed1/ }));
    await user.selectOptions(screen.getByLabelText('Filter by campus zone'), 'V');
    await user.selectOptions(screen.getByLabelText('Filter by category'), 'Projector');
    expect(screen.getByText('V.A-303')).toBeTruthy();
    expect(screen.queryByText('V.A-202')).toBeNull();
    expect(screen.getByText(/Zone V · Projector · Failed/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getAllByRole('link', { name: /Open inspection/ })).toHaveLength(4);
  });

  it('honors explicit drill-down query state', async () => {
    render(<RouterProvider initialPath="/records?zone=V&category=Projector&status=SYNCED"><RecordsPage storage={storageFor()} initialQuery="zone=V&category=Projector&status=SYNCED" /></RouterProvider>);
    await waitFor(() => expect(screen.getByText('V.A-202')).toBeTruthy());
    expect(screen.queryByText('V.A-303')).toBeNull();
    expect(screen.getByText(/Zone V · Projector · Synced/)).toBeTruthy();
  });

  it('makes the whole card the details entry point and keeps actions in overflow', async () => {
    render(<RouterProvider initialPath="/records"><RecordsPage storage={storageFor([records[1]])} /></RouterProvider>);
    await waitFor(() => expect(screen.getByRole('link', { name: /Open inspection V.A-202/ })).toBeTruthy());
    expect(screen.queryByText('Details')).toBeNull();
    expect(document.querySelector('.btn-action-delete')).toBeNull();
    expect(screen.getByLabelText('More actions for V.A-202')).toBeTruthy();
    expect(screen.queryByText('Photo')).toBeNull();
  });

  it('retries failed sync from the overflow action', async () => {
    const user = userEvent.setup();
    const storage = storageFor([records[2]]);
    const orchestrator = { synchronize: vi.fn().mockResolvedValue({ processedCount: 1, syncedCount: 1, failedCount: 0, recoveredStaleCount: 0, errors: [] }) } as unknown as SyncOrchestrator;
    render(<RouterProvider initialPath="/records"><RecordsPage storage={storage} orchestrator={orchestrator} /></RouterProvider>);
    await waitFor(() => expect(screen.getByText('V.A-303')).toBeTruthy());
    const article = screen.getByText('V.A-303').closest('article');
    if (!article) throw new Error('record article missing');
    await user.click(within(article).getByLabelText('More actions for V.A-303'));
    await user.click(within(article).getByRole('button', { name: 'Retry sync' }));
    expect(storage.resetSubmissionToPending).toHaveBeenCalledWith('failed');
    expect(orchestrator.synchronize).toHaveBeenCalledOnce();
  });

  it('confirms synced deletion with local-only semantics', async () => {
    const user = userEvent.setup();
    const storage = storageFor([records[1]]);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<RouterProvider initialPath="/records"><RecordsPage storage={storage} /></RouterProvider>);
    await waitFor(() => expect(screen.getByText('V.A-202')).toBeTruthy());
    const article = screen.getByText('V.A-202').closest('article');
    if (!article) throw new Error('record article missing');
    await user.click(within(article).getByLabelText('More actions for V.A-202'));
    await user.click(within(article).getByRole('button', { name: 'Delete local copy' }));
    expect(confirm.mock.calls[0][0]).toContain('Google Sheet entry will remain');
    expect(storage.deleteSubmission).toHaveBeenCalledWith('projector');
  });
});
