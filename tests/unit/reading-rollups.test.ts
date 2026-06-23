import {
  aggregateRollups,
  getRollupBucketKey,
  getRollupBucketStart,
  mergeRollupStats,
} from '../../src/data/reading-rollups';
import type { ReadingRollup } from '../../src/db-types';

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
    const first = mergeRollupStats(undefined, { avg: 10, min: 10, max: 10, count: 1 });
    const second = mergeRollupStats(first, { avg: 20, min: 20, max: 20, count: 1 });
    const third = mergeRollupStats(second, { avg: 5, min: 5, max: 5, count: 1 });

    expect(third).toEqual({
      avg: 11.6667,
      min: 5,
      max: 20,
      count: 3,
    });
  });

  it('combines daily rollups into month buckets with weighted averages', () => {
    const rollups: ReadingRollup[] = [
      {
        deviceId: 'device-001',
        bucketKey: 'day#2026-06-01T00:00:00.000Z',
        level: 'day',
        bucketStart: '2026-06-01T00:00:00.000Z',
        timezone: 'UTC',
        temperature: { avg: 10, min: 8, max: 12, count: 2 },
      },
      {
        deviceId: 'device-001',
        bucketKey: 'day#2026-06-02T00:00:00.000Z',
        level: 'day',
        bucketStart: '2026-06-02T00:00:00.000Z',
        timezone: 'UTC',
        temperature: { avg: 20, min: 18, max: 22, count: 1 },
      },
    ];

    expect(aggregateRollups(rollups, 'temperature', 'month', 'UTC')).toEqual([
      {
        timestamp: '2026-06-01T00:00:00.000Z',
        avg: 13.3333,
        min: 8,
        max: 22,
      },
    ]);
  });
});
