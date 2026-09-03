import { describe, expect, it } from 'vitest';
import type { CampusZone, SurveyCategory, SurveySubmission, SyncStatus } from './models.ts';
import {
  createSubmissionViewModel,
  DEFAULT_RECORD_FILTERS,
  filterSubmissionRecords,
  groupRecordsByRecency,
} from './submissionViewModel.ts';

function record(
  id: string,
  zone: CampusZone,
  category: SurveyCategory,
  status: SyncStatus,
  rating: 1 | 2 | 3 | 4 | 5,
  timestamp: string
): SurveySubmission {
  return {
    id,
    timestamp,
    syncStatus: status,
    surveyData: {
      zone,
      building: 'A',
      roomNumber: id,
      category,
      conditionRating: rating,
      defectNotes: '',
      photo: null,
    },
  };
}

const mixed = [
  record('1', 'K', 'Hardware', 'PENDING_SYNC', 1, '2026-09-01T08:00:00.000Z'),
  record('2', 'V', 'Projector', 'SYNCING', 2, '2026-09-02T08:00:00.000Z'),
  record('3', 'V', 'Projector', 'SYNCED', 4, '2026-09-03T08:00:00.000Z'),
  record('4', 'V', 'Furniture', 'SYNC_FAILED', 5, '2026-09-04T08:00:00.000Z'),
] as const;

describe('submission view model', () => {
  it('returns safe zero-state statistics', () => {
    const result = createSubmissionViewModel([]);
    expect(result.status.total).toBe(0);
    expect(result.averageRating).toBe(0);
    expect(result.ratingDistribution.every((item) => item.count === 0 && item.percent === 0)).toBe(true);
    expect(result.categoryDistribution.every((item) => item.count === 0 && item.percent === 0)).toBe(true);
    expect(result.zoneDistribution).toEqual([
      { key: 'K', count: 0, percent: 0 },
      { key: 'V', count: 0, percent: 0 },
    ]);
  });

  it.each([
    { name: 'all K', records: mixed.slice(0, 1), expected: [100, 0] },
    { name: 'all V', records: mixed.slice(1), expected: [0, 100] },
    { name: 'mixed K/V', records: mixed, expected: [25, 75] },
  ])('calculates bounded zone percentages for $name', ({ records, expected }) => {
    const zones = createSubmissionViewModel(records).zoneDistribution;
    expect(zones.map((zone) => zone.percent)).toEqual(expected);
    expect(zones.reduce((sum, zone) => sum + zone.percent, 0)).toBe(100);
    expect(zones.every((zone) => zone.percent <= 100)).toBe(true);
  });

  it('calculates rating, category, status, and average without double-counting', () => {
    const result = createSubmissionViewModel(mixed);
    expect(result.status).toMatchObject({ pending: 1, syncing: 1, synced: 1, failed: 1 });
    expect(result.averageRating).toBe(3);
    expect(result.lowConditionCount).toBe(2);
    expect(result.ratingDistribution.map(({ key, count }) => [key, count])).toEqual([
      [5, 1], [4, 1], [3, 0], [2, 1], [1, 1],
    ]);
    expect(result.categoryDistribution.map(({ key, count }) => [key, count])).toEqual([
      ['Projector', 2], ['Hardware', 1], ['Furniture', 1], ['AC', 0], ['Electrical', 0],
    ]);
  });

  it('composes zone, category, status, poor-condition, and sort filters', () => {
    const filtered = filterSubmissionRecords(mixed, {
      ...DEFAULT_RECORD_FILTERS,
      zone: 'V',
      category: 'Projector',
      status: 'SYNCING',
      poorConditionOnly: true,
      sort: 'oldest',
    });
    expect(filtered.map((item) => item.id)).toEqual(['2']);
    expect(filterSubmissionRecords(mixed, DEFAULT_RECORD_FILTERS).map((item) => item.id)).toEqual([
      '4', '3', '2', '1',
    ]);
    expect(filterSubmissionRecords(mixed, { ...DEFAULT_RECORD_FILTERS, sort: 'oldest' }).map((item) => item.id)).toEqual([
      '1', '2', '3', '4',
    ]);
  });

  it('groups recent records deterministically without durable NEW state', () => {
    const groups = groupRecordsByRecency(createSubmissionViewModel(mixed).records, new Date('2026-09-04T12:00:00.000Z'));
    expect(groups.map((group) => [group.label, group.records.map((item) => item.id)])).toEqual([
      ['Today', ['4']],
      ['Yesterday', ['3']],
      ['Earlier', ['2', '1']],
    ]);
  });
});
