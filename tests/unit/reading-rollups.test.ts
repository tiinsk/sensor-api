import {
  getRollupBucketKey,
  getRollupBucketStart,
  mergeRollupStats,
} from '../../src/data/reading-rollups';

describe('reading rollups', () => {
  it('builds 30-minute bucket keys', () => {
    expect(
      getRollupBucketKey('2026-06-22T10:17:12.000Z', '30m', 'UTC')
    ).toBe('30m#2026-06-22T10:00:00.000Z');

    expect(
      getRollupBucketKey('2026-06-22T10:47:12.000Z', '30m', 'UTC')
    ).toBe('30m#2026-06-22T10:30:00.000Z');
  });

  it('uses device timezone for day buckets', () => {
    // 2026-06-21T21:30Z is 2026-06-22 00:30 in Europe/Helsinki.
    expect(
      getRollupBucketStart('2026-06-21T21:30:00.000Z', 'day', 'Europe/Helsinki')
    ).toBe('2026-06-21T21:00:00.000Z');
  });

  it('merges avg/min/max/count incrementally', () => {
    const first = mergeRollupStats(undefined, 10);
    const second = mergeRollupStats(first, 20);
    const third = mergeRollupStats(second, 5);

    expect(third).toEqual({
      avg: 35 / 3,
      min: 5,
      max: 20,
      count: 3,
    });
  });
});
