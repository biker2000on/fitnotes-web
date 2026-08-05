// Trend helpers shared by chart surfaces.

/**
 * Exponentially weighted moving average. Null observations remain gaps in the
 * rendered series and do not reset the running average.
 */
export function exponentialMovingAverage(
  values: Array<number | null>,
  alpha = 0.1,
): Array<number | null> {
  if (!(alpha > 0 && alpha <= 1)) throw new RangeError('EWMA alpha must be greater than 0 and at most 1');
  let average: number | null = null;
  return values.map(value => {
    if (value == null || !Number.isFinite(value)) return null;
    average = average == null ? value : alpha * value + (1 - alpha) * average;
    return Math.round(average * 100) / 100;
  });
}
