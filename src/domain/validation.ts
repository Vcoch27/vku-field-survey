import {
  CONDITION_RATINGS,
  SURVEY_CATEGORIES,
  type CampusZone,
  type ConditionRating,
  type SurveyCategory,
} from './models.ts';

export function isCampusZone(value: unknown): value is CampusZone {
  return value === 'K' || value === 'V';
}

export function isSurveyCategory(value: unknown): value is SurveyCategory {
  return SURVEY_CATEGORIES.some((category) => category === value);
}

export function isConditionRating(value: unknown): value is ConditionRating {
  return CONDITION_RATINGS.some((rating) => rating === value);
}
