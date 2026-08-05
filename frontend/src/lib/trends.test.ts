import { describe, expect, it } from 'vitest';
import { exponentialMovingAverage } from './trends';

describe('exponentialMovingAverage', () => {
  it('uses the first observation as the seed and smooths later values', () => {
    expect(exponentialMovingAverage([100, 110, 90], 0.25)).toEqual([100, 102.5, 99.38]);
  });

  it('preserves gaps without resetting the running average', () => {
    expect(exponentialMovingAverage([20, null, 30], 0.5)).toEqual([20, null, 25]);
  });

  it('rejects invalid smoothing factors', () => {
    expect(() => exponentialMovingAverage([1], 0)).toThrow(RangeError);
    expect(() => exponentialMovingAverage([1], 1.1)).toThrow(RangeError);
  });
});
