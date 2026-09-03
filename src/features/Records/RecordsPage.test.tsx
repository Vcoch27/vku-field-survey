// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from '../../app/router.tsx';
import { RecordsPage } from './RecordsPage.tsx';
import type { SurveySubmission } from '../../domain/models.ts';
import type { SurveyStoragePort } from '../../domain/ports.ts';

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
  it('renders records list and filters by tab', async () => {
    const user = userEvent.setup();
    const mockRecords: SurveySubmission[] = [
      createMockSubmission({ id: 'rec-pending', syncStatus: 'PENDING_SYNC' }),
      createMockSubmission({
        id: 'rec-synced',
        syncStatus: 'SYNCED',
        surveyData: { ...createMockSubmission().surveyData, building: 'B', roomNumber: '301', category: 'Projector' },
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
      expect(screen.getByText('K.A-205')).toBeTruthy();
      expect(screen.getByText('K.B-301')).toBeTruthy();
    });

    // Click Pending tab
    await user.click(screen.getByRole('tab', { name: /Pending/i }));
    expect(screen.getByText('K.A-205')).toBeTruthy();
    expect(screen.queryByText('K.B-301')).toBeNull();

    // Click Synced tab
    await user.click(screen.getByRole('tab', { name: /Synced/i }));
    expect(screen.queryByText('K.A-205')).toBeNull();
    expect(screen.getByText('K.B-301')).toBeTruthy();
  });

  it('filters records by search keyword', async () => {
    const user = userEvent.setup();
    const mockRecords: SurveySubmission[] = [
      createMockSubmission({ id: 'rec-1', surveyData: { ...createMockSubmission().surveyData, category: 'Hardware' } }),
      createMockSubmission({ id: 'rec-2', surveyData: { ...createMockSubmission().surveyData, category: 'Projector', roomNumber: '402' } }),
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
      expect(screen.getByText('K.A-205')).toBeTruthy();
      expect(screen.getByText('K.A-402')).toBeTruthy();
    });

    const searchInput = screen.getByRole('searchbox');
    await user.type(searchInput, 'Projector');

    expect(screen.queryByText('K.A-205')).toBeNull();
    expect(screen.getByText('K.A-402')).toBeTruthy();
  });
});
