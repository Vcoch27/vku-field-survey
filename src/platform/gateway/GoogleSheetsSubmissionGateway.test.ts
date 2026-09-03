import { describe, expect, it, vi } from 'vitest';
import type { SurveySubmission } from '../../domain/models.ts';
import { GoogleSheetsSubmissionGateway } from './GoogleSheetsSubmissionGateway.ts';

function createMockSubmission(overrides?: Partial<SurveySubmission>): SurveySubmission {
  return {
    id: '72e7d465-9cda-4e33-8464-7169cee92240',
    timestamp: '2026-09-03T01:15:12.903Z',
    syncStatus: 'PENDING_SYNC',
    surveyData: {
      zone: 'K',
      building: 'A',
      roomNumber: '205',
      category: 'AC',
      conditionRating: 4,
      defectNotes: 'Air conditioner compressor vibrates loudly.',
      photo: {
        id: 'photo-uuid-1234',
        displayUri: 'blob:https://example/photo',
        binaryData: new Blob(['fake-img-bytes'], { type: 'image/jpeg' }),
        capturedAt: '2026-09-03T01:14:00.000Z',
      },
    },
    ...overrides,
  };
}

describe('GoogleSheetsSubmissionGateway', () => {
  it('returns ACKNOWLEDGED on successful submission receipt', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        acknowledged: true,
        submissionId: '72e7d465-9cda-4e33-8464-7169cee92240',
        duplicate: false,
      }),
    });

    const gateway = new GoogleSheetsSubmissionGateway({
      endpointUrl: 'https://script.google.com/macros/s/TEST/exec',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const submission = createMockSubmission();
    const result = await gateway.sendSubmission(submission);

    expect(result.outcome).toBe('ACKNOWLEDGED');
    if (result.outcome === 'ACKNOWLEDGED') {
      expect(result.acknowledgementToken).toBe('72e7d465-9cda-4e33-8464-7169cee92240');
    }

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, req] = mockFetch.mock.calls[0];
    expect(url).toBe('https://script.google.com/macros/s/TEST/exec');
    expect(req.method).toBe('POST');
    expect(req.headers['Content-Type']).toBe('text/plain;charset=utf-8');

    const body = JSON.parse(req.body);
    expect(body.submissionId).toBe('72e7d465-9cda-4e33-8464-7169cee92240');
    expect(body.roomIdentifier).toBe('K.A-205');
    expect(body.photoId).toBe('photo-uuid-1234');
    // Ensure raw blob binary is NOT sent in DTO
    expect(body.binaryData).toBeUndefined();
  });

  it('returns ACKNOWLEDGED when backend detects idempotent duplicate', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        acknowledged: true,
        submissionId: '72e7d465-9cda-4e33-8464-7169cee92240',
        duplicate: true,
      }),
    });

    const gateway = new GoogleSheetsSubmissionGateway({
      endpointUrl: 'https://script.google.com/macros/s/TEST/exec',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await gateway.sendSubmission(createMockSubmission());
    expect(result.outcome).toBe('ACKNOWLEDGED');
  });

  it('returns RETRYABLE_FAILURE when endpoint URL is missing', async () => {
    const gateway = new GoogleSheetsSubmissionGateway({
      endpointUrl: '',
    });

    const result = await gateway.sendSubmission(createMockSubmission());
    expect(result.outcome).toBe('RETRYABLE_FAILURE');
    if (result.outcome === 'RETRYABLE_FAILURE') {
      expect(result.reason).toContain('endpoint URL');
    }
  });

  it('returns RETRYABLE_FAILURE on network connection error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    const gateway = new GoogleSheetsSubmissionGateway({
      endpointUrl: 'https://script.google.com/macros/s/TEST/exec',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await gateway.sendSubmission(createMockSubmission());
    expect(result.outcome).toBe('RETRYABLE_FAILURE');
    if (result.outcome === 'RETRYABLE_FAILURE') {
      expect(result.reason).toContain('Network dispatch failed');
    }
  });

  it('returns RETRYABLE_FAILURE on request timeout', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    const mockFetch = vi.fn().mockRejectedValue(abortError);

    const gateway = new GoogleSheetsSubmissionGateway({
      endpointUrl: 'https://script.google.com/macros/s/TEST/exec',
      timeoutMs: 5000,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await gateway.sendSubmission(createMockSubmission());
    expect(result.outcome).toBe('RETRYABLE_FAILURE');
    if (result.outcome === 'RETRYABLE_FAILURE') {
      expect(result.reason).toContain('timed out');
    }
  });

  it('returns RETRYABLE_FAILURE on HTTP 5xx error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
    });

    const gateway = new GoogleSheetsSubmissionGateway({
      endpointUrl: 'https://script.google.com/macros/s/TEST/exec',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await gateway.sendSubmission(createMockSubmission());
    expect(result.outcome).toBe('RETRYABLE_FAILURE');
    if (result.outcome === 'RETRYABLE_FAILURE') {
      expect(result.reason).toContain('HTTP 502');
    }
  });

  it('returns REQUIRES_ATTENTION on validation failure rejection from backend', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: false,
        acknowledged: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Zone must be K or V',
        },
      }),
    });

    const gateway = new GoogleSheetsSubmissionGateway({
      endpointUrl: 'https://script.google.com/macros/s/TEST/exec',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await gateway.sendSubmission(createMockSubmission());
    expect(result.outcome).toBe('REQUIRES_ATTENTION');
    if (result.outcome === 'REQUIRES_ATTENTION') {
      expect(result.reason).toContain('INVALID_PAYLOAD');
    }
  });

  it('returns REQUIRES_ATTENTION on unauthorized token rejection', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: false,
        acknowledged: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid client token.',
        },
      }),
    });

    const gateway = new GoogleSheetsSubmissionGateway({
      endpointUrl: 'https://script.google.com/macros/s/TEST/exec',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await gateway.sendSubmission(createMockSubmission());
    expect(result.outcome).toBe('REQUIRES_ATTENTION');
    if (result.outcome === 'REQUIRES_ATTENTION') {
      expect(result.reason).toContain('UNAUTHORIZED');
    }
  });

  it('returns RETRYABLE_FAILURE on transient concurrency lock timeout from backend', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: false,
        acknowledged: false,
        error: {
          code: 'CONCURRENCY_LOCK_TIMEOUT',
          message: 'Server was busy.',
        },
      }),
    });

    const gateway = new GoogleSheetsSubmissionGateway({
      endpointUrl: 'https://script.google.com/macros/s/TEST/exec',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await gateway.sendSubmission(createMockSubmission());
    expect(result.outcome).toBe('RETRYABLE_FAILURE');
  });

  it('returns RETRYABLE_FAILURE on malformed JSON response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Unexpected token < in JSON');
      },
    });

    const gateway = new GoogleSheetsSubmissionGateway({
      endpointUrl: 'https://script.google.com/macros/s/TEST/exec',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const result = await gateway.sendSubmission(createMockSubmission());
    expect(result.outcome).toBe('RETRYABLE_FAILURE');
    if (result.outcome === 'RETRYABLE_FAILURE') {
      expect(result.reason).toContain('Malformed JSON');
    }
  });

  it('maps DTO correctly with client token when configured', async () => {
    const gateway = new GoogleSheetsSubmissionGateway({
      endpointUrl: 'https://script.google.com/macros/s/TEST/exec',
      clientToken: 'my-anti-abuse-token',
    });

    const submission = createMockSubmission({
      surveyData: {
        zone: 'V',
        building: 'B',
        roomNumber: '301',
        category: 'Projector',
        conditionRating: 2,
        defectNotes: 'Bulb flickering',
        photo: null,
      },
    });

    const dto = await gateway.mapToDto(submission);
    expect(dto.zone).toBe('V');
    expect(dto.building).toBe('B');
    expect(dto.roomNumber).toBe('301');
    expect(dto.roomIdentifier).toBe('V.B-301');
    expect(dto.photoId).toBeNull();
    expect(dto.photoCapturedAt).toBeNull();
    expect(dto.photoBase64).toBeNull();
    expect(dto.clientToken).toBe('my-anti-abuse-token');
  });

  it('converts photo binary Blob into photoBase64 string in DTO', async () => {
    const gateway = new GoogleSheetsSubmissionGateway({
      endpointUrl: 'https://script.google.com/macros/s/TEST/exec',
    });

    const submission = createMockSubmission();
    const dto = await gateway.mapToDto(submission);
    expect(dto.photoId).toBe('photo-uuid-1234');
    expect(typeof dto.photoBase64).toBe('string');
    expect(dto.photoBase64!.length).toBeGreaterThan(0);
  });
});
