import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { sensorTypes } from '../api-types';
import { TABLES } from '../config/constants';
import { createDynamoDBClient } from '../lib/db-client';
import { airQualityFromPm25Co2 } from '../utils/air-quality';
import type { SensorType } from '../api-types';
import type {
  Reading,
  ReadingRollup,
  ReadingRollupLevel,
  ReadingRollupStats,
} from '../db-types';

const docClient = createDynamoDBClient();

const rollupLevels: ReadingRollupLevel[] = ['30m', 'day'];

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
  value: number
): ReadingRollupStats => {
  if (!existing) {
    return { avg: value, min: value, max: value, count: 1 };
  }

  const count = existing.count + 1;

  return {
    avg: (existing.avg * existing.count + value) / count,
    min: Math.min(existing.min, value),
    max: Math.max(existing.max, value),
    count,
  };
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
        [type]: mergeRollupStats(rollup[type], value),
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
