// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider } from '../../app/router.tsx';
import { RecordDetailsPage } from './RecordDetailsPage.tsx';
import type { SurveySubmission } from '../../domain/models.ts';
import type { SurveyStoragePort } from '../../domain/ports.ts';

describe('RecordDetailsPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders full read-only survey details and manages photo preview', async () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const mockRecord: SurveySubmission = {
      id: 'sub-details-1',
      timestamp: '2026-09-03T09:00:00.000Z',
      syncStatus: 'SYNCED',
      surveyData: {
        zone: 'V',
        building: 'D1',
        roomNumber: '201',
        category: 'Projector',
        conditionRating: 3,
        defectNotes: 'Bulb lumen output too low',
        photo: {
          id: 'photo-1',
          binaryData: new Blob(['fake-img']),
          capturedAt: '2026-09-03T08:59:00.000Z',
        },
      },
    };

    const mockStorage = {
      getSubmissionById: vi.fn().mockResolvedValue(mockRecord),
    } as unknown as SurveyStoragePort;

    const { unmount } = render(
      <RouterProvider initialPath="/records/sub-details-1">
        <RecordDetailsPage recordId="sub-details-1" storage={mockStorage} />
      </RouterProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('V.D1-201').length).toBeGreaterThan(0);
      expect(screen.getByText('Bulb lumen output too low')).toBeTruthy();
      expect(screen.getByAltText('Photo evidence for inspection V.D1-201')).toBeTruthy();
    });

    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);

    unmount();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock-url');

    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
  });

  it('renders not found state when record does not exist', async () => {
    const mockStorage = {
      getSubmissionById: vi.fn().mockResolvedValue(null),
    } as unknown as SurveyStoragePort;

    render(
      <RouterProvider initialPath="/records/missing-id">
        <RecordDetailsPage recordId="missing-id" storage={mockStorage} />
      </RouterProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Record not found')).toBeTruthy();
    });
  });
});
