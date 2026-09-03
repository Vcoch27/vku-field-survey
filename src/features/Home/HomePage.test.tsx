// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider } from '../../app/router.tsx';
import { HomePage } from './HomePage.tsx';
import type { SurveySubmission } from '../../domain/models.ts';
import type { SurveyStoragePort } from '../../domain/ports.ts';

function createMockSubmission(overrides?: Partial<SurveySubmission>): SurveySubmission {
  return {
    id: 'sub-1',
    timestamp: '2026-09-03T08:00:00.000Z',
    syncStatus: 'PENDING_SYNC',
    surveyData: {
      zone: 'K',
      building: 'A',
      roomNumber: '205',
      category: 'Hardware',
      conditionRating: 4,
      defectNotes: 'Keyboard broken',
      photo: null,
    },
    ...overrides,
  };
}

describe('HomePage', () => {
  afterEach(cleanup);
  it('renders real metrics and recent records from storage', async () => {
    const mockRecords: SurveySubmission[] = [
      createMockSubmission({ id: 'sub-1', syncStatus: 'PENDING_SYNC' }),
      createMockSubmission({ id: 'sub-2', syncStatus: 'SYNCED', surveyData: { ...createMockSubmission().surveyData, roomNumber: '206' } }),
      createMockSubmission({ id: 'sub-3', syncStatus: 'SYNC_FAILED', surveyData: { ...createMockSubmission().surveyData, roomNumber: '207' } }),
    ];

    const mockStorage = {
      getAllSubmissions: vi.fn().mockResolvedValue(mockRecords),
      getDraft: vi.fn().mockResolvedValue(null),
    } as unknown as SurveyStoragePort;

    render(
      <RouterProvider initialPath="/">
        <HomePage storage={mockStorage} isConnected={true} />
      </RouterProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Recent activity')).toBeTruthy();
      expect(document.querySelector('a[href="/records?status=FAILED"]')).toBeTruthy();
      expect(document.querySelector('a[href="/records?status=PENDING"]')).toBeTruthy();
    });

    expect(screen.getByText('K.A-205')).toBeTruthy();
    expect(screen.getByText('K.A-206')).toBeTruthy();
  });

  it('renders friendly empty state when no inspections exist', async () => {
    const mockStorage = {
      getAllSubmissions: vi.fn().mockResolvedValue([]),
      getDraft: vi.fn().mockResolvedValue(null),
    } as unknown as SurveyStoragePort;

    render(
      <RouterProvider initialPath="/">
        <HomePage storage={mockStorage} isConnected={true} />
      </RouterProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No inspections recorded yet')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Start New Survey' })).toBeTruthy();
    });
  });

  it('shows a meaningful unfinished draft separately from submitted records', async () => {
    const mockStorage = {
      getAllSubmissions: vi.fn().mockResolvedValue([]),
      getDraft: vi.fn().mockResolvedValue({
        id: 'draft-1', zone: 'V', building: 'A', roomNumber: '205', category: 'Projector',
        conditionRating: 3, defectNotes: '', photo: null, lastModifiedAt: new Date().toISOString(),
      }),
    } as unknown as SurveyStoragePort;
    render(<RouterProvider initialPath="/"><HomePage storage={mockStorage} isConnected /></RouterProvider>);
    await waitFor(() => expect(screen.getByText('Unfinished inspection')).toBeTruthy());
    expect(screen.getByText('V.A-205')).toBeTruthy();
    expect(screen.getByText('Resume')).toBeTruthy();
    expect(screen.queryByText('Pending sync')).toBeNull();
  });
});
