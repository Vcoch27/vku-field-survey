import { describe, expect, it } from 'vitest';
import { formatFullRoomIdentifier, SURVEY_CATEGORIES } from './models.ts';
import { isCampusZone, isConditionRating, isSurveyCategory } from './validation.ts';

describe('survey category validation', () => {
  it.each(SURVEY_CATEGORIES)('accepts %s', (category) => {
    expect(isSurveyCategory(category)).toBe(true);
  });

  it('rejects a category outside the assignment vocabulary', () => {
    expect(isSurveyCategory('Other')).toBe(false);
  });
});

describe('condition rating validation', () => {
  it('accepts the lower bound', () => {
    expect(isConditionRating(1)).toBe(true);
  });

  it('accepts the upper bound', () => {
    expect(isConditionRating(5)).toBe(true);
  });

  it.each([0, 6, 1.5, '5'])('rejects invalid rating %s', (rating) => {
    expect(isConditionRating(rating)).toBe(false);
  });
});

describe('campus zone validation (CR-001)', () => {
  it('accepts K (khu Hàn) and V (khu Việt)', () => {
    expect(isCampusZone('K')).toBe(true);
    expect(isCampusZone('V')).toBe(true);
  });

  it.each(['A', 'B', 'k', 'v', 'VJIT', 'Hàn', 'Việt', '', null, undefined, 1])(
    'rejects other value %s',
    (value) => {
      expect(isCampusZone(value)).toBe(false);
    }
  );
});

describe('formatFullRoomIdentifier (CR-001 derived room identifier)', () => {
  it('formats K + A + 205 to K.A-205', () => {
    expect(formatFullRoomIdentifier({ zone: 'K', building: 'A', roomNumber: '205' })).toBe(
      'K.A-205'
    );
  });

  it('formats K + D1 + 201 to K.D1-201', () => {
    expect(formatFullRoomIdentifier({ zone: 'K', building: 'D1', roomNumber: '201' })).toBe(
      'K.D1-201'
    );
  });

  it('formats V + A + 505 to V.A-505', () => {
    expect(formatFullRoomIdentifier({ zone: 'V', building: 'A', roomNumber: '505' })).toBe(
      'V.A-505'
    );
  });

  it('trims building and roomNumber safely', () => {
    expect(formatFullRoomIdentifier({ zone: 'K', building: '  B  ', roomNumber: '  301  ' })).toBe(
      'K.B-301'
    );
  });

  it('incomplete location returns null without fabricating identifier', () => {
    expect(formatFullRoomIdentifier({ zone: null, building: 'A', roomNumber: '205' })).toBeNull();
    expect(formatFullRoomIdentifier({ zone: 'K', building: '', roomNumber: '205' })).toBeNull();
    expect(formatFullRoomIdentifier({ zone: 'K', building: 'A', roomNumber: '' })).toBeNull();
    expect(formatFullRoomIdentifier({ zone: 'K', building: '   ', roomNumber: '205' })).toBeNull();
    expect(formatFullRoomIdentifier({ zone: 'K', building: 'A', roomNumber: '   ' })).toBeNull();
  });
});
