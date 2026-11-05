import { describe, expect, it } from 'vitest';
import { roundToIncrement, unitCodeFor, weightInUnit } from './units';

describe('weightInUnit', () => {
  it('converts kg-stored template weights for an imperial user', () => {
    expect(weightInUnit(20.411, 1, 'lbs')).toBe(45);
  });

  it('treats FitNotes unit 0 as kg', () => {
    expect(weightInUnit(100, 0, 'lbs')).toBe(220.5);
  });

  it('leaves weights already in the target unit alone', () => {
    expect(weightInUnit(45, 2, 'lbs')).toBe(45);
    expect(weightInUnit(60, 1, 'kg')).toBe(60);
  });

  it('converts lbs-stored weights for a metric user', () => {
    expect(weightInUnit(225, 2, 'kg')).toBe(102.1);
  });

  it('maps display units to stored unit codes', () => {
    expect(unitCodeFor('kg')).toBe(1);
    expect(unitCodeFor('lbs')).toBe(2);
  });
});

describe('roundToIncrement', () => {
  it('snaps computed loads to plate steps', () => {
    expect(roundToIncrement(2.27, 2.5)).toBe(2.5);
    expect(roundToIncrement(47.27, 2.5)).toBe(47.5);
    expect(roundToIncrement(44.1, 5)).toBe(45);
    expect(roundToIncrement(0 + 5, 2.5)).toBe(5);
  });

  it('falls back to one decimal without a step', () => {
    expect(roundToIncrement(12.27, 0)).toBe(12.3);
  });
});
