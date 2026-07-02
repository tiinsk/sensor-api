import {
  aggregateRollups,
  aggregateRollupsToStatistics,
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

  it('keeps 30-minute bucket keys distinct during DST fallback', () => {
    expect(
      getRollupBucketKey('2022-10-30T00:09:51.282Z', '30m', 'Europe/Helsinki')
    ).toBe('30m#2022-10-30T00:00:00.000Z');

    expect(
      getRollupBucketKey('2022-10-30T01:09:51.411Z', '30m', 'Europe/Helsinki')
    ).toBe('30m#2022-10-30T01:00:00.000Z');
  });

  it('uses device timezone for day buckets', () => {
    // 2026-06-21T21:30Z is 2026-06-22 00:30 in Europe/Helsinki.
    expect(
      getRollupBucketKey('2026-06-21T21:30:00.000Z', 'day', 'Europe/Helsinki')
    ).toBe('day#2026-06-22');
  });

  it('combines daily rollups into month buckets with weighted averages', () => {
    const rollups: ReadingRollup[] = [
      {
        deviceId: 'device-001',
        bucketKey: 'day#2026-06-01',
        level: 'day',
        bucketStart: '2026-06-01',
        timezone: 'UTC',
        temperature: { avg: 10, min: 8, max: 12, count: 2 },
      },
      {
        deviceId: 'device-001',
        bucketKey: 'day#2026-06-02',
        level: 'day',
        bucketStart: '2026-06-02',
        timezone: 'UTC',
        temperature: { avg: 20, min: 18, max: 22, count: 1 },
      },
    ];

    expect(aggregateRollups(rollups, 'temperature', 'month')).toEqual([
      {
        timestamp: '2026-06-01',
        avg: 13.3333,
        min: 8,
        max: 22,
      },
    ]);
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

  it('aggregates rollups into sensor statistics', () => {
    const rollups = [
      {
        deviceId: 'device-001',
        bucketKey: 'day#2026-06-01',
        level: 'day' as const,
        bucketStart: '2026-06-01',
        timezone: 'UTC',
        temperature: { avg: 10, min: 8, max: 12, count: 2 },
        humidity: { avg: 30, min: 30, max: 30, count: 1 },
      },
      {
        deviceId: 'device-001',
        bucketKey: 'day#2026-06-02',
        level: 'day' as const,
        bucketStart: '2026-06-02',
        timezone: 'UTC',
        temperature: { avg: 20, min: 18, max: 22, count: 1 },
      },
    ];

    expect(aggregateRollupsToStatistics(rollups)).toEqual({
      temperature: { avg: 13.3333, min: 8, max: 22 },
      humidity: { avg: 30, min: 30, max: 30 },
      pressure: { avg: null, min: null, max: null },
      battery: { avg: null, min: null, max: null },
      pm25: { avg: null, min: null, max: null },
      co2: { avg: null, min: null, max: null },
      voc: { avg: null, min: null, max: null },
      nox: { avg: null, min: null, max: null },
      airQuality: { avg: null, min: null, max: null },
    });
  });
});
