import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { sensorTypes } from '../api-types';
import { TABLES } from '../config/constants';
import { createDynamoDBClient } from '../lib/db-client';
import { airQualityFromPm25Co2 } from '../utils/air-quality';
import type { SensorReadings, SensorType, TimedAvgMinMax, TimeLevel } from '../api-types';
import type {
  Reading,
  ReadingRollup,
  ReadingRollupLevel,
  ReadingRollupStats,
} from '../db-types';

const docClient = createDynamoDBClient();

const rollupLevels: ReadingRollupLevel[] = ['30m', 'day'];

const roundRollupValue = (value: number): number => Number(value.toFixed(4));

const roundRollupStats = (stats: ReadingRollupStats): ReadingRollupStats => ({
  avg: roundRollupValue(stats.avg),
  min: roundRollupValue(stats.min),
  max: roundRollupValue(stats.max),
  count: stats.count,
});

export const getRollupBucketStart = (
  timestamp: string,
  level: ReadingRollupLevel,
  timezone: string
): string => {
  const zonedDate = toZonedTime(new Date(timestamp), timezone);

  if (level === '30m') {
    zonedDate.setMinutes(Math.floor(zonedDate.getMinutes() / 30) * 30, 0, 0);
  } else {
    zonedDate.setHours(0, 0, 0, 0);
  }

  return fromZonedTime(zonedDate, timezone).toISOString();
};

export const getRollupBucketKey = (
  timestamp: string,
  level: ReadingRollupLevel,
  timezone: string
): string => `${level}#${getRollupBucketStart(timestamp, level, timezone)}`;

export const mergeRollupStats = (
  existing: ReadingRollupStats | undefined,
  next: ReadingRollupStats
): ReadingRollupStats => {
  if (!existing) return roundRollupStats(next);

  const count = existing.count + next.count;

  return roundRollupStats({
    avg: (existing.avg * existing.count + next.avg * next.count) / count,
    min: Math.min(existing.min, next.min),
    max: Math.max(existing.max, next.max),
    count,
  });
};

const getSensorValue = (reading: Reading, type: SensorType): number | undefined => {
  if (type === 'airQuality') {
    return airQualityFromPm25Co2(reading.pm25, reading.co2);
  }

  return reading[type];
};

const updateReadingRollup = async (
  reading: Reading,
  level: ReadingRollupLevel,
  timezone: string
): Promise<void> => {
  const bucketStart = getRollupBucketStart(reading.timestamp, level, timezone);
  const bucketKey = `${level}#${bucketStart}`;

  const existingResult = await docClient.send(
    new GetCommand({
      TableName: TABLES.READING_ROLLUPS,
      Key: {
        deviceId: reading.deviceId,
        bucketKey,
      },
    })
  );

  const existing = existingResult.Item as ReadingRollup | undefined;
  const baseRollup: ReadingRollup = {
    ...existing,
    deviceId: reading.deviceId,
    bucketKey,
    level,
    bucketStart,
    timezone,
  };

  // Rollups are sparse: merge only sensor values that this reading actually contains.
  // Store airQuality too; its formula is non-linear, so average(score(pm25, co2))
  // is not the same as score(average(pm25), average(co2)).
  const nextRollup = sensorTypes.reduce<ReadingRollup>(
    (rollup, type) => {
      const value = getSensorValue(reading, type);
      if (value === undefined) return rollup;

      return {
        ...rollup,
        [type]: mergeRollupStats(rollup[type], {
          avg: value,
          min: value,
          max: value,
          count: 1,
        }),
      };
    },
    baseRollup
  );

  await docClient.send(
    new PutCommand({
      TableName: TABLES.READING_ROLLUPS,
      Item: nextRollup,
    })
  );
};

export const updateReadingRollups = async (
  reading: Reading,
  timezone: string
): Promise<void> => {
  await Promise.all(
    rollupLevels.map((level) => updateReadingRollup(reading, level, timezone))
  );
};

const getSourceRollupLevel = (level: TimeLevel): ReadingRollupLevel =>
  level === '30 minutes' ? '30m' : 'day';

const truncateRollupTime = (timestamp: string, level: TimeLevel, timezone: string): string => {
  if (level === '30 minutes') return getRollupBucketStart(timestamp, '30m', timezone);
  if (level === 'day') return getRollupBucketStart(timestamp, 'day', timezone);

  const zonedDate = toZonedTime(new Date(timestamp), timezone);

  // Convert any date inside a week/month to that bucket's local start date.
  // getDay() returns Sunday as 0, Monday as 1, etc. For week buckets we subtract
  // the number of days since Monday, with Sunday treated as 6 days after Monday.
  if (level === 'week') {
    const dayOfWeek = zonedDate.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    zonedDate.setDate(zonedDate.getDate() - daysToMonday);
  } else {
    zonedDate.setDate(1);
  }

  zonedDate.setHours(0, 0, 0, 0);
  return fromZonedTime(zonedDate, timezone).toISOString();
};

const queryRollupsInRange = async (params: {
  deviceId: string;
  startTime: string;
  endTime: string;
  sourceLevel: ReadingRollupLevel;
}): Promise<ReadingRollup[]> => {
  const rollups: ReadingRollup[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.READING_ROLLUPS,
        KeyConditionExpression: 'deviceId = :deviceId AND bucketKey BETWEEN :startKey AND :endKey',
        ExpressionAttributeValues: {
          ':deviceId': params.deviceId,
          ':startKey': `${params.sourceLevel}#${params.startTime}`,
          ':endKey': `${params.sourceLevel}#${params.endTime}`,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    rollups.push(...((result.Items || []) as ReadingRollup[]));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return rollups;
};

const getRollupSensorStats = (
  rollup: ReadingRollup,
  type: SensorType
): ReadingRollupStats | undefined => rollup[type];

export const aggregateRollups = (
  rollups: ReadingRollup[],
  type: SensorType,
  level: TimeLevel,
  timezone: string
): TimedAvgMinMax[] => {
  // Query results are stored as 30-minute or daily rows. When the API asks for
  // week/month values, multiple stored rows belong to one graph bucket, so merge
  // their stats by bucket timestamp. Averages must be weighted by each row's count.
  const grouped = rollups.reduce<Map<string, ReadingRollupStats>>((acc, rollup) => {
    const stats = getRollupSensorStats(rollup, type);
    if (!stats) return acc;

    const timestamp = truncateRollupTime(rollup.bucketStart, level, timezone);
    acc.set(timestamp, mergeRollupStats(acc.get(timestamp), stats));

    return acc;
  }, new Map<string, ReadingRollupStats>());

  return Array.from(grouped)
    .map(([timestamp, stats]) => ({
      timestamp,
      avg: stats.avg,
      min: stats.min,
      max: stats.max,
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
};

export const queryAggregatedRollups = async (params: {
  deviceId: string;
  startTime: string;
  endTime: string;
  type: SensorType;
  level: TimeLevel;
  timezone: string;
}): Promise<TimedAvgMinMax[]> => {
  const sourceLevel = getSourceRollupLevel(params.level);
  const rollups = await queryRollupsInRange({
    deviceId: params.deviceId,
    startTime: params.startTime,
    endTime: params.endTime,
    sourceLevel,
  });

  return aggregateRollups(rollups, params.type, params.level, params.timezone);
};

export const queryAggregatedRollupsByType = async (params: {
  deviceId: string;
  startTime: string;
  endTime: string;
  types: SensorType[];
  level: TimeLevel;
  timezone: string;
}): Promise<SensorReadings[]> => {
  const sourceLevel = getSourceRollupLevel(params.level);
  const rollups = await queryRollupsInRange({
    deviceId: params.deviceId,
    startTime: params.startTime,
    endTime: params.endTime,
    sourceLevel,
  });

  return params.types.map((type) => ({
    type,
    values: aggregateRollups(rollups, type, params.level, params.timezone),
  }));
};
