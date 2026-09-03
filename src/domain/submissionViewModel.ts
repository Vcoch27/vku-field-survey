import {
  SURVEY_CATEGORIES,
  type CampusZone,
  type ConditionRating,
  type SurveyCategory,
  type SurveySubmission,
  type SyncStatus,
} from './models.ts';
import { aggregateSubmissions, type SubmissionStatusCounts } from './submissionAggregation.ts';

export type RecordStatusFilter = 'ALL' | 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
export type RecordSortOrder = 'newest' | 'oldest';

export interface RecordFilters {
  readonly status: RecordStatusFilter;
  readonly category: SurveyCategory | 'ALL';
  readonly zone: CampusZone | 'ALL';
  readonly poorConditionOnly: boolean;
  readonly sort: RecordSortOrder;
}

export const DEFAULT_RECORD_FILTERS: RecordFilters = {
  status: 'ALL',
  category: 'ALL',
  zone: 'ALL',
  poorConditionOnly: false,
  sort: 'newest',
};

export interface DistributionItem<T> {
  readonly key: T;
  readonly count: number;
  readonly percent: number;
}

export interface SubmissionViewModel {
  readonly records: readonly SurveySubmission[];
  readonly status: SubmissionStatusCounts;
  readonly averageRating: number;
  readonly lowConditionCount: number;
  readonly ratingDistribution: readonly DistributionItem<ConditionRating>[];
  readonly categoryDistribution: readonly DistributionItem<SurveyCategory>[];
  readonly zoneDistribution: readonly DistributionItem<CampusZone>[];
}

const STATUS_FILTERS: Record<RecordStatusFilter, SyncStatus | null> = {
  ALL: null,
  PENDING: 'PENDING_SYNC',
  SYNCING: 'SYNCING',
  SYNCED: 'SYNCED',
  FAILED: 'SYNC_FAILED',
};

function percentage(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 1000) / 10;
}

export function createSubmissionViewModel(
  submissions: readonly SurveySubmission[]
): SubmissionViewModel {
  const records = [...submissions].sort(
    (left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp)
  );
  const total = records.length;
  const status = aggregateSubmissions(records);
  const ratingCounts = new Map<ConditionRating, number>([
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0],
  ]);
  const categoryCounts = new Map<SurveyCategory, number>(
    SURVEY_CATEGORIES.map((category) => [category, 0])
  );
  const zoneCounts = new Map<CampusZone, number>([
    ['K', 0],
    ['V', 0],
  ]);
  let ratingTotal = 0;
  let lowConditionCount = 0;

  for (const record of records) {
    const rating = record.surveyData.conditionRating;
    ratingCounts.set(rating, (ratingCounts.get(rating) ?? 0) + 1);
    categoryCounts.set(
      record.surveyData.category,
      (categoryCounts.get(record.surveyData.category) ?? 0) + 1
    );
    zoneCounts.set(record.surveyData.zone, (zoneCounts.get(record.surveyData.zone) ?? 0) + 1);
    ratingTotal += rating;
    if (rating <= 2) lowConditionCount += 1;
  }

  const ratingDistribution = ([5, 4, 3, 2, 1] as const).map((key) => ({
    key,
    count: ratingCounts.get(key) ?? 0,
    percent: percentage(ratingCounts.get(key) ?? 0, total),
  }));
  const categoryDistribution = SURVEY_CATEGORIES.map((key) => ({
    key,
    count: categoryCounts.get(key) ?? 0,
    percent: percentage(categoryCounts.get(key) ?? 0, total),
  })).sort((left, right) => right.count - left.count);

  const kCount = zoneCounts.get('K') ?? 0;
  const kPercent = percentage(kCount, total);
  const zoneDistribution: readonly DistributionItem<CampusZone>[] = [
    { key: 'K', count: kCount, percent: kPercent },
    { key: 'V', count: zoneCounts.get('V') ?? 0, percent: total === 0 ? 0 : 100 - kPercent },
  ];

  return {
    records,
    status,
    averageRating: total === 0 ? 0 : Math.round((ratingTotal / total) * 10) / 10,
    lowConditionCount,
    ratingDistribution,
    categoryDistribution,
    zoneDistribution,
  };
}

export function filterSubmissionRecords(
  submissions: readonly SurveySubmission[],
  filters: RecordFilters
): readonly SurveySubmission[] {
  const requiredStatus = STATUS_FILTERS[filters.status];

  return submissions
    .filter((record) => requiredStatus === null || record.syncStatus === requiredStatus)
    .filter(
      (record) => filters.category === 'ALL' || record.surveyData.category === filters.category
    )
    .filter((record) => filters.zone === 'ALL' || record.surveyData.zone === filters.zone)
    .filter((record) => !filters.poorConditionOnly || record.surveyData.conditionRating <= 2)
    .sort((left, right) => {
      const delta = Date.parse(left.timestamp) - Date.parse(right.timestamp);
      return filters.sort === 'newest' ? -delta : delta;
    });
}

export interface RecordDateGroup {
  readonly label: 'Today' | 'Yesterday' | 'Earlier';
  readonly records: readonly SurveySubmission[];
}

export function groupRecordsByRecency(
  records: readonly SurveySubmission[],
  now: Date = new Date()
): readonly RecordDateGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const groups = new Map<RecordDateGroup['label'], SurveySubmission[]>();

  for (const record of records) {
    const timestamp = Date.parse(record.timestamp);
    const label =
      timestamp >= startOfToday
        ? 'Today'
        : timestamp >= startOfYesterday
          ? 'Yesterday'
          : 'Earlier';
    const groupedRecords = groups.get(label);
    if (groupedRecords) groupedRecords.push(record);
    else groups.set(label, [record]);
  }

  return [...groups.entries()].map(([label, groupedRecords]) => ({ label, records: groupedRecords }));
}

export function buildRecordsHref(filters: Partial<RecordFilters>): string {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
  if (filters.category && filters.category !== 'ALL') params.set('category', filters.category);
  if (filters.zone && filters.zone !== 'ALL') params.set('zone', filters.zone);
  if (filters.poorConditionOnly) params.set('condition', 'poor');
  if (filters.sort === 'oldest') params.set('sort', 'oldest');
  const query = params.toString();
  return query ? `/records?${query}` : '/records';
}
