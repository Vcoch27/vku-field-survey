import { describe, expect, it } from 'vitest';
import { aggregateSubmissions, ZERO_STATUS_COUNTS } from './submissionAggregation.ts';
import type { SurveySubmission } from './models.ts';

function createMockSubmission(
  id: string,
  syncStatus: SurveySubmission['syncStatus'],
  failureDisposition?: SurveySubmission['failureDisposition']
): SurveySubmission {
  return {
    id,
    timestamp: '2026-09-03T10:00:00.000Z',
    syncStatus,
    ...(failureDisposition ? { failureDisposition } : {}),
    surveyData: {
      zone: 'K',
      building: 'A',
      roomNumber: '101',
      category: 'Hardware',
      conditionRating: 5,
      defectNotes: '',
      photo: null,
    },
  };
}

describe('aggregateSubmissions', () => {
  it('returns zeroes for empty submissions', () => {
    expect(aggregateSubmissions([])).toEqual(ZERO_STATUS_COUNTS);
  });

  it('accurately distinguishes pending, syncing, synced, and failed without overlaps', () => {
    const submissions: SurveySubmission[] = [
      createMockSubmission('1', 'PENDING_SYNC'),
      createMockSubmission('2', 'PENDING_SYNC'),
      createMockSubmission('3', 'SYNCING'),
      createMockSubmission('4', 'SYNCED'),
      createMockSubmission('5', 'SYNCED'),
      createMockSubmission('6', 'SYNCED'),
      createMockSubmission('7', 'SYNC_FAILED', 'RETRYABLE'),
      createMockSubmission('8', 'SYNC_FAILED', 'REQUIRES_ATTENTION'),
    ];

    const counts = aggregateSubmissions(submissions);

    expect(counts.total).toBe(8);
    expect(counts.pending).toBe(2);
    expect(counts.syncing).toBe(1);
    expect(counts.synced).toBe(3);
    expect(counts.failed).toBe(2);
    expect(counts.retryableFailed).toBe(1);
    expect(counts.attentionFailed).toBe(1);
    expect(counts.needsAttention).toBe(5); // 2 pending + 1 syncing + 2 failed
  });

  it('never counts SYNC_FAILED as pending', () => {
    const submissions: SurveySubmission[] = [
      createMockSubmission('1', 'SYNC_FAILED', 'RETRYABLE'),
      createMockSubmission('2', 'SYNC_FAILED', 'RETRYABLE'),
    ];

    const counts = aggregateSubmissions(submissions);
    expect(counts.pending).toBe(0);
    expect(counts.failed).toBe(2);
    expect(counts.retryableFailed).toBe(2);
    expect(counts.needsAttention).toBe(2);
  });
});
