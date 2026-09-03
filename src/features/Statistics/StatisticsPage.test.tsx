// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider } from '../../app/router.tsx';
import { StatisticsPage } from './StatisticsPage.tsx';
import type { SurveySubmission } from '../../domain/models.ts';
import type { SurveyStoragePort } from '../../domain/ports.ts';

describe('StatisticsPage', () => {
  it('calculates metrics and distributions from real submissions', async () => {
    const mockRecords: SurveySubmission[] = [
      {
        id: '1',
        timestamp: '2026-09-03T01:00:00.000Z',
        syncStatus: 'SYNCED',
        surveyData: {
          zone: 'K',
          building: 'A',
          roomNumber: '101',
          category: 'Hardware',
          conditionRating: 5,
          defectNotes: '',
          photo: null,
        },
      },
      {
        id: '2',
        timestamp: '2026-09-03T02:00:00.000Z',
        syncStatus: 'PENDING_SYNC',
        surveyData: {
          zone: 'V',
          building: 'B',
          roomNumber: '202',
          category: 'Projector',
          conditionRating: 3,
          defectNotes: '',
          photo: null,
        },
      },
    ];

    const mockStorage = {
      getAllSubmissions: vi.fn().mockResolvedValue(mockRecords),
    } as unknown as SurveyStoragePort;

    render(
      <RouterProvider initialPath="/statistics">
        <StatisticsPage storage={mockStorage} />
      </RouterProvider>
    );

    await waitFor(() => {
      // Total inspections: 2
      expect(screen.getByText('2')).toBeTruthy();
      // Average: (5 + 3) / 2 = 4.0
      expect(screen.getByText('4.0')).toBeTruthy();
      // Campus zones
      expect(screen.getByText(/Khu Hàn/i)).toBeTruthy();
      expect(screen.getByText(/Khu Việt/i)).toBeTruthy();
    });
  });

  it('renders clean empty state when no submissions are stored', async () => {
    const mockStorage = {
      getAllSubmissions: vi.fn().mockResolvedValue([]),
    } as unknown as SurveyStoragePort;

    render(
      <RouterProvider initialPath="/statistics">
        <StatisticsPage storage={mockStorage} />
      </RouterProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No inspection statistics yet')).toBeTruthy();
    });
  });
});
