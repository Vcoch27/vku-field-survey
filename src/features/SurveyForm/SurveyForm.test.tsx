// @vitest-environment jsdom
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SurveyForm } from './SurveyForm';
import type { SurveyStoragePort } from '../../domain/ports';
import type { InspectionDraft } from '../../domain/models';

describe('SurveyForm UI', () => {
  let mockStorage: SurveyStoragePort;

  beforeEach(() => {
    Object.defineProperty(window, 'crypto', {
      value: {
        randomUUID: () => '1234-5678-90ab-cdef',
      },
      configurable: true,
      writable: true,
    });

    mockStorage = {
      saveDraft: vi.fn().mockResolvedValue(undefined),
      getDraft: vi.fn().mockResolvedValue(null), // By default, no draft
      clearDraft: vi.fn().mockResolvedValue(undefined),
      enqueueSubmission: vi.fn().mockResolvedValue(undefined),
      enqueueSubmissionAndClearDraft: vi.fn().mockResolvedValue(undefined),
      getPendingSubmissions: vi.fn().mockResolvedValue([]),
      getAllSubmissions: vi.fn().mockResolvedValue([]),
      getSubmissionById: vi.fn().mockResolvedValue(null),
      atomicClaimNext: vi.fn().mockResolvedValue(null),
      recoverStaleClaims: vi.fn().mockResolvedValue(0),
      updateSubmissionStatus: vi.fn().mockResolvedValue(undefined),
      markSubmissionSynced: vi.fn().mockResolvedValue(undefined),
      deleteSubmission: vi.fn().mockResolvedValue(true),
      resetSubmissionToPending: vi.fn().mockResolvedValue(true),
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('renders required form controls: Zone (K/V), Building, Room Number, and no Floor control', async () => {
    render(<SurveyForm storage={mockStorage} />);

    // Wait for initialization (loading to disappear)
    await screen.findByRole('heading', { name: /Location/i });

    // Zone K and V controls must render
    expect(screen.getByRole('radio', { name: /Khu Hàn/i })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Khu Việt/i })).toBeTruthy();

    // Floor control MUST be absent
    expect(screen.queryByLabelText(/Floor/i)).toBeNull();

    // Building and Room Number inputs exist
    expect(screen.getByLabelText(/Building/i)).toBeTruthy();
    expect(screen.getByLabelText(/Room Number/i)).toBeTruthy();

    // Category and defect notes exist
    expect(screen.getByLabelText(/Category/i)).toBeTruthy();
    expect(screen.getByLabelText(/Defect Notes/i)).toBeTruthy();

    // 5 valid categories + 1 default option
    const categorySelect = screen.getByLabelText(/Category/i);
    expect(categorySelect.childNodes.length).toBe(6);
  });

  it('rating interaction produces 1-5 value and triggers autosave', async () => {
    const user = userEvent.setup();
    const { container } = render(<SurveyForm storage={mockStorage} />);

    await screen.findByRole('heading', { name: /Location/i });

    // Find star 4 (index 3 of 0-4) using conditionRating radio group
    const stars = container.querySelectorAll<HTMLInputElement>('input[name="conditionRating"]');
    expect(stars).toHaveLength(5);

    // Click 4th star
    await user.click(stars[3]);

    // Wait for debounce and verify autosave
    await waitFor(
      () => {
        const calls = vi.mocked(mockStorage.saveDraft).mock.calls;
        const lastCallDraft =
          calls.length > 0 ? (calls[calls.length - 1][0] as InspectionDraft) : null;
        expect(lastCallDraft?.conditionRating).toBe(4);
      },
      { timeout: 1500 }
    );
  });

  it('recovered draft populates fields including zone, and rehydrates room identifier preview', async () => {
    mockStorage.getDraft = vi.fn().mockResolvedValue({
      id: 'existing-id',
      zone: 'K',
      building: 'A',
      roomNumber: '205',
      category: 'Hardware',
      conditionRating: 5,
      defectNotes: 'Test notes',
      photo: null,
      lastModifiedAt: '2026-09-02T10:00:00.000Z',
    });

    const { container } = render(<SurveyForm storage={mockStorage} />);
    await screen.findByRole('heading', { name: /Location/i });

    // Zone K should be checked
    const zoneKRadio = screen.getByRole('radio', { name: /Khu Hàn/i }) as HTMLInputElement;
    expect(zoneKRadio.checked).toBe(true);

    expect((screen.getByLabelText(/Building/i) as HTMLInputElement).value).toBe('A');
    expect((screen.getByLabelText(/Room Number/i) as HTMLInputElement).value).toBe('205');
    expect((screen.getByLabelText(/Defect Notes/i) as HTMLTextAreaElement).value).toBe(
      'Test notes'
    );

    // Room identifier preview badge must display K.A-205
    const badge = screen.getByTestId('room-identifier-badge');
    expect(badge.textContent).toBe('K.A-205');

    const categorySelect = screen.getByLabelText(/Category/i) as HTMLSelectElement;
    expect(categorySelect.value).toBe('Hardware');

    // 5th star should be checked
    const stars = container.querySelectorAll<HTMLInputElement>('input[name="conditionRating"]');
    expect(stars[4].checked).toBe(true);
  });

  it('live room identifier preview updates dynamically as fields are edited', async () => {
    const user = userEvent.setup();
    render(<SurveyForm storage={mockStorage} />);
    await screen.findByRole('heading', { name: /Location/i });

    // Initially incomplete: shows pending text
    expect(screen.getByText(/Select zone and enter building \+ room/i)).toBeTruthy();

    // Select Zone K
    await user.click(screen.getByRole('radio', { name: /Khu Hàn/i }));

    // Type Building D1
    await user.type(screen.getByLabelText(/Building/i), 'D1');

    // Type Room 201
    await user.type(screen.getByLabelText(/Room Number/i), '201');

    // Preview badge now renders K.D1-201
    await waitFor(() => {
      const badge = screen.getByTestId('room-identifier-badge');
      expect(badge.textContent).toBe('K.D1-201');
    });
  });

  it('building remains a flexible text input accepting arbitrary strings', async () => {
    const user = userEvent.setup();
    render(<SurveyForm storage={mockStorage} />);
    await screen.findByRole('heading', { name: /Location/i });

    const buildingInput = screen.getByLabelText(/Building/i) as HTMLInputElement;
    await user.type(buildingInput, 'Center for Software Innovation');

    expect(buildingInput.value).toBe('Center for Software Innovation');
  });

  it('zone selection triggers autosave', async () => {
    const user = userEvent.setup();
    render(<SurveyForm storage={mockStorage} />);
    await screen.findByRole('heading', { name: /Location/i });

    // Select Zone V
    await user.click(screen.getByRole('radio', { name: /Khu Việt/i }));

    // Wait for debounced autosave
    await waitFor(
      () => {
        const calls = vi.mocked(mockStorage.saveDraft).mock.calls;
        const lastCallDraft =
          calls.length > 0 ? (calls[calls.length - 1][0] as InspectionDraft) : null;
        expect(lastCallDraft?.zone).toBe('V');
      },
      { timeout: 1500 }
    );
  });

  it('submit without zone displays validation error and blocks submission', async () => {
    const user = userEvent.setup();
    const { container } = render(<SurveyForm storage={mockStorage} />);
    await screen.findByRole('heading', { name: /Location/i });

    // Select Category and Rating, but leave Zone unselected
    const categorySelect = screen.getByLabelText(/Category/i);
    await user.selectOptions(categorySelect, 'Hardware');

    const stars = container.querySelectorAll<HTMLInputElement>('input[name="conditionRating"]');
    await user.click(stars[3]);

    // Click Submit
    const submitBtn = screen.getByRole('button', { name: /Submit Inspection/i });
    await user.click(submitBtn);

    // Displays validation error
    expect(screen.getByText(/Please select a campus zone/i)).toBeTruthy();
    expect(mockStorage.enqueueSubmissionAndClearDraft).not.toHaveBeenCalled();
  });

  it('failed autosave shows local-save failure feedback and does not display Synced', async () => {
    const user = userEvent.setup();
    mockStorage.saveDraft = vi.fn().mockRejectedValue(new Error('Storage full'));

    render(<SurveyForm storage={mockStorage} />);
    await screen.findByRole('heading', { name: /Location/i });

    // Type something to trigger save
    await user.type(screen.getByLabelText(/Building/i), 'X');

    await waitFor(
      () => {
        expect(screen.getByText('Save failed')).toBeTruthy();
      },
      { timeout: 1500 }
    );

    const statusText = screen.getByRole('status').textContent;
    expect(statusText).not.toMatch(/Synced/i);
  });

  it('UI submit action queues locally, displays pending-sync wording, and never claims Synced', async () => {
    const user = userEvent.setup();
    const { container } = render(<SurveyForm storage={mockStorage} />);
    await screen.findByRole('heading', { name: /Location/i });

    // Select Zone
    await user.click(screen.getByRole('radio', { name: /Khu Hàn/i }));

    // Select category and rating
    const categorySelect = screen.getByLabelText(/Category/i);
    await user.selectOptions(categorySelect, 'AC');

    const stars = container.querySelectorAll<HTMLInputElement>('input[name="conditionRating"]');
    await user.click(stars[2]); // 3 stars

    // Click Submit Inspection
    const submitBtn = screen.getByRole('button', { name: /Submit Inspection/i });
    await user.click(submitBtn);

    // Verify atomic enqueueSubmissionAndClearDraft was called
    await waitFor(() => {
      expect(mockStorage.enqueueSubmissionAndClearDraft).toHaveBeenCalledOnce();
    });

    const [enqueued] = vi.mocked(mockStorage.enqueueSubmissionAndClearDraft).mock.calls[0];
    expect(enqueued.syncStatus).toBe('PENDING_SYNC');
    expect(enqueued.surveyData.zone).toBe('K');
    expect(enqueued.surveyData.category).toBe('AC');
    expect(enqueued.surveyData.conditionRating).toBe(3);

    // Verify pending-sync feedback
    await waitFor(() => {
      expect(screen.getByText(/Saved offline — pending sync/i)).toBeTruthy();
    });

    // Verify it NEVER claims Synced
    const statusText = screen.getByRole('status').textContent;
    expect(statusText).not.toMatch(/\bSynced\b/i);
    expect(statusText).not.toMatch(/Uploaded/i);
    expect(statusText).not.toMatch(/Sent to server/i);
  });

  it('enqueue failure preserves form data and displays failure state', async () => {
    const user = userEvent.setup();
    mockStorage.enqueueSubmissionAndClearDraft = vi
      .fn()
      .mockRejectedValue(new Error('QuotaExceededError'));

    const { container } = render(<SurveyForm storage={mockStorage} />);
    await screen.findByRole('heading', { name: /Location/i });

    // Select Zone
    await user.click(screen.getByRole('radio', { name: /Khu Hàn/i }));

    // Enter Building and defect notes
    const buildingInput = screen.getByLabelText(/Building/i) as HTMLInputElement;
    await user.type(buildingInput, 'VJIT Innovation Hub');

    const categorySelect = screen.getByLabelText(/Category/i);
    await user.selectOptions(categorySelect, 'Electrical');

    const stars = container.querySelectorAll<HTMLInputElement>('input[name="conditionRating"]');
    await user.click(stars[3]); // 4 stars

    // Click Submit
    const submitBtn = screen.getByRole('button', { name: /Submit Inspection/i });
    await user.click(submitBtn);

    // Verify error state is displayed
    await waitFor(() => {
      expect(screen.getByText(/QuotaExceededError/i)).toBeTruthy();
    });
    expect(screen.getByText('Queue failed')).toBeTruthy();

    // Verify entered form data is preserved
    expect((screen.getByRole('radio', { name: /Khu Hàn/i }) as HTMLInputElement).checked).toBe(
      true
    );
    expect(buildingInput.value).toBe('VJIT Innovation Hub');
    expect((categorySelect as HTMLSelectElement).value).toBe('Electrical');
    expect((stars[3] as HTMLInputElement).checked).toBe(true);
  });

  it('rapid repeated clicks do not create duplicate queue entries during in-flight submit', async () => {
    const user = userEvent.setup();
    let resolveEnqueue: () => void;
    mockStorage.enqueueSubmissionAndClearDraft = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveEnqueue = resolve;
        })
    );

    const { container } = render(<SurveyForm storage={mockStorage} />);
    await screen.findByRole('heading', { name: /Location/i });

    // Select Zone
    await user.click(screen.getByRole('radio', { name: /Khu Hàn/i }));

    // Fill valid category and rating
    const categorySelect = screen.getByLabelText(/Category/i);
    await user.selectOptions(categorySelect, 'Furniture');

    const stars = container.querySelectorAll<HTMLInputElement>('input[name="conditionRating"]');
    await user.click(stars[4]); // 5 stars

    const submitBtn = screen.getByRole('button', { name: /Submit Inspection/i });

    // Rapid repeated clicks
    await user.click(submitBtn);
    await user.click(submitBtn);
    await user.click(submitBtn);

    // Resolve the in-flight submission
    resolveEnqueue!();

    await waitFor(() => {
      expect(screen.getByText(/Saved offline — pending sync/i)).toBeTruthy();
    });

    // Enqueue must be called exactly once
    expect(mockStorage.enqueueSubmissionAndClearDraft).toHaveBeenCalledOnce();
  });

  it('captures photo via camera adapter and displays preview and details', async () => {
    const user = userEvent.setup();
    const mockPhoto = {
      id: 'photo-uuid-1',
      displayUri: 'blob:http://localhost/mock-photo.jpg',
      binaryData: new Blob(['test-image-data']),
      capturedAt: '2026-09-02T10:30:00.000Z',
    };

    const mockCamera = {
      capturePhoto: vi.fn().mockResolvedValue(mockPhoto),
    };

    render(<SurveyForm storage={mockStorage} camera={mockCamera} />);
    await screen.findByRole('heading', { name: /Location/i });

    const captureBtn = screen.getByRole('button', { name: /Capture Photo/i });
    await user.click(captureBtn);

    expect(mockCamera.capturePhoto).toHaveBeenCalledOnce();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Replace Photo/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Remove Photo/i })).toBeTruthy();
      expect(screen.getByAltText(/Inspection capture preview/i)).toBeTruthy();
    });
  });

  it('camera cancellation leaves existing form fields intact', async () => {
    const user = userEvent.setup();
    const mockCamera = {
      capturePhoto: vi.fn().mockResolvedValue(null),
    };

    render(<SurveyForm storage={mockStorage} camera={mockCamera} />);
    await screen.findByRole('heading', { name: /Location/i });

    const buildingInput = screen.getByLabelText(/Building/i) as HTMLInputElement;
    await user.type(buildingInput, 'Building C');
    expect(buildingInput.value).toBe('Building C');

    const captureBtn = screen.getByRole('button', { name: /Capture Photo/i });
    await user.click(captureBtn);

    expect(mockCamera.capturePhoto).toHaveBeenCalledOnce();
    // Form value remains completely intact
    expect(buildingInput.value).toBe('Building C');
  });

  it('removing photo clears photo preview and restores capture button', async () => {
    const user = userEvent.setup();
    const mockPhoto = {
      id: 'photo-uuid-2',
      displayUri: 'blob:http://localhost/photo-2.jpg',
      binaryData: new Blob(['bytes']),
      capturedAt: '2026-09-02T11:00:00.000Z',
    };

    const mockCamera = {
      capturePhoto: vi.fn().mockResolvedValue(mockPhoto),
    };

    render(<SurveyForm storage={mockStorage} camera={mockCamera} />);
    await screen.findByRole('heading', { name: /Location/i });

    await user.click(screen.getByRole('button', { name: /Capture Photo/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Remove Photo/i })).toBeTruthy();
    });

    await user.click(screen.getByRole('button', { name: /Remove Photo/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Capture Photo/i })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Remove Photo/i })).toBeNull();
    });
  });
});
