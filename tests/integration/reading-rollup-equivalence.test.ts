import { sensorTypes } from '../../src/api-types';
import { getAllDevices } from '../../src/data/devices';
import { queryAggregatedRollups } from '../../src/data/reading-rollups';
import { aggregateReadings, queryAllReadingsInRange } from '../../src/data/readings';
import type { SensorType, TimeLevel, TimedAvgMinMax } from '../../src/api-types';

const describeIfEnabled =
  process.env.RUN_ROLLUP_EQUIVALENCE_TEST === 'true' ? describe : describe.skip;

const levels: TimeLevel[] = ['30 minutes', 'day', 'week', 'month'];
const startTime = '2025-01-01T00:00:00.000Z';
const endTime = '2026-06-22T23:59:59.999Z';

const ROLLUP_AVG_PRECISION = 3;
const ROLLUP_MIN_MAX_PRECISION = 3;

describeIfEnabled('reading rollup backfill equivalence', () => {
  it('returns the same buckets as the old raw-reading aggregation for seeded local data', async () => {
    const devices = await getAllDevices({
      limit: 100,
      offset: 0,
      includeDisabled: false,
    });

    expect(devices.values.length).toBeGreaterThan(0);

    for (const device of devices.values) {
      const readings = await queryAllReadingsInRange({
        deviceId: device.id,
        startTime,
        endTime,
      });

      expect(readings.length).toBeGreaterThan(0);

      for (const level of levels) {
        for (const type of sensorTypes) {
          await expectRollupsToMatchRawAggregation({
            deviceId: device.id,
            readings,
            type,
            level,
            timezone: device.timezone,
          });
        }
      }
    }
  });
});

const expectRollupsToMatchRawAggregation = async (params: {
  deviceId: string;
  readings: Awaited<ReturnType<typeof queryAllReadingsInRange>>;
  type: SensorType;
  level: TimeLevel;
  timezone: string;
}) => {
  const rawValues = aggregateReadings(
    params.readings,
    params.type,
    params.level,
    params.timezone
  );

  const rollupValues = await queryAggregatedRollups({
    deviceId: params.deviceId,
    startTime,
    endTime,
    type: params.type,
    level: params.level,
    timezone: params.timezone,
  });

  expect(rollupValues).toHaveLength(rawValues.length);

  rollupValues.forEach((rollupValue, index) => {
    const rawValue = rawValues[index];

    expect(rollupValue.timestamp).toBe(rawValue.timestamp);
    expect(rollupValue.avg).toBeCloseTo(rawValue.avg, ROLLUP_AVG_PRECISION);
    expect(rollupValue.min).toBeCloseTo(rawValue.min, ROLLUP_MIN_MAX_PRECISION);
    expect(rollupValue.max).toBeCloseTo(rawValue.max, ROLLUP_MIN_MAX_PRECISION);
  });
};
