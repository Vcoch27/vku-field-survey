// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from '../../app/router.tsx';
import { RecordsPage } from './RecordsPage.tsx';
import type { SurveySubmission } from '../../domain/models.ts';
import type { SurveyStoragePort } from '../../domain/ports.ts';
import type { SyncOrchestrator } from '../../domain/syncOrchestrator.ts';

function createMockSubmission(overrides?: Partial<SurveySubmission>): SurveySubmission {
  return {
    id: 'rec-1',
    timestamp: '2026-09-03T08:30:00.000Z',
    syncStatus: 'PENDING_SYNC',
    surveyData: {
      zone: 'K',
      building: 'A',
      roomNumber: '205',
      category: 'Hardware',
      conditionRating: 4,
      defectNotes: 'Screen flickering',
      photo: null,
    },
    ...overrides,
  };
}

describe('RecordsPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders records list with exact tab counts and filters by tab', async () => {
    const user = userEvent.setup();
    const mockRecords: SurveySubmission[] = [
      createMockSubmission({ id: 'rec-pending', syncStatus: 'PENDING_SYNC' }),
      createMockSubmission({
        id: 'rec-synced',
        syncStatus: 'SYNCED',
        surveyData: {
          ...createMockSubmission().surveyData,
          building: 'B',
          roomNumber: '301',
          category: 'Projector',
        },
      }),
      createMockSubmission({
        id: 'rec-failed',
        syncStatus: 'SYNC_FAILED',
        surveyData: {
          ...createMockSubmission().surveyData,
          building: 'C',
          roomNumber: '101',
          category: 'AC',
        },
      }),
    ];

    const mockStorage = {
      getAllSubmissions: vi.fn().mockResolvedValue(mockRecords),
    } as unknown as SurveyStoragePort;

    render(
      <RouterProvider initialPath="/records">
        <RecordsPage storage={mockStorage} />
      </RouterProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /All \(3\)/i })).toBeTruthy();
      expect(screen.getByRole('tab', { name: /Pending \(1\)/i })).toBeTruthy();
      expect(screen.getByRole('tab', { name: /Synced \(1\)/i })).toBeTruthy();
      expect(screen.getByRole('tab', { name: /Failed \(1\)/i })).toBeTruthy();
    });

    // Click Pending tab
    await user.click(screen.getByRole('tab', { name: /Pending/i }));
    expect(screen.getByText('K.A-205')).toBeTruthy();
    expect(screen.queryByText('K.B-301')).toBeNull();
    expect(screen.queryByText('K.C-101')).toBeNull();

    // Click Failed tab
    await user.click(screen.getByRole('tab', { name: /Failed/i }));
    expect(screen.queryByText('K.A-205')).toBeNull();
    expect(screen.queryByText('K.B-301')).toBeNull();
    expect(screen.getByText('K.C-101')).toBeTruthy();
  });

  it('filters records by category and sorts by timestamp', async () => {
    const user = userEvent.setup();
    const mockRecords: SurveySubmission[] = [
      createMockSubmission({
        id: 'rec-older',
        timestamp: '2026-09-01T08:00:00.000Z',
        surveyData: { ...createMockSubmission().surveyData, category: 'Hardware', roomNumber: '101' },
      }),
      createMockSubmission({
        id: 'rec-newer',
        timestamp: '2026-09-03T10:00:00.000Z',
        surveyData: { ...createMockSubmission().surveyData, category: 'Hardware', roomNumber: '999' },
      }),
      createMockSubmission({
        id: 'rec-proj',
        timestamp: '2026-09-02T09:00:00.000Z',
        surveyData: { ...createMockSubmission().surveyData, category: 'Projector', roomNumber: '555' },
      }),
    ];

    const mockStorage = {
      getAllSubmissions: vi.fn().mockResolvedValue(mockRecords),
    } as unknown as SurveyStoragePort;

    render(
      <RouterProvider initialPath="/records">
        <RecordsPage storage={mockStorage} />
      </RouterProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('K.A-101')).toBeTruthy();
      expect(screen.getByText('K.A-999')).toBeTruthy();
      expect(screen.getByText('K.A-555')).toBeTruthy();
    });

    // Filter by Category = Projector
    const categorySelect = screen.getByLabelText(/Filter by category/i);
    await user.selectOptions(categorySelect, 'Projector');

    expect(screen.queryByText('K.A-101')).toBeNull();
    expect(screen.queryByText('K.A-999')).toBeNull();
    expect(screen.getByText('K.A-555')).toBeTruthy();

    // Reset Category to All
    await user.selectOptions(categorySelect, 'ALL');

    // Sort: Oldest first
    const sortSelect = screen.getByLabelText(/Sort records by time/i);
    await user.selectOptions(sortSelect, 'oldest');

    const cards = screen.getAllByText(/K\.A-/);
    expect(cards[0].textContent).toBe('K.A-101'); // 2026-09-01
  });

  it('retries a failed submission when user clicks Retry Sync', async () => {
    const user = userEvent.setup();
    const failedRecord = createMockSubmission({
      id: 'failed-1',
      syncStatus: 'SYNC_FAILED',
      failureDisposition: 'RETRYABLE',
      lastErrorMessage: 'Timeout error',
    });

    const mockStorage = {
      getAllSubmissions: vi.fn().mockResolvedValue([failedRecord]),
      getSubmissionById: vi.fn().mockResolvedValue(failedRecord),
      resetSubmissionToPending: vi.fn().mockResolvedValue(true),
    } as unknown as SurveyStoragePort;

    const mockOrchestrator = {
      synchronize: vi.fn().mockResolvedValue({
        processedCount: 1,
        syncedCount: 1,
        failedCount: 0,
        recoveredStaleCount: 0,
        errors: [],
      }),
    } as unknown as SyncOrchestrator;

    render(
      <RouterProvider initialPath="/records">
        <RecordsPage storage={mockStorage} orchestrator={mockOrchestrator} />
      </RouterProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('K.A-205')).toBeTruthy();
      expect(screen.getByRole('button', { name: /Retry synchronization/i })).toBeTruthy();
    });

    const retryBtn = screen.getByRole('button', { name: /Retry synchronization/i });
    await user.click(retryBtn);

    expect(mockStorage.resetSubmissionToPending).toHaveBeenCalledWith('failed-1');
    expect(mockOrchestrator.synchronize).toHaveBeenCalledTimes(1);
  });

  it('deletes a record when user confirms deletion', async () => {
    const user = userEvent.setup();
    const recordToDelete = createMockSubmission({ id: 'to-del-1' });

    const mockStorage = {
      getAllSubmissions: vi.fn().mockResolvedValue([recordToDelete]),
      deleteSubmission: vi.fn().mockResolvedValue(true),
    } as unknown as SurveyStoragePort;

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <RouterProvider initialPath="/records">
        <RecordsPage storage={mockStorage} />
      </RouterProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('K.A-205')).toBeTruthy();
    });

    const deleteBtn = screen.getByRole('button', { name: /Delete record/i });
    await user.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(mockStorage.deleteSubmission).toHaveBeenCalledWith('to-del-1');
  });
});
